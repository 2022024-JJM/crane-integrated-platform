import { useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { LidarSensor, LidarSensorStatus } from '../model/lidarSensor'
import { cn } from '../../../shared/lib/utils'
import { useClock } from '../../../shared/lib/useClock'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import { ChevronDownIcon } from '../../../shared/ui/icons'
import { sensorStatusCounts } from '../lib/bayStatusSummary'
import { FRESHNESS_THRESHOLDS, heartbeatElapsedMinutes } from '../lib/freshness'

interface LidarSensorStatusListProps {
  sensors: LidarSensor[]
  /** 센서 인덱스별 PCD point 색상 — 전달 시 뷰어의 점 색과 대응되는 색 칩을 표시한다 */
  pointColors?: string[]
  /**
   * 어떤 바탕 위에 서는가. `glass` 는 3D 위 유리 도구줄 안에 들어갈 때 —
   * 제 판(테두리·면)을 두르지 않고, 색은 유리 위에서 읽히는 `--glass-*` 램프를 쓴다.
   */
  tone?: 'surface' | 'glass'
  className?: string
  selectedSensorId?: string | null
  onSelectSensor?: (sensorId: string, sensorIndex: number) => void
}

const statusConfig: Record<
  LidarSensorStatus,
  { labelKey: InshopKey; ring: string; glassRing: string; dim: boolean }
> = {
  online: {
    labelKey: 'sensors.status.online',
    ring: 'ring-material-border',
    glassRing: 'ring-glass-border',
    dim: false,
  },
  offline: {
    labelKey: 'sensors.status.offline',
    ring: 'ring-foreground/25',
    glassRing: 'ring-glass-foreground/25',
    dim: true,
  },
  error: {
    labelKey: 'sensors.status.error',
    ring: 'ring-status-unhealthy/60',
    glassRing: 'ring-glass-unhealthy/60',
    dim: true,
  },
  calibrating: {
    labelKey: 'sensors.status.calibrating',
    ring: 'ring-sky-500/60',
    glassRing: 'ring-sky-300/60',
    dim: false,
  },
}

function SensorStatusIcon({ status, className }: { status: LidarSensorStatus; className?: string }) {
  if (status === 'online') {
    return <svg aria-hidden="true" viewBox="0 0 16 16" className={className}><path d="m4 8 2.4 2.4L12 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  if (status === 'calibrating') {
    return <svg aria-hidden="true" viewBox="0 0 16 16" className={cn(className, 'animate-spin motion-reduce:animate-none')}><path d="M13 8a5 5 0 1 1-1.5-3.55M11.5 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  if (status === 'offline') {
    return <svg aria-hidden="true" viewBox="0 0 16 16" className={className}><path d="M5.5 5.5 3 8l2.5 2.5M10.5 5.5 13 8l-2.5 2.5M2.5 2.5l11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  return <svg aria-hidden="true" viewBox="0 0 16 16" className={className}><path d="M8 2.2 14 13H2L8 2.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M8 5.8v3.5M8 11.4h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

/**
 * 경과 시간 표기.
 * `14:32` 만 보면 그게 방금인지 세 시간 전인지 알 수 없다 — 신선도가 곧 센서 상태다.
 */
function formatElapsed(minutes: number, t: TFunction): string {
  if (minutes < 1) return t('common.justNow')
  if (minutes < 60) return t('common.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('common.hoursAgo', { count: hours })
  return t('common.daysAgo', { count: Math.floor(hours / 24) })
}

/**
 * 신선도 등급 — 임계값은 lib/freshness 가 소유한다 (운영 합의 전 설정값, FR-1).
 *
 * 색은 보조 신호일 뿐이다 — 경과 시간 글자가 이미 같은 사실을 말하고 있으므로
 * 색각 이상이나 흑백 출력에서도 정보가 사라지지 않는다.
 */
function freshnessClass(minutes: number | null, glass: boolean): string {
  if (minutes === null) return glass ? 'text-glass-foreground/54' : 'text-foreground/54'
  if (minutes >= FRESHNESS_THRESHOLDS.deadMinutes)
    return glass ? 'text-glass-unhealthy' : 'text-status-unhealthy'
  if (minutes >= FRESHNESS_THRESHOLDS.staleMinutes)
    return glass ? 'text-glass-degraded' : 'text-status-degraded'
  return glass ? 'text-glass-foreground/58' : 'text-foreground/58'
}

/** 경과를 칩 안에 넣을 짧은 형태로 — "전"까지 붙이면 8칸이 한 줄에 안 들어간다 */
function formatElapsedShort(minutes: number, t: TFunction): string {
  if (minutes < 1) return t('sensors.justNow')
  if (minutes < 60) return t('sensors.shortMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('sensors.shortHours', { count: hours })
  return t('sensors.shortDays', { count: Math.floor(hours / 24) })
}

/**
 * 센서 상태 바.
 *
 * 센서별 스캔 시각을 **접지 않고 그대로** 낸다 — 한 번 더 눌러야 보이는 값은 결국
 * 아무도 보지 않는데, 여기서 제일 중요한 것이 "각 센서가 언제 마지막으로 찍었는가"다.
 *
 * 대신 하나의 계기 바로 묶는다. 센서마다 테두리 상자를 두르면 여덟 개가 각자
 * 떠들어서 어수선해지므로, 바깥에만 테두리를 두고 안쪽은 같은 결의 칸으로 나눈다.
 * 이상이 있는 센서만 테두리를 얻는다 — 눈이 갈 곳은 거기 하나면 된다.
 */
export function LidarSensorStatusList({
  sensors,
  pointColors,
  tone = 'surface',
  className,
  selectedSensorId = null,
  onSelectSensor,
}: LidarSensorStatusListProps) {
  const { t } = useTranslation()
  const glass = tone === 'glass'
  const [expanded, setExpanded] = useState(true)
  // 경과 표기가 굳지 않도록 30초마다 다시 계산한다
  const now = useClock(30000)

  if (sensors.length === 0) {
    return (
      <p className={cn('rounded-inshop-lg p-3 text-inshop-sm', glass ? 'glass-panel text-glass-foreground/68' : 'border border-border bg-surface text-foreground/68', className)}>
        {t('sensors.empty')}
      </p>
    )
  }

  const counts = sensorStatusCounts(sensors)
  const allOnline = counts.online === sensors.length
  const statusOrder: LidarSensorStatus[] = ['online', 'calibrating', 'offline', 'error']

  return (
    <section data-lidar-sensor-panel className={cn('overflow-hidden rounded-inshop-lg', glass ? 'glass-panel' : 'border border-border bg-surface', className)} aria-label={t('sensors.title')}>
      <header className={cn('flex items-center gap-2 border-b px-2.5 py-1.5', glass ? 'border-glass-border/70' : 'border-border')}>
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className={cn('shrink-0 text-inshop-xs font-semibold', glass ? 'text-glass-foreground/90' : 'text-foreground')}>{t('sensors.title')}</h2>
          <span className={cn('text-2xs', glass ? 'text-glass-foreground/45' : 'text-foreground/48')}>{sensors.length}</span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="hidden items-center gap-2 text-2xs sm:flex">
            {statusOrder.filter((status) => counts[status] > 0).map((status) => (
              <span key={status} className={cn('flex items-center gap-0.5', glass ? 'text-glass-foreground/68' : 'text-foreground/62')}>
                <SensorStatusIcon status={status} className={cn('h-3 w-3', STATUS_ICON_INK[status][glass ? 'glass' : 'surface'])} />
                <span className="font-mono tabular-nums">{counts[status]}</span>
                <span className="sr-only">{t(statusConfig[status].labelKey)}</span>
              </span>
            ))}
          </div>
          <StatusChip
            tone={allOnline ? 'good' : 'warning'}
            label={`${counts.online}/${sensors.length}`}
            title={`${t('sensors.status.online')} ${counts.online} / ${sensors.length}`}
            className={cn('px-1.5 py-0.5 text-2xs', glass && (allOnline ? 'bg-glass-healthy/10 text-glass-healthy' : 'bg-glass-degraded/10 text-glass-degraded'))}
          />
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={t(expanded ? 'sensors.collapse' : 'sensors.expand')}
            onClick={() => setExpanded((value) => !value)}
            className={cn('grid h-6 w-6 place-items-center rounded transition-colors focus:outline-none focus-visible:ring-2', glass ? 'text-glass-foreground/55 hover:bg-white/10 hover:text-glass-foreground' : 'text-foreground/55 hover:bg-foreground/5 hover:text-foreground')}
          >
            <ChevronDownIcon size={14} className={cn('transition-transform', !expanded && '-rotate-90')} />
          </button>
        </div>
      </header>
      {expanded && <ul className="max-h-56 divide-y divide-border/50 overflow-y-auto px-1.5 py-1">
      {sensors.map((sensor, index) => {
        const config = statusConfig[sensor.status]
        const statusLabel = t(config.labelKey)
        const pointColor = pointColors?.[index % (pointColors.length || 1)]
        const timeSource = sensor.lastHeartbeatAt ?? sensor.lastScanAt
        const minutes = heartbeatElapsedMinutes(timeSource, now)
        const heartbeatMinutes = sensor.lastHeartbeatAt ? minutes : null
        const failing = sensor.status !== 'online'

        return (
          <li
            key={sensor.id}
            title={`${sensor.name} · ${statusLabel} · Heartbeat ${
              sensor.lastHeartbeatAt ?? '-'
            } · ${t('sensors.lastScan')} ${sensor.lastScanAt || '-'}${minutes === null ? '' : ` (${formatElapsed(minutes, t)})`} · FOV ${sensor.diagnostics?.fovMode ?? '-'}`}
            className={cn(
              'rounded px-1.5 py-1',
              glass ? 'hover:bg-white/[0.045]' : 'hover:bg-surface-secondary',
              failing && 'ring-1 ring-inset',
              failing && (glass ? config.glassRing : config.ring),
              selectedSensorId === sensor.id && (glass ? 'ring-2 ring-glass-accent' : 'ring-2 ring-accent'),
            )}
          >
            <button
              type="button"
              aria-pressed={selectedSensorId === sensor.id}
              onClick={() => onSelectSensor?.(sensor.id, index)}
              className="block w-full rounded-inshop-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glass-accent"
            >
            <div className="flex min-h-6 items-center gap-1.5">
              {pointColor && <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-inshop-xs', config.dim && 'opacity-50')} style={{ backgroundColor: pointColor }} />}
              <SensorStatusIcon status={sensor.status} className={cn('h-3.5 w-3.5 shrink-0', STATUS_ICON_INK[sensor.status][glass ? 'glass' : 'surface'])} />
              <span className={cn('min-w-0 flex-1 truncate font-mono text-2xs font-semibold', glass ? 'text-glass-foreground/88' : 'text-foreground/85')}>{sensor.name || `LiDAR ${index + 1}`}</span>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] leading-none tabular-nums',
                  glass ? 'border-white/10 bg-white/[0.055]' : 'border-border bg-surface-secondary',
                  freshnessClass(heartbeatMinutes, glass),
                )}
              >
                <svg aria-hidden="true" viewBox="0 0 16 16" className="h-2.5 w-2.5">
                  <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 4.7V8l2.3 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {minutes === null ? '-' : formatElapsedShort(minutes, t)}
              </span>
              <span className={cn('shrink-0 text-2xs font-medium', STATUS_ICON_INK[sensor.status][glass ? 'glass' : 'surface'])}>{statusLabel}</span>
            </div>
            <dl className={cn('flex flex-wrap items-center gap-x-3 gap-y-0.5 pb-0.5 pl-5 text-2xs', glass ? 'text-glass-foreground/52' : 'text-foreground/52')}>
              <div className="flex gap-1"><dt>Heartbeat</dt><dd className="font-mono tabular-nums">{sensor.lastHeartbeatAt ?? '-'}</dd></div>
              <div className="flex gap-1"><dt>{t('sensors.lastScan')}</dt><dd className="font-mono tabular-nums">{sensor.lastScanAt ? sensor.lastScanAt.replace('T', ' ') : '-'}</dd></div>
              <div className="flex gap-1"><dt>{t('assembly.bayPanel.scanRate')}</dt><dd className="font-mono tabular-nums">{sensor.diagnostics?.scanRatePtsPerSec !== undefined ? sensor.diagnostics.scanRatePtsPerSec.toLocaleString() : '-'}</dd></div>
              <div className="flex gap-1"><dt>{t('assembly.bayPanel.temperature')}</dt><dd className="font-mono tabular-nums">{sensor.diagnostics?.temperatureC !== undefined ? `${sensor.diagnostics.temperatureC}°C` : '-'}</dd></div>
              <div className="flex gap-1"><dt>{t('assembly.bayPanel.rssi')}</dt><dd className="font-mono tabular-nums">{sensor.diagnostics?.rssiDbm !== undefined ? `${sensor.diagnostics.rssiDbm}dBm` : '-'}</dd></div>
              <div className="flex gap-1"><dt>FOV</dt><dd className="font-mono">{sensor.diagnostics?.fovMode ?? '-'}</dd></div>
              {sensor.errorCode && <div className={cn('flex gap-1', glass ? 'text-glass-unhealthy' : 'text-status-unhealthy')}><dt>{t('assembly.bayPanel.errorCode')}</dt><dd className="font-mono">{sensor.errorCode}</dd></div>}
            </dl>
            </button>
          </li>
        )
      })}
      </ul>}
    </section>
  )
}

const STATUS_ICON_INK: Record<LidarSensorStatus, { surface: string; glass: string }> = {
  online: { surface: 'text-status-healthy', glass: 'text-glass-healthy' },
  calibrating: { surface: 'text-sky-600', glass: 'text-sky-300' },
  offline: { surface: 'text-foreground/54', glass: 'text-glass-foreground/54' },
  error: { surface: 'text-status-unhealthy', glass: 'text-glass-unhealthy' },
}
