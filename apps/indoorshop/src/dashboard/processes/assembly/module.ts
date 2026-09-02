import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { AssemblyIcon } from '../../shared/ui/icons'
import { assemblyKo } from './i18n/ko'
import { assemblyEn } from './i18n/en'

/*
 * 조립 모듈 선언.
 *
 * 이 파일은 **가볍게** 유지한다 — 앱이 뜰 때 모든 모듈 선언을 한꺼번에 읽으므로,
 * 여기서 three.js 를 끌고 오는 화면을 정적으로 import 하면 대시보드만 보는
 * 사용자에게까지 그 무게가 실린다. 화면은 전부 lazy 로 둔다.
 */

const AssemblyMapEntryPage = lazy(() =>
  import('./ui/pages/AssemblyMapEntryPage').then((m) => ({ default: m.AssemblyMapEntryPage }))
)
const FactoryListPage = lazy(() =>
  import('./ui/pages/FactoryListPage').then((m) => ({ default: m.FactoryListPage }))
)
const AssemblyWorkspace = lazy(() =>
  import('./ui/pages/AssemblyWorkspace').then((m) => ({ default: m.AssemblyWorkspace }))
)
const ProductionCountPage = lazy(() =>
  import('./ui/pages/ProductionCountPage').then((m) => ({ default: m.ProductionCountPage }))
)

export const assemblyModule: ProcessModule = {
  id: 'assembly',
  order: 20,
  navGroup: 'zones',
  nav: {
    path: '/indoorshop/zones/assembly',
    id: 'assembly',
    labelKey: 'assembly.nav.label',
    icon: AssemblyIcon,
    source: 'LiDAR',
  },
  routes: [
    /* 엔트리는 맵 진입(TO-BE v2) — 기존 그리드 목록은 /list 로 병존한다.
     * 고정 경로 `list` 는 `:factoryId` 보다 먼저 서야 한다(뒤에 두면 공장 하나로 잡힌다). */
    { path: '/indoorshop/zones/assembly', Component: AssemblyMapEntryPage },
    { path: '/indoorshop/zones/assembly/list', Component: FactoryListPage },
    { path: '/indoorshop/zones/assembly/:factoryId', Component: AssemblyWorkspace },
    // 고정 경로가 `:locationId` 보다 먼저 서야 한다 — 뒤에 두면 정반 하나로 잡힌다
    { path: '/indoorshop/zones/assembly/:factoryId/production', Component: ProductionCountPage },
    { path: '/indoorshop/zones/assembly/:factoryId/:locationId', Component: AssemblyWorkspace },
  ],
  i18n: { ko: assemblyKo, en: assemblyEn },
  zone: {
    id: 'assembly',
    displayNameKey: 'assembly.zone.displayName',
    status: 'running',
    health: 'healthy',
    processingCount: 24,
    lastUpdateKey: 'assembly.zone.lastUpdate',
    source: 'LiDAR',
    statusDetailKey: 'assembly.zone.statusDetail',
    healthDetailKey: 'assembly.zone.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'ok', detailKey: 'assembly.zone.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'ok', detailKey: 'assembly.zone.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'assembly.zone.store' },
    ],
  },
  provides: {
    // 야드 화면이 읽어 가는 값 — 조립 모듈을 직접 부르지 않게 레지스트리를 거친다
    factoryOverviews: () => import('./api/assemblyApi').then((m) => m.fetchFactoryOverviews()),
    /* 전체 현황 지도의 작업 위치 드릴다운(PRD FR-3·FR-4) — 조립의 작업 위치는 베이(정반)다.
     * 어댑터는 동적 import 라 대시보드 초기 청크에 실리지 않는다. */
    mapDrilldown: {
      locationNounKey: 'assembly.map.locationNoun',
      fetchLocations: (key) =>
        import('./api/mapDrilldown').then((m) => m.fetchAssemblyMapLocations(key)),
    },
  },
}
