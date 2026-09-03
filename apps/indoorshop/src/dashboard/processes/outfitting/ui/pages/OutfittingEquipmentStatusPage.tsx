import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../../shared/lib/utils'
import { StatusChip } from '../../../../shared/ui/atoms/StatusChip'
import {
  OUTFITTING_DEVICE_KINDS,
  OUTFITTING_DEVICE_META,
  type OutfittingDeviceSummary,
} from '../../model/equipment'
import {
  deviceSummaryOf,
  devicesByBay,
  outfittingDevices,
  outfittingFactoryNames,
} from '../../lib/equipmentStatus'
import { OutfittingDeviceStatusList } from '../OutfittingDeviceStatusList'

/*
 * 선행의장 설비 상태.
 *
 * 조립에는 센서 상태 패널이, 도장에는 SCADA 설비 화면이 있는데 의장만 설비를 볼 자리가
 * 없었다 — 같은 문법으로 세운다. 왼쪽에서 공장을 고르고 오른쪽에서 **베이로 드릴다운**
 * 하는 형태이고, 각 목록의 `n/n` 칩·하트비트 경과·이상 한 대만 테두리를 얻는 규칙은
 * 조립 센서 목록과 같다.
 *
 * 대수·자리의 단일 소스는 설비 엔티티다(`lib/equipmentStatus` 가 읽는다). 도면 이관이
 * 아직 그 공장에 닿지 않았으면 구역 골격 위의 **목업 자리**가 서고 화면이 그렇다고
 * 말한다 — 없는 설비를 실데이터인 척 세우지 않는다.
 */

