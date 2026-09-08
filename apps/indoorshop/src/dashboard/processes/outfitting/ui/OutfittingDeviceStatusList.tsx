import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { TFunction } from 'i18next'
import { cn } from '../../../shared/lib/utils'
import { useAxisNow } from '../../../shared/lib/useBaseDate'
import { StatusChip } from '../../../shared/ui/atoms/StatusChip'
import { heartbeatElapsedMinutes } from '../../../shared/features/bay-viewer/lib/freshness'
import { EquipmentGrid } from '../../../shared/features/equipment-grid'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import type { TiltModuleStatus } from '../../../shared/entities/equipment'
import { OUTFITTING_DEVICE_META, type OutfittingDevice } from '../model/equipment'
import { tiltDetailOf } from '../lib/equipmentStatus'
import { outfittingCells } from '../lib/equipmentCells'

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
  /* 상위 `dl` 안에 들어가므로 여기서는 `dl` 을 다시 열지 않는다 */
  return (
    <>
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
    </>
  )
}

interface OutfittingDeviceStatusListProps {
  devices: readonly OutfittingDevice[]
  /** 목록 위 제목 — 베이 드릴다운에서는 베이 이름이 온다 */
  title: string
  className?: string
}

/**
 * 의장 설비 목록 — 머리(요약 스트립)는 그대로, **본문은 압축 그리드**다.
 *
 * 세로 목록이던 본문을 조립과 같은 셀 문법으로 바꿨다(R13 · 레퍼런스 §3.5 하이브리드).
 * 머리의 `n/n` 칩과 목록 제목은 접힘 상태에서 훑는 자리라 유지하고, 안쪽만 갈았다 —
 * 셀은 [종류칩+ID / 램프 3 / 신선도] 셋뿐이고 나머지는 셀을 골랐을 때 편다.
 */
export function OutfittingDeviceStatusList({
  devices,
  title,
  className,
}: OutfittingDeviceStatusListProps) {
  const { t } = useTranslation()
  // 경과 표기가 굳지 않도록 30초마다 — 기준일을 되감으면 그날의 시계를 따른다(useAxisNow)
  const now = useAxisNow(30000)
  /* 틸팅 상세는 상태 스냅샷(구독)에서 온다 — 목록이 mock 을 다시 부르면 두 값이 갈린다.
     이 목록의 설비는 한 공장에 속하므로 첫 줄의 공장을 구독한다(빈 목록이면 구독도 빔). */
  const { snapshot } = useFactoryEquipmentStatus(devices[0]?.factory ?? '')

  if (devices.length === 0) {
    return (
      <p className={cn('rounded-inshop-lg border border-border bg-surface p-3 text-inshop-sm text-foreground/68', className)}>
        {t('outfitting.equipment.empty')}
      </p>
    )
  }

  const cells = outfittingCells(devices, {
    freshTextOf: (device) => {
      const minutes = heartbeatElapsedMinutes(device.lastHeartbeatAt, now)
      return minutes === null ? '-' : formatElapsedShort(minutes, t)
    },
    tiltOf: (device) => tiltDetailOf(device, snapshot),
    detailOf: (device, tilt) => <DeviceDetail device={device} tilt={tilt} />,
  })

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
      <div className="p-1.5">
        <EquipmentGrid cells={cells} showControls={false} />
      </div>
    </section>
  )
}

/** 펼침 상세 — 셀을 골랐을 때만. 예전 줄마다의 `dt/dd` 가 이 자리로 왔다 */
function DeviceDetail({
  device,
  tilt,
}: {
  device: OutfittingDevice
  tilt: TiltModuleStatus | null
}) {
  const { t } = useTranslation()
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-foreground/55">
      <div className="flex gap-1">
        <dt>{t('outfitting.equipment.kindLabel')}</dt>
        <dd className="font-medium">{t(OUTFITTING_DEVICE_META[device.kind].labelKey)}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Heartbeat</dt>
        <dd className="font-mono tabular-nums">{device.lastHeartbeatAt}</dd>
      </div>
      <div className="flex gap-1">
        <dt>{t('outfitting.equipment.lastScan')}</dt>
        <dd className="font-mono tabular-nums">{device.lastScanAt ?? '-'}</dd>
      </div>
      {device.bay && device.bay !== '-' && (
        <div className="flex gap-1">
          <dt>{t('outfitting.equipment.bayLabel')}</dt>
          <dd className="font-mono">{device.bay}</dd>
        </div>
      )}
      {tilt && <TiltDetail tilt={tilt} />}
    </dl>
  )
}
