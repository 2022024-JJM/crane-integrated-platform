import type { ReactNode } from 'react'
import type { StatusMeaning } from '../../../ui/statusPalette'

/*
 * 설비 그리드의 **셀 계약** — 세 공정이 같은 모양으로 말하기 위한 어휘.
 *
 * 근거: `.work/설비관제_레퍼런스.md` §3.2 (셀 구성 권고) · §3.6 (함께 가야 하는 것).
 * 압축 셀은 **세 요소**뿐이다 — 종류칩+ID / 램프 3 / 핵심 수치 1개(신선도).
 * scan rate·온도·RSSI 같은 값은 한 대를 열었을 때의 질문이라 상세로 내린다.
 *
 * 이 계약은 **공정을 모른다.** 라이다든 제습기든 "무엇이 켜져 있고 무엇이 이상인가"는
 * 같은 모양으로 답할 수 있다 — 각 공정이 자기 데이터를 이 셀로 옮기고, 그리드는 그린다.
 */

/** 램프 한 개 — 색이 아니라 **뜻**을 고른다(모양 부호는 팔레트가 정한다) */
export interface EquipmentLamp {
  /** 이 램프가 무엇을 말하는가 (`전원`·`링크`·`상태`…) — 접근성 이름의 재료 */
  label: string
  meaning: StatusMeaning
  /** 값 한 마디 (`온라인`·`틸팅중`) — 툴팁/보조기술용. 없으면 label 만 읽힌다 */
  value?: string
}

/**
 * 셀 하나 = **설비 한 몫**.
 *
 * ⚠️ 라이다와 틸팅은 **한 칸**이다. 물리적으로 1.7m 안에 한 자리로 서서 한 몫(그 정반을
 * 본다)을 하고, 두 칸으로 가르면 337 → 674칸이 되어 스케일 문제를 두 배로 만든다
 * (레퍼런스 §3.4). 페어의 상태는 둘째 램프가 말한다.
 */
export interface EquipmentCell {
  /** 셀 키 — 대표 설비의 ID */
  id: string
  /** 종류ID (`LIDAR`·`EDGE`·`PNL`·`DH`·`GH`) — 칩 심볼·색의 근거 */
  typeId: string
  /** 셀에 적는 이름 — 대개 설비ID 그대로 */
  label: string
  /** 묶음 이름 (베이·구역) — 정렬·필터의 보조 키 */
  group?: string
  /**
   * 램프 3개 — 권고안의 [링크 / 페어(틸팅) / 이상] 자리다. 공정이 그 자리에 무엇을
   * 넣을지 정한다(도장이면 [전원 / 링크 / 이상]). 셋 미만이어도 된다.
   */
  lamps: readonly EquipmentLamp[]
  /**
   * 핵심 수치 **한 개**. 대개 신선도("4분 전")이고, 이상이면 그 자리가 사유가 된다
   * ("오프라인 19분") — 왜인지를 툴팁이 아니라 셀 안에서 말한다(레퍼런스 §3.2).
   */
  metric: { text: string; meaning: StatusMeaning }
  /**
   * 셀 전체의 판정 — **정렬과 감쇄의 근거**. 이상이 위로 오고, 정상은 무채로 물러난다.
   * 램프 중 가장 나쁜 것을 접어 넣는 것이 보통이지만, 공정이 다르게 정할 수 있다.
   */
  severity: StatusMeaning
  /** 압축 셀에 한 줄 더 — 클릭 없이 보여야 하는 값(틸팅 모드·각도 등). 없으면 생략 */
  note?: string
  /** 신선도 추이 — **이상·선택 셀에만** 그린다(레퍼런스 §3.2: 기본 off) */
  trend?: readonly { label: string; value: number }[]
  /** 펼침 상세 — 셀을 골랐을 때만 그린다(자원 미니바·각도·컨테이너 등) */
  detail?: ReactNode
}

/** 그리드가 다루는 필터 축 — '이상만 보기'(레퍼런스 §3.6-2) */
export type EquipmentGridFilter = 'all' | 'issues'

/** 밀도 2단 (레퍼런스 §3.6-3) — 좁은 패널은 압축, 넓은 화면은 상세 */
export type EquipmentGridDensity = 'compact' | 'roomy'
