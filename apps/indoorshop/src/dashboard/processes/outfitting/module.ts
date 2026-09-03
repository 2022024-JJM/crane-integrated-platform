import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { OutfittingIcon } from '../../shared/ui/icons'
import { outfittingKo } from './i18n/ko'
import { outfittingEn } from './i18n/en'

/*
 * 선행의장 모듈 선언.
 *
 * 이 파일은 **가볍게** 유지한다 — 앱이 뜰 때 모든 모듈 선언을 한꺼번에 읽으므로,
 * 화면은 전부 lazy 로 둬 청크를 나눈다. 의장은 블록 단위로 작업하므로(소조/중조/대조
 * 세분 없음) 조립과 달리 일일생산량 화면을 두지 않는다. 진입은 맵(공장 → 베이 → 블록)이
 * 대문이고, 기존 공장 목록은 `/list`, 설비 상태는 `/equipment` 에 병존한다 — 셋 다
 * 맵 진입 화면 머리의 링크로 이어진다(사이드바 항목은 공정당 하나뿐이라 늘리지 않는다).
 */

const OutfittingMapEntryPage = lazy(() =>
  import('./ui/pages/OutfittingMapEntryPage').then((m) => ({
    default: m.OutfittingMapEntryPage,
  }))
)
const OutfittingFactoryListPage = lazy(() =>
  import('./ui/pages/OutfittingFactoryListPage').then((m) => ({
    default: m.OutfittingFactoryListPage,
  }))
)
const OutfittingEquipmentStatusPage = lazy(() =>
  import('./ui/pages/OutfittingEquipmentStatusPage').then((m) => ({
    default: m.OutfittingEquipmentStatusPage,
  }))
)
const OutfittingWorkspace = lazy(() =>
  import('./ui/pages/OutfittingWorkspace').then((m) => ({ default: m.OutfittingWorkspace }))
)

export const outfittingModule: ProcessModule = {
  id: 'outfitting',
  order: 30,
  navGroup: 'zones',
  nav: {
    path: '/indoorshop/zones/outfitting',
    id: 'outfitting',
    labelKey: 'outfitting.nav.label',
    icon: OutfittingIcon,
    source: 'LiDAR',
  },
  routes: [
    { path: '/indoorshop/zones/outfitting', Component: OutfittingMapEntryPage },
    // 고정 경로가 `:factoryId` 보다 먼저 서야 한다 — 뒤에 두면 공장 하나로 잡힌다
    { path: '/indoorshop/zones/outfitting/list', Component: OutfittingFactoryListPage },
    { path: '/indoorshop/zones/outfitting/equipment', Component: OutfittingEquipmentStatusPage },
    { path: '/indoorshop/zones/outfitting/:factoryId', Component: OutfittingWorkspace },
    /* 베이 레벨 — 조립의 `/zones/assembly/:factoryId/:locationId` 와 같은 규약 (W7-10) */
    { path: '/indoorshop/zones/outfitting/:factoryId/:locationId', Component: OutfittingWorkspace },
  ],
  i18n: { ko: outfittingKo, en: outfittingEn },
  provides: {
    /* 통합실적 의장 레일이 읽어 간다 — 공장 화면과 **같은 값**이어야 하므로 원천이 하나다.
     * shared 가 의장 모듈을 직접 부를 수 없어 레지스트리를 거친다(W7-11). */
    outfittingBlocks: (baseDate) =>
      import('./api/mockOutfittingData').then((m) =>
        m.outfittingBlocksAt(baseDate).map((block) => ({
          projNo: block.projNo,
          blockNo: block.blkNo,
          factoryId: block.factoryId,
          areaName: block.areaName,
          wstgCode: block.wstgCode,
          /* 화면이 '진척' 이라 부르던 값이 곧 라이다 판별률이다 — 이름만 축에 맞춘다 */
          judgedRate: block.progress,
          status: block.status,
          justArrived: block.justArrived,
        }))
      ),
  },
  zone: {
    id: 'outfitting',
    displayNameKey: 'outfitting.zone.displayName',
    status: 'running',
    health: 'degraded',
    processingCount: 8,
    lastUpdateKey: 'outfitting.zone.lastUpdate',
    source: 'LiDAR',
    statusDetailKey: 'outfitting.zone.statusDetail',
    healthDetailKey: 'outfitting.zone.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'fail', detailKey: 'outfitting.zone.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'warn', detailKey: 'outfitting.zone.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'outfitting.zone.store' },
    ],
  },
}
