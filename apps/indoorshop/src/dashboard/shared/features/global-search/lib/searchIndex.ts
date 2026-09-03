import {
  assyFocusLinkFor,
  listBlocks,
  listVessels,
  matchedAssyNos,
  normalizeBlockQuery,
  performanceLinkFor,
  searchRosterBlocks,
  selectionOfBlock,
  YARD_PROCESS_OF_ZONE,
  type ProcessZone,
} from '../../../entities/vessel'
import { equipmentTypeOf, YARD_EQUIPMENT } from '../../../entities/equipment'
import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'
import type { WoEntry } from './woIndex'

/*
 * 통합 검색(Cmd+K)의 검색 규칙 — **전부 기존 계약의 소비자다.**
 *
 * 이 파일은 새 문법을 하나도 만들지 않는다. 질의 정규화는 블록 검색의
 * `normalizeBlockQuery` 그대로이고(같은 글자에 다른 결과가 나오면 안 된다), 나가는
 * 링크는 전부 기존 계약이 찍는다 — 통합실적은 `performanceLinkFor`/`assyFocusLinkFor`
 * (`?vessel=&block=&assy=`), 공정 맵은 `drilldownHref`(`?factory=&bay=`). 링크 문자열을
 * 여기서 손으로 조립하면 계약이 바뀔 때 검색만 낡은 주소로 남는다.
 *
 * 순수 함수만 둔다 — React 도 저장소도 모른다. 팔레트(ui/)는 이 결과를 그리기만 한다.
 */

/** 결과 그룹 — 팔레트가 이 순서대로 단을 세운다 (사람이 찾는 빈도 순: 호선·블록이 먼저) */
export type SearchGroup = 'vessel' | 'block' | 'assy' | 'wo' | 'equipment'

export const SEARCH_GROUPS: readonly SearchGroup[] = [
  'vessel',
  'block',
  'assy',
  'wo',
  'equipment',
]

export interface SearchHit {
  /** 목록 key + aria-activedescendant 재료 — 그룹 안에서 유일 */
  id: string
  group: SearchGroup
  /** 주 표기 (호선번호·블록키·ASSY_NO·W/O·설비ID — 전부 코드형이라 mono 로 선다) */
  title: string
  /** 부가 맥락 — 데이터 어휘(공정 이름·공장·베이)로만 짓는다 (번역 대상이 아닌 고유명) */
  subtitle: string | null
  /** 이동 주소 — 기존 계약이 찍은 것 그대로 */
  href: string
}

/** 그룹당 상한 — 팔레트 한 화면에 다섯 그룹이 다 서도 스크롤이 짧게 끝나는 크기 */
const GROUP_LIMIT = 6

/* ── 호선 ─────────────────────────────────────────────────────── */

/** 호선번호(또는 선종) 부분일치 → 통합실적 '호선 전체' 조회 */
export function searchVessels(query: string, limit = GROUP_LIMIT): SearchHit[] {
  const q = normalizeBlockQuery(query)
  if (!q) return []
  const hits: SearchHit[] = []
  for (const vessel of listVessels()) {
    if (!vessel.projNo.includes(q) && !vessel.shipType.toLowerCase().includes(q)) continue
    hits.push({
      id: `vessel:${vessel.projNo}`,
      group: 'vessel',
      title: `${vessel.projNo}호`,
      subtitle: vessel.shipType,
      href: performanceLinkFor({ projNo: vessel.projNo, blocks: [] }),
    })
    if (hits.length >= limit) break
  }
  return hits
}

/* ── 블록 ─────────────────────────────────────────────────────── */

/** 로스터 블록 검색(기존 색인 재사용) → 그 블록의 통합실적 */
export function searchBlocks(query: string, limit = GROUP_LIMIT): SearchHit[] {
  return searchRosterBlocks(query, limit).map((block) => ({
    id: `block:${block.projNo}-${block.blockNo}`,
    group: 'block',
    title: `${block.projNo}-${block.blockNo}`,
    subtitle: `${YARD_PROCESS_OF_ZONE[block.zone]} · ${block.factory}`,
    href: performanceLinkFor(selectionOfBlock(block)),
  }))
}

