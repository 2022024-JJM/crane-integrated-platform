import { describe, expect, it } from 'vitest'
import { listBlocks } from '../../../../shared/entities/vessel'
import { fetchAssemblySummary } from '../../../../shared/features/performance/api/performanceApi'
import { todayString } from '../../../../shared/features/performance/lib/baseDate'
import { assemblyFactoryIdOf, assemblyMapFactoryNames } from '../mapEntry'
import { judgingAssysAt } from '../judgingAssys'

/**
 * **공장 현황의 '진행중 판별' 계약** (W7-7-5, 사용자 R15).
 *
 * 이 목록이 지켜야 하는 것은 "두 화면이 같은 것을 말하는가" 하나다. 공장 화면이 제
 * 해시로 진척을 지어내면 통합실적과 다른 숫자가 나오고, 그 순간 조작자는 어느 쪽을
 * 믿을지 알 수 없게 된다(연계 매트릭스가 잡은 바로 그 병이다).
 *
 * 그래서 셋을 잠근다:
 *   집합 — 그 공장 소재(로스터) ∧ 판별 진행중(통합실적) 과 정확히 같다
 *   수치 — 통합실적 카드의 그 ASSY 값과 **같은 값**이다(자기율, 롤업 아님)
 *   범위 — 완료·미착수는 없다
 */
const TODAY = todayString()
const FACTORY_IDS = assemblyMapFactoryNames()
  .map((name) => assemblyFactoryIdOf(name))
  .filter((id): id is string => id !== null)

/** 기대 집합을 **화면과 다른 길로** 다시 만든다 — 같은 함수를 두 번 부르면 검사가 아니다 */
async function expectedAt(factoryId: string) {
  const rows: { assyNo: string; selfRate: number; recognizedQty: number; reqQty: number }[] = []
  for (const block of listBlocks()) {
    const summary = await fetchAssemblySummary(block.projNo, block.blockNo, TODAY)
    for (const assy of summary.assys) {
      if (assy.judged !== 'partial') continue
      const unit = block.assyUnits?.find((u) => u.assyNo === assy.assyNo)
      const factory = unit ? unit.factory : block.factory
      if (assemblyFactoryIdOf(factory) !== factoryId) continue
      rows.push({
        assyNo: assy.assyNo,
        selfRate: assy.selfRate,
        recognizedQty: assy.recognizedQty,
        reqQty: assy.reqQty,
      })
    }
  }
  return rows
}

describe('집합 — 그 공장 소재 ∧ 판별 진행중', () => {
  it('공장마다 기대 집합과 정확히 같다', async () => {
    for (const factoryId of FACTORY_IDS) {
      const actual = (await judgingAssysAt(factoryId, TODAY)).map((r) => r.assyNo).sort()
      const expected = (await expectedAt(factoryId)).map((r) => r.assyNo).sort()
      expect(`${factoryId}: ${actual.join(',')}`).toBe(`${factoryId}: ${expected.join(',')}`)
    }
  })

  it('표본이 실제로 있다 — 전부 비어 있으면 이 계약은 아무것도 지키지 않는다', async () => {
    let total = 0
    for (const factoryId of FACTORY_IDS) total += (await judgingAssysAt(factoryId, TODAY)).length
    expect(total).toBeGreaterThan(0)
  })

  it('한 ASSY 는 한 공장에만 선다 — 흩어진 블록도 자리는 하나다', async () => {
    const seen = new Map<string, string>()
    for (const factoryId of FACTORY_IDS) {
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        expect(`${row.assyNo} 첫 공장=${seen.get(row.assyNo) ?? factoryId}`).toBe(
          `${row.assyNo} 첫 공장=${factoryId}`
        )
        seen.set(row.assyNo, factoryId)
      }
    }
  })

  it('모르는 공장은 빈 목록 — 없는 자리를 지어내지 않는다', async () => {
    expect(await judgingAssysAt('asm-없음', TODAY)).toEqual([])
  })
})

