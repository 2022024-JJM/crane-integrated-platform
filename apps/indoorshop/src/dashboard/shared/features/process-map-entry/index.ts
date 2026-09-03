/*
 * '맵 진입 공정 화면' 공통 프레임 — 맵 진입 → 공장 클릭 → 우측 오버레이 문법을 쓰는
 * 공정 화면(도장·조립·의장·CAS/PAS)의 공용 골격. 도장 배치 맵에서 공정 무관부를 승격했다.
 * 계약(무엇이 공정 몫인가)은 `model/types.ts` 의 ProcessMapEntryProps 참조.
 */
export { ProcessMapEntry } from './ui/ProcessMapEntry'
export { MapMarkerLayer, type MapMarkerLayerHandle } from './ui/MapMarkerLayer'
/* 우측 패널의 공통 부품 — 단 토글·접이 구획·수집 요약 본문(문구는 호출자가 번역해 넣는다) */
export {
  CollectionSummaryBody,
  PanelModeTabs,
  PanelSection,
  type CollectionRow,
  type PanelModeTab,
} from './ui/PanelParts'
export { useMapEntryData, useShopDeepLink } from './lib/useMapEntryData'
export {
  demoteNonMemberLots,
  memberExtentOf,
  memberFactoriesOf,
  memberProcessesOf,
  orderFactoryNames,
} from './lib/members'
export type {
  BayBodyCtx,
  MapEntryLabels,
  MapEntryMarker,
  MarkerRenderCtx,
  ProcessMapEntryHandle,
  ProcessMapEntryProps,
} from './model/types'
