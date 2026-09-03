import { BLOCKS, VESSELS } from '../model/roster'
import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'
import type { BlockOption, ProcessZone, RosterBlock, Vessel } from '../model/types'

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
  if (block.berth) return `/zones/assembly/${block.berth.factoryId}/${block.berth.bayId}`
  return drilldownHref(`/zones/${block.zone}`, '', { ...YARD_DRILLDOWN, factory: block.factory })
}
