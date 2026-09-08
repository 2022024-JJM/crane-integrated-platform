/*
 * 투어 시작 신호의 배선 — 헤더의 도움말(?) 버튼이 어느 화면에서든 투어를 다시 켤 수
 * 있어야 하는데, 버튼(Header)과 투어 층(TourController)은 부모-자식이 아니다.
 * Context 를 앱 전체에 두르는 대신, 전역 검색(openGlobalSearch)과 같은 결의
 * 모듈 수준 구독 한 쌍으로 잇는다.
 */

type Listener = (tourId: string) => void

const listeners = new Set<Listener>()

/** 투어를 켠다 — 헤더 버튼·(미래의) 화면별 진입점이 부른다 */
export function startTour(tourId: string): void {
  for (const listener of listeners) listener(tourId)
}

export function onStartTour(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
