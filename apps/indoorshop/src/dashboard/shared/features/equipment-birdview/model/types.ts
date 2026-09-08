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
  /** 태그 머리 세 줄 — 화면이 번역해 넣는다(이 층은 t() 를 모른다) */
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

/**
 * 태그(선택·호버 카드)에 실리는 **관제 정보** (R36).
 *
 * 태그가 ID 한 줄뿐이면 "저게 뭐냐"에는 답하지만 "지금 어떤가"에는 답하지 못해, 결국
 * 아래 그리드를 다시 찾아 눈으로 훑게 된다 — 그러면 그림을 누른 뜻이 없다.
 *
 * ⚠️ 이 값들은 **그리드 셀에서 그대로 온다.** 여기서 상태를 다시 계산하면 같은 설비가
 * 두 층에서 다른 말을 하게 되고(연계 매트릭스가 잡아낸 그 병), 그 어긋남은 화면을
 * 믿을 수 없게 만든다. 그래서 이 타입은 셀의 부분집합이고, 채우는 쪽은 셀을 쥔 층이다.
 */
export interface BirdviewCardLamp {
  /** 무엇을 말하는 램프인가 (`전원`·`링크`·`틸팅`) */
  label: string
  meaning: StatusMeaning
  /** 값 한 마디 (`online`·`틸팅중`) — 없으면 라벨만 선다 */
  value?: string
}

export interface BirdviewCard {
  /** 소재 — 공장·베이 한 줄 */
  place?: string
  /** 램프 — 셀의 램프 그대로 (색 단독 금지: 모양이 함께 선다) */
  lamps?: readonly BirdviewCardLamp[]
  /** 종류별 핵심 특성값 한 줄 (라이다 각도·엣지PC 온도·판넬 소속 등) — 셀의 `note` */
  note?: string
  /** 최근 신호 — 셀의 핵심 수치 그대로 */
  metric?: { text: string; meaning: StatusMeaning }
}
