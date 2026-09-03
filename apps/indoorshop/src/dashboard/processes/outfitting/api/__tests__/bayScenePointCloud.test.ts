import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as THREE from 'three'
import type {
  BlockModelManifest,
  LoadedBlockModel,
} from '../../../../shared/features/bay-viewer/model/blockModel'
import { getMergedAssemblyPositions, getRestPose } from '../../../../shared/features/bay-viewer/model/blockModel'
import type { LidarBlockInfo } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import {
  sampleComponentSurfaces,
  splitComponents,
  filterSamplesByPart,
  type PartComponents,
} from '../../../../shared/features/bay-viewer/lib/partComponents'
import { filterSamplesForSensor, transformSamples } from '../../../../shared/features/bay-viewer/lib/sampleSurfacePoints'
import { detectionProgress, selectCompletedParts } from '../../../../shared/features/bay-viewer/lib/progressStatus'
import { simulateBaySurfaceScan, type ScanObstacle } from '../../../../shared/features/bay-viewer/lib/simulateLidarScan'
import { getSensorPositions, SENSOR_TARGET } from '../../../../shared/features/bay-viewer/lib/sensorLayout'
import { BAY_LENGTH, BAY_WIDTH, JIG_HEIGHT, SENSOR_POLE_HEIGHT } from '../../../../shared/features/bay-viewer/lib/bayConfig'
import { loadYardParcels } from '../../../../shared/entities/yard-parcels'

/*
 * 데모 CAD 모델을 **디스크에서 직접** 읽는다 — 이 계약은 형상 위에 실제로 몇 점이 서는지를
 * 세는 것이라, blockUnitContract 처럼 빈 geometry 로 갈음하면 검사 대상이 사라진다.
 */
vi.mock('../../../../shared/features/bay-viewer/api/loadBlockModel', () => ({
  loadBlockModel: vi.fn(async (projNo: string, blkNo: string): Promise<LoadedBlockModel> => {
    const dir = resolve(__dirname, '../../../../../../../shell/public/models')
    const manifest = JSON.parse(
      readFileSync(resolve(dir, `${projNo}_${blkNo}.json`), 'utf8')
    ) as BlockModelManifest
    const bin = readFileSync(resolve(dir, `${projNo}_${blkNo}.bin`))
    const positions = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4)
    return { manifest, positions: positions.slice() }
  }),
}))

const { fetchOutfittingBayScene } = await import('../outfittingBayScene')
const { mockBlocks } = await import('../mockOutfittingData')
const { areasByBay, blocksOfBay } = await import('../../lib/bayBlocks')
const { OUTFITTING_FACTORIES } = await import('../outfittingFactoryFixture')

/**
 * **의장 베이 씬 점군 밀도 계약 (W7-7-4).**
 *
 * 뷰어의 점군은 전부 씬 입력(센서·블록·모델)에서 합성된다 — 씬이 빈약하게 시드되면 화면의
 * 점군도 빈약하다(실제로 그랬다: 센서 0대 베이는 바닥 점군조차 없었고, 해시가 대기 블록을
 * 뽑은 베이는 블록 점군이 서지 않았다). 여기서는 뷰어의 합성 파이프라인(pass 1·2)과 같은
 * 공식으로 베이마다 실제 합성될 점 수를 세어, 모든 베이가 임계 이상인지 잠근다.
 *
 * ⚠️ 아래 공식은 `LidarPointCloudViewer` pass 1(표면 샘플)·pass 2(센서별 스캔)의 사본이다 —
 * 뷰어 쪽 공식이 바뀌면 여기도 함께 바뀌어야 한다(계약이 그 동행을 강제한다).
 */

/** 뷰어 pass 1 과 같은 표면 샘플 수 공식 */
function sampleCountOf(vertexFloats: number): number {
  return Math.round(Math.min(40000, Math.max(6000, (vertexFloats / 3) * 0.5)))
}

/** detectionMatrix 사본 — 눕히기(restQuat)+바닥 정렬 로컬 행렬과 배치 행렬 */
function placedMatrices(model: LoadedBlockModel, block: LidarBlockInfo) {
  const rest = getRestPose(model, block.modelAssemblyIds!)
  const cx = (rest.restBboxMin[0] + rest.restBboxMax[0]) / 2
  const cz = (rest.restBboxMin[2] + rest.restBboxMax[2]) / 2
  const minY = rest.restBboxMin[1]
  const localMatrix = new THREE.Matrix4()
    .makeTranslation(-cx, -minY + JIG_HEIGHT, -cz)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...rest.restQuat)))
  const placementMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...block.transform.position),
    new THREE.Quaternion(...block.transform.quaternion),
    new THREE.Vector3(1, 1, 1)
  )
  const bbox = {
    min: [
      rest.restBboxMin[0] - cx,
      0 + JIG_HEIGHT,
      rest.restBboxMin[2] - cz,
    ] as [number, number, number],
    max: [
      rest.restBboxMax[0] - cx,
      rest.restBboxMax[1] - minY + JIG_HEIGHT,
      rest.restBboxMax[2] - cz,
    ] as [number, number, number],
  }
  return { localMatrix, placementMatrix, bbox }
}

/** 모델 형상별 부재 분해 캐시 — 같은 데모 형상을 베이마다 다시 분해하지 않는다 */
const partsCache = new Map<string, { soup: Float32Array; parts: PartComponents }>()
function partsOf(model: LoadedBlockModel, assemblyIds: string[]) {
  const key = `${model.manifest.projNo}-${model.manifest.blkNo}`
  const cached = partsCache.get(key)
  if (cached) return cached
  const soup = getMergedAssemblyPositions(model, assemblyIds)
  const entry = { soup, parts: splitComponents(soup) }
  partsCache.set(key, entry)
  return entry
}

