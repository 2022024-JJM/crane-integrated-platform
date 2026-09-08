import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  instantOf,
  parseDateParams,
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
 * ⚠️ 여기서 축을 **쓰지는** 않는다(읽기 전용). 기준일을 바꾸는 컨트롤은 통합실적의
 *    `BaseDateControl` 하나뿐이고, 공정 화면은 그 링크를 따라올 뿐이다 — 같은 축을
 *    두 곳에서 쓰면 어느 쪽이 정본인지 사라진다.
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
    const selection = parseDateParams(params, today)
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
