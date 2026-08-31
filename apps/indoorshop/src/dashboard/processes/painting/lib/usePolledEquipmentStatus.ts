import { useEffect, useRef, useState } from 'react'
import type { PaintingEquipmentStatus } from '../model/equipmentStatus'
import { fetchEquipmentStatus } from '../api/paintingRepository'

/*
 * ── 도장 설비 상태 폴링 훅 ──
 *
 * `useAsyncData` 는 deps 가 바뀔 때 한 번만 부른다(1회성) — 실측값이 계속 흐르는 도장
 * 데이터에는 모자란다. 그래서 여기서 **주기 폴링**을 따로 둔다: 처음 한 번 받고, 그 뒤
 * `intervalMs` 마다 다시 받아 값과 "최근 수신 시각"을 갱신한다. 실 데이터로 바뀌어도
 * 이 훅은 그대로다(안이 `fetchEquipmentStatus` 만 실 조회로 바뀐다).
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
}

const EMPTY = new Map<string, PaintingEquipmentStatus>()

export function usePolledEquipmentStatus(
  ids: readonly string[],
  intervalMs = 6_000
): PolledStatus {
  const [state, setState] = useState<PolledStatus>({
    byId: EMPTY,
    loading: true,
    polledAt: null,
  })

  // id 목록의 신원을 문자열로 접어 둔다 — 배열 참조가 매 렌더 달라도 내용이 같으면 다시 걸지 않는다
  const key = ids.join(',')
  const idsRef = useRef(ids)
  idsRef.current = ids

  useEffect(() => {
    let cancelled = false
    const currentIds = idsRef.current

    if (currentIds.length === 0) {
      setState({ byId: EMPTY, loading: false, polledAt: Date.now() })
      return
    }

    // id 집합이 바뀌면 첫 로드로 되돌린다(이전 공장 값 위에 로딩 표시)
    setState((prev) => ({ ...prev, loading: true }))

    const poll = () => {
      const now = Date.now()
      fetchEquipmentStatus(currentIds, now).then((list) => {
        if (cancelled) return
        setState({
          byId: new Map(list.map((s) => [s.id, s])),
          loading: false,
          polledAt: now,
        })
      })
    }

    poll()
    const timer = window.setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // key 로 id 집합 변화를 잡는다 (내용이 같으면 재구독하지 않는다)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs])

  return state
}