describe('수치 — 통합실적과 같은 값이다', () => {
  it('자기율·분자·분모가 통합실적 카드의 그 ASSY 와 같다', async () => {
    for (const factoryId of FACTORY_IDS) {
      const expected = new Map((await expectedAt(factoryId)).map((r) => [r.assyNo, r]))
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        const want = expected.get(row.assyNo)!
        expect(`${row.assyNo} ${row.selfRate}/${row.recognizedQty}/${row.reqQty}`).toBe(
          `${row.assyNo} ${want.selfRate}/${want.recognizedQty}/${want.reqQty}`
        )
      }
    }
  })

  it('롤업률을 쓰지 않는다 — 하위를 섞으면 다른 질문이 된다 (R1 계층 금지)', async () => {
    /* 자기율과 롤업률이 갈리는 ASSY 가 하나라도 있으면, 그 자리에서 자기율을 쓰는지 본다 */
    let compared = 0
    for (const factoryId of FACTORY_IDS) {
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        const summary = await fetchAssemblySummary(row.projNo, row.blockNo, TODAY)
        const assy = summary.assys.find((a) => a.assyNo === row.assyNo)!
        expect(row.selfRate).toBe(assy.selfRate)
        if (assy.rollupRate !== assy.selfRate) compared += 1
      }
    }
    /* 갈리는 표본이 없으면 이 검사는 아무것도 구분하지 못한다 — 그 사실을 드러낸다 */
    expect(`갈리는 표본 ${compared > 0 ? '있음' : '없음'}`).toBe('갈리는 표본 있음')
  })
})

describe('범위 — 진행중만', () => {
  it('완료·미착수는 목록에 없다', async () => {
    for (const factoryId of FACTORY_IDS) {
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        const summary = await fetchAssemblySummary(row.projNo, row.blockNo, TODAY)
        const assy = summary.assys.find((a) => a.assyNo === row.assyNo)!
        expect(`${row.assyNo} ${assy.judged}`).toBe(`${row.assyNo} partial`)
      }
    }
  })

  it('진행중이면 분자가 0 보다 크고 분모를 채우지 못했다', async () => {
    for (const factoryId of FACTORY_IDS) {
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        expect(row.recognizedQty).toBeGreaterThan(0)
        expect(row.recognizedQty).toBeLessThan(row.reqQty)
      }
    }
  })

  it('의장·도장으로 넘어간 블록의 ASSY 는 없다 — 그 블록은 공장을 떠났다', async () => {
    const gone = new Set(
      listBlocks()
        .filter((b) => b.zone === 'outfitting' || b.zone === 'painting')
        .map((b) => `${b.projNo}-${b.blockNo}`)
    )
    for (const factoryId of FACTORY_IDS) {
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        expect(`${row.assyNo} 떠남=${gone.has(row.blockKey)}`).toBe(`${row.assyNo} 떠남=false`)
      }
    }
  })
})

describe('딥링크 — 같은 번호로 그대로 이어진다', () => {
  it('줄마다 호선·블록·ASSY 를 지목한 통합실적 링크를 갖는다', async () => {
    for (const factoryId of FACTORY_IDS) {
      for (const row of await judgingAssysAt(factoryId, TODAY)) {
        const url = new URL(row.href, 'https://x')
        expect(url.pathname).toBe('/indoorshop/performance')
        expect(url.searchParams.get('vessel')).toBe(row.projNo)
        expect(url.searchParams.get('block')).toBe(row.blockNo)
        expect(url.searchParams.get('assy')).toBe(row.assyNo)
      }
    }
  })
})

describe('정렬 — 곧 끝날 것이 위로', () => {
  it('자기율 내림차순이다', async () => {
    for (const factoryId of FACTORY_IDS) {
      const rates = (await judgingAssysAt(factoryId, TODAY)).map((r) => r.selfRate)
      expect(rates).toEqual([...rates].sort((a, b) => b - a))
    }
  })
})
