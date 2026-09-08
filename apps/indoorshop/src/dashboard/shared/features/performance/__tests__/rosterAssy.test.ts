import { describe, expect, it } from 'vitest'
import {
  blocksInZone,
  findBlock,
  listBlocks,
  sitesOfBlock,
  surfaceMatchPctOf,
} from '../../../entities/vessel'
import {
  fetchCollectionEvents,
  fetchPaintingSummary,
  generateAssyUnits,
} from '../api/performanceApi'
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

  /*
   * **구성(부모 관계)까지 같은가** (R34). 이름과 급만 맞춰서는 부족하다 — 로스터가
   * "S01 은 M01 안에 들어간다"고 말하는데 실적 카드가 그 소조를 다른 중조 밑에 그리면,
   * 두 화면이 같은 이름을 부르면서 다른 블록을 그리는 셈이 된다. 생성기가 로스터 트리를
   * 그대로 쓰는지(합성으로 되돌아가지 않았는지)를 여기서 잠근다.
   */
  it('부모 관계도 실적 목록과 같다 — 트리의 정본이 로스터 하나다', () => {
    let checked = 0
    for (const block of listBlocks()) {
      if (!block.assyUnits) continue
      const known = new Map(
        generateAssyUnits(block.projNo, block.blockNo, BASE).assys.map((a) => [a.assyNo, a])
      )
      for (const unit of block.assyUnits) {
        expect(known.get(unit.assyNo)!.parentAssyNo, unit.assyNo).toBe(unit.parentAssyNo)
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('깊이는 부모 사슬의 길이와 같다 — 카드 들여쓰기가 곧 귀속이다', () => {
    for (const block of listBlocks()) {
      if (!block.assyUnits) continue
      const parentOf = new Map(block.assyUnits.map((u) => [u.assyNo, u.parentAssyNo]))
      for (const assy of generateAssyUnits(block.projNo, block.blockNo, BASE).assys) {
        let depth = 0
        let cursor = parentOf.get(assy.assyNo) ?? null
        while (cursor != null) {
          depth += 1
          cursor = parentOf.get(cursor) ?? null
        }
        expect(assy.depth, assy.assyNo).toBe(depth)
      }
    }
  })

  it('대조가 여럿인 블록은 실적 카드에서도 루트가 여럿이다 (2540-283 · 2543-642)', () => {
    for (const [projNo, blockNo] of [['2540', '283'], ['2543', '642']] as const) {
      const roots = generateAssyUnits(projNo, blockNo, BASE).assys.filter(
        (a) => a.parentAssyNo == null
      )
      expect(roots.length, `${projNo}-${blockNo}`).toBe(2)
      /* 각 대조가 제 하위를 거느린다 — 루트만 둘이고 알맹이가 한쪽에 몰려 있으면
         "대조 둘"이 화면에서 뜻을 갖지 못한다 */
      for (const root of roots) expect(root.descendantCount, root.assyNo).toBeGreaterThan(0)
    }
  })
})

/**
 * **실측 인식 결과 ↔ 통합실적 판별 수치** (R31).
 *
 * 실측 정반의 블록을 통합실적에서 열었을 때 두 화면이 같은 말을 하는지. 스캔이 정합한
 * 덩이가 곧 판별 완료이고, 아직 안 붙은 상위가 지금 붙고 있는 자리다. 이 대응이 깨지면
 * 사용자는 실측 뷰에서 4건을 보고 통합실적에서 다른 수를 읽는다.
 *
 * (실측 자산 자체와의 대조 — 13덩이의 이름·오차가 데이터셋과 같은가 — 는 자산을 읽을 수
 * 있는 조립 쪽 `realRosterSync.test.ts` 가 한다. 여기서는 로스터 ↔ 생성기만 본다.)
 */
describe('실측 정합 ↔ 통합실적 판별', () => {
  const REAL_BLOCKS = [
    ['5510', '553'],
    ['5510', '726'],
    ['5510', '736'],
  ] as const

  it('정합된 덩이가 곧 판별 완료다 — 정합 건수와 판별 완료 수가 같다', () => {
    for (const [projNo, blockNo] of REAL_BLOCKS) {
      const scanned = (findBlock(projNo, blockNo)!.assyUnits ?? []).filter((u) => u.scan)
      const summary = generateAssyUnits(projNo, blockNo, BASE)
      const judged = summary.assys.filter((a) => a.judged === 'complete')
      expect(judged.map((a) => a.assyNo).sort(), `${projNo}-${blockNo}`).toEqual(
        scanned.map((u) => u.assyNo).sort()
      )
      expect(summary.assyJudged).toBe(scanned.length)
    }
  })

  it('정합 안 된 상위 하나만 진행 중이다 — 지금 정반에서 붙고 있는 덩이', () => {
    for (const [projNo, blockNo] of REAL_BLOCKS) {
      const summary = generateAssyUnits(projNo, blockNo, BASE)
      const partial = summary.assys.filter((a) => a.judged === 'partial')
      expect(partial.length, `${projNo}-${blockNo}`).toBe(1)
      /* 진행 중인 덩이는 정합되지 않은 것이다 — 정합된 것은 이미 완료다 */
      const unit = findBlock(projNo, blockNo)!.assyUnits!.find((u) => u.assyNo === partial[0].assyNo)
      expect(unit?.scan, partial[0].assyNo).toBeUndefined()
    }
  })

  it('실측 블록은 검사장으로 나가지 않는다 — 대조가 아직 안 섰다', () => {
    for (const [projNo, blockNo] of REAL_BLOCKS) {
      const summary = generateAssyUnits(projNo, blockNo, BASE)
      expect(summary.inspectionMoved, `${projNo}-${blockNo}`).toBe(false)
      expect(summary.assyDone).toBeLessThan(summary.assyTotal)
    }
  })

  it('판별 이벤트가 실측 정합 덩이마다 서고, 표면일치를 원천 문구에 적는다', async () => {
    for (const [projNo, blockNo] of REAL_BLOCKS) {
      const rows = (await fetchCollectionEvents(projNo, [blockNo], 'assembly', BASE)).filter(
        (row) => row.kind === 'asmJudged'
      )
      const byMgmtNo = new Map(rows.map((row) => [row.mgmtNo, row]))
      for (const unit of findBlock(projNo, blockNo)!.assyUnits ?? []) {
        if (!unit.scan) continue
        const row = byMgmtNo.get(unit.assyNo)
        expect(row, `${unit.assyNo} 판별 행이 없다`).toBeDefined()
        expect(row!.sources).toBe(`LiDAR 실측 정합 · 표면일치 ${surfaceMatchPctOf(unit.scan)}%`)
      }
    }
  })

  it('실측이 아닌 블록의 판별 행은 종전 문구 그대로다 (실측 문구가 번지지 않는다)', async () => {
    const rows = (await fetchCollectionEvents('7004', ['310'], 'assembly', BASE)).filter(
      (row) => row.kind === 'asmJudged'
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.sources).toBe('LiDAR 판별')
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
