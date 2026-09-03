import { useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { equipmentTypeOf } from '../../../shared/entities/equipment'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import {
  LAYOUT_DRAWING_REVISION,
  layoutDrawingOf,
} from '../../../shared/entities/equipment/layoutDrawings'
import { DrawingViewerModal } from '../../../shared/features/drawing-viewer'
import { PanelSection } from '../../../shared/features/process-map-entry'
import { LidarSensorStatusList } from './LidarSensorStatusList'
import {
  EquipmentSymbolChip,
  colorOfType,
} from '../../../shared/entities/equipment/ui/EquipmentSymbol'
import { cn } from '../../../shared/lib/utils'
import {
  ASSEMBLY_EQUIPMENT_TYPES,
  edgePcsOf,
  equipmentCountsOf,
  equipmentSectionsOf,
  lidarsByBay,
  networkPanelsOf,
  panelsWithStatus,
  tiltModeCounts,
  tiltsOf,
  toLidarSensor,
  type EdgePcWithStatus,
  type PanelWithStatus,
  type TiltWithStatus,
} from '../lib/mapEntry'

/*
 * 설비 상태 단 — 공장 하나의 **설비 전부**를 한 목록 체계로.
 *
 * 예전에는 라이다만 세우는 '센서 상태'와 나머지를 세우는 '설비'가 다른 단이었다. 라이다도
 * 설비다 — 같은 공장의 장비를 두 군데서 따로 세면 "이 공장에 뭐가 몇 대 있고 지금 몇 대가
 * 이상인가"를 한 번에 볼 수 없다(W6-5). 그래서 한 단으로 합치고, **종류는 구획으로** 가른다.
 *
 * 구획 순서는 의장 화면과 같다 — 관측(라이다 → 틸팅) 먼저, 그 뒤 수집·네트워크(Edge PC →
 * 캐비닛). 두 공정이 같은 순서로 읽히면 화면을 옮겨 다닐 때 눈이 다시 적응하지 않아도 된다.
 *
 * 화면의 판단:
 *  · **정지 판넬은 맨 위**에서 먼저 말한다. 판이 죽으면 아래가 통째로 눈이 머는 구조라,
 *    "라이다 몇 대가 이상"보다 "어느 판넬이 죽었나"가 먼저 읽혀야 한다. 캐비닛 줄에는
 *    영향 범위(라이다 페어 수)를 늘 붙인다.
 *  · **라이다는 베이별로** 센다(기존 문법 유지 — 정반 단위로 보는 눈이 이미 그렇게 굳었다).
 *    나머지 종류는 공장 단위로 한 목록이다.
 *  · **틸팅은 접어 둔다.** 라이다와 1:1 이라 펼치면 목록이 두 배가 된다 — 대신 접힌 줄이
 *    틸팅중·에러 대수를 말하고, 펼치면 한 대씩 모드·각도·페어가 보인다.
 *
 * ⚠️ 대수·소속·페어는 실데이터(도면 유도), **상태는 mock** 이다.
 */

function TypeCountRow({ counts }: { counts: Record<string, number> }) {
  const present = ASSEMBLY_EQUIPMENT_TYPES.filter((id) => (counts[id] ?? 0) > 0)
  if (present.length === 0) return null
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 py-1">
      {present.map((typeId) => (
        <li key={typeId} className="flex items-center gap-1.5">
          <EquipmentSymbolChip typeId={typeId} size={15} />
          <span className="text-2xs text-white/55">{equipmentTypeOf(typeId)?.name ?? typeId}</span>
          <span className="font-mono text-2xs tabular-nums text-white/85">{counts[typeId]}</span>
        </li>
      ))}
    </ul>
  )
}

const PANEL_HEALTH_INK = {
  healthy: 'text-status-healthy',
  degraded: 'text-status-degraded',
  down: 'text-status-unhealthy',
} as const

