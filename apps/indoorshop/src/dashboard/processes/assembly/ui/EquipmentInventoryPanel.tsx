import { useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import {
  LAYOUT_DRAWING_REVISION,
  layoutDrawingOf,
} from '../../../shared/entities/equipment/layoutDrawings'
import { DrawingViewerModal } from '../../../shared/features/drawing-viewer'
import { PanelSection } from '../../../shared/features/process-map-entry'
import { EquipmentGrid } from '../../../shared/features/equipment-grid'
import type { EdgePcStatus, TiltModuleStatus } from '../../../shared/entities/equipment'
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
  mockScanTime,
  networkPanelsOf,
  panelsWithStatus,
  type PanelWithStatus,
} from '../lib/mapEntry'
import { edgePcCell, lidarPairCell, panelCell } from '../lib/equipmentCells'

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
 *  · **틸팅은 라이다와 한 칸이다**(R13 · 레퍼런스 §3.4). 1.7m 안에 한 자리로 서서 한 몫을
 *    하고, 두 칸으로 가르면 337 → 674칸이 된다. 페어의 상태는 셀의 둘째 램프가 말하고,
 *    대기가 아닐 때만 모드·각도가 셀 안에 한 줄 선다 — **클릭 없이** 보인다.
 *
 * 본문은 세로 목록이 아니라 **압축 그리드**다(하이브리드 — 레퍼런스 §3.5 권고).
 * 요약 스트립·구획은 그대로 두고 구획 **안쪽만** 그리드로 바꿨다.
 *
 * ⚠️ 대수·소속·페어는 실데이터(도면 유도), **상태는 mock** 이다.
 */

function TypeCountRow({ counts }: { counts: Record<string, number> }) {
  /* 화면 이름은 레지스트리(도면 이름)가 아니라 라벨 층에서 온다 — `typeLabel.ts` 참조 */
  const labelOf = useEquipmentTypeLabel()
  const present = ASSEMBLY_EQUIPMENT_TYPES.filter((id) => (counts[id] ?? 0) > 0)
  if (present.length === 0) return null
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 py-1">
      {present.map((typeId) => (
        <li key={typeId} className="flex items-center gap-1.5">
          <EquipmentSymbolChip typeId={typeId} size={15} />
          <span className="text-2xs text-white/55">{labelOf(typeId)}</span>
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

/*
 * ── 펼침 상세 — 셀을 골랐을 때만 서는 값들 ──
 *
 * 압축 셀에는 세 요소만 둔다(종류칩+ID / 램프 3 / 신선도). 자원 지표·각도·전원 같은 값은
 * "한 대를 열었을 때의 질문" 이라 여기로 내린다(레퍼런스 §3.2). 예전 세로 목록이 줄마다
 * 늘어놓던 `dt/dd` 가 그대로 이 자리로 옮겨 왔다 — 정보를 버린 것이 아니라 **자리를 옮겼다**.
 */

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
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

function EdgeDetail({ status }: { status: EdgePcStatus }) {
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

function TiltDetail({ tilt }: { tilt: TiltModuleStatus | null }) {
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

function PanelDetail({ entry }: { entry: PanelWithStatus }) {
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

export function EquipmentInventoryPanel({ factory }: { factory: string }) {
  const { t } = useTranslation()
  const [drawingOpen, setDrawingOpen] = useState(false)
  /* 상태는 구독한다 — 화면이 시계를 들지 않는다(설비 상태 스토어) */
  const { snapshot } = useFactoryEquipmentStatus(factory)
  const now = snapshot.at
  /* 도면은 공장마다 한 장 — 도장 공장처럼 도면집에 없는 곳은 버튼 자체를 세우지 않는다 */
  const drawing = layoutDrawingOf(factory)
  const counts = equipmentCountsOf(factory)
  /* 구획 순서·베이 묶음·접힘 규칙은 lib 이 정한다 — 의장과 같은 규칙임을 테스트가 지킨다 */
  const sections = equipmentSectionsOf(factory)
  const lidarGroups = sections.find((s) => s.typeId === 'LIDAR')?.groups ?? []
  const lidarBays = lidarsByBay(factory)
  const edges = edgePcsOf(factory, snapshot)
  const panels = networkPanelsOf(factory, snapshot)
  const allCabinets = panelsWithStatus(factory, snapshot)
  const lidarCount = counts.LIDAR ?? 0
  const tiltCount = counts.TILT ?? 0

  if (sections.length === 0) {
    return <p className="px-3 py-3 text-2xs text-white/45">{t('assembly.equipment.empty')}</p>
  }

  const downPanels = allCabinets.filter((p) => p.status.health === 'down')

  return (
    <div className="flex flex-col gap-2.5 px-2 py-2">
      {/* 종류별 대수 — 아래 구획들의 목차이자 접힘 훑기의 요약(하이브리드의 '스트립') */}
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

      {/* ── 관측: 라이다 = 라이다+틸팅 페어 한 칸 (674칸을 만들지 않는다) ── */}
      {lidarGroups.length > 0 && (
        <PanelSection
          title={t('assembly.equipment.lidarHeading')}
          count={lidarCount}
          summary={
            <span className="text-white/40">
              {t('assembly.equipment.pairNote', { count: tiltCount })}
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            {lidarGroups.map((group) => {
              const list = lidarBays.get(group.bay) ?? []
              return (
                <div key={group.bay}>
                  <p className="mb-1 px-1 text-2xs font-medium text-white/45">
                    {t('assembly.mapEntry.bayHeading', { bay: group.bay })}
                    <span className="ml-1.5 font-mono text-white/30">{group.ids.length}</span>
                  </p>
                  <EquipmentGrid
                    tone="glass"
                    showControls={false}
                    cells={list.map((lidar) =>
                      lidarPairCell(lidar, snapshot, {
                        freshText: mockScanTime(lidar.id),
                        group: group.bay,
                        detail: (tilt) => <TiltDetail tilt={tilt} />,
                      })
                    )}
                  />
                </div>
              )
            })}
          </div>
        </PanelSection>
      )}

      {/* ── 수집·네트워크 ── */}
      {edges.length > 0 && (
        <PanelSection title={t('assembly.equipment.edgeHeading')} count={edges.length}>
          <EquipmentGrid
            tone="glass"
            showControls={false}
            cells={edges.map((entry) =>
              edgePcCell(entry.equipment, entry.status, {
                freshText: elapsedText(entry.status.lastHeartbeatAt, now),
                detail: (status) => <EdgeDetail status={status} />,
              })
            )}
          />
        </PanelSection>
      )}

      {panels.length > 0 && (
        <PanelSection title={t('assembly.equipment.panelsHeading')} count={panels.length}>
          <EquipmentGrid
            tone="glass"
            showControls={false}
            cells={panels.map((entry) =>
              panelCell({
                id: entry.panel.id,
                typeId: entry.panel.typeId,
                powered: entry.status.powered,
                uplink: entry.status.uplink,
                memberOnline: entry.status.memberOnline,
                memberTotal: entry.status.memberTotal,
                lidarPairs: entry.status.lidarPairs,
                detail: <PanelDetail entry={entry} />,
              })
            )}
          />
        </PanelSection>
      )}
    </div>
  )
}

/** 경과 문구 — 신선도 한 마디 */
function elapsedText(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60000))
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}
