import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deviationCutoff } from '../realScanAssets'
import type { RealSceneMeta } from '../realScanAssets'

/**
 * **임계 재판정 계약** (P5~P7, W9-0 진단 §6).
 *
 * 점별 CAD 편차(`factory_dev.bin`)가 자산에 이미 있어, 임계를 낮추는 재판정은 최근접
 * 재계산 없이 바이트 비교로 끝난다. 그 전제가 깨지면(자산 미생성·길이 불일치·양자화
 * 기준 변경) 화면의 슬라이더가 조용히 거짓말을 하므로 여기서 잠근다.
 */
const ASSETS = resolve(__dirname, '../../../../../../../shell/public/real-scan')
const manifest = JSON.parse(readFileSync(`${ASSETS}/manifest.json`, 'utf8')) as {
  factory: RealSceneMeta
}
const meta = manifest.factory

describe('편차 자산 — 임계 슬라이더의 전제', () => {
  it('점별 편차 bin 이 존재하고 점 수와 길이가 같다', () => {
    const dev = readFileSync(`${ASSETS}/${meta.deviations}`)
    expect(dev.length).toBe(meta.pointCount)
    /* 라벨·음영과도 같은 길이여야 같은 변환 실행본이다 */
    expect(readFileSync(`${ASSETS}/${meta.labels}`).length).toBe(meta.pointCount)
    expect(readFileSync(`${ASSETS}/${meta.shade}`).length).toBe(meta.pointCount)
  })

  it('편차는 자산 허용오차 기준으로 양자화돼 있다 — 그래서 낮추는 방향만 가능하다', () => {
    expect(meta.segmentation.toleranceM).toBeGreaterThan(0)
    /* 상한(=자산 허용오차)에서 컷오프가 255 로 포화 → 그 위로는 더 넓힐 정보가 없다 */
    expect(deviationCutoff(meta.segmentation.toleranceM, meta)).toBe(255)
    expect(deviationCutoff(meta.segmentation.toleranceM * 2, meta)).toBe(255)
    /* 절반이면 절반 */
    expect(deviationCutoff(meta.segmentation.toleranceM / 2, meta)).toBe(128)
    expect(deviationCutoff(0, meta)).toBe(0)
  })
})

describe('임계를 낮추면 정합 점이 단조 감소한다', () => {
  const labels = new Uint8Array(readFileSync(`${ASSETS}/${meta.labels}`))
  const dev = new Uint8Array(readFileSync(`${ASSETS}/${meta.deviations}`))
  const blockCount = meta.blocks.length

  /** 뷰어 `countByLabel` 과 같은 판정 — 라벨이 있어도 편차가 넘으면 미정합 */
  const matchedAt = (cutoff: number) => {
    let matched = 0
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i]
      if (l < blockCount && dev[i] <= cutoff) matched++
    }
    return matched
  }

  /** 5cm 부터 자산 허용오차까지 5cm 간격 — 상한은 자산이 정한다(재생성해도 따라간다) */
  const topCm = Math.round(meta.segmentation.toleranceM * 100)
  const steps = Array.from({ length: topCm / 5 }, (_, i) => (i + 1) * 5)

  it('넓힐수록 정합 점 수가 늘고, 자산 상한에서 라벨 총수와 같아진다', () => {
    const series = steps.map((cm) => matchedAt(deviationCutoff(cm / 100, meta)))
    for (let i = 1; i < series.length; i++) {
      expect(series[i], `${steps[i]}cm 구간이 줄었다`).toBeGreaterThanOrEqual(series[i - 1])
    }
    /* 자산 허용오차(=상한)에서는 manifest 의 라벨 총수와 일치해야 한다 */
    expect(series[series.length - 1]).toBe(meta.labeledPointCount)
    /* 빡빡하게 보면 실제로 줄어든다 — 슬라이더가 아무 일도 안 하는 것이 아니다 */
    expect(series[0]).toBeLessThan(series[series.length - 1] * 0.6)
  })

  it('5cm 간격이 전부 서로 다른 값이다 — 60cm 로 넓혀도 양자화가 정밀도를 먹지 않는다', () => {
    const series = steps.map((cm) => matchedAt(deviationCutoff(cm / 100, meta)))
    expect(new Set(series).size, `${steps.length}구간 중 중복이 있다`).toBe(series.length)
  })

  it('자산이 R23 이후 60cm 기준으로 생성돼 있다 — 슬라이더 상한의 근거', () => {
    expect(meta.segmentation.toleranceM).toBeCloseTo(0.6, 6)
  })

  it('바닥·미분류 점은 임계와 무관하다 — 임계는 블록 라벨에만 걸린다', () => {
    let floor = 0
    for (const l of labels) if (l === 254) floor++
    expect(floor).toBe(meta.floorPointCount)
  })
})
