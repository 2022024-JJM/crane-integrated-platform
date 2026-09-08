import { beforeAll, describe, expect, it } from 'vitest'
import { registerProcessModules } from '../shared/model/processRegistry'
import { outfittingModule } from '../processes/outfitting/module'
import { outfittingBlocksAt } from '../processes/outfitting/api/mockOutfittingData'
import {
  fetchOutfittingRows,
  overallOf,
  rowOfBlock,
  rowsOfQuery,
} from '../shared/features/performance/api/outfittingPerformance'
import { shiftDate, todayString } from '../shared/lib/timeAxis'

/**
 * **통합실적 의장 레일의 계약** (W7-11, 사용자 확정).
 *
 * 의장은 지금까지 통합실적에서 '절점 없음' 자리로만 있었다. 카드를 세우면서 지켜야 할
 * 것은 하나다 — **의장 공장 화면과 같은 값을 말하는가.** 화면마다 제 해시로 진척을
 * 지어내면 같은 블록이 두 숫자를 갖고, 그 순간 둘 다 못 믿게 된다(연계 매트릭스가 잡은 병).
 *
 * 자리가 `src/__tests__` 인 이유: 의장 모듈(원천)과 통합실적(소비자)을 나란히 놓고 봐야
 * 하는 검사라 어느 레이어에도 들지 않는다. 실제 앱처럼 **모듈을 레지스트리에 등록한 뒤**
 * 읽는다 — 등록을 건너뛰고 원천을 직접 부르면 통로 자체를 검사하지 못한다.
 */
const TODAY = todayString()

beforeAll(() => {
  registerProcessModules([outfittingModule])
})

describe('원천이 하나다 — 의장 공장 화면과 같은 값', () => {
  it('블록 집합이 공장 화면의 재공 목록과 정확히 같다', async () => {
    const rail = (await fetchOutfittingRows(TODAY)).map((r) => r.key).sort()
    const shop = outfittingBlocksAt(TODAY)
      .map((b) => `${b.projNo}-${b.blkNo}`)
      .sort()
    expect(rail).toEqual(shop)
  })

  it('같은 블록의 판별 %·상태·구역·송선기호가 공장 화면과 같다', async () => {
    const shop = new Map(outfittingBlocksAt(TODAY).map((b) => [`${b.projNo}-${b.blkNo}`, b]))
    for (const row of await fetchOutfittingRows(TODAY)) {
      const want = shop.get(row.key)!
      expect(`${row.key} ${row.judgedRate} ${row.status} ${row.areaName} ${row.wstgCode}`).toBe(
        `${row.key} ${want.progress} ${want.status} ${want.areaName} ${want.wstgCode}`
      )
    }
  })

  it('갓 반입 표식도 그대로 따라온다 — 두 화면이 같은 블록을 같게 부른다', async () => {
    const shop = new Map(outfittingBlocksAt(TODAY).map((b) => [`${b.projNo}-${b.blkNo}`, b]))
    for (const row of await fetchOutfittingRows(TODAY)) {
      expect(`${row.key} 갓반입=${row.justArrived}`).toBe(
        `${row.key} 갓반입=${shop.get(row.key)!.justArrived}`
      )
    }
  })

  it('표본이 실제로 있다 — 비어 있으면 이 계약은 아무것도 지키지 않는다', async () => {
    expect((await fetchOutfittingRows(TODAY)).length).toBeGreaterThan(0)
  })
})

describe('기준일 되감기 — 통합실적과 의장이 같은 날을 본다', () => {
  it('되감은 날의 값이 그 날 공장 화면의 값과 같다', async () => {
    for (const daysBack of [1, 5, 14]) {
      const base = shiftDate(TODAY, -daysBack)
      const shop = new Map(outfittingBlocksAt(base).map((b) => [`${b.projNo}-${b.blkNo}`, b]))
      for (const row of await fetchOutfittingRows(base)) {
        expect(`${row.key}@${base} ${row.judgedRate}`).toBe(
          `${row.key}@${base} ${shop.get(row.key)!.progress}`
        )
      }
    }
  })

  it('되감으면 값이 실제로 달라진다 — 축이 반쪽이면 이 검사가 잡는다', async () => {
    const today = await fetchOutfittingRows(TODAY)
    const past = await fetchOutfittingRows(shiftDate(TODAY, -14))
    const changed = today.filter((row) => {
      const then = past.find((p) => p.key === row.key)
      return then && then.judgedRate !== row.judgedRate
    })
    expect(changed.length).toBeGreaterThan(0)
  })
})

describe('블록 단위 — 계층이 없다 (R1)', () => {
  it('행에 ASSY·계층 필드가 없다', async () => {
    const [row] = await fetchOutfittingRows(TODAY)
    for (const forbidden of ['assyNo', 'tier', 'parentAssyNo', 'depth', 'rollupRate', 'strcCode']) {
      expect(`${forbidden} 있음=${forbidden in row}`).toBe(`${forbidden} 있음=false`)
    }
  })

  it('블록 하나가 행 하나다 — 한 블록이 여러 줄로 갈리지 않는다', async () => {
    const rows = await fetchOutfittingRows(TODAY)
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })
})