/* ── ASSY ─────────────────────────────────────────────────────── */

/**
 * ASSY_NO 가 **실제 단서였던** 검색 — `matchedAssyNos` 의 규칙 그대로, 블록키로 이미
 * 걸린 질의에는 ASSY 를 내밀지 않는다(그건 블록 그룹의 몫이다). 링크는 그 ASSY 로
 * 포커스된 통합실적(`?assy=` 딥링크)이다.
 */
export function searchAssys(query: string, limit = GROUP_LIMIT): SearchHit[] {
  const hits: SearchHit[] = []
  for (const block of listBlocks()) {
    for (const assyNo of matchedAssyNos(block, query)) {
      const href = assyFocusLinkFor([assyNo])
      if (!href) continue /* 로스터가 모르는 조합이면 갈 곳이 없다 — 내지 않는다 */
      const placement = block.assyUnits?.find((unit) => unit.assyNo === assyNo)
      hits.push({
        id: `assy:${assyNo}`,
        group: 'assy',
        title: assyNo,
        subtitle: placement
          ? `${block.projNo}-${block.blockNo} · ${placement.factory}`
          : `${block.projNo}-${block.blockNo}`,
        href,
      })
      if (hits.length >= limit) return hits
    }
  }
  return hits
}

/* ── W/O ──────────────────────────────────────────────────────── */

/** W/O 번호 부분일치 → 그 블록의 통합실적 (색인은 woIndex 가 만들어 온다) */
export function searchWos(
  query: string,
  entries: readonly WoEntry[],
  limit = GROUP_LIMIT
): SearchHit[] {
  const q = normalizeBlockQuery(query)
  if (!q) return []
  const hits: SearchHit[] = []
  for (const entry of entries) {
    if (!normalizeBlockQuery(entry.woNo).includes(q)) continue
    const zone: ProcessZone = entry.source === 'assembly' ? 'assembly' : 'painting'
    hits.push({
      id: `wo:${entry.woNo}:${entry.projNo}-${entry.blockNo}:${entry.source}`,
      group: 'wo',
      title: entry.woNo,
      subtitle: `${entry.projNo}-${entry.blockNo} · ${YARD_PROCESS_OF_ZONE[zone]}`,
      href: performanceLinkFor({ projNo: entry.projNo, blocks: [entry.blockNo] }),
    })
    if (hits.length >= limit) break
  }
  return hits
}

/* ── 설비 ─────────────────────────────────────────────────────── */

/**
 * 설비가 검색에서 이동할 곳을 알려면 두 가지가 필요하다 — 공장이 **어느 공정 맵**의
 * 주인공인지, 그리고 설비의 (공장, 베이)가 지도 베이로 실재하는지. 둘 다 야드
 * 지번 데이터(yard-parcels)가 정본이고 그 로더는 비동기라, 팔레트가 한 번 로드해
 * 이 형태로 내려 준다. 아직 안 왔으면 설비 그룹만 비어 있다(다른 그룹은 정적이다).
 */
export interface EquipmentSearchCtx {
  /** 지도 공장명 → 그 공장이 서는 공정 맵의 zone */
  zoneOfFactory: ReadonlyMap<string, ProcessZone>
  /** 실재하는 지도 베이 id (`{공장}#{베이}`) — 없는 베이를 URL 에 싣지 않는다 */
  validBayIds: ReadonlySet<string>
}

/** 야드 공정 이름(조립/의장/도장/가공) → 공정존 — YARD_PROCESS_OF_ZONE 의 역방향 */
const ZONE_OF_PROCESS_NAME: ReadonlyMap<string, ProcessZone> = new Map(
  (Object.entries(YARD_PROCESS_OF_ZONE) as [ProcessZone, string][]).map(([zone, name]) => [
    name,
    zone,
  ])
)

