import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlockModelManifest, LoadedBlockModel } from '../../../../shared/features/bay-viewer/model/blockModel'
import { formatDetectionId } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import { YARD_EQUIPMENT } from '../../../../shared/entities/equipment'

/*
 * 데모 CAD 형상은 fetch 로 오는 자산이라 노드 테스트에서는 갈음한다 — 여기서 볼 것은
 * 형상이 아니라 **그 위에 무엇을 세우는가**(인식 단위·신원)다.
 */
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
      assemblies: Array.from({ length: 4 }, (_, i) => ({
        id: `FR${700 + i}`,
        wstgCode: 'AA11',
        partCount: 12,
        children: [],
        vertexStart: i * 2000,
        vertexCount: 2000,
        bboxMin: [-2, 0, -3],
        bboxMax: [2, 2, 3],
        restQuat: [0, 0, 0, 1],
        restBboxMin: [-2, 0, -3],
        restBboxMax: [2, 2, 3],
      })),
    }
    return { manifest, positions: new Float32Array(0) }
  }),
}))

const { fetchOutfittingBayScene } = await import('../outfittingBayScene')
const { mockBlocks } = await import('../mockOutfittingData')
const { outfittingFactoryByName } = await import('../../lib/bayBlocks')
const { devicesOfBay } = await import('../../lib/equipmentStatus')

/**
 * **의장은 블록 단위다 — 그 아래 계층이 없다.**
 *
 * 조립은 블록 아래 중조·소조가 있고 화면이 그 계층을 그대로 드러낸다. 의장에는 그 계층이
 * 존재하지 않는데, 조립 뷰어를 그대로 빌려 쓰다 보면 조립의 계층이 딸려 들어오기 쉽다 —
 * `assySerNo`(조립 일련번호)가 붙은 '중조립품' 인식, '하위 조립 구성' 목록, CAD 모델의
 * 블록번호가 로스터 대신 화면에 서는 일. 실제로 그랬고, 이 계약이 그 재발을 막는다.
 *
 * 뷰어 UX(카메라·점군·도구줄)는 조립과 같아야 하므로 여기서 보는 것은 **데이터**뿐이다.
 */

/** 어느 공장의 첫 블록과 그 공장 이름 — 로스터가 실제로 배정한 것 */
function sampleFactoryWithBlocks() {
  const block = mockBlocks[0]
  const spec = outfittingFactoryByName(
    ['POS 1공장', '두모 선행의장 2공장', '조립의장 1공장 BOS 1'].find((name) => {
      const factory = outfittingFactoryByName(name)
      return factory && mockBlocks.some((b) => b.factoryId === factory.id)
    }) ?? ''
  )
  return { block, spec }
}

