import { describe, expect, it } from 'vitest'
import { listBlocks, pcdHrefOfAssy } from '../../../../shared/entities/vessel'
import { bayBlockAssignments, mockLocations } from '../mockAssemblyData'

/**
 * 통합실적 'PCD 뷰' 의 조립 착지 (W8-3) — 링크가 가리키는 정반이 **실제로 존재**하고,
 * CAD 정반이면 그 장면의 블록 신원이 승계 키(`?block={proj}-{blk}`)와 이어지는지.
 *
 * 장면 자체는 loadBlockModel(fetch 자산)이 필요해 노드에서 못 세운다 — 대신 장면의
 * 신원 원천(bayBlockAssignments)과 대조한다: 배정의 projNo/blkNo 가 곧 그 정반
 * detection 들의 projNo/blkNo 다(`buildBayDetections`).
 */
describe('조립 PCD 착지', () => {
  const locationIds = new Set(mockLocations.map((location) => location.id))

  it('링크의 정반은 전부 실존한다 — 없는 정반으로 보내지 않는다', () => {
    for (const block of listBlocks()) {
      for (const unit of block.assyUnits ?? []) {
        const href = pcdHrefOfAssy(unit.assyNo)
        if (!href) continue
        const bayId = href.replace('/indoorshop', '').split('/')[4].split('?')[0]
        expect(locationIds.has(bayId), `${unit.assyNo} → ${bayId}`).toBe(true)
      }
      if (block.zone === 'assembly' && block.berth) {
        expect(locationIds.has(block.berth.bayId), block.berth.bayId).toBe(true)
      }
    }
  })

  it('CAD 정반 착지는 승계 키와 장면 블록 신원이 같다 — 도착하면 그 블록이 선택된다', () => {
    let checked = 0
    for (const block of listBlocks()) {
      if (block.zone !== 'assembly' || !block.berth?.hasCadModel) continue
      const href = pcdHrefOfAssy(`${block.projNo}-${block.blockNo}-S01`)
      expect(href, `${block.projNo}-${block.blockNo}`).not.toBeNull()
      const assignment = bayBlockAssignments[block.berth.bayId]
      expect(assignment, block.berth.bayId).toBeTruthy()
      /* 승계 키 = `{proj}-{blk}` = 장면 detection 의 projNo-blkNo */
      expect(`${assignment.projNo}-${assignment.blkNo}`).toBe(`${block.projNo}-${block.blockNo}`)
      checked += 1
    }
    expect(checked).toBeGreaterThan(0)
  })
})
