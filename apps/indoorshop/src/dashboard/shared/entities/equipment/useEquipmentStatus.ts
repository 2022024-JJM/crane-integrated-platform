/*
 * 설비 상태를 **흐르는 값**으로 읽는 훅 — 화면이 상태를 받는 유일한 길.
 *
 * 계약(`statusApi`)은 "한 번 물어본다"까지고, 화면이 필요한 것은 "계속 받는다"이다.
 * 그 사이를 `shared/lib/liveStore` 가 잇는다 — 스토어가 공장마다 하나씩 있으므로 같은
 * 공장을 보는 두 컴포넌트(맵 마커·우측 목록)가 폴링을 두 번 돌리지 않는다.
 *
 * ⚠️ **실연동 시 바꾸는 곳은 아래 드라이버 한 줄이다.** `pollingDriver(...)` 를
 *    `websocketDriver(...)` 로 갈아끼우면 이 훅의 반환 계약도, 화면도 그대로다.
 */
import { useCallback } from 'react'
import {
  createLiveStoreFamily,
  pollingDriver,
  useLiveStore,
  type LiveStatus,
  type LiveStore,
} from '../../lib/liveStore'
import {
  EMPTY_EQUIPMENT_STATUS,
  equipmentIdsOfFactory,
  fetchEquipmentStatuses,
  fetchFactoryEquipmentStatuses,
  type EquipmentStatusSnapshot,
} from './statusApi'
import { nowMs } from '../../lib/now'
import { instantOf } from '../../lib/timeAxis'
import { useBaseDate } from '../../lib/useBaseDate'

/**
 * 갱신 주기 (ms) — 도장 SCADA 폴링과 같은 6초.
 *
 * 두 공정이 다른 주기로 돌면 같은 화면 안에서 값의 나이가 갈린다. 실연동(push)에서는
 * 주기라는 개념이 사라지므로 이 상수도 함께 없어진다.
 */
export const EQUIPMENT_STATUS_INTERVAL_MS = 6_000

/*
 * 스토어 키 = `공장@기준일`.
 *
 * 기준일이 키에 들어가는 이유는 하나다 — 같은 공장을 **오늘로 보는 화면**과 **사흘 전으로
 * 보는 화면**이 한 스토어를 나눠 쓰면 서로의 값을 덮어쓴다. 날짜가 다르면 다른 흐름이다.
 */
function storeKey(scope: string, baseDate: string | undefined): string {
  return `${scope}@${baseDate ?? ''}`
}

function parseKey(key: string): { scope: string; baseDate: string | undefined } {
  const at = key.lastIndexOf('@')
  const scope = key.slice(0, at)
  const baseDate = key.slice(at + 1)
  return { scope, baseDate: baseDate || undefined }
}

/**
 * 그 흐름의 시계 — 기준일이 뜻하는 순간.
 *
 * 오늘이면 진짜 지금이라 지금까지와 완전히 같고, 과거면 그날의 끝에서 멈춘다. 과거를
 * 보는 화면에서 하트비트만 '방금'이면 그 화면은 두 날짜를 동시에 말하는 셈이 된다.
 * (과거 기준일에서는 폴링이 같은 값을 다시 실어 나른다 — 값이 흔들리지 않는 편이
 *  중요하고, 흐름을 날짜별로 갈라 두는 편이 화면 코드를 단순하게 둔다.)
 */
function clockOf(baseDate: string | undefined): () => number {
  return baseDate ? () => instantOf(baseDate) : nowMs
}

/* 공장 하나 = 스토어 하나 — 같은 공장을 보는 두 컴포넌트가 폴링을 두 번 돌리지 않는다 */
const factoryStores = createLiveStoreFamily<EquipmentStatusSnapshot>((key) => {
  const { scope: factory, baseDate } = parseKey(key)
  return pollingDriver((now) => fetchFactoryEquipmentStatuses(factory, now), {
    intervalMs: EQUIPMENT_STATUS_INTERVAL_MS,
    now: clockOf(baseDate),
  })
})

export interface LiveEquipmentStatus {
  /** 마지막으로 받은 스냅샷 — 아직 못 받았으면 빈 스냅샷(null 이 아니다) */
  snapshot: EquipmentStatusSnapshot
  status: LiveStatus
  error: Error | null
  /** 마지막 성공 시각 — 실패해도 남는다(실패 UI 가 "언제까지는 받았다"를 말한다) */
  lastSuccessAt: number | null
  /** 지금 다시 받기 — 실패 UI 의 재시도 버튼 */
  refresh: () => void
}

/**
 * 한 공장의 설비 상태를 구독한다.
 *
 * 빈 문자열을 주면 빈 스냅샷을 받는다 — 공장을 아직 고르지 않은 화면이 조건부로 훅을
 * 부르지 않아도 되게(훅 규칙을 어기지 않게) 열어 둔다.
 */
export function useFactoryEquipmentStatus(
  factory: string,
  /**
   * 기준일 — **주지 않으면 주소의 축(`?date=`)을 따라간다.**
   *
   * 설비 상태는 목록·맵 마커·베이 카드 등 화면 깊숙한 곳에서 구독된다. 그 자리마다
   * 기준일을 prop 으로 내려보내면 중간 컴포넌트들이 자기와 상관없는 값을 나르게 되고,
   * 한 군데만 빠뜨려도 그 화면만 오늘로 돌아간다 — 그래서 훅이 축 위에 선다.
   */
  baseDate?: string
): LiveEquipmentStatus {
  const axis = useBaseDate()
  return useStore(factoryStores.of(storeKey(factory, baseDate ?? axis.baseDate)))
}

/* 여러 공장을 한 화면에서 함께 보는 자리(도장 맵의 공장 카드들)를 위한 스토어.
 * 공장마다 훅을 부를 수는 없으므로(훅 개수가 렌더마다 달라진다) 한 스토어로 묶는다. */
const multiFactoryStores = createLiveStoreFamily<EquipmentStatusSnapshot>((key) => {
  const { scope, baseDate } = parseKey(key)
  const ids = scope.split('|').filter(Boolean).flatMap(equipmentIdsOfFactory)
  return pollingDriver((now) => fetchEquipmentStatuses(ids, now), {
    intervalMs: EQUIPMENT_STATUS_INTERVAL_MS,
    now: clockOf(baseDate),
  })
})

/** 여러 공장의 설비 상태를 한 스냅샷으로 구독한다 */
export function useFactoriesEquipmentStatus(
  factories: readonly string[],
  baseDate?: string
): LiveEquipmentStatus {
  const axis = useBaseDate()
  /* 배열 참조가 매 렌더 달라도 내용이 같으면 같은 스토어를 본다 */
  return useStore(multiFactoryStores.of(storeKey(factories.join('|'), baseDate ?? axis.baseDate)))
}

function useStore(store: LiveStore<EquipmentStatusSnapshot>): LiveEquipmentStatus {
  const live = useLiveStore(store)
  const refresh = useCallback(() => store.refresh(), [store])

  return {
    snapshot: live.data ?? EMPTY_EQUIPMENT_STATUS,
    status: live.status,
    error: live.error,
    lastSuccessAt: live.lastSuccessAt,
    refresh,
  }
}
