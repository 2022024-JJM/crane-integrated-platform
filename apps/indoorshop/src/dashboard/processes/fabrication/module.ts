import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { FabricationIcon } from '../../shared/ui/icons'
import { fabricationKo } from './i18n/ko'
import { fabricationEn } from './i18n/en'

/*
 * 가공 모듈 선언.
 *
 * **가공은 필드 수집이 없다(Legacy DB 전용)** — LiDAR·PLC 같은 필드 센서가 없어
 * OT 공정존 화면(사이드바 공정존 그룹·'/' 공정존 카드)에서 제외한다(사용자 확정).
 * 가공 실적은 통합실적(/performance) 소관이고, 지도 위 가공 공장 형상·CAS/PAS
 * 초록은 기준정보라 그대로 남는다. 라우트(placeholder)는 직접 진입용으로 유지 —
 * 필드 수집이 생기면 nav `hidden` 을 걷고 `zone` 카드를 되살린다.
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
    /* 필드 수집 없음 — 사이드바에서 숨긴다 (라우트는 유지, 위 모듈 주석 참조) */
    hidden: true,
  },
  routes: [{ path: '/indoorshop/zones/fabrication', Component: ZonePlaceholderPage }],
  i18n: { ko: fabricationKo, en: fabricationEn },
  /* zone 카드 없음 — '/' 공정존 카드·지도 스포트라이트에서 빠진다 (위 모듈 주석 참조) */
}
