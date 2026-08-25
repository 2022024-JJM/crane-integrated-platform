import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { OutfittingIcon } from '../../shared/ui/icons'
import { outfittingKo } from './i18n/ko'
import { outfittingEn } from './i18n/en'

/*
 * 선행의장 모듈 선언.
 *
 * 전용 화면은 아직 없다 — 공통 '준비 중' 화면이 선다. 이 모듈이 자기 이름·라우트·
 * 문구를 직접 들고 있으므로, 실제 화면을 붙일 때 공통 파일은 열지 않아도 된다.
 */

const ZonePlaceholderPage = lazy(() =>
  import('../../shared/pages/ZonePlaceholderPage').then((m) => ({ default: m.ZonePlaceholderPage }))
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
  },
  routes: [{ path: '/indoorshop/zones/outfitting', Component: ZonePlaceholderPage }],
  i18n: { ko: outfittingKo, en: outfittingEn },
  zone: {
    id: 'outfitting',
    displayNameKey: 'outfitting.zone.displayName',
    status: 'running',
    health: 'degraded',
    processingCount: 8,
    lastUpdateKey: 'outfitting.zone.lastUpdate',
    statusDetailKey: 'outfitting.zone.statusDetail',
    healthDetailKey: 'outfitting.zone.healthDetail',
    checks: [
      { labelKey: 'zone.checkLabel.ingest', state: 'fail', detailKey: 'outfitting.zone.ingest' },
      { labelKey: 'zone.checkLabel.judge', state: 'warn', detailKey: 'outfitting.zone.judge' },
      { labelKey: 'zone.checkLabel.store', state: 'ok', detailKey: 'outfitting.zone.store' },
    ],
  },
}
