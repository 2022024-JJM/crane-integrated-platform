import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import type { BasemapLayer, LatLonBounds, MapTheme } from '../../../shared/features/yard-map'
import type { YardParcels } from '../../../shared/entities/yard-parcels'
import {
  CollectionSummaryBody,
  PanelModeTabs,
  PanelSection,
  ProcessMapEntry,
  type MapEntryLabels,
  type MarkerRenderCtx,
} from '../../../shared/features/process-map-entry'
import { equipmentTypeOf } from '../../../shared/entities/equipment'
import { useEquipmentTypeLabel } from '../../../shared/entities/equipment/ui/useEquipmentTypeLabel'
import { EquipmentGlyph, symbolOfType } from '../../../shared/entities/equipment/ui/EquipmentSymbol'
import { CheckIcon } from '../../../shared/ui/icons'
import { cn } from '../../../shared/lib/utils'
import { useFactoryEquipmentStatus } from '../../../shared/entities/equipment/useEquipmentStatus'
import type { OutfittingBlock, OutfittingFactoryOverview } from '../model/block'
import { areasByBay, blocksOfBay } from '../lib/bayBlocks'
import {
  LAYOUT_DRAWING_REVISION,
  layoutDrawingOf,
} from '../../../shared/entities/equipment/layoutDrawings'
import { DrawingViewerModal } from '../../../shared/features/drawing-viewer'
import {
  OUTFITTING_DEVICE_KINDS,
  OUTFITTING_DEVICE_META,
  type OutfittingDeviceKind,
} from '../model/equipment'
import {
  OUTFITTING_MARKER_TYPES,
  deviceCountsByKind,
  devicesOfBay,
  outfittingDevices,
  deviceSummaryOf,
  outfittingCollectionRows,
  outfittingEquipmentMarkers,
  outfittingEquipmentSections,
  outfittingFactoryStatusHref,
  tiltModeCountsOf,
  type OutfittingEquipmentMarker,
} from '../lib/equipmentStatus'
import { OutfittingDeviceStatusList } from './OutfittingDeviceStatusList'
import { SpinnerOverlay } from '../../../shared/ui/atoms/Spinner'
import { EmptyState, ErrorState, MapPanelSkeleton } from '../../../shared/ui/states'

/* 베이 3D 뷰는 three.js 를 끄는 무거운 화면 — 열 때만 청크를 부른다(맵 진입을 가볍게) */
const OutfittingBayViewer = lazy(() =>
  import('./OutfittingBayViewer').then((m) => ({ default: m.OutfittingBayViewer }))
)

/*
 * 선행의장 맵 진입 — '맵 진입 공정 화면' 공통 프레임(process-map-entry)의 소비자.
 *
 * 맵 로딩·타 공정 지번 강등·공장 포커스/fly-to·베이 드릴다운·좌상단 한 자리 오버레이·
 * 우측 접이식 카드 패널은 전부 프레임의 몫이다. 이 파일에 남는 것은 **의장 고유부**뿐이다:
 * 공장 카드의 2단 본문, 베이 카드에 덧붙는 블록·설비 목록, PCD 뷰어 자리 카드, 그리고
 * 의장 문구(i18n 은 여기서 끝낸다 — 프레임은 t() 를 모른다).
 *
 * 우측 패널은 **조립과 같은 2단**이다(W6-5):
 *  ① 설비 상태 — 그 공장의 설비 전부를 종류 구획으로(라이다는 베이별). 조립과 구획 순서·
 *     문법이 같아, 두 화면을 오갈 때 눈이 다시 적응하지 않아도 된다.
 *  ② 수집 현황 — 감지 블록·작업 완료·최근 수집, 그리고 공장 현황으로 나가는 문.
 *     예전의 '작업중/완료/대기' 막대는 걷어냈다 — 블록은 **수집 현황 문법 안에서만** 센다.
 *
 * 마커 층은 **설비 배치**다(W6-4). 260903 교체판 도면 이관으로 의장 7공장 290대가 실좌표로
 * 들어왔으므로, 도장(제습기/가스히터)·조립(종류 심볼)과 같은 문법으로 지도에 세운다 —
 * 종류 토글, 종류별 심볼, 상태 3색, 고른 한 대의 좌상단 상세. 마커의 상태는 목록과 **같은
 * 배열**(`outfittingDevices`)에서 나온다 — 지도가 자기 계산을 들면 두 화면이 갈린다.
 * accentOf 는 주지 않는다 — 기본이 그 공장의 공정색이라 의장 주황이 저절로 선다.
 */

