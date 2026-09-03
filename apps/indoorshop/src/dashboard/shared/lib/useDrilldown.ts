import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  drilldownHref,
  drilldownLevel,
  isTopDrilldown,
  narrowDrilldown,
  parentDrilldown,
  parseDrilldown,
  YARD_DRILLDOWN,
  type DrilldownLevel,
  type DrilldownState,
} from './drilldownUrl'

/*
 * 드릴다운을 URL 로 읽고 쓰는 훅 — 화면이 드릴다운 상태를 **따로 들지 않게** 한다.
 * 규칙(무엇이 하위를 버리는가·무엇이 공존하는가)은 전부 `drilldownUrl.ts` 에 있다.
 */

export interface DrilldownApi extends DrilldownState {
  level: DrilldownLevel
  isTop: boolean
  /**
   * 한 단계 들어간다 — **히스토리를 쌓는다(push)**. 그래야 브라우저 뒤로가기가
   * 드릴아웃이 된다. 이것이 이 작업의 요점이므로 replace 로 바꾸지 말 것.
   */
  go: (patch: Partial<DrilldownState>) => void
  /** 상태를 통째로 갈아 끼운다(브레드크럼 조각 클릭) — 역시 push */
  set: (next: DrilldownState) => void
  /** 한 단계 위 (ESC·브레드크럼). 최상위면 아무 일도 하지 않는다 */
  up: () => void
  /** 최상위로 ('전체 보기' 버튼) */
  reset: () => void
  /** 그 단계로 가는 링크 주소 — 브레드크럼 조각이 진짜 `<a>` 로 서게 한다 */
  hrefFor: (next: DrilldownState) => string
}

export function useDrilldown(): DrilldownApi {
  const [searchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const state = useMemo(() => parseDrilldown(searchParams), [searchParams])

  const hrefFor = useCallback(
    (next: DrilldownState) => drilldownHref(pathname, searchParams, next),
    [pathname, searchParams],
  )

  const set = useCallback(
    (next: DrilldownState) => {
      const href = drilldownHref(pathname, searchParams, next)
      /* 같은 자리로의 이동은 히스토리에 쌓지 않는다 — 뒤로가기가 제자리걸음이 된다 */
      if (href === `${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`) return
      void navigate(href)
    },
    [navigate, pathname, searchParams],
  )

  const go = useCallback(
    (patch: Partial<DrilldownState>) => set(narrowDrilldown(state, patch)),
    [set, state],
  )

  const up = useCallback(() => {
    if (isTopDrilldown(state)) return
    set(parentDrilldown(state))
  }, [set, state])

  const reset = useCallback(() => set(YARD_DRILLDOWN), [set])

  return useMemo(
    () => ({
      ...state,
      level: drilldownLevel(state),
      isTop: isTopDrilldown(state),
      go,
      set,
      up,
      reset,
      hrefFor,
    }),
    [state, go, set, up, reset, hrefFor],
  )
}
