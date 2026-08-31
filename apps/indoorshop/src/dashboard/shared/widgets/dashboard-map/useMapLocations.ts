import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ProcessMapDrilldownProvider,
  ProcessMapLocation,
} from '../../model/processMapDrilldown'

/**
 * 고른 공장의 **작업 위치** 조회 상태
 * (`docs/PRD_전체현황_공정존_베이_드릴다운_개선.md` FR-5·FR-7, §7 표).
 *
 * 로딩·빈 값·오류·매핑 없음·provider 미지원을 **한 값으로** 가른다. 화면이 이것들을
 * `locations.length === 0` 같은 것으로 되짚으면 "아직 안 왔다"와 "없다"가 같은 그림이
 * 되어, 다른 공장의 목록을 그대로 둔 채 로딩을 놓치는 종류의 사고가 난다.
 */
export type MapLocationsState =
  /** 공장을 아직 고르지 않았다 */
  | { kind: 'idle' }
  /** 이 공정은 작업 위치 provider 를 내지 않는다 — 오류가 아니다 (FR-3) */
  | { kind: 'unsupported' }
  | { kind: 'loading' }
  /** provider 가 이 공장 키를 모른다 — 지도 공장 ↔ 공정 공장 매핑 불일치 */
  | { kind: 'unmapped' }
  | { kind: 'error' }
  | { kind: 'ready'; facilityPath: string | null; locations: ProcessMapLocation[] }

/**
 * 마지막 요청만 반영하는 문지기 (PRD 수용 기준 12).
 *
 * 공장을 빠르게 옮겨 다니면 앞 공장의 응답이 뒤늦게 도착해 지금 공장의 목록을 덮어쓸
 * 수 있다. 요청마다 번호를 매기고 **가장 마지막 요청의 응답만** 통과시켜 그 창을 닫는다.
 * (`AbortController` 로는 부족하다 — provider 는 임의의 Promise 라 취소 신호를 받아
 * 준다는 보장이 없다. 도착한 응답을 버리는 쪽이 계약에 기대지 않아 확실하다.)
 *
 * 훅 밖의 순수 객체라 단위 테스트가 된다.
 */
export function latestRequestGate(): { begin: () => number; isCurrent: (token: number) => boolean } {
  let latest = 0
  return {
    begin: () => ++latest,
    isCurrent: (token) => token === latest,
  }
}

/**
 * 공장을 고른 뒤에야 그 공장의 작업 위치를 조회한다 (FR-7 — 지연 조회).
 * 응답 경쟁은 위 `latestRequestGate` 가 막는다.
 */
export function useMapLocations(
  provider: ProcessMapDrilldownProvider | null,
  facilityKey: string | null
): { state: MapLocationsState; retry: () => void } {
  const [state, setState] = useState<MapLocationsState>({ kind: 'idle' })
  /* 도착한 응답이 지난 공장의 것이면 버린다 — 훅이 사는 동안 하나만 있으면 된다 */
  const gateRef = useRef<ReturnType<typeof latestRequestGate> | null>(null)
  gateRef.current ??= latestRequestGate()
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    const gate = gateRef.current!
    const request = gate.begin()
    if (!facilityKey) {
      setState({ kind: 'idle' })
      return
    }
    if (!provider) {
      setState({ kind: 'unsupported' })
      return
    }
    setState({ kind: 'loading' })
    provider
      .fetchLocations(facilityKey)
      .then((result) => {
        if (!gate.isCurrent(request)) return
        setState(
          result.kind === 'unmapped'
            ? { kind: 'unmapped' }
            : {
                kind: 'ready',
                facilityPath: result.facilityPath,
                locations: result.locations,
              }
        )
      })
      .catch(() => {
        if (!gate.isCurrent(request)) return
        setState({ kind: 'error' })
      })
  }, [provider, facilityKey, retryToken])

  const retry = useCallback(() => setRetryToken((token) => token + 1), [])
  return { state, retry }
}

/** 조회가 끝나 실제로 목록이 있을 때만 그 목록 — 화면 여러 곳에서 같은 판정을 반복하지 않도록 */
export function locationsOf(state: MapLocationsState): ProcessMapLocation[] {
  return state.kind === 'ready' ? state.locations : []
}
