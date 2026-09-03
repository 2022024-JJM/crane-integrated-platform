import { describe, expect, it } from 'vitest'
import { blocksInZone, listBlocks, type ProcessZone } from '../shared/entities/vessel'
import { fetchBlockSummary } from '../shared/features/performance/api/performanceApi'
import { shiftDate, todayString } from '../shared/features/performance/lib/baseDate'
import { mockBlocks } from '../processes/outfitting/api/mockOutfittingData'

/**
 * **화면 사이의 연계 계약** (W7-7-1 · 연계 매트릭스 C1·C2).
 *
 * 한 블록을 두고 화면이 서로 다른 말을 하고 있었다. 통합실적은 "이 블록 도장 중" 이라
 * 하면서 그 옆 절점 스트립은 "가공 진행 중 · 지연 2" 라 했고, 의장 목록은 어제 막 들어온
 * 블록을 "38% 작업중" 이라 했다. 값이 각자 만들어졌기 때문이다 — 신원과 단계는 로스터가
 * 정본인데 각 mock 이 제 해시로 진척을 뽑았다.
 *
 * 이 파일이 잠그는 것은 **정본을 따르는가** 하나다:
 *   C1 — 현재 공정보다 앞선 공정의 절점은 전부 통과다(지나온 길은 지나온 것이다).
 *   C2 — 갓 반입(`justArrived`)이면 그 공정의 진척은 0 이다(어제 들어와 38%일 수 없다).
 *
 * 자리가 `src/__tests__` 인 이유: 통합실적(shared)과 의장 화면(processes)을 나란히 놓고
 * 봐야 하는 검사라 어느 레이어에도 들지 않는다.
 */
const TODAY = todayString()

/** 공정 순서 — 앞선 공정일수록 작다 */
const ORDER: Record<ProcessZone, number> = {
  fabrication: 0,
  assembly: 1,
  outfitting: 2,
  painting: 3,
}

/** 가공 절점(S1~S5)이 서는 권역 — 이보다 뒤에 서 있으면 가공은 지나온 길이다 */
const FABRICATION_ORDER = ORDER.fabrication

