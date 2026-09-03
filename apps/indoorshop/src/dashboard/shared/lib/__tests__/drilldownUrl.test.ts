import { describe, expect, it } from 'vitest'
import {
  DRILLDOWN_PARAM,
  drilldownHref,
  drilldownLevel,
  drilldownSearch,
  isTopDrilldown,
  LEGACY_FACTORY_PARAM,
  narrowDrilldown,
  parentDrilldown,
  parseDrilldown,
  writeDrilldown,
  YARD_DRILLDOWN,
  type DrilldownState,
} from '../drilldownUrl'

/*
 * 드릴다운 URL 계약 — 지도 화면과 글로벌 검색이 **같은 규칙**으로 자리를 읽고 쓴다는
 * 약속. 여기가 깨지면 "새로고침하면 대문으로 돌아간다"·"링크를 건넸는데 상대는 다른
 * 데를 본다" 계급의 사고가 조용히 돌아온다.
 */

const state = (over: Partial<DrilldownState> = {}): DrilldownState => ({
  ...YARD_DRILLDOWN,
  ...over,
})

describe('parseDrilldown', () => {
  it('아무것도 없으면 야드(최상위)', () => {
    expect(parseDrilldown('')).toEqual(YARD_DRILLDOWN)
    expect(parseDrilldown('?vessel=1234')).toEqual(YARD_DRILLDOWN)
  })

  it('공정·공장·베이를 읽는다', () => {
    expect(parseDrilldown('?process=조립&factory=GBS&bay=GBS%233BAY')).toEqual({
      process: '조립',
      factory: 'GBS',
      bay: 'GBS#3BAY',
    })
  })

  it('옛 철자 `?shop=` 도 공장으로 읽는다 — 야드·통합실적의 낡은 링크가 살아 있다', () => {
    expect(parseDrilldown(`?${LEGACY_FACTORY_PARAM}=GBS`).factory).toBe('GBS')
  })

  it('두 철자가 함께 오면 새 철자가 이긴다', () => {
    expect(parseDrilldown(`?factory=NPS&${LEGACY_FACTORY_PARAM}=GBS`).factory).toBe('NPS')
  })

  it('공장 없는 베이는 없는 것으로 친다 — 표현할 수 없는 상태를 들지 않는다', () => {
    expect(parseDrilldown('?bay=GBS%233BAY').bay).toBeNull()
  })

  it('빈 값·공백은 없는 것으로 친다', () => {
    expect(parseDrilldown('?factory=&bay=x')).toEqual(YARD_DRILLDOWN)
    expect(parseDrilldown('?factory=%20%20').factory).toBeNull()
  })

  it('URLSearchParams 객체도 그대로 받는다', () => {
    expect(parseDrilldown(new URLSearchParams({ factory: 'GBS' })).factory).toBe('GBS')
  })
})

describe('drilldownLevel · isTopDrilldown', () => {
  it('깊은 쪽이 이긴다', () => {
    expect(drilldownLevel(YARD_DRILLDOWN)).toBe('yard')
    expect(drilldownLevel(state({ process: '조립' }))).toBe('process')
    expect(drilldownLevel(state({ factory: 'GBS' }))).toBe('factory')
    expect(drilldownLevel(state({ factory: 'GBS', bay: 'GBS#3BAY' }))).toBe('bay')
  })

  it('야드만 최상위', () => {
    expect(isTopDrilldown(YARD_DRILLDOWN)).toBe(true)
    expect(isTopDrilldown(state({ process: '조립' }))).toBe(false)
  })
})

describe('narrowDrilldown — 상위를 건드리면 하위를 버린다', () => {
  it('공장을 갈아타면 이전 공장의 베이는 남지 않는다', () => {
    const next = narrowDrilldown(state({ factory: 'GBS', bay: 'GBS#3BAY' }), { factory: 'NPS' })
    expect(next).toEqual({ process: null, factory: 'NPS', bay: null })
  })

  it('같은 공장을 다시 골라도 베이는 살아 있다 — 훑는 동작이 초기화되지 않게', () => {
    const next = narrowDrilldown(state({ factory: 'GBS', bay: 'GBS#3BAY' }), { factory: 'GBS' })
    expect(next.bay).toBe('GBS#3BAY')
  })

  it('공정을 갈아타면 그 아래 공장·베이가 함께 사라진다', () => {
    const next = narrowDrilldown(state({ process: '조립', factory: 'GBS', bay: 'GBS#3BAY' }), {
      process: '도장',
    })
    expect(next).toEqual({ process: '도장', factory: null, bay: null })
  })

  it('공장을 비우면 베이도 함께 비운다 (전체 보기로 나가기)', () => {
    expect(narrowDrilldown(state({ factory: 'GBS', bay: 'GBS#3BAY' }), { factory: null })).toEqual(
      YARD_DRILLDOWN,
    )
  })

  it('한 번에 깊이 들어가는 패치는 살린다 — 검색 결과가 베이까지 실어 보낸다', () => {
    expect(narrowDrilldown(YARD_DRILLDOWN, { factory: 'GBS', bay: 'GBS#3BAY' })).toEqual({
      process: null,
      factory: 'GBS',
      bay: 'GBS#3BAY',
    })
  })

  it('건드리지 않은 단계는 그대로 둔다', () => {
    const next = narrowDrilldown(state({ process: '조립', factory: 'GBS' }), { bay: 'GBS#3BAY' })
    expect(next).toEqual({ process: '조립', factory: 'GBS', bay: 'GBS#3BAY' })
  })
})

