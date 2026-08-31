import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { OutfittingFactoryOverview } from '../model/block'
import { OUTFITTING_STATUS_META } from '../model/block'
import { Card, CardContent, CardFooter, CardHeader } from '../../../shared/ui/atoms/Card'
import { LinkButton } from '../../../shared/ui/atoms/Button'
import { HealthBadge } from '../../../shared/entities/zone/ui/HealthBadge'
import { cn } from '../../../shared/lib/utils'

/** 큰 숫자 하나 + 이름 — 카드 위쪽에서 공장의 규모를 한 눈에 준다 */
function StatTile({
  label,
  value,
  suffix,
  detail,
  detailTone,
}: {
  label: string
  value: number | string
  suffix?: string
  detail?: string
  detailTone?: string
}) {
  return (
    <div className="rounded-inshop-md bg-surface-secondary/70 px-2.5 py-2">
      <p className="text-2xs font-medium text-foreground/58">{label}</p>
      <p className="mt-0.5 text-inshop-xl font-semibold leading-none text-foreground">
        {value}
        {suffix && <span className="ml-0.5 text-inshop-xs font-medium text-foreground/58">{suffix}</span>}
      </p>
      {detail && (
        <p className={cn('mt-1 text-2xs leading-tight', detailTone ?? 'text-foreground/54')}>
          {detail}
        </p>
      )}
    </div>
  )
}

/** 블록 상태 구성 — 숫자 셋을 나란히 적는 대신 길이로 보여준다 */
function StatusBar({ overview }: { overview: OutfittingFactoryOverview }) {
  const { t } = useTranslation()
  const total = overview.blockTotal || 1
  const segments = [
    { key: 'in_progress' as const, count: overview.inProgress },
    { key: 'completed' as const, count: overview.completed },
    { key: 'waiting' as const, count: overview.waiting },
  ]

  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-secondary">
        {segments
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <span
              key={segment.key}
              className={OUTFITTING_STATUS_META[segment.key].dot}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5 text-2xs text-foreground/63">
            <span
              aria-hidden="true"
              className={cn('h-1.5 w-1.5 rounded-full', OUTFITTING_STATUS_META[segment.key].dot)}
            />
            {t(OUTFITTING_STATUS_META[segment.key].labelKey)} {segment.count}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * 공장 카드 (블록 중심).
 *
 * "어느 공장으로 들어갈까"를 고르는 화면이라 규모(블록·센서·진행중)를 위에 두고,
 * 블록 상태 구성을 그 아래에 두어 고를 근거를 준다. 상세 블록 목록은 공장 뷰(워크스페이스)에.
 */
export function OutfittingFactoryCard({ overview }: { overview: OutfittingFactoryOverview }) {
  const { t } = useTranslation()
  const { factory, blockTotal, inProgress, sensorTotal, sensorOnline, sensorFault } = overview

  return (
    <Card className="flex flex-col p-4">
      <CardHeader className="mb-3 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-inshop-base font-semibold text-foreground">{factory.displayName}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-inshop-xs text-foreground/63">
            <span className="font-mono text-foreground/68">
              {t('outfitting.factoryCard.shop', { code: factory.assyShop })}
            </span>
            <span aria-hidden="true" className="text-foreground/35">
              ·
            </span>
            <span>{t('outfitting.factoryCard.areas', { count: overview.areaCount })}</span>
          </p>
        </div>
        <HealthBadge health={factory.health} />
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label={t('outfitting.factoryCard.blocks')}
            value={blockTotal}
            suffix={t('outfitting.factoryCard.blockUnit')}
            detail={t('outfitting.factoryCard.blocksDetail', { count: inProgress })}
          />
          <StatTile
            label={t('outfitting.factoryCard.lidar')}
            value={`${sensorOnline}/${sensorTotal}`}
            detail={
              sensorFault > 0
                ? t('outfitting.factoryCard.lidarFault', { count: sensorFault })
                : t('outfitting.factoryCard.lidarOk')
            }
            detailTone={sensorFault > 0 ? 'text-status-degraded' : 'text-status-healthy'}
          />
          <StatTile
            label={t('outfitting.factoryCard.completed')}
            value={overview.completed}
            suffix={t('outfitting.factoryCard.blockUnit')}
            detail={
              overview.lastScanAt
                ? t('outfitting.factoryCard.lastScan', { time: overview.lastScanAt })
                : undefined
            }
          />
        </div>

        <div className="border-t border-border pt-2.5">
          <h4 className="mb-1.5 px-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
            {t('outfitting.factoryCard.statusComposition')}
          </h4>
          <StatusBar overview={overview} />
        </div>
      </CardContent>

      <CardFooter className="mt-3">
        <LinkButton to={`/indoorshop/zones/outfitting/${factory.id}`} size="sm" className="flex-1">
          {t('outfitting.factoryCard.factoryView')}
        </LinkButton>
      </CardFooter>
    </Card>
  )
}
