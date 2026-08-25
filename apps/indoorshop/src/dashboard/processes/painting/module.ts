import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { PaintingIcon } from '../../shared/ui/icons'
import { paintingKo } from './i18n/ko'
import { paintingEn } from './i18n/en'

/*
 * 선행도장 모듈 선언.
 *
 * 전용 화면은 아직 없다 — 공통 '준비 중' 화면이 선다. 이 모듈이 자기 이름·라우트·
 * 문구를 직접 들고 있으므로, 실제 화면을 붙일 때 공통 파일은 열지 않아도 된다.
 */

const ZonePlaceholderPage = lazy(() =>
  import('../../shared/pages/ZonePlaceholderPage').then((m) => ({ default: m.ZonePlaceholderPage }))
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
  routes: [{ path: '/indoorshop/zones/painting', Component: ZonePlaceholderPage }],
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