/**
 * 공정 분류는 '가공'이지만 **조립 맵이 주인공으로 세우는** 라인 — CAS·PAS.
 *
 * 설비 fixture 의 확정 사항("실적 권역만 조립 취급") 그대로다. 가공 화면에는 지도가
 * 없으므로(placeholder) 이 둘의 설비는 조립 맵으로 보낸다. shared 는 processes 를
 * import 할 수 없어 조립 모듈의 상수를 못 읽는다 — 로스터의 공장 id 와 같은
 * **문자열 계약**으로 잇고, 어긋나면 조립 쪽 테스트가 잡는다.
 */
const ASSEMBLY_HOSTED_FABRICATION_LINES: readonly string[] = ['CAS', 'PAS']

/** 지번 데이터(공장 공정 + 베이 id)를 설비 검색 문맥으로 — 팔레트가 로드 후 한 번 부른다 */
export function buildEquipmentSearchCtx(parcels: {
  factories: readonly { name: string; process: string }[]
  bays: readonly { id: string }[]
}): EquipmentSearchCtx {
  const zoneOfFactory = new Map<string, ProcessZone>()
  for (const factory of parcels.factories) {
    if (ASSEMBLY_HOSTED_FABRICATION_LINES.includes(factory.name)) {
      zoneOfFactory.set(factory.name, 'assembly')
      continue
    }
    const zone = ZONE_OF_PROCESS_NAME.get(factory.process)
    /* 가공은 맵 화면이 없다 — 갈 곳 없는 설비는 검색에 내지 않는다 (CAS·PAS 만 예외) */
    if (zone && zone !== 'fabrication') zoneOfFactory.set(factory.name, zone)
  }
  return { zoneOfFactory, validBayIds: new Set(parcels.bays.map((bay) => bay.id)) }
}

/** 설비ID 부분일치 → 그 공정 맵의 공장(베이가 실재하면 베이까지) 드릴다운 */
export function searchEquipment(
  query: string,
  ctx: EquipmentSearchCtx | null,
  limit = GROUP_LIMIT
): SearchHit[] {
  const q = normalizeBlockQuery(query)
  if (!q || !ctx) return []
  const hits: SearchHit[] = []
  for (const equipment of YARD_EQUIPMENT) {
    if (!normalizeBlockQuery(equipment.id).includes(q)) continue
    const zone = ctx.zoneOfFactory.get(equipment.factory)
    if (!zone) continue
    const bayId = `${equipment.factory}#${equipment.bay}`
    const bay = equipment.bay && ctx.validBayIds.has(bayId) ? bayId : null
    const typeName = equipmentTypeOf(equipment.typeId)?.name
    const place = equipment.bay ? `${equipment.factory} ${equipment.bay}BAY` : equipment.factory
    hits.push({
      id: `equipment:${equipment.id}`,
      group: 'equipment',
      title: equipment.id,
      subtitle: typeName ? `${typeName} · ${place}` : place,
      href: drilldownHref(`/zones/${zone}`, '', {
        ...YARD_DRILLDOWN,
        factory: equipment.factory,
        bay,
      }),
    })
    if (hits.length >= limit) break
  }
  return hits
}

/* ── 통합 ─────────────────────────────────────────────────────── */

/** 다섯 그룹을 한 번에 — 그룹 순서는 SEARCH_GROUPS, 각 그룹 상한 GROUP_LIMIT */
export function searchGlobal(
  query: string,
  sources: { wos: readonly WoEntry[]; equipment: EquipmentSearchCtx | null }
): SearchHit[] {
  if (!normalizeBlockQuery(query)) return []
  return [
    ...searchVessels(query),
    ...searchBlocks(query),
    ...searchAssys(query),
    ...searchWos(query, sources.wos),
    ...searchEquipment(query, sources.equipment),
  ]
}