const OUTFITTING_PROCESS = '의장'

/** 3D 뷰가 겨눈 베이 — 지번 fixture 의 베이 번호(공장 내 유일)와 화면 라벨 */
interface ViewerTarget {
  factory: string
  bayNo: string
  bayLabel: string
  /** 이 베이의 로스터 블록 — 뷰어의 인식 대상 신원 */
  blocks: OutfittingBlock[]
}

/**
 * 베이 카드의 블록 한 줄 — 누르면 그 베이의 3D 뷰가 열린다.
 *
 * ⚠️ '작업중/대기' 상태 낱말·색은 쓰지 않는다(W6-5). 이 카드는 **수집 현황** 문법 안에
 * 있고, 거기서 블록이 답하는 질문은 "무엇이 감지됐고 얼마나 진행됐나"다 — 작업 상태는
 * 블록 상세 화면의 몫이라 여기서 두 번 말하면 어느 쪽이 기준인지 묻게 된다.
 */
function BayBlockRow({ block, onOpen }: { block: OutfittingBlock; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        title={t('outfitting.mapEntry.viewer.rowHint')}
        className="flex w-full items-center gap-2 rounded-inshop-md px-2 py-1 text-left transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <span className="w-20 shrink-0 truncate font-mono text-2xs text-white/88">
          {block.projNo}-{block.blkNo}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block h-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-white/45"
              style={{ width: `${block.progress}%` }}
            />
          </span>
        </span>
        <span className="w-8 shrink-0 text-right font-mono text-2xs tabular-nums text-white/62">
          {block.progress}%
        </span>
        <span className="w-10 shrink-0 text-right font-mono text-2xs tabular-nums text-white/45">
          {block.lastScanAt}
        </span>
      </button>
    </li>
  )
}

type PanelMode = 'equipment' | 'collection'

/** 기본 표시 종류 — 틸팅은 페어 라이다와 겹쳐 서므로 기본에서 뺀다(토글로 켠다) */
const DEFAULT_MARKER_TYPES: OutfittingDeviceKind[] = ['LIDAR', 'EDGE', 'PNL']

/** 상태 → 마커 표현 — 온라인은 종류색 채움, 오프라인은 꺼짐, 오류는 붉은 링 펄스 */
function markerLook(status: OutfittingEquipmentMarker['status'], color: string) {
  if (status === 'error')
    return { fill: 'rgba(9,14,20,0.85)', border: '#ff5252', glow: '0 0 0 2px #ff5252', pulse: true, dim: false }
  if (status === 'offline')
    return { fill: 'rgba(9,14,20,0.85)', border: color, glow: '0 1px 3px rgba(0,0,0,0.5)', pulse: false, dim: true }
  return {
    fill: color,
    border: 'rgba(255,255,255,0.4)',
    glow: `0 0 10px ${color}b3`,
    pulse: false,
    dim: false,
  }
}

/** 종류 색 — 설비 종류 레지스트리를 단일 소스로 쓰되, 의장 meta 가 있으면 그것을 따른다 */
function markerColorOf(kind: OutfittingDeviceKind): string {
  return equipmentTypeOf(kind)?.color ?? OUTFITTING_DEVICE_META[kind].color
}

/** 패널 안의 '더 볼 곳' 문 — 수집 요약 본문이 라우터를 모르게 렌더 함수로 넘긴다 */
function PanelLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-1 flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
    >
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}

