import type { InshopKey } from '../../../lib/i18n/keys'
import { STATUS_STYLE, type StatusMeaning } from '../../../ui/statusPalette'
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
 * 정반 상태의 단일 표현 — 라벨·색·모양을 한 곳에서만 정한다.
 * 탭·공장 카드·야드 범례가 같은 상태를 다르게 부르거나 다르게 칠하지 않도록.
 *
 * 색은 여기서 고르지 않고 **의미**(`meaning`)만 고른다 — 실제 색은 상태 팔레트가 준다.
 * 재실(블록이 올라와 작업이 도는 중)은 `inProgress` 다. 예전에는 초록이라 통합실적의
 * 완료(초록)와 같은 색이었고, 그래서 "일이 도는 중"과 "다 됐다"가 화면을 건너면서
 * 뒤집혔다(감사 F-6). 미확인은 센서가 봐야 하는데 못 본 것이라 주의(앰버)로 남기고,
 * 공석은 뜻이 없는 상태라 중립이다 — 회색 둘(미확인·공석)이 겹치지 않도록.
 */
export const LOCATION_STATUS_META: Record<
  LocationStatus,
  { labelKey: InshopKey; meaning: StatusMeaning; dot: string; ink: string }
> = {
  occupied: {
    labelKey: 'location.status.occupied',
    meaning: 'inProgress',
    dot: STATUS_STYLE.inProgress.fill,
    ink: STATUS_STYLE.inProgress.ink,
  },
  empty: {
    labelKey: 'location.status.empty',
    meaning: 'idle',
    dot: STATUS_STYLE.idle.fill,
    ink: STATUS_STYLE.idle.ink,
  },
  unknown: {
    labelKey: 'location.status.unknown',
    meaning: 'warning',
    dot: STATUS_STYLE.warning.fill,
    ink: STATUS_STYLE.warning.ink,
  },
}
