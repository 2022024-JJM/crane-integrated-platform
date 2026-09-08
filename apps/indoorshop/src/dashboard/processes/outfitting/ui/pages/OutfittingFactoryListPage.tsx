import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { parseDrilldown } from '../../../../shared/lib/drilldownUrl'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { OutfittingFactoryGrid } from '../OutfittingFactoryGrid'
import type { OutfittingFactoryOverview } from '../../model/block'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { fetchFactoryOverviews } from '../../api/outfittingApi'
import { cn } from '../../../../shared/lib/utils'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'

/** 공장 전체를 가로지르는 한 줄 요약 */
function OverallSummary({ overviews }: { overviews: OutfittingFactoryOverview[] }) {
  const { t } = useTranslation()
  const blockTotal = overviews.reduce((sum, o) => sum + o.blockTotal, 0)
  const inProgress = overviews.reduce((sum, o) => sum + o.inProgress, 0)
  const sensorTotal = overviews.reduce((sum, o) => sum + o.sensorTotal, 0)
  const sensorFault = overviews.reduce((sum, o) => sum + o.sensorFault, 0)
  const lastScanAt = overviews
    .map((o) => o.lastScanAt)
    .filter((time): time is string => Boolean(time))
    .sort()
    .at(-1)

  const items: { label: string; value: string; tone?: string }[] = [
    {
      label: t('outfitting.factoryList.summaryFactories'),
      value: t('outfitting.factoryList.summaryFactoriesValue', { count: overviews.length }),
    },
    {
      label: t('outfitting.factoryList.summaryBlocks'),
      value: t('outfitting.factoryList.summaryBlocksValue', {
        inProgress,
        total: blockTotal,
      }),
    },
    {
      label: t('outfitting.factoryList.summaryLidar'),
      value:
        sensorFault > 0
          ? t('outfitting.factoryList.summaryLidarFault', { total: sensorTotal, fault: sensorFault })
          : t('outfitting.factoryList.summaryLidarOk', { total: sensorTotal }),
      tone: sensorFault > 0 ? 'text-status-degraded' : 'text-status-healthy',
    },
    {
      label: t('outfitting.factoryList.summaryLastScan'),
      value: lastScanAt ?? t('common.none'),
    },
  ]

  return (
    <dl className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-inshop-lg border border-border bg-surface px-4 py-2.5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-2xs font-medium uppercase tracking-[0.08em] text-foreground/50">
            {item.label}
          </dt>
          <dd className={cn('mt-0.5 text-inshop-sm font-semibold', item.tone ?? 'text-foreground')}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * 선행의장 공장 목록.
 *
 * 딥링크: 야드/대시보드에서 의장 공장을 누르면 `?shop=<공장명>` 으로 온다 — 그 공장이
 * 있으면 그 공장 워크스페이스로 바로 보낸다 (없으면 목록을 그대로 둔다).
 */
export function OutfittingFactoryListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  /* 기준일 — `?date=` 를 따라온다(집계도 그날 기준으로 선다) */
  const { baseDate } = useBaseDate()
  const {
    data: overviews,
    loading,
    error,
  } = useAsyncData(() => fetchFactoryOverviews(baseDate), [baseDate])

  /* 공장 딥링크 — 새 철자 `?factory=` 와 옛 철자 `?shop=` 을 같은 계약으로 읽는다 */
  const [searchParams] = useSearchParams()
  const shopParam = parseDrilldown(searchParams).factory
  useEffect(() => {
    if (!shopParam || !overviews) return
    const match = overviews.find((o) => o.factory.name === shopParam)
    if (match) navigate(`/indoorshop/zones/outfitting/${match.factory.id}`, { replace: true })
  }, [shopParam, overviews, navigate])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-inshop-xl font-semibold text-foreground">
          {t('outfitting.factoryList.title')}
        </h1>
        <p className="mt-1 text-inshop-sm text-foreground/68">{t('outfitting.factoryList.subtitle')}</p>
      </div>

      {error && <p className="text-status-unhealthy">{t('outfitting.factoryList.loadFailed')}</p>}

      {!overviews && loading && (
        <div className="flex justify-center py-16">
          <Spinner size={26} label={t('outfitting.factoryList.loading')} className="text-accent" />
        </div>
      )}

      {overviews && (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')}>
          <OverallSummary overviews={overviews} />
          <OutfittingFactoryGrid overviews={overviews} />
        </div>
      )}
    </div>
  )
}
