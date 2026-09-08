/*
 * 설비 그리드 — 조립·의장·도장이 **같은 셀 문법**으로 설비를 세우는 공용 본문.
 * 요약 스트립·구획은 각 화면이 그대로 들고, 그 안쪽 본문만 이 그리드로 바꾼다(하이브리드).
 * 근거: `.work/설비관제_레퍼런스.md` §3.
 */
export { EquipmentGrid, worstMeaning, type EquipmentGridProps } from './ui/EquipmentGrid'
export {
  arrangeCells,
  countCells,
  filterCells,
  isIssueCell,
  severityRank,
  sortCellsByStatus,
  type EquipmentGridCounts,
} from './lib/sortCells'
export type {
  EquipmentCell,
  EquipmentGridDensity,
  EquipmentGridFilter,
  EquipmentLamp,
} from './model/cell'
