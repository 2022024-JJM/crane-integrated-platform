import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DATE_PARAMS,
  dateParamsOf,
  dateParamsWithMemory,
  instantOf,
  parseDateParams,
  rememberDateSelection,
  rewindDaysOf,
  todayString,
  windowOf,
  type BaseDateSelection,
  type DateWindow,
} from './timeAxis'
import { useClock } from './useClock'

/*
 * 화면이 **기준일을 받는 하나의 길**.
 *
 * 통합실적은 `?date=`·`?span=` 으로 시간축을 옮길 수 있었는데, 그 옆의 조립·의장·설비
 * 화면은 제 시계를 읽어 늘 오늘을 말했다. 그래서 사흘 전을 조회한 채 공정 화면으로
 * 건너가면 같은 앱이 두 날짜를 동시에 주장했다(연계 매트릭스 §2.3 · 동선 5위).
 *
 * 이 훅은 그 문법을 **한 벌로** 만든다 — 주소가 축의 정본이고, 화면은 그 축을 읽어
 * 데이터 함수에 그대로 넘긴다. 링크를 복사하면 날짜까지 함께 간다.
 *
 * 축을 바꾸는 컨트롤(`BaseDateControl`)은 통합실적과 공정 [실적] 화면에 함께 선다(사용자 확정).
 * 쓰는 자리가 여럿이어도 정본은 **주소 한 곳**이다 — 모두 `useBaseDateWriter` 로 같은 파라미터를
 * 고치므로, 어느 화면에서 바꾸든 다른 화면으로 건너가면 같은 날짜로 선다.
 */

export interface BaseDateAxis {
  /** 조회 조건 한 벌 (기준일 + 창 길이 + 어느 프리셋에서 왔는가) */
  selection: BaseDateSelection
  /** 기준일 `YYYY-MM-DD` — 데이터 함수에 그대로 넘기는 값 */
  baseDate: string
  /** 조회 창 (기준일 포함 spanDays 일) */
  window: DateWindow
  /** 오늘 — 마운트 시점에 굳힌다(렌더마다 시계를 읽으면 이펙트가 계속 다시 돈다) */
  today: string
  /** 기준일이 오늘로부터 며칠 전인가 — 되감기 폭 */
  rewindDays: number
  /** 기준일이 오늘인가 — '지금'을 그대로 써도 되는 경우 */
  isToday: boolean
}

export function useBaseDate(): BaseDateAxis {
  const [searchParams] = useSearchParams()
  /* 오늘은 마운트 때 한 번 — 통합실적이 쓰는 규칙과 같다 */
  const today = useMemo(() => todayString(), [])
  /* 파라미터 **값**으로 기억한다: URLSearchParams 는 렌더마다 새 객체라 그대로 두면
     기준일이 그대로여도 아래 값들이 매번 새로 서고, 그것을 deps 로 쓰는 조회가 계속 돈다 */
  const dateParam = searchParams.get('date')
  const spanParam = searchParams.get('span')

  return useMemo(() => {
    const params = new URLSearchParams()
    if (dateParam) params.set('date', dateParam)
    if (spanParam) params.set('span', spanParam)
    /* 주소에 날짜가 없으면 마지막으로 고른 날짜로 — 탭을 옮겨도 날짜가 이어진다 */
    const selection = parseDateParams(dateParamsWithMemory(params), today)
    return {
      selection,
      baseDate: selection.date,
      window: windowOf(selection),
      today,
      rewindDays: rewindDaysOf(selection.date, today),
      isToday: selection.date === today,
    }
  }, [dateParam, spanParam, today])
}

/**
 * 축을 따라가는 시계 — 경과 시간을 재는 자리(하트비트·최근 스캔)가 쓴다.
 *
 * 기준일이 오늘이면 지금까지처럼 **흐르는 시계**이고, 과거면 **그날의 끝에서 멈춘 시계**다.
 * 이 구분이 없으면 사흘 전 화면에서 "하트비트 4320분 전"이 뜬다 — 그 화면이 말하는 날에
 * 서 있지 않고 오늘에서 과거를 내려다보기 때문이다.
 */
export function useAxisNow(intervalMs = 30_000): Date {
  const { baseDate, isToday } = useBaseDate()
  const live = useClock(intervalMs)
  const frozen = useMemo(() => new Date(instantOf(baseDate)), [baseDate])
  return isToday ? live : frozen
}

/**
 * 기준일을 **주소에** 적는다 — 상태와 URL 을 따로 두지 않는다(`useBaseDate` 가 읽는 그 자리).
 *
 * 기본값(오늘 하루)이면 파라미터를 **지운다** — 오늘 날짜가 박힌 링크는 내일 거짓이 된다.
 * 기록은 `replace` 다: 날짜는 조회 조건이지 다른 자리로의 이동이 아니다.
 */
export function useBaseDateWriter(): (next: BaseDateSelection) => void {
  const [, setSearchParams] = useSearchParams()
  const today = useMemo(() => todayString(), [])
  return useCallback(
    (next: BaseDateSelection) => {
      rememberDateSelection(next, today)
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          params.delete(DATE_PARAMS.date)
          params.delete(DATE_PARAMS.span)
          for (const [key, value] of Object.entries(dateParamsOf(next, today))) params.set(key, value)
          return params
        },
        { replace: true }
      )
    },
    [setSearchParams, today]
  )
}
