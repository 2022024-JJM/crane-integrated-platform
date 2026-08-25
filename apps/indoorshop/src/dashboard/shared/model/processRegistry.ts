import type { RouteObject } from 'react-router-dom'
import type { Zone } from '../entities/zone/model/types'
import type { FactoryOverview } from '../entities/factory/model/overview'
import type { ProcessModule, ProcessNavEntry, ProcessNavGroupId } from './processModule'

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
  return registered.filter((module) => module.navGroup === group).map((module) => module.nav)
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
export async function fetchFactoryOverviews(): Promise<FactoryOverview[]> {
  const providers = registered.flatMap((module) =>
    module.provides?.factoryOverviews ? [module.provides.factoryOverviews] : []
  )
  const results = await Promise.all(providers.map((provide) => provide()))
  return results.flat()
}
