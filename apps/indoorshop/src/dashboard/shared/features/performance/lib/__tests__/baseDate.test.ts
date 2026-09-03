import { describe, expect, it } from 'vitest'
import {
  DATE_PARAMS,
  dateParamsOf,
  datesInWindow,
  daysBetween,
  defaultSelection,
  isValidDateString,
  isWithin,
  parseDateParams,
  selectionOfDate,
  selectionOfPreset,
  shiftDate,
  todayString,
  windowOf,
} from '../baseDate'

/**
 * 통합실적 시간축의 계약 (W7-2).
 *
 * 이 모델이 지켜야 하는 것은 규칙 셋뿐이고, 그 셋이 깨지면 화면이 **없는 실적을 보여
 * 준다.** 그래서 날짜 산수보다 그 셋을 먼저 잠근다: 미래 없음 · 기본은 오늘 하루 ·
 * 창의 끝은 언제나 기준일.
 *
 * 오늘을 주입해 검사한다 — 시계에 묶인 테스트는 자정 언저리에만 깨져서 아무도 재현하지
 * 못한다.
 */
const TODAY = '2026-09-03'

describe('날짜 산수 — 로컬 날짜만 다룬다', () => {
  it('오늘 문자열은 로컬 날짜다 (UTC 로 밀리지 않는다)', () => {
    /* 한국 시간 자정 직후 — toISOString() 을 썼다면 어제가 나오는 시각이다 */
    expect(todayString(new Date(2026, 8, 3, 0, 30))).toBe('2026-09-03')
    expect(todayString(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09')
  })

  it('날짜를 옮긴다 — 달·해 경계를 넘어서도', () => {
    expect(shiftDate('2026-09-03', -1)).toBe('2026-09-02')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('간격은 나중 − 먼저 — 같은 날은 0, 미래는 음수', () => {
    expect(daysBetween('2026-09-03', '2026-09-03')).toBe(0)
    expect(daysBetween('2026-08-27', '2026-09-03')).toBe(7)
    expect(daysBetween('2026-09-04', '2026-09-03')).toBe(-1)
  })

  it('형식만 맞고 없는 날짜는 거른다 — 2월 30일은 날짜가 아니다', () => {
    expect(isValidDateString('2026-09-03')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('20260903')).toBe(false)
    expect(isValidDateString(null)).toBe(false)
    expect(isValidDateString('')).toBe(false)
  })
})

describe('프리셋 — 자주 쓰는 세 자리', () => {
  it('오늘은 오늘 하루', () => {
    expect(selectionOfPreset('today', TODAY)).toEqual({
      date: TODAY,
      spanDays: 1,
      preset: 'today',
    })
  })

  it('어제는 어제 하루 — 기준일 자체가 옮겨진다(창만 넓히는 게 아니다)', () => {
    const selection = selectionOfPreset('yesterday', TODAY)
    expect(selection.date).toBe('2026-09-02')
    expect(selection.spanDays).toBe(1)
  })

  it('지난 7일은 기준일이 오늘이고 창이 7일이다', () => {
    const selection = selectionOfPreset('last7', TODAY)
    expect(selection.date).toBe(TODAY)
    expect(selection.spanDays).toBe(7)
    expect(windowOf(selection)).toEqual({ from: '2026-08-28', to: TODAY })
  })

  it('화면의 기본은 오늘 하루다', () => {
    expect(defaultSelection(TODAY)).toEqual(selectionOfPreset('today', TODAY))
  })
})

describe('미래는 없다 — 규칙 1', () => {
  it('내일을 고르면 오늘로 접힌다', () => {
    expect(selectionOfDate('2026-09-04', TODAY).date).toBe(TODAY)
    expect(selectionOfDate('2099-01-01', TODAY).date).toBe(TODAY)
  })

  it('말이 안 되는 값도 오늘로 접힌다 — 링크 오타로 화면이 서지 못하면 안 된다', () => {
    expect(selectionOfDate('어제', TODAY).date).toBe(TODAY)
    expect(selectionOfDate('', TODAY).date).toBe(TODAY)
  })

  it('창의 끝은 언제나 기준일이다 — 그 뒤는 아직 일어나지 않았다', () => {
    for (const span of [1, 7, 30]) {
      const selection = selectionOfDate('2026-08-20', TODAY, span)
      expect(windowOf(selection).to).toBe('2026-08-20')
    }
  })
})

describe('달력 선택 — 같은 상태를 두 이름으로 부르지 않는다', () => {
  it('달력으로 오늘을 고르면 프리셋도 오늘이 된다', () => {
    expect(selectionOfDate(TODAY, TODAY).preset).toBe('today')
  })

  it('달력으로 어제를 고르면 프리셋도 어제가 된다', () => {
    expect(selectionOfDate('2026-09-02', TODAY).preset).toBe('yesterday')
  })

  it('그 밖의 날은 custom — 어느 프리셋 버튼도 눌린 것으로 서지 않는다', () => {
    expect(selectionOfDate('2026-08-20', TODAY).preset).toBe('custom')
  })
})

describe('조회 창', () => {
  it('하루 창은 그 하루뿐이다', () => {
    expect(windowOf(defaultSelection(TODAY))).toEqual({ from: TODAY, to: TODAY })
    expect(datesInWindow({ from: TODAY, to: TODAY })).toEqual([TODAY])
  })

  it('창의 날짜는 오래된 날부터 빠짐없이 나온다 — 빈 날이 곧 신호다', () => {
    const dates = datesInWindow(windowOf(selectionOfPreset('last7', TODAY)))
    expect(dates).toHaveLength(7)
    expect(dates[0]).toBe('2026-08-28')
    expect(dates.at(-1)).toBe(TODAY)
    expect([...dates].sort()).toEqual(dates)
  })

  it('뒤집힌 창은 빈 배열 — 없는 날을 지어내지 않는다', () => {
    expect(datesInWindow({ from: TODAY, to: '2026-09-01' })).toEqual([])
  })

  it('창 판정은 양끝을 포함하고, 날짜 없는 것은 거르지 않는다', () => {
    const window = { from: '2026-08-28', to: TODAY }
    expect(isWithin(window, '2026-08-28')).toBe(true)
    expect(isWithin(window, TODAY)).toBe(true)
    expect(isWithin(window, '2026-08-27')).toBe(false)
    expect(isWithin(window, '2026-09-04')).toBe(false)
    expect(isWithin(window, null)).toBe(true)
  })
})

describe('URL 딥링크 — 호선·블록과 같은 문법', () => {
  it('`?date=` 로 들어온 하루를 그대로 연다', () => {
    const selection = parseDateParams(new URLSearchParams('date=2026-08-20'), TODAY)
    expect(selection.date).toBe('2026-08-20')
    expect(selection.spanDays).toBe(1)
  })

  it('`?span=` 만 오면 그 길이의 창으로 읽는다', () => {
    const selection = parseDateParams(new URLSearchParams('span=7'), TODAY)
    expect(selection.date).toBe(TODAY)
    expect(selection.spanDays).toBe(7)
  })

  it('미래·오타는 조용히 기본값으로 — 남이 보낸 링크로 화면이 서지 못하면 안 된다', () => {
    expect(parseDateParams(new URLSearchParams('date=2099-01-01'), TODAY).date).toBe(TODAY)
    expect(parseDateParams(new URLSearchParams('date=nope'), TODAY)).toEqual(
      defaultSelection(TODAY)
    )
    expect(parseDateParams(new URLSearchParams(''), TODAY)).toEqual(defaultSelection(TODAY))
  })

  it('기본값이면 파라미터를 싣지 않는다 — 오늘이 박힌 링크는 내일 거짓이 된다', () => {
    expect(dateParamsOf(defaultSelection(TODAY), TODAY)).toEqual({})
  })

  it('고른 조건은 파라미터로 나가고 다시 읽으면 같은 선택이 된다 (왕복)', () => {
    for (const selection of [
      selectionOfPreset('yesterday', TODAY),
      selectionOfPreset('last7', TODAY),
      selectionOfDate('2026-08-20', TODAY, 7),
    ]) {
      const params = new URLSearchParams(dateParamsOf(selection, TODAY))
      expect(parseDateParams(params, TODAY)).toEqual(selection)
    }
  })

  it('파라미터 이름은 한 곳에서만 정한다', () => {
    const params = new URLSearchParams(dateParamsOf(selectionOfPreset('last7', TODAY), TODAY))
    expect(params.get(DATE_PARAMS.span)).toBe('7')
  })
})
