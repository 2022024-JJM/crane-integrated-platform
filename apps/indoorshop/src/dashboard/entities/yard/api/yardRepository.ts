import {
  LOT_CATEGORIES,
  LOT_CATEGORY_COLORS,
  LOT_GROUPS,
  PLACE_TYPES,
  RAW_BLOCKS,
  RAW_LOTS,
  USE_TYPES,
  WIP_TYPES,
  YARD_ORIGIN,
} from './btsFixture'
import {
  MOVE_CREWS,
  MOVE_DATES,
  MOVE_TRANSPORTERS,
  RAW_MOVES,
  RAW_PLANS,
} from './routeFixture'
import type { LatLon, LatLonBounds, YardBlock, YardLot, YardMove, YardPlan } from '../model/types'
import { boundsOf, mergeBounds, parseTransportObjectId } from '../model/types'

/**
 * 접어 둔 고정 데이터를 도메인 모델로 편다.
 *
 * 화면이 뜰 때 한 번만 돌면 되므로 모듈 수준에서 즉시 계산한다 — 지번 1,977건 ·
 * 블록 669건이라 수 ms 다. 대신 **결과는 공유한다**: 목록과 맵이 같은 배열을 보고
 * 있어야 필터가 만든 부분집합을 참조 비교로 걸러낼 수 있다.
 *
 * 실연동 시 이 파일의 함수 구현만 실제 조회(NB202M / SDE.GIF_LOTSMALL)로 교체하면 되고,
 * 호출부(컴포넌트)는 수정이 필요 없다.
 */

const at = (list: readonly string[], index: number): string | null =>
  index < 0 ? null : (list[index] ?? null)

/** 저장된 1e-6도 정수 오프셋을 위경도로 되돌린다 */
const lat = (v: number) => YARD_ORIGIN.lat + v / 1e6
const lon = (v: number) => YARD_ORIGIN.lon + v / 1e6

const lots: YardLot[] = RAW_LOTS.map((row) => {
  const [code, description, category, useType, wip, place, area, group] = row
  const quad: LatLon[] = [
    { lat: lat(row[8]), lon: lon(row[9]) },
    { lat: lat(row[10]), lon: lon(row[11]) },
    { lat: lat(row[12]), lon: lon(row[13]) },
    { lat: lat(row[14]), lon: lon(row[15]) },
  ]
  return {
    lot: code,
    description,
    category: LOT_CATEGORIES[category] ?? '기타·물류',
    useType: at(USE_TYPES, useType),
    wip: at(WIP_TYPES, wip),
    place: at(PLACE_TYPES, place),
    area,
    group: at(LOT_GROUPS, group),
    quad,
    center: {
      lat: (quad[0].lat + quad[1].lat + quad[2].lat + quad[3].lat) / 4,
      lon: (quad[0].lon + quad[1].lon + quad[2].lon + quad[3].lon) / 4,
    },
    bounds: boundsOf(quad),
  }
})

const blocks: YardBlock[] = RAW_BLOCKS.map(([id, y, x, lotCode, mntDate, mntTime, source]) => {
  const { projNo, blkNo, suffix } = parseTransportObjectId(id)
  return {
    id,
    projNo,
    blkNo,
    suffix,
    lat: lat(y),
    lon: lon(x),
    lot: lotCode || null,
    updatedAt: mntDate ? `${mntDate}${mntTime.padStart(6, '0')}` : null,
    source: source || null,
  }
})

/** 지번 → 그 지번에 서 있는 블록 */
const blocksByLot = new Map<string, YardBlock[]>()
for (const block of blocks) {
  if (!block.lot) continue
  const bucket = blocksByLot.get(block.lot)
  if (bucket) bucket.push(block)
  else blocksByLot.set(block.lot, [block])
}

const lotByCode = new Map(lots.map((lot) => [lot.lot, lot]))

/** 야드 전체 범위 — 맵의 기본 시야 */
const extent: LatLonBounds = lots.reduce(
  (acc, lot) => mergeBounds(acc, lot.bounds),
  lots[0]?.bounds ?? { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 }
)

/** 성격 → 색. 레퍼런스 뷰어의 배색을 그대로 쓴다 (현장이 이미 그 색으로 야드를 읽는다) */
const categoryColor = new Map(LOT_CATEGORIES.map((c, i) => [c, LOT_CATEGORY_COLORS[i]]))

export function fetchYardLots(): YardLot[] {
  return lots
}

export function fetchYardBlocks(): YardBlock[] {
  return blocks
}

export function yardExtent(): LatLonBounds {
  return extent
}

