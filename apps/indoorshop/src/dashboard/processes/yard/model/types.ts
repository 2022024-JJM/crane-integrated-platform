/**
 * BTS(블록운반시스템) 야드 도메인.
 *
 * 좌표·기하 타입과 렌더 대상 도메인 타입(지번·블록·이동·계획)은 이제
 * `shared/features/yard-map` 이 소유한다 — 지도가 그 타입들을 렌더 계약으로 쓰기
 * 때문이다. 여기서는 그것들을 다시 내보내(re-export) 야드 모듈 안의 기존 참조를
 * 그대로 두고, **야드 목록 화면 전용 표시 함수**(시각·날짜 포맷)만 덧붙인다.
 */
export type {
  LatLon,
  LatLonBounds,
  YardLot,
  YardBlock,
  YardMove,
  YardPlan,
} from '../../../shared/features/yard-map/model/types'
export {
  boundsOf,
  mergeBounds,
  quadContains,
  parseTransportObjectId,
} from '../../../shared/features/yard-map/model/types'

/** `YYYYMMDD` + `HHMMSS` → `MM-DD HH:MM` (초는 목록에서 읽히지 않는다) */
export function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null
  if (value.length < 12) return `${value.slice(4, 6)}-${value.slice(6, 8)}`
  return `${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
}

/**
 * `HHMM` → `HH:MM`. 야드 시각은 24시를 넘겨 적는다 — `2630` 은 다음 날 새벽 2시 30분이며,
 * 이것을 `02:30` 으로 고쳐 쓰면 **어느 날 작업인지가 사라진다**. 그래서 그대로 둔다.
 */
export function formatYardTime(value: string | null): string | null {
  if (!value) return null
  const padded = value.padStart(4, '0')
  return `${padded.slice(0, padded.length - 2)}:${padded.slice(-2)}`
}

/** `YYYYMMDD` → `YYYY-MM-DD` */
export function formatYardDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}
