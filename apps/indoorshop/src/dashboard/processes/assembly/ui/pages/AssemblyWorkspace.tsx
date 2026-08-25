import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { formatDetectionId } from '../../model/lidarBlock'
import { AssemblyLocationTabs } from '../AssemblyLocationTabs'
import { BayIdentityBar } from '../BayIdentityBar'
import { DetectedBlockList } from '../block-detail/DetectedBlockList'
import { BlockDetailOverlay } from '../block-detail/BlockDetailOverlay'
import { LidarSensorStatusList } from '../LidarSensorStatusList'
import { LidarPointCloudViewer } from '../viewer/LidarPointCloudViewer'
import type { BaySceneData } from '../viewer/LidarPointCloudViewer'
import { RealScanViewer } from '../viewer/RealScanViewer'
import { SENSOR_POINT_COLORS } from '../../lib/bayConfig'
import { PointCloudViewControls } from '../viewer/PointCloudViewControls'
import { PointCloudLegend } from '../viewer/PointCloudLegend'
import { ViewportHelp } from '../viewer/ViewportHelp'
import { ViewportToolbar } from '../viewer/ViewportToolbar'
import { ViewportFullscreenButton } from '../../../../shared/ui/atoms/ViewportFullscreenButton'
import { viewportEdgeColors, type ViewerDisplayMode } from '../../lib/displayModes'
import {
  colorModesFor,
  reconcileColorMode,
  REAL_PCD_COLOR_MODES,
  REAL_CAD_COLOR_MODES,
  type PointColorMode,
} from '../../lib/colorModes'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { ResizeHandle } from '../../../../shared/ui/atoms/ResizeHandle'
import { useResizablePanel } from '../../../../shared/lib/useResizablePanel'
import { useFullscreen } from '../../../../shared/lib/useFullscreen'
import { useDelayedFlag } from '../../../../shared/lib/useDelayedFlag'
import { cn } from '../../../../shared/lib/utils'
import { Spinner, SpinnerOverlay } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import {
  fetchFactories,
  fetchLocations,
  fetchLidarSensors,
  fetchDetectedBlocks,
  fetchBayModel,
} from '../../api/assemblyApi'
import { isRealFactory } from '../../api/realScanData'

/** 실측 스캔의 기본 색상 규칙 — 이 화면이 먼저 답해야 할 질문이 "정합됐나" 이다 */
const REAL_DEFAULT_COLOR_MODE: PointColorMode = REAL_PCD_COLOR_MODES[0].value

function NotFoundNotice({ message }: { message: string }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <h1 className="text-inshop-xl font-semibold text-foreground">{message}</h1>
      <Link
        to="/indoorshop/zones/assembly"
        className="inline-block rounded-inshop-md bg-accent px-4 py-2 text-inshop-sm font-medium text-on-accent transition-colors hover:bg-accent/80"
      >
        {t('assembly.workspace.backToFactories')}
      </Link>
    </div>
  )
}

