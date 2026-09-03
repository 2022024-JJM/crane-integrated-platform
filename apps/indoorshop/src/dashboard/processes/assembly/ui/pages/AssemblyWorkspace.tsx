import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import { formatDetectionId } from '../../../../shared/features/bay-viewer/model/lidarBlock'
import { AssemblyLocationTabs } from '../AssemblyLocationTabs'
import { BayIdentityBar } from '../BayIdentityBar'
import { DetectedBlockList } from '../block-detail/DetectedBlockList'
import { BlockDetailOverlay } from '../block-detail/BlockDetailOverlay'
import { LidarSensorStatusList } from '../LidarSensorStatusList'
import { BayDetailPanel } from '../BayDetailPanel'
import { FirstRunHint } from '../../../../shared/features/bay-viewer/ui/FirstRunHint'
import { LidarPointCloudViewer } from '../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import type { BaySceneData } from '../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { RealScanViewer } from '../viewer/RealScanViewer'
import { SENSOR_POINT_COLORS } from '../../../../shared/features/bay-viewer/lib/bayConfig'
import { PointCloudViewControls } from '../../../../shared/features/bay-viewer/ui/PointCloudViewControls'
import { PointCloudLegend } from '../../../../shared/features/bay-viewer/ui/PointCloudLegend'
import { ViewportHelp } from '../../../../shared/features/bay-viewer/ui/ViewportHelp'
import { ViewportToolbar } from '../../../../shared/features/bay-viewer/ui/ViewportToolbar'
import { ViewportFullscreenButton } from '../../../../shared/ui/atoms/ViewportFullscreenButton'
import { viewportEdgeColors, type ViewerDisplayMode } from '../../../../shared/features/bay-viewer/lib/displayModes'
import {
  colorModesFor,
  reconcileColorMode,
  REAL_PCD_COLOR_MODES,
  REAL_CAD_COLOR_MODES,
  type PointColorMode,
} from '../../../../shared/features/bay-viewer/lib/colorModes'
import {
  worstSensorStatus,
  bayWorkState,
  bayStage,
} from '../../../../shared/features/bay-viewer/lib/bayStatusSummary'
import {
  DEFAULT_BAY_FILTER,
  bayPassesFilter,
  type BayFilter,
} from '../../lib/bayFilters'
import { latestScan, isViewDelayed } from '../../../../shared/features/bay-viewer/lib/freshness'
import { useAxisNow } from '../../../../shared/lib/useBaseDate'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { useFullscreen } from '../../../../shared/lib/useFullscreen'
import { useDelayedFlag } from '../../../../shared/lib/useDelayedFlag'
import { cn } from '../../../../shared/lib/utils'
import { Spinner, SpinnerOverlay } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { judgingAssysAt } from '../../lib/judgingAssys'
import { JudgingAssyList } from '../JudgingAssyList'
import { todayString } from '../../../../shared/features/performance/lib/baseDate'
import {
  fetchFactories,
  fetchLocations,
  fetchLidarSensors,
  fetchDetectedBlocks,
  fetchBayModel,
  fetchFactoryLayout,
} from '../../api/assemblyApi'
import type { FactoryLayout } from '../../../../shared/features/bay-viewer/lib/bayLayout'
import { fetchRealScanOverlay, isRealLocation, REAL_SEGMENTS } from '../../api/realScanData'

/** 실측 스캔의 기본 색상 규칙 — 이 화면이 먼저 답해야 할 질문이 "정합됐나" 이다 */
const REAL_DEFAULT_COLOR_MODE: PointColorMode = REAL_PCD_COLOR_MODES[0].value

/**
 * 워크스페이스 축 탭 — 한 화면에 섞여 있던 ②3D 뷰어 / ①센서 상태 / ③블록·실적을
 * 표준 탭으로 가른다(P-(C) 공정층). 기본은 3D 뷰어 — 현행 주 사용성을 그대로 둔다.
 * 각 탭은 기존 컴포넌트의 **재배치**다: 뷰어 탭은 순수 뷰어(전폭), 센서·블록은
 * 뷰어 옆·위에 겹쳐 있던 패널들이 제 축의 전면으로 나온 것이다.
 */