/** 뷰어 pass 1+2 와 같은 공식으로 이 씬이 합성할 점 수를 센다 (바닥 + 블록 히트) */
function synthesizedPointCount(scene: {
  sensors: { status: string }[]
  blocks: LidarBlockInfo[]
  bayModel?: { model: LoadedBlockModel } | null
}): { floor: number; block: number } {
  const positions = getSensorPositions(scene.sensors.length, BAY_WIDTH, BAY_LENGTH)
  const online = scene.sensors
    .map((sensor, i) => ({ sensor, position: positions[i] }))
    .filter((s) => s.sensor.status === 'online' && s.position)

  /* pass 1 — 블록 표면 샘플 (진척만큼의 부재에서만) */
  const obstacles: ScanObstacle[] = []
  const blockSampleSets = scene.blocks.flatMap((block) => {
    if (!scene.bayModel || !block.modelAssemblyIds) return []
    const { soup, parts } = partsOf(scene.bayModel.model, block.modelAssemblyIds)
    if (soup.length === 0) return []
    const { localMatrix, placementMatrix, bbox } = placedMatrices(scene.bayModel.model, block)
    obstacles.push({ ...bbox, transform: block.transform })
    const builtParts = selectCompletedParts(parts.areas, detectionProgress(block))
    const scanSamples = filterSamplesByPart(
      sampleComponentSurfaces(soup, parts, sampleCountOf(soup.length), 60),
      (i) => builtParts.has(i)
    )
    const local = transformSamples(
      { positions: scanSamples.positions, normals: scanSamples.normals },
      localMatrix
    )
    return [transformSamples(local, placementMatrix)]
  })

  /* pass 2 — 온라인 센서마다 바닥 스캔 + 블록 히트 */
  let floor = 0
  let block = 0
  for (const { position } of online) {
    const pos = position!.clone()
    pos.y = SENSOR_POLE_HEIGHT
    floor += simulateBaySurfaceScan(pos, SENSOR_TARGET, obstacles, 1, BAY_WIDTH, BAY_LENGTH).length / 3
    for (const samples of blockSampleSets) {
      block += filterSamplesForSensor(samples, pos, SENSOR_TARGET).positions.length / 3
    }
  }
  return { floor, block }
}

describe('의장 베이 씬 — 점군 밀도 계약 (W7-7-4)', () => {
  it(
    '7공장 모든 베이에서 점군이 선다 — 블록 베이는 조립급, 빈 베이도 바닥 점군',
    async () => {
      const parcels = await loadYardParcels()
      const rows: string[] = []
      for (const factory of OUTFITTING_FACTORIES) {
        const bays = parcels.bays.filter((bay) => bay.factory === factory.name)
        expect(bays.length).toBeGreaterThan(0)
        const areaMap = areasByBay(bays)
        for (const bay of bays) {
          const bayBlocks = blocksOfBay(mockBlocks, areaMap.get(bay.id), factory.name)
          const scene = await fetchOutfittingBayScene(factory.name, bay.bay, bay.label, bayBlocks)
          expect(scene, bay.id).not.toBeNull()

          /* 센서 0대면 점군 자체가 불가능하다 — 이관 라이다 또는 구역 mock 폴백이 서야 한다 */
          const online = scene!.scene.sensors.filter((s) => s.status === 'online')
          expect(online.length, `${bay.id}: 온라인 센서가 없다`).toBeGreaterThan(0)

          const { floor, block } = synthesizedPointCount(scene!.scene)
          rows.push(
            `${bay.id}: sensors=${scene!.scene.sensors.length}(on ${online.length}) floor=${floor} block=${block} blk=${scene!.block ? `${scene!.block.projNo}-${scene!.block.blkNo}@${scene!.block.progress}%` : '—'}`
          )

          /* 빈 베이(배정 블록 없음)도 바닥 점군은 서야 한다 */
          expect(floor, `${bay.id}: 바닥 점군이 빈약하다`).toBeGreaterThan(800)

          /* 블록이 선 베이는 블록 점군이 조립급으로 서야 한다 — 진척이 낮은(대기) 블록만
             있는 베이는 진척률만큼만 서는 것이 정직하므로 진척 20% 이상일 때만 잠근다 */
          if (scene!.block && scene!.block.progress >= 20) {
            expect(block, `${bay.id}: 블록 점군이 빈약하다 (${scene!.block.progress}%)`).toBeGreaterThan(3000)
          }
        }
      }
      /* worker 보고용 — 베이별 점수 표 */
      // eslint-disable-next-line no-console
      console.log(rows.join('\n'))
    },
    120_000
  )

  it('진척 최댓값 블록이 선다 — 해시 뽑기가 대기 블록을 세워 점군을 비우지 않는다', async () => {
    const parcels = await loadYardParcels()
    const factory = OUTFITTING_FACTORIES[0]
    const bays = parcels.bays.filter((bay) => bay.factory === factory.name)
    const areaMap = areasByBay(bays)
    for (const bay of bays) {
      const bayBlocks = blocksOfBay(mockBlocks, areaMap.get(bay.id), factory.name)
      if (bayBlocks.length === 0) continue
      const scene = await fetchOutfittingBayScene(factory.name, bay.bay, bay.label, bayBlocks)
      const best = Math.max(...bayBlocks.map((b) => b.progress))
      expect(scene!.block?.progress, bay.id).toBe(best)
    }
  })
})
