import {
  findBlock,
  findVessel,
  pcdHrefOfAssy,
  pcdHrefOfOutfittingBlock,
  PCD_BLOCK_PARAM,
  performanceLinkFor,
  selectionQuery,
  zonePerformanceLinkFor,
  type AssyTier,
} from '../../../entities/vessel'
import {
  PAGE_VIEW_PARAM,
  PERFORMANCE_VIEW,
  VIEWER_TAB,
  WORKSPACE_TAB_PARAM,
  withWorkspaceTab,
} from '../../../lib/workspaceTabUrl'
import type { BayOccupant } from './bayOccupancy'

/*
 * 베이 카드의 작업 한 건(블록) — **자세히 보기**와 **3D 로 들어가기**의 재료.
 *
 * 경로는 로스터가 정본이다(`pcdHrefOf*` — 통합실적의 'PCD 뷰' 와 같은 문). 여기서 공정
 * 라우트를 새로 짓지 않는다. 블록 정반만 있고 흩어진 ASSY 가 없는 조립 블록은 로스터에
 * 문이 없어서, 같은 규칙(정반 상세 + `?block=` + `tab=viewer`)으로 한 줄만 보탠다.
 */

/**
 * 이 자리의 3D 뷰어 경로 — 3D 가 없는 공정(도장·가공)이면 null.
 *
 * `bayDetailPath` 는 이 베이와 짝지은 조립 작업 위치의 상세 경로다(드릴다운 계약). 정반이
 * 적히지 않은 조립 블록도 **지금 이 베이에 서 있다**는 사실은 확실하므로, 그 베이의 3D 로
 * 블록을 실어 보낸다.
 */
export function viewerHrefOfOccupant(
  occupant: BayOccupant,
  bayDetailPath: string | null = null
): string | null {
  if (occupant.zone === 'outfitting') {
    return pcdHrefOfOutfittingBlock(occupant.projNo, occupant.blockNo)
  }
  if (occupant.zone !== 'assembly') return null
  /* 흩어진 ASSY 가 이 베이에 서 있으면 그 ASSY 의 정반이 정본이다 */
  const first = occupant.assys[0]
  if (first) return pcdHrefOfAssy(first.assyNo)
  const berth = findBlock(occupant.projNo, occupant.blockNo)?.berth
  const base = berth ? `/indoorshop/zones/assembly/${berth.factoryId}/${berth.bayId}` : bayDetailPath
  if (!base) return null
  return withWorkspaceTab(
    `${base}?${PCD_BLOCK_PARAM}=${occupant.projNo}-${occupant.blockNo}`,
    VIEWER_TAB
  )
}

/**
 * **베이 하나의 공정 화면**을 특정 축(탭)으로 연 경로 — 블록을 고르지 않는다.
 * 베이 카드 머리의 '3D'(`VIEWER_TAB`)·'실적'(`BLOCKS_TAB`) 문이 쓴다.
 *
 * 조립은 짝지은 작업 위치(`bayDetailPath`, 정반 상세)다. 의장은 그 베이에 선 블록의 3D 문
 * (로스터 `pcdHrefOfOutfittingBlock`)에서 블록 선택을 떼고 축만 갈아 끼운다 — 의장 베이
 * 라우트를 여기서 새로 짓지 않는다. 그 축이 없는 공정(도장·가공)이나 근거가 없으면 null.
 */
export function bayTabHref(
  occupants: readonly BayOccupant[],
  bayDetailPath: string | null,
  tab: string
): string | null {
  if (bayDetailPath) return withWorkspaceTab(bayDetailPath, tab)
  for (const occupant of occupants) {
    if (occupant.zone !== 'outfitting') continue
    const href = pcdHrefOfOutfittingBlock(occupant.projNo, occupant.blockNo)
    if (!href) continue
    const [path, query = ''] = href.split('?')
    const params = new URLSearchParams(query)
    params.delete(PCD_BLOCK_PARAM)
    params.delete(WORKSPACE_TAB_PARAM)
    const rest = params.toString()
    return withWorkspaceTab(rest ? `${path}?${rest}` : path, tab)
  }
  return null
}

