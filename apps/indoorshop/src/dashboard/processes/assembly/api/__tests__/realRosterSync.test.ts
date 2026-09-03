import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  findBlock,
  scanMeshNameOf,
  scanConfidenceOf,
  type RosterBlock,
} from '../../../../shared/entities/vessel'
import { generateAssyUnits } from '../../../../shared/features/performance/api/performanceApi'
import { todayString } from '../../../../shared/features/performance/lib/baseDate'

/* 실측 자산은 fetch 로 오는 값이라 노드에서는 디스크로 갈음한다 (내용은 산출물 그대로) */
const ASSETS = resolve(__dirname, '../../../../../../../shell/public/real-scan')
vi.mock('../realScanAssets', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  const manifest = JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'latin1'))
  return { ...original, loadRealScanManifest: vi.fn(async () => manifest) }
})

const { fetchRealDetectedBlocks, REAL_LOCATION_ID } = await import('../realScanData')
const manifest = JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'latin1')) as {
  factory: { blocks: { name: string; fitErrorCm?: number }[] }
}

/**
 * **실측 데이터셋 ↔ 로스터 ↔ 통합실적이 한 몸인가** (R31 — 실측 1급 시민화).
 *
 * 사용자가 짚은 것은 "실측 블록에서 통합실적으로 가면 숫자가 어긋난다" 였다. 원인은
 * 실측이 2급 시민이었다는 것 — 정합된 13덩이가 로스터에 없어서 통합실적이 그 블록의
 * ASSY 를 해시로 지어냈고, 두 화면이 서로 모르는 이름과 수를 말했다.
 *
 * 이제 세 축이 한 줄로 이어진다:
 *   데이터셋(정합 결과) → 로스터(구성·정합 사실) → 통합실적(판별 실적) → 실측 뷰(표시)
 *
 * 이 검사가 조립 쪽에 사는 이유는 명확하다 — `shared` 는 실측 자산을 읽을 수 없다
 * (모듈 경계). 로스터가 옮겨 적은 값이 데이터셋과 어긋나면 여기서 깨진다.
 */
const REAL_BLOCKS = ['553', '726', '736'] as const
const rosterOf = (blockNo: string): RosterBlock => findBlock('5510', blockNo)!

describe('실측 데이터셋 ↔ 로스터 (정식 시민 등재)', () => {
  it('정합된 13덩이가 전부 로스터에 있다 — 데이터셋에만 있는 덩이가 없다', () => {
    const rostered = new Set(
      REAL_BLOCKS.flatMap((no) =>
        (rosterOf(no).assyUnits ?? []).filter((u) => u.scan).map((u) => scanMeshNameOf(u.assyNo))
      )
    )
    expect(rostered.size).toBe(13)
    for (const block of manifest.factory.blocks) {
      expect(rostered.has(block.name), `${block.name} 이 로스터에 없다`).toBe(true)
    }
    expect(manifest.factory.blocks).toHaveLength(rostered.size)
  })

  it('표면 정합 오차가 데이터셋 값 그대로다 — 옮겨 적은 값이 표류하지 않는다', () => {
    const byName = new Map(manifest.factory.blocks.map((b) => [b.name, b.fitErrorCm]))
    for (const blockNo of REAL_BLOCKS) {
      for (const unit of rosterOf(blockNo).assyUnits ?? []) {
        if (!unit.scan) continue
        expect(unit.scan.fitErrorCm, unit.assyNo).toBe(byName.get(scanMeshNameOf(unit.assyNo)))
      }
    }
  })

  it('로스터가 세운 계획 상위(대조·중조)는 데이터셋에 없다 — 없는 정합을 지어내지 않는다', () => {
    const scanned = new Set(manifest.factory.blocks.map((b) => b.name))
    for (const blockNo of REAL_BLOCKS) {
      for (const unit of rosterOf(blockNo).assyUnits ?? []) {
        if (unit.scan) continue
        expect(scanned.has(scanMeshNameOf(unit.assyNo)), unit.assyNo).toBe(false)
      }
    }
  })
})

describe('실측 뷰 ↔ 통합실적 (같은 수치를 말한다)', () => {
  const BASE = todayString()

  it('실측 뷰의 인식 블록 = 통합실적의 판별 완료 ASSY (건수·이름 모두)', async () => {
    const detections = await fetchRealDetectedBlocks(REAL_LOCATION_ID)
    for (const blockNo of REAL_BLOCKS) {
      const detected = detections
        .filter((d) => d.blkNo === blockNo)
        .map((d) => `5510-${blockNo}-${d.assySerNo}`)
        .sort()
      const judged = generateAssyUnits('5510', blockNo, BASE)
        .assys.filter((a) => a.judged === 'complete')
        .map((a) => a.assyNo)
        .sort()
      expect(judged, `5510-${blockNo}`).toEqual(detected)
    }
  })

  it('실측 뷰의 진척률 = 통합실적 그 ASSY 의 단독 판별률 (한 원천에서 나온다)', async () => {
    for (const detection of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const assyNo = `${detection.projNo}-${detection.blkNo}-${detection.assySerNo}`
      const assy = generateAssyUnits(detection.projNo, detection.blkNo, BASE).assys.find(
        (a) => a.assyNo === assyNo
      )
      expect(assy, assyNo).toBeDefined()
      expect(detection.history[0].progress, assyNo).toBe(assy!.selfRate)
    }
  })

  it('실측 뷰의 급이 통합실적 트리의 급과 같다 — 중조를 소조라 부르지 않는다', async () => {
    const noun: Record<string, string> = {
      grand: '대조립 블록',
      mid: '중조립품',
      sub: '소조립품',
    }
    for (const detection of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const assyNo = `${detection.projNo}-${detection.blkNo}-${detection.assySerNo}`
      const assy = generateAssyUnits(detection.projNo, detection.blkNo, BASE).assys.find(
        (a) => a.assyNo === assyNo
      )!
      expect(detection.blockName, assyNo).toBe(`${noun[assy.tier]} ${detection.assySerNo}`)
    }
  })

  it('표면일치 환산이 한 곳이다 — 뷰어 신뢰도와 로스터 정합 오차가 같은 식으로 이어진다', async () => {
    for (const detection of await fetchRealDetectedBlocks(REAL_LOCATION_ID)) {
      const unit = rosterOf(detection.blkNo).assyUnits!.find(
        (u) => u.assyNo === `${detection.projNo}-${detection.blkNo}-${detection.assySerNo}`
      )!
      expect(detection.confidence, unit.assyNo).toBe(scanConfidenceOf(unit.scan!.fitErrorCm))
    }
  })
})