export function AssemblyWorkspace() {
  const { t } = useTranslation()
  const { factoryId, locationId } = useParams<{ factoryId: string; locationId?: string }>()
  const navigate = useNavigate()
  /** 실측 스캔 공장인가 — 색상 규칙의 기본값·선택지가 목업과 다르다 */
  const realFactory = isRealFactory(factoryId)

  /** 베이 화면에서 라벨/카드 클릭으로 선택된 블록 — 선택 시 뷰어가 블록 단독 뷰로 전환 */
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  /** 목록에서 가리키는 중인 정반 — 3D 뷰의 강조와 같은 값을 공유한다 */
  const [highlightedBayId, setHighlightedBayId] = useState<string | null>(null)
  /**
   * 뷰어 표시 상태 — 소유자는 뷰어가 아니라 이 화면이다.
   * 표시 모드가 바뀌면 색상 규칙도 함께 조정해야 하는데, 그 규칙은 뷰어가 아니라
   * 상태 소유자가 알아야 할 일이기 때문이다.
   */
  const [displayMode, setDisplayMode] = useState<ViewerDisplayMode>('overlay')
  const [colorMode, setColorMode] = useState<PointColorMode>(
    realFactory ? REAL_DEFAULT_COLOR_MODE : 'sensor'
  )
  const [showOutline, setShowOutline] = useState(true)
  /** CAD 모드에 들어가기 직전에 쓰던 점군 규칙 — 나올 때 되돌린다 */
  const rememberedColorMode = useRef<PointColorMode>(
    realFactory ? REAL_DEFAULT_COLOR_MODE : 'sensor'
  )

  /*
   * 뷰어와 인식 목록의 폭 배분.
   * 기본값(22rem)은 카드 한 장이 줄바꿈 없이 들어가는 폭이고, 여기서부터
   * 사용자가 끌어 조절한다 — 무엇을 넓게 볼지는 지금 하는 일이 정한다.
   */
  const {
    width: listWidth,
    dragging: resizingList,
    containerRef: splitRef,
    separatorProps,
  } = useResizablePanel({
    storageKey: 'assembly-list-width',
    defaultWidth: 352,
    min: 260,
    max: 640,
    minOpposite: 420,
  })

  /*
   * 3D 뷰포트 전체 화면.
   * 뷰어만이 아니라 **오버레이까지 감싼 칸**을 넘긴다 — 뷰어 요소만 띄우면
   * 범례·좌표축·상세 패널이 전체 화면 밖에 남아 사라진다.
   * 정반 뷰와 공장 뷰는 동시에 뜨지 않으므로 훅 하나를 둘이 나눠 쓴다.
   */
  const {
    ref: viewportRef,
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen<HTMLDivElement>()

  /* 3D 상자의 윗변 색 — 붙은 탭과 (장면이 아직 없을 때의) 빈 칸이 같이 입는다 */
  const viewportEdge = viewportEdgeColors(displayMode)

  /* 전체 화면에서는 칸이 곧 화면이다 — 문서 흐름용 고정 높이를 쓰면 아래가 남는다 */
  const viewerSizeClass = isFullscreen
    ? 'h-full min-h-0'
    : 'h-[72vh] min-h-[480px] xl:h-full xl:min-h-0'

  const handleDisplayModeChange = (next: ViewerDisplayMode) => {
    if (next === 'cad' && displayMode !== 'cad' && colorMode !== 'progress') {
      rememberedColorMode.current = colorMode
    }
    setColorMode((current) =>
      reconcileColorMode(next, current, rememberedColorMode.current, realFactory)
    )
    setDisplayMode(next)
  }

  /*
   * 실측 공장은 색상 선택지가 좁다 — 목업 공장에서 고른 규칙(객체·진척)을 들고
   * 넘어오면 유효한 규칙으로 끌어내린다. 옵션 목록(아래 colorOptions)과 짝이다.
   */
  const realColorOptions = displayMode === 'cad' ? REAL_CAD_COLOR_MODES : REAL_PCD_COLOR_MODES
  /* 지금 화면에서 실제로 고를 수 있는 규칙 — 아래 정리(useEffect)와 컨트롤이 같은 목록을 본다 */
  const colorOptions = realFactory ? realColorOptions : colorModesFor(displayMode)
  /*
   * `CAD 정합` 규칙에서는 뷰어가 **블록별** 범례를 직접 낸다 (색이 13종이라 일반 범례로는
   * 무슨 색이 무슨 블록인지 답이 안 된다). 둘을 같이 띄우면 같은 자리에 겹친다.
   */
  const viewerOwnsLegend = realFactory && colorMode === 'match' && displayMode !== 'cad'
  /*
   * 공장을 옮기면 고를 수 있는 규칙 목록 자체가 바뀐다 — 실측 공장에서 고른 `CAD 정합`을
   * 목업 공장으로 들고 오면 어느 세그먼트도 켜지지 않은 채 범례만 그 규칙을 말한다.
   * 그래서 **양쪽 방향 모두** 지금 목록 안의 값으로 끌어내린다.
   */
  useEffect(() => {
    if (!colorOptions.some((option) => option.value === colorMode)) {
      setColorMode(displayMode === 'cad' ? 'plain' : colorOptions[0].value)
    }
  }, [colorOptions, colorMode, displayMode])

  /*
   * 표시 옵션은 정반 뷰(뷰어 위 가로줄)와 공장 뷰(뷰어 옆 세로 열) 두 자리에 서고,
   * 자리마다 배치만 다르다 — 그래서 엘리먼트가 아니라 props 를 나눠 쓴다.
   */
  const viewerControlProps = {
    displayMode,
    colorMode,
    showOutline,
    onDisplayModeChange: handleDisplayModeChange,
    onColorModeChange: setColorMode,
    onShowOutlineChange: setShowOutline,
    colorOptions,
  }
  useEffect(() => {
    setSelectedBlockId(null)
  }, [locationId, factoryId])

  // 트리·정반 그리드용 기준 데이터 (공장 전체 + 위치 전체)
  const {
    data: base,
    loading: baseLoading,
    error: baseError,
  } = useAsyncData(
    () =>
      Promise.all([fetchFactories(), fetchLocations()]).then(([factories, locations]) => ({
        factories,
        locations,
      })),
    []
  )

  // 공장 레벨: 소속 정반 전체의 센서/인식 데이터 (공장 전체 센서퓨전 뷰용)
  const { data: factoryScene, loading: factorySceneLoading } = useAsyncData(async (): Promise<{
    factoryId: string
    bays: BaySceneData[]
  } | null> => {
    if (!factoryId || locationId) return null
    const locations = await fetchLocations(factoryId)
    const bays = await Promise.all(
      locations.map(async (location) => ({
        location,
        sensors: await fetchLidarSensors(location.id),
        blocks: await fetchDetectedBlocks(location.id),
        bayModel: await fetchBayModel(location.id),
      }))
    )
    return { factoryId, bays }
  }, [factoryId, locationId])

  // 정반 레벨: 선택된 정반의 센서 상태 + 인식 결과
  const { data: detail, loading: detailLoading } = useAsyncData(
    () =>
      locationId
        ? Promise.all([
            fetchLidarSensors(locationId),
            fetchDetectedBlocks(locationId),
            fetchBayModel(locationId),
          ]).then(([sensors, blocks, bayModel]) => ({ locationId, sensors, blocks, bayModel }))
        : Promise.resolve(null),
    [locationId]
  )

  /*
   * 로딩 표시는 조금 늦게 낸다 — 150ms 만에 끝나는 요청에 스피너를 띄우면
   * 그 깜박임이 오히려 로딩보다 눈에 띈다.
   */
  const showBaseSpinner = useDelayedFlag(baseLoading)
  const showDetailSpinner = useDelayedFlag(detailLoading)
  const showFactorySpinner = useDelayedFlag(factorySceneLoading)

  const factory = base?.factories.find((f) => f.id === factoryId)
  const factoryLocations = useMemo(
    () => (base && factory ? base.locations.filter((loc) => loc.factoryId === factory.id) : []),
    [base, factory]
  )
  const selectedLocation = locationId
    ? factoryLocations.find((loc) => loc.id === locationId)
    : undefined

  /**
   * 그려진 장면은 URL 이 아니라 **불러온 데이터**를 따른다.
   * 새 정반을 부르는 동안에도 이전 장면이 그대로 서 있어야 화면이 깜박이지 않는다.
   */
  const loadedLocation = detail
    ? base?.locations.find((loc) => loc.id === detail.locationId)
    : undefined

  const bayScene = useMemo<BaySceneData[] | null>(
    () =>
      detail && loadedLocation
        ? [
            {
              location: loadedLocation,
              sensors: detail.sensors,
              blocks: detail.blocks,
              bayModel: detail.bayModel,
            },
          ]
        : null,
    [detail, loadedLocation]
  )

  if (baseLoading && !base) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        {showBaseSpinner && <Spinner size={28} className="text-accent" />}
      </div>
    )
  }
  if (baseError || !base) {
    return <p className="text-status-unhealthy">{t('common.loadFailed')}</p>
  }
  if (!factory) {
    return <NotFoundNotice message={t('assembly.workspace.unknownFactory')} />
  }
  if (locationId && !selectedLocation) {
    return <NotFoundNotice message={t('assembly.workspace.unknownLocation')} />
  }

  const selectedBlock =
    selectedBlockId && detail ? detail.blocks.find((b) => b.id === selectedBlockId) : undefined

  return (
    /*
     * 이 화면은 문서가 아니라 계기판이다 — 넓은 화면에서는 뷰포트에 딱 맞춰 고정하고,
     * 넘치는 목록은 페이지가 아니라 각 패널이 안에서 스크롤한다.
     */
    <div className="flex flex-col gap-5 xl:h-full xl:min-h-0 xl:gap-3">
      <FixedViewport />

      {/*
        머리글은 한 줄이다 — 제목(좌) + 식별 정보(우).

        페이지 자체 경로 표기('조립 > 조립 1공장 > 1번 베이')는 없앴다. 툴바가 이미
        같은 경로를 내고 있고, 공장·정반 전환은 3D 상자의 탭과 유리 도구줄이 맡는다 —
        세 곳에서 같은 말을 하면 그만큼 뷰어 높이만 줄어든다.
      */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h1 className="min-w-0 truncate text-inshop-lg font-semibold text-foreground">
          {selectedLocation
            ? t('assembly.workspace.bayTitle', { name: selectedLocation.name })
            : t('assembly.workspace.factoryTitle', { name: factory.displayName })}
        </h1>

        {/*
          정반·호선·블록은 이 화면의 좌표다 — 값만 이어 붙이면 어느 숫자가 무엇인지
          매번 다시 읽어야 하므로, 값마다 작은 이름표를 앞에 붙여 한 줄로 세운다.
        */}
        {selectedLocation ? (
          <BayIdentityBar
            location={selectedLocation}
            blocks={detail?.locationId === selectedLocation.id ? detail.blocks : []}
            manifest={
              detail?.locationId === selectedLocation.id
                ? (detail.bayModel?.model.manifest ?? null)
                : null
            }
            className="min-w-0 flex-1 sm:flex-none"
          />
        ) : (
          /* 공장 뷰에서는 이 줄의 오른쪽이 비어 있다 — 링크를 여기 세우면 아래가 한 줄 줄어든다 */
          <Link
            to={`/indoorshop/zones/assembly/${factory.id}/production`}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-inshop-md border border-border px-3 text-inshop-xs font-medium text-foreground/75 transition-colors hover:border-accent/50 hover:text-accent"
          >
            {t('assembly.workspace.dailyProductionLink')}
          </Link>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6 xl:min-h-0 xl:flex-1 xl:gap-4">
        {selectedLocation ? (
          // ── 정반 레벨: 센서 상태 / PCD 뷰어(+블록 선택 패널) / 인식 목록 ──
          !detail || !bayScene ? (
            /* 첫 진입 — 장면은 아직 없지만 탭과 상자는 자리에 선다 (기다리는 동안에도 갈아탈 수 있어야 한다) */
            <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
              <AssemblyLocationTabs
                factories={base.factories}
                locations={base.locations}
                currentFactoryId={factory.id}
                tone="attached"
                parts="factories"
                attachedColors={viewportEdge}
                className="shrink-0"
              />
              <div
                style={{ background: viewportEdge.background }}
                className="flex h-[72vh] min-h-[480px] w-full items-center justify-center rounded-inshop-lg border border-border xl:h-auto xl:min-h-0 xl:flex-1"
              >
                {showDetailSpinner && <Spinner size={26} label={t('viewer.loadingDetection')} className="text-accent" />}
              </div>
            </div>
          ) : (
            <>
              {/*
                뷰어(가운데) + 인식 목록(오른쪽 패널) — 넓은 화면에서만 갈라진다.
                폭은 CSS 변수로만 내보낸다: 좁은 화면에서는 두 칸이 위아래로 쌓이므로
                그때는 xl 분기가 통째로 꺼져 이 값을 참조하지 않는다.
              */}
              <div
                ref={splitRef}
                style={{ '--list-w': `${listWidth}px` } as CSSProperties}
                className="flex flex-col gap-6 xl:min-h-0 xl:flex-1 xl:flex-row xl:gap-0"
              >
                <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
                  {/* 공장 전환은 여기서도 3D 상자에 붙은 탭이다 — 화면 사이를 오가도 문법이 같다 */}
                  <AssemblyLocationTabs
                    factories={base.factories}
                    locations={base.locations}
                    currentFactoryId={factory.id}
                    tone="attached"
                    parts="factories"
                    attachedColors={viewportEdge}
                    className="shrink-0"
                  />
                  <div
                    ref={viewportRef}
                    // 전체 화면에서는 이 칸이 곧 화면이다 — 지금 팔레트의 바탕을 직접 칠한다
                    style={isFullscreen ? { background: viewportEdge.background } : undefined}
                    className={cn(
                      'relative xl:min-h-0 xl:flex-1',
                      // 경계를 끄는 동안 3D 가 포인터를 가져가면 궤도가 같이 돌아간다
                      resizingList && '[&_canvas]:pointer-events-none',
                    )}
                  >
                    {realFactory ? (
                      <RealScanViewer
                        key={detail.locationId}
                        mode="bay"
                        locationId={detail.locationId}
                        blocks={detail.blocks}
                        selectedBlockId={selectedBlockId}
                        displayMode={displayMode}
                        colorMode={colorMode}
                        showOutline={showOutline}
                        onSelectBlock={setSelectedBlockId}
                        className={viewerSizeClass}
                      />
                    ) : (
                      <LidarPointCloudViewer
                        key={detail.locationId}
                        mode="bay"
                        bays={bayScene}
                        selectedBlockId={selectedBlockId}
                        displayMode={displayMode}
                        colorMode={colorMode}
                        showOutline={showOutline}
                        onSelectBlock={setSelectedBlockId}
                        className={viewerSizeClass}
                      />
                    )}
                    {/*
                      왼쪽 위는 유리 도구줄(정반 전환·표시 옵션) 자리다. 블록 상세는
                      그 **아래에 이어 붙인다** — 절대좌표 둘을 겹치면 도구줄 높이가
                      바뀔 때마다 상세의 자리를 다시 재야 한다.
                    */}
                    <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-5rem)] flex-col items-start gap-2">
                      <ViewportToolbar
                        title={t('assembly.workspace.registeredCloud')}
                        hint={t('assembly.workspace.registeredCloudHint')}
                        nav={
                          <AssemblyLocationTabs
                            factories={base.factories}
                            locations={base.locations}
                            currentFactoryId={factory.id}
                            currentLocationId={selectedLocation.id}
                            highlightedId={highlightedBayId}
                            onHighlight={setHighlightedBayId}
                            tone="glass"
                            parts="bays"
                          />
                        }
                        className="static max-w-none"
                      >
                        <PointCloudViewControls {...viewerControlProps} tone="glass" />
                        {/*
                          라이다 센서 줄 — 표시 옵션 바로 아래가 제 자리다.
                          센서 칩의 색이 곧 점군의 점 색이라(SENSOR_POINT_COLORS),
                          색을 고르는 줄과 그 색의 주인이 붙어 있어야 짝으로 읽힌다.
                        */}
                        <LidarSensorStatusList
                          sensors={detail.sensors}
                          pointColors={SENSOR_POINT_COLORS}
                          tone="glass"
                        />
                      </ViewportToolbar>
                      {selectedBlock && (
                        <BlockDetailOverlay block={selectedBlock} className="static w-64" />
                      )}
                    </div>
                    {/* 왼쪽 위는 도구줄이 쓴다 — 범례는 오른쪽 위(도구 묶음 아래)로 */}
                    {!viewerOwnsLegend && (
                      <PointCloudLegend colorMode={colorMode} className="left-auto right-4 top-14" />
                    )}
                    <ViewportHelp />
                    {showDetailSpinner && <SpinnerOverlay label={t('viewer.loadingDetection')} />}
                    {/*
                      블록을 고르면 뷰어는 그 블록만 비추고, 상세는 오른쪽 목록의
                      제 카드가 맡는다 — 뷰어 위에 상세 패널을 띄우면 카드가
                      뷰어 높이보다 길어 아래가 잘려 나간다.
                    */}
                    {/* 우상단 도구 묶음 — 늘어놓지 않고 한 줄로 모은다 */}
                    <div className="absolute right-4 top-4 flex items-center gap-2">
                      {selectedBlock && (
                        <button
                          type="button"
                          onClick={() => setSelectedBlockId(null)}
                          className={cn(
                            'flex h-7 items-center gap-1.5 rounded-inshop-md px-2',
                            'glass-panel text-2xs font-medium',
                            'transition-colors hover:bg-glass-hover hover:text-glass-accent',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
                          )}
                        >
                          <span className="font-mono">{formatDetectionId(selectedBlock)}</span>
                          <span className="text-glass-foreground/54">{t('viewer.backToAll')}</span>
                        </button>
                      )}
                      {fullscreenSupported && (
                        <ViewportFullscreenButton
                          isFullscreen={isFullscreen}
                          onToggle={toggleFullscreen}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <ResizeHandle
                  {...separatorProps}
                  dragging={resizingList}
                  className="hidden xl:block"
                />

                <div className="flex min-w-0 flex-col xl:min-h-0 xl:w-[var(--list-w)] xl:shrink-0">
                  <h2 className="mb-3 shrink-0 text-inshop-base font-semibold text-foreground">
                    {t('blocks.listTitle')}{' '}
                    <span className="font-normal text-foreground/54">{detail.blocks.length}</span>
                  </h2>
                  {/* 목록만 안에서 구른다 — 뷰어와 센서 줄은 자리에 남는다 */}
                  <div
                    className={cn(
                      /*
                       * 고른 카드는 ring-2 + ring-offset-2 로 바깥 4px 에 링을 그린다. overflow
                       * 컨테이너는 padding box 밖을 잘라내므로, 여백이 없는 쪽(아래·왼쪽·위)과
                       * 스크롤바가 차지하는 오른쪽에서 링이 끊긴다. 링만큼 사방에 여백을 주고
                       * 같은 크기의 음수 마진으로 되돌려 보이는 위치는 그대로 둔다.
                       */
                      'transition-opacity xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-1.5',
                      showDetailSpinner && 'opacity-50',
                    )}
                  >
                    <DetectedBlockList
                      blocks={detail.blocks}
                      model={detail.bayModel?.model ?? null}
                      onSelectBlock={setSelectedBlockId}
                      selectedBlockId={selectedBlockId}
                      className="xl:grid-cols-1"
                    />
                  </div>
                </div>
              </div>
            </>
          )
        ) : (
          /*
           * ── 공장 레벨: 공장 전체 센서퓨전 뷰 ──
           * 정반 선택은 상단 탭과 3D 라벨이 이미 맡고 있어서 목록을 따로 두지 않는다 —
           * 같은 선택지를 세 군데 두면 화면만 좁아진다.
           *
           * 제목·안내·표시 옵션도 뷰어 위에 쌓지 않고 **뷰포트 안에 겹쳐** 띄운다
           * (ViewportToolbar). 이 화면에서 세로는 곧 뷰어의 시야라, 문구 세 줄이
           * 그대로 3D 의 높이에서 빠진다 — 3D 가 칸을 통째로 쓰게 두고 도구가 그 위에 뜬다.
           *
           * 공장 전환만은 예외로 밖에 둔다 — 3D 상자의 **윗모서리에 붙은 탭**이다.
           * 보고 있는 것을 바꾸는 일은 3D 위에 뜬 도구가 아니라 창 자체를 갈아 끼우는
           * 일이라, 탭이 창에 붙어 있어야 그 뜻이 그대로 보인다.
           */
          <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
            <AssemblyLocationTabs
              factories={base.factories}
              locations={base.locations}
              currentFactoryId={factory.id}
              tone="attached"
              parts="factories"
              attachedColors={viewportEdge}
              className="shrink-0"
            />
            <div
              ref={viewportRef}
              style={isFullscreen ? { background: viewportEdge.background } : undefined}
              className="relative min-w-0 xl:min-h-0 xl:flex-1"
            >
              {/*
                장면이 아직 없어도 칸과 도구줄은 자리에 남는다 — 불러오는 동안
                공장을 못 바꾸면, 잘못 들어온 사람은 기다렸다가 다시 눌러야 한다.
              */}
              {!factoryScene ? (
                <div
                  style={{ background: viewportEdge.background }}
                  className={cn('w-full rounded-inshop-lg border border-border', viewerSizeClass)}
                />
              ) : realFactory ? (
                <RealScanViewer
                  key={factoryScene.factoryId}
                  mode="factory"
                  bayLocations={factoryLocations}
                  displayMode={displayMode}
                  colorMode={colorMode}
                  showOutline={showOutline}
                  onSelectBay={(locId) => navigate(`/indoorshop/zones/assembly/${factory.id}/${locId}`)}
                  highlightedBayId={highlightedBayId}
                  onHoverBay={setHighlightedBayId}
                  className={viewerSizeClass}
                />
              ) : (
                <LidarPointCloudViewer
                  key={factoryScene.factoryId}
                  mode="factory"
                  bays={factoryScene.bays}
                  displayMode={displayMode}
                  colorMode={colorMode}
                  showOutline={showOutline}
                  onSelectBay={(locId) => navigate(`/indoorshop/zones/assembly/${factory.id}/${locId}`)}
                  highlightedBayId={highlightedBayId}
                  onHoverBay={setHighlightedBayId}
                  className={viewerSizeClass}
                />
              )}
              <ViewportToolbar
                title={t('assembly.workspace.factoryFusion')}
                hint={t('assembly.workspace.factoryFusionHint')}
                nav={
                  <AssemblyLocationTabs
                    factories={base.factories}
                    locations={base.locations}
                    currentFactoryId={factory.id}
                    highlightedId={highlightedBayId}
                    onHighlight={setHighlightedBayId}
                    tone="glass"
                    parts="bays"
                  />
                }
              >
                <PointCloudViewControls {...viewerControlProps} tone="glass" />
              </ViewportToolbar>
              {/* 왼쪽 위는 도구줄이 쓴다 — 범례는 전체 화면 버튼 아래로 비켜 세운다 */}
              {factoryScene && !viewerOwnsLegend && (
                <PointCloudLegend colorMode={colorMode} className="left-auto right-4 top-14" />
              )}
              {factoryScene && <ViewportHelp />}
              {fullscreenSupported && (
                <ViewportFullscreenButton
                  isFullscreen={isFullscreen}
                  onToggle={toggleFullscreen}
                  className="absolute right-4 top-4"
                />
              )}
              {showFactorySpinner && <SpinnerOverlay label={t('viewer.loadingFusion')} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
