import { useParams, Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../../shared/lib/utils'
import { Card, CardContent, CardHeader } from '../../../../shared/ui/atoms/Card'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { fetchFactories, fetchDailyProduction } from '../../api/assemblyApi'
import type { BayDailyProduction } from '../../api/assemblyApi'

function StatTile({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <Card>
      <p className="text-inshop-xs font-mono uppercase tracking-wide text-foreground/68">{label}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">
        {value}
        {unit && <span className="ml-1 text-inshop-base font-medium text-foreground/68">{unit}</span>}
      </p>
    </Card>
  )
}

/** 주간 미니 바차트 — 단일 색조(accent), 오늘 강조, 마크별 hover 툴팁 */
function WeeklyBars({ daily }: { daily: BayDailyProduction['daily'] }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...daily.map((d) => d.count))

  return (
    <div>
      <div className="flex h-16 items-end gap-[3px]">
        {daily.map((d, i) => {
          const isToday = i === daily.length - 1
          return (
            <div
              key={d.label}
              title={t('assembly.production.barTitle', { label: d.label, count: d.count })}
              className="group flex flex-1 flex-col items-center justify-end self-stretch"
            >
              {isToday && d.count > 0 && (
                <span className="mb-0.5 font-mono text-2xs font-semibold text-foreground">
                  {d.count}
                </span>
              )}
              <div
                className={cn(
                  'w-full rounded-inshop-xs transition-opacity group-hover:opacity-70',
                  isToday ? 'bg-accent' : 'bg-accent/35',
                )}
                style={{ height: d.count === 0 ? 2 : `${(d.count / max) * 100}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-2xs text-foreground/50">
        <span>{daily[0].label}</span>
        <span>{t('assembly.production.today')}</span>
      </div>
    </div>
  )
}

export function ProductionCountPage() {
  const { t } = useTranslation()
  const { factoryId } = useParams<{ factoryId: string }>()

  const { data, loading, error } = useAsyncData(
    () =>
      Promise.all([fetchFactories(), fetchDailyProduction(factoryId ?? '')]).then(
        ([factories, production]) => ({
          factory: factories.find((f) => f.id === factoryId) ?? null,
          production,
        })
      ),
    [factoryId]
  )

  if (loading) return <p className="text-foreground/68">{t('assembly.production.loading')}</p>
  if (error || !data?.factory) {
    return (
      <div className="space-y-4">
        <h1 className="text-inshop-2xl font-bold text-foreground">{t('assembly.workspace.unknownFactory')}</h1>
        <Link
          to="/indoorshop/zones/assembly"
          className="inline-block rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
        >
          {t('assembly.workspace.backToFactories')}
        </Link>
      </div>
    )
  }

  const { factory, production } = data
  const activeBays = production.filter((b) => b.weekTotal > 0)
  const todayTotal = production.reduce((s, b) => s + b.todayCount, 0)
  const weekTotal = production.reduce((s, b) => s + b.weekTotal, 0)
  const topBay = activeBays.reduce<BayDailyProduction | null>(
    (best, b) => (best === null || b.todayCount > best.todayCount ? b : best),
    null
  )
  const dateLabels = production[0]?.daily.map((d) => d.label) ?? []

  return (
    <div className="space-y-6">
      <div>
        <p className="text-inshop-sm text-foreground/68">
          <Link to="/indoorshop/zones/assembly" className="hover:text-accent">
            {t('assembly.nav.label')}
          </Link>
          {' > '}
          <Link to={`/indoorshop/zones/assembly/${factory.id}`} className="hover:text-accent">
            {factory.displayName}
          </Link>
          {' > '}
          <span>{t('assembly.production.breadcrumb')}</span>
        </p>
        <h1 className="mt-1 text-inshop-2xl font-bold text-foreground">
          {t('assembly.production.title', { factory: factory.displayName })}
        </h1>
        <p className="mt-1 font-mono text-inshop-sm text-foreground/68">
          {t('assembly.production.subtitle', { shop: factory.assyShop })}
        </p>
      </div>

      {/* 요약 스탯 타일 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label={t('assembly.production.todayDone')}
          value={todayTotal}
          unit={t('assembly.production.unit')}
        />
        <StatTile
          label={t('assembly.production.weekTotal')}
          value={weekTotal}
          unit={t('assembly.production.unit')}
        />
        <StatTile
          label={t('assembly.production.dailyAverage')}
          value={(weekTotal / 7).toFixed(1)}
          unit={t('assembly.production.unit')}
        />
        <StatTile
          label={t('assembly.production.topBay')}
          value={topBay ? topBay.name : t('common.none')}
          unit={
            topBay ? t('assembly.production.unitCount', { count: topBay.todayCount }) : undefined
          }
        />
      </div>

      {/* 베이별 카드 + 주간 미니 바차트 */}
      <div>
        <h2 className="mb-3 text-inshop-sm font-semibold uppercase tracking-wide text-foreground/68">
          {t('assembly.production.trendTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {production.map((bay) => (
            <Card key={bay.locationId}>
              <CardHeader className="mb-2 flex flex-row items-start justify-between gap-2">
                <div>
                  <h3 className="text-inshop-base font-semibold text-foreground">{bay.name}</h3>
                  <p className="font-mono text-inshop-xs text-foreground/68">{t('assembly.production.bayCode', { code: bay.workCntr })}</p>
                </div>
                <div className="text-right">
                  <p className="text-inshop-2xl font-bold text-foreground">{bay.todayCount}</p>
                  <p className="text-inshop-xs text-foreground/58">{t('assembly.production.todayDone')}</p>
                </div>
              </CardHeader>
              <CardContent>
                {bay.weekTotal > 0 ? (
                  <>
                    <WeeklyBars daily={bay.daily} />
                    <p className="mt-2 text-right font-mono text-inshop-xs text-foreground/58">
                      {t('assembly.production.weekTotalValue', { count: bay.weekTotal })}
                    </p>
                    {bay.todayItems.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
                        <p className="text-inshop-xs font-semibold uppercase tracking-wide text-foreground/58">
                          {t('assembly.production.todayDetail')}
                        </p>
                        {bay.todayItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between font-mono text-inshop-xs"
                          >
                            <span className="text-foreground">
                              {item.id}{' '}
                              <span className="text-foreground/50">[{item.wstgCode}]</span>
                            </span>
                            <span className="text-foreground/68">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-4 text-inshop-sm text-foreground/68">{t('assembly.production.emptyBay')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 데이터 테이블 (접근성 겸용) */}
      <div>
        <h2 className="mb-3 text-inshop-sm font-semibold uppercase tracking-wide text-foreground/68">
          {t('assembly.production.tableTitle')}
        </h2>
        <div className="overflow-x-auto rounded-inshop-lg border border-border">
          <table className="w-full text-inshop-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/60 text-left">
                <th className="px-4 py-2.5 font-semibold text-foreground">{t('assembly.production.tableBay')}</th>
                {dateLabels.map((label, i) => (
                  <th
                    key={label}
                    className={cn(
                      'px-3 py-2.5 text-right font-mono text-inshop-xs font-semibold',
                      i === dateLabels.length - 1 ? 'text-foreground' : 'text-foreground/68',
                    )}
                  >
                    {i === dateLabels.length - 1
                      ? t('assembly.production.todayLabel', { label })
                      : label}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold text-foreground">{t('assembly.production.tableTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {production.map((bay) => (
                <tr key={bay.locationId} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-foreground">{bay.name}</span>
                    <span className="ml-2 font-mono text-inshop-xs text-foreground/58">
                      {bay.workCntr}
                    </span>
                  </td>
                  {bay.daily.map((d, i) => (
                    <td
                      key={d.label}
                      className={cn(
                        'px-3 py-2.5 text-right font-mono',
                        i === bay.daily.length - 1
                          ? 'font-semibold text-foreground'
                          : 'text-foreground/70',
                      )}
                    >
                      {d.count}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                    {bay.weekTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Link
        to={`/indoorshop/zones/assembly/${factory.id}`}
        className="inline-block rounded-inshop-md border border-accent bg-accent/10 px-4 py-2 text-inshop-sm font-medium text-accent transition-colors hover:bg-accent/20"
      >
        {t('assembly.production.backToBays', { factory: factory.displayName })}
      </Link>
    </div>
  )
}
