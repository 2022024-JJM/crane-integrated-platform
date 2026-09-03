import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { findBlock, listBlocks, performanceLinkFor } from '../../../../shared/entities/vessel'

/* manifest 는 fetch 자산이라 노드에서는 디스크로 갈음한다 (내용은 실제 산출물 그대로) */
const ASSETS = resolve(__dirname, '../../../../../../../shell/public/real-scan')
vi.mock('../realScanAssets', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const manifest = JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'utf8'))
  return { ...original, loadRealScanManifest: vi.fn(async () => manifest) }
})

const { fetchRealDetectedBlocks, fetchRealLidarSensors, REAL_LOCATION_ID } = await import(
  '../realScanData'
)

/**
 * **실측 블록의 데이터 깊이** (P9·P10, W9-0 진단 §5).
 *
 * 목업 베이와 나란히 놓고 비교하려면 실측 베이도 같은 축을 말해야 한다 — 진척·계획이
 * 비면 화면에서 그 줄이 통째로 사라져 두 베이가 다른 문법이 된다. 값 자체는 mock 이지만
 * (스캔이 못 주는 축이다) **축의 존재**는 계약이다.
 */
describe('실측 인식 블록 — 목업과 같은 축을 갖춘다', () => {
  it('13블록 전부 진척률과 계획을 갖는다 (P10 — 없으면 진척 바·계획 줄이 사라진다)', async () => {
    const blocks = await fetchRealDetectedBlocks(REAL_LOCATION_ID)
    expect(blocks).toHaveLength(13)
    for (const block of blocks) {
      const latest = block.history.find((event) => typeof event.progress === 'number')
      expect(latest?.progress, `${block.id} 진척 없음`).toBeGreaterThan(0)
      expect(block.plan, `${block.id} 계획 없음`).toBeTruthy()
      expect(block.plan!.planStartDate < block.plan!.planEndDate).toBe(true)
    }
  })

  it('진척 추이가 단조 증가다 — 최신이 가장 높다', async () => {
    for (const block of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const series = block.history
        .map((event) => event.progress)
        .filter((p): p is number => typeof p === 'number')
      expect(series.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < series.length; i++) expect(series[i]).toBeLessThanOrEqual(series[i - 1])
    }
  })

  it('결정론 — 같은 블록은 늘 같은 진척·계획', async () => {
    const a = await fetchRealDetectedBlocks(REAL_LOCATION_ID)
    const b = await fetchRealDetectedBlocks(REAL_LOCATION_ID)
    expect(a.map((x) => [x.id, x.history[0].progress, x.plan])).toEqual(
      b.map((x) => [x.id, x.history[0].progress, x.plan])
    )
  })

  /*
   * 낱말은 목업과 같은 것을 쓰되, **급은 로스터가 정한다**(R31). 예전에는 `assySerNo`
   * 유무만 보고 중조/대조 둘로 갈랐는데 실측 13덩이는 전부 일련번호를 가져 모두
   * '중조립품' 이 됐다 — 통합실적 트리가 같은 덩이를 '소조'라 부르는데도 그랬다.
   * 이제 세 급(대조립 블록·중조립품·소조립품)이 다 설 수 있고, 그 급은 통합실적 카드가
   * 부르는 급과 같다(같은 원천을 읽으므로 어긋날 수 없다).
   */
  it('블록 이름이 목업과 같은 낱말이다 — 같은 것을 다르게 부르지 않는다', async () => {
    for (const block of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      expect(block.blockName).toMatch(/^(소조립품|중조립품|대조립 블록) /)
      expect(block.blockName).not.toContain('실측 정합 블록')
    }
  })
})

describe('실측 센서 — 상태 축이 살아 있다', () => {
  it('12대 전부 online 으로 못박혀 있지 않다 (P10 — 목업은 오류를 섞는다)', async () => {
    const sensors = await fetchRealLidarSensors(REAL_LOCATION_ID)
    expect(sensors).toHaveLength(12)
    expect(new Set(sensors.map((s) => s.status)).size).toBeGreaterThan(1)
  })

  it('결정론 — 같은 센서는 늘 같은 상태', async () => {
    const a = await fetchRealLidarSensors(REAL_LOCATION_ID)
    const b = await fetchRealLidarSensors(REAL_LOCATION_ID)
    expect(a.map((s) => s.status)).toEqual(b.map((s) => s.status))
  })
})

describe('실측 블록의 로스터 신원 (P9)', () => {
  it('스캔이 정합한 세 블록이 로스터에 있다 — 통합실적·검색·지도가 같은 이름을 부른다', async () => {
    const blocks = await fetchRealDetectedBlocks(REAL_LOCATION_ID)
    const groups = [...new Set(blocks.map((b) => `${b.projNo}-${b.blkNo}`))]
    expect(groups.sort()).toEqual(['5510-553', '5510-726', '5510-736'])
    for (const key of groups) {
      const [projNo, blockNo] = key.split('-')
      expect(findBlock(projNo, blockNo), `${key} 가 로스터에 없다`).toBeTruthy()
    }
  })

  it('실측 베이에는 mock 정반 배정이 없다 — 기존 불변식을 지킨다', () => {
    for (const block of listBlocks()) {
      if (block.projNo !== '5510') continue
      expect(block.berth, `${block.blockNo} 에 정반 배정이 붙었다`).toBeUndefined()
      expect(block.factory).toBe('PBS')
      expect(block.mapBay).toBe('5')
    }
  })

  it('복수 블록을 한 번에 통합실적으로 보낼 수 있다 (D1)', () => {
    const href = performanceLinkFor({ projNo: '5510', blocks: ['553', '726', '736'] })
    expect(href).toContain('vessel=5510')
    expect(href).toMatch(/block=553%2C726%2C736|block=553,726,736/)
  })
})
