import { describe, expect, it } from 'vitest'
import { byThenKey, freezeOrder } from '../stableOrder'

/*
 * 실시간 갱신 아래의 자리 안정 (링크 스모크 ⑧) — 여기가 깨지면 누르려던 줄이
 * 폴링 틱마다 손 밑에서 빠져나간다.
 */
interface Row {
  id: string
  status: 'error' | 'ok'
}
const rank = { error: 0, ok: 1 } as const
const byStatus = (a: Row, b: Row) => rank[a.status] - rank[b.status]

describe('byThenKey — 동률의 자리 고정', () => {
  it('같은 상태끼리는 언제나 같은 순서 — 입력 순서가 흔들려도', () => {
    const compare = byThenKey(byStatus, (row: Row) => row.id)
    const a: Row[] = [
      { id: 'B', status: 'ok' },
      { id: 'A', status: 'ok' },
      { id: 'C', status: 'error' },
    ]
    const b = [a[1], a[2], a[0]]
    expect([...a].sort(compare).map((r) => r.id)).toEqual(['C', 'A', 'B'])
    expect([...b].sort(compare).map((r) => r.id)).toEqual(['C', 'A', 'B'])
  })

  it('상태 순서가 먼저다 — 동률 해소가 본 정렬을 뒤엎지 않는다', () => {
    const compare = byThenKey(byStatus, (row: Row) => row.id)
    const rows: Row[] = [
      { id: 'A', status: 'ok' },
      { id: 'Z', status: 'error' },
    ]
    expect([...rows].sort(compare).map((r) => r.id)).toEqual(['Z', 'A'])
  })

  it('ID 는 숫자 감각으로 견준다 — LD-9 가 LD-10 뒤로 가지 않는다', () => {
    const compare = byThenKey(byStatus, (row: Row) => row.id)
    const rows: Row[] = [
      { id: 'LD-10', status: 'ok' },
      { id: 'LD-9', status: 'ok' },
    ]
    expect([...rows].sort(compare).map((r) => r.id)).toEqual(['LD-9', 'LD-10'])
  })
})

describe('freezeOrder — 자리는 그대로, 값만 새로', () => {
  const keyOf = (row: Row) => row.id

  it('이전 순서를 지킨다 — 상태가 뒤집혀도 행이 움직이지 않는다', () => {
    const previous = ['A', 'B', 'C']
    const next: Row[] = [
      { id: 'C', status: 'error' },
      { id: 'B', status: 'ok' },
      { id: 'A', status: 'ok' },
    ]
    expect(freezeOrder(previous, next, keyOf).map(keyOf)).toEqual(['A', 'B', 'C'])
  })

  it('값은 새것이다 — 얼린 것은 순서뿐', () => {
    const frozen = freezeOrder(['A'], [{ id: 'A', status: 'error' }], keyOf)
    expect(frozen[0].status).toBe('error')
  })

  it('사라진 행은 빠진다', () => {
    expect(
      freezeOrder(['A', 'B'], [{ id: 'B', status: 'ok' }], keyOf).map(keyOf)
    ).toEqual(['B'])
  })

  it('새 행은 **뒤에** 붙는다 — 위로 끼워 넣는 것도 표적을 미는 일이다', () => {
    const next: Row[] = [
      { id: 'NEW', status: 'error' },
      { id: 'A', status: 'ok' },
    ]
    expect(freezeOrder(['A'], next, keyOf).map(keyOf)).toEqual(['A', 'NEW'])
  })

  it('이전 순서가 비었으면 준 순서 그대로', () => {
    const next: Row[] = [{ id: 'B', status: 'ok' }, { id: 'A', status: 'ok' }]
    expect(freezeOrder([], next, keyOf).map(keyOf)).toEqual(['B', 'A'])
  })
})
