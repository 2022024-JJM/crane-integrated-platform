import type { OccupantGroup } from './occupantProgress'

/** 작업 목록 묶음의 표식 색 — 묶음·순서는 `occupantGroupOf`·`OCCUPANT_GROUP_ORDER` 가 정한다 */
export const GROUP_DOT: Record<OccupantGroup, string> = {
  notStarted: 'bg-white/45',
  inProgress: 'bg-status-healthy',
  done: 'bg-sky-400',
}
export const GROUP_TEXT: Record<OccupantGroup, string> = {
  notStarted: 'text-white/70',
  inProgress: 'text-status-healthy',
  done: 'text-sky-300',
}
