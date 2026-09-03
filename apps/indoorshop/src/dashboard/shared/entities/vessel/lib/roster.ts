import { BLOCKS, VESSELS } from '../model/roster'
import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'
import { VIEWER_TAB, withWorkspaceTab } from '../../../lib/workspaceTabUrl'
import type { AssyPlacement, BlockOption, ProcessZone, RosterBlock, Vessel } from '../model/types'

/**
 * 로스터 조회 — 화면·API 파사드가 우주를 읽는 유일한 문법.
 *
 * 색인은 모듈 로드 때 한 번만 만든다. 30여 건이라 훑어도 되지만, 대시보드는 공장을
 * 옮길 때마다 `blocksAtFactory` 를 부르므로 미리 갈라 두는 편이 호출부를 단순하게 한다.
 */

const byVessel = new Map<string, RosterBlock[]>()
const byFactory = new Map<string, RosterBlock[]>()
const byBay = new Map<string, RosterBlock>()
const byKey = new Map<string, RosterBlock>()

export function blockKey(projNo: string, blockNo: string): string {
  return `${projNo}-${blockNo}`
}

for (const block of BLOCKS) {
  const vessel = byVessel.get(block.projNo)
  if (vessel) vessel.push(block)
  else byVessel.set(block.projNo, [block])

  const factory = byFactory.get(block.factory)
  if (factory) factory.push(block)
  else byFactory.set(block.factory, [block])

  if (block.berth) byBay.set(block.berth.bayId, block)
  byKey.set(blockKey(block.projNo, block.blockNo), block)
}

/** 호선 전체 — 통합실적 필터의 호선 목록 */
export function listVessels(): Vessel[] {
  return [...VESSELS]
}

export function findVessel(projNo: string): Vessel | null {
  return VESSELS.find((v) => v.projNo === projNo) ?? null
}

/** 블록 전체 (로스터 순서 그대로) */
export function listBlocks(): RosterBlock[] {
  return [...BLOCKS]
}

/** 호선 1척의 블록 — 조립·의장을 가리지 않는다 (통합실적은 공정 횡단 화면이다) */
export function blocksOfVessel(projNo: string): RosterBlock[] {
  return [...(byVessel.get(projNo) ?? [])]
}

/** 통합실적 필터가 쓰는 얇은 형태 */
export function blockOptionsOfVessel(projNo: string): BlockOption[] {
  return blocksOfVessel(projNo).map((b) => ({ blockNo: b.blockNo, factory: b.factory }))
}

/** 지도 공장명으로 — 대시보드가 공장을 포커스했을 때 그 공장의 재공 블록 */
export function blocksAtFactory(factory: string): RosterBlock[] {
  return [...(byFactory.get(factory) ?? [])]
}

/** 공정존으로 — 조립 mock 이 정반 배정을, 의장 mock 이 구역 배정을 뽑을 때 */
export function blocksInZone(zone: ProcessZone): RosterBlock[] {
  return BLOCKS.filter((b) => b.zone === zone)
}

/** 조립 공장 1곳의 블록 (공장 id 기준 — 지도 공장명이 아니라 fixture id) */
export function blocksAtAssemblyFactory(factoryId: string): RosterBlock[] {
  return BLOCKS.filter((b) => b.berth?.factoryId === factoryId)
}

/**
 * 의장 공장 1곳의 **재공** 블록.
 *
 * ⚠️ 배정(`outfitting`)만 보지 않고 **지금 서 있는 공정**(`zone`)까지 본다 (W7-6F).
 * '재공' 은 지금 그 공장에서 작업 중이라는 뜻이라, 도장으로 넘어간 블록이 의장 목록에
 * 남아 있으면 그 블록은 두 공정에 동시에 서 있는 것이 된다 — 공정 순서(가공 → 조립 →
 * 의장 → 도장)가 화면에서 깨지는 자리다.
 *
 * 지금은 두 조건이 늘 함께 참이다(로스터 계약: 배정이 있으면 zone 도 의장 —
 * `__tests__/roster.test.ts`). 그래도 여기서 한 번 더 거르는 이유는, 나중에 배정을
 * **거쳐 간 이력**으로 쓰기 시작하는 순간 이 목록이 조용히 틀려지기 때문이다.
 */
export function blocksAtOutfittingFactory(factoryId: string): RosterBlock[] {
  return BLOCKS.filter((b) => b.zone === 'outfitting' && b.outfitting?.factoryId === factoryId)
}

/** 정반 하나에 놓인 블록 — 대시보드 베이 카드 ↔ 통합실적 블록의 연결 키 */
export function blockAtBay(bayId: string): RosterBlock | null {
  return byBay.get(bayId) ?? null
}

export function findBlock(projNo: string, blockNo: string): RosterBlock | null {
  return byKey.get(blockKey(projNo, blockNo)) ?? null
}

