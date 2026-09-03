import { useCallback, useMemo } from 'react'
import {
  createLiveStoreFamily,
  pollingDriver,
  useLiveStore,
} from '../../../shared/lib/liveStore'
import type { PaintingEquipmentStatus } from '../model/equipmentStatus'
import { fetchEquipmentStatus } from '../api/paintingRepository'

/*
 * ── 도장 설비 상태 구독 훅 ──
 *
 * `useAsyncData` 는 deps 가 바뀔 때 한 번만 부른다(1회성) — 실측값이 계속 흐르는 도장
 * 데이터에는 모자란다. 예전에는 이 훅이 자기 안에서 `setInterval` 을 돌렸지만, 지금은
 * **공용 구독 스토어**(`shared/lib/liveStore`)에 얹었다. 세 가지가 달라진다:
 *
 *   1. 같은 설비 집합을 보는 두 컴포넌트(맵·목록)가 폴링을 **한 번만** 돌린다.
 *   2. 실패가 채널로 나온다 — `error` + `retry`. 예전에는 실패가 조용히 사라져
 *      "값이 안 바뀌는" 것과 "못 받는" 것이 화면에서 같아 보였다.
 *   3. 실연동 시 **드라이버만 교체**하면 된다(`pollingDriver` → `websocketDriver`).
 *      이 훅도, 화면도 손대지 않는다.
 *
 * 다시 받는 동안 **이전 값을 지우지 않는다**(useAsyncData 와 같은 규칙) — 지우면 화면이
 * 매 폴링마다 깜박인다. 호출부는 `loading`(첫 로드) 과 `polledAt` 을 보고 신선도를 낸다.
 */

interface PolledStatus {
  /** 설비 ID → 최신 상태 */
  byId: Map<string, PaintingEquipmentStatus>
  /** 첫 로드 중인가 (이전 값이 아직 없음) */
  loading: boolean
  /** 마지막으로 폴링을 마친 시각(epoch ms) — 화면 상단 "갱신됨" 표시에 쓴다 */
  polledAt: number | null
  /** 마지막 실패 — 성공하면 지워진다. `null` 이면 정상 */
  error: Error | null
  /** 지금 다시 받기 — 실패 표시의 '다시 시도' */
  retry: () => void
}

const EMPTY = new Map<string, PaintingEquipmentStatus>()

/* 설비 집합 + 주기가 곧 스토어의 신원이다 — 같은 공장을 두 곳에서 봐도 스토어는 하나 */
const stores = createLiveStoreFamily<Map<string, PaintingEquipmentStatus>>((key) => {
  const [idPart, intervalPart] = splitKey(key)
  const ids = idPart ? idPart.split(',') : []
  return pollingDriver(
    async (now) => new Map((await fetchEquipmentStatus(ids, now)).map((s) => [s.id, s])),
    { intervalMs: Number(intervalPart) }
  )
})

/** 키는 `{주기}|{id,id,…}` — 주기를 앞에 두어 id 안의 구분자와 헷갈리지 않게 한다 */
function keyOf(ids: readonly string[], intervalMs: number): string {
  return `${intervalMs}|${ids.join(',')}`
}

function splitKey(key: string): [string, string] {
  const cut = key.indexOf('|')
  return [key.slice(cut + 1), key.slice(0, cut)]
}

export function usePolledEquipmentStatus(
  ids: readonly string[],
  intervalMs = 6_000
): PolledStatus {
  /* id 목록의 신원을 문자열로 접는다 — 배열 참조가 매 렌더 달라도 내용이 같으면 같은 스토어 */
  const key = keyOf(ids, intervalMs)
  const store = useMemo(() => stores.of(key), [key])
  const live = useLiveStore(store)
  const retry = useCallback(() => store.refresh(), [store])

  return {
    byId: live.data ?? EMPTY,
    /* 이전 값이 아직 없을 때만 '첫 로드' 다 — 갱신 중에는 화면을 비우지 않는다 */
    loading: live.data === null && live.status !== 'error',
    polledAt: live.lastSuccessAt,
    error: live.error,
    retry,
  }
}
