import { colorOfProcess, type LatLon, type YardParcels } from '../../../entities/yard-parcels'
import {
  listBlocks,
  sitesOfBlock,
  type AssyTier,
  type ProcessZone,
  type RosterBlock,
  YARD_PROCESS_OF_ZONE,
} from '../../../entities/vessel'

/*
 * 베이에 **지금 무엇이 서 있는가** (P1 ①).
 *
 * 총괄('/')의 공장·베이 상세는 면적·옥내외 같은 **기준정보**를 말하던 자리였다. 지번
 * 대장에서 온 그 숫자들은 어느 날 봐도 같아서, 매일 보는 화면에서는 아무 말도 하지
 * 않는다. 여기서 대신 말하는 것은 재실(在室)이다 — 이 베이에 어느 호선의 어느 블록·
 * ASSY 가 올라와 있는가.
 *
 * **원천은 로스터의 자리(`sitesOfBlock`)** 다. 여기서 배치를 새로 지어내지 않는다 —
 * 지도 마커·블록 검색·공정 화면이 전부 그 자리를 근거로 서 있으므로, 한 곳이라도
 * 제 계산을 하면 같은 블록이 화면마다 다른 데 있게 된다.
 *
 * ## 베이를 정하는 두 길
 *
 * 대부분의 자리는 로스터가 `mapBay`(공장 안의 베이 기호)를 들고 있다 — 그대로 쓴다.
 * **도장은 다르다**: 도장공장의 재실은 BTS(블록 추적)가 찍은 **좌표**로 오지, 누가
 * 베이 이름을 적어 주지 않는다. 그래서 좌표를 베이 기하에 떨어뜨려(point-in-bay)
 * 어느 칸인지 찾는다 — 현장의 사실(좌표)에서 화면의 단위(베이)를 유도하는 것이지,
 * 손으로 베이명을 붙여 두 자료를 어긋나게 두지 않는다.
 */

/** 이 베이에 서 있는 것 하나 — 블록 한 장, 또는 그 블록의 ASSY 묶음 */
export interface BayOccupant {
  /** `{호선}-{블록}` — 화면 표기이자 키 */
  key: string
  projNo: string
  blockNo: string
  /** 이 자리의 공정 — 블록 단계와 다를 수 있다(흩어진 ASSY) */
  zone: ProcessZone
  /** 이 자리에 올라온 ASSY 들. 블록 단위 자리면 빈 배열 */
  assys: readonly { assyNo: string; tier: AssyTier }[]
  /** 이 공정에 막 도착 — 실적이 아직 서기 전 */
  justArrived: boolean
  /** 그 블록의 공정 화면 경로 (자리가 준 것 그대로) */
  path: string
}

export interface BayOccupancy {
  /** `YardParcelBay.id` — `{공장}#{베이}` */
  bayId: string
  label: string
  occupants: BayOccupant[]
  /** 블록 수 — 행에 적는 첫 숫자 */
  blockCount: number
  /** 이 베이에 올라온 ASSY 총수 (조립 흩어짐). 없으면 0 */
  assyCount: number
}

/* ── 좌표 → 베이 (도장) ─────────────────────────────────────────── */

/** 점이 폴리곤 안에 있는가 — ray casting. 경도/위도를 x/y 로 그대로 쓴다(야드 규모에서 충분) */
function pointInPolygon(point: LatLon, polygon: readonly LatLon[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const straddles = a.lat > point.lat !== b.lat > point.lat
    if (!straddles) continue
    const x = ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon
    if (point.lon < x) inside = !inside
  }
  return inside
}

/**
 * 좌표가 떨어지는 베이 — 그 공장의 베이들만 본다(베이명은 공장 안에서만 유일하다).
 * 어느 지번에도 안 걸리면 null — 없는 칸을 지어내지 않는다.
 */
export function bayOfPoint(
  parcels: YardParcels,
  factory: string,
  point: LatLon
): string | null {
  const polygonOf = new Map(parcels.lots.map((lot) => [lot.lot, lot.polygon]))
  for (const bay of parcels.bays) {
    if (bay.factory !== factory) continue
    for (const code of bay.lotCodes) {
      const polygon = polygonOf.get(code)
      if (polygon && polygon.length >= 3 && pointInPolygon(point, polygon)) return bay.id
    }
  }
  return null
}

/* ── 자리 → 베이 ────────────────────────────────────────────────── */

/**
 * 이 자리가 앉는 베이 id. 도장은 BTS 좌표를 기하에 떨어뜨리고(위 주석), 나머지는
 * 로스터가 적어 둔 `mapBay` 를 쓴다. 어느 쪽으로도 못 정하면 null.
 */
function bayIdOfSite(
  parcels: YardParcels,
  site: { zone: ProcessZone; factory: string; mapBay?: string },
  block: RosterBlock
): string | null {
  if (site.zone === 'painting' && block.bts) {
    return bayOfPoint(parcels, site.factory, block.bts)
  }
  return site.mapBay ? `${site.factory}#${site.mapBay}` : null
}

/**
 * 한 공장의 베이별 재실 — 지도 매핑의 베이 순서 그대로, **빈 베이도 남긴다**.
 * 빈 칸을 지우면 "이 공장에 베이가 셋뿐"으로 읽혀 지도(스팬)와 목록이 어긋난다.
 */