describe('의장 베이 장면 — 블록 단위 계약', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('인식 대상은 로스터 블록 1건이고, 조립 일련번호가 붙지 않는다', async () => {
    const { spec } = sampleFactoryWithBlocks()
    const blocks = mockBlocks.filter((b) => b.factoryId === spec!.id).slice(0, 3)
    const scene = await fetchOutfittingBayScene(spec!.name, '1', '1BAY', blocks)

    expect(scene).not.toBeNull()
    expect(scene!.scene.blocks).toHaveLength(1)
    const detection = scene!.scene.blocks[0]
    /* 조립 일련번호(ASSY_SER_NO)는 중·소조 인식일 때만 존재한다 — 의장에는 그 단계가 없다 */
    expect(detection.assySerNo).toBeNull()
    /* 그래서 화면 표기도 조립품(`627-FR755`)이 아니라 블록(`BLK 627`)이다 */
    expect(formatDetectionId(detection)).toMatch(/^BLK /)
  })

  it('하위 조립 구성(소조) 목록을 만들지 않는다 — 없는 계층을 지어내지 않는다', async () => {
    const { spec } = sampleFactoryWithBlocks()
    const blocks = mockBlocks.filter((b) => b.factoryId === spec!.id).slice(0, 3)
    const scene = await fetchOutfittingBayScene(spec!.name, '1', '1BAY', blocks)
    expect(scene!.scene.blocks[0].subAssemblies).toBeUndefined()
  })

  it('블록의 신원은 로스터가 준다 — CAD 모델의 번호가 아니다', async () => {
    const { spec } = sampleFactoryWithBlocks()
    const blocks = mockBlocks.filter((b) => b.factoryId === spec!.id).slice(0, 3)
    const scene = await fetchOutfittingBayScene(spec!.name, '1', '1BAY', blocks)

    const detection = scene!.scene.blocks[0]
    const roster = blocks.find((b) => b.blkNo === detection.blkNo)
    expect(roster, '인식된 블록이 이 베이의 로스터 블록 중 하나여야 한다').toBeTruthy()
    expect(detection.projNo).toBe(roster!.projNo)
    expect(detection.wstgCode).toBe(roster!.wstgCode)
    expect(scene!.block?.id).toBe(roster!.id)
  })

  it('진척률도 로스터 블록의 값이다 — 뷰어와 목록이 다른 숫자를 말하지 않는다', async () => {
    const { spec } = sampleFactoryWithBlocks()
    const blocks = mockBlocks.filter((b) => b.factoryId === spec!.id).slice(0, 3)
    const scene = await fetchOutfittingBayScene(spec!.name, '1', '1BAY', blocks)

    const detection = scene!.scene.blocks[0]
    const roster = blocks.find((b) => b.blkNo === detection.blkNo)!
    const latest = detection.history.find((event) => typeof event.progress === 'number')
    expect(latest?.progress).toBe(roster.progress)
  })

  it('배정된 블록이 없는 베이는 인식 대상이 0건이다 — 블록을 지어내지 않는다', async () => {
    const { spec } = sampleFactoryWithBlocks()
    const scene = await fetchOutfittingBayScene(spec!.name, '9', '9BAY', [])
    expect(scene!.scene.blocks).toEqual([])
    expect(scene!.block).toBeNull()
  })

  it('같은 베이·같은 입력이면 같은 블록이 선다 (결정론)', async () => {
    const { spec } = sampleFactoryWithBlocks()
    const blocks = mockBlocks.filter((b) => b.factoryId === spec!.id).slice(0, 3)
    const a = await fetchOutfittingBayScene(spec!.name, '1', '1BAY', blocks)
    const b = await fetchOutfittingBayScene(spec!.name, '1', '1BAY', blocks)
    expect(a!.block?.id).toBe(b!.block?.id)
  })
})

describe('의장 베이 장면 — 센서는 이관된 실제 설비다', () => {
  it("지어낸 '센서 N' 이 아니라 도면에서 이관된 라이다 ID 를 쓴다", async () => {
    const factory = 'POS 1공장'
    const bayNo = devicesOfBay(factory, '1').length > 0 ? '1' : '2'
    const scene = await fetchOutfittingBayScene(factory, bayNo, `${bayNo}BAY`, [])

    const known = new Set(YARD_EQUIPMENT.map((e) => e.id))
    expect(scene!.scene.sensors.length).toBeGreaterThan(0)
    for (const sensor of scene!.scene.sensors) {
      expect(sensor.name).not.toMatch(/^센서 \d+$/)
      expect(known.has(sensor.id), `${sensor.id} 는 설비 엔티티의 라이다여야 한다`).toBe(true)
      expect(sensor.id.startsWith('LD-')).toBe(true)
    }
  })

  it('센서는 이 장면의 작업 위치에 묶인다 — 뷰어가 자리를 잡을 수 있게', async () => {
    const scene = await fetchOutfittingBayScene('POS 1공장', '1', '1BAY', [])
    for (const sensor of scene!.scene.sensors) {
      expect(sensor.locationId).toBe(scene!.location.id)
    }
  })
})
