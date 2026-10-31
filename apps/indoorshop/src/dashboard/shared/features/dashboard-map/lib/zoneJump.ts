import { BLOCKS_TAB, withWorkspaceTab } from '../../../lib/workspaceTabUrl'
import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'

/*
 * 총괄('/')에서 공정 화면으로 **넘어가는 문**의 주소 계약.
 *
 * 드릴인한 공장 문맥 그대로 그 공정의 맵 화면에 착지한다 — `?factory=` 로 공장을
 * 실어 보내면 도착 화면이 그 공장을 연 채로 서고, 카메라는 cameraHandoff 가 잇는다.
 * "그 공정 페이지에서 방금 그 공장을 클릭한 느낌"이 이 둘의 합이다.
 */

/**
 * 맵 진입 화면이 실제로 있는 공정존 — 여기 없는 공정(가공: Legacy 연동 중심이라 맵
 * 화면이 없다)은 문을 만들지 않는다. 안 열리는 문은 없는 문보다 나쁘다.
 */
const ZONES_WITH_MAP_ENTRY: Record<string, string> = {
  조립: 'assembly',
  의장: 'outfitting',
  도장: 'painting',
}

/**
 * 이 공장의 공정 화면으로 가는 주소. 갈 화면이 없으면(가공·미지의 공정) null —
 * 호출부는 null 이면 버튼 자체를 그리지 않는다.
 */
export function zoneJumpHref(process: string | null, factory: string): string | null {
  if (!process) return null
  const zoneId = ZONES_WITH_MAP_ENTRY[process]
  if (!zoneId) return null
  return drilldownHref(`/indoorshop/zones/${zoneId}`, '', { ...YARD_DRILLDOWN, factory })
}

/** 3D·블록실적 축을 가진 공정 — 조립·의장 워크스페이스. 도장 화면엔 그 축이 없다 */
const ZONES_WITH_WORKSPACE_TABS = new Set(['조립', '의장'])

/**
 * 이 공장의 공정 화면을 **특정 축(탭)** 으로 연 주소 — 공장 카드의 '3D'·'실적' 문.
 * 그 축이 없는 공정(도장·가공)이면 null — 호출부가 문을 세우지 않는다.
 */
export function zoneTabJumpHref(process: string | null, factory: string, tab: string): string | null {
  if (!process || !ZONES_WITH_WORKSPACE_TABS.has(process)) return null
  const href = zoneJumpHref(process, factory)
  return href ? withWorkspaceTab(href, tab) : null
}

/**
 * 이 공장 **베이**의 공정 화면 주소 — 공장 주소에 베이(`{공장}#{베이}`)를 함께 싣는다.
 * 도착 화면은 그 베이 구획을 고른 채로 선다(알람 딥링크와 같은 드릴다운 계약).
 */
export function zoneBayJumpHref(
  process: string | null,
  factory: string,
  bayId: string
): string | null {
  if (!process) return null
  const zoneId = ZONES_WITH_MAP_ENTRY[process]
  if (!zoneId) return null
  return drilldownHref(`/indoorshop/zones/${zoneId}`, '', { ...YARD_DRILLDOWN, factory, bay: bayId })
}

/**
 * 도장 베이 카드의 '실적' 문 — 그 베이의 도장 화면을 **현황 › 블록·실적** 축으로 연 주소.
 *
 * 도장은 3D 가 축이 아니라 현황 안의 손잡이라(R45) '3D' 문은 없고, 블록·실적 축만 있다.
 * 조립·의장 베이는 `bayTabHref`(짝지은 작업 위치·로스터)가 맡으므로 여기서는 도장만 낸다.
 */
export function paintingBayBlocksJumpHref(
  process: string | null,
  factory: string,
  bayId: string
): string | null {
  if (process !== '도장') return null
  const href = zoneBayJumpHref(process, factory, bayId)
  return href ? withWorkspaceTab(href, BLOCKS_TAB) : null
}

/**
 * 가공 공장 — 베이 단위로 보지 않는다(사용자 확정). 가공은 필드 센서가 없어 베이에 서 있는 것을
 * 알 원천이 없으므로, 야드 맵에서 가공 공장은 **공장까지만** 고를 수 있고 베이 목록도 두지 않는다.
 */
export const FABRICATION_PROCESS = '가공'

export function isBaylessProcess(process: string | null): boolean {
  return process === FABRICATION_PROCESS
}

/**
 * 공장 카드의 '실적' 문 — 조립·의장은 그 공장 공정 화면의 블록·실적 탭, 가공은 가공 화면(실적 하나).
 * 가공 화면은 공장 문맥 없이 호선·블록 조회로 서므로 공장을 싣지 않는다. 그 밖(도장 등)은 null.
 */
export function factoryPerformanceHref(process: string | null, factory: string): string | null {
  if (process === FABRICATION_PROCESS) return '/indoorshop/zones/fabrication'
  return zoneTabJumpHref(process, factory, BLOCKS_TAB)
}
