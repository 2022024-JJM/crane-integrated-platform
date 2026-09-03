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

/**
 * 갱신 주기 (ms) — 도장 SCADA 폴링과 같은 6초.
 *
 * 두 공정이 다른 주기로 돌면 같은 화면 안에서 값의 나이가 갈린다. 실연동(push)에서는
 * 주기라는 개념이 사라지므로 이 상수도 함께 없어진다.
 */
export const EQUIPMENT_STATUS_INTERVAL_MS = 6_000

/* 공장 하나 = 스토어 하나 — 같은 공장을 보는 두 컴포넌트가 폴링을 두 번 돌리지 않는다 */
const factoryStores = createLiveStoreFamily<EquipmentStatusSnapshot>((factory) =>
  pollingDriver((now) => fetchFactoryEquipmentStatuses(factory, now), {
    intervalMs: EQUIPMENT_STATUS_INTERVAL_MS,
  })
)

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
export function useFactoryEquipmentStatus(factory: string): LiveEquipmentStatus {
  return useStore(factoryStores.of(factory))
}

/* 여러 공장을 한 화면에서 함께 보는 자리(도장 맵의 공장 카드들)를 위한 스토어.
 * 공장마다 훅을 부를 수는 없으므로(훅 개수가 렌더마다 달라진다) 한 스토어로 묶는다. */
const multiFactoryStores = createLiveStoreFamily<EquipmentStatusSnapshot>((key) => {
  const ids = key.split('|').filter(Boolean).flatMap(equipmentIdsOfFactory)
  return pollingDriver((now) => fetchEquipmentStatuses(ids, now), {
    intervalMs: EQUIPMENT_STATUS_INTERVAL_MS,
  })
})

/** 여러 공장의 설비 상태를 한 스냅샷으로 구독한다 */
export function useFactoriesEquipmentStatus(
  factories: readonly string[]
): LiveEquipmentStatus {
  /* 배열 참조가 매 렌더 달라도 내용이 같으면 같은 스토어를 본다 */
  return useStore(multiFactoryStores.of(factories.join('|')))
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
