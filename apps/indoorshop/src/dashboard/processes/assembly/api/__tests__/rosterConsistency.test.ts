import { describe, expect, it } from 'vitest'
import { blockAtBay, blocksWithCadModel, findBlock } from '../../../../shared/entities/vessel'
import { fetchBlocks, fetchBlockSummary } from '../../../../shared/features/performance/api/performanceApi'
import { bayBlockAssignments, mockLocations } from '../mockAssemblyData'

const BASE = '2026-09-02'

/**
 * **화면 사이의 계약** — 조립 정반에 앉은 블록이 통합실적에서 같은 이름·같은 공장으로
 * 조회되는지. 조립이 제 호선번호를 지어내던 시절(2540·2543…이 통합실적 어디에도 없던
 * 시절)에는 아래 단언이 하나도 성립하지 않았다.
 *
 * 검사는 조립 쪽에 둔다 — shared 에 두면 shared 가 공정을 알게 되어 모듈 경계를 깬다.
 */
describe('조립 정반 ↔ 로스터', () => {
  it('정반에 앉은 블록은 전부 로스터 블록이다', () => {
    for (const [bayId, assignment] of Object.entries(bayBlockAssignments)) {
      const block = findBlock(assignment.projNo, assignment.blkNo)
      expect(block, `${bayId}: ${assignment.projNo}-${assignment.blkNo}`).toBeTruthy()
      expect(block).toBe(blockAtBay(bayId))
    }
  })

  it('로스터의 CAD 블록이 하나도 빠지지 않고 정반에 배정된다 (양방향 일치)', () => {
    const assigned = new Set(
      Object.values(bayBlockAssignments).map((a) => `${a.projNo}-${a.blkNo}`)
    )
    for (const block of blocksWithCadModel()) {
      expect(assigned.has(`${block.projNo}-${block.blockNo}`)).toBe(true)
    }
    expect(assigned.size).toBe(blocksWithCadModel().length)
  })

  it('인식 단위(unitLevel)를 로스터와 조립이 같게 말한다', () => {
    for (const block of blocksWithCadModel()) {
      expect(bayBlockAssignments[block.berth!.bayId].unitLevel).toBe(block.berth!.unitLevel)
    }
  })

  it('재실 정반은 로스터가 그 정반에 놓은 블록을 보여 준다', () => {
    const occupied = mockLocations.filter((l) => l.projNo && l.blkNo)
    expect(occupied.length).toBeGreaterThan(0)
    for (const location of occupied) {
      const block = blockAtBay(location.id)
      expect(block, location.id).toBeTruthy()
      expect(block!.projNo).toBe(location.projNo)
      expect(block!.blockNo).toBe(location.blkNo)
    }
  })
})

describe('조립 정반 ↔ 통합실적', () => {
  it('대시보드 정반 목록의 호선·블록이 통합실적 필터에서 조회된다', async () => {
    for (const location of mockLocations.filter((l) => l.projNo && l.blkNo)) {
      const options = await fetchBlocks(location.projNo!)
      expect(
        options.some((o) => o.blockNo === location.blkNo),
        `${location.id}: ${location.projNo}-${location.blkNo}`
      ).toBe(true)
    }
  })

  it('그 블록의 통합실적 요약이 로스터와 같은 공장을 말한다', async () => {
    for (const block of blocksWithCadModel()) {
      const summary = await fetchBlockSummary(block.projNo, block.blockNo, BASE)
      expect(summary.projNo).toBe(block.projNo)
      expect(summary.blockNo).toBe(block.blockNo)
      expect(summary.factory).toBe(block.factory)
    }
  })
})
