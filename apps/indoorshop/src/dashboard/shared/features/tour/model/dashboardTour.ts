import type { TourDefinition } from './types'

/*
 * 대시보드('/') 첫 사용 투어 — 스텝 5개로 최소 (W8-1 합의).
 *
 * 순서는 사용 빈도가 아니라 **화면을 읽는 순서**다: 지도(주인공) → 그 위의 검색 →
 * 어디서든 열리는 전역 검색 → 상태가 오는 곳(알람) → 실적으로 나가는 문.
 */
export const DASHBOARD_TOUR: TourDefinition = {
  id: 'dashboard',
  startPath: '/',
  steps: [
    {
      id: 'map',
      target: 'dashboard-map',
      titleKey: 'tour.dashboard.map.title',
      bodyKey: 'tour.dashboard.map.body',
    },
    {
      id: 'block-search',
      target: 'block-search',
      titleKey: 'tour.dashboard.blockSearch.title',
      bodyKey: 'tour.dashboard.blockSearch.body',
    },
    {
      id: 'global-search',
      target: 'global-search',
      titleKey: 'tour.dashboard.globalSearch.title',
      bodyKey: 'tour.dashboard.globalSearch.body',
    },
    {
      id: 'alarms',
      target: 'alarms',
      titleKey: 'tour.dashboard.alarms.title',
      bodyKey: 'tour.dashboard.alarms.body',
    },
    {
      id: 'performance',
      target: 'nav-performance',
      titleKey: 'tour.dashboard.performance.title',
      bodyKey: 'tour.dashboard.performance.body',
    },
  ],
}
