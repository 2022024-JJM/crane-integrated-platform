import type { Location } from '../../../shared/entities/location/model/types'
import { loadYardParcels } from '../../../shared/entities/yard-parcels'
import type { BaySceneData } from '../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import {
  buildMockFactoryLayout,
  buildYardFactoryLayout,
  type FactoryLayout,
} from '../../../shared/features/bay-viewer/lib/bayLayout'
import { areasByBay, blocksOfBay } from '../lib/bayBlocks'
import type { OutfittingBlock } from '../model/block'
import { OUTFITTING_FACTORIES } from './outfittingFactoryFixture'
import { outfittingBlocksAt } from './mockOutfittingData'
import { fetchOutfittingBayScene } from './outfittingBayScene'

/*
 * 의장 공장 워크스페이스의 데이터 공급 (W7-10) — **조립 워크스페이스와 같은 이음새**.
 *
 * 조립은 정반(location)·공장 배치(layout)·베이 장면(BaySceneData)을 각각 조회해 3D
 * 워크스페이스를 세운다. 의장도 같은 계약으로 세우되 재료가 다르다:
 *
 *  · 정반 대신 **베이** — 의장은 베이가 작업 위치의 끝이다(그 아래 정반·지번 없음).
 *    베이 목록의 원천은 지번 fixture(`yard-parcels`)의 그 공장 베이들이고, id 는
 *    조립과 같은 `{공장id}-b{베이번호}` 규약이다(실측이 붙을 때 같은 이음새).
 *  · 배치는 조립과 **같은 빌더**(buildYardFactoryLayout — 지번 폴리곤 실형상)를 쓴다.
 *    fixture 에 없는 베이가 있으면 조립처럼 목업 격자로 폴백한다.
 *  · 베이 장면은 `fetchOutfittingBayScene` — 블록 단위 문법·로스터 신원(W7-6E)과
 *    점군 밀도(W7-7-4)는 그쪽 계약이 지킨다. 여기서는 모아 세울 뿐이다.
 */

/*
 * `baseDate` — 기준일 축(연계 매트릭스 §2.3). 통합실적에서 되감은 날짜를 들고 넘어오면
 * 블록 배정·진척도 그 날짜의 것이어야 한다. 생략하면 오늘.
 */

/** 공장 하나의 워크스페이스 장면 — 조립 factoryScene 과 같은 모양 */
export interface OutfittingFactoryScene {
  factoryId: string
  bays: BaySceneData[]
  layout: FactoryLayout
  /** 베이 id → 그 베이의 로스터 블록 — 블록·실적 탭이 그대로 편다 */
  blocksByBay: Map<string, OutfittingBlock[]>
}

function specOf(factoryId: string) {
  return OUTFITTING_FACTORIES.find((factory) => factory.id === factoryId)
}

/**
 * 한 공장의 작업 위치(베이) 목록 — 지번 fixture 의 그 공장 베이들.
 *
 * `status` 는 로스터 블록 배정으로 정한다(배정 있음 = 재실) — 탭의 상태 점과 3D 라벨이
 * 같은 사실을 말하게 하기 위해서다. 없는 상태를 지어내지 않는다.
 */
export async function fetchOutfittingLocations(
  factoryId: string,
  baseDate?: string
): Promise<Location[]> {
  const spec = specOf(factoryId)
  if (!spec) return []
  const parcels = await loadYardParcels()
  const bays = parcels.bays.filter((bay) => bay.factory === spec.name)
  const areaMap = areasByBay(bays)
  return bays.map((bay): Location => {
    const blocks = blocksOfBay(outfittingBlocksAt(baseDate), areaMap.get(bay.id), spec.name)
    return {
      id: `${spec.id}-b${bay.bay}`,
      factoryId: spec.id,
      name: bay.label,
      status: blocks.length > 0 ? 'occupied' : 'empty',
      workCntr: `${spec.shopCode}-${bay.bay}`,
      yardLots: bay.lotCodes,
    }
  })
}

