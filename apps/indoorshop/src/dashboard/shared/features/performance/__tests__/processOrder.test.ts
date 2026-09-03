import { describe, expect, it } from 'vitest'
import { blocksInZone, listBlocks } from '../../../entities/vessel'
import {
  fetchAssemblySummary,
  fetchFabricationStages,
  generateParts,
} from '../api/performanceApi'
import { FAB_STAGES } from '../model/types'
import { shiftDate, todayString } from '../lib/baseDate'

/**
 * **공정 순서 불변식 — 가공 100% ← 의장 이상** (W7-6F, 사용자 확정).
 *
 * 상식이다: 블록이 선행의장 공장에 서 있다면 가공은 이미 끝났다. 부재를 다 자르지도
 * 않고 조립을 마쳐 의장으로 넘어갈 수는 없다. 그런데 더미는 가공 수위를 해시로만 뽑아서,
 * 의장·도장 공장에 서 있는 블록이 '가공 62%' 로 나올 수 있었다 — 화면 세 곳이 한 블록을
 * 두고 서로 다른 이야기를 하는 것이고, 그걸 본 사람은 어느 쪽을 믿을지 알 수 없다.
 *
 * **겹침은 허용한다.** 조립 단계 블록은 가공이 아직 끝나지 않았을 수 있다 — 부재가
 * 순차로 올라오는 동안 앞선 부재로 조립을 시작하는 것이 정상이기 때문이다. 그래서
 * 이 파일은 "언제나 100%" 가 아니라 **"의장 이상이면 100%"** 만 잠근다. 겹침 표본이
 * 사라지는 것도 함께 막는다 — 게이트를 세게 걸어 전부 100% 로 만들면 그건 다른 거짓말이다.
 *
 * 기준일 되감기(W7-2)와도 맞물린다: 과거 시점에 의장이었다면 **그 시점의** 가공이 100%
 * 여야 한다. 되감기는 가공과 조립을 서로 다른 속도로 되돌리므로(부재 2~4일 / ASSY 3~7일)
 * 게이트가 오늘만 보고 있으면 과거 어느 날에 어긋난다.
 */
const TODAY = todayString()

/** 로스터 전체 — 블록마다 (호선, 블록) */
const ALL_BLOCKS = listBlocks().map((b) => [b.projNo, b.blockNo] as const)

/** 이 블록의 가공이 전량 완료인가 — 미대상(분모 제외)은 세지 않는다 */
function fabFullyDone(projNo: string, blockNo: string, baseDate: string): boolean {
  return generateParts(projNo, blockNo, baseDate).every((part) =>
    FAB_STAGES.every((stage) => {
      const status = part.statuses[stage]
      return status === 'done' || status === 'excluded'
    })
  )
}

