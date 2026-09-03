import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { FactoryGrid } from '../FactoryGrid'
import type { FactoryOverview } from '../../../../shared/entities/factory/model/overview'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { fetchFactoryOverviews } from '../../api/assemblyApi'
import { cn } from '../../../../shared/lib/utils'
import { useCollectionDay } from '../../lib/useCollectionDay'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'

/** 공장 전체를 가로지르는 한 줄 요약 — 개별 카드로 내려가기 전의 전제 */
function OverallSummary({ overviews }: { overviews: FactoryOverview[] }) {
  const collectionDay = useCollectionDay()
  const { t } = useTranslation()
  /* 수치가 어느 날 것인가 — 기준일과 다르면 라벨이 날짜를 박는다 (W7-7-5) */
  const bayCount = overviews.reduce((sum, o) => sum + o.bays.length, 0)
  const occupied = overviews.reduce((sum, o) => sum + o.occupiedCount, 0)
  const sensorTotal = overviews.reduce((sum, o) => sum + o.sensorTotal, 0)
  const sensorFault = overviews.reduce((sum, o) => sum + o.sensorFault, 0)
  const todayCount = overviews.reduce((sum, o) => sum + o.todayCount, 0)
  const lastScanAt = overviews
    .map((o) => o.lastScanAt)
    .filter((time): time is string => Boolean(time))
    .sort()
    .at(-1)

  const items: { label: string; value: string; tone?: string }[] = [
    {
      label: t('assembly.factoryList.summaryFactories'),
      value: t('assembly.factoryList.summaryFactoriesValue', { count: overviews.length }),
    },
    {
      label: t('assembly.factoryList.summaryBays'),
      value: t('assembly.factoryList.summaryBaysValue', { occupied, total: bayCount }),
    },
    {
      label: t('assembly.factoryList.summaryLidar'),
      value:
        sensorFault > 0
          ? t('assembly.factoryList.summaryLidarFault', { total: sensorTotal, fault: sensorFault })
          : t('assembly.factoryList.summaryLidarOk', { total: sensorTotal }),
      tone: sensorFault > 0 ? 'text-status-degraded' : 'text-status-healthy',
    },
    {
      label: collectionDay.followsBaseDate
        ? t('assembly.factoryList.summaryToday')
        : t('assembly.factoryList.summaryDoneOn', { date: collectionDay.dataDate }),
      value: t('assembly.factoryList.summaryTodayValue', { count: todayCount }),
    },
    {
      label: t('assembly.factoryList.summaryLastScan'),
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

export function FactoryListPage() {
  const { t } = useTranslation()
  /* 기준일 — `?date=` 를 따라온다(집계도 그날 기준으로 선다) */
  const { baseDate } = useBaseDate()
  const {
    data: overviews,
    loading,
    error,
  } = useAsyncData(() => fetchFactoryOverviews(baseDate), [baseDate])

  return (
    /*
     * 본문은 다른 화면과 마찬가지로 왼쪽 정렬 · 전체 폭이다.
     * 카드가 커 보이는 문제는 페이지를 가운데로 모아서가 아니라 **카드 자체의 폭**을
     * 묶어서 푼다 (FactoryGrid 참조) — 폭을 통째로 줄이면 요약 줄까지 같이 좁아진다.
     */
    <div className="space-y-5">
      <div>
        <h1 className="text-inshop-xl font-semibold text-foreground">{t('assembly.factoryList.title')}</h1>
        <p className="mt-1 text-inshop-sm text-foreground/68">
          {t('assembly.factoryList.subtitle')}
        </p>
      </div>

      {error && <p className="text-status-unhealthy">{t('assembly.factoryList.loadFailed')}</p>}

      {/* 이전 내용 위에 로딩만 덮는다 — 목록이 빈 화면으로 무너졌다 다시 서지 않도록 */}
      {!overviews && loading && (
        <div className="flex justify-center py-16">
          <Spinner size={26} label={t('assembly.factoryList.loading')} className="text-accent" />
        </div>
      )}

      {overviews && (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')}>
          <OverallSummary overviews={overviews} />
          <FactoryGrid overviews={overviews} />
        </div>
      )}
    </div>
  )
}
