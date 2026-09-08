import { nowDate, nowMs } from './now'

/*
 * 앱의 **시간축** — 기준일과 조회 창.
 *
 * 처음에는 통합실적만의 것이었다(W7-2, `features/performance/lib/baseDate`). 그런데
 * 기준일을 되감았을 때 통합실적만 과거를 말하고 조립·의장·설비 화면은 오늘을 말하면,
 * 한 앱이 두 날짜를 동시에 주장하는 셈이 된다 — 그래서 축을 공용 자리로 올린다.
 * 옛 경로는 얇은 재수출로 남는다(기존 호출부 무변경).
 *
 * 이 화면은 지금까지 '오늘' 하나만 볼 수 있었다. 실적을 확인하는 일은 대개 "어제까지
 * 뭐가 들어왔나"·"지난주에 저 블록 언제 넘어갔나"라서, 기준일을 못 옮기면 화면이
 * 답할 수 없는 질문이 많았다.
 *
 * 별도 화면을 만들지 않고 통합실적 안에 녹인다(사용자 확정) — 시간축은 조회 조건이지
 * 다른 화면이 아니기 때문이다. 그래서 여기 있는 것은 **조회 조건 하나의 모델**이다:
 * 기준일 한 날과, 그 앞으로 며칠까지 볼 것인가(창 길이).
 *
 * 규칙 셋:
 *  · **미래는 없다.** 기준일은 오늘을 넘지 못하고, 창의 끝도 기준일이다. 아직 일어나지
 *    않은 일을 실적으로 보여 주면 그건 실적이 아니다.
 *  · **기본은 오늘·하루.** 기존 호출부가 기준일을 넘기지 않아도 지금까지와 똑같이 돈다.
 *  · **날짜 문자열은 `YYYY-MM-DD` 로컬 날짜다.** `toISOString()` 을 쓰지 않는다 — UTC 로
 *    밀려 한국 시간 오전에는 어제가 나온다.
 */

/** 기준일 프리셋 — 달력을 열지 않고 고르는 자리 */
export type BaseDatePreset = 'today' | 'yesterday' | 'last7' | 'custom'

/** 조회 조건으로서의 시간축 한 벌 */
export interface BaseDateSelection {
  /** 기준일 (창의 **끝**) — `YYYY-MM-DD` */
  date: string
  /**
   * 창 길이(일). 1 이면 기준일 하루만, 7 이면 기준일 포함 지난 7일.
   * 프리셋 '지난 7일' 이 이 값을 7 로 세운다.
   */
  spanDays: number
  /** 어느 프리셋에서 왔는가 — 버튼 눌림 표시용(값 자체는 date·spanDays 가 정본) */
  preset: BaseDatePreset
}

