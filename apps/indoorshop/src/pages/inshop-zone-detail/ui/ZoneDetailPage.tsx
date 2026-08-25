import { useParams, Link } from 'react-router-dom'
import { useTranslation } from '../../../dashboard/shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../dashboard/shared/lib/i18n/keys'
import { Card, CardContent, CardHeader } from '../../../dashboard/shared/ui/atoms/Card'
import { ArrowLeftIcon } from '../../../dashboard/shared/ui/icons'

const VALID_ZONE_IDS = ['assembly', 'fabrication', 'outfitting', 'painting']

const zoneNameKeys: Record<string, InshopKey> = {
  assembly: 'zoneData.assembly.displayName',
  fabrication: 'zoneData.fabrication.displayName',
  outfitting: 'zoneData.outfitting.displayName',
  painting: 'zoneData.painting.displayName',
}

export function ZoneDetailPage() {
  const { t } = useTranslation()
  const { zoneId } = useParams<{ zoneId: string }>()

  if (!zoneId || !VALID_ZONE_IDS.includes(zoneId)) {
    return (
      <div className="space-y-6">
        <h1 className="text-inshop-2xl font-bold text-foreground">
          {t('zoneDetail.unknownTitle')}
        </h1>
        <p className="text-foreground/68">
          {t('zoneDetail.unknownBody')}
        </p>
        <ul className="list-inside list-disc space-y-2 text-foreground/68">
          {VALID_ZONE_IDS.map((id) => (
            <li key={id}>
              {id} ({t(zoneNameKeys[id])})
            </li>
          ))}
        </ul>
        <Link
          to="/indoorshop"
          className="inline-block rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
        >
          {t('zoneDetail.goHome')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-inshop-2xl font-bold text-foreground">
          {t('zoneDetail.boardTitle', { zone: t(zoneNameKeys[zoneId]) })}
        </h1>
        <p className="mt-2 text-foreground/68">{t('zoneDetail.preparing')}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-inshop-lg font-semibold text-foreground">
            {t('zoneDetail.preparingCard', { zone: t(zoneNameKeys[zoneId]) })}
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-foreground/68">
            {t('zoneDetail.planIntro')}
          </p>
          <ul className="list-inside list-disc space-y-2 text-foreground/68">
            <li>{t('zoneDetail.planItems.lidar')}</li>
            <li>{t('zoneDetail.planItems.ocr')}</li>
            <li>{t('zoneDetail.planItems.rfid')}</li>
            <li>{t('zoneDetail.planItems.plc')}</li>
          </ul>
          <p className="mt-6 text-inshop-sm text-foreground/68">
            {t('zoneDetail.planNote')}
          </p>
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
