import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import { LOCATION_STATUS_META } from '../../../shared/entities/location/model/types'
import type { FactoryBaySummary, FactoryOverview } from '../../../shared/entities/factory/model/overview'
import { Card, CardContent, CardFooter, CardHeader } from '../../../shared/ui/atoms/Card'
import { Button, LinkButton } from '../../../shared/ui/atoms/Button'
import { HealthBadge } from '../../../shared/entities/zone/ui/HealthBadge'
import { ChevronRightIcon } from '../../../shared/ui/icons'
import { cn } from '../../../shared/lib/utils'
import { isRealLocation, REAL_BAY_LABEL } from '../api/realScanData'
import { LAYOUT_DRAWING_REVISION } from '../../../shared/entities/equipment/layoutDrawings'
import { DrawingViewerModal } from '../../../shared/features/drawing-viewer'
import { layoutDrawingOfFactoryId } from '../lib/mapEntry'

interface FactoryCardProps {
  overview: FactoryOverview
}

const UNIT_LEVEL_LABEL_KEY: Record<FactoryOverview['unitLevel'], InshopKey | null> = {
  assembly: 'assembly.factoryCard.unitAssembly',
  block: 'assembly.factoryCard.unitBlock',
  mixed: 'assembly.factoryCard.unitMixed',
  none: null,
}

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
    /*
     * 숫자 크기는 `text-inshop-xl` 까지다.
     * 이 카드에는 타일이 셋 나란히 서는데, 대시보드의 단일 지표처럼 2xl 로 키우면
     * 셋이 서로 경쟁하면서 정작 아래의 정반 목록(고르는 근거)이 부속처럼 보인다.
     */
    <div className="rounded-inshop-md bg-surface-secondary/70 px-2.5 py-2">
      <p className="text-2xs font-medium text-foreground/58">{label}</p>
      {/* 수치는 잉크 토큰을 입는다 — 강조색은 링크·활성 표시의 몫 */}
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