/**
 * ① 설비 상태 본문 — 공장 하나의 설비 전부를 종류 구획으로.
 *
 * 조립 `EquipmentInventoryPanel` 과 **같은 순서·같은 겉테**다(관측 → 수집·네트워크,
 * 라이다는 베이별, 틸팅은 접힘). 목록 컴포넌트만 의장 몫(`OutfittingDeviceStatusList`)을
 * 쓴다 — 조립은 라이다 진단값을 함께 내고 의장은 아직 그 값을 받지 못해 줄의 내용이 다르다.
 */
function FactoryEquipmentBody({
  factory,
  onOpenDrawing,
}: {
  factory: string
  onOpenDrawing: (factory: string) => void
}) {
  const { t } = useTranslation()
  const { snapshot } = useFactoryEquipmentStatus(factory)
  const devices = outfittingDevices(factory)
  const counts = deviceCountsByKind(devices)
  const drawing = layoutDrawingOf(factory)
  const tiltModes = tiltModeCountsOf(factory, snapshot)

  if (devices.length === 0) {
    /* 유리 위(지도 오버레이)이므로 흰 램프 — 왜 없는지까지 말한다(설비 상태 화면과 같은 문구) */
    return (
      <EmptyState
        tone="glass"
        size="sm"
        reason="notCollected"
        title={t('outfitting.equipment.empty')}
        description={t('outfitting.equipment.emptyNote')}
        className="m-2"
      />
    )
  }

  /* 구획 순서·베이 묶음·접힘 규칙은 lib 이 정한다(조립과 같은 규칙임을 테스트가 지킨다) */
  const sections = outfittingEquipmentSections(factory)
  const byId = new Map(devices.map((d) => [d.id, d]))
  const lidarSection = sections.find((s) => s.typeId === 'LIDAR')
  const orderedBays: [string, typeof devices][] = (lidarSection?.groups ?? []).map((g) => [
    g.bay,
    g.ids.map((id) => byId.get(id)!),
  ])
  const ofKind = (kind: OutfittingDeviceKind) => devices.filter((d) => d.kind === kind)

  return (
    <div className="flex flex-col gap-2.5 px-2 py-2">
      {/* 종류별 대수 — 아래 구획들의 목차 */}
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 py-1">
        {OUTFITTING_DEVICE_KINDS.filter((kind) => counts[kind] > 0).map((kind) => (
          <li key={kind} className="flex items-center gap-1.5 text-2xs text-white/55">
            <span
              aria-hidden="true"
              className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-white"
              style={{ backgroundColor: markerColorOf(kind) }}
            >
              <EquipmentGlyph symbol={symbolOfType(kind)} size={9} />
            </span>
            {t(OUTFITTING_DEVICE_META[kind].labelKey)}
            <span className="font-mono tabular-nums text-white/85">{counts[kind]}</span>
          </li>
        ))}
      </ul>

      {drawing && (
        <button
          type="button"
          onClick={() => onOpenDrawing(factory)}
          title={t('drawing.openHint', { factory: drawing.title })}
          className="flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
        >
          <span>{t('drawing.open')}</span>
          <span className="font-mono text-white/40">{drawing.drawingNo}</span>
        </button>
      )}

      {orderedBays.length > 0 && (
        <PanelSection
          title={t(OUTFITTING_DEVICE_META.LIDAR.labelKey)}
          count={counts.LIDAR}
          summary={
            <span className="flex items-center gap-2 text-white/45">
              <span>{t('outfitting.equipment.tilt.paired', { count: counts.TILT })}</span>
              {tiltModes.tilting > 0 && (
                <span className="text-sky-300">
                  {t('outfitting.equipment.tilt.modeValue.tilting')} {tiltModes.tilting}
                </span>
              )}
              {tiltModes.error > 0 && (
                <span className="text-status-unhealthy">
                  {t('outfitting.equipment.tilt.modeValue.error')} {tiltModes.error}
                </span>
              )}
            </span>
          }
        >
          <div className="flex flex-col gap-2">
            {orderedBays.map(([bay, list]) => (
              <OutfittingDeviceStatusList
                key={bay}
                devices={list}
                title={
                  bay === '-'
                    ? t('outfitting.equipment.unassignedBay')
                    : t('outfitting.equipment.bayHeading', { bay })
                }
              />
            ))}
          </div>
        </PanelSection>
      )}

      {/* 틸팅은 라이다 셀 안에서 페어로 선다(674칸 금지 · 레퍼런스 §3.4) —
          별도 구획을 두지 않는다. 대수와 모드 요약은 라이다 구획 머리가 말한다 */}
      {counts.EDGE > 0 && (
        <PanelSection title={t(OUTFITTING_DEVICE_META.EDGE.labelKey)} count={counts.EDGE}>
          <OutfittingDeviceStatusList
            devices={ofKind('EDGE')}
            title={t(OUTFITTING_DEVICE_META.EDGE.labelKey)}
          />
        </PanelSection>
      )}

      {counts.PNL > 0 && (
        <PanelSection title={t(OUTFITTING_DEVICE_META.PNL.labelKey)} count={counts.PNL}>
          <OutfittingDeviceStatusList
            devices={ofKind('PNL')}
            title={t(OUTFITTING_DEVICE_META.PNL.labelKey)}
          />
        </PanelSection>
      )}
    </div>
  )
}

