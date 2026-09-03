import { describe, expect, it } from 'vitest'
import {
  buildEquipmentSearchCtx,
  searchAssys,
  searchBlocks,
  searchEquipment,
  searchGlobal,
  searchVessels,
  searchWos,
} from '../lib/searchIndex'
import { woEntriesOf } from '../lib/woIndex'
import {
  findBlock,
  listBlocks,
  parseSelectionParams,
  performanceLinkFor,
  selectionOfBlock,
} from '../../../entities/vessel'
import { parseDrilldown } from '../../../lib/drilldownUrl'

/*
 * 통합 검색의 규칙 — 그리고 **나가는 링크가 기존 계약으로 되읽히는가**.
 *
 * 링크 문자열을 눈으로 비교하는 대신, 도착지 화면이 실제로 쓰는 파서
 * (`parseSelectionParams` · `parseDrilldown`)에 넣어 되읽는다. 검색이 계약과 다른
 * 문법을 찍기 시작하면 여기가 먼저 깨진다 — "링크는 나가는데 화면이 못 알아듣는"
 * 사고를 계약 테스트로 막는 것이 이 파일의 요점이다.
 */

const BASE_DATE = '2026-09-03'

/** href 의 쿼리 부분 — 도착지 파서에 넣을 재료 */
const queryOf = (href: string) => new URLSearchParams(href.split('?')[1] ?? '')

describe('호선 검색', () => {
  it('호선번호 부분일치 → 통합실적 호선 전체 조회(?vessel=)로 되읽힌다', () => {
    const hits = searchVessels('7004')
    expect(hits).toHaveLength(1)
    expect(hits[0].title).toBe('7004호')
    expect(parseSelectionParams(queryOf(hits[0].href))).toEqual({ projNo: '7004', blocks: [] })
  })

  it('선종으로도 걸린다 — LNGC 를 치면 LNGC 호선들', () => {
    const hits = searchVessels('lngc')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((hit) => hit.subtitle === 'LNGC')).toBe(true)
  })

  it('빈 질의는 빈 결과 — 입력 전에 목록을 펼치지 않는다', () => {
    expect(searchVessels('  ')).toEqual([])
  })
})

describe('블록 검색', () => {
  it('블록키 질의 → 그 블록의 통합실적(performanceLinkFor)과 같은 링크', () => {
    const hits = searchBlocks('2540-281')
    expect(hits.length).toBeGreaterThan(0)
    const block = findBlock('2540', '281')
    expect(block).not.toBeNull()
    expect(hits[0].href).toBe(performanceLinkFor(selectionOfBlock(block!)))
    expect(parseSelectionParams(queryOf(hits[0].href))).toEqual({
      projNo: '2540',
      blocks: ['281'],
    })
  })

  it('구분자 표기가 달라도 같은 블록이 나온다 (2540_281 · 2540 281)', () => {
    const a = searchBlocks('2540_281').map((hit) => hit.id)
    const b = searchBlocks('2540 281').map((hit) => hit.id)
    expect(a).toEqual(searchBlocks('2540-281').map((hit) => hit.id))
    expect(b).toEqual(a)
  })
})

describe('ASSY 검색', () => {
  /* 로스터에서 실제 ASSY 하나 — 데이터를 하드코딩하면 로스터 개편 때 테스트가 거짓말한다 */
  const anyAssy = listBlocks()
    .flatMap((block) => (block.assyUnits ?? []).map((unit) => ({ block, unit })))
    .find((entry) => entry.unit.assyNo)!

  it('ASSY_NO 가 단서인 질의 → ?assy= 포커스 딥링크로 되읽힌다', () => {
    /* 블록키가 아닌 꼬리(STRC+SER)로 찾는다 — ASSY 가 실제 단서인 상황 */
    const tail = anyAssy.unit.assyNo.split('-').slice(1).join('-')
    const hits = searchAssys(tail)
    const hit = hits.find((h) => h.title === anyAssy.unit.assyNo)
    expect(hit).toBeDefined()
    const parsed = parseSelectionParams(queryOf(hit!.href))
    expect(parsed?.projNo).toBe(anyAssy.block.projNo)
    expect(parsed?.blocks).toEqual([anyAssy.block.blockNo])
    expect(parsed?.assys).toContain(anyAssy.unit.assyNo)
  })

  it('블록키로 이미 걸린 질의에는 ASSY 를 내밀지 않는다 (블록 그룹의 몫)', () => {
    expect(searchAssys(`${anyAssy.block.projNo}-${anyAssy.block.blockNo}`)).toEqual([])
  })
})

