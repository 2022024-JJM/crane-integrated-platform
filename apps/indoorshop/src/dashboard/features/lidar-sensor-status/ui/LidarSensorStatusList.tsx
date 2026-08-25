import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { LidarSensor, LidarSensorStatus } from '../../../entities/lidar-sensor/model/types'
import { cn } from '../../../shared/lib/utils'
import { useClock } from '../../../shared/lib/useClock'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'

interface LidarSensorStatusListProps {
  sensors: LidarSensor[]
  /** 센서 인덱스별 PCD point 색상 — 전달 시 뷰어의 점 색과 대응되는 색 칩을 표시한다 */
  pointColors?: string[]
}

const statusConfig: Record<LidarSensorStatus, { labelKey: InshopKey; ring: string; dim: boolean }> = {
  online: { labelKey: 'sensors.status.online', ring: 'ring-material-border', dim: false },
  offline: { labelKey: 'sensors.status.offline', ring: 'ring-foreground/25', dim: true },
  error: { labelKey: 'sensors.status.error', ring: 'ring-status-unhealthy/60', dim: true },
}

/** "HH:MM" 을 오늘 날짜의 시각으로 읽는다 (백엔드 포맷 미확정 — mock 은 시:분만 준다) */
function parseScanTime(value: string, now: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const at = new Date(now)
  at.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return at
}

/** 마지막 스캔 이후 경과 분. 읽을 수 없는 값이면 null */
function elapsedMinutes(scanAt: string, now: Date): number | null {
  const at = parseScanTime(scanAt, now)
  if (!at) return null
  // 미래로 찍힌 값(시계 오차·자정 넘김)은 0 분으로 본다
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60000))
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
 * 신선도 등급.
 *
 * 색은 보조 신호일 뿐이다 — 경과 시간 글자가 이미 같은 사실을 말하고 있으므로
 * 색각 이상이나 흑백 출력에서도 정보가 사라지지 않는다.
 */
const STALE_MINUTES = 10
const DEAD_MINUTES = 60

function freshnessClass(minutes: number | null): string {
  if (minutes === null) return 'text-foreground/54'
  if (minutes >= DEAD_MINUTES) return 'text-status-unhealthy'
  if (minutes >= STALE_MINUTES) return 'text-status-degraded'
  return 'text-foreground/58'
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
export function LidarSensorStatusList({ sensors, pointColors }: LidarSensorStatusListProps) {
  const { t } = useTranslation()
  // 경과 표기가 굳지 않도록 30초마다 다시 계산한다
  const now = useClock(30000)

  if (sensors.length === 0) {
    return <p className="text-inshop-sm text-foreground/68">{t('sensors.empty')}</p>
  }

  const online = sensors.filter((s) => s.status === 'online')
  const allOnline = online.length === sensors.length

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-inshop-lg border border-border bg-surface px-2 py-1">
      <h2 className="shrink-0 text-inshop-xs font-semibold text-foreground/70">{t('sensors.title')}</h2>

      <StatusChip
        tone={allOnline ? 'good' : 'warning'}
        label={`${online.length}/${sensors.length}`}
        title={`${t('sensors.status.online')} ${online.length} / ${sensors.length}`}
        className="px-1.5 py-0.5 text-2xs"
      />

      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />

      {sensors.map((sensor, index) => {
        const config = statusConfig[sensor.status]
        const statusLabel = t(config.labelKey)
        const pointColor = pointColors?.[index % (pointColors.length || 1)]
        const minutes = elapsedMinutes(sensor.lastScanAt, now)
        const failing = sensor.status !== 'online'

        return (
          <span
            key={sensor.id}
            title={`${sensor.name} · ${statusLabel} · ${t('assembly.factoryList.summaryLastScan')} ${
              sensor.lastScanAt
            }${minutes === null ? '' : ` (${formatElapsed(minutes, t)})`}`}
            className={cn(
              'flex h-6 shrink-0 items-center gap-1 rounded-inshop-sm bg-surface-secondary px-1.5',
              // 정상 센서는 테두리를 얻지 않는다 — 이상한 것만 눈에 걸리게
              failing && 'ring-1 ring-inset',
              failing && config.ring,
            )}
          >
            {pointColor && (
              <span
                aria-hidden="true"
                className={cn('h-2 w-2 shrink-0 rounded-inshop-xs', config.dim && 'opacity-50')}
                style={{ backgroundColor: pointColor }}
              />
            )}
            <span className="font-mono text-2xs text-foreground/50">{index + 1}</span>
            <span
              className={cn(
                'font-mono text-inshop-xs tabular-nums',
                failing ? 'text-foreground/54' : 'text-foreground/85',
              )}
            >
              {sensor.lastScanAt}
            </span>
            {failing ? (
              // 이상 센서는 경과 대신 상태를 말한다 — 그게 지금 알아야 할 사실이다
              <span
                className={cn(
                  'whitespace-nowrap text-2xs font-medium',
                  sensor.status === 'error' ? 'text-status-unhealthy' : 'text-foreground/68',
                )}
              >
                {statusLabel}
              </span>
            ) : (
              <span className={cn('whitespace-nowrap text-2xs', freshnessClass(minutes))}>
                {minutes === null ? t('common.none') : formatElapsedShort(minutes, t)}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
