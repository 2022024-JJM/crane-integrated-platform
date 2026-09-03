import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { formatDetectionId } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import { LidarPointCloudViewer } from '../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { PointCloudViewControls } from '../../../../shared/features/bay-viewer/ui/PointCloudViewControls'
import { PointCloudLegend } from '../../../../shared/features/bay-viewer/ui/PointCloudLegend'
import { ViewportHelp } from '../../../../shared/features/bay-viewer/ui/ViewportHelp'
import { ViewportToolbar } from '../../../../shared/features/bay-viewer/ui/ViewportToolbar'
import { FirstRunHint } from '../../../../shared/features/bay-viewer/ui/FirstRunHint'
import { LocationTabs, type LocationTabsRouting } from '../../../../shared/features/bay-viewer/ui/LocationTabs'
import { ViewportFullscreenButton } from '../../../../shared/ui/atoms/ViewportFullscreenButton'
import {
  viewportEdgeColors,
  type ViewerDisplayMode,
} from '../../../../shared/features/bay-viewer/lib/displayModes'
import {
  colorModesFor,
  reconcileColorMode,
  type PointColorMode,
} from '../../../../shared/features/bay-viewer/lib/colorModes'
import type {
  LidarSensor,
  LidarSensorStatus,
} from '../../../../shared/features/bay-viewer/model/lidarSensor'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { useFullscreen } from '../../../../shared/lib/useFullscreen'
import { useDelayedFlag } from '../../../../shared/lib/useDelayedFlag'
import { performanceLinkFor } from '../../../../shared/entities/vessel'
import { HealthBadge } from '../../../../shared/entities/zone/ui/HealthBadge'
import { Spinner, SpinnerOverlay } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'
import { cn } from '../../../../shared/lib/utils'
import type { InshopKey } from '../../../../shared/lib/i18n/keys'
import { OUTFITTING_STATUS_META, type OutfittingBlock } from '../../model/block'
import { fetchFactories } from '../../api/outfittingApi'
import {
  fetchOutfittingBayDetail,
  fetchOutfittingFactoryScene,
  fetchOutfittingLocations,
} from '../../api/outfittingWorkspace'

/*
 * 선행의장 공장 워크스페이스 (W7-10) — **조립 공장 현황과 같은 구조**다.
 *
 * [3D 뷰어 | 센서 상태 | 블록·실적] 축 탭 + 공장 전환 탭(3D 상자 부착) + 베이 알약(유리
 * 도구줄). 3D 뷰어 탭은 공장 전 베이가 한 장면에 서는 센서퓨전 뷰이고(베이 실루엣·점군·
 * 라벨 배지 — 조립 문법 그대로), 베이 라벨을 다시 누르면 그 베이 화면으로 들어간다.
 *
 * 다른 것은 **데이터 문법**뿐이다: 의장은 블록 하나가 작업 단위이고 그 아래 계층이 없다
 * (blockUnitContract). 그래서 조립의 정반·소조 축이 서던 자리에 베이·블록 단위 인식이
 * 선다. 판정·점군 밀도는 `outfittingBayScene`(W7-6E·W7-7-4 계약)이 지킨다.
 */
type WorkspaceTab = 'viewer' | 'sensors' | 'blocks'
const WORKSPACE_TABS: {
  key: WorkspaceTab
  labelKey:
    | 'outfitting.workspace.tabViewer'
    | 'outfitting.workspace.tabSensors'
    | 'outfitting.workspace.tabBlocks'
}[] = [
  { key: 'viewer', labelKey: 'outfitting.workspace.tabViewer' },
  { key: 'sensors', labelKey: 'outfitting.workspace.tabSensors' },
  { key: 'blocks', labelKey: 'outfitting.workspace.tabBlocks' },
]

const SENSOR_ROW_META: Record<LidarSensorStatus, { labelKey: InshopKey; dot: string }> = {
  online: { labelKey: 'outfitting.sensorStatus.online', dot: 'bg-status-healthy' },
  offline: { labelKey: 'outfitting.sensorStatus.offline', dot: 'bg-foreground/30' },
  error: { labelKey: 'outfitting.sensorStatus.error', dot: 'bg-status-unhealthy' },
  calibrating: { labelKey: 'outfitting.sensorStatus.calibrating', dot: 'bg-status-degraded' },
}

