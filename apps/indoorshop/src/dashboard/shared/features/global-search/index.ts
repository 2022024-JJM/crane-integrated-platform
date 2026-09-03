/*
 * 통합 검색 — **이 앱의 검색은 여기 하나다.**
 *
 * 호선·블록·ASSY·야드 위치(BTS)·W/O·설비ID 를 한 색인으로 찾고, **행선지는 결과 타입이
 * 정한다**(W/O → 통합실적 · 호선 → 총괄 지도에 그 호선 블록 전부 · 블록/ASSY/야드 →
 * 총괄 지도 · 설비 → 그 공정 맵). 진입점은 둘이지만 기능은 하나다:
 *
 *   `GlobalSearch`  레이아웃에 상주하는 팔레트 (Cmd/Ctrl+K · '/')
 *   `SearchField`   대시보드 총괄 지도 위 상주 검색창 — 같은 모듈의 임베드 변형
 *
 * 둘은 같은 색인(`searchGlobal`)·같은 원천(`useSearchSources`)·같은 줄(`SearchResultRows`)·
 * 같은 행동(`useSearchBox`)을 쓴다. 다른 것은 재질뿐이다.
 *
 * 지도가 무엇을 비추는지는 **주소**가 정한다 — `MapFocus`/`parseMapFocus` 가 그 계약이고,
 * 철자는 통합실적의 선택 계약(`?vessel=&block=&assy=`) 그대로다.
 */
export { GlobalSearch } from './ui/GlobalSearch'
export { SearchField } from './ui/SearchField'
export { openGlobalSearch } from './lib/openBus'
export {
  MAP_PATH,
  mapFocusHref,
  searchGlobal,
  SEARCH_GROUPS,
  type SearchGroup,
  type SearchHit,
  type SearchSources,
} from './lib/searchIndex'
export { clearMapFocusSearch, parseMapFocus, type MapFocus } from './lib/mapFocus'
export { useYardBlockIndex } from './lib/useSearchSources'
