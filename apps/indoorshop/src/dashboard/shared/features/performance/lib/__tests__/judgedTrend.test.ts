import { describe, expect, it } from 'vitest'
import type { CollectionEvent } from '../../model/types'
import { isJudgedEvent, judgedTotalOf, judgedTrendOf } from '../judgedTrend'

/**
 * 조립 일자별 인식 추이의 계약 (W7-2).
 *
 * 이 그림이 답하려는 질문은 하나다 — "수집이 어느 날 멈췄나". 그래서 검사도 그 질문을
 * 지키는 성질에 건다: **빈 날이 빈 날로 보일 것**, 그리고 **세는 것이 판별뿐일 것**.
 */
const WINDOW = { from: '2026-09-01', to: '2026-09-03' }

function event(over: Partial<CollectionEvent> = {}): CollectionEvent {
  return {
    id: 'e',
    blockNo: '222',
    stage: 'ASM',
    kind: 'asmJudged',
    mgmtNoType: 'ASSY',
    mgmtNo: '7004-222-G01',
    occurred: { date: '2026-09-02' },
    completed: null,
    status: 'inProgress',
    sources: 'LiDAR 판별',
    flagged: false,
    ...over,
  }
}

describe('세는 것은 판별뿐이다', () => {
  it('조립 판별 행만 센다', () => {
    expect(isJudgedEvent(event())).toBe(true)
  })

  it('W/O 착수·완료는 세지 않는다 — 레거시가 적은 날이지 우리가 수집한 날이 아니다', () => {
    expect(isJudgedEvent(event({ kind: 'woDone', id: 'w' }))).toBe(false)
    expect(isJudgedEvent(event({ kind: 'woStart', id: 'w' }))).toBe(false)
  })

  it('BTS 반입·반출도, 가공·도장 행도 세지 않는다', () => {
    expect(isJudgedEvent(event({ kind: 'btsIn' }))).toBe(false)
    expect(isJudgedEvent(event({ stage: 'S3', kind: undefined }))).toBe(false)
    expect(isJudgedEvent(event({ stage: 'PNT', kind: 'stepStart' }))).toBe(false)
  })

  it('추이에도 판별만 들어간다', () => {
    const trend = judgedTrendOf(
      [
        event({ id: 'j1' }),
        event({ id: 'w1', kind: 'woDone' }),
        event({ id: 'b1', kind: 'btsIn' }),
      ],
      WINDOW
    )
    expect(judgedTotalOf(trend)).toBe(1)
  })
})

describe('창의 모든 날이 선다 — 빈 날이 곧 신호다', () => {
  it('수집이 없는 날도 0 으로 자리를 지킨다', () => {
    const trend = judgedTrendOf([event({ occurred: { date: '2026-09-03' } })], WINDOW)
    expect(trend).toEqual([
      { date: '2026-09-01', count: 0 },
      { date: '2026-09-02', count: 0 },
      { date: '2026-09-03', count: 1 },
    ])
  })

  it('이벤트가 하나도 없어도 창의 날 수만큼 0 이 나온다', () => {
    expect(judgedTrendOf([], WINDOW).map((d) => d.count)).toEqual([0, 0, 0])
  })

  it('날짜는 오래된 날부터다 — x축이 뒤집히지 않는다', () => {
    const dates = judgedTrendOf([], WINDOW).map((d) => d.date)
    expect([...dates].sort()).toEqual(dates)
  })
})

describe('창 밖은 세지 않는다', () => {
  it('창 뒤(기준일 이후)의 판별은 합계에 들지 않는다', () => {
    const trend = judgedTrendOf([event({ occurred: { date: '2026-09-09' } })], WINDOW)
    expect(judgedTotalOf(trend)).toBe(0)
  })

  it('창 앞의 판별도 들지 않는다', () => {
    const trend = judgedTrendOf([event({ occurred: { date: '2026-08-01' } })], WINDOW)
    expect(judgedTotalOf(trend)).toBe(0)
  })

  it('날짜 없는 판별 행은 어느 날에도 얹지 않는다 — 없는 날에 세울 수 없다', () => {
    const trend = judgedTrendOf([event({ occurred: null, completed: null })], WINDOW)
    expect(judgedTotalOf(trend)).toBe(0)
  })
})

describe('같은 날의 여러 건', () => {
  it('한 날에 쌓인 건수가 그대로 합쳐진다', () => {
    const trend = judgedTrendOf(
      [
        event({ id: 'a', occurred: { date: '2026-09-02' } }),
        event({ id: 'b', occurred: { date: '2026-09-02' } }),
        event({ id: 'c', occurred: { date: '2026-09-02' } }),
      ],
      WINDOW
    )
    expect(trend.find((d) => d.date === '2026-09-02')!.count).toBe(3)
    expect(judgedTotalOf(trend)).toBe(3)
  })
})
