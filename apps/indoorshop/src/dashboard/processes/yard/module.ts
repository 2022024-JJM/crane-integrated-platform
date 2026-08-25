import { lazy } from 'react'
import type { ProcessModule } from '../../shared/model/processModule'
import { YardIcon } from '../../shared/ui/icons'
import { yardKo } from './i18n/ko'
import { yardEn } from './i18n/en'

/*
 * 야드 모듈 선언.
 *
 * 야드는 공정존이 아니다 — 조립·가공처럼 실적을 만드는 곳이 아니라 그 사이를 잇는
 * 일이라 `logistics` 묶음에 서고, 대시보드 공정존 카드(zone)를 두지 않는다.
 */

const YardWorkspace = lazy(() =>
  import('./ui/pages/YardWorkspace').then((m) => ({ default: m.YardWorkspace }))
)

export const yardModule: ProcessModule = {
  id: 'yard',
  order: 50,
  navGroup: 'logistics',
  nav: {
    path: '/indoorshop/logistics/yard',
    id: 'yard',
    labelKey: 'yard.nav.label',
    icon: YardIcon,
  },
  routes: [{ path: '/indoorshop/logistics/yard', Component: YardWorkspace }],
  i18n: { ko: yardKo, en: yardEn },
}