interface OutfittingMapEntryProps {
  parcels: YardParcels
  /** 주인공 공장 이름들 — 의장 7공장 (지번 fixture 공장명 = 의장 fixture name) */
  factories: readonly string[]
  selectedFactory: string
  /** `null` = 전체 보기로 나간다 (프레임의 드릴다운 URL 계약) */
  onSelectFactory: (factory: string | null) => void
  /** 공장명 → 목록 화면과 같은 집계 (블록 수·상태 구성·LiDAR) */
  overviewByName: ReadonlyMap<string, OutfittingFactoryOverview>
  /**
   * 집계가 아직 오는 중 / 못 왔다.
   *
   * 이 둘을 안 받으면 패널 본문이 조용히 비어 버린다 — 사용자에게는 "이 공장은 볼 게
   * 없다"로 읽히지만 사실은 기다리는 중이거나 실패한 것이다. `onRetryOverviews` 는
   * **같은 요청을 다시 거는** 함수다(shared/ui/states 계약).
   */
  overviewsLoading?: boolean
  overviewsError?: Error | null
  onRetryOverviews?: () => void
  /** 전 공장 블록 — 베이 카드가 그 베이 소속만 걸러 보여준다 */
  blocks: readonly OutfittingBlock[]
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  yardExtent?: LatLonBounds | null
  /** true 면 처음을 의장 전체 보기로 연다 (딥링크 `?shop=` 진입은 false 로 그 공장을 연다) */
  initialOverview?: boolean
  className?: string
}