/** 캐비닛 한 줄 — 판정 · 전원/업링크 · 영향 범위 */
function PanelRow({ entry }: { entry: PanelWithStatus }) {
  const { t } = useTranslation()
  const { panel, status } = entry
  const down = status.health === 'down'
  return (
    <li
      className={cn(
        'rounded-inshop-md px-2 py-1.5',
        down ? 'bg-status-unhealthy/10 ring-1 ring-inset ring-status-unhealthy/40' : 'hover:bg-white/[0.045]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <EquipmentSymbolChip typeId={panel.typeId} size={16} dim={down} />
        <span className="min-w-0 flex-1 truncate font-mono text-2xs font-semibold text-white/88">
          {panel.id}
        </span>
        <span className={cn('shrink-0 text-2xs font-medium', PANEL_HEALTH_INK[status.health])}>
          {t(`assembly.equipment.panelHealth.${status.health}`)}
        </span>
      </div>
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[22px] pt-0.5 text-2xs text-white/50">
        <div className="flex gap-1">
          <dt>{t('assembly.equipment.power')}</dt>
          <dd className={cn('font-mono', !status.powered && 'text-status-unhealthy')}>
            {t(status.powered ? 'assembly.equipment.powerOn' : 'assembly.equipment.powerOff')}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('assembly.equipment.uplink')}</dt>
          <dd className={cn('font-mono', status.uplink !== 'online' && 'text-status-degraded')}>
            {t(`assembly.equipment.link.${status.uplink}`)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('assembly.equipment.members')}</dt>
          <dd className="font-mono tabular-nums">
            {status.memberOnline}/{status.memberTotal}
          </dd>
        </div>
        {status.lidarPairs > 0 && (
          <div className="flex gap-1">
            <dt>{t('assembly.equipment.impact')}</dt>
            <dd className={cn('font-mono tabular-nums', down && 'text-status-unhealthy')}>
              {t('assembly.equipment.pairCount', { count: status.lidarPairs })}
            </dd>
          </div>
        )}
        {panel.memberBays.length > 0 && (
          <div className="flex gap-1">
            <dt>{t('assembly.equipment.coversBays')}</dt>
            <dd className="font-mono">{panel.memberBays.join(', ')}</dd>
          </div>
        )}
      </dl>
    </li>
  )
}

/** Edge PC 한 줄 — 살아 있나(하트비트·MQTT) 와 왜 못 보내나(자원·컨테이너) */
function EdgePcRow({ entry }: { entry: EdgePcWithStatus }) {
  const { t } = useTranslation()
  const { equipment, status } = entry
  const failing = status.link !== 'online'
  return (
    <li
      className={cn(
        'rounded-inshop-md px-2 py-1.5',
        failing ? 'bg-status-unhealthy/8 ring-1 ring-inset ring-status-unhealthy/35' : 'hover:bg-white/[0.045]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <EquipmentSymbolChip typeId="EDGE" size={16} dim={failing} />
        <span className="min-w-0 flex-1 truncate font-mono text-2xs font-semibold text-white/88">
          {equipment.id}
        </span>
        <span
          className={cn(
            'shrink-0 text-2xs font-medium',
            failing ? 'text-status-unhealthy' : 'text-status-healthy'
          )}
        >
          {t(`assembly.equipment.link.${status.link}`)}
        </span>
      </div>
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[22px] pt-0.5 text-2xs text-white/50">
        <div className="flex gap-1">
          <dt>CPU</dt>
          <dd className="font-mono tabular-nums">{status.cpuPercent}%</dd>
        </div>
        <div className="flex gap-1">
          <dt>MEM</dt>
          <dd className="font-mono tabular-nums">{status.memoryPercent}%</dd>
        </div>
        <div className="flex gap-1">
          <dt>DISK</dt>
          <dd className={cn('font-mono tabular-nums', status.diskPercent > 85 && 'text-status-degraded')}>
            {status.diskPercent}%
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('assembly.equipment.temp')}</dt>
          <dd className="font-mono tabular-nums">{status.temperatureC}°C</dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('assembly.equipment.collector')}</dt>
          <dd
            className={cn('font-mono', status.collector !== 'running' && 'text-status-unhealthy')}
          >
            {t(`assembly.equipment.collectorState.${status.collector}`)}
            {status.collectorRestarts > 0 && (
              <span className="ml-1 text-status-degraded">
                ↻{status.collectorRestarts}
              </span>
            )}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>MQTT</dt>
          <dd className={cn('font-mono', !status.mqttConnected && 'text-status-unhealthy')}>
            {t(status.mqttConnected ? 'assembly.equipment.connected' : 'assembly.equipment.disconnected')}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>NTP</dt>
          <dd className={cn('font-mono tabular-nums', Math.abs(status.ntpOffsetMs) > 200 && 'text-status-degraded')}>
            {status.ntpOffsetMs > 0 ? '+' : ''}
            {status.ntpOffsetMs}ms
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>SW</dt>
          <dd className="font-mono">v{status.swVersion}</dd>
        </div>
      </dl>
    </li>
  )
}

const TILT_MODE_INK = {
  idle: 'text-white/58',
  tilting: 'text-sky-300',
  error: 'text-status-unhealthy',
} as const

/**
 * 틸팅 한 줄 — 모드 · 현재/목표 각 · 페어 라이다 · 모터 알람.
 *
 * 요약("337대가 라이다와 1:1")만으로는 **목표에 못 간 틸팅**이 드러나지 않는다. 틸팅이
 * 목표 각에 못 가면 그 페어 라이다는 엉뚱한 곳을 보므로, 도달 여부와 각을 나란히 낸다.
 * 통신은 왼쪽 상태 낱말이 말한다(캐비닛·Edge PC 줄과 같은 축·같은 출처).
 */
function TiltRow({ entry }: { entry: TiltWithStatus }) {
  const { t } = useTranslation()
  const { equipment, status } = entry
  /* 통신이 끊긴 것뿐 아니라 **에러 모드**도 이상 테두리를 얻는다 — 통신은 살아 있는데
     모터가 멈춘 틸팅은 조용히 지나가면 안 되는 상태다 */
  const failing = status.link !== 'online' || status.mode === 'error'
  const off = !status.atTarget
  return (
    <li
      className={cn(
        'rounded-inshop-md px-2 py-1.5',
        failing ? 'bg-status-unhealthy/8 ring-1 ring-inset ring-status-unhealthy/35' : 'hover:bg-white/[0.045]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <EquipmentSymbolChip typeId="TILT" size={16} dim={status.link !== 'online'} />
        <span className="min-w-0 flex-1 truncate font-mono text-2xs font-semibold text-white/88">
          {equipment.id}
        </span>
        <span className={cn('shrink-0 text-2xs font-medium', TILT_MODE_INK[status.mode])}>
          {t(`assembly.equipment.tiltMode.${status.mode}`)}
        </span>
        <span
          className={cn(
            'shrink-0 text-2xs font-medium',
            status.link === 'online' ? 'text-status-healthy' : 'text-status-unhealthy'
          )}
        >
          {t(`assembly.equipment.link.${status.link}`)}
        </span>
      </div>
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[22px] pt-0.5 text-2xs text-white/50">
        <div className="flex gap-1">
          <dt>pan/tilt</dt>
          <dd className={cn('font-mono tabular-nums', off && 'text-status-degraded')}>
            {status.panDeg}° / {status.tiltDeg}°
          </dd>
        </div>
        {off && (
          <div className="flex gap-1">
            <dt>{t('assembly.equipment.tiltTarget')}</dt>
            <dd className="font-mono tabular-nums text-status-degraded">
              {status.targetPanDeg}° / {status.targetTiltDeg}°
            </dd>
          </div>
        )}
        <div className="flex gap-1">
          {/* 틸팅 줄에서 '페어'는 그 틸팅이 겨누는 **라이다**다 — 라이다 마커 상세의
              '페어 틸팅'과 방향이 반대라 낱말도 따로 둔다 */}
          <dt>{t('assembly.equipment.pairLidar')}</dt>
          <dd className="font-mono">{status.pairedLidarId ?? '-'}</dd>
        </div>
        {status.motorAlarm > 0 && (
          <div className="flex gap-1 text-status-unhealthy">
            <dt>{t('assembly.equipment.motorAlarm')}</dt>
            <dd className="font-mono tabular-nums">{status.motorAlarm}</dd>
          </div>
        )}
      </dl>
    </li>
  )
}

/**
 * 공장 하나의 설비 인벤토리 + 상태.
 *
 * 상태는 **구독**한다(`useFactoryEquipmentStatus`) — 예전에는 화면이 시계(`now`)를 들고
 * 목업을 동기로 불렀지만, 그 형태로는 실연동이 오는 순간 이 컴포넌트가 통째로 바뀐다.
 * 지금은 스냅샷이 흘러 들어오고, 아직 안 온 설비는 목록에 서지 않는다(지어내지 않는다).
 */
export function EquipmentInventoryPanel({ factory }: { factory: string }) {
  const { t } = useTranslation()
  const { snapshot } = useFactoryEquipmentStatus(factory)
  const [drawingOpen, setDrawingOpen] = useState(false)
  /* 도면은 공장마다 한 장 — 도장 공장처럼 도면집에 없는 곳은 버튼 자체를 세우지 않는다 */
  const drawing = layoutDrawingOf(factory)
  const counts = equipmentCountsOf(factory)
  /* 구획 순서·베이 묶음·접힘 규칙은 lib 이 정한다 — 의장과 같은 규칙임을 테스트가 지킨다 */
  const sections = equipmentSectionsOf(factory)
  const lidarGroups = sections.find((s) => s.typeId === 'LIDAR')?.groups ?? []
  const lidarBays = lidarsByBay(factory)
  const tilts = tiltsOf(factory, snapshot)
  const tiltModes = tiltModeCounts(tilts)
  const edges = edgePcsOf(factory, snapshot)
  /* 캐비닛 구획은 Network Panel 만 — Edge PC 는 제 구획을 따로 갖는다(겹쳐 세지 않는다).
     다만 '정지 판넬' 경고는 Edge PC 까지 본다: 그 판이 죽어도 아래는 똑같이 눈이 먼다 */
  const panels = networkPanelsOf(factory, snapshot)
  const allCabinets = panelsWithStatus(factory, snapshot)
  const lidarCount = counts.LIDAR ?? 0

  if (sections.length === 0) {
    return <p className="px-3 py-3 text-2xs text-white/45">{t('assembly.equipment.empty')}</p>
  }

  const downPanels = allCabinets.filter((p) => p.status.health === 'down')

  return (
    <div className="flex flex-col gap-2.5 px-2 py-2">
      {/* 종류별 대수 — 아래 구획들의 목차이기도 하다 */}
      <TypeCountRow counts={counts} />

      {drawing && (
        <>
          <button
            type="button"
            onClick={() => setDrawingOpen(true)}
            title={t('drawing.openHint', { factory: drawing.title })}
            className="flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
          >
            <span className="flex items-center gap-1.5">
              <svg aria-hidden="true" viewBox="0 0 12 12" width={11} height={11}>
                <path d="M1.6 2.2h8.8v7.6H1.6z" fill="none" stroke="currentColor" strokeWidth="1.1" />
                <path d="M1.6 4.4h8.8M4.2 4.4v5.4" fill="none" stroke="currentColor" strokeWidth="0.9" />
              </svg>
              {t('drawing.open')}
            </span>
            <span className="font-mono text-white/40">{drawing.drawingNo}</span>
          </button>
          {drawingOpen && (
            <DrawingViewerModal
              src={drawing.src}
              title={drawing.title}
              subtitle={`${drawing.drawingNo} · ${LAYOUT_DRAWING_REVISION} · p.${drawing.page}`}
              width={drawing.width}
              height={drawing.height}
              onClose={() => setDrawingOpen(false)}
            />
          )}
        </>
      )}

      {/* 판이 죽으면 아래가 통째로 눈이 먼다 — 종류 구획보다 먼저 말한다 */}
      {downPanels.length > 0 && (
        <p
          className="rounded-inshop-md px-2 py-1.5 text-2xs leading-relaxed text-status-unhealthy"
          style={{ boxShadow: `inset 0 0 0 1px ${colorOfType('PNL')}55` }}
        >
          {t('assembly.equipment.downWarning', {
            count: downPanels.length,
            pairs: downPanels.reduce((sum, p) => sum + p.status.lidarPairs, 0),
          })}
        </p>
      )}

      {/* ── 관측: 라이다(베이별) → 틸팅(접힘) ── */}
      {lidarGroups.length > 0 && (
        <PanelSection title={t('assembly.equipment.lidarHeading')} count={lidarCount}>
          <div className="flex flex-col gap-2">
            {lidarGroups.map((group) => {
              const list = lidarBays.get(group.bay) ?? []
              return (
                <div key={group.bay}>
                  <p className="mb-1 px-1 text-2xs font-medium text-white/45">
                    {t('assembly.mapEntry.bayHeading', { bay: group.bay })}
                    <span className="ml-1.5 font-mono text-white/30">{group.ids.length}</span>
                  </p>
                  <LidarSensorStatusList sensors={list.map(toLidarSensor)} />
                </div>
              )
            })}
          </div>
        </PanelSection>
      )}

      {tilts.length > 0 && (
        <PanelSection
          title={t('assembly.equipment.tiltHeading')}
          count={tilts.length}
          collapsible
          defaultOpen={false}
          summary={
            <span className="flex items-center gap-2">
              {tiltModes.tilting > 0 && (
                <span className="text-sky-300">
                  {t('assembly.equipment.tiltMode.tilting')} {tiltModes.tilting}
                </span>
              )}
              {tiltModes.error > 0 && (
                <span className="text-status-unhealthy">
                  {t('assembly.equipment.tiltMode.error')} {tiltModes.error}
                </span>
              )}
              {tiltModes.tilting === 0 && tiltModes.error === 0 && (
                <span className="text-white/40">{t('assembly.equipment.tiltAllIdle')}</span>
              )}
            </span>
          }
          collapsedBody={
            <p className="px-1 pb-0.5 text-2xs leading-relaxed text-white/45">
              {t('assembly.equipment.tiltNote', { count: tilts.length, lidar: lidarCount })}
            </p>
          }
        >
          <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {tilts.map((entry) => (
              <TiltRow key={entry.equipment.id} entry={entry} />
            ))}
          </ul>
        </PanelSection>
      )}

      {/* ── 수집·네트워크: Edge PC → 캐비닛 ── */}
      {edges.length > 0 && (
        <PanelSection title={t('assembly.equipment.edgeHeading')} count={edges.length}>
          <ul className="flex flex-col gap-0.5">
            {edges.map((entry) => (
              <EdgePcRow key={entry.equipment.id} entry={entry} />
            ))}
          </ul>
        </PanelSection>
      )}

      {panels.length > 0 && (
        <PanelSection title={t('assembly.equipment.panelsHeading')} count={panels.length}>
          <ul className="flex flex-col gap-0.5">
            {panels.map((entry) => (
              <PanelRow key={entry.panel.id} entry={entry} />
            ))}
          </ul>
        </PanelSection>
      )}
    </div>
  )
}
