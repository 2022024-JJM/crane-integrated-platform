import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/useTranslation'
import { Card, CardContent, CardHeader } from '../ui/atoms/Card'
import { ArrowLeftIcon } from '../ui/icons'
import { findProcessModuleByPath } from '../model/processRegistry'
import { NotFoundPage } from './NotFoundPage'

/**
 * 전용 화면이 아직 없는 공정존의 자리 표시.
 *
 * 어떤 공정인지는 **경로로** 알아낸다 — 공정 목록을 여기 적어 두면 공정을 늘릴 때마다
 * 이 파일을 함께 고쳐야 하고, 그 순간 네 공정의 작업이 여기서 부딪힌다.
 */
export function ZonePlaceholderPage() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const processModule = findProcessModuleByPath(pathname)

  // 이 화면은 모듈이 자기 라우트로 걸어 둔 것이라 보통은 항상 잡힌다
  if (!processModule) return <NotFoundPage />

  const zoneName = t(processModule.zone?.displayNameKey ?? processModule.nav.labelKey)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-inshop-2xl font-bold text-foreground">
          {t('zoneDetail.boardTitle', { zone: zoneName })}
        </h1>
        <p className="mt-2 text-foreground/68">{t('zoneDetail.preparing')}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-inshop-lg font-semibold text-foreground">
            {t('zoneDetail.preparingCard', { zone: zoneName })}
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-foreground/68">{t('zoneDetail.planIntro')}</p>
          <ul className="list-inside list-disc space-y-2 text-foreground/68">
            <li>{t('zoneDetail.planItems.lidar')}</li>
            <li>{t('zoneDetail.planItems.ocr')}</li>
            <li>{t('zoneDetail.planItems.plc')}</li>
          </ul>
          <p className="mt-6 text-inshop-sm text-foreground/68">{t('zoneDetail.planNote')}</p>
        </CardContent>
      </Card>

      <Link
        to="/indoorshop"
        className="inline-flex items-center gap-1.5 rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
      >
        <ArrowLeftIcon size={14} />
        {t('zoneDetail.goHome')}
      </Link>
    </div>
  )
}