function NotFoundNotice({ message }: { message: string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-inshop-xl font-semibold text-foreground">{message}</h1>
      <Link
        to="/indoorshop/zones/outfitting/list"
        className="inline-block rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
      >
        {t('outfitting.workspace.backToFactories')}
      </Link>
    </div>
  )
}

/**
 * 블록 한 줄 — 상태·진척·마지막 스캔, 줄 전체가 통합실적으로 가는 문 (W7-7-5 그대로).
 * 블록·실적 탭의 알맹이다 — 문서형 리스트 시절의 콘텐츠가 제 축의 전면으로 온 것.
 */
function BlockRow({ block }: { block: OutfittingBlock }) {
  const { t } = useTranslation()
  const meta = OUTFITTING_STATUS_META[block.status]
  return (
    <li>
      <Link
        to={performanceLinkFor({ projNo: block.projNo, blocks: [block.blkNo] })}
        title={t('common.viewPerformanceHint', { block: `${block.projNo}-${block.blkNo}` })}
        className="flex items-center gap-3 rounded-inshop-md px-2 py-1.5 transition-colors hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
        <span className="w-24 shrink-0 truncate font-mono text-inshop-xs text-foreground">
          {block.projNo}-{block.blkNo}
        </span>
        <span className="w-12 shrink-0 font-mono text-2xs text-foreground/50">{block.wstgCode}</span>
        <span className={cn('w-14 shrink-0 text-2xs font-medium', meta.ink)}>{t(meta.labelKey)}</span>
        {block.justArrived && (
          <span className="shrink-0 rounded border border-accent/40 bg-accent/10 px-1.5 py-px text-2xs font-medium text-accent">
            {t('outfitting.blockStatus.justArrived')}
          </span>
        )}
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
        <span aria-hidden="true" className="shrink-0 text-2xs text-foreground/35">
          →
        </span>
      </Link>
    </li>
  )
}

/** 센서 한 줄 — 문서형 리스트 시절의 LiDAR 목록 문법 그대로 (센서 상태 탭의 알맹이) */
function SensorRow({ sensor }: { sensor: LidarSensor }) {
  const meta = SENSOR_ROW_META[sensor.status]
  return (
    <li className="flex items-center gap-2 px-1 py-1 text-inshop-xs">
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      <span className="w-20 shrink-0 truncate font-mono text-2xs text-foreground">
        {sensor.name}
      </span>
      <span className="min-w-0 flex-1" />
      <span className="shrink-0 font-mono text-2xs text-foreground/45">{sensor.lastScanAt}</span>
    </li>
  )
}

/** 베이별 센서 카드 — 조립 공장 센서 탭(정반마다 한 장)과 같은 격자 문법 */
function BaySensorSection({
  name,
  workCntr,
  sensors,
}: {
  name: string
  workCntr: string
  sensors: LidarSensor[]
}) {
  const { t } = useTranslation()
  const online = sensors.filter((sensor) => sensor.status === 'online').length
  return (
    <section className="rounded-inshop-lg border border-border p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-inshop-sm font-semibold text-foreground">{name}</h3>
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-mono text-inshop-xs tabular-nums',
              online < sensors.length ? 'text-status-degraded' : 'text-status-healthy'
            )}
          >
            {online}/{sensors.length}
          </span>
          <span className="font-mono text-2xs text-foreground/50">{workCntr}</span>
        </span>
      </div>
      <ul className="space-y-0.5">
        {sensors.map((sensor) => (
          <SensorRow key={sensor.id} sensor={sensor} />
        ))}
        {sensors.length === 0 && (
          <li className="px-1 py-2 text-2xs text-foreground/45">{t('common.none')}</li>
        )}
      </ul>
    </section>
  )
}

