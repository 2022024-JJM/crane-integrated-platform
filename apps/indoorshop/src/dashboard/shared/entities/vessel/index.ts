/**
 * 호선·블록 마스터 — 단일 mock 우주의 진입점.
 *
 * 대시보드·통합실적·공정 화면은 **이 파일만** import 한다. 화면마다 따로 호선번호·
 * 블록번호를 만들지 않는다 — 그러면 같은 블록이 화면마다 다른 이름으로 나타나고,
 * 화면을 옮길 때마다 조회 조건을 다시 골라야 한다(이 모듈이 생긴 이유).
 *
 * 30여 건이라 가벼워 정적 import 로 둔다 (`entities/equipment` 와 같은 판단).
 */
export type {
  AssemblyBerth,
  AssyPlacement,
  AssyScanFact,
  AssyTier,
  BlockOption,
  BlockSite,
  OutfittingBerth,
  ProcessZone,
  RosterBlock,
  Vessel,
} from './model/types'
export {
  isBlockInTransition,
  isBlockTrackable,
  sitesOfBlock,
  zonesOfSites,
} from './lib/sites'
export {
  matchedAssyNos,
  normalizeBlockQuery,
  searchRosterBlocks,
} from './lib/blockSearch'
export { YARD_PROCESS_OF_ZONE } from './model/types'
export { PAINTING_FACTORIES } from './model/roster'
export {
  assyNoOfScanMesh,
  scanConfidenceOf,
  scanMeshNameOf,
  surfaceMatchPctOf,
} from './lib/scan'
export {
  assyTreeOf,
  blockAtBay,
  blockKey,
  blockOptionsOfVessel,
  blocksAtAssemblyFactory,
  blocksAtFactory,
  blocksAtOutfittingFactory,
  blocksInZone,
  blocksOfVessel,
  blocksWithCadModel,
  findBlock,
  findVessel,
  listBlocks,
  listVessels,
  zonePathOfBlock,
  PCD_BLOCK_PARAM,
  pcdHrefOfAssy,
  pcdHrefOfOutfittingBlock,
} from './lib/roster'
export type { BlockSelection } from './lib/blockSelection'
export {
  SELECTION_PARAMS,
  assyFocusLinkFor,
  clearSelection,
  parseAssyNo,
  parseSelectionParams,
  performanceLinkFor,
  recallSelection,
  rememberSelection,
  resolveEntrySelection,
  selectionOfBlock,
  selectionQuery,
} from './lib/blockSelection'
export { PerformanceLink } from './ui/PerformanceLink'
export { ProcessMapLink } from './ui/ProcessMapLink'
