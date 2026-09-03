import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { TFunction } from 'i18next'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { LidarSensorStatus } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { cn } from '../../../shared/lib/utils'
import { useClock } from '../../../shared/lib/useClock'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import {
  FRESHNESS_THRESHOLDS,
  heartbeatElapsedMinutes,
} from '../../../shared/features/bay-viewer/lib/freshness'
import type { TiltModuleStatus } from '../../../shared/entities/equipment'
import {
  OUTFITTING_DEVICE_META,
  type OutfittingDevice,
  type OutfittingDeviceKind,
} from '../model/equipment'
import { isDeviceFailing, tiltDetailOf } from '../lib/equipmentStatus'

/*
 * 의장 설비 상태 목록 — 조립 센서 목록과 **같은 문법**이다: 바깥에만 판을 두르고
 * 안쪽은 같은 결의 칸으로 나누며, 이상이 있는 한 대만 테두리를 얻는다(눈이 갈 곳은
 * 거기 하나면 된다). 헤더의 `n/n` 칩도 조립과 같은 자리·같은 뜻이다.
 *
 * 조립 컴포넌트를 그대로 부르지 않는 이유는 두 가지다. 공정 모듈끼리 직접 import 하지
 * 않는 것이 이 레포의 규칙이고(공통이 필요하면 shared 경유 — 신선도 계산은 그렇게
 * 옮겼다), 의장이 세는 단위가 라이다 한 종류가 아니라 **설비 네 종류**라 줄마다 종류가
 * 먼저 보여야 한다. 조립 목록의 라이다 진단값(scan rate·온도·RSSI) 자리는 의장에서는
 * 아직 받는 값이 없어 지어내지 않는다.
 */

const STATUS_LABEL_KEY: Record<LidarSensorStatus, InshopKey> = {
  online: 'outfitting.sensorStatus.online',
  offline: 'outfitting.sensorStatus.offline',
  error: 'outfitting.sensorStatus.error',
  calibrating: 'outfitting.equipment.status.calibrating',
}

const STATUS_INK: Record<LidarSensorStatus, string> = {
  online: 'text-status-healthy',
  calibrating: 'text-sky-600',
  offline: 'text-foreground/54',
  error: 'text-status-unhealthy',
}

const STATUS_RING: Record<LidarSensorStatus, string> = {
  online: 'ring-border',
  calibrating: 'ring-sky-500/60',
  offline: 'ring-foreground/25',
  error: 'ring-status-unhealthy/60',
}

