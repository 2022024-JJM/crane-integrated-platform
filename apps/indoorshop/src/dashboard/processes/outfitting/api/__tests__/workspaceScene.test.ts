import { describe, expect, it, vi } from 'vitest'
import type {
  BlockModelManifest,
  LoadedBlockModel,
} from '../../../../shared/features/bay-viewer/model/blockModel'
import { loadYardParcels } from '../../../../shared/entities/yard-parcels'

/* 데모 CAD 는 fetch 자산 — 여기서 보는 것은 형상이 아니라 장면의 **구성**이다 */
vi.mock('../../../../shared/features/bay-viewer/api/loadBlockModel', () => ({
  loadBlockModel: vi.fn(async (projNo: string, blkNo: string): Promise<LoadedBlockModel> => {
    const manifest: BlockModelManifest = {
      projNo,
      blkNo,
      wstgCode: 'AA11',
      source: 'test',
      size: [10, 4, 20],
      restQuat: [0, 0, 0, 1],
      restBboxMin: [-5, 0, -10],
      restBboxMax: [5, 4, 10],
      assemblies: [
        {
          id: 'FR700',
          wstgCode: 'AA11',
          partCount: 12,
          children: [],
          vertexStart: 0,
          vertexCount: 2000,
          bboxMin: [-2, 0, -3],
          bboxMax: [2, 2, 3],
          restQuat: [0, 0, 0, 1],
          restBboxMin: [-2, 0, -3],
          restBboxMax: [2, 2, 3],
        },
      ],
    }
    return { manifest, positions: new Float32Array(0) }
  }),
}))

const { fetchOutfittingFactoryScene, fetchOutfittingLocations, fetchOutfittingBayDetail } =
  await import('../outfittingWorkspace')
const { OUTFITTING_FACTORIES } = await import('../outfittingFactoryFixture')
const { mockBlocks } = await import('../mockOutfittingData')
const { areasByBay, blocksOfBay } = await import('../../lib/bayBlocks')

/**
 * 의장 공장 워크스페이스 장면 계약 (W7-10) — 조립과 같은 구조의 근거.
 *
 * 3D 공장 뷰의 배지·실루엣·점군은 전부 이 장면에서 나온다. 베이가 빠지면 배지도
 * 빠지고, 배치가 목업 격자로 떨어지면 실루엣이 상자가 된다 — 그 회귀를 잠근다.
 */
describe('의장 공장 장면 — 전 베이가 한 장면에 선다', () => {
  it('7공장 전부: 장면 베이 수 = 지번 fixture 의 그 공장 베이 수 (빠지는 베이가 없다)', async () => {
    const parcels = await loadYardParcels()
    for (const factory of OUTFITTING_FACTORIES) {
      const fixtureBays = parcels.bays.filter((bay) => bay.factory === factory.name)
      const scene = await fetchOutfittingFactoryScene(factory.id)
      expect(scene, factory.id).not.toBeNull()
      expect(scene!.bays.length, factory.name).toBe(fixtureBays.length)
      /* 배지의 신원 = 작업 위치 id (`{공장id}-b{베이번호}`) — 조립과 같은 규약 */
      const ids = new Set(scene!.bays.map((bay) => bay.location.id))
      for (const bay of fixtureBays) {
        expect(ids.has(`${factory.id}-b${bay.bay}`), `${factory.name} ${bay.id}`).toBe(true)
      }
    }
  })

  it('배치는 실형상(yard-fixture)이다 — 목업 격자로 떨어지지 않는다', async () => {
    for (const factory of OUTFITTING_FACTORIES) {
      const scene = await fetchOutfittingFactoryScene(factory.id)
      expect(scene!.layout.source, factory.name).toBe('yard-fixture')
      expect(scene!.layout.bays.length).toBe(scene!.bays.length)
      /* 실루엣의 근거 — 베이마다 실형상 외곽(footprint)이 실린다 */
      for (const bay of scene!.layout.bays) {
        expect(bay.footprint?.length ?? 0, `${factory.name} ${bay.bayId}`).toBeGreaterThan(2)
      }
    }
  })

  it('베이 상태(재실/빈)는 로스터 블록 배정 그대로다 — 배지와 목록이 같은 사실을 말한다', async () => {
    const parcels = await loadYardParcels()
    for (const factory of OUTFITTING_FACTORIES) {
      const bays = parcels.bays.filter((bay) => bay.factory === factory.name)
      const areaMap = areasByBay(bays)
      const locations = await fetchOutfittingLocations(factory.id)
      for (const bay of bays) {
        const blocks = blocksOfBay(mockBlocks, areaMap.get(bay.id), factory.name)
        const location = locations.find((entry) => entry.id === `${factory.id}-b${bay.bay}`)
        expect(location, bay.id).toBeTruthy()
        expect(location!.status, bay.id).toBe(blocks.length > 0 ? 'occupied' : 'empty')
      }
    }
  })

  it('장면의 인식은 의장 문법 그대로 — 블록 단위 1건, 조립 계층 없음 (W7-6E 유지)', async () => {
    const scene = await fetchOutfittingFactoryScene(OUTFITTING_FACTORIES[0].id)
    for (const bay of scene!.bays) {
      expect(bay.blocks.length).toBeLessThanOrEqual(1)
      for (const detection of bay.blocks) {
        expect(detection.assySerNo).toBeNull()
        expect(detection.subAssemblies).toBeUndefined()
      }
    }
  })

  it('베이 상세 — 장면과 로스터 블록이 함께 오고, location 은 목록의 것과 같다', async () => {
    const factory = OUTFITTING_FACTORIES[0]
    const locations = await fetchOutfittingLocations(factory.id)
    const occupied = locations.find((location) => location.status === 'occupied')!
    const detail = await fetchOutfittingBayDetail(factory.id, occupied.id)
    expect(detail).not.toBeNull()
    expect(detail!.scene.location).toEqual(occupied)
    expect(detail!.blocks.length).toBeGreaterThan(0)
    /* 규약 밖 id 는 null — 지어내지 않는다 */
    expect(await fetchOutfittingBayDetail(factory.id, '없는베이')).toBeNull()
  })
})
