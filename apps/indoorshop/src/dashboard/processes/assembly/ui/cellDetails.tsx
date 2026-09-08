import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import type {
  EdgePcStatus,
  EquipmentPanel,
  EquipmentPanelStatus,
  TiltModuleStatus,
} from '../../../shared/entities/equipment'

/*
 * ── 펼침 상세 — 셀을 골랐을 때만 서는 값들 ──
 *
 * 압축 셀에는 두 줄만 둔다(종류칩+ID+신선도 / 활력 그림+부기). 자원 지표·전원·NTP 같은
 * 값은 "한 대를 열었을 때의 질문" 이라 이리로 내린다(레퍼런스 §3.2).
 *
 * 지도 진입 패널(`EquipmentInventoryPanel`)에만 있던 것을 이 파일로 꺼냈다 — 현황 보드의
 * 셀도 눌리는데 눌러도 아무 일이 없었다. 같은 설비를 두 화면에서 열었을 때 다른 값이
 * 보이면(혹은 한쪽에서만 보이면) 어느 쪽을 믿을지 알 수 없다.
 */

const PANEL_HEALTH_INK = {
  healthy: 'text-status-healthy',
  degraded: 'text-status-degraded',
  down: 'text-status-unhealthy',
} as const

/*
 * ── 펼침 상세 — 셀을 골랐을 때만 서는 값들 ──
 *
 * 압축 셀에는 세 요소만 둔다(종류칩+ID / 램프 3 / 신선도). 자원 지표·각도·전원 같은 값은
 * "한 대를 열었을 때의 질문" 이라 여기로 내린다(레퍼런스 §3.2). 예전 세로 목록이 줄마다
 * 늘어놓던 `dt/dd` 가 그대로 이 자리로 옮겨 왔다 — 정보를 버린 것이 아니라 **자리를 옮겼다**.
 */

export function DetailRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex gap-1">
      <dt className="text-white/45">{label}</dt>
      <dd className={cn('font-mono tabular-nums', tone ?? 'text-white/72')}>{value}</dd>
    </div>
  )
}

/** 자원 미니바 — 숫자만으로는 85% 가 얼마나 높은지 눈에 안 들어온다 */
function ResourceBar({ label, percent }: { label: string; percent: number }) {
  const hot = percent > 85
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-white/45">{label}</span>
      <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/12">
        <span
          className={cn('block h-full rounded-full', hot ? 'bg-status-unhealthy' : 'bg-white/45')}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </span>
      <span className={cn('w-9 shrink-0 text-right font-mono tabular-nums', hot ? 'text-status-unhealthy' : 'text-white/62')}>
        {percent}%
      </span>
    </div>
  )
}

export function EdgeDetail({ status }: { status: EdgePcStatus }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1 text-[10px]">
      <ResourceBar label="CPU" percent={status.cpuPercent} />
      <ResourceBar label="MEM" percent={status.memoryPercent} />
      <ResourceBar label="DISK" percent={status.diskPercent} />
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5">
        <DetailRow label={t('assembly.equipment.temp')} value={`${status.temperatureC}°C`} />
        <DetailRow
          label={t('assembly.equipment.collector')}
          value={`${t(`assembly.equipment.collectorState.${status.collector}`)}${status.collectorRestarts > 0 ? ` ↻${status.collectorRestarts}` : ''}`}
          tone={status.collector === 'running' ? undefined : 'text-status-unhealthy'}
        />
        <DetailRow
          label="MQTT"
          value={t(status.mqttConnected ? 'assembly.equipment.connected' : 'assembly.equipment.disconnected')}
          tone={status.mqttConnected ? undefined : 'text-status-unhealthy'}
        />
        <DetailRow
          label="NTP"
          value={`${status.ntpOffsetMs > 0 ? '+' : ''}${status.ntpOffsetMs}ms`}
          tone={Math.abs(status.ntpOffsetMs) > 200 ? 'text-status-degraded' : undefined}
        />
        <DetailRow label="SW" value={`v${status.swVersion}`} />
      </dl>
    </div>
  )
}

export function TiltDetail({ tilt }: { tilt: TiltModuleStatus | null }) {
  const { t } = useTranslation()
  if (!tilt) return <p className="text-[10px] text-white/45">{t('assembly.equipment.noPair')}</p>
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
      <DetailRow
        label={t('assembly.equipment.tiltHeading')}
        value={t(`assembly.equipment.tiltMode.${tilt.mode}`)}
        tone={tilt.mode === 'error' ? 'text-status-unhealthy' : undefined}
      />
      <DetailRow label="pan/tilt" value={`${tilt.panDeg}° / ${tilt.tiltDeg}°`} />
      {!tilt.atTarget && (
        <DetailRow
          label={t('assembly.equipment.tiltTarget')}
          value={`${tilt.targetPanDeg}° / ${tilt.targetTiltDeg}°`}
          tone="text-status-degraded"
        />
      )}
      <DetailRow label={t('assembly.equipment.pairLidar')} value={tilt.pairedLidarId ?? '-'} />
      {tilt.motorAlarm > 0 && (
        <DetailRow
          label={t('assembly.equipment.motorAlarm')}
          value={String(tilt.motorAlarm)}
          tone="text-status-unhealthy"
        />
      )}
    </dl>
  )
}

export function PanelDetail({ entry }: { entry: { panel: EquipmentPanel; status: EquipmentPanelStatus } }) {
  const { t } = useTranslation()
  const { panel, status } = entry
  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
      <DetailRow
        label={t('assembly.equipment.panelHealthLabel')}
        value={t(`assembly.equipment.panelHealth.${status.health}`)}
        tone={PANEL_HEALTH_INK[status.health]}
      />
      <DetailRow
        label={t('assembly.equipment.power')}
        value={t(status.powered ? 'assembly.equipment.powerOn' : 'assembly.equipment.powerOff')}
        tone={status.powered ? undefined : 'text-status-unhealthy'}
      />
      <DetailRow
        label={t('assembly.equipment.uplink')}
        value={t(`assembly.equipment.link.${status.uplink}`)}
        tone={status.uplink === 'online' ? undefined : 'text-status-degraded'}
      />
      <DetailRow
        label={t('assembly.equipment.members')}
        value={`${status.memberOnline}/${status.memberTotal}`}
      />
      {panel.memberBays.length > 0 && (
        <DetailRow label={t('assembly.equipment.coversBays')} value={panel.memberBays.join(', ')} />
      )}
    </dl>
  )
}
