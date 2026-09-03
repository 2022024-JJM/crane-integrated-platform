/*
 * 통합 검색 (Cmd+K / '/') — 호선·블록·ASSY·W/O·설비ID 를 입력 하나로 가로질러 찾고,
 * 기존 URL 계약(performanceLinkFor · assyFocusLinkFor · drilldownHref)으로 이동한다.
 *
 * 마운트는 레이아웃에 `<GlobalSearch />` 한 곳, 여는 손은 단축키와 `openGlobalSearch()`
 * (헤더의 돋보기 버튼) 두 갈래다. 팔레트 본체는 lazy 라 안 여는 사용자에게 무게가 없다.
 */
export { GlobalSearch } from './ui/GlobalSearch'
export { openGlobalSearch } from './lib/openBus'
