/*
 * 인앱 투어(코치마크) — 첫 사용자 안내 층 (W8-1).
 * 스텝은 model/ 의 데이터, 렌더는 TourOverlay, 지휘는 TourController(레이아웃에 한 번).
 */
export { TourController } from './ui/TourController'
export { TourOverlay } from './ui/TourOverlay'
export { startTour } from './lib/tourBus'
export { DASHBOARD_TOUR } from './model/dashboardTour'
export { isTourSeen, markTourSeen, tourStorageKey } from './lib/tourStorage'
export type { TourDefinition, TourStep } from './model/types'