describe('parentDrilldown — ESC·브레드크럼이 오르는 계단', () => {
  it('베이 → 공장 → (공정) → 야드', () => {
    let s = state({ process: '조립', factory: 'GBS', bay: 'GBS#3BAY' })
    s = parentDrilldown(s)
    expect(s).toEqual({ process: '조립', factory: 'GBS', bay: null })
    s = parentDrilldown(s)
    expect(s).toEqual({ process: '조립', factory: null, bay: null })
    s = parentDrilldown(s)
    expect(s).toEqual(YARD_DRILLDOWN)
  })

  it('최상위에서는 그대로 — 더 올라갈 곳이 없다', () => {
    expect(parentDrilldown(YARD_DRILLDOWN)).toEqual(YARD_DRILLDOWN)
  })
})

describe('writeDrilldown — 자기 키만 건드린다', () => {
  it('다른 쿼리는 그대로 실려 간다 (통합실적·조립 화면과 공존)', () => {
    const next = writeDrilldown('?vessel=1234&block=A11&assy=X&date=2026-09-03', {
      process: null,
      factory: 'GBS',
      bay: null,
    })
    expect(next.get('vessel')).toBe('1234')
    expect(next.get('block')).toBe('A11')
    expect(next.get('assy')).toBe('X')
    expect(next.get('date')).toBe('2026-09-03')
    expect(next.get(DRILLDOWN_PARAM.factory)).toBe('GBS')
  })

  it('비운 단계의 키는 지운다 — 빈 값이 남지 않게', () => {
    const next = writeDrilldown('?factory=GBS&bay=GBS%233BAY', YARD_DRILLDOWN)
    expect(next.has(DRILLDOWN_PARAM.factory)).toBe(false)
    expect(next.has(DRILLDOWN_PARAM.bay)).toBe(false)
  })

  it('옛 철자는 쓸 때 정규화한다 — 한 자리에 두 철자를 남기지 않는다', () => {
    const next = writeDrilldown(`?${LEGACY_FACTORY_PARAM}=GBS`, { ...YARD_DRILLDOWN, factory: 'NPS' })
    expect(next.has(LEGACY_FACTORY_PARAM)).toBe(false)
    expect(next.get(DRILLDOWN_PARAM.factory)).toBe('NPS')
  })

  it('원본 파라미터를 건드리지 않는다 (새 객체를 낸다)', () => {
    const source = new URLSearchParams('?factory=GBS')
    writeDrilldown(source, YARD_DRILLDOWN)
    expect(source.get('factory')).toBe('GBS')
  })
})

describe('drilldownSearch · drilldownHref', () => {
  it('남는 것이 없으면 `?` 를 달지 않는다', () => {
    expect(drilldownSearch('?factory=GBS', YARD_DRILLDOWN)).toBe('')
    expect(drilldownHref('/zones/assembly', '?factory=GBS', YARD_DRILLDOWN)).toBe('/zones/assembly')
  })

  it('경로 + 쿼리를 그대로 링크에 넣을 수 있다', () => {
    expect(
      drilldownHref('/zones/assembly', '', { process: null, factory: 'GBS', bay: 'GBS#3BAY' }),
    ).toBe('/zones/assembly?factory=GBS&bay=GBS%233BAY')
  })
})

describe('왕복 — URL 에 쓴 자리를 그대로 다시 읽는다', () => {
  it.each<DrilldownState>([
    YARD_DRILLDOWN,
    { process: '선행도장', factory: null, bay: null },
    { process: null, factory: '조립4공장-OFD1', bay: null },
    { process: null, factory: 'GBS', bay: 'GBS#3BAY' },
  ])('%o', (original) => {
    expect(parseDrilldown(writeDrilldown('?vessel=1234', original))).toEqual(original)
  })
})
