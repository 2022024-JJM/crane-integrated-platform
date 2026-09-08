import type { InshopKey } from '../../../lib/i18n/keys'

/*
 * 인앱 투어(코치마크)의 데이터 계약 (W8-1).
 *
 * 스텝은 **데이터(배열)** 다 — 나중에 공정 화면용 투어를 더하는 일이 코드가 아니라
 * 스텝 배열 하나를 더하는 일이 되게 한다. 렌더(스포트라이트·말풍선)는 TourOverlay 가
 * 정의를 읽어서 그린다.
 */

export interface TourStep {
  /** 스텝 식별자 — 진행 표시·테스트가 짚는 이름 */
  id: string
  /**
   * 비출 요소 — `data-tour="{target}"` 속성으로 찾는다. CSS 클래스가 아니라 전용
   * 속성인 이유: 스타일 리팩토링이 투어를 조용히 끊지 못하게(속성은 지우면 눈에 띈다).
   */
  target: string
  titleKey: InshopKey
  bodyKey: InshopKey
  /**
   * 이 스텝이 서야 하는 화면. 지금 경로가 다르면 **기존 딥링크 문법 그대로** 이동한
   * 뒤 비춘다. 없으면 화면 이동 없이 지금 자리에서 찾는다.
   */
  path?: string
}

export interface TourDefinition {
  /** 투어 식별자 — 본 적 있음(localStorage) 기록의 키 */
  id: string
  /** 투어가 시작될 화면 — 다른 화면에서 재실행하면 먼저 이 경로로 이동한다 */
  startPath: string
  steps: readonly TourStep[]
}
