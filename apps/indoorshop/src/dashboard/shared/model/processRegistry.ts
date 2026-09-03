import type { RouteObject } from 'react-router-dom'
import type { Zone } from '../entities/zone/model/types'
import type { FactoryOverview } from '../entities/factory/model/overview'
import type { ProcessMapDrilldownProvider } from './processMapDrilldown'
import type { ProcessFacilityAnchor } from './processFacilityAnchor'
import type { YardMapBackdrop } from './yardMapBackdrop'
import type {
  OutfittingWipBlock,
  ProcessModule,
  ProcessNavEntry,
  ProcessNavGroupId,
} from './processModule'

/*
 * 공정 모듈 레지스트리.
 *
 * 앱이 뜰 때 한 번 채워지고 그 뒤로는 읽기만 한다. 화면들은 "어떤 공정이 있는가"를
 * 여기에 묻는다 — 공정 목록을 자기 파일에 적어 두지 않는다.
 */

let registered: readonly ProcessModule[] = []

/** app/bootstrap 에서 한 번만 부른다 */
export function registerProcessModules(modules: readonly ProcessModule[]): void {
  const ids = modules.map((m) => m.id)
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicated.length > 0) {
    throw new Error(`공정 모듈 id 가 겹칩니다: ${[...new Set(duplicated)].join(', ')}`)
  }
  registered = [...modules].sort((a, b) => a.order - b.order)
}

export function getProcessModules(): readonly ProcessModule[] {
  return registered
}

export function getProcessRoutes(): RouteObject[] {
  return registered.flatMap((module) => module.routes)
}

export function getProcessNavEntries(group: ProcessNavGroupId): ProcessNavEntry[] {
  return registered
    .filter((module) => module.navGroup === group)
    .map((module) => module.nav)
    .filter((nav) => !nav.hidden)
}

/** 대시보드 공정존 카드 — 카드를 내는 모듈만 선다 */
export function getProcessZones(): Zone[] {
  return registered.flatMap((module) => (module.zone ? [module.zone] : []))
}

/** 경로로 담당 모듈 찾기 — `/zones/assembly/factory-a/a-1` 같은 드릴다운도 조상 경로로 잡힌다 */
export function findProcessModuleByPath(pathname: string): ProcessModule | undefined {
  return registered.find(
    (module) => pathname === module.nav.path || pathname.startsWith(`${module.nav.path}/`)
  )
}

/**
 * 공장 현황을 내는 모듈들에게 물어본다.
 *
 * 야드 화면이 조립 모듈을 직접 import 하지 않기 위한 통로다. 아직 아무 모듈도
 * 내지 않으면 빈 배열이다 — 부르는 쪽이 그것을 정상 상태로 다뤄야 한다.
 */
export async function fetchFactoryOverviews(baseDate?: string): Promise<FactoryOverview[]> {
  const providers = registered.flatMap((module) =>
    module.provides?.factoryOverviews ? [module.provides.factoryOverviews] : []
  )
  const results = await Promise.all(providers.map((provide) => provide(baseDate)))
  return results.flat()
}

/**
 * 공정존이 지도에서 서는 자리를 내는 모듈들에게 물어본다.
 *
 * 대시보드가 야드 지도 위에 공정존 상태를 오버레이로 얹을 때, 야드 모듈을 직접
 * import 하지 않기 위한 통로다. 지금은 야드가 41개 시설의 공정 귀속·좌표를 근거로
 * 채운다. 아무 모듈도 내지 않으면 빈 배열이다.
 */
export async function fetchProcessFacilityAnchors(): Promise<ProcessFacilityAnchor[]> {
  const providers = registered.flatMap((module) =>
    module.provides?.facilityAnchors ? [module.provides.facilityAnchors] : []
  )
  const results = await Promise.all(providers.map((provide) => provide()))
  return results.flat()
}

/**
 * 의장 재공 블록을 내는 모듈에게 물어본다 (W7-11).
 *
 * 통합실적의 의장 레일이 쓰는 통로다 — 의장 모듈을 직접 import 하지 않으면서도 **의장
 * 공장 화면과 같은 값**을 읽는다. 아무 모듈도 내지 않으면 빈 배열이고, 화면은 그때
 * "의장 재공이 없다" 로 선다(오류가 아니다).
 */
export async function fetchOutfittingWipBlocks(baseDate?: string): Promise<OutfittingWipBlock[]> {
  const providers = registered.flatMap((module) =>
    module.provides?.outfittingBlocks ? [module.provides.outfittingBlocks] : []
  )
  const results = await Promise.all(providers.map((provide) => provide(baseDate)))
  return results.flat()
}

/**
 * 야드 지도 배경을 내는 모듈에게 물어본다.
 *
 * 대시보드가 지도를 배경으로 깔 때, 야드 모듈을 직접 import 하지 않기 위한 통로다.
 * 배경은 하나뿐이므로 처음 내는 모듈의 것을 쓴다 (지금은 야드). 아무 모듈도 내지
 * 않으면 `null` 이고, 부르는 쪽은 그것을 지도 없이 카드·목록만 뜨는 정상 상태로 다뤄야
 * 한다. 야드 지도 배경을 읽는 길은 이 함수 하나뿐이다.
 */
export async function fetchYardMapBackdrop(): Promise<YardMapBackdrop | null> {
  const provide = registered.find((module) => module.provides?.mapBackdrop)?.provides
    ?.mapBackdrop
  return provide ? provide() : null
}

/**
 * 이 공정존의 작업 위치 드릴다운 provider (PRD FR-3).
 *
 * 대시보드가 공장 아래 단계(조립: 베이·정반)를 조회하기 위한 통로다. 내지 않는 공정은
 * `null` 이며, 부르는 쪽이 그것을 오류가 아닌 "작업 위치 상세 미제공" 으로 다뤄야 한다.
 */
export function getProcessMapDrilldown(zoneId: string): ProcessMapDrilldownProvider | null {
  return registered.find((module) => module.id === zoneId)?.provides?.mapDrilldown ?? null
}
