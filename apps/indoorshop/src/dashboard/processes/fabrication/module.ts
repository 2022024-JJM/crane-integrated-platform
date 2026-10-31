import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { FabricationIcon } from '../../shared/ui/icons'
import { fabricationKo } from './i18n/ko'
import { fabricationEn } from './i18n/en'

/*
 * 가공 모듈 선언.
 *
 * 가공은 필드 수집이 없다(Legacy DB 전용). 그래서 한때 사이드바·'/' 공정존 카드에서
 * 제외했으나, 가공 PoC 판별 실적 현황판을 OT 대시보드에서 확인해야 하므로 사이드바
 * 공정존 그룹에 노출한다 — 화면은 Hot Data DB 의 레거시 미러(기반 데이터)와
 * ot-pipeline-fabrication 판별 결과를 대조한다. '/' 공정존 카드(`zone`)는 아직 두지
 * 않는다(카드 값이 서버 수치가 아니라 목업이라 되살릴지 별도 결정).
 */

/*
 * 가공은 **실적 화면 하나**다(사용자 확정) — 다른 공정의 [실적] 과 같은 틀로, 통합실적에서 가공 공정만
 * 조회한다. 예전 판별 현황판(`ui/pages/FabricationJudgmentPage`)은 앱에서 들어가는 길만 뺐다 —
 * 소스와 테스트는 그대로 두었다(다시 열려면 아래 routes 에 되돌린다).
 */
const FabricationPerformancePage = lazy(() =>
  import('./ui/pages/FabricationPerformancePage').then((m) => ({ default: m.FabricationPerformancePage }))
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
  routes: [
    { path: '/indoorshop/zones/fabrication', Component: FabricationPerformancePage },
  ],
  i18n: { ko: fabricationKo, en: fabricationEn },
  /* zone 카드 없음 — '/' 공정존 카드·지도 스포트라이트에서는 아직 빠진다 (위 모듈 주석 참조) */
}
