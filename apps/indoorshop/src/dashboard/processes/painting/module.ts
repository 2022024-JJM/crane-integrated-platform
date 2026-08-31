import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { PaintingIcon } from '../../shared/ui/icons'
import { paintingKo } from './i18n/ko'
import { paintingEn } from './i18n/en'

/*
 * 선행도장 모듈 선언.
 *
 * 첫 실화면은 설비 상태 화면(PaintingWorkspace)이다. three/지도/설비 fixture 같은 무거운
 * 의존은 화면 쪽에만 있고, 화면 자체를 lazy 로 둬서 대시보드만 보는 사용자에게 그 무게가
 * 실리지 않게 한다(module.ts 는 가볍게 유지).
 */

const PaintingWorkspace = lazy(() =>
  import('./ui/pages/PaintingWorkspace').then((m) => ({ default: m.PaintingWorkspace }))
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
  routes: [{ path: '/indoorshop/zones/painting', Component: PaintingWorkspace }],
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
