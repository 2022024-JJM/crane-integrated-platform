import type { LatLon, LatLonBounds } from './types'
import type { MapTheme } from '../lib/basemapStyle'

/**
 * 공장·샵 내비게이션 도메인 — "야드의 어느 공장이 어느 공정 소속인가"의 **타입 계약**.
 *
 * 지번(`YardLot`)이 야드를 용도로 가른다면, 이쪽은 **공정**으로 가른다. 지도는 시설이
 * 어느 공정인지·무슨 색인지를 여기 정의된 `FacilityProcess` 로 **데이터에 실려** 받는다 —
 * 어떤 공정이 존재하는지(조립·도장…)나 그 공정의 화면 경로(`/zones/...`)는 알지 않는다.
 * 실제 공정 목록·경로는 야드 모듈이 채워 넣는다.
 */

/** 이 배율(px/도) 아래에서는 작은 공장(구획 8 미만)의 라벨을 접는다 — 이름끼리 겹쳐 못 읽는다 */
export const FACILITY_LABEL_MIN_SCALE = 45_000
export const FACILITY_SMALL_SECTIONS = 8

export type FacilityProcessKey =
  | 'assembly'
  | 'painting'
  | 'outfitting'
  | 'fabrication'
  | 'pretreatment'
  | 'unassigned'

export interface FacilityProcess {
  key: FacilityProcessKey
  /** BTS 가 부르는 이름 그대로 (조립·도장…) */
  label: string
  /**
   * 이 공정의 화면 경로 — **없는 공정도 있다.** 전처리는 아직 전용 화면이 없고,
   * 미지정은 공정 귀속 자체가 판단되지 않은 샵이다(배관제작·중장비정비 등).
   * 경로가 없는 샵은 눌러도 이동하지 않고 정보 카드만 띄운다.
   */
  zonePath: string | null
  /**
   * 공정색 — 어두운 지도에서는 네온(발광)이라 명도를 올렸고, 밝은 지도에서는
   * 레퍼런스 뷰어의 배색을 그대로 쓴다 (발광 없이 채도로 선다).
   */
  color: Record<MapTheme, string>
}

export interface YardFacility {
  /** 이름이 곧 식별자다 — BTS 기준정보에 샵 코드가 따로 없다 */
  name: string
  process: FacilityProcess
  /** 본체 구획 수 (옥내 BAY·라인만 — 셀터·적치장·검사장 제외) */
  sections: number
  /** 관할 지번 수 (셀터·적치장까지 포함한 전체) */
  lotCount: number
  /** BAY 목록 — 연속 구간을 접은 표기 (`1–8`). 없는 샵은 빈 문자열 */
  bays: string
  /** 라벨을 놓을 자리 (본체 무게중심) */
  anchor: LatLon
  /** 본체 외곽 — 볼록 껍질, 닫는 점 없음 */
  hull: LatLon[]
  bounds: LatLonBounds
}

/**
 * 외곽 안에 점이 있는가 — 짝홀(ray casting) 판정.
 * 공장 외곽은 꼭짓점이 5~10개라 지번의 볼록 사각형 판정(`quadContains`)을 못 쓴다.
 */
export function facilityContains(
  facility: YardFacility,
  latitude: number,
  longitude: number
): boolean {
  const { hull } = facility
  let inside = false
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const a = hull[i]
    const b = hull[j]
    if (
      a.lat > latitude !== b.lat > latitude &&
      longitude < ((b.lon - a.lon) * (latitude - a.lat)) / (b.lat - a.lat) + a.lon
    ) {
      inside = !inside
    }
  }
  return inside
}