/** 정반 가동 구성 — 숫자 세 개를 나란히 적는 대신 길이로 보여준다 */
function OccupancyBar({ overview }: { overview: FactoryOverview }) {
  const { t } = useTranslation()
  const total = overview.bays.length || 1
  const segments = [
    { key: 'occupied' as const, count: overview.occupiedCount },
    { key: 'unknown' as const, count: overview.unknownCount },
    { key: 'empty' as const, count: overview.emptyCount },
  ].filter((segment) => segment.count > 0)

  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-secondary">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={LOCATION_STATUS_META[segment.key].dot}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {(['occupied', 'unknown', 'empty'] as const).map((status) => {
          const meta = LOCATION_STATUS_META[status]
          const count = {
            occupied: overview.occupiedCount,
            unknown: overview.unknownCount,
            empty: overview.emptyCount,
          }[status]
          return (
            <span key={status} className="flex items-center gap-1.5 text-2xs text-foreground/63">
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {t(meta.labelKey)} {count}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** 정반 한 줄 — 여기서 바로 그 정반의 3D 화면으로 들어간다 */
function BayRow({ factoryId, bay }: { factoryId: string; bay: FactoryBaySummary }) {
  const { t } = useTranslation()
  const meta = LOCATION_STATUS_META[bay.status]
  const sensorFault = bay.sensorTotal - bay.sensorOnline

  return (
    <li>
      <Link
        to={`/indoorshop/zones/assembly/${factoryId}/${bay.locationId}`}
        title={t('assembly.factoryCard.bayRowTitle', {
          name: bay.name,
          code: bay.workCntr,
          status: t(meta.labelKey),
        })}
        className={cn(
          'group flex items-center gap-2 rounded-inshop-md px-2 py-1 transition-colors',
          'hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
        <span className="w-14 shrink-0 truncate text-inshop-xs font-medium text-foreground">
          {bay.name}
        </span>
        <span className="w-10 shrink-0 font-mono text-2xs text-foreground/50">{bay.workCntr}</span>

        {/* 무엇이 올라와 있는가 — 공석이면 그 사실 자체가 정보다. 실측 정반은 스캔 자체가 내용이다 */}
        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground/68">
          {bay.projNo && bay.blkNo ? (
            `${bay.projNo}-${bay.blkNo}`
          ) : isRealLocation(bay.locationId) ? (
            <span className="font-inshop-sans text-accent/90">{t('assembly.factoryCard.realScanRow')}</span>
          ) : (
            <span className="font-inshop-sans text-foreground/45">{t('assembly.factoryCard.unassigned')}</span>
          )}
        </span>

        <span
          className={cn(
            'shrink-0 font-mono text-2xs tabular-nums',
            sensorFault > 0 ? 'text-status-degraded' : 'text-foreground/54',
          )}
          title={t('assembly.factoryCard.lidarTitle', {
            online: bay.sensorOnline,
            total: bay.sensorTotal,
          })}
        >
          {bay.sensorOnline}/{bay.sensorTotal}
        </span>

        <span
          className="w-10 shrink-0 text-right text-2xs tabular-nums text-foreground/63"
          title={t('assembly.factoryCard.todayCountTitle')}
        >
          {bay.todayCount > 0
            ? t('assembly.factoryCard.todayCountValue', { count: bay.todayCount })
            : t('common.none')}
        </span>

        <ChevronRightIcon
          size={13}
          className="shrink-0 text-foreground/30 transition-colors group-hover:text-accent"
        />
      </Link>
    </li>
  )
}

/**
 * 공장 카드.
 *
 * 이 목록은 "어느 공장으로 들어갈까"를 고르는 화면이다 — 그래서 이름과 위치 수만
 * 내면 고를 근거가 없다. 규모(정반·센서·오늘 실적)를 위에, 그렇게 나온 숫자의
 * 내역(정반 한 줄씩)을 아래에 두고, 정반 줄에서 바로 그 3D 화면으로 들어가게 한다.
 */
export function FactoryCard({ overview }: FactoryCardProps) {
  const { t } = useTranslation()
  const { factory, bays, sensorTotal, sensorOnline, sensorFault } = overview
  const unitLabelKey = UNIT_LEVEL_LABEL_KEY[overview.unitLevel]
  /* 설비 배치 도면 — 없는 공장(도장)에는 버튼을 세우지 않는다 */
  const [drawingOpen, setDrawingOpen] = useState(false)
  const drawing = layoutDrawingOfFactoryId(factory.id)
  /* 실측 정반(PBS 5BAY)을 품은 공장 — 카드 머리글에서 그 사실을 먼저 말한다 */
  const hasRealBay = bays.some((bay) => isRealLocation(bay.locationId))

  return (
    <Card className="flex flex-col p-4">
      <CardHeader className="mb-3 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-inshop-base font-semibold text-foreground">{factory.displayName}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-inshop-xs text-foreground/63">
            <span className="font-mono text-foreground/68">
              {t('assembly.factoryCard.shop', { code: factory.assyShop })}
            </span>
            {unitLabelKey && (
              <>
                <span aria-hidden="true" className="text-foreground/35">
                  ·
                </span>
                <span>{t(unitLabelKey)}</span>
              </>
            )}
            {hasRealBay && (
              <>
                <span aria-hidden="true" className="text-foreground/35">
                  ·
                </span>
                <span className="rounded-inshop-sm bg-accent/12 px-1 py-px font-medium text-accent">
                  {t('assembly.factoryCard.realScanBadge', { code: REAL_BAY_LABEL })}
                </span>
              </>
            )}
          </p>
        </div>
        <HealthBadge health={factory.health} />
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label={t('assembly.factoryCard.bays')}
            value={bays.length}
            suffix={t('assembly.factoryCard.bayUnit')}
            detail={t('assembly.factoryCard.baysDetail', { count: overview.occupiedCount })}
          />
          <StatTile
            label={t('assembly.factoryCard.lidar')}
            value={`${sensorOnline}/${sensorTotal}`}
            detail={
              sensorFault > 0
                ? t('assembly.factoryCard.lidarFault', { count: sensorFault })
                : t('assembly.factoryCard.lidarOk')
            }
            detailTone={sensorFault > 0 ? 'text-status-degraded' : 'text-status-healthy'}
          />
          <StatTile
            label={t('assembly.factoryCard.todayDone')}
            value={overview.todayCount}
            suffix={t('assembly.factoryCard.todayUnit')}
            detail={
              overview.lastScanAt
                ? t('assembly.factoryCard.lastScan', { time: overview.lastScanAt })
                : undefined
            }
          />
        </div>

        <OccupancyBar overview={overview} />

        <div className="border-t border-border pt-2.5">
          <div className="mb-0.5 flex items-center justify-between px-2">
            <h4 className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
              {t('assembly.factoryCard.bayStatus')}
            </h4>
            <span className="font-mono text-2xs text-foreground/40">{t('assembly.factoryCard.sensorToday')}</span>
          </div>
          <ul>
            {bays.map((bay) => (
              <BayRow key={bay.locationId} factoryId={factory.id} bay={bay} />
            ))}
          </ul>
        </div>
      </CardContent>

      <CardFooter className="mt-3">
        <LinkButton to={`/indoorshop/zones/assembly/${factory.id}`} size="sm" className="flex-1">
          {t('assembly.factoryCard.factoryView')}
        </LinkButton>
        <LinkButton to={`/indoorshop/zones/assembly/${factory.id}/production`} size="sm" variant="ghost">
          {t('assembly.factoryCard.dailyProduction')}
        </LinkButton>
        {drawing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDrawingOpen(true)}
            title={t('drawing.openHint', { factory: drawing.title })}
          >
            {t('drawing.open')}
          </Button>
        )}
      </CardFooter>
      {drawing && drawingOpen && (
        <DrawingViewerModal
          src={drawing.src}
          title={drawing.title}
          subtitle={`${drawing.drawingNo} · ${LAYOUT_DRAWING_REVISION} · p.${drawing.page}`}
          width={drawing.width}
          height={drawing.height}
          onClose={() => setDrawingOpen(false)}
        />
      )}
    </Card>
  )
}
