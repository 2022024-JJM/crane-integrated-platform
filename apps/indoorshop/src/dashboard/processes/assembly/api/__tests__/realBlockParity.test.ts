import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { LidarBlockInfo } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import {
  getMergedAssemblyPositions,
  getRestPose,
  type LoadedBlockModel,
} from '../../../../shared/features/bay-viewer/model/blockModel'

/* 실측 자산은 fetch 로 오는 값이라 노드에서는 디스크로 갈음한다 (내용은 산출물 그대로) */
const ASSETS = resolve(__dirname, '../../../../../../../shell/public/real-scan')
vi.mock('../realScanAssets', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const manifest = JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'latin1'))
  const meshes = JSON.parse(readFileSync(`${ASSETS}/cad_meshes.json`, 'utf8'))
  return {
    ...original,
    loadRealScanManifest: vi.fn(async () => manifest),
    loadRealCadMeshes: vi.fn(async () => meshes.instances),
  }
})

/* 목업 블록 모델도 fetch 자산이라 같은 이유로 디스크에서 읽는다 (내용은 산출물 그대로) */
const MODELS = resolve(__dirname, '../../../../../../../shell/public/models')
vi.mock('../../../../shared/features/bay-viewer/api/loadBlockModel', () => ({
  loadBlockModel: vi.fn(async (projNo: string, blkNo: string) => ({
    manifest: JSON.parse(readFileSync(`${MODELS}/${projNo}_${blkNo}.json`, 'utf8')),
    positions: new Float32Array(
      readFileSync(`${MODELS}/${projNo}_${blkNo}.bin`).buffer as ArrayBuffer
    ),
  })),
}))

const { fetchRealDetectedBlocks, REAL_LOCATION_ID } = await import('../realScanData')
const { loadRealBlockModel } = await import('../realBlockModel')
const { fetchDetectedBlocks, fetchBlockPreviewModel } = await import('../assemblyApi')
const { bayBlockAssignments } = await import('../mockAssemblyData')

/**
 * **실측 = 목업, 필드·기능 동등** (R26).
 *
 * 실측 13블록은 오래도록 목업 블록보다 얕았다 — 송선기호는 `----`, 하위 구성과 형상
 * 미리보기는 아예 없었다. 그래서 같은 화면에서 정반을 옮기면 상세 카드의 줄 수가 달라졌고,
 * 사용자는 그것을 "실측은 아직 덜 됐다"가 아니라 **화면이 고장 났다**로 읽는다.
 *
 * 값 자체는 mock 이어도 좋다(스캔이 못 주는 축이다). 그러나 **축의 집합은 계약**이다:
 * 목업 블록이 가진 필드를 실측 블록이 못 가지면 여기서 깨진다. 새 필드가 목업에만
 * 추가될 때도 마찬가지다 — 그것이 이 테스트의 재발 방지 몫이다.
 */

/** 목업 정반 하나 — 중조 분리 배치(assembly) 쪽이 필드가 가장 많다 */
const MOCK_LOCATION_ID = Object.keys(bayBlockAssignments)[0]

/** 이 detection 이 **실제로 값을 가진** 필드 이름들 — 없는 축은 이름조차 서지 않는다 */
function presentFields(block: LidarBlockInfo): Set<string> {
  return new Set(
    Object.entries(block)
      .filter(([, value]) => {
        if (value == null) return false
        if (Array.isArray(value)) return value.length > 0
        if (typeof value === 'string') return value.length > 0 && value !== '----'
        return true
      })
      .map(([key]) => key)
  )
}

