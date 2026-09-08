import { describe, expect, it } from 'vitest'
import type { StatusMeaning } from '../../../ui/statusPalette'
import { arrangeCells, countCells, filterCells, isIssueCell, severityRank, sortCellsByStatus } from '../lib/sortCells'
import type { EquipmentCell } from '../model/cell'

/**
 * 그리드로 가면 **상태순 정렬이 필수**가 된다(설비관제 레퍼런스 §3.6-1).
 * 337칸에서 붉은 칸 하나를 눈으로 찾게 두면 2차원으로 훑는 이득이 사라진다.
 */
const cell = (id: string, severity: StatusMeaning): EquipmentCell => ({
  id,
  typeId: 'LIDAR',
  label: id,
  lamps: [{ label: '링크', meaning: severity }],
  metric: { text: '방금', meaning: severity },
  severity,
})

describe('셀 정렬 — 이상이 위로', () => {
  it('이상 → 주의 → 진행중 → 정상 → 대기 순으로 선다', () => {
    const cells = [
      cell('a', 'idle'),
      cell('b', 'done'),
      cell('c', 'error'),
      cell('d', 'inProgress'),
      cell('e', 'warning'),
    ]
    expect(sortCellsByStatus(cells).map((c) => c.id)).toEqual(['c', 'e', 'd', 'b', 'a'])
  })

  it('같은 등급 안에서는 원래 순서를 지킨다 — 갱신마다 자리가 흔들리면 읽을 수 없다', () => {
    const cells = [cell('z', 'done'), cell('y', 'done'), cell('x', 'done')]
    expect(sortCellsByStatus(cells).map((c) => c.id)).toEqual(['z', 'y', 'x'])
  })

  it('정렬은 원본을 건드리지 않는다', () => {
    const cells = [cell('a', 'done'), cell('b', 'error')]
    sortCellsByStatus(cells)
    expect(cells.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('등급 순위가 뒤집히지 않는다', () => {
    expect(severityRank('error')).toBeLessThan(severityRank('warning'))
    expect(severityRank('warning')).toBeLessThan(severityRank('done'))
    expect(severityRank('done')).toBeLessThan(severityRank('idle'))
  })
})

describe("'이상만 보기' 필터", () => {
  it('이상·주의만 남긴다', () => {
    const cells = [cell('a', 'done'), cell('b', 'error'), cell('c', 'warning'), cell('d', 'idle')]
    expect(filterCells(cells, 'issues').map((c) => c.id)).toEqual(['b', 'c'])
    expect(filterCells(cells, 'all')).toHaveLength(4)
  })

  it('이상 판정은 정렬·감쇄·트렌드가 같은 기준을 쓴다', () => {
    expect(isIssueCell(cell('a', 'error'))).toBe(true)
    expect(isIssueCell(cell('a', 'warning'))).toBe(true)
    expect(isIssueCell(cell('a', 'inProgress'))).toBe(false)
    expect(isIssueCell(cell('a', 'done'))).toBe(false)
  })

  it('필터와 정렬을 함께 — 이상만, 그중에서도 error 가 먼저', () => {
    const cells = [cell('a', 'warning'), cell('b', 'done'), cell('c', 'error')]
    expect(arrangeCells(cells, 'issues').map((c) => c.id)).toEqual(['c', 'a'])
  })
})

describe('요약 = 본문 합계', () => {
  it('요약 집계가 본문과 같은 배열에서 나온다 — 둘이 어긋날 자리를 만들지 않는다', () => {
    const cells = [cell('a', 'done'), cell('b', 'error'), cell('c', 'warning'), cell('d', 'idle')]
    const counts = countCells(cells)
    expect(counts).toEqual({ total: 4, issues: 2, normal: 2 })
    expect(counts.issues + counts.normal).toBe(counts.total)
    expect(counts.issues).toBe(filterCells(cells, 'issues').length)
    expect(counts.total).toBe(arrangeCells(cells, 'all').length)
  })
})