export function OutfittingMapEntry({
  parcels,
  factories,
  selectedFactory,
  onSelectFactory,
  overviewByName,
  overviewsLoading = false,
  overviewsError = null,
  onRetryOverviews,
  blocks,
  basemapLayers,
  yardExtent,
  initialOverview = false,
  className,
}: OutfittingMapEntryProps) {
  const { t } = useTranslation()
  /* 설비 종류의 화면 이름 — 레지스트리(도면 이름) 대신 라벨 층을 지난다 */
  const typeLabelOf = useEquipmentTypeLabel()

  /* 베이 3D 뷰 — 공장이 바뀌면 닫는다(도장의 설비 상세와 같은 규칙) */
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null)
  useEffect(() => {
    setViewerTarget(null)
  }, [selectedFactory])

  /* 우측 패널의 단 — 조립과 같은 [설비 상태 | 수집 현황] 2단 */
  const [panelMode, setPanelMode] = useState<PanelMode>('equipment')
  /* 배치 도면 — 공장마다 한 장. 의장 7공장은 모두 260903 도면집에 있다 */
  const [drawingFactory, setDrawingFactory] = useState<string | null>(null)
  const openDrawing = drawingFactory ? layoutDrawingOf(drawingFactory) : null

  /* ── 설비 마커 층 — 종류 토글은 이 화면이 소유한다(프레임은 종류를 모른다) ── */
  const [markerTypes, setMarkerTypes] = useState<OutfittingDeviceKind[]>(DEFAULT_MARKER_TYPES)
  const markers = useMemo(
    () => outfittingEquipmentMarkers(factories, markerTypes),
    [factories, markerTypes]
  )
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  useEffect(() => {
    setSelectedMarkerId(null)
  }, [selectedFactory])
  const selectedMarker = selectedMarkerId
    ? (markers.find((m) => m.id === selectedMarkerId) ?? null)
    : null

  /* 베이 → 구역 배정 — 의장 베이만 잰다. 블록을 베이 소속으로 거르는 근거 */
  const areasOfBays = useMemo(
    () => areasByBay(parcels.bays.filter((bay) => bay.process === OUTFITTING_PROCESS)),
    [parcels]
  )

  const labels = useMemo<MapEntryLabels>(
    () => ({
      panelTitle: t('outfitting.mapEntry.factoriesTitle'),
      viewAll: t('outfitting.mapEntry.viewAll'),
      viewAllHint: t('outfitting.mapEntry.viewAllHint'),
      expand: t('outfitting.mapEntry.expand'),
      collapse: t('outfitting.mapEntry.collapse'),
      viewOnMap: t('outfitting.mapEntry.viewOnMap'),
      bayCount: (n) => t('dashboard.map.bayCount', { count: n }),
      breadcrumbLabel: t('common.breadcrumbNav'),
      breadcrumbYard: t('common.breadcrumbYard'),
      breadcrumbProcess: t('outfitting.nav.label'),
    }),
    [t]
  )

  /*
   * 마커 글리프 — 종류 심볼을 그대로 쓴다(조립과 같은 문법). 캐비닛(판넬·Edge PC)은
   * 모난 사각·한 급 크게 — 아래를 거느리는 쪽이다.
   */
  const renderMarker = (m: OutfittingEquipmentMarker, ctx: MarkerRenderCtx) => {
    const color = markerColorOf(m.typeId)
    const look = markerLook(m.status, color)
    const cabinet = m.typeId === 'PNL' || m.typeId === 'EDGE'
    const size = ctx.inOverview ? (cabinet ? 12 : 10) : cabinet ? 19 : 16
    return (
      <span
        className={cn(
          'flex items-center justify-center border transition-transform duration-150',
          cabinet ? 'rounded-[4px]' : 'rounded-full',
          ctx.selected ? 'scale-125' : !ctx.inOverview && 'hover:scale-110',
          look.pulse && 'animate-pulse'
        )}
        style={{
          width: size,
          height: size,
          background: look.fill,
          borderColor: look.border,
          color: look.dim ? color : '#fff',
          opacity: look.dim ? 0.45 : 1,
          boxShadow: [look.glow, ctx.selected ? `0 0 0 3px ${color}59` : null]
            .filter(Boolean)
            .join(', '),
        }}
      >
        <EquipmentGlyph symbol={symbolOfType(m.typeId)} size={Math.round(size * 0.62)} />
      </span>
    )
  }

  /* 패널 머리 — 단 토글 + 지도에 세울 종류 토글. 조립과 같은 자리·같은 문법 */
  const panelHeaderExtra = (
    <div className="flex flex-col gap-1.5">
      <PanelModeTabs<PanelMode>
        tabs={[
          { id: 'equipment', label: t('outfitting.mapEntry.modeEquipment') },
          { id: 'collection', label: t('outfitting.mapEntry.modeCollection') },
        ]}
        value={panelMode}
        onChange={setPanelMode}
        ariaLabel={t('outfitting.mapEntry.modeLabel')}
      />
      <div
        className="flex flex-wrap items-center gap-1"
        aria-label={t('outfitting.mapEntry.markerTypesLabel')}
      >
      {OUTFITTING_MARKER_TYPES.map((kind) => {
        const on = markerTypes.includes(kind)
        const color = markerColorOf(kind)
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={on}
            onClick={() =>
              setMarkerTypes((prev) =>
                prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
              )
            }
            title={kind === 'TILT' ? t('outfitting.mapEntry.tiltToggleHint') : undefined}
            /* 켜짐은 체크+진한 채움, 꺼짐은 감쇄 — 조립 레이어 칩과 같은 규칙(감사 A3) */
            className={cn(
              'flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              on ? 'font-medium text-white' : 'text-white/40 opacity-60 hover:text-white/70 hover:opacity-100'
            )}
            style={{
              borderColor: on ? color : 'rgba(255,255,255,0.12)',
              background: on ? `${color}59` : 'transparent',
            }}
          >
            {on ? (
              <CheckIcon size={9} className="shrink-0" />
            ) : (
              <EquipmentGlyph symbol={symbolOfType(kind)} size={10} />
            )}
            {t(OUTFITTING_DEVICE_META[kind].labelKey)}
          </button>
          )
        })}
      </div>
    </div>
  )

  /* 좌상단 상세 — 고른 설비 한 대. 목록과 같은 줄 문법을 그대로 재사용한다 */
  const selectedDevice = selectedMarker
    ? (devicesOfBay(selectedMarker.factory, selectedMarker.bay).find(
        (d) => d.id === selectedMarker.id
      ) ?? null)
    : null
  const detailOverlay =
    selectedMarker && selectedDevice ? (
      <section className="pointer-events-auto flex flex-col overflow-hidden rounded-inshop-xl border border-white/12 bg-[#0b0e12]/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div
          className="h-0.5 w-full shrink-0"
          style={{ backgroundColor: markerColorOf(selectedMarker.typeId) }}
        />
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setSelectedMarkerId(null)}
              className="-ml-1 flex items-center gap-1 rounded-inshop-sm px-1 py-0.5 text-2xs text-white/55 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span aria-hidden="true">←</span>
              <span>{t('outfitting.mapEntry.deviceCard.back')}</span>
            </button>
            <h3 className="mt-1 truncate font-mono text-inshop-lg font-semibold tracking-[-0.02em]">
              {selectedMarker.id}
            </h3>
          </div>
        </div>
        <div className="px-4 pb-3 pt-2">
          {/* 목록 컴포넌트를 한 대짜리로 재사용 — 지도와 목록이 같은 말을 하도록 */}
          <OutfittingDeviceStatusList
            devices={[selectedDevice]}
            title={typeLabelOf(selectedMarker.typeId)}
          />
          {selectedMarker.panelId && (
            <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-white/45">
              <span>{t('outfitting.mapEntry.deviceCard.hostPanel')}</span>
              <span className="font-mono text-white/70">{selectedMarker.panelId}</span>
            </p>
          )}
          <p className="mt-1.5 text-2xs text-white/45">
            {t('outfitting.mapEntry.deviceCard.place', {
              factory: selectedMarker.factory,
              bay: selectedMarker.bay,
            })}
          </p>
        </div>
      </section>
    ) : undefined

  return (
    <>
    <ProcessMapEntry<OutfittingEquipmentMarker>
      parcels={parcels}
      factoryNames={factories}
      basemapLayers={basemapLayers}
      yardExtent={yardExtent}
      selectedFactory={selectedFactory}
      onSelectFactory={onSelectFactory}
      initialOverview={initialOverview}
      markers={markers}
      selectedMarkerId={selectedMarkerId}
      onSelectMarker={setSelectedMarkerId}
      renderMarker={renderMarker}
      detailOverlay={detailOverlay}
      panelHeaderExtra={panelHeaderExtra}
      /*
       * 접힌 공장 줄 — 조립과 같은 문법이다: 이상 여부 점 + 설비 대수.
       * 예전에는 '작업중 n/m'(블록 진행)을 냈는데, 그 줄은 우측 패널이 무엇을 보여 주는지와
       * 어긋났다. 접힌 줄은 **펼치면 무엇이 나오는지**를 미리 말해야 한다.
       */
      factorySummary={(factory) => {
        const summary = deviceSummaryOf(factory)
        return (
          <>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                summary.issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
              )}
              title={t('outfitting.mapEntry.issueCount', { count: summary.issues })}
            />
            <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
              {t('outfitting.mapEntry.deviceCount', { count: summary.total })}
            </span>
          </>
        )
      }}
      factoryBody={(factory) => {
        const overview = overviewByName.get(factory)
        /* 실패 > 로딩 > 빈 상태 — 펴 놓은 카드가 조용히 비지 않게 (shared/ui/states) */
        if (!overview) {
          if (overviewsError) {
            return (
              <ErrorState
                tone="glass"
                size="sm"
                error={overviewsError}
                onRetry={onRetryOverviews}
                className="m-2"
              />
            )
          }
          if (overviewsLoading) return <MapPanelSkeleton label={t('states.loading')} />
          return null
        }
        /* ① 설비 상태 — 조립 ③설비 단과 같은 구획 순서(관측 → 수집·네트워크) */
        if (panelMode === 'equipment') {
          return <FactoryEquipmentBody factory={factory} onOpenDrawing={setDrawingFactory} />
        }
        /* ② 수집 현황 — 블록은 여기서만 센다(작업중/대기 문법을 쓰지 않는다) */
        /* 줄 구성·값·나가는 경로는 lib 이 정한다 — 조립과 같은 규칙임을 테스트가 지킨다 */
        const href = outfittingFactoryStatusHref(factory)
        return (
          <CollectionSummaryBody
            rows={outfittingCollectionRows(overview).map((row) => ({
              label: t(row.labelKey as InshopKey),
              value: row.value,
            }))}
            link={
              href
                ? {
                    to: href,
                    label: t('outfitting.mapEntry.collection.openFactory'),
                    render: (to, label) => <PanelLink to={to} label={label} />,
                  }
                : undefined
            }
          />
        )
      }}
      /*
       * 베이 카드 본문 — 조립 베이 카드와 같은 문법이다: 몇 대가 서 있고 무엇이 감지됐고
       * 최근 수집이 언제인가, 그리고 더 볼 곳(3D 뷰)은 어디인가. 블록은 여기서도
       * **수집 현황 문법**으로만 선다(작업중/대기 낱말·색을 쓰지 않는다).
       */
      bayBody={({ bay }) => {
        const bayBlocks = blocksOfBay(blocks, areasOfBays.get(bay.id), bay.factory)
        /* 베이 번호 — 복합키 `{공장}#{베이}` 의 뒷조각. 3D 장면·실형상 빌더의 연결 키다 */
        const bayNo = bay.id.split('#').pop() ?? bay.label
        const openViewer = () =>
          setViewerTarget({ factory: bay.factory, bayNo, bayLabel: bay.label, blocks: bayBlocks })
        const bayDevices = devicesOfBay(bay.factory, bayNo)
        const lastScan = bayBlocks.map((block) => block.lastScanAt).sort().at(-1)
        return (
          <div className="shrink-0 border-t border-white/8 px-3 pb-3 pt-2.5">
            <div className="flex flex-col gap-1.5 text-inshop-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/50">{t('outfitting.mapEntry.bay.equipmentTitle')}</span>
                <span className="font-mono tabular-nums text-white/90">{bayDevices.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">{t('outfitting.mapEntry.bay.blocksTitle')}</span>
                <span className="font-mono tabular-nums text-white/90">{bayBlocks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">{t('outfitting.mapEntry.collection.lastScan')}</span>
                <span className="font-mono tabular-nums text-white/90">{lastScan ?? '—'}</span>
              </div>
              <button
                type="button"
                onClick={openViewer}
                className="mt-0.5 flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
              >
                <span>{t('outfitting.mapEntry.viewer.open')}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {bayBlocks.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1 px-1 text-2xs font-medium text-white/55">
                  {t('outfitting.mapEntry.bay.blocksTitle')}
                  <span className="ml-1.5 font-mono text-white/30">{bayBlocks.length}</span>
                </p>
                <ul className="space-y-0.5">
                  {bayBlocks.map((block) => (
                    <BayBlockRow key={block.id} block={block} onOpen={openViewer} />
                  ))}
                </ul>
              </div>
            )}

            {/* 이 베이의 설비 — 드릴다운에서도 해당 범위의 설비가 보여야 한다 */}
            <div className="mt-2.5">
              <p className="mb-1.5 px-1 text-2xs font-medium text-white/55">
                {t('outfitting.mapEntry.bay.equipmentTitle')}
                <span className="ml-1.5 font-mono text-white/30">{bayDevices.length}</span>
              </p>
              {bayDevices.length === 0 ? (
                <p className="px-1 py-1.5 text-2xs text-white/40">
                  {t('outfitting.mapEntry.bay.noEquipment')}
                </p>
              ) : (
                <OutfittingDeviceStatusList
                  devices={bayDevices}
                  title={t('outfitting.mapEntry.bay.equipmentTitle')}
                  className="max-h-64 overflow-y-auto"
                />
              )}
            </div>
          </div>
        )
      }}
      legend={
        <>
          {/* 범례는 지금 켜 둔 종류만 — 지도에 없는 그림을 설명하지 않는다 */}
          {OUTFITTING_MARKER_TYPES.filter((kind) => markerTypes.includes(kind)).map((kind) => {
            const cabinet = kind === 'PNL' || kind === 'EDGE'
            return (
              <span key={kind} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 items-center justify-center border border-white/40 text-white',
                    cabinet ? 'rounded-[3px]' : 'rounded-full'
                  )}
                  style={{ background: markerColorOf(kind) }}
                >
                  <EquipmentGlyph symbol={symbolOfType(kind)} size={9} />
                </span>
                {t(OUTFITTING_DEVICE_META[kind].labelKey)}
              </span>
            )
          })}
          <span className="mt-0.5 text-foreground/45">{t('outfitting.mapEntry.markerNote')}</span>
          <span className="text-foreground/45">{t('outfitting.mapEntry.hint3d')}</span>
          <span className="text-foreground/45">{t('outfitting.mapEntry.mockNote')}</span>
        </>
      }
      labels={labels}
      className={className}
    />
    {/* 배치 도면 — 설비 상태 단에서 연다. 맵 위 전면 모달 */}
    {openDrawing && (
      <DrawingViewerModal
        src={openDrawing.src}
        title={openDrawing.title}
        subtitle={`${openDrawing.drawingNo} · ${LAYOUT_DRAWING_REVISION} · p.${openDrawing.page}`}
        width={openDrawing.width}
        height={openDrawing.height}
        onClose={() => setDrawingFactory(null)}
      />
    )}
    {/* 베이 3D 뷰 — 조립 베이 뷰어(shared)의 의장 소비. 맵 위를 전면으로 덮는다 */}
    {viewerTarget && (
      <Suspense fallback={<SpinnerOverlay className="z-30" />}>
        <OutfittingBayViewer
          factory={viewerTarget.factory}
          bayNo={viewerTarget.bayNo}
          bayLabel={viewerTarget.bayLabel}
          bayBlocks={viewerTarget.blocks}
          onClose={() => setViewerTarget(null)}
          className="absolute inset-0 z-30"
        />
      </Suspense>
    )}
    </>
  )
}
