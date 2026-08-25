import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { FabricationIcon } from '../../shared/ui/icons'
import { fabricationKo } from './i18n/ko'
import { fabricationEn } from './i18n/en'

/*
 * 가공 모듈 선언.
 *
 * 전용 화면은 아직 없다 — 공통 '준비 중' 화면이 선다. 이 모듈이 자기 이름·라우트·
 * 문구를 직접 들고 있으므로, 실제 화면을 붙일 때 공통 파일은 열지 않아도 된다.
 */

const ZonePlaceholderPage = lazy(() =>
  import('../../shared/pages/ZonePlaceholderPage').then((m) => ({ default: m.ZonePlaceholderPage }))
)

export const fabricationModule: ProcessModule = {
  id: 'fabrication',
  order: 10,
  navGroup: 'zones',
  nav: {
    path: '/indoorshop/zones/fabrication',
    id: 'fabrication',
    labelKey: 'fabrication.nav.label',
    icon: FabricationIcon,
    source: 'Legacy DB',
  },
  routes: [{ path: '/indoorshop/zones/fabrication', Component: ZonePlaceholderPage }],
  i18n: { ko: fabricationKo, en: fabricationEn },
  zone: {
    id: 'fabrication',
    displayNameKey: 'fabrication.zone.displayName',
    status: 'running',
    health: 'healthy',
    processingCount: 15,
    lastUpdateKey: 'fabrication.zone.lastUpdate',
    source: 'Legacy DB',
    statusDetailKey: 'fabrication.zone.statusDetail',
    healthDetailKey: 'fabrication.zone.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'ok', detailKey: 'fabrication.zone.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'ok', detailKey: 'fabrication.zone.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'fabrication.zone.store' },
    ],
  },
}
