import { describe, expect, it } from 'vitest'
import { blocksAtOutfittingFactory, blocksInZone, listBlocks } from '../shared/entities/vessel'
import { mockBlocks } from '../processes/outfitting/api/mockOutfittingData'
import {
  fetchAssemblySummary,
  generatePaintingSteps,
  generateParts,
} from '../shared/features/performance/api/performanceApi'
import { FAB_STAGES } from '../shared/features/performance/model/types'
import { todayString } from '../shared/features/performance/lib/baseDate'

/**
 * **의장 ↔ 도장 순서 불변식** (W7-6F, 사용자 확정) — 한 블록이 두 공정에 동시에 서지 않는다.
 *
 * 자리가 `src/__tests__` 인 이유: 의장 화면이 실제로 그리는 목록(`mockOutfittingData`)까지
 * 봐야 하는 검사라, 통합실적(shared) 안에 두면 모듈 경계(shared 는 공정을 모른다)를 어긴다.
 * 공정을 가로지르는 검사가 설 자리는 여기뿐이다.
 *
 * 가공 100% ← 의장 이상 게이트는 shared 만으로 검사할 수 있어
 * `shared/features/performance/__tests__/processOrder.test.ts` 에 남는다.
 */
const TODAY = todayString()

/** 이 블록의 가공이 전량 완료인가 — 미대상(분모 제외)은 세지 않는다 */
function fabFullyDone(projNo: string, blockNo: string, baseDate: string): boolean {
  return generateParts(projNo, blockNo, baseDate).every((part) =>
    FAB_STAGES.every((stage) => {
      const status = part.statuses[stage]
      return status === 'done' || status === 'excluded'
    })
  )
}

describe('의장 ↔ 도장 순서 — 한 블록이 두 공정에 동시에 서지 않는다', () => {
  /*
   * 의장에는 절점이 없다(설치 판별 단건 수집뿐). 그래서 '의장 완료' 를 절점으로 말할 수
   * 없고, **재공 목록에서 빠졌다는 사실**이 그 자리를 대신한다. 도장 블록이 의장 재공에
   * 남아 있으면 그 블록은 의장을 끝내지도 않고 도장에 가 있는 셈이 된다.
   */
  const OUTFITTING_FACTORY_IDS = [
    ...new Set(listBlocks().flatMap((b) => (b.outfitting ? [b.outfitting.factoryId] : []))),
  ]

  it('도장 단계 블록은 어느 의장 공장의 재공 목록에도 없다', () => {
    const paintingKeys = new Set(
      blocksInZone('painting').map((b) => `${b.projNo}-${b.blockNo}`)
    )
    const leaked: string[] = []
    for (const factoryId of OUTFITTING_FACTORY_IDS) {
      for (const block of blocksAtOutfittingFactory(factoryId)) {
        const key = `${block.projNo}-${block.blockNo}`
        if (paintingKeys.has(key)) leaked.push(`${key} @${factoryId}`)
      }
    }
    expect(leaked).toEqual([])
  })

  it('의장 화면이 그리는 블록도 마찬가지다 — 목록의 끝단까지 새지 않는다', () => {
    const paintingKeys = new Set(
      blocksInZone('painting').map((b) => `${b.projNo}-${b.blockNo}`)
    )
    const leaked = mockBlocks
      .map((b) => `${b.projNo}-${b.blkNo}`)
      .filter((key) => paintingKeys.has(key))
    expect(leaked).toEqual([])
  })

  it('재공 목록은 지금 그 공정에 선 블록만 낸다 — 배정만으로 서지 않는다', () => {
    for (const factoryId of OUTFITTING_FACTORY_IDS) {
      for (const block of blocksAtOutfittingFactory(factoryId)) {
        expect(`${block.projNo}-${block.blockNo} zone=${block.zone}`).toBe(
          `${block.projNo}-${block.blockNo} zone=outfitting`
        )
      }
    }
  })

  it('도장 블록은 의장을 거쳐 온 것으로 앞뒤가 맞는다 — 가공·조립·검사장·반입이 다 찍혀 있다', async () => {
    const broken: string[] = []
    for (const block of blocksInZone('painting')) {
      const { projNo, blockNo } = block
      const asm = await fetchAssemblySummary(projNo, blockNo, TODAY)
      const pnt = generatePaintingSteps(projNo, blockNo, TODAY)
      if (!fabFullyDone(projNo, blockNo, TODAY)) broken.push(`${projNo}-${blockNo}: 가공 미완`)
      if (asm.assyDone < asm.assyTotal) broken.push(`${projNo}-${blockNo}: 조립 미완`)
      if (!asm.inspectionMoved) broken.push(`${projNo}-${blockNo}: 검사장 미이동`)
      if (pnt.phase === 'beforeIn') broken.push(`${projNo}-${blockNo}: 도장 반입 전`)
      if (pnt.btsInDate == null) broken.push(`${projNo}-${blockNo}: BTS 반입일 없음`)
    }
    expect(broken).toEqual([])
  })
})
