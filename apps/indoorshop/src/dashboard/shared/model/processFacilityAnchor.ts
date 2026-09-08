import type { LatLon, LatLonBounds } from '../features/yard-map/model/types'

/**
 * 공정존 → 지도상의 대표 시설·좌표 매핑 — **타입 계약**.
 *
 * 대시보드가 야드 지도 위에 공정존 상태(가동·정지·건전성)를 오버레이 배지로 얹으려면
 * "이 공정이 지도 어디에 서는가"를 알아야 한다. 그 자리를 여기 계약으로 정의한다.
 *
 * `shared` 는 어떤 공정이 존재하는지 모른다 — 값을 채우는 것은 야드 모듈이며
 * (야드가 41개 시설의 공정 귀속·좌표를 안다), 대시보드는 레지스트리
 * (`fetchProcessFacilityAnchors`)를 통해 이 계약 타입으로만 읽는다. 공정 화면 경로
 * (`zonePath`)를 키로 삼아 공정존 카드(`Zone`)·상태와 잇는다.
 *
 * 좌표 타입은 야드 지도(`shared/features/yard-map`)의 프레젠테이션 계약을 재사용한다 —
 * 같은 WGS84 위경도라 지도가 그대로 배치할 수 있다.
 */

/** 한 공정에 속한 개별 시설의 지도 좌표 — 오버레이가 시설 단위로 그릴 때 쓴다 */
export interface ProcessFacilityRef {
  /** 시설(공장·샵) 이름 — 야드 기준정보의 식별자 */
  name: string
  /** 라벨/배지를 놓을 자리 (본체 무게중심) */
  anchor: LatLon
  /** 본체 외곽 경계 상자 */
  bounds: LatLonBounds
  /** 본체 구획 수 (규모의 대용값) */
  sections: number
  /** 관할 지번 수 */
  lotCount: number
}

/** 공정존 하나가 지도에서 서는 자리 */
export interface ProcessFacilityAnchor {
  /** 공정 화면 경로 (예: `/indoorshop/zones/assembly`) — 대시보드가 존·상태와 잇는 키 */
  zonePath: string
  /** 공정 식별자 (assembly/painting/outfitting/fabrication) */
  processKey: string
  /** 공정 이름 (조립·도장…) — BTS 가 부르는 그대로 */
  label: string
  /** 대표 배지를 놓을 자리 — 대표 시설의 무게중심 */
  anchor: LatLon
  /** 대표 시설 이름 — 대표 좌표의 근거 */
  representativeName: string
  /** 이 공정 전체 시설을 감싸는 경계 상자 — 지도가 이 공정으로 줌인할 때 쓴다 */
  bounds: LatLonBounds
  /** 이 공정에 속한 시설 전부 */
  facilities: ProcessFacilityRef[]
}