describe('실측 블록 상세 = 목업 블록 상세 (필드 집합 동등)', () => {
  it('목업이 가진 필드를 실측 13블록이 전부 가진다', async () => {
    const mock = await fetchDetectedBlocks(MOCK_LOCATION_ID)
    const real = await fetchRealDetectedBlocks(REAL_LOCATION_ID)
    expect(mock.length).toBeGreaterThan(0)
    expect(real).toHaveLength(13)

    /* 목업 쪽 기준 집합 — 어느 detection 이든 가진 축의 합집합
       (정합 실패 데모 카드 한 장이 진척을 비우므로 합집합으로 잡는다) */
    const expected = new Set<string>()
    for (const block of mock) for (const field of presentFields(block)) expected.add(field)

    for (const block of real) {
      const fields = presentFields(block)
      const missing = [...expected].filter((field) => !fields.has(field))
      expect(missing, `${block.id} 에 없는 축: ${missing.join(', ')}`).toEqual([])
    }
  })

  it('송선기호가 파싱 가능한 4자리다 — 현공정→다음공정으로 읽힌다', async () => {
    for (const block of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      expect(block.wstgCode, block.id).toMatch(/^[A-Z]\d[A-Z]\d$/)
    }
  })

  it('하위 구성이 목업과 같은 문법이다 — 상태 3종·부재 수·진척 정합', async () => {
    for (const block of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const subs = block.subAssemblies ?? []
      expect(subs.length, `${block.id} 하위 구성 없음`).toBeGreaterThan(0)
      for (const sub of subs) {
        expect(sub.partCount).toBeGreaterThan(0)
        expect(['not_started', 'in_progress', 'completed']).toContain(sub.workStatus)
        /* 작업중일 때만 진척률을 가진다 — 목업과 같은 규칙 */
        if (sub.workStatus === 'in_progress') expect(sub.progress).toBeGreaterThan(0)
        else expect(sub.progress).toBeUndefined()
      }
    }
  })

  it('치수는 스캔 실측값이다 — 세 축 모두 양수', async () => {
    for (const block of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const { length, width, height } = block.dimensions
      expect(Math.min(length, width, height), block.id).toBeGreaterThan(0)
    }
  })
})

describe('실측 블록 상세 = 목업 블록 상세 (기능 동등 — 360° 미리보기)', () => {
  it('실측 정반도 미리보기 모델을 받는다 (예전에는 null 이라 카드가 비었다)', async () => {
    const model = await fetchBlockPreviewModel(REAL_LOCATION_ID)
    expect(model).not.toBeNull()
    expect(model!.manifest.assemblies).toHaveLength(13)
  })

  it('13블록의 modelAssemblyIds 가 모델에서 형상으로 풀린다 — 회전 미리보기가 그릴 것이 있다', async () => {
    const model = (await loadRealBlockModel()) as LoadedBlockModel
    for (const block of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const ids = block.modelAssemblyIds ?? []
      expect(ids.length, `${block.id} 형상 참조 없음`).toBeGreaterThan(0)

      /* AssemblyOrbitPreview 가 실제로 부르는 두 함수 — 여기서 비면 캔버스가 그려지지 않는다 */
      const soup = getMergedAssemblyPositions(model, ids)
      expect(soup.length, `${block.id} 형상 버퍼가 비었다`).toBeGreaterThan(0)
      expect(soup.length % 9).toBe(0) /* 삼각형(꼭짓점 3 × 좌표 3) 단위 */

      const rest = getRestPose(model, ids)
      expect(rest.restQuat).toHaveLength(4)
      /* 안착 자세가 실제로 눕힌다 — 높이(Y)가 가장 짧은 축이 된다 */
      const extent = (i: number) => rest.restBboxMax[i] - rest.restBboxMin[i]
      expect(extent(1)).toBeLessThanOrEqual(Math.max(extent(0), extent(2)))
    }
  })

  it('목업 정반의 미리보기 통로는 그대로다 (실측 통로를 더해도 회귀 없음)', async () => {
    const model = await fetchBlockPreviewModel(MOCK_LOCATION_ID)
    expect(model).not.toBeNull()
    for (const block of await fetchDetectedBlocks(MOCK_LOCATION_ID)) {
      const ids = block.modelAssemblyIds ?? []
      expect(getMergedAssemblyPositions(model!, ids).length).toBeGreaterThan(0)
    }
  })
})