describe('C1 — 지나온 공정의 절점은 통과다', () => {
  it('가공보다 뒤에 선 블록(조립 완료 이후)의 S1~S5 가 전부 통과다', async () => {
    const violations: string[] = []
    for (const block of listBlocks()) {
      if (ORDER[block.zone] <= FABRICATION_ORDER) continue
      const summary = await fetchBlockSummary(block.projNo, block.blockNo, TODAY)
      /* 조립 중 블록은 겹침이 정상이라 제외 — 부재가 순차로 올라오는 동안 조립이 시작된다 */
      if (!summary.inspectionMoved) continue
      const open = summary.progress.nodes.filter((n) => !n.passed).map((n) => n.stage)
      if (open.length > 0) {
        violations.push(`${block.projNo}-${block.blockNo}(${block.zone}) 미통과 ${open.join(',')}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('의장·도장 블록에는 가공 지연이 하나도 없다 — 지나온 길에 지연이 남지 않는다', async () => {
    const violations: string[] = []
    for (const zone of ['outfitting', 'painting'] as const) {
      for (const block of blocksInZone(zone)) {
        const summary = await fetchBlockSummary(block.projNo, block.blockNo, TODAY)
        if (summary.progress.delayedCount > 0) {
          violations.push(
            `${block.projNo}-${block.blockNo}(${zone}) 지연 ${summary.progress.delayedCount}건`
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('계획도 함께 지나간다 — 실적 100%인데 계획 40%로 남지 않는다', async () => {
    /* 계획 사다리를 늘 기준일 언저리에 깔면 도장 중 블록이 "계획 40% · 실적 100%" 가 된다.
       2.5배 초과 달성처럼 읽히지만 사실은 계획이 그 블록을 못 따라간 것뿐이다. */
    const violations: string[] = []
    for (const zone of ['outfitting', 'painting'] as const) {
      for (const block of blocksInZone(zone)) {
        const { progress } = await fetchBlockSummary(block.projNo, block.blockNo, TODAY)
        if (progress.planRate !== 100) {
          violations.push(
            `${block.projNo}-${block.blockNo}(${zone}) 계획 ${progress.planRate}% · 실적 ${progress.actualRate}%`
          )
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('되감아도 성립한다 — 그날 이미 지나온 공정이면 그날 절점도 통과다', async () => {
    const violations: string[] = []
    for (const daysBack of [0, 5, 12, 30]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const block of listBlocks()) {
        const summary = await fetchBlockSummary(block.projNo, block.blockNo, base)
        if (!summary.inspectionMoved) continue
        const open = summary.progress.nodes.filter((n) => !n.passed)
        if (open.length > 0) {
          violations.push(`${block.projNo}-${block.blockNo} @${base}: 나갔는데 절점 미통과`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('가공·조립 단계 블록은 절점이 열려 있다 — 게이트를 너무 세게 걸지 않았다', async () => {
    const open: string[] = []
    for (const zone of ['fabrication', 'assembly'] as const) {
      for (const block of blocksInZone(zone)) {
        const summary = await fetchBlockSummary(block.projNo, block.blockNo, TODAY)
        if (summary.progress.nodes.some((n) => !n.passed)) {
          open.push(`${block.projNo}-${block.blockNo}`)
        }
      }
    }
    /* 하나도 없다면 '가공은 늘 끝나 있다' 는 다른 거짓말을 만든 것이다 */
    expect(open.length).toBeGreaterThan(0)
  })
})

describe('C2 — 갓 반입 블록은 그 공정의 진척이 0 이다', () => {
  /** 로스터가 갓 반입이라 적은 의장 블록 */
  const justArrivedKeys = new Set(
    blocksInZone('outfitting')
      .filter((b) => b.justArrived)
      .map((b) => `${b.projNo}-${b.blockNo}`)
  )

  it('표본이 실제로 있다 — 없으면 이 계약은 아무것도 지키지 않는다', () => {
    expect(justArrivedKeys.size).toBeGreaterThan(0)
  })

  it('의장 목록에서 진척 0 · 대기다', () => {
    const violations = mockBlocks
      .filter((b) => justArrivedKeys.has(`${b.projNo}-${b.blkNo}`))
      .filter((b) => b.progress !== 0 || b.status !== 'waiting')
      .map((b) => `${b.projNo}-${b.blkNo}: ${b.progress}% ${b.status}`)
    expect(violations).toEqual([])
  })

  it("화면이 '막 반입' 이라 말할 수 있다 — 손도 안 댄 대기와 갈린다", () => {
    const rows = mockBlocks.filter((b) => justArrivedKeys.has(`${b.projNo}-${b.blkNo}`))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(`${row.projNo}-${row.blkNo} 갓반입=${row.justArrived}`).toBe(
        `${row.projNo}-${row.blkNo} 갓반입=true`
      )
    }
  })

  it('로스터가 갓 반입이라 하지 않은 블록에는 그 표식이 붙지 않는다', () => {
    const wrong = mockBlocks
      .filter((b) => b.justArrived && !justArrivedKeys.has(`${b.projNo}-${b.blkNo}`))
      .map((b) => `${b.projNo}-${b.blkNo}`)
    expect(wrong).toEqual([])
  })

  it('갓 반입이 아닌 블록은 진척이 그대로다 — 전부 0 으로 밀지 않았다', () => {
    const moving = mockBlocks.filter(
      (b) => !justArrivedKeys.has(`${b.projNo}-${b.blkNo}`) && b.progress > 0
    )
    expect(moving.length).toBeGreaterThan(0)
  })
})

describe('갓 반입은 생애주기와도 앞뒤가 맞는다', () => {
  it('의장에 갓 들어왔다면 조립은 끝났고 검사장을 지났다', async () => {
    for (const block of blocksInZone('outfitting').filter((b) => b.justArrived)) {
      const summary = await fetchBlockSummary(block.projNo, block.blockNo, TODAY)
      expect(`${block.blockNo} 조립 ${summary.assyDone}/${summary.assyCount}`).toBe(
        `${block.blockNo} 조립 ${summary.assyCount}/${summary.assyCount}`
      )
      expect(`${block.blockNo} 이동=${summary.inspectionMoved}`).toBe(`${block.blockNo} 이동=true`)
    }
  })
})
