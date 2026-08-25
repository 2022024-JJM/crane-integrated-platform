import type { InshopKey } from '../../../lib/i18n/keys'
export type LocationStatus = 'occupied' | 'empty' | 'unknown'

/**
 * 베이(정반 단위 작업 위치).
 *  - workCntr: 정반코드 (WORK_CNTR)
 *  - projNo/blkNo: 이 정반에 배정된 공사(호선)/블록 — 공석이면 없음
 *  - yardLots: 이 정반이 야드에서 차지하는 지번 코드 (BTS 의 LOT)
 */
export interface Location {
  id: string
  factoryId: string
  name: string
  status: LocationStatus
  workCntr: string
  projNo?: string
  blkNo?: string
  /**
   * 야드 지번 (SDE.GIF_LOTSMALL 의 LOT) — 정반 하나가 지번 여러 구획에 걸친다.
   *
   * 이것이 야드 맵과 조립 화면을 잇는 **유일한 연결 키**다. 실제로는 정반 마스터가
   * 들고 있어야 하는 값이지만 WORK_CNTR ↔ LOT 마스터가 아직 없어서, mock 단계에서는
   * `mockAssemblyData` 가 직접 채운다 (자세한 근거는 그쪽 주석 참조).
   */
  yardLots?: string[]
}

/**
 * 정반 상태의 단일 표현 — 라벨·점 색을 한 곳에서만 정한다.
 * 탭·공장 카드 등 여러 화면이 같은 상태를 다르게 부르지 않도록.
 */
export const LOCATION_STATUS_META: Record<
  LocationStatus,
  { labelKey: InshopKey; dot: string; ink: string }
> = {
  occupied: {
    labelKey: 'location.status.occupied',
    dot: 'bg-status-healthy',
    ink: 'text-status-healthy',
  },
  empty: { labelKey: 'location.status.empty', dot: 'bg-foreground/25', ink: 'text-foreground/54' },
  unknown: {
    labelKey: 'location.status.unknown',
    dot: 'bg-status-degraded',
    ink: 'text-status-degraded',
  },
}
