import { Suspense, lazy } from 'react'
import { useTranslation } from '../lib/i18n/useTranslation'
import { FixedViewport } from '../lib/fixed-viewport/FixedViewport'
import { Spinner } from '../ui/atoms/Spinner'

/*
 * 대시보드 '/' — 옥포 야드 지도가 대문이자 전부다. painting 지번/공장을 분류색으로
 * 그리고, 드릴다운(공장→베이)과 우상단 공장 이름패가 지도 위에 선다.
 *
 * 공정존 카드 그리드는 걷었다(R11) — 어차피 지도를 타고 들어가는 구조라 카드는 같은
 * 길의 사본이었고, 상태 요약 역할은 알람 레일이 맡는다. 카드가 차지하던 오른쪽 기둥은
 * 지도에 돌려줬다. 지도(베이스맵·지번 fixture ~1.28MB)는 초기 번들에서 떼어 lazy
 * 청크로 두고, 붙기 전에는 스피너만 세운다.
 */
const DashboardZoneMap = lazy(() =>
  import('../features/dashboard-map/ui/DashboardZoneMap').then((m) => ({
    default: m.DashboardZoneMap,
  }))
)

function MapFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner size={26} label={t('dashboard.map.loading')} className="text-accent" />
    </div>
  )
}

export function DashboardPage() {
  return (
    <div className="dashboard-typography flex min-h-0 flex-1 flex-col">
      <FixedViewport />
      <Suspense fallback={<MapFallback />}>
        <DashboardZoneMap />
      </Suspense>
    </div>
  )
}
