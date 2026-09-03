import { describe, expect, it } from 'vitest'
import { blocksInZone, listBlocks, sitesOfBlock } from '../../../entities/vessel'
import { fetchPaintingSummary, generateAssyUnits } from '../api/performanceApi'
import { findAssyViolations } from '../model/aggregate'

const BASE = '2026-09-02'

/**
 * **지도와 실적이 같은 이름을 부르는지.**
 *
 * 로스터는 ASSY 소재(어느 공장에 어느 ASSY 가 있나)를 들고 지도 마커를 세우고, 통합실적은
 * 같은 블록의 ASSY 목록을 따로 생성한다. 두 쪽이 다른 번호를 쓰면 지도에서 본 ASSY 를
 * 실적 화면에서 찾을 수 없다 — 그 일치를 여기서 잠근다.
 *
 * (검사가 이쪽에 사는 이유: 엔티티는 화면 feature 를 알 수 없다. 대조는 아는 쪽이 한다.)
 */
describe('로스터 ASSY 소재 ↔ 통합실적 ASSY 목록', () => {
  it('로스터에 적힌 ASSY_NO 는 전부 그 블록의 실적 ASSY 목록에 있다', () => {
    let checked = 0
    for (const block of listBlocks()) {
      if (!block.assyUnits) continue
      const known = new Map(
        generateAssyUnits(block.projNo, block.blockNo, BASE).assys.map((a) => [a.assyNo, a])
      )
      for (const unit of block.assyUnits) {
        expect(known.has(unit.assyNo), `${block.projNo}-${block.blockNo}: ${unit.assyNo}`).toBe(true)
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('급(tier)도 실적 목록과 같다 — 대조를 소조라 부르지 않는다', () => {
    for (const block of listBlocks()) {
      if (!block.assyUnits) continue
      const known = new Map(
        generateAssyUnits(block.projNo, block.blockNo, BASE).assys.map((a) => [a.assyNo, a])
      )
      for (const unit of block.assyUnits) {
        expect(known.get(unit.assyNo)!.tier, unit.assyNo).toBe(unit.tier)
      }
    }
  })

  it('ASSY 소재를 적은 블록은 그 블록의 ASSY 를 하나도 빠뜨리지 않는다', () => {
    for (const block of listBlocks()) {
      if (!block.assyUnits) continue
      const all = generateAssyUnits(block.projNo, block.blockNo, BASE).assys.map((a) => a.assyNo)
      expect([...block.assyUnits.map((u) => u.assyNo)].sort()).toEqual([...all].sort())
    }
  })
})

/**
 * **지도 도장 마커 ↔ 실적 도장 카드가 같은 공장을 말하는지.**
 * 같은 블록을 두고 지도는 느태, 카드는 텍사코라 하면 어느 쪽도 못 믿는다.
 */
describe('로스터 도장 귀속 ↔ 통합실적 도장 카드', () => {
  it('도장 중인 블록은 실적도 그 공장에 있다고 말한다', async () => {
    const painting = blocksInZone('painting')
    expect(painting.length).toBeGreaterThan(0)
    for (const block of painting) {
      const summary = await fetchPaintingSummary(block.projNo, block.blockNo, BASE)
      expect(summary.phase, `${block.projNo}-${block.blockNo}`).toBe('inShop')
      expect(summary.factory).toBe(block.factory)
    }
  })

  it('도장 자리 마커의 공장도 같다 (지도가 읽는 값과 카드가 읽는 값이 한 곳에서 온다)', async () => {
    for (const block of blocksInZone('painting')) {
      const summary = await fetchPaintingSummary(block.projNo, block.blockNo, BASE)
      expect(sitesOfBlock(block)[0].factory).toBe(summary.factory)
    }
  })

  it('전이 중 블록의 도장 자리도 실제 도장공장 이름이다', () => {
    for (const block of listBlocks()) {
      for (const site of sitesOfBlock(block)) {
        if (site.zone !== 'painting') continue
        expect(site.factory).toMatch(/도장공장|GPS/)
      }
    }
  })
})

/**
 * **매칭 캐스케이드가 화면에서 다 보이는지.** 상태 셋을 다 그리게 만들어 놓고 더미가
 * 둘만 낸다면 화면의 한 갈래는 죽은 코드가 된다 — 특히 불일치는 노티 대상이라
 * 표본이 없으면 그 사정을 아무도 못 본다.
 */
describe('매칭 캐스케이드 더미 — 세 상태가 다 재현된다', () => {
  const BASE_DATE = '2026-09-03'
  const summaries = listBlocks().map((b) => ({
    block: b,
    summary: generateAssyUnits(b.projNo, b.blockNo, BASE_DATE),
  }))

  it('매칭됨 · 4주 폴백 · 불일치가 모두 로스터 안에 있다', () => {
    const total = summaries.reduce(
      (acc, { summary }) => ({
        matched: acc.matched + summary.match.matched,
        fallback: acc.fallback + summary.match.fallback,
        unmatched: acc.unmatched + summary.match.unmatched,
      }),
      { matched: 0, fallback: 0, unmatched: 0 }
    )
    expect(total.matched).toBeGreaterThan(0)
    expect(total.fallback).toBeGreaterThan(0)
    expect(total.unmatched).toBeGreaterThan(0)
  })

  it('불일치를 가진 블록이 여럿이다 — 한 건뿐이면 그 블록을 지우는 순간 시나리오가 사라진다', () => {
    const withUnmatched = summaries.filter(({ summary }) => summary.match.unmatched > 0)
    expect(withUnmatched.length).toBeGreaterThanOrEqual(2)
  })

  it('전량 판별 완료 블록에는 미해결 불일치가 없다 — 불일치가 남으면 블록이 안 닫힌다', () => {
    for (const { block, summary } of summaries) {
      if (summary.assyJudged !== summary.assyTotal) continue
      expect(summary.match.unmatched, `${block.projNo}-${block.blockNo}`).toBe(0)
      expect(summary.assyDone).toBe(summary.assyTotal)
    }
  })

  it('불일치 블록은 검사장으로 넘어가지 않는다 (완료 처리 금지의 블록 레벨 귀결)', () => {
    for (const { block, summary } of summaries) {
      if (summary.match.unmatched === 0) continue
      expect(summary.inspectionMoved, `${block.projNo}-${block.blockNo}`).toBe(false)
    }
  })

  it('로스터 전 블록이 판별 축 정합 규칙을 지킨다', () => {
    for (const { block, summary } of summaries) {
      expect(findAssyViolations(summary), `${block.projNo}-${block.blockNo}`).toEqual([])
    }
  })
})