export function lotCategories(): { category: string; color: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const lot of lots) counts.set(lot.category, (counts.get(lot.category) ?? 0) + 1)
  return LOT_CATEGORIES.map((category) => ({
    category,
    color: categoryColor.get(category) ?? '#9a9890',
    count: counts.get(category) ?? 0,
  }))
}

export function colorOfCategory(category: string): string {
  return categoryColor.get(category) ?? '#9a9890'
}

export function findLot(code: string | null | undefined): YardLot | null {
  return code ? (lotByCode.get(code) ?? null) : null
}

export function blocksInLot(code: string): YardBlock[] {
  return blocksByLot.get(code) ?? []
}

/** 블록이 실제로 서 있는 지번 수 — 요약 줄에서 "쓰이는 지번"을 말할 때 쓴다 */
export function occupiedLotCount(): number {
  return blocksByLot.size
}

/**
 * 용도별 지번 수 — 많은 순. 필터 칩이 이 순서를 그대로 쓴다.
 *
 * 필터는 성격(일곱 갈래)이 아니라 **용도**로 건다. 성격은 색이 이미 말하고 있고,
 * "적치장만 보자"처럼 실제로 거는 조건은 언제나 용도 단위다.
 */
export function lotCountsByUseType(): { useType: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const lot of lots) {
    if (!lot.useType) continue
    counts.set(lot.useType, (counts.get(lot.useType) ?? 0) + 1)
  }
  return [...counts]
    .map(([useType, count]) => ({ useType, count }))
    .sort((a, b) => b.count - a.count || a.useType.localeCompare(b.useType))
}

/* ── 일일 블록 이동 ── */

const time = (v: string) => v || null

const moves: YardMove[] = RAW_MOVES.map(
  ([dateIdx, from, to, crewIdx, tpIdx, hh, onRoad, length, packed]) => {
    const path: LatLon[] = []
    for (let i = 0; i < packed.length; i += 2) {
      path.push({ lat: lat(packed[i]), lon: lon(packed[i + 1]) })
    }
    return {
      date: MOVE_DATES[dateIdx],
      from,
      to,
      crew: at(MOVE_CREWS, crewIdx),
      transporter: at(MOVE_TRANSPORTERS, tpIdx),
      time: time(hh),
      onRoad: onRoad === 1,
      length,
      path,
      bounds: boundsOf(path),
    }
  }
)

const plans: YardPlan[] = RAW_PLANS.map(
  ([dateIdx, blockId, from, to, hh, hh2, crewIdx, tpIdx, atLat, atLon, packed]) => {
    const path: LatLon[] = []
    for (let i = 0; i < packed.length; i += 2) {
      path.push({ lat: lat(packed[i]), lon: lon(packed[i + 1]) })
    }
    return {
      date: MOVE_DATES[dateIdx],
      blockId,
      from: from || null,
      to,
      startTime: time(hh),
      endTime: time(hh2),
      crew: at(MOVE_CREWS, crewIdx),
      transporter: at(MOVE_TRANSPORTERS, tpIdx),
      at: atLat === null || atLon === null ? null : { lat: lat(atLat), lon: lon(atLon) },
      path,
    }
  }
)

/* 날짜별로 미리 갈라 둔다 — 날을 넘길 때마다 452건을 훑지 않도록 */
const movesByDate = new Map<string, YardMove[]>()
for (const move of moves) {
  const bucket = movesByDate.get(move.date)
  if (bucket) bucket.push(move)
  else movesByDate.set(move.date, [move])
}

const plansByDate = new Map<string, YardPlan[]>()
for (const plan of plans) {
  const bucket = plansByDate.get(plan.date)
  if (bucket) bucket.push(plan)
  else plansByDate.set(plan.date, [plan])
}

/** 이동 기록이 있는 날 — 오름차순. 실적이 많은 날이 기본값이 된다 */
export function moveDates(): string[] {
  return [...MOVE_DATES]
}

/** 실적이 가장 많은 날 — 처음 열었을 때 빈 야드를 보여 주지 않기 위한 기본 선택 */
export function busiestMoveDate(): string {
  let best = MOVE_DATES[0]
  let bestCount = -1
  for (const date of MOVE_DATES) {
    const count = movesByDate.get(date)?.length ?? 0
    if (count > bestCount) {
      bestCount = count
      best = date
    }
  }
  return best
}

export function movesOn(date: string): YardMove[] {
  return movesByDate.get(date) ?? []
}

export function plansOn(date: string): YardPlan[] {
  return plansByDate.get(date) ?? []
}