export function OutfittingWorkspace() {
  const { t } = useTranslation()
  const { factoryId, locationId } = useParams<{ factoryId: string; locationId?: string }>()
  const navigate = useNavigate()

  /** 축 탭 — 공장·베이를 옮기면 기본(3D 뷰어)으로 돌아온다 (조립과 같은 규칙) */
  const [workTab, setWorkTab] = useState<WorkspaceTab>('viewer')
  useEffect(() => {
    setWorkTab('viewer')
  }, [factoryId, locationId])

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [highlightedBayId, setHighlightedBayId] = useState<string | null>(null)
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null)
  useEffect(() => {
    setSelectedBlockId(null)
    setSelectedBayId(null)
  }, [factoryId, locationId])

  /* 뷰어 표시 상태 — 소유자는 이 화면이다 (조립 워크스페이스와 같은 규칙) */
  const [displayMode, setDisplayMode] = useState<ViewerDisplayMode>('overlay')
  const [colorMode, setColorMode] = useState<PointColorMode>('sensor')
  const [showOutline, setShowOutline] = useState(true)
  const [rememberedColorMode, setRememberedColorMode] = useState<PointColorMode>('sensor')

  const handleDisplayModeChange = (next: ViewerDisplayMode) => {
    if (next === 'cad' && displayMode !== 'cad' && colorMode !== 'progress') {
      setRememberedColorMode(colorMode)
    }
    setColorMode((current) => reconcileColorMode(next, current, rememberedColorMode, false))
    setDisplayMode(next)
  }
  const colorOptions = colorModesFor(displayMode)
  useEffect(() => {
    if (!colorOptions.some((option) => option.value === colorMode)) {
      setColorMode(displayMode === 'cad' ? 'plain' : colorOptions[0].value)
    }
  }, [colorOptions, colorMode, displayMode])

  const {
    ref: viewportRef,
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen<HTMLDivElement>()
  const viewportEdge = viewportEdgeColors(displayMode)
  const viewerSizeClass = isFullscreen
    ? 'h-full min-h-0'
    : 'h-[72vh] min-h-[480px] xl:h-full xl:min-h-0'

  const viewerControlProps = {
    displayMode,
    colorMode,
    showOutline,
    onDisplayModeChange: handleDisplayModeChange,
    onColorModeChange: setColorMode,
    onShowOutlineChange: setShowOutline,
    colorOptions,
  }

  /* ── 데이터 — 공장 목록·베이 목록·장면 (조립의 base/factoryScene/detail 과 같은 골격) ── */
  const { baseDate } = useBaseDate()
  const { data: factories } = useAsyncData(() => fetchFactories(), [])
  const { data: locations, loading: locationsLoading } = useAsyncData(
    () => fetchOutfittingLocations(factoryId ?? '', baseDate),
    [factoryId, baseDate]
  )
  const { data: factoryScene, loading: factorySceneLoading } = useAsyncData(
    () =>
      factoryId && !locationId
        ? fetchOutfittingFactoryScene(factoryId, baseDate)
        : Promise.resolve(null),
    [factoryId, locationId, baseDate]
  )
  const { data: bayDetail, loading: bayDetailLoading } = useAsyncData(
    () =>
      factoryId && locationId
        ? fetchOutfittingBayDetail(factoryId, locationId, baseDate)
        : Promise.resolve(null),
    [factoryId, locationId, baseDate]
  )

  const showFactorySpinner = useDelayedFlag(factorySceneLoading)
  const showDetailSpinner = useDelayedFlag(bayDetailLoading)

  const factory = factories?.find((entry) => entry.id === factoryId)
  const selectedLocation = locationId
    ? locations?.find((location) => location.id === locationId)
    : undefined

  /* 탭 부품의 공정 몫 — 경로·문구 (shared LocationTabs 계약) */
  const tabFactories = useMemo(
    () => (factories ?? []).map((entry) => ({ id: entry.id, displayName: entry.displayName })),
    [factories]
  )
  const routing: LocationTabsRouting = {
    factoryHref: (id) => `/zones/outfitting/${id}`,
    bayHref: (id, bayId) => `/zones/outfitting/${id}/${bayId}`,
    navLabel: t('outfitting.tabs.label'),
    allLabel: t('outfitting.tabs.all'),
    bayTitle: (name, code) => t('outfitting.tabs.bayTitle', { name, code }),
  }

  /** 블록·실적 탭의 재료 — 공장 뷰는 전 베이, 베이 뷰는 그 베이만 */
  const blocksByBay = useMemo(() => {
    if (locationId && bayDetail) {
      return [{ locationId: bayDetail.locationId, blocks: bayDetail.blocks }]
    }
    if (factoryScene) {
      return [...factoryScene.blocksByBay.entries()].map(([id, blocks]) => ({
        locationId: id,
        blocks,
      }))
    }
    return []
  }, [locationId, bayDetail, factoryScene])
  const allBlocks = useMemo(() => blocksByBay.flatMap((entry) => entry.blocks), [blocksByBay])

  const bayScenes = locationId
    ? bayDetail
      ? [bayDetail.scene]
      : null
    : (factoryScene?.bays ?? null)

  if (factories && factoryId && !factory) {
    return <NotFoundNotice message={t('outfitting.workspace.notFound')} />
  }
  if (!factory || !locations) {
    return (
      <div className="flex justify-center py-16">
        {locationsLoading && <Spinner size={26} label={t('common.loading')} className="text-accent" />}
      </div>
    )
  }
  if (locationId && !locationsLoading && !selectedLocation) {
    return <NotFoundNotice message={t('outfitting.workspace.unknownLocation')} />
  }

  const inProgress = allBlocks.filter((block) => block.status === 'in_progress').length
  const completed = allBlocks.filter((block) => block.status === 'completed').length
  const selectedBlock =
    selectedBlockId && bayScenes
      ? bayScenes.flatMap((scene) => scene.blocks).find((block) => block.id === selectedBlockId)
      : undefined

  const locationTabs = (
    <LocationTabs
      factories={tabFactories}
      locations={locations}
      routing={routing}
      currentFactoryId={factory.id}
      tone="attached"
      parts="factories"
      attachedColors={viewportEdge}
      className="shrink-0"
    />
  )
  const bayPills = (
    <LocationTabs
      factories={tabFactories}
      locations={locations}
      routing={routing}
      currentFactoryId={factory.id}
      currentLocationId={locationId}
      highlightedId={highlightedBayId}
      onHighlight={setHighlightedBayId}
      tone="glass"
      parts="bays"
    />
  )

  return (
    <div className="flex flex-col gap-5 xl:h-full xl:min-h-0 xl:gap-3">
      <FixedViewport />

      {/* 머리글 한 줄 — 제목(좌) + 식별 정보(우). 조립 워크스페이스와 같은 문법 */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="min-w-0 truncate text-inshop-lg font-semibold text-foreground">
          {selectedLocation
            ? t('outfitting.workspace.bayTitle', { name: selectedLocation.name })
            : t('outfitting.workspace.factoryTitle', { name: factory.displayName })}
        </h1>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <span className="font-mono text-inshop-xs text-foreground/55">
            {t('outfitting.factoryCard.shop', { code: factory.assyShop })}
          </span>
          <HealthBadge health={factory.health} />
          <span className="text-inshop-xs text-foreground/63">
            {t('outfitting.workspace.blockSummary', {
              total: allBlocks.length,
              inProgress,
              completed,
            })}
          </span>
        </div>
      </div>

      {/* 축 탭 — ②뷰어 / ①센서 / ③블록·실적 (조립과 같은 프레임) */}
      <div
        role="tablist"
        aria-label={t('outfitting.workspace.tabAria')}
        className="flex shrink-0 items-center gap-1 self-start rounded-inshop-lg border border-border bg-surface-secondary/50 p-1"
      >
        {WORKSPACE_TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={workTab === key}
            onClick={() => setWorkTab(key)}
            className={cn(
              'rounded-inshop-md px-3 py-1 text-inshop-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              workTab === key
                ? 'bg-accent text-on-accent shadow-sm'
                : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-6 xl:min-h-0 xl:flex-1 xl:gap-4">
        {workTab === 'viewer' ? (
          /* ② 3D 뷰어 — 공장 전체(전 베이 센서퓨전) 또는 베이 하나. 전폭 */
          <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
            {locationTabs}
            <div
              ref={viewportRef}
              style={isFullscreen ? { background: viewportEdge.background } : undefined}
              className="relative min-w-0 xl:min-h-0 xl:flex-1"
            >
              {!bayScenes ? (
                <div
                  style={{ background: viewportEdge.background }}
                  className={cn('w-full rounded-inshop-lg border border-border', viewerSizeClass)}
                />
              ) : locationId ? (
                <LidarPointCloudViewer
                  key={locationId}
                  mode="bay"
                  bays={bayScenes}
                  selectedBlockId={selectedBlockId}
                  displayMode={displayMode}
                  colorMode={colorMode}
                  showOutline={showOutline}
                  onSelectBlock={setSelectedBlockId}
                  className={viewerSizeClass}
                />
              ) : (
                <LidarPointCloudViewer
                  key={factory.id}
                  mode="factory"
                  bays={bayScenes}
                  layout={factoryScene?.layout ?? null}
                  displayMode={displayMode}
                  colorMode={colorMode}
                  showOutline={showOutline}
                  selectedBayId={selectedBayId}
                  onBaySelect={setSelectedBayId}
                  onOpenBay={(locId) => navigate(`/indoorshop/zones/outfitting/${factory.id}/${locId}`)}
                  highlightedBayId={highlightedBayId}
                  onHoverBay={setHighlightedBayId}
                  className={viewerSizeClass}
                />
              )}
              <ViewportToolbar
                title={
                  locationId
                    ? t('outfitting.workspace.registeredCloud')
                    : t('outfitting.workspace.factoryFusion')
                }
                hint={
                  locationId
                    ? t('outfitting.workspace.registeredCloudHint')
                    : t('outfitting.workspace.factoryFusionHint')
                }
                nav={bayPills}
              >
                <PointCloudViewControls {...viewerControlProps} tone="glass" />
              </ViewportToolbar>
              <PointCloudLegend colorMode={colorMode} className="left-auto right-4 top-14" />
              <div className="absolute right-4 top-4 z-10 flex items-start gap-2">
                {selectedBlock && (
                  <button
                    type="button"
                    onClick={() => setSelectedBlockId(null)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-inshop-md px-2',
                      'glass-panel text-2xs font-medium',
                      'transition-colors hover:bg-glass-hover hover:text-glass-accent',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent'
                    )}
                  >
                    <span className="font-mono">{formatDetectionId(selectedBlock)}</span>
                    <span className="text-glass-foreground/54">{t('viewer.backToAll')}</span>
                  </button>
                )}
                <ViewportHelp className="static flex-col-reverse" />
                {fullscreenSupported && (
                  <ViewportFullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
                )}
              </div>
              {bayScenes && !locationId && (
                <FirstRunHint className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2" />
              )}
              {(locationId ? showDetailSpinner : showFactorySpinner) && (
                <SpinnerOverlay
                  label={locationId ? t('viewer.loadingDetection') : t('viewer.loadingFusion')}
                />
              )}
            </div>
          </div>
        ) : workTab === 'sensors' ? (
          /* ① 센서 상태 — 문서형 리스트의 LiDAR 목록이 제 축의 전면으로 (베이마다 한 장) */
          <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:flex-1">
            <p className="shrink-0 text-inshop-xs text-foreground/55">
              {t('outfitting.workspace.sensorTabHint')}
            </p>
            {!bayScenes ? (
              <div className="flex h-[50vh] items-center justify-center rounded-inshop-lg border border-border">
                {(locationId ? showDetailSpinner : showFactorySpinner) && (
                  <Spinner size={24} className="text-accent" />
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 xl:min-h-0 xl:flex-1 xl:content-start xl:overflow-y-auto xl:pr-1">
                {bayScenes.map((scene) => (
                  <BaySensorSection
                    key={scene.location.id}
                    name={scene.location.name}
                    workCntr={scene.location.workCntr}
                    sensors={scene.sensors}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ③ 블록·실적 — 문서형 리스트의 블록 현황이 제 축의 전면으로 (딥링크 유지) */
          <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:flex-1">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <h2 className="text-inshop-base font-semibold text-foreground">
                {t('outfitting.workspace.blockListTitle')}{' '}
                <span className="font-normal text-foreground/54">{allBlocks.length}</span>
              </h2>
              <p className="text-inshop-xs text-foreground/55">{t('outfitting.workspace.blocksTabHint')}</p>
            </div>
            {allBlocks.length === 0 ? (
              <p className="rounded-inshop-lg border border-border px-2 py-6 text-center text-inshop-sm text-foreground/45">
                {t(
                  locationId
                    ? 'outfitting.workspace.noBayBlocks'
                    : 'outfitting.workspace.noBlocks'
                )}
              </p>
            ) : (
              <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                {blocksByBay
                  .filter((entry) => entry.blocks.length > 0)
                  .map((entry) => {
                    const location = locations.find((loc) => loc.id === entry.locationId)
                    return (
                      <div key={entry.locationId} className="rounded-inshop-lg border border-border bg-surface p-3">
                        <div className="mb-0.5 flex items-center justify-between px-2">
                          <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground/50">
                            {location?.name ?? entry.locationId}
                          </h3>
                          <span className="font-mono text-2xs text-foreground/40">
                            {t('outfitting.workspace.blockCount', { count: entry.blocks.length })}
                          </span>
                        </div>
                        <ul>
                          {entry.blocks.map((block) => (
                            <BlockRow key={block.id} block={block} />
                          ))}
                        </ul>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