/** locationId(`{공장id}-b{베이번호}`) → 베이 번호. 규약 밖이면 null */
export function bayNoOfLocationId(factoryId: string, locationId: string): string | null {
  const prefix = `${factoryId}-b`
  return locationId.startsWith(prefix) ? locationId.slice(prefix.length) : null
}

/** 베이 하나의 장면 + 로스터 블록 — 베이 레벨 뷰와 탭들이 함께 쓴다 */
export interface OutfittingBayDetail {
  locationId: string
  scene: BaySceneData
  blocks: OutfittingBlock[]
}

async function bayDetailOf(
  factoryId: string,
  bay: { bay: string; label: string; id: string },
  bayBlocks: OutfittingBlock[],
  location: Location
): Promise<OutfittingBayDetail | null> {
  const spec = specOf(factoryId)
  if (!spec) return null
  const scene = await fetchOutfittingBayScene(spec.name, bay.bay, bay.label, bayBlocks)
  if (!scene) return null
  return {
    locationId: location.id,
    /* 장면의 location 은 워크스페이스 목록의 것으로 통일한다 — 상태(재실/빈)를 두 곳이
       다르게 말하지 않도록 (`fetchOutfittingBayScene` 은 늘 occupied 로 세운다) */
    scene: { ...scene.scene, location },
    blocks: bayBlocks,
  }
}

/**
 * 공장 전체 장면 — 전 베이의 장면 + 실형상 배치.
 *
 * 베이 하나의 실패(모델 로드 등)가 공장 뷰 전체를 무너뜨리지 않도록 그 베이만
 * 뺀다(조립 공장 뷰와 같은 규칙).
 */
export async function fetchOutfittingFactoryScene(
  factoryId: string,
  baseDate?: string
): Promise<OutfittingFactoryScene | null> {
  const spec = specOf(factoryId)
  if (!spec) return null
  const parcels = await loadYardParcels()
  const bays = parcels.bays.filter((bay) => bay.factory === spec.name)
  const areaMap = areasByBay(bays)
  const locations = await fetchOutfittingLocations(factoryId, baseDate)
  const locationById = new Map(locations.map((location) => [location.id, location]))

  const details = await Promise.all(
    bays.map(async (bay) => {
      const location = locationById.get(`${spec.id}-b${bay.bay}`)
      if (!location) return null
      const bayBlocks = blocksOfBay(outfittingBlocksAt(baseDate), areaMap.get(bay.id), spec.name)
      return bayDetailOf(factoryId, bay, bayBlocks, location).catch(() => null)
    })
  )
  const present = details.filter((detail): detail is OutfittingBayDetail => detail != null)

  /* 실형상 배치 — 조립과 같은 빌더. 지번에 없는 베이가 있으면 목업 격자 폴백 */
  const layout =
    (await buildYardFactoryLayout(factoryId, spec.name, locations).catch(() => null)) ??
    buildMockFactoryLayout(factoryId, locations)

  return {
    factoryId,
    bays: present.map((detail) => detail.scene),
    layout,
    blocksByBay: new Map(present.map((detail) => [detail.locationId, detail.blocks])),
  }
}

/** 베이 하나의 상세 — 베이 레벨 뷰 (조립의 정반 레벨 detail 과 같은 자리) */
export async function fetchOutfittingBayDetail(
  factoryId: string,
  locationId: string,
  baseDate?: string
): Promise<OutfittingBayDetail | null> {
  const spec = specOf(factoryId)
  if (!spec) return null
  const bayNo = bayNoOfLocationId(factoryId, locationId)
  if (!bayNo) return null
  const parcels = await loadYardParcels()
  const bays = parcels.bays.filter((bay) => bay.factory === spec.name)
  const bay = bays.find((entry) => entry.bay === bayNo)
  if (!bay) return null
  const areaMap = areasByBay(bays)
  const bayBlocks = blocksOfBay(outfittingBlocksAt(baseDate), areaMap.get(bay.id), spec.name)
  const locations = await fetchOutfittingLocations(factoryId, baseDate)
  const location = locations.find((entry) => entry.id === locationId)
  if (!location) return null
  return bayDetailOf(factoryId, bay, bayBlocks, location)
}
