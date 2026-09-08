import type { StatusMeaning } from '../../../ui/statusPalette'
import type { EquipmentCell, EquipmentGridFilter } from '../model/cell'

/*
 * 셀 정렬·필터 — 순수 계산.
 *
 * 그리드로 가면 **상태순 정렬이 필수**가 된다(레퍼런스 §3.6-1, LibreNMS `sort_status`).
 * 337칸에서 붉은 칸 하나를 눈으로 찾게 두면 2차원으로 훑는 이득이 사라진다.
 */

/** 나쁜 것이 앞 — 이상 → 주의 → 진행중 → 정상 → 대기 */
const SEVERITY_ORDER: Record<StatusMeaning, number> = {
  error: 0,
  warning: 1,
  inProgress: 2,
  done: 3,
  idle: 4,
}

export function severityRank(meaning: StatusMeaning): number {
  return SEVERITY_ORDER[meaning]
}

/** 손봐야 하는 셀인가 — '이상만 보기' 와 미니 트렌드 표시의 기준 */
export function isIssueCell(cell: EquipmentCell): boolean {
  return cell.severity === 'error' || cell.severity === 'warning'
}

/**
 * 이상이 위로, 같은 등급 안에서는 **원래 순서**(대개 설비ID 순)를 지킨다.
 *
 * 안정 정렬이라 정상 칸들의 자리가 갱신마다 흔들리지 않는다 — 6초마다 재배열되는
 * 그리드는 읽을 수 없다.
 */
export function sortCellsByStatus(cells: readonly EquipmentCell[]): EquipmentCell[] {
  return cells
    .map((cell, index) => ({ cell, index }))
    .sort(
      (a, b) =>
        severityRank(a.cell.severity) - severityRank(b.cell.severity) || a.index - b.index
    )
    .map((entry) => entry.cell)
}

/** 필터 적용 — '이상만 보기' 는 error·warning 만 남긴다 */
export function filterCells(
  cells: readonly EquipmentCell[],
  filter: EquipmentGridFilter
): EquipmentCell[] {
  return filter === 'issues' ? cells.filter(isIssueCell) : [...cells]
}

/** 화면에 세울 최종 목록 — 필터 후 상태순 */
export function arrangeCells(
  cells: readonly EquipmentCell[],
  filter: EquipmentGridFilter = 'all'
): EquipmentCell[] {
  return sortCellsByStatus(filterCells(cells, filter))
}

/** 요약 스트립이 쓰는 집계 — **본문과 같은 배열에서** 센다(둘이 어긋나지 않도록) */
export interface EquipmentGridCounts {
  total: number
  issues: number
  normal: number
}

export function countCells(cells: readonly EquipmentCell[]): EquipmentGridCounts {
  const issues = cells.filter(isIssueCell).length
  return { total: cells.length, issues, normal: cells.length - issues }
}