describe('조회 조건으로 좁히기', () => {
  it('고른 호선의 고른 블록만 남는다', async () => {
    const rows = await fetchOutfittingRows(TODAY)
    const sample = rows[0]
    const narrowed = rowsOfQuery(rows, sample.projNo, [sample.blockNo])
    expect(narrowed.map((r) => r.key)).toEqual([sample.key])
  })

  it('블록을 안 고르면 그 호선 전체 — 통합실적 필터의 규칙 그대로다', async () => {
    const rows = await fetchOutfittingRows(TODAY)
    const projNo = rows[0].projNo
    const all = rowsOfQuery(rows, projNo, [])
    expect(all.map((r) => r.key).sort()).toEqual(
      rows.filter((r) => r.projNo === projNo).map((r) => r.key).sort()
    )
  })

  it('의장 재공이 아닌 블록은 헤더 줄이 비어 있다 — 0% 로 적지 않는다', async () => {
    const rows = await fetchOutfittingRows(TODAY)
    expect(rowOfBlock(rows, '9999', '000')).toBeNull()
  })
})

describe('종합 — 블록 단순 평균 (가중할 물량이 없다)', () => {
  it('평균이 행들의 산술 평균과 같다', async () => {
    const rows = await fetchOutfittingRows(TODAY)
    const overall = overallOf(rows)
    const mean = rows.reduce((sum, r) => sum + r.judgedRate, 0) / rows.length
    expect(overall.judgedRate).toBe(Math.round(mean * 10) / 10)
    expect(overall.blockCount).toBe(rows.length)
  })

  it('분모(블록 수)를 함께 낸다 — 3블록 평균과 30블록 평균이 같은 무게로 읽히지 않게', async () => {
    const overall = overallOf(await fetchOutfittingRows(TODAY))
    expect(overall.blockCount).toBeGreaterThan(0)
  })

  it('빈 목록이면 0 이고 터지지 않는다', () => {
    expect(overallOf([])).toEqual({
      blockCount: 0,
      judgedRate: 0,
      inProgress: 0,
      completed: 0,
      justArrived: 0,
    })
  })

  it('상태 집계가 행들과 맞는다', async () => {
    const rows = await fetchOutfittingRows(TODAY)
    const overall = overallOf(rows)
    expect(overall.inProgress).toBe(rows.filter((r) => r.status === 'in_progress').length)
    expect(overall.completed).toBe(rows.filter((r) => r.status === 'completed').length)
    expect(overall.justArrived).toBe(rows.filter((r) => r.justArrived).length)
  })
})

describe('W/O 는 참고다 — 판별이 원천이고 오더는 그 위의 주석', () => {
  it('매칭 상태는 조립과 같은 세 갈래뿐이다', async () => {
    for (const row of await fetchOutfittingRows(TODAY)) {
      expect(['matched', 'fallback', 'unmatched']).toContain(row.orderMatch)
    }
  })

  it('결정론이다 — 같은 기준일이면 같은 상태', async () => {
    const a = await fetchOutfittingRows(TODAY)
    const b = await fetchOutfittingRows(TODAY)
    expect(a.map((r) => r.orderMatch)).toEqual(b.map((r) => r.orderMatch))
  })

  it('아직 판별이 없는 블록은 불일치라 부르지 않는다 — 붙을 실적 자체가 없다', async () => {
    for (const row of await fetchOutfittingRows(TODAY)) {
      if (row.judgedRate > 0) continue
      expect(`${row.key} ${row.orderMatch}`).toBe(`${row.key} matched`)
    }
  })
})

/*
 * `processes/outfitting/__tests__/noAssemblyHierarchy` 의 **확장**.
 *
 * 그쪽은 의장 모듈 안의 소스만 훑는다(글로브가 그 폴더로 묶여 있다). 그런데 의장 레일은
 * shared 에 산다 — 조립 카드 옆에서 조립 코드를 보며 쓰게 되는 자리라, 계층 어휘가
 * 흘러들 위험은 오히려 더 크다. 그래서 그 규칙을 이 파일들까지 늘린다.
 */
const RAIL_SOURCES = import.meta.glob(
  [
    '../shared/features/performance/api/outfittingPerformance.ts',
    '../shared/features/performance/ui/OutfittingCard.tsx',
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

/** 조립 계층을 가리키는 낱말 — 의장 레일 코드에 남아 있으면 안 된다 */
const HIERARCHY_WORDS = ['중조립', '소조립', '대조립', '조립체', '조립품', 'assySerNo', 'rollup']
const COMMENT_PREFIXES = ['*', '//', '/*']

describe('의장 레일 소스 — 조립 계층 어휘가 흘러들지 않는다 (noAssemblyHierarchy 확장)', () => {
  it('검사 대상 파일이 실제로 잡힌다 — 글로브가 비면 아무것도 지키지 않는다', () => {
    expect(Object.keys(RAIL_SOURCES).length).toBe(2)
  })

  it('실행되는 줄에 계층 낱말이 없다', () => {
    const offenders: string[] = []
    for (const [path, source] of Object.entries(RAIL_SOURCES)) {
      source.split('\n').forEach((line, index) => {
        const trimmed = line.trim()
        /* 규칙을 설명하는 주석은 그 낱말을 쓸 수밖에 없다 — 설명 줄은 넘어간다 */
        if (COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return
        for (const word of HIERARCHY_WORDS) {
          if (line.includes(word)) offenders.push(`${path}:${index + 1} "${word}" — ${trimmed}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