function DeviceStatusIcon({ status, className }: { status: LidarSensorStatus; className?: string }) {
  if (status === 'online') {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
        <path d="m4 8 2.4 2.4L12 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (status === 'calibrating') {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className={cn(className, 'animate-spin motion-reduce:animate-none')}>
        <path d="M13 8a5 5 0 1 1-1.5-3.55M11.5 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (status === 'offline') {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
        <path d="M5.5 5.5 3 8l2.5 2.5M10.5 5.5 13 8l-2.5 2.5M2.5 2.5l11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <path d="M8 2.2 14 13H2L8 2.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 5.8v3.5M8 11.4h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 종류 칩 — 종류색 점 + 짧은 이름. 색만으로 말하지 않게 이름을 함께 낸다 */
function KindChip({ kind }: { kind: OutfittingDeviceKind }) {
  const { t } = useTranslation()
  const meta = OUTFITTING_DEVICE_META[kind]
  return (
    <span className="flex shrink-0 items-center gap-1 rounded border border-border bg-surface-secondary px-1.5 py-px text-[9px] font-medium leading-none text-foreground/68">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {t(meta.labelKey)}
    </span>
  )
}

/**
 * 신선도 등급 — 임계값은 shared/features/bay-viewer/lib/freshness 가 소유한다.
 * 색은 보조 신호일 뿐이다 (경과 시간 글자가 이미 같은 사실을 말한다).
 */
function freshnessClass(minutes: number | null): string {
  if (minutes === null) return 'text-foreground/54'
  if (minutes >= FRESHNESS_THRESHOLDS.deadMinutes) return 'text-status-unhealthy'
  if (minutes >= FRESHNESS_THRESHOLDS.staleMinutes) return 'text-status-degraded'
  return 'text-foreground/58'
}

/** 경과를 칩 안에 넣을 짧은 형태로 */
function formatElapsedShort(minutes: number, t: TFunction): string {
  if (minutes < 1) return t('outfitting.equipment.elapsed.justNow')
  if (minutes < 60) return t('outfitting.equipment.elapsed.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('outfitting.equipment.elapsed.hours', { count: hours })
  return t('outfitting.equipment.elapsed.days', { count: Math.floor(hours / 24) })
}

const TILT_MODE_INK: Record<TiltModuleStatus['mode'], string> = {
  idle: 'text-foreground/58',
  tilting: 'text-sky-600',
  error: 'text-status-unhealthy',
}

/**
 * 틸팅 한 대의 상세 — 모드 · 현재/목표 각 · 페어 라이다 · 모터 알람 · 마지막 동작.
 *
 * 하트비트만 보여서는 "이 틸팅이 지금 어디를 보고 있는가"를 알 수 없다. 틸팅은 페어
 * 라이다의 시야를 움직이는 장치라, **목표에 못 갔다는 사실이 곧 그 라이다의 시야가
 * 어긋나 있다는 뜻**이다 — 그래서 목표 도달 여부를 각도와 나란히 낸다.
 *
 * 통신 상태는 여기서 다시 말하지 않는다 — 줄 오른쪽 배지가 이미 같은 축을 말하고 있고
 * 둘이 같은 출처(`equipmentLinkOf`)에서 나온다.
 */
function TiltDetail({ tilt }: { tilt: TiltModuleStatus }) {
  const { t } = useTranslation()
  const off = !tilt.atTarget
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pb-0.5 pl-5 text-2xs text-foreground/52">
      <div className="flex gap-1">
        <dt>{t('outfitting.equipment.tilt.mode')}</dt>
        <dd className={cn('font-medium', TILT_MODE_INK[tilt.mode])}>
          {t(`outfitting.equipment.tilt.modeValue.${tilt.mode}`)}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>{t('outfitting.equipment.tilt.angle')}</dt>
        <dd className={cn('font-mono tabular-nums', off && 'text-status-degraded')}>
          {tilt.panDeg}° / {tilt.tiltDeg}°
        </dd>
      </div>
      {off && (
        <div className="flex gap-1">
          <dt>{t('outfitting.equipment.tilt.target')}</dt>
          <dd className="font-mono tabular-nums text-status-degraded">
            {tilt.targetPanDeg}° / {tilt.targetTiltDeg}°
          </dd>
        </div>
      )}
      <div className="flex gap-1">
        <dt>{t('outfitting.equipment.tilt.pair')}</dt>
        <dd className="font-mono">{tilt.pairedLidarId ?? '-'}</dd>
      </div>
      {tilt.motorAlarm > 0 && (
        <div className="flex gap-1 text-status-unhealthy">
          <dt>{t('outfitting.equipment.tilt.alarm')}</dt>
          <dd className="font-mono tabular-nums">{tilt.motorAlarm}</dd>
        </div>
      )}
    </dl>
  )
}

interface OutfittingDeviceStatusListProps {
  devices: readonly OutfittingDevice[]
  /** 목록 위 제목 — 베이 드릴다운에서는 베이 이름이 온다 */
  title: string
  className?: string
}

export function OutfittingDeviceStatusList({
  devices,
  title,
  className,
}: OutfittingDeviceStatusListProps) {
  const { t } = useTranslation()
  // heartbeat 경과 표기가 굳지 않도록 30초마다 다시 계산한다 (조립 목록과 같은 주기)
  const now = useClock(30000)
  /* 틸팅 각·모드는 시계가 아니라 **구독**에서 온다. 목록은 늘 한 공장 안에서 만들어지므로
     (맵 진입의 공장 패널·베이 드릴다운·설비 현황 화면) 첫 줄의 공장을 그대로 쓴다 —
     공장이 섞인 목록을 넘기면 다른 공장의 틸팅 상세는 비게 된다. */
  const { snapshot } = useFactoryEquipmentStatus(devices[0]?.factory ?? '')

  if (devices.length === 0) {
    return (
      <p className={cn('rounded-inshop-lg border border-border bg-surface p-3 text-inshop-sm text-foreground/68', className)}>
        {t('outfitting.equipment.empty')}
      </p>
    )
  }

  const online = devices.filter((device) => device.status === 'online').length
  const allOnline = online === devices.length

  return (
    <section
      className={cn('overflow-hidden rounded-inshop-lg border border-border bg-surface', className)}
      aria-label={title}
    >
      <header className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
        <h3 className="min-w-0 shrink truncate text-inshop-xs font-semibold text-foreground">{title}</h3>
        <span className="shrink-0 text-2xs text-foreground/48">{devices.length}</span>
        {/* 자리표시 표기는 목록 머리에 한 번만 — 줄마다 반복하면 읽을 것이 아니라 배경이 된다 */}
        {devices.every((device) => device.placeholder) && (
          <span className="shrink-0 rounded border border-border px-1.5 py-px text-[9px] leading-none text-foreground/45">
            {t('outfitting.equipment.placeholderShort')}
          </span>
        )}
        <StatusChip
          tone={allOnline ? 'good' : 'warning'}
          label={`${online}/${devices.length}`}
          title={t('outfitting.equipment.onlineOf', { online, total: devices.length })}
          className="ml-auto px-1.5 py-0.5 text-2xs"
        />
      </header>
      <ul className="divide-y divide-border/50 px-1.5 py-1">
        {devices.map((device) => {
          const minutes = heartbeatElapsedMinutes(device.lastHeartbeatAt, now)
          const tilt = tiltDetailOf(device, snapshot)
          /* 통신이 끊긴 것뿐 아니라 **틸팅 에러 모드**도 이상 테두리를 얻는다 —
           * 통신은 살아 있는데 모터가 멈춘 틸팅은 조용히 지나가면 안 되는 상태다 */
          const failing = isDeviceFailing(device, tilt)
          const ring = tilt?.mode === 'error' ? STATUS_RING.error : STATUS_RING[device.status]
          return (
            <li
              key={device.id}
              className={cn('rounded px-1.5 py-1', failing && 'ring-1 ring-inset', failing && ring)}
            >
              <div className="flex min-h-6 items-center gap-1.5">
                <DeviceStatusIcon status={device.status} className={cn('h-3.5 w-3.5 shrink-0', STATUS_INK[device.status])} />
                <span className="min-w-0 flex-1 truncate font-mono text-2xs font-semibold text-foreground/85">
                  {device.id}
                </span>
                <KindChip kind={device.kind} />
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-secondary px-1.5 py-0.5 font-mono text-[9px] leading-none tabular-nums',
                    freshnessClass(minutes)
                  )}
                  title={t('outfitting.equipment.heartbeatAt', { time: device.lastHeartbeatAt })}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-2.5 w-2.5">
                    <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 4.7V8l2.3 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {minutes === null ? '-' : formatElapsedShort(minutes, t)}
                </span>
                <span className={cn('w-11 shrink-0 text-right text-2xs font-medium', STATUS_INK[device.status])}>
                  {t(STATUS_LABEL_KEY[device.status])}
                </span>
              </div>
              <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pb-0.5 pl-5 text-2xs text-foreground/52">
                <div className="flex gap-1">
                  <dt>Heartbeat</dt>
                  <dd className="font-mono tabular-nums">{device.lastHeartbeatAt}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>{t('outfitting.equipment.lastScan')}</dt>
                  <dd className="font-mono tabular-nums">{device.lastScanAt ?? '-'}</dd>
                </div>
              </dl>
              {/* 틸팅은 한 줄 더 — 접지 않고 그대로 낸다. 한 번 더 눌러야 보이는 값은
                  결국 아무도 보지 않는데, 여기서 제일 중요한 것이 "목표에 갔는가"다 */}
              {tilt && <TiltDetail tilt={tilt} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
