import { describe, expect, it } from 'vitest'
import { blocksInZone, findBlock } from '../../../../shared/entities/vessel'
import { fetchBlocks } from '../../../../shared/features/performance/api/performanceApi'
import { mockBlocks } from '../mockOutfittingData'

/**
 * **화면 사이의 계약** — 의장 화면의 블록이 통합실적에서 같은 이름으로 조회되는지.
 * 의장이 제 호선 풀(5510·2698…)로 블록을 지어내던 시절에는 성립하지 않았다.
 */
describe('선행의장 ↔ 로스터', () => {
  it('의장 화면의 블록은 전부 로스터 블록이고, 구역·공장이 로스터와 같다', () => {
    expect(mockBlocks.length).toBeGreaterThan(0)
    for (const block of mockBlocks) {
      const roster = findBlock(block.projNo, block.blkNo)
      expect(roster, `${block.id}: ${block.projNo}-${block.blkNo}`).toBeTruthy()
      expect(roster!.outfitting?.factoryId).toBe(block.factoryId)
      expect(roster!.outfitting?.areaCode).toBe(block.areaCode)
    }
  })

  it('로스터의 의장 블록이 하나도 빠지지 않고 화면에 선다 (양방향 일치)', () => {
    const shown = new Set(mockBlocks.map((b) => `${b.projNo}-${b.blkNo}`))
    for (const block of blocksInZone('outfitting')) {
      expect(shown.has(`${block.projNo}-${block.blockNo}`)).toBe(true)
    }
    expect(shown.size).toBe(blocksInZone('outfitting').length)
  })

  it('블록 id 는 유일하다 (같은 구역에 여럿이 서도 겹치지 않는다)', () => {
    const ids = mockBlocks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('의장 블록도 통합실적에서 조회된다 — 공정이 달라도 한 우주다', async () => {
    for (const block of mockBlocks) {
      const options = await fetchBlocks(block.projNo)
      expect(options.some((o) => o.blockNo === block.blkNo)).toBe(true)
    }
  })
})