export function factoryBayOccupancy(parcels: YardParcels, factory: string): BayOccupancy[] {
  const byBay = new Map<string, BayOccupant[]>()

  for (const block of listBlocks()) {
    for (const site of sitesOfBlock(block)) {
      if (site.factory !== factory) continue
      const bayId = bayIdOfSite(parcels, site, block)
      if (!bayId) continue
      const list = byBay.get(bayId) ?? []
      list.push({
        key: `${block.projNo}-${block.blockNo}`,
        projNo: block.projNo,
        blockNo: block.blockNo,
        zone: site.zone,
        assys: site.assys,
        justArrived: block.justArrived === true,
        path: site.path,
      })
      byBay.set(bayId, list)
    }
  }

  return parcels.bays
    .filter((bay) => bay.factory === factory)
    .map((bay) => {
      const occupants = byBay.get(bay.id) ?? []
      return {
        bayId: bay.id,
        label: bay.label,
        occupants,
        blockCount: occupants.length,
        assyCount: occupants.reduce((sum, o) => sum + o.assys.length, 0),
      }
    })
}

/** 베이 하나의 재실 — 베이 상세가 쓰는 자리. 없는 베이면 null */
export function bayOccupancyOf(parcels: YardParcels, bayId: string): BayOccupancy | null {
  const bay = parcels.bays.find((b) => b.id === bayId)
  if (!bay) return null
  return factoryBayOccupancy(parcels, bay.factory).find((row) => row.bayId === bayId) ?? null
}

/* ── 재실 → 작업 요약 ───────────────────────────────────────────── */

/**
 * 작업 종류 — ASSY 가 올라온 자리는 그 **급**(대조·중조·소조)이 곧 작업이고, ASSY 소재가
 * 없는 블록 단위 자리는 그 **공정**(의장 블록·도장 블록…)이 작업이다.
 */
export type BayWorkKind = AssyTier | ProcessZone

export interface BayWork {
  kind: BayWorkKind
  count: number
}

/** 표시 순서 — ASSY 는 작업 흐름대로 소조 → 중조 → 대조(사용자 확정), 그다음 블록 단위 공정을 흐름 순서로 */
const WORK_ORDER: readonly BayWorkKind[] = [
  'sub',
  'mid',
  'grand',
  'fabrication',
  'assembly',
  'outfitting',
  'painting',
]

/**
 * 재실을 "어떤 작업이 몇 개"로 접는다. 공장 카드는 블록 이름이 아니라 이 요약을 낸다 —
 * 어느 블록인지는 베이를 눌러 들어간 상세의 몫이다. 0 인 종류는 내지 않는다.
 *
 * **진행 중인 것만 센다** — 갓 반입(`justArrived`)은 자리에 올라왔을 뿐 작업이 아직
 * 서지 않았으므로 빼낸다.
 */
export function workSummaryOf(occupants: readonly BayOccupant[]): BayWork[] {
  const counts = new Map<BayWorkKind, number>()
  const add = (kind: BayWorkKind, n: number) => counts.set(kind, (counts.get(kind) ?? 0) + n)
  for (const occupant of occupants) {
    if (occupant.justArrived) continue
    if (occupant.assys.length === 0) add(occupant.zone, 1)
    else for (const assy of occupant.assys) add(assy.tier, 1)
  }
  return WORK_ORDER.filter((kind) => counts.has(kind)).map((kind) => ({
    kind,
    count: counts.get(kind)!,
  }))
}

/**
 * 작업 종류 색. 블록 단위 작업은 **그 공정의 색**(지도 네온과 같은 표)을 그대로 쓰고,
 * ASSY 급은 공정색과 겹치지 않는 세 색을 따로 둔다 — 조립 공장 안에서 대조·중조·소조가
 * 한눈에 갈려야 하므로 같은 파랑의 명암으로 묶지 않는다.
 */
const TIER_COLORS: Readonly<Record<AssyTier, string>> = {
  grand: '#b98cff',
  mid: '#2fd0e6',
  sub: '#a6e04a',
}

export function colorOfWork(kind: BayWorkKind): string {
  return kind in TIER_COLORS
    ? TIER_COLORS[kind as AssyTier]
    : colorOfProcess(YARD_PROCESS_OF_ZONE[kind as ProcessZone])
}

/**
 * 가공 공장에서 지금 가공 중인 블록 — 베이 없이 **공장 단위**로 센다(사용자 확정).
 *
 * 가공은 필드 수집이 없어 블록의 자리(베이)를 알 원천이 없다(`sitesOfBlock` 이 빈 배열).
 * 다만 로스터는 블록마다 지금 서 있는 공장을 갖고 있으므로, 그 공장 카드가 "여기서 무엇이
 * 가공되고 있는가"를 다른 공장의 작업 목록과 같은 모양으로 말할 수 있다.
 */
export function fabricationOccupantsOf(factory: string): BayOccupant[] {
  return listBlocks()
    .filter((block) => block.zone === 'fabrication' && block.factory === factory)
    .map((block) => ({
      key: `${block.projNo}-${block.blockNo}`,
      projNo: block.projNo,
      blockNo: block.blockNo,
      zone: block.zone,
      assys: [],
      justArrived: block.justArrived === true,
      path: '/indoorshop/zones/fabrication',
    }))
}
