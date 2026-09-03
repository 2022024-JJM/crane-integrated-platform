import { describe, expect, it } from 'vitest'
import {
  buildEquipmentSearchCtx,
  searchAssys,
  searchBlocks,
  searchEquipment,
  mapFocusHref,
  searchGlobal,
  searchVessels,
  searchWos,
} from '../lib/searchIndex'
import { woEntriesOf } from '../lib/woIndex'
import {
  blocksOfVessel,
  findBlock,
  listBlocks,
  parseSelectionParams,
  selectionOfBlock,
} from '../../../entities/vessel'
import { parseDrilldown } from '../../../lib/drilldownUrl'
import { searchYardBlocks } from '../lib/searchIndex'
import { parseMapFocus } from '../lib/mapFocus'
import type { YardBackdropBlock } from '../../../model/yardMapBackdrop'

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
  it('호선번호 부분일치 → **총괄 지도**로 가고, 그 호선 블록 전부가 대상이 된다', () => {
    const hits = searchVessels('7004')
    expect(hits).toHaveLength(1)
    expect(hits[0].title).toBe('7004호')
    /* 행선지는 지도('/') — 호선의 답은 실적 표가 아니라 자리들의 분포다 */
    expect(hits[0].href.startsWith('/?')).toBe(true)
    expect(parseSelectionParams(queryOf(hits[0].href))).toEqual({ projNo: '7004', blocks: [] })

    const focus = parseMapFocus(queryOf(hits[0].href), null)
    expect(focus?.kind).toBe('vessel')
    expect(focus?.blocks.length).toBe(blocksOfVessel('7004').length)
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
  it('블록키 질의 → **총괄 지도**에 그 블록의 자리 (선택 계약 철자 그대로)', () => {
    const hits = searchBlocks('2540-281')
    expect(hits.length).toBeGreaterThan(0)
    const block = findBlock('2540', '281')
    expect(block).not.toBeNull()
    expect(hits[0].href).toBe(mapFocusHref(selectionOfBlock(block!)))
    expect(hits[0].href.startsWith('/?')).toBe(true)
    expect(parseSelectionParams(queryOf(hits[0].href))).toEqual({
      projNo: '2540',
      blocks: ['281'],
    })

    const focus = parseMapFocus(queryOf(hits[0].href), null)
    expect(focus?.kind).toBe('block')
    expect(focus?.blocks.map((b) => b.blockNo)).toEqual(['281'])
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

  it('ASSY_NO 가 단서인 질의 → **총괄 지도**의 ?assy= 포커스로 되읽힌다', () => {
    /* 블록키가 아닌 꼬리(STRC+SER)로 찾는다 — ASSY 가 실제 단서인 상황 */
    const tail = anyAssy.unit.assyNo.split('-').slice(1).join('-')
    const hits = searchAssys(tail)
    const hit = hits.find((h) => h.title === anyAssy.unit.assyNo)
    expect(hit).toBeDefined()
    expect(hit!.href.startsWith('/?')).toBe(true)
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

  it('W/O 번호 → **통합실적**으로 되읽힌다 (W/O 는 자리가 아니라 실적 축의 이름이다)', () => {
    const entry = entries[0]
    const hits = searchWos(entry.woNo, entries)
    expect(hits.length).toBeGreaterThan(0)
    const hit = hits.find((h) => h.title === entry.woNo)!
    expect(hit.href.startsWith('/indoorshop/performance?')).toBe(true)
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
    expect(hit.href.startsWith('/indoorshop/zones/assembly?')).toBe(true)
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
    expect(hits[0].href.startsWith('/indoorshop/zones/painting?')).toBe(true)
    expect(parseDrilldown(queryOf(hits[0].href)).factory).toBe('1DOCK 도장공장')
  })
})

describe('야드 실측 위치(BTS) 검색', () => {
  /* 로스터가 **모르는** 블록이라야 이 색인의 존재 이유가 검증된다 — 5510은 P6에서
     로스터에 편입돼(실측 5BAY) 더는 이 표본이 될 수 없다. 9910은 가상 호선이다. */
  const yardIndex: YardBackdropBlock[] = [
    {
      id: '9910_726_S1',
      projNo: '9910',
      blkNo: '726',
      lat: 34.89,
      lon: 128.68,
      lot: 'PB5B01',
      lotLabel: 'PBS 5 BAY 남쪽-01',
      updatedAt: '20260903141500',
    },
  ]

  it('원문 ID·호선-블록 어느 쪽으로도 걸린다 (로스터와 같은 질의 정규화)', () => {
    /* 사람이 치는 표기(`5510-726`·`5510 726`)와 원문 ID(`_` 구분)가 같은 것으로 걸려야
       한다 — 구분자 차이로 검색이 안 되면 기능이 없는 것과 같다 (옛 filterBlockIndex 계약) */
    for (const q of ['9910_726', '9910-726', '9910 726', '726']) {
      expect(searchYardBlocks(q, yardIndex).map((hit) => hit.id)).toContain('yard:9910_726_S1')
    }
  })

  it('빈 질의·색인 없음은 빈 결과 — 색인 전체를 쏟아내지 않는다', () => {
    expect(searchYardBlocks('  ', yardIndex)).toEqual([])
    expect(searchYardBlocks('9910', null)).toEqual([])
  })

  it('limit 을 넘지 않는다', () => {
    const two = [...yardIndex, { ...yardIndex[0], id: '9910_727', blkNo: '727' }]
    expect(searchYardBlocks('9910', two, 1)).toHaveLength(1)
  })

  it('행선지는 블록과 **같은 철자** — 지도가 로스터에서 못 찾으면 이 색인으로 물러난다', () => {
    const hit = searchYardBlocks('9910-726', yardIndex)[0]
    expect(hit.href.startsWith('/?')).toBe(true)
    /* 로스터가 모르는 호선이라 선택 계약은 null 이다 — 그래서 2단 해석이 필요하다 */
    expect(parseSelectionParams(queryOf(hit.href))).toBeNull()

    const focus = parseMapFocus(queryOf(hit.href), yardIndex)
    expect(focus?.kind).toBe('yard')
    expect(focus?.yard?.id).toBe('9910_726_S1')
    expect(focus?.label).toBe('9910-726')
  })

  it('색인이 아직 안 왔으면 그 자리는 포커스가 없다 — 틀린 자리를 먼저 찍지 않는다', () => {
    const hit = searchYardBlocks('9910-726', yardIndex)[0]
    expect(parseMapFocus(queryOf(hit.href), null)).toBeNull()
  })
})

describe('통합 검색', () => {
  const sources = { wos: woEntriesOf(BASE_DATE), equipment: null, yard: null }

  it('그룹 순서는 호선 → 블록 → ASSY → 야드 → W/O → 설비', () => {
    const hits = searchGlobal('7004', sources)
    const order = [...new Set(hits.map((hit) => hit.group))]
    const canonical: readonly (typeof order)[number][] = [
      'vessel',
      'block',
      'assy',
      'yard',
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
