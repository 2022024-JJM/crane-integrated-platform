import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import {
  OUTFITTING_STATUS_META,
  type OutfittingBlock,
  type OutfittingSensor,
  type OutfittingSensorStatus,
} from '../../model/block'
import { HealthBadge } from '../../../../shared/entities/zone/ui/HealthBadge'
import { Spinner } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { fetchBlocks, fetchFactories, fetchSensors } from '../../api/outfittingApi'
import { cn } from '../../../../shared/lib/utils'

const SENSOR_META: Record<OutfittingSensorStatus, { labelKey: InshopKey; dot: string }> = {
  online: { labelKey: 'outfitting.sensorStatus.online', dot: 'bg-status-healthy' },
  offline: { labelKey: 'outfitting.sensorStatus.offline', dot: 'bg-foreground/30' },
  error: { labelKey: 'outfitting.sensorStatus.error', dot: 'bg-status-unhealthy' },
}

function NotFoundNotice() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-inshop-xl font-semibold text-foreground">{t('outfitting.workspace.notFound')}</h1>
      <Link
        to="/indoorshop/zones/outfitting/list"
        className="inline-block rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
      >
        {t('outfitting.workspace.backToFactories')}
      </Link>
    </div>
  )
}

/** 블록 한 줄 — 상태·진척·마지막 스캔 */
function BlockRow({ block }: { block: OutfittingBlock }) {
  const { t } = useTranslation()
  const meta = OUTFITTING_STATUS_META[block.status]
  return (
    <li className="flex items-center gap-3 rounded-inshop-md px-2 py-1.5 hover:bg-surface-secondary">
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      <span className="w-24 shrink-0 truncate font-mono text-inshop-xs text-foreground">
        {block.projNo}-{block.blkNo}
      </span>
      <span className="w-12 shrink-0 font-mono text-2xs text-foreground/50">{block.wstgCode}</span>
      <span className={cn('w-14 shrink-0 text-2xs font-medium', meta.ink)}>{t(meta.labelKey)}</span>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
          <span
            className={cn('block h-full rounded-full', meta.dot)}
            style={{ width: `${block.progress}%` }}
          />
        </div>
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-2xs tabular-nums text-foreground/68">
        {block.progress}%
      </span>
      <span className="w-11 shrink-0 text-right font-mono text-2xs text-foreground/45">
        {block.lastScanAt}
      </span>
    </li>
  )
}

/** LiDAR 센서 요약 패널 */
function SensorSummary({ sensors }: { sensors: OutfittingSensor[] }) {
  const { t } = useTranslation()
  const online = sensors.filter((s) => s.status === 'online').length

  return (
    <aside className="rounded-inshop-lg border border-border bg-surface p-3 lg:w-72 lg:shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-inshop-sm font-semibold text-foreground">
          {t('outfitting.workspace.sensorSummaryTitle')}
        </h2>
        <span
          className={cn(
            'font-mono text-inshop-xs tabular-nums',
            online < sensors.length ? 'text-status-degraded' : 'text-status-healthy'
          )}
        >
          {online}/{sensors.length}
        </span>
      </div>
      <ul className="space-y-0.5">
        {sensors.map((sensor) => {
          const meta = SENSOR_META[sensor.status]
          return (
            <li key={sensor.id} className="flex items-center gap-2 px-1 py-1 text-inshop-xs">
              <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
              <span className="w-16 shrink-0 truncate font-mono text-2xs text-foreground">
                {sensor.name}
              </span>
              <span className="min-w-0 flex-1 truncate text-2xs text-foreground/54">
                {sensor.areaName}
              </span>
              <span className="shrink-0 font-mono text-2xs text-foreground/45">
                {sensor.lastScanAt}
              </span>
            </li>
          )
        })}
        {sensors.length === 0 && (
          <li className="px-1 py-2 text-2xs text-foreground/45">{t('common.none')}</li>
        )}
      </ul>
    </aside>
  )
}

/**
 * 선행의장 공장 워크스페이스 — 블록 리스트 중심.
 *
 * 의장은 블록 하나가 작업 단위라, 이 화면은 그 공장의 블록들을 구역별로 묶어 상태·진척으로
 * 보여주고, 옆에 LiDAR 센서 상태를 요약한다. (3D 뷰어는 이번 범위가 아니다.)
 */
export function OutfittingWorkspace() {
  const { t } = useTranslation()
  const { factoryId } = useParams<{ factoryId: string }>()

  const { data: factories } = useAsyncData(() => fetchFactories(), [])
  const { data: blocks } = useAsyncData(() => fetchBlocks(factoryId ?? ''), [factoryId])
  const { data: sensors } = useAsyncData(() => fetchSensors(factoryId ?? ''), [factoryId])

  const factory = factories?.find((f) => f.id === factoryId)

  /* 블록을 구역별로 묶는다 — 구역이 곧 "어디에 있는가" 이다 */
  const byArea = useMemo(() => {
    const groups = new Map<string, OutfittingBlock[]>()
    for (const block of blocks ?? []) {
      const bucket = groups.get(block.areaName)
      if (bucket) bucket.push(block)
      else groups.set(block.areaName, [block])
    }
    return [...groups.entries()]
  }, [blocks])

  if (factories && !factory) return <NotFoundNotice />

  if (!factory || !blocks || !sensors) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={26} label={t('common.loading')} className="text-accent" />
      </div>
    )
  }

  const inProgress = blocks.filter((b) => b.status === 'in_progress').length
  const completed = blocks.filter((b) => b.status === 'completed').length

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/indoorshop/zones/outfitting/list"
          className="text-inshop-xs text-foreground/55 transition-colors hover:text-accent"
        >
          ← {t('outfitting.workspace.backToFactories')}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-inshop-xl font-semibold text-foreground">{factory.displayName}</h1>
          <span className="font-mono text-inshop-xs text-foreground/55">
            {t('outfitting.factoryCard.shop', { code: factory.assyShop })}
          </span>
          <HealthBadge health={factory.health} />
          <span className="text-inshop-xs text-foreground/63">
            {t('outfitting.workspace.blockSummary', {
              total: blocks.length,
              inProgress,
              completed,
            })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="min-w-0 flex-1 rounded-inshop-lg border border-border bg-surface p-3">
          <h2 className="mb-2 text-inshop-sm font-semibold text-foreground">
            {t('outfitting.workspace.blockListTitle')}
          </h2>
          {byArea.length === 0 ? (
            <p className="px-2 py-6 text-center text-inshop-sm text-foreground/45">
              {t('outfitting.workspace.noBlocks')}
            </p>
          ) : (
            <div className="space-y-3">
              {byArea.map(([areaName, areaBlocks]) => (
                <div key={areaName}>
                  <div className="mb-0.5 flex items-center justify-between px-2">
                    <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
                      {areaName}
                    </h3>
                    <span className="font-mono text-2xs text-foreground/40">
                      {t('outfitting.workspace.blockCount', { count: areaBlocks.length })}
                    </span>
                  </div>
                  <ul>
                    {areaBlocks.map((block) => (
                      <BlockRow key={block.id} block={block} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <SensorSummary sensors={sensors} />
      </div>
    </div>
  )
}