type WorkspaceTab = 'viewer' | 'sensors' | 'blocks'
const WORKSPACE_TABS: { key: WorkspaceTab; labelKey: 'assembly.workspace.tabViewer' | 'assembly.workspace.tabSensors' | 'assembly.workspace.tabBlocks' }[] = [
  { key: 'viewer', labelKey: 'assembly.workspace.tabViewer' },
  { key: 'sensors', labelKey: 'assembly.workspace.tabSensors' },
  { key: 'blocks', labelKey: 'assembly.workspace.tabBlocks' },
]

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
  /** 지금 보는 정반이 실측 스캔인가(PBS 5BAY) — 색상 규칙의 기본값·선택지가 목업과 다르다.
   * 공장 뷰는 이제 항상 목업 뷰어다: 실측은 공장이 아니라 베이 하나에 붙어 있다. */
  const realView = isRealLocation(locationId)

  /** 축 탭 — 공장·정반을 옮기면 기본(3D 뷰어)으로 돌아온다 (탭은 그 자리의 것이다) */
  const [workTab, setWorkTab] = useState<WorkspaceTab>('viewer')
  useEffect(() => {
    setWorkTab('viewer')
  }, [factoryId, locationId])

  /** 베이 화면에서 라벨/카드 클릭으로 선택된 블록 — 선택 시 뷰어가 블록 단독 뷰로 전환 */
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  /** LiDAR 카드 클릭 시 같은 센서 재클릭도 카메라 요청으로 전달한다. */
  const [sensorFocus, setSensorFocus] = useState<{
    id: string | null
    index: number
    request: number
  } | null>(null)
  useEffect(() => {
    setSensorFocus(null)
  }, [factoryId, locationId])
  useEffect(() => {
    if (!sensorFocus?.id) return

    const resetSensorFocus = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-lidar-sensor-panel]')) return
      setSensorFocus((current) =>
        current?.id ? { id: null, index: -1, request: current.request + 1 } : current
      )
    }

    document.addEventListener('pointerdown', resetSensorFocus)
    return () => document.removeEventListener('pointerdown', resetSensorFocus)
  }, [sensorFocus?.id])
  /** 목록에서 가리키는 중인 정반 — 3D 뷰의 강조와 같은 값을 공유한다 */
  const [highlightedBayId, setHighlightedBayId] = useState<string | null>(null)
  /**
   * 공장 뷰의 지속 선택 정반 (FR-5) — 클릭 선택은 hover 와 달리 유지된다.
   * 선택 대상은 강하게, 동일 공정 정반은 중간, 무관한 정반은 낮게 가라앉는다.
   */
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null)
  /** 공장 뷰 정반 필터 (FR-9) — 걸린 정반은 맵에서 가라앉고 상세 패널 목록에서 접힌다 */
  const [bayFilter, setBayFilter] = useState<BayFilter>(DEFAULT_BAY_FILTER)
  /** `선택 정반 맞춤` 재요청 신호 (FR-8) — 상세 카드 버튼이 올리고 뷰어가 듣는다 */
  const [fitRequest, setFitRequest] = useState(0)
  /**
   * 뷰어 표시 상태 — 소유자는 뷰어가 아니라 이 화면이다.
   * 표시 모드가 바뀌면 색상 규칙도 함께 조정해야 하는데, 그 규칙은 뷰어가 아니라
   * 상태 소유자가 알아야 할 일이기 때문이다.
   */
  const [displayMode, setDisplayMode] = useState<ViewerDisplayMode>('overlay')
  const [colorMode, setColorMode] = useState<PointColorMode>(
    realView ? REAL_DEFAULT_COLOR_MODE : 'sensor'
  )
  const [showOutline, setShowOutline] = useState(true)
  /** CAD 모드에 들어가기 직전에 쓰던 점군 규칙 — 나올 때 되돌린다 */
  const rememberedColorMode = useRef<PointColorMode>(
    realView ? REAL_DEFAULT_COLOR_MODE : 'sensor'
  )

  /* 분할 리사이저는 없다 — 축 탭 분해로 뷰어 탭이 전폭을 쓰고, 목록·패널은 제 탭에서 전면이다 */

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
      reconcileColorMode(next, current, rememberedColorMode.current, realView)
    )
    setDisplayMode(next)
  }

  /*
   * 실측 정반은 색상 선택지가 좁다 — 목업 정반에서 고른 규칙(객체·진척)을 들고
   * 넘어오면 유효한 규칙으로 끌어내린다. 옵션 목록(아래 colorOptions)과 짝이다.
   */
  const realColorOptions = displayMode === 'cad' ? REAL_CAD_COLOR_MODES : REAL_PCD_COLOR_MODES
  /* 지금 화면에서 실제로 고를 수 있는 규칙 — 아래 정리(useEffect)와 컨트롤이 같은 목록을 본다 */
  const colorOptions = realView ? realColorOptions : colorModesFor(displayMode)
  /*
   * `CAD 정합` 규칙에서는 뷰어가 **블록별** 범례를 직접 낸다 (색이 13종이라 일반 범례로는
   * 무슨 색이 무슨 블록인지 답이 안 된다). 둘을 같이 띄우면 같은 자리에 겹친다.
   */
  const viewerOwnsLegend = realView && colorMode === 'match' && displayMode !== 'cad'
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
    setSelectedBayId(null)
    setBayFilter(DEFAULT_BAY_FILTER)
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
    layout: FactoryLayout
  } | null> => {
    if (!factoryId || locationId) return null
    const [locations, layout] = await Promise.all([
      fetchLocations(factoryId),
      // 베이 배치는 데이터 계층이 소유한다 (FR-3) — 뷰어는 받은 좌표를 그릴 뿐이다
      fetchFactoryLayout(factoryId),
    ])
    const bays = await Promise.all(
      locations.map(async (location) => ({
        location,
        sensors: await fetchLidarSensors(location.id),
        /* 실측 정반(PBS 5BAY)의 블록도 그대로 싣는다 — bayModel 이 없어 뷰어가 형상을
         * 그리지는 않지만(좌표 프레임이 달라 그리면 안 되기도 하다), 작업 판정과 건수가
         * 이 목록에서 나와 목록·드릴다운·공장 뷰가 같은 재실 상태를 말하게 된다(R 진단).
         * 한 정반의 인식 조회 실패(실측 자산 미생성 등)가 공장 뷰 전체를 무너뜨리지
         * 않도록 그 정반만 빈 목록으로 둔다. */
        blocks: await fetchDetectedBlocks(location.id).catch(() => []),
        bayModel: await fetchBayModel(location.id),
        /* 실측 정반 판정은 조립 데이터 계층의 몫 — 뷰어(shared)는 플래그만 받는다 */
        realScan: isRealLocation(location.id),
        /* 실측 정반의 프리뷰 점군 + 실측 센서 자리 — 앵커(벽선) 게이트 미통과·자산
         * 부재면 null 로 남아 W0-2 의 빈 정반+실측 칩 폴백이 그대로 선다 */
        realOverlay: isRealLocation(location.id)
          ? await fetchRealScanOverlay().catch(() => null)
          : null,
      }))
    )
    return { factoryId, bays, layout }
  }, [factoryId, locationId])

  // 정반 레벨: 선택된 정반의 센서 상태 + 인식 결과
  /*
   * 이 공장에서 지금 판별 중인 ASSY (W7-7-5) — 소재는 로스터, 실적은 통합실적에서 온다.
   * 기준일은 마운트 때 한 번 굳힌다(매 렌더 새 날짜를 만들면 조회가 계속 다시 돈다).
   */
  const [judgingBaseDate] = useState(() => todayString())
  const { data: judgingAssys, loading: judgingLoading } = useAsyncData(
    () => judgingAssysAt(factoryId ?? '', judgingBaseDate),
    [factoryId, judgingBaseDate]
  )

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

  // 경과 판정이 굳지 않도록 30초마다 다시 계산한다 (FR-9 데이터 지연)
  const now = useAxisNow(30000)

  /** 필터에 걸린 정반 (FR-9) — 뷰어는 이 집합을 받아 가라앉히기만 한다 */
  const dimmedBayIds = useMemo(() => {
    if (!factoryScene) return null
    const dimmed = new Set<string>()
    for (const bay of factoryScene.bays) {
      const sensorStatus = worstSensorStatus(bay.sensors)
      const passes = bayPassesFilter(
        {
          sensorStatus,
          workState: bayWorkState(bay.sensors, bay.blocks),
          stage: bayStage(bay.blocks),
        },
        bayFilter
      )
      if (!passes) dimmed.add(bay.location.id)
    }
    return dimmed.size > 0 ? dimmed : null
  }, [factoryScene, bayFilter])

  /** 공장 전체에서 가장 신선한 수신 — `데이터 지연` 배너(FR-9)의 근거 */
  const factoryFreshness = useMemo(
    () => (factoryScene ? latestScan(factoryScene.bays.flatMap((bay) => bay.sensors), now) : null),
    [factoryScene, now]
  )
  const factoryDelayed = factoryScene
    ? isViewDelayed(factoryFreshness) || factoryFreshness === null
    : false

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

      {/* 축 탭 — ②뷰어 / ①센서 / ③블록·실적. 공장 전환 탭(3D 상자 부착)과 역할이 다르다:
          저것은 "무엇을 보나(공장)", 이것은 "어느 축으로 보나"다. */}
      <div
        role="tablist"
        aria-label={t('assembly.workspace.tabAria')}
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
        {selectedLocation ? (
          // ── 정반 레벨 ──
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
          ) : workTab === 'viewer' ? (
            /* ② 3D 뷰어 — 순수 뷰어(전폭). 센서 목록·블록 목록은 제 축의 탭으로 갔다.
               유리 도구줄·범례·선택 블록 카드는 뷰어의 조작 부속이라 남는다. */
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
                // 전체 화면에서는 이 칸이 곧 화면이다 — 지금 팔레트의 바탕을 직접 칠한다
                style={isFullscreen ? { background: viewportEdge.background } : undefined}
                className="relative xl:min-h-0 xl:flex-1"
              >
                {realView ? (
                  <RealScanViewer
                    key={detail.locationId}
                    mode="bay"
                    locationId={detail.locationId}
                    bayLocations={REAL_SEGMENTS}
                    blocks={detail.blocks}
                    selectedBlockId={selectedBlockId}
                    displayMode={displayMode}
                    colorMode={colorMode}
                    showOutline={showOutline}
                    onSelectBlock={setSelectedBlockId}
                    className={viewerSizeClass}
                    sensorFocus={sensorFocus}
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
                    sensorFocus={sensorFocus}
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
                  </ViewportToolbar>
                  {selectedBlock && (
                    <BlockDetailOverlay block={selectedBlock} className="static w-64" />
                  )}
                </div>
                {/* 왼쪽 위는 도구줄이 쓴다 — 범례는 오른쪽 위(도구 묶음 아래)로 */}
                {!viewerOwnsLegend && (
                  <PointCloudLegend colorMode={colorMode} className="left-auto right-4 top-14" />
                )}
                {showDetailSpinner && <SpinnerOverlay label={t('viewer.loadingDetection')} />}
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
                  <ViewportHelp className="static flex-col-reverse" />
                  {fullscreenSupported && (
                    <ViewportFullscreenButton
                      isFullscreen={isFullscreen}
                      onToggle={toggleFullscreen}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : workTab === 'sensors' ? (
            /* ① 센서 상태 — 뷰어 구석의 유리 패널이 아니라 제 축의 전면이다.
               센서를 누르면 3D 가 그 센서로 날아가야 뜻이 있으므로 뷰어 탭으로 넘긴다. */
            <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:flex-1">
              <p className="shrink-0 text-inshop-xs text-foreground/55">
                {t('assembly.workspace.sensorTabHint')}
              </p>
              <div className="xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-1.5">
                <LidarSensorStatusList
                  sensors={detail.sensors}
                  pointColors={SENSOR_POINT_COLORS}
                  className="max-w-xl"
                  selectedSensorId={sensorFocus?.id}
                  onSelectSensor={(id, index) => {
                    setSensorFocus((current) => ({
                      id,
                      index,
                      request: (current?.request ?? 0) + 1,
                    }))
                    setWorkTab('viewer')
                  }}
                />
              </div>
            </div>
          ) : (
            /* ③ 블록·실적 — 인식 목록이 옆구리 패널이 아니라 전면이다. 실적의 다음
               단계(일일 생산)는 여기서 나간다. */
            <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:flex-1">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <h2 className="text-inshop-base font-semibold text-foreground">
                  {t('blocks.listTitle')}{' '}
                  <span className="font-normal text-foreground/54">{detail.blocks.length}</span>
                </h2>
                <Link
                  to={`/indoorshop/zones/assembly/${factory.id}/production`}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-inshop-md border border-border px-3 text-inshop-xs font-medium text-foreground/75 transition-colors hover:border-accent/50 hover:text-accent"
                >
                  {t('assembly.workspace.dailyProductionLink')}
                </Link>
              </div>
              <div className="xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:p-1.5">
                <DetectedBlockList
                  blocks={detail.blocks}
                  model={detail.bayModel?.model ?? null}
                  onSelectBlock={setSelectedBlockId}
                  selectedBlockId={selectedBlockId}
                />
              </div>
            </div>
          )
        ) : workTab === 'viewer' ? (
          /*
           * ── 공장 레벨 ② 3D 뷰어 — 공장 전체 센서퓨전, 전폭 ──
           * 정반 선택은 상단 탭과 3D 라벨이 맡는다. 정반 상세 패널(FR-8)은 ③ 탭으로 갔다.
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
              ) : (
                <LidarPointCloudViewer
                  key={factoryScene.factoryId}
                  mode="factory"
                  bays={factoryScene.bays}
                  layout={factoryScene.layout}
                  displayMode={displayMode}
                  colorMode={colorMode}
                  showOutline={showOutline}
                  selectedBayId={selectedBayId}
                  onBaySelect={setSelectedBayId}
                  onOpenBay={(locId) => navigate(`/indoorshop/zones/assembly/${factory.id}/${locId}`)}
                  highlightedBayId={highlightedBayId}
                  onHoverBay={setHighlightedBayId}
                  dimmedBayIds={dimmedBayIds}
                  fitRequest={fitRequest}
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
              <div className="absolute right-4 top-4 z-10 flex items-start gap-2">
                {factoryScene && <ViewportHelp className="static flex-col-reverse" />}
                {fullscreenSupported && (
                  <ViewportFullscreenButton
                    isFullscreen={isFullscreen}
                    onToggle={toggleFullscreen}
                  />
                )}
              </div>
              {/*
                데이터 지연 (FR-9) — 마지막 값이 정상처럼 보이지 않게 뷰 전체에 알린다.
                수신 이력 자체가 없으면 `미수신`으로 구분해 말한다 (FR-2 의 구분과 동일).
              */}
              {factoryDelayed && (
                <div
                  role="status"
                  className="pointer-events-none absolute left-1/2 top-12 z-10 -translate-x-1/2 whitespace-nowrap rounded-inshop-md glass-panel px-2.5 py-1 text-2xs font-medium text-glass-degraded ring-1 ring-glass-degraded/50"
                >
                  {factoryFreshness
                    ? t('viewer.dataDelay', { time: factoryFreshness.time })
                    : t('viewer.dataNone')}
                </div>
              )}
              {/* 첫 진입 조작 힌트 (FR-9) — 한 번만, 이후에는 `조작 ?` 도움말이 맡는다 */}
              {factoryScene && (
                <FirstRunHint className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2" />
              )}
              {showFactorySpinner && <SpinnerOverlay label={t('viewer.loadingFusion')} />}
            </div>
          </div>
        ) : !factoryScene ? (
          /* 센서·블록 탭도 장면 데이터가 재료다 — 오는 동안 자리만 지킨다 */
          <div className="flex h-[50vh] items-center justify-center rounded-inshop-lg border border-border">
            {showFactorySpinner && <Spinner size={24} className="text-accent" />}
          </div>
        ) : workTab === 'sensors' ? (
          /* ① 공장 센서 상태 — 정반마다 한 장씩, 전면 격자 */
          <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:flex-1">
            <p className="shrink-0 text-inshop-xs text-foreground/55">
              {t('assembly.workspace.sensorTabFactoryHint')}
            </p>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 xl:-m-1.5 xl:min-h-0 xl:flex-1 xl:content-start xl:overflow-y-auto xl:p-1.5">
              {factoryScene.bays.map((bay) => (
                <section key={bay.location.id} className="rounded-inshop-lg border border-border p-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-inshop-sm font-semibold text-foreground">{bay.location.name}</h3>
                    <span className="font-mono text-2xs text-foreground/50">
                      {bay.location.workCntr}
                    </span>
                  </div>
                  <LidarSensorStatusList sensors={bay.sensors} pointColors={SENSOR_POINT_COLORS} />
                </section>
              ))}
            </div>
          </div>
        ) : (
          /* ③ 공장 블록·실적 — 정반 상세 패널(작업 상태·필터)이 전면이다.
             일일 생산 링크는 머리글(공장 뷰 상시)이 이미 낸다 — 같은 문을 두 번 세우지 않는다 */
          <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:flex-1">
            {/* 이 공장에서 지금 붙이고 있는 것 — 정반이 '무엇이 서 있나' 라면 이건 '무엇이
                만들어지고 있나' 다. 완료분은 떠났으므로 여기 없는 것이 맞다(W7-7-5). */}
            <JudgingAssyList
              assys={judgingAssys ?? null}
              loading={judgingLoading}
              className="shrink-0"
            />
            <div className="flex h-[72vh] min-h-[480px] flex-col xl:h-auto xl:min-h-0 xl:flex-1">
              <BayDetailPanel
                bays={factoryScene.bays}
                selectedBayId={selectedBayId}
                highlightedBayId={highlightedBayId}
                filter={bayFilter}
                onFilterChange={setBayFilter}
                onSelectBay={setSelectedBayId}
                onHoverBay={setHighlightedBayId}
                onOpenBay={(locId) => navigate(`/indoorshop/zones/assembly/${factory.id}/${locId}`)}
                onFitBay={() => {
                  /* 맞춤은 3D 의 동작이다 — 요청을 올리고 뷰어 탭으로 넘긴다 */
                  setFitRequest((count) => count + 1)
                  setWorkTab('viewer')
                }}
                className="min-h-0 flex-1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