describe('W/O 검색', () => {
  const entries = woEntriesOf(BASE_DATE)

  it('색인에 조립·도장 W/O 가 모두 들어 있다', () => {
    expect(entries.some((entry) => entry.source === 'assembly')).toBe(true)
    expect(entries.some((entry) => entry.source === 'painting')).toBe(true)
    expect(entries.every((entry) => /^WO-\d{5}$/.test(entry.woNo))).toBe(true)
  })

  it('W/O 번호 → 그 블록의 통합실적으로 되읽힌다', () => {
    const entry = entries[0]
    const hits = searchWos(entry.woNo, entries)
    expect(hits.length).toBeGreaterThan(0)
    const hit = hits.find((h) => h.title === entry.woNo)!
    expect(parseSelectionParams(queryOf(hit.href))).toEqual({
      projNo: entry.projNo,
      blocks: [entry.blockNo],
    })
  })

  it('같은 기준일이면 색인이 결정론적이다 — 화면의 W/O 번호와 어긋나지 않는 근거', () => {
    expect(woEntriesOf(BASE_DATE)).toEqual(entries)
  })
})

describe('설비 검색', () => {
  const ctx = buildEquipmentSearchCtx({
    factories: [
      { name: '3DS', process: '조립' },
      { name: 'POS 1공장', process: '의장' },
      { name: '1DOCK 도장공장', process: '도장' },
      { name: 'CAS', process: '가공' },
      { name: '해양절단공장', process: '가공' },
    ],
    bays: [{ id: '3DS#1' }, { id: '1DOCK 도장공장#B1' }],
  })

  it('공정 이름 → 공정존 매핑 + CAS·PAS 는 조립 맵 소속(확정 사항)', () => {
    expect(ctx.zoneOfFactory.get('3DS')).toBe('assembly')
    expect(ctx.zoneOfFactory.get('POS 1공장')).toBe('outfitting')
    expect(ctx.zoneOfFactory.get('1DOCK 도장공장')).toBe('painting')
    expect(ctx.zoneOfFactory.get('CAS')).toBe('assembly')
    /* 가공 일반 공장은 맵 화면이 없다 — 검색이 갈 곳 없는 링크를 만들면 안 된다 */
    expect(ctx.zoneOfFactory.has('해양절단공장')).toBe(false)
  })

  it('설비ID → 그 공정 맵의 공장·베이 드릴다운(drilldownHref)으로 되읽힌다', () => {
    const hits = searchEquipment('LD-D01', ctx)
    expect(hits.length).toBeGreaterThan(0)
    const hit = hits[0]
    expect(hit.href.startsWith('/zones/assembly?')).toBe(true)
    expect(parseDrilldown(queryOf(hit.href))).toEqual({
      process: null,
      factory: '3DS',
      bay: '3DS#1',
    })
  })

  it('지도에 없는 베이는 공장 단계까지만 싣는다', () => {
    /* PNL-D1 은 3DS 2BAY 에 서지만 위 ctx 의 실재 베이 목록에는 3DS#1 뿐이다 */
    const hit = searchEquipment('PNL-D1', ctx).find((h) => h.title === 'PNL-D1')
    expect(hit).toBeDefined()
    expect(parseDrilldown(queryOf(hit!.href)).factory).toBe('3DS')
    expect(parseDrilldown(queryOf(hit!.href)).bay).toBeNull()
  })

  it('문맥(지번)이 아직 없으면 설비 그룹만 비어 있다', () => {
    expect(searchEquipment('LD-D01', null)).toEqual([])
  })

  it('도장 설비(EQ*)는 도장 맵으로 간다', () => {
    const hits = searchEquipment('EQ001', ctx)
    expect(hits.length).toBe(1)
    expect(hits[0].href.startsWith('/zones/painting?')).toBe(true)
    expect(parseDrilldown(queryOf(hits[0].href)).factory).toBe('1DOCK 도장공장')
  })
})

describe('통합 검색', () => {
  const sources = { wos: woEntriesOf(BASE_DATE), equipment: null }

  it('그룹 순서는 호선 → 블록 → ASSY → W/O → 설비', () => {
    const hits = searchGlobal('7004', sources)
    const order = [...new Set(hits.map((hit) => hit.group))]
    const canonical: readonly (typeof order)[number][] = [
      'vessel',
      'block',
      'assy',
      'wo',
      'equipment',
    ]
    expect(order).toEqual(canonical.filter((group) => order.includes(group)))
    expect(order[0]).toBe('vessel')
  })

  it('아무 데도 걸리지 않는 질의는 빈 결과 (0건 문구의 근거)', () => {
    expect(searchGlobal('존재하지않는질의zzz', sources)).toEqual([])
  })
})
