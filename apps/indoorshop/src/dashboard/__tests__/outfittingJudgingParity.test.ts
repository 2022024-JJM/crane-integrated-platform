import { beforeAll, describe, expect, it } from 'vitest'
import { registerProcessModules } from '../shared/model/processRegistry'
import { outfittingModule } from '../processes/outfitting/module'
import {
  judgingBlocksOfFactory,
  outfittingWipBlocksAt,
} from '../processes/outfitting/api/wipBlocks'
import { outfittingBlocksAt } from '../processes/outfitting/api/mockOutfittingData'
import { fetchOutfittingRows } from '../shared/features/performance/api/outfittingPerformance'
import { shiftDate, todayString } from '../shared/lib/timeAxis'

/**
 * **의장 '진행중 판별' 구획과 통합실적 의장 카드가 같은 값을 말하는가** (W8-4).
 *
 * R15 때는 의장에 이 구획을 세우지 않았다. 근거는 "판별 축이 조립뿐이라 진행중 집합이
 * 구조적으로 0건" 이었는데, 곧이어 W7-11 이 의장 판별 %(라이다 기반)를 세우면서 그 근거가
 * 사라졌다. 이제 셀 것이 있고, 세는 순간 **두 화면이 같은 수를 말하는가**가 문제가 된다.
 *
 * 그래서 사상을 `api/wipBlocks` 한 곳으로 모았다. 이 파일이 잠그는 것은 그 합의다:
 * 공장 화면 구획과 통합실적 카드가 **같은 함수를 지나는가**, 그리고 그 결과가 실제로
 * 같은가. 자리가 `src/__tests__` 인 이유는 의장 모듈과 통합실적을 나란히 놓고 봐야 해서다.
 */
const TODAY = todayString()

beforeAll(() => {
  registerProcessModules([outfittingModule])
})

/** 통합실적 카드가 그 공장에 대해 말하는 진행중 블록 */
async function railJudging(factoryId: string, baseDate: string) {
  const rows = await fetchOutfittingRows(baseDate)
  return rows.filter((row) => row.factoryId === factoryId && row.status === 'in_progress')
}

const FACTORY_IDS = [...new Set(outfittingWipBlocksAt(TODAY).map((b) => b.factoryId))]

describe('수치 동일 — 구획과 통합실적 카드', () => {
  it('공장마다 진행중 블록 집합이 같다', async () => {
    for (const factoryId of FACTORY_IDS) {
      const section = judgingBlocksOfFactory(factoryId, TODAY)
        .map((b) => `${b.projNo}-${b.blockNo}`)
        .sort()
      const rail = (await railJudging(factoryId, TODAY))
        .map((r) => r.key)
        .sort()
      expect(`${factoryId}: ${section.join(',')}`).toBe(`${factoryId}: ${rail.join(',')}`)
    }
  })

  it('같은 블록의 판별 %·구역·송선기호가 같다', async () => {
    for (const factoryId of FACTORY_IDS) {
      const rail = new Map((await railJudging(factoryId, TODAY)).map((r) => [r.key, r]))
      for (const block of judgingBlocksOfFactory(factoryId, TODAY)) {
        const key = `${block.projNo}-${block.blockNo}`
        const want = rail.get(key)!
        expect(`${key} ${block.judgedRate} ${block.areaName} ${block.wstgCode}`).toBe(
          `${key} ${want.judgedRate} ${want.areaName} ${want.wstgCode}`
        )
      }
    }
  })

  it('표본이 실제로 있다 — 비어 있으면 이 계약은 아무것도 지키지 않는다', () => {
    const total = FACTORY_IDS.reduce(
      (sum, id) => sum + judgingBlocksOfFactory(id, TODAY).length,
      0
    )
    expect(total).toBeGreaterThan(0)
  })

  it('되감아도 같다 — 두 화면이 같은 날을 본다', async () => {
    for (const daysBack of [3, 10]) {
      const base = shiftDate(TODAY, -daysBack)
      for (const factoryId of FACTORY_IDS) {
        const section = judgingBlocksOfFactory(factoryId, base).map(
          (b) => `${b.projNo}-${b.blockNo}:${b.judgedRate}`
        )
        const rail = (await railJudging(factoryId, base)).map((r) => `${r.key}:${r.judgedRate}`)
        expect(`${factoryId}@${base} ${section.sort().join(',')}`).toBe(
          `${factoryId}@${base} ${rail.sort().join(',')}`
        )
      }
    }
  })
})

describe('진행중만 — 완료·대기는 이 구획의 몫이 아니다', () => {
  it('완료·대기 블록이 섞이지 않는다', () => {
    for (const factoryId of FACTORY_IDS) {
      for (const block of judgingBlocksOfFactory(factoryId, TODAY)) {
        expect(`${block.blockNo} ${block.status}`).toBe(`${block.blockNo} in_progress`)
      }
    }
  })

  it('그 공장의 전체 블록보다 적다 — 요약이 전체를 대신하지 않는다', () => {
    let narrower = 0
    for (const factoryId of FACTORY_IDS) {
      const all = outfittingWipBlocksAt(TODAY).filter((b) => b.factoryId === factoryId)
      const judging = judgingBlocksOfFactory(factoryId, TODAY)
      expect(judging.length).toBeLessThanOrEqual(all.length)
      if (judging.length < all.length) narrower += 1
    }
    /* 어느 공장에서도 좁혀지지 않으면 두 구획이 같은 목록이라는 뜻이다 — 중복이다 */
    expect(narrower).toBeGreaterThan(0)
  })

  it('갓 반입 블록은 진행중이 아니다 — 어제 들어와 아직 시작 전이다', () => {
    for (const factoryId of FACTORY_IDS) {
      for (const block of judgingBlocksOfFactory(factoryId, TODAY)) {
        expect(`${block.blockNo} 갓반입=${block.justArrived}`).toBe(`${block.blockNo} 갓반입=false`)
      }
    }
  })
})

describe('사상은 한 곳이다 — provides 와 화면이 같은 함수를 지난다', () => {
  it('provides 가 내는 것과 wipBlocks 가 내는 것이 같다', async () => {
    const viaProvides = await outfittingModule.provides!.outfittingBlocks!(TODAY)
    expect(viaProvides).toEqual(outfittingWipBlocksAt(TODAY))
  })

  it('판별률은 의장 블록 mock 의 진척 그대로다 — 이름만 바꿨지 다시 세지 않는다', () => {
    const shop = new Map(outfittingBlocksAt(TODAY).map((b) => [`${b.projNo}-${b.blkNo}`, b]))
    for (const block of outfittingWipBlocksAt(TODAY)) {
      const key = `${block.projNo}-${block.blockNo}`
      expect(`${key} ${block.judgedRate}`).toBe(`${key} ${shop.get(key)!.progress}`)
    }
  })
})

describe('정렬 — 곧 끝날 것이 위로', () => {
  it('판별률 내림차순이다', () => {
    for (const factoryId of FACTORY_IDS) {
      const rates = judgingBlocksOfFactory(factoryId, TODAY).map((b) => b.judgedRate)
      expect(rates).toEqual([...rates].sort((a, b) => b - a))
    }
  })
})