/** 조회 창 — `from` 이상 `to` 이하 (양끝 포함) */
export interface DateWindow {
  from: string
  to: string
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** 오늘(YYYY-MM-DD) — 로컬 날짜. 시계는 seam(`shared/lib/now`)에서만 읽는다 */
export function todayString(now: Date = nowDate()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** 날짜를 며칠 옮긴다 (음수면 과거로) */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return todayString(d)
}

/** 두 날짜의 간격(일) — `later - earlier`. 같은 날이면 0, 미래면 음수 */
export function daysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00`).getTime()
  const b = new Date(`${later}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** `YYYY-MM-DD` 형태이고 실제로 존재하는 날짜인가 */
export function isValidDateString(value: string | null | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false
  const d = new Date(`${value}T00:00:00`)
  return !Number.isNaN(d.getTime()) && todayString(d) === value
}

/** 기준일 프리셋 → 선택. `today` 는 호출 시점의 오늘을 기준으로 센다 */
export function selectionOfPreset(
  preset: Exclude<BaseDatePreset, 'custom'>,
  today: string = todayString()
): BaseDateSelection {
  if (preset === 'yesterday') {
    return { date: shiftDate(today, -1), spanDays: 1, preset }
  }
  if (preset === 'last7') {
    return { date: today, spanDays: 7, preset }
  }
  return { date: today, spanDays: 1, preset }
}

/** 화면이 처음 서는 조건 — 오늘 하루 */
export function defaultSelection(today: string = todayString()): BaseDateSelection {
  return selectionOfPreset('today', today)
}

/**
 * 달력에서 고른 하루 → 선택. **오늘을 넘는 날짜는 오늘로 접는다**(미래 조회 금지).
 * 고른 날이 오늘이면 프리셋도 '오늘' 로 돌아간다 — 같은 상태를 두 이름으로 부르지 않는다.
 */
export function selectionOfDate(
  date: string,
  today: string = todayString(),
  spanDays = 1
): BaseDateSelection {
  const clamped = !isValidDateString(date) || date > today ? today : date
  const span = Math.max(1, Math.round(spanDays))
  if (span === 1 && clamped === today) return selectionOfPreset('today', today)
  if (span === 1 && clamped === shiftDate(today, -1)) return selectionOfPreset('yesterday', today)
  return { date: clamped, spanDays: span, preset: 'custom' }
}

/** 이 선택이 여는 조회 창 — 끝은 언제나 기준일이다(그 뒤는 아직 일어나지 않았다) */
export function windowOf(selection: BaseDateSelection): DateWindow {
  return { from: shiftDate(selection.date, -(Math.max(1, selection.spanDays) - 1)), to: selection.date }
}

/** 창 안의 날짜 전부 — 오래된 날부터. 일자별 추이 차트의 x축이 된다 */
export function datesInWindow(window: DateWindow): string[] {
  const span = daysBetween(window.from, window.to)
  if (span < 0) return []
  return Array.from({ length: span + 1 }, (_, i) => shiftDate(window.from, i))
}

/** 창 안에 드는 날짜인가 (양끝 포함). 날짜가 없으면 창 밖으로 보지 않는다 */
export function isWithin(window: DateWindow, date: string | null | undefined): boolean {
  if (!date) return true
  return date >= window.from && date <= window.to
}

/* ── 되감기 (과거 기준일을 값으로 옮기는 두 함수) ────────────────
 *
 * 더미의 절점·진척에는 **개별 통과 일자가 없다**(원천에 없다). 그래서 과거 기준일을
 * 표현할 방법은 하나뿐이다 — "그날엔 여기까지였다". 통합실적이 먼저 쓰던 규칙을
 * 여기로 올려 조립·의장이 **같은 함수**를 쓰게 한다. 한쪽만 되감으면 "가공 0% 인데
 * 조립 완료" 같은, 어느 날에도 있을 수 없는 화면이 나온다.
 */

/** 기준일이 오늘로부터 며칠 전인가. 오늘·미래면 0 (미래 조회는 화면이 이미 막는다) */
export function rewindDaysOf(baseDate: string, today: string = todayString()): number {
  return Math.max(0, daysBetween(baseDate, today))
}

/** 오늘 수위 → 기준일 수위. `daysPerStep` 은 한 단계를 지나는 데 걸리는 날 */
export function rewoundLevel(levelToday: number, daysBack: number, daysPerStep: number): number {
  if (daysBack <= 0) return levelToday
  return Math.max(0, levelToday - Math.floor(daysBack / Math.max(1, daysPerStep)))
}

/**
 * 기준일이 뜻하는 **순간**(epoch ms) — 설비 상태처럼 '지금'을 필요로 하는 축이 쓴다.
 *
 * 오늘이면 진짜 지금이고(지금까지와 완전히 같다), 과거면 **그날의 끝**이다. 과거 기준일
 * 에서 지금 시각을 그대로 쓰면 "3일 전 화면인데 하트비트가 방금"이라는 모순이 생긴다.
 */
export function instantOf(baseDate: string, now: number = nowMs()): number {
  const endOfDay = new Date(`${baseDate}T23:59:59.999`).getTime()
  if (Number.isNaN(endOfDay)) return now
  return Math.min(now, endOfDay)
}

/* ── URL 딥링크 (`?date=` · `?span=`) ──────────────────────────
 *
 * 호선·블록 딥링크(`?vessel=`·`?block=`)와 같은 문법이다 — 지금 보고 있는 조건을 그대로
 * 주소로 만들 수 있어야 한다. 값이 이상하면 **기본값으로 조용히 돌아간다**: 남이 보낸
 * 링크의 오타 때문에 화면이 서지 않는 편보다, 오늘로 열리는 편이 낫다.
 */

/** URL 파라미터 이름 — 화면과 테스트가 같은 문자열을 쓰게 한 곳에 둔다 */
export const DATE_PARAMS = { date: 'date', span: 'span' } as const

export function parseDateParams(
  params: URLSearchParams,
  today: string = todayString()
): BaseDateSelection {
  const raw = params.get(DATE_PARAMS.date)
  const rawSpan = Number(params.get(DATE_PARAMS.span))
  const span = Number.isFinite(rawSpan) && rawSpan >= 1 ? Math.round(rawSpan) : 1
  if (!isValidDateString(raw)) {
    /* 날짜 없이 창 길이만 온 링크 — '지난 7일' 을 뜻한다고 읽는다 */
    return span > 1 ? { date: today, spanDays: span, preset: 'last7' } : defaultSelection(today)
  }
  return selectionOfDate(raw, today, span)
}

/**
 * 선택 → URL 파라미터 조각. **기본값(오늘 하루)이면 아무것도 싣지 않는다** —
 * 아무것도 안 고른 상태의 주소에 `?date=오늘` 이 붙어 있으면 그 링크는 내일 거짓이 된다.
 */
export function dateParamsOf(
  selection: BaseDateSelection,
  today: string = todayString()
): Record<string, string> {
  if (selection.date === today && selection.spanDays === 1) return {}
  const out: Record<string, string> = {}
  if (selection.date !== today) out[DATE_PARAMS.date] = selection.date
  if (selection.spanDays > 1) out[DATE_PARAMS.span] = String(selection.spanDays)
  return out
}