/**
 * **이 블록의 ASSY BOM 트리** — 있으면 이것이 구성의 정본이다 (R34).
 *
 * 통합실적 생성기가 부른다: 로스터가 구성을 아는 블록은 그 트리를 그대로 쓰고, 모르는
 * 블록만 합성한다. 예전에는 생성기가 언제나 합성했고 로스터는 평평한 명단만 들고
 * 있어서, 같은 블록의 계층이 두 곳에서 따로 만들어졌다 — 지도와 실적 카드가 다른
 * 근거에서 같은 그림을 그리는 상태였다.
 *
 * 순서는 로스터에 적힌 순서 그대로다(트리 pre-order 로 적는 것이 규약이지만, 강제는
 * 하지 않는다 — 재정렬은 집계 쪽 `assyTreeOrder` 가 한다).
 */
export function assyTreeOf(projNo: string, blockNo: string): readonly AssyPlacement[] | null {
  const units = findBlock(projNo, blockNo)?.assyUnits
  return units && units.length > 0 ? units : null
}

/** 3D 형상(CAD)이 있는 블록만 — 정반 뷰어가 실제로 그릴 수 있는 것들 */
export function blocksWithCadModel(): RosterBlock[] {
  return BLOCKS.filter((b) => b.berth?.hasCadModel)
}

/**
 * 그 블록이 서 있는 공정 화면 경로.
 *
 * 정반이 정해진 조립 블록은 정반 상세까지, 그렇지 않으면 그 공장을 연 맵 진입 화면까지
 * 간다 (`?factory=` — 드릴다운 URL 계약, `shared/lib/drilldownUrl`).
 */
export function zonePathOfBlock(block: RosterBlock): string {
  if (block.berth) return `/indoorshop/zones/assembly/${block.berth.factoryId}/${block.berth.bayId}`
  return drilldownHref(`/indoorshop/zones/${block.zone}`, '', { ...YARD_DRILLDOWN, factory: block.factory })
}

/* ── 통합실적 → PCD 뷰 (W8-3) ─────────────────────────────────────
 * 공장 현황 → 통합실적 방향만 있던 다리의 **역방향**이다. 진행중 항목이 그 소재의
 * 3D 워크스페이스(베이 레벨)로 들어간다. `?block={proj}-{blk}` 는 도착 화면(조립·의장
 * 워크스페이스)이 소비하는 선택 승계 파라미터다 — 도착하면 그 블록이 선택돼 있다.
 *
 * 경로에는 **착지 탭까지 싣는다**(`&tab=viewer`, R28). 이 문의 이름은 'PCD 뷰'이므로
 * 3D 에 내려서야 뜻이 성립하는데, 축 탭 기본값이 현황으로 바뀌자(P4) 링크는 그대로인
 * 채 도착지만 현황으로 옮겨 갔다. 착지점을 링크가 직접 말하게 두면 기본 탭을 다시 바꿔도
 * 이 문은 흔들리지 않는다 (계약: `shared/lib/workspaceTabUrl`).
 *
 * 소재를 모르면 null — 갈 곳 없는 문을 세우지 않는다(부르는 쪽이 버튼을 접는다).
 */

/** 선택 승계 쿼리 — 도착 화면이 이 키로 읽는다 */
export const PCD_BLOCK_PARAM = 'block'

/**
 * ASSY 한 덩이의 PCD 뷰 경로 — 소재는 ASSY 자리(`assyUnits[].berth`)가 정본이고,
 * 흩어짐이 없는 블록은 블록 정반(`berth`)이다. 조립 밖에 선 자리(도장 전이 등)나
 * 정반 미상은 null.
 */
export function pcdHrefOfAssy(assyNo: string): string | null {
  const [projNo, blockNo] = assyNo.split('-')
  if (!projNo || !blockNo) return null
  const block = findBlock(projNo, blockNo)
  if (!block) return null
  /* 흩어진 ASSY 는 제 자리가, 그렇지 않으면 블록 자리가 정본이다 */
  const home = block.assyUnits?.find((unit) => unit.assyNo === assyNo) ?? block
  if (home.zone !== 'assembly') return null
  const berth = home.berth
  if (!berth) return null
  return withWorkspaceTab(
    `/indoorshop/zones/assembly/${berth.factoryId}/${berth.bayId}?${PCD_BLOCK_PARAM}=${projNo}-${blockNo}`,
    VIEWER_TAB
  )
}

/**
 * 의장 블록의 PCD 뷰 경로 — 의장 베이 워크스페이스(W7-10 라우트). 베이 id 는
 * `{공장id}-b{지도베이}` 규약(의장 워크스페이스 계약)이라 로스터 `mapBay` 가 곧 재료다.
 * 의장 밖이거나 베이 미상이면 null.
 */
export function pcdHrefOfOutfittingBlock(projNo: string, blockNo: string): string | null {
  const block = findBlock(projNo, blockNo)
  if (!block || block.zone !== 'outfitting' || !block.outfitting || !block.mapBay) return null
  const { factoryId } = block.outfitting
  return withWorkspaceTab(
    `/indoorshop/zones/outfitting/${factoryId}/${factoryId}-b${block.mapBay}?${PCD_BLOCK_PARAM}=${projNo}-${blockNo}`,
    VIEWER_TAB
  )
}