/** 베이 하나의 3D 뷰어 — `bayTabHref` 의 3D 축 */
export function bayViewerHref(
  occupants: readonly BayOccupant[],
  bayDetailPath: string | null
): string | null {
  return bayTabHref(occupants, bayDetailPath, VIEWER_TAB)
}

/** ASSY 한 덩이의 상세 — 카드의 칩 하나 */
export interface OccupantAssy {
  assyNo: string
  /** 화면 표기 — 블록 접두(`{호선}-{블록}-`)를 뗀 꼬리 (`G01`, `FR103C`) */
  shortName: string
  tier: AssyTier
  /** 실측 스캔이 이 덩이를 정합했는가 */
  scanned: boolean
}

const TIER_ORDER: Readonly<Record<AssyTier, number>> = { grand: 0, mid: 1, sub: 2 }

/** 이 자리에 선 ASSY 들 — 급 순(대조 → 중조 → 소조), 같은 급은 번호 순 */
export function assysOfOccupant(occupant: BayOccupant): OccupantAssy[] {
  const placements = findBlock(occupant.projNo, occupant.blockNo)?.assyUnits ?? []
  const prefix = `${occupant.projNo}-${occupant.blockNo}-`
  return occupant.assys
    .map((assy) => {
      const placement = placements.find((p) => p.assyNo === assy.assyNo)
      return {
        assyNo: assy.assyNo,
        shortName: assy.assyNo.startsWith(prefix) ? assy.assyNo.slice(prefix.length) : assy.assyNo,
        tier: assy.tier,
        scanned: placement?.scan != null,
      }
    })
    .sort(
      (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.assyNo.localeCompare(b.assyNo)
    )
}

/** 호선 표기 재료 — 선종을 모르면 null */
export function shipTypeOf(projNo: string): string | null {
  return findVessel(projNo)?.shipType ?? null
}

/**
 * 작업 카드의 **실적 문** — 이 블록(과 이 자리의 ASSY)을 고른 채로 여는 실적 화면.
 *
 * 조립·의장·도장 자리는 통합실적이 아니라 **그 공정 화면의 [실적] 갈래**에서 찾는다(사용자 확정) —
 * 그 자리의 공정 화면 경로(`occupant.path`)에 `?view=performance` 와 호선·블록·ASSY 조건을 싣는다.
 * 제 [실적] 갈래가 없는 공정(가공)은 지금처럼 통합실적이다.
 */
export function performanceHrefOfOccupant(occupant: BayOccupant): {
  href: string
  kind: 'assembly' | 'outfitting' | 'painting' | 'fabrication' | 'integrated'
} {
  const selection = {
    projNo: occupant.projNo,
    blocks: [occupant.blockNo],
    assys: occupant.assys.map((a) => a.assyNo),
  }
  const zone = occupant.zone
  /* 가공은 진입 화면이 곧 실적이다 — 같은 조건으로 가공 화면을 연다 */
  if (zone === 'fabrication') return { href: zonePerformanceLinkFor('fabrication', selection), kind: 'fabrication' }
  if (zone !== 'assembly' && zone !== 'outfitting' && zone !== 'painting') {
    return { href: performanceLinkFor(selection), kind: 'integrated' }
  }
  /* 자리가 준 경로의 쿼리(공장·베이 드릴다운)는 그대로 두고 조건만 얹는다 — 축 탭은 실적에 없다 */
  const [path, query = ''] = occupant.path.split('?', 2)
  const params = new URLSearchParams(query)
  params.delete(WORKSPACE_TAB_PARAM)
  new URLSearchParams(selectionQuery(selection)).forEach((value, key) => params.set(key, value))
  params.set(PAGE_VIEW_PARAM, PERFORMANCE_VIEW)
  return { href: `${path}?${params.toString()}`, kind: zone }
}
