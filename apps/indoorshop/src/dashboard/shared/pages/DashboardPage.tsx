import { Suspense, lazy } from 'react'
import { getProcessZones } from '../model/processRegistry'
import { ZoneGrid } from '../features/zone-monitoring/ui/organisms/ZoneGrid'
import { FixedViewport } from '../lib/fixed-viewport/FixedViewport'

/*
 * 대시보드 '/' — 옥포 야드 지도가 대문이다. painting 지번/공장을 분류색으로 그리고,
 * 우측에 공정존 상태 카드를 오버레이로 얹는다. 지도(베이스맵·지번 fixture ~1.28MB)는
 * 전원이 첫 로드하는 인덱스 라우트의 초기 번들에서 떼어 lazy 청크로 둔다 — 청크가 붙기
 * 전에는 아래 Suspense 폴백이 **공정존 카드(ZoneGrid)를 먼저** 보여 준다.
 */
const DashboardZoneMap = lazy(() =>
  import('../features/dashboard-map/ui/DashboardZoneMap').then((m) => ({
    default: m.DashboardZoneMap,
  }))
)

export function DashboardPage() {
  /*
   * 공정존 카드는 각 공정 모듈이 스스로 낸다 — 대시보드가 공정 목록을 들고 있으면
   * 공정이 늘거나 판정 값이 바뀔 때마다 이 파일이 함께 바뀌어, 네 공정의 작업이
   * 전부 여기서 부딪힌다. (판정 값이 서버에서 오면 각 모듈의 몫으로 남는다.)
   */
  const zones = getProcessZones()

  return (
    <div className="dashboard-typography flex min-h-0 flex-1 flex-col">
      <FixedViewport />
      <Suspense fallback={<ZoneGrid zones={zones} />}>
        <DashboardZoneMap zones={zones} />
      </Suspense>
    </div>
  )
}
