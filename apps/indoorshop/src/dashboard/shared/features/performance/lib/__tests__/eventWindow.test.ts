import { describe, expect, it } from 'vitest'
import type { CollectionEvent } from '../../model/types'
import { clampEventToWindow, clampEventsToWindow, eventDateOf } from '../eventWindow'

/**
 * 조회 창의 계약 (W7-2) — **기준일 이후는 보이지 않는다.**
 *
 * 이 규칙이 깨지면 과거 기준일 조회가 "그날의 화면"이 아니라 "오늘의 화면에 과거 날짜만
 * 적어 둔 것"이 된다. 값이 아니라 그 성질을 잠근다.
 */
const WINDOW = { from: '2026-08-28', to: '2026-09-03' }

function event(over: Partial<CollectionEvent> = {}): CollectionEvent {
  return {
    id: 'e1',
    blockNo: '222',
    stage: 'ASM',
    mgmtNoType: 'ASSY',
    mgmtNo: '7004-222-G01',
    occurred: { date: '2026-09-01' },
    completed: null,
    status: 'inProgress',
    sources: 'LiDAR 판별',
    flagged: false,
    ...over,
  }
}

describe('창 밖의 행은 서지 않는다', () => {
  it('기준일 이후에 일어난 행은 지운다 — 그날엔 아직 일어나지 않았다', () => {
    expect(clampEventToWindow(event({ occurred: { date: '2026-09-04' } }), WINDOW)).toBeNull()
  })

  it('창 시작보다 앞선 행은 지운다 — 창을 좁히면 그림도 좁아진다', () => {
    expect(clampEventToWindow(event({ occurred: { date: '2026-08-27' } }), WINDOW)).toBeNull()
  })

  it('창 양끝의 행은 남는다 (양끝 포함)', () => {
    for (const date of [WINDOW.from, WINDOW.to]) {
      expect(clampEventToWindow(event({ occurred: { date } }), WINDOW)).not.toBeNull()
    }
  })
})

describe('창 뒤에 끝나는 행은 그날 진행 중이었다', () => {
  it('완료가 창 뒤면 완료를 지우고 진행 중으로 되돌린다', () => {
    const clamped = clampEventToWindow(
      event({
        occurred: { date: '2026-09-02' },
        completed: { date: '2026-09-05' },
        status: 'done',
      }),
      WINDOW
    )
    expect(clamped).not.toBeNull()
    expect(clamped!.completed).toBeNull()
    expect(clamped!.status).toBe('inProgress')
  })

  it('행 자체는 지우지 않는다 — 그날 그 행은 실제로 있었다(착수한 채로)', () => {
    const clamped = clampEventToWindow(
      event({ occurred: { date: '2026-09-02' }, completed: { date: '2026-09-05' }, status: 'done' }),
      WINDOW
    )
    expect(clamped!.id).toBe('e1')
    expect(clamped!.occurred).toEqual({ date: '2026-09-02' })
  })

  it('창 안에서 끝난 행은 손대지 않는다', () => {
    const source = event({
      occurred: { date: '2026-09-01' },
      completed: { date: '2026-09-02' },
      status: 'done',
    })
    expect(clampEventToWindow(source, WINDOW)).toBe(source)
  })

  it('원본을 바꾸지 않는다 — 자른 사본을 낸다', () => {
    const source = event({
      occurred: { date: '2026-09-02' },
      completed: { date: '2026-09-05' },
      status: 'done',
    })
    clampEventToWindow(source, WINDOW)
    expect(source.completed).toEqual({ date: '2026-09-05' })
    expect(source.status).toBe('done')
  })
})

describe('날짜 없는 행(미도래)은 창이 거르지 않는다', () => {
  it('발생·완료가 모두 없으면 어느 창에서도 남는다 — "아직"은 언제 봐도 참이다', () => {
    const pending = event({ occurred: null, completed: null, status: 'notDue' })
    expect(clampEventToWindow(pending, WINDOW)).toBe(pending)
    expect(clampEventToWindow(pending, { from: '2020-01-01', to: '2020-01-01' })).toBe(pending)
  })
})

describe('목록 자르기', () => {
  it('순서를 바꾸지 않고 걸러 내기만 한다', () => {
    const rows = [
      event({ id: 'a', occurred: { date: '2026-08-29' } }),
      event({ id: 'future', occurred: { date: '2026-09-10' } }),
      event({ id: 'b', occurred: { date: '2026-09-01' } }),
      event({ id: 'old', occurred: { date: '2026-01-01' } }),
      event({ id: 'c', occurred: { date: '2026-09-03' } }),
    ]
    expect(clampEventsToWindow(rows, WINDOW).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('전부 창 밖이면 빈 목록', () => {
    expect(
      clampEventsToWindow([event({ occurred: { date: '2027-01-01' } })], WINDOW)
    ).toEqual([])
  })
})

describe('행이 일어난 날', () => {
  it('발생일이 정본이고, 없으면 완료일, 둘 다 없으면 null', () => {
    expect(eventDateOf(event({ occurred: { date: '2026-09-01' } }))).toBe('2026-09-01')
    expect(eventDateOf(event({ occurred: null, completed: { date: '2026-09-02' } }))).toBe(
      '2026-09-02'
    )
    expect(eventDateOf(event({ occurred: null, completed: null }))).toBeNull()
  })
})
