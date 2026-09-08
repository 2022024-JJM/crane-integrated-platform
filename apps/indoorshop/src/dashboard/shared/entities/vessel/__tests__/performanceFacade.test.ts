import { describe, expect, it } from 'vitest'
import { blocksOfVessel, findBlock, listVessels } from '../lib/roster'
import { fetchBlocks, fetchVessels } from '../../../features/performance/api/performanceApi'

/**
 * 통합실적 파사드가 로스터를 **그대로** 낸다 — 제 호선 목록을 따로 들고 있지 않다.
 * (공정별 mock 과의 대조는 각 공정의 `rosterConsistency.test.ts` 가 맡는다 — shared 는
 * 공정을 알 수 없으므로 검사도 그쪽에 둔다.)
 */
describe('통합실적 파사드 ↔ 로스터', () => {
  it('호선 목록이 로스터와 같다', async () => {
    expect(await fetchVessels()).toEqual(listVessels())
  })

  it('호선의 블록 목록이 로스터와 같다 (조립·의장을 가리지 않는다)', async () => {
    for (const vessel of listVessels()) {
      const options = await fetchBlocks(vessel.projNo)
      expect(options.map((o) => o.blockNo)).toEqual(
        blocksOfVessel(vessel.projNo).map((b) => b.blockNo)
      )
    }
  })

  it('공장 라벨이 로스터와 같다 — `?factory=` 딥링크 키가 어긋나지 않는다', async () => {
    for (const vessel of listVessels()) {
      for (const option of await fetchBlocks(vessel.projNo)) {
        expect(findBlock(vessel.projNo, option.blockNo)!.factory).toBe(option.factory)
      }
    }
  })

  it('없는 호선은 빈 목록 (화면이 지어낸 블록을 보여 주지 않는다)', async () => {
    expect(await fetchBlocks('0000')).toEqual([])
  })
})
