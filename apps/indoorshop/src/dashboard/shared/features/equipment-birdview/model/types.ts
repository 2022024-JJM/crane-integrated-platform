import type { LatLon } from '../../../entities/yard-parcels'
import type { StatusMeaning } from '../../../ui/statusPalette'

/*
 * 버드뷰의 입력 계약 — **공정을 모른다.**
 *
 * 어떤 설비가 어떤 모양인지(종류)와 지금 어떤가(상태)만 받는다. 라이다-틸팅 페어가 한 점인
 * 것도 공정이 정해서 넘긴다(그리드의 셀과 같은 단위라야 두 층이 같은 것을 가리킨다).
 */

/** 버드뷰에 찍는 설비 한 점 */
export interface BirdviewPoint {
  /** 그리드 셀과 **같은 id** — 두 층의 링킹이 이 값 하나로 이어진다 */
  id: string
  /** 종류ID (`LIDAR`·`EDGE`·`PNL`·`DH`·`GH`) — 모양의 근거 */
  typeId: string
  position: LatLon
  /** 상태 — 색의 근거 */
  severity: StatusMeaning
  /** 툴팁 줄 — 화면이 번역해 넣는다(이 층은 t() 를 모른다) */
  tooltip: { title: string; status: string; freshness: string }
  /** 속한 베이 — 베이 클릭 링킹의 키 */
  bay?: string
}

/** 베이 외곽 하나 */
export interface BirdviewBay {
  /** `{공장}#{베이}` — 전역 유일 */
  id: string
  /** 베이 이름 (라벨) */
  label: string
  /** 그리드 구획 키 — 베이 클릭이 그리로 점프한다 */
  groupKey: string
  hull: readonly LatLon[]
}