describe('의장 이상 단계 블록 — 가공은 이미 끝나 있다', () => {
  it('오늘 기준: 의장·도장 블록의 가공 S1~S5 가 전부 완료다', () => {
    const violations: string[] = []
    for (const zone of ['outfitting', 'painting'] as const) {
      for (const block of blocksInZone(zone)) {
        if (!fabFullyDone(block.projNo, block.blockNo, TODAY)) {
          violations.push(`${block.projNo}-${block.blockNo} (${zone})`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('집계 화면에서도 100% 다 — 단계별 실적률이 전부 100', async () => {
    const violations: string[] = []
    for (const zone of ['outfitting', 'painting'] as const) {
      for (const block of blocksInZone(zone)) {
        const summary = await fetchFabricationStages(block.projNo, block.blockNo, TODAY)
        for (const stage of summary.stages) {
          if (stage.weightRate !== 100 || stage.countRate !== 100) {
            violations.push(
              `${block.projNo}-${block.blockNo} ${stage.stage}: 중량 ${stage.weightRate}% · 건수 ${stage.countRate}%`
            )
          }
        }
        if (summary.overallWeightRate !== 100) {
          violations.push(`${block.projNo}-${block.blockNo} 종합 ${summary.overallWeightRate}%`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('진행중·미도래 부재가 하나도 남아 있지 않다', async () => {
    for (const zone of ['outfitting', 'painting'] as const) {
      for (const block of blocksInZone(zone)) {
        const summary = await fetchFabricationStages(block.projNo, block.blockNo, TODAY)
        for (const stage of summary.stages) {
          expect(`${block.blockNo} ${stage.stage} 진행=${stage.inProgressCount}`).toBe(
            `${block.blockNo} ${stage.stage} 진행=0`
          )
          expect(`${block.blockNo} ${stage.stage} 미도래=${stage.notDueCount}`).toBe(
            `${block.blockNo} ${stage.stage} 미도래=0`
          )
        }
      }
    }
  })
})

describe('겹침은 허용한다 — 조립 단계 블록은 가공이 아직일 수 있다', () => {
  it('조립 단계 블록 중 가공 미완 표본이 실제로 있다', () => {
    const overlapping = blocksInZone('assembly').filter(
      (b) => !fabFullyDone(b.projNo, b.blockNo, TODAY)
    )
    /* 하나도 없다면 게이트를 너무 세게 걸어 '가공은 늘 끝나 있다' 는 다른 거짓말을 만든 것이다 */
    expect(overlapping.length).toBeGreaterThan(0)
  })

  it('가공 단계 블록은 당연히 미완이다 — 아직 가공 중이다', () => {
    for (const block of blocksInZone('fabrication')) {
      expect(`${block.blockNo} 가공완료=${fabFullyDone(block.projNo, block.blockNo, TODAY)}`).toBe(
        `${block.blockNo} 가공완료=false`
      )
    }
  })
})

describe('사슬로 성립한다 — 가공 100% → 조립 완료 → 검사장 이동', () => {
  /*
   * 게이트를 로스터 권역에만 걸면 되감기에서 끊긴다: 과거 어느 날 조립은 아직 완료인데
   * 가공만 되감겨 내려가는 창이 생긴다. 그래서 **조립을 마치고 나갔는가**를 기준으로 건다.
   */
  it('어느 기준일에서든, 검사장으로 나간 블록은 가공이 100% 다', async () => {
    const violations: string[] = []
    for (const daysBack of [0, 3, 8, 15, 30, 60]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const [projNo, blockNo] of ALL_BLOCKS) {
        const asm = await fetchAssemblySummary(projNo, blockNo, base)
        if (!asm.inspectionMoved) continue
        if (!fabFullyDone(projNo, blockNo, base)) {
          violations.push(`${projNo}-${blockNo} @${base}: 검사장 이동했는데 가공 미완`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('충분히 먼 과거에는 아무도 나가 있지 않다 — 되감기가 사슬을 통째로 되돌린다', async () => {
    const longAgo = shiftDate(TODAY, -90)
    for (const [projNo, blockNo] of ALL_BLOCKS) {
      const asm = await fetchAssemblySummary(projNo, blockNo, longAgo)
      expect(`${projNo}-${blockNo} 이동=${asm.inspectionMoved}`).toBe(
        `${projNo}-${blockNo} 이동=false`
      )
    }
  })
})

describe('되감기에서도 단조롭다 — 가공이 과거로 갈수록 늘지 않는다', () => {
  it('의장 이상 블록도 과거로 가면 가공이 풀린다(그 시점엔 아직 가공 중이었다)', () => {
    /* 100% 로 고정해 버리면 과거 조회가 거짓이 된다 — 게이트는 '그날 나갔다면' 이지
       '언제나' 가 아니다. 아주 먼 과거에는 의장 블록도 가공이 미완이어야 한다. */
    const longAgo = shiftDate(TODAY, -90)
    const stillDone = blocksInZone('outfitting').filter((b) =>
      fabFullyDone(b.projNo, b.blockNo, longAgo)
    )
    expect(stillDone.map((b) => `${b.projNo}-${b.blockNo}`)).toEqual([])
  })

  it('가공 완료 부재 수가 과거로 갈수록 줄어들기만 한다', () => {
    for (const [projNo, blockNo] of ALL_BLOCKS) {
      let previous = Number.POSITIVE_INFINITY
      for (const daysBack of [0, 5, 12, 25, 50]) {
        const parts = generateParts(projNo, blockNo, shiftDate(TODAY, -daysBack))
        const done = parts.filter((p) => p.statuses.S3 === 'done').length
        expect(`${projNo}-${blockNo} ${daysBack}일전`).toBe(`${projNo}-${blockNo} ${daysBack}일전`)
        expect(done).toBeLessThanOrEqual(previous)
        previous = done
      }
    }
  })
})