/** 전 공장을 가로지르는 한 줄 요약 — 공장 목록 화면의 요약 줄과 같은 문법 */
function OverallSummary({ summaries }: { summaries: OutfittingDeviceSummary[] }) {
  const { t } = useTranslation()
  const total = summaries.reduce((sum, s) => sum + s.total, 0)
  const online = summaries.reduce((sum, s) => sum + s.online, 0)
  const issues = total - online
  const lastHeartbeatAt = summaries
    .map((s) => s.lastHeartbeatAt)
    .filter((time): time is string => Boolean(time))
    .sort()
    .at(-1)

  const items: { label: string; value: string; tone?: string }[] = [
    {
      label: t('outfitting.equipment.summary.factories'),
      value: t('outfitting.equipment.summary.factoriesValue', { count: summaries.length }),
    },
    {
      label: t('outfitting.equipment.summary.devices'),
      value: t('outfitting.equipment.summary.devicesValue', { count: total }),
    },
    {
      label: t('outfitting.equipment.summary.online'),
      value: t('outfitting.equipment.summary.onlineValue', { online, total }),
      tone: issues > 0 ? 'text-status-degraded' : 'text-status-healthy',
    },
    {
      label: t('outfitting.equipment.summary.issues'),
      value:
        issues > 0
          ? t('outfitting.equipment.summary.issuesValue', { count: issues })
          : t('outfitting.equipment.summary.issuesNone'),
      tone: issues > 0 ? 'text-status-degraded' : undefined,
    },
    {
      label: t('outfitting.equipment.summary.lastHeartbeat'),
      value: lastHeartbeatAt ?? t('common.none'),
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

/** 종류별 대수 — 라이다만이 아니라는 사실을 한 줄로 말한다 */
function KindBreakdown({ summary }: { summary: OutfittingDeviceSummary }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {OUTFITTING_DEVICE_KINDS.filter((kind) => summary.byKind[kind].total > 0).map((kind) => {
        const slot = summary.byKind[kind]
        const meta = OUTFITTING_DEVICE_META[kind]
        return (
          <span key={kind} className="flex items-center gap-1.5 text-2xs text-foreground/62">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {t(meta.labelKey)}
            <span
              className={cn(
                'font-mono tabular-nums',
                slot.online < slot.total ? 'text-status-degraded' : 'text-foreground/78'
              )}
            >
              {slot.online}/{slot.total}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function OutfittingEquipmentStatusPage() {
  const { t } = useTranslation()
  const factories = useMemo(() => outfittingFactoryNames(), [])
  const summaries = useMemo(() => factories.map(deviceSummaryOf), [factories])
  const [selectedFactory, setSelectedFactory] = useState(() => factories[0] ?? '')

  const selectedSummary = summaries.find((s) => s.factory === selectedFactory) ?? null
  const bays = useMemo(
    () => devicesByBay(selectedFactory ? outfittingDevices(selectedFactory) : []),
    [selectedFactory]
  )
  const anyPlaceholder = summaries.some((summary) => summary.placeholder)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-inshop-xl font-semibold text-foreground">
            {t('outfitting.equipment.title')}
          </h1>
          <p className="mt-1 text-inshop-sm text-foreground/68">{t('outfitting.equipment.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/indoorshop/zones/outfitting"
            className="rounded-inshop-md border border-border px-2.5 py-1 text-inshop-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('outfitting.equipment.mapLink')}
          </Link>
          <Link
            to="/indoorshop/zones/outfitting/list"
            className="rounded-inshop-md border border-border px-2.5 py-1 text-inshop-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('outfitting.equipment.listLink')}
          </Link>
        </div>
      </div>

      <OverallSummary summaries={summaries} />

      {anyPlaceholder && (
        <p className="rounded-inshop-lg border border-status-degraded/40 bg-status-degraded/5 px-3 py-2 text-inshop-xs leading-relaxed text-foreground/72">
          {t('outfitting.equipment.placeholderNote')}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* 공장 고르기 — 접힌 줄에 대수·이상이 이미 보여서 열지 않고도 훑을 수 있다 */}
        <ul className="flex flex-col gap-1.5">
          {summaries.map((summary) => {
            const selected = summary.factory === selectedFactory
            return (
              <li key={summary.factory}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedFactory(summary.factory)}
                  className={cn(
                    'w-full rounded-inshop-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selected
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface hover:bg-surface-secondary'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        summary.issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-inshop-sm font-medium text-foreground">
                      {summary.factory}
                    </span>
                    <StatusChip
                      tone={summary.issues > 0 ? 'warning' : 'good'}
                      label={`${summary.online}/${summary.total}`}
                      title={t('outfitting.equipment.onlineOf', {
                        online: summary.online,
                        total: summary.total,
                      })}
                      className="px-1.5 py-0.5 text-2xs"
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-foreground/55">
                    <span>
                      {summary.issues > 0
                        ? t('outfitting.equipment.needsCheck', { count: summary.issues })
                        : t('outfitting.equipment.allHealthy')}
                    </span>
                    {summary.lastHeartbeatAt && (
                      <span className="font-mono tabular-nums">
                        {t('outfitting.equipment.heartbeatAt', { time: summary.lastHeartbeatAt })}
                      </span>
                    )}
                    {summary.placeholder && (
                      <span className="text-foreground/45">
                        {t('outfitting.equipment.placeholderShort')}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        {/* 베이 드릴다운 — 고른 공장의 설비를 베이(도면 미수령 공장은 구역)별로 */}
        <div className="min-w-0 space-y-3">
          {selectedSummary && (
            <div className="rounded-inshop-lg border border-border bg-surface px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-inshop-sm font-semibold text-foreground">{selectedSummary.factory}</h2>
                <span className="text-2xs text-foreground/55">
                  {t('outfitting.equipment.bayCount', { count: bays.size })}
                </span>
              </div>
              <div className="mt-2">
                <KindBreakdown summary={selectedSummary} />
              </div>
            </div>
          )}
          {bays.size === 0 ? (
            <p className="rounded-inshop-lg border border-dashed border-border px-3 py-8 text-center text-inshop-sm text-foreground/55">
              {t('outfitting.equipment.empty')}
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {[...bays.entries()].map(([bay, devices]) => (
                <OutfittingDeviceStatusList
                  key={bay}
                  title={
                    bay === '-'
                      ? t('outfitting.equipment.unassignedBay')
                      : t('outfitting.equipment.bayHeading', { bay })
                  }
                  devices={devices}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
