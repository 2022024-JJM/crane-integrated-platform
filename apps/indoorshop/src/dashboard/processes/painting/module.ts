import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { PaintingIcon } from '../../shared/ui/icons'
import { paintingKo } from './i18n/ko'
import { paintingEn } from './i18n/en'

/*
 * 선행도장 모듈 선언.
 *
 * 진입은 맵(PaintingWorkspace)이 대문이고, 공장 카드에서 그 공장의 **공장 현황**
 * (`/zones/painting/{factoryId}`)으로 건너간다 — 조립·의장의 `공장 카드 → 워크스페이스` 와
 * 같은 이동 문법이다(사이드바 항목은 공정당 하나뿐이라 늘리지 않는다).
 *
 * three/지도/설비 fixture 같은 무거운 의존은 화면 쪽에만 있고, 화면 자체를 lazy 로 둬서
 * 대시보드만 보는 사용자에게 그 무게가 실리지 않게 한다(module.ts 는 가볍게 유지).
 */

const PaintingWorkspace = lazy(() =>
  import('./ui/pages/PaintingWorkspace').then((m) => ({ default: m.PaintingWorkspace }))
)
const PaintingFactoryStatusPage = lazy(() =>
  import('./ui/pages/PaintingFactoryStatusPage').then((m) => ({
    default: m.PaintingFactoryStatusPage,
  }))
)

export const paintingModule: ProcessModule = {
  id: 'painting',
  order: 40,
  navGroup: 'zones',
  nav: {
    path: '/indoorshop/zones/painting',
    id: 'painting',
    labelKey: 'painting.nav.label',
    icon: PaintingIcon,
    source: 'PLC · Modbus',
  },
  routes: [
    { path: '/indoorshop/zones/painting', Component: PaintingWorkspace },
    { path: '/indoorshop/zones/painting/:factoryId', Component: PaintingFactoryStatusPage },
  ],
  i18n: { ko: paintingKo, en: paintingEn },
  zone: {
    id: 'painting',
    displayNameKey: 'painting.zone.displayName',
    status: 'running',
    health: 'healthy',
    processingCount: 12,
    lastUpdateKey: 'painting.zone.lastUpdate',
    source: 'PLC · Modbus',
    statusDetailKey: 'painting.zone.statusDetail',
    healthDetailKey: 'painting.zone.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'ok', detailKey: 'painting.zone.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'ok', detailKey: 'painting.zone.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'painting.zone.store' },
    ],
  },
}
