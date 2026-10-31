import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import {
  detectionForBlockKey,
  formatDetectionId,
} from '../../../../shared/features/bay-viewer/model/lidarBlock'
import { useDrilldownEscape } from '../../../../shared/lib/useDrilldownEscape'
import { AssemblyLocationTabs } from '../AssemblyLocationTabs'
import { BayIdentityBar } from '../BayIdentityBar'
import { AssemblyStatusTab } from '../AssemblyStatusTab'
import { DetectedBlockList } from '../block-detail/DetectedBlockList'
import { DailyProductionView } from './ProductionCountPage'
import { AssemblyPerformanceView } from '../AssemblyPerformanceView'
import { BlockDetailOverlay } from '../block-detail/BlockDetailOverlay'
import { BayDetailPanel } from '../BayDetailPanel'
import { FirstRunHint } from '../../../../shared/features/bay-viewer/ui/FirstRunHint'
import { LidarPointCloudViewer } from '../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import type { BaySceneData } from '../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { RealScanViewer } from '../viewer/RealScanViewer'
import { PointCloudViewControls } from '../../../../shared/features/bay-viewer/ui/PointCloudViewControls'
import { PointCloudLegend } from '../../../../shared/features/bay-viewer/ui/PointCloudLegend'
import { ViewportHelp } from '../../../../shared/features/bay-viewer/ui/ViewportHelp'
import { ViewportToolbar } from '../../../../shared/features/bay-viewer/ui/ViewportToolbar'
import { BackAction } from '../../../../shared/ui/atoms/BackLink'
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
import { resolveZoneFactoryId } from '../../../../shared/lib/zoneEntryFactory'
import { Spinner, SpinnerOverlay } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { judgingAssysAt } from '../../lib/judgingAssys'
import { JudgingAssyList } from '../JudgingAssyList'
import { todayString } from '../../../../shared/features/performance/lib/baseDate'
import { PCD_BLOCK_PARAM } from '../../../../shared/entities/vessel'
import { useWorkspaceTab, useWorkspaceTabCarry } from '../../../../shared/lib/useWorkspaceTab'
import {
  fetchFactories,
  fetchLocations,
  fetchLidarSensors,
  fetchDetectedBlocks,
  fetchBayModel,
  fetchFactoryLayout,
  fetchBlockPreviewModel,
} from '../../api/assemblyApi'
import type { FactoryLayout } from '../../../../shared/features/bay-viewer/lib/bayLayout'
import { fetchRealScanOverlay, isRealLocation, REAL_SEGMENTS } from '../../api/realScanData'
import { assemblyBayKeyOfLocationId } from '../../lib/mapEntry'
import { FolderTabs } from '../../../../shared/ui/atoms/FolderTabs'
import { AfterPaint } from '../../../../shared/ui/AfterPaint'

/** 실측 스캔의 기본 색상 규칙 — 이 화면이 먼저 답해야 할 질문이 "정합됐나" 이다 */
const REAL_DEFAULT_COLOR_MODE: PointColorMode = REAL_PCD_COLOR_MODES[0].value

/**
 * 워크스페이스 축 탭 — 한 화면에 섞여 있던 ②3D 뷰어 / ①센서 상태 / ③블록·실적을
 * 표준 탭으로 가른다(P-(C) 공정층). 기본은 3D 뷰어 — 현행 주 사용성을 그대로 둔다.
 * 각 탭은 기존 컴포넌트의 **재배치**다: 뷰어 탭은 순수 뷰어(전폭), 센서·블록은
 * 뷰어 옆·위에 겹쳐 있던 패널들이 제 축의 전면으로 나온 것이다.
 */
type WorkspaceTab = 'status' | 'viewer' | 'blocks' | 'production'
/*
 * 축 순서는 **현황 → 3D → 블록** 이다 (P4). 처음 서는 화면이 3D 였을 때, 이 공장에
 * 무엇이 몇 대 있고 무엇이 이상인지를 알려면 탭을 한 번 갈아타야 했다 — 물어보는 순서와
 * 화면이 서는 순서가 어긋나 있었다. 3D 는 "저 자리를 자세히 보겠다"는 두 번째 질문이다.
 */
const WORKSPACE_TABS: {
  key: WorkspaceTab
  labelKey:
    | 'assembly.workspace.tabStatus'
    | 'assembly.workspace.tabViewer'
    | 'assembly.workspace.tabBlocks'
    | 'assembly.workspace.dailyProductionLink'
}[] = [
  { key: 'status', labelKey: 'assembly.workspace.tabStatus' },
  { key: 'viewer', labelKey: 'assembly.workspace.tabViewer' },
  { key: 'blocks', labelKey: 'assembly.workspace.tabBlocks' },
  /* 일일 소조 생산 현황도 축 탭 하나다(사용자 확정) — 공장 단위라 정반에서도 그 공장 것을 편다 */
  { key: 'production', labelKey: 'assembly.workspace.dailyProductionLink' },
]
type PageView = 'performance' | 'status'
const PAGE_VIEW_PARAM = 'view'
/** URL 이 실어 온 착지 탭을 이 화면의 축으로 알아보는 목록 (R28) */
const WORKSPACE_TAB_KEYS: WorkspaceTab[] = WORKSPACE_TABS.map((tab) => tab.key)

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
  const { factoryId: routeFactoryId, locationId } = useParams<{
    factoryId: string
    locationId?: string
  }>()
  const navigate = useNavigate()
  /** 지금 보는 정반이 실측 스캔인가(PBS 5BAY) — 색상 규칙의 기본값·선택지가 목업과 다르다.
   * 공장 뷰는 이제 항상 목업 뷰어다: 실측은 공장이 아니라 베이 하나에 붙어 있다. */
  const realView = isRealLocation(locationId)

  /* 진입 URL — 착지 탭(`?tab=`)과 선택 승계(`?block=`)를 여기서 한 번만 읽는다 */
  const [searchParams] = useSearchParams()
  /*
   * 맨 위 갈래 — [실적 | 현황](사용자 확정). 현황은 지금까지의 화면 전체이고 실적은 아직 빈 자리다.
   * 축 탭(`?tab=`)과 다른 층이라 따로 `?view=` 에 싣는다.
   *
   * 기본은 **현황**이다(사용자 확정). 실적은 `?view=performance` 로 들어왔을 때만 선다.
   *
   * 야드 맵의 창(임베드)에서는 갈래 탭을 걷는다(사용자 확정) — 창이 이미 갈 곳을 골라 열었다.
   * 작업 카드의 실적 문만 `?view=performance` 를 실어 [실적] 으로 서고, 나머지는 늘 현황이다.
   */
  const rawPageView = searchParams.get(PAGE_VIEW_PARAM)
  /* 기본은 **현황**이다(사용자 확정 — 탭도 [현황 | 실적] 순). `?view=performance` 일 때만 실적으로 선다 —
     야드 맵 창(임베드)도, 작업 카드의 실적 문도 같은 규칙이다 */
  /* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 갈래는 헤더 메뉴의 드롭다운이 `?view=` 로 고른다 */
  const pageView: PageView = rawPageView === 'performance' ? 'performance' : 'status'

  /*
   * 축 탭 — **지금 어느 축에 서 있는지는 주소가 말한다**(R28·R30, `useWorkspaceTab`).
   *
   * 예전에는 여기에 "공장이 바뀌면 기본 탭으로" 라는 리셋 이펙트가 하나 더 있었다. 축이
   * 화면 안 state 이던 시절, 공장을 갈아탈 때 이전 공장의 자리를 털어 내려고 둔 것이다.
   * 축이 주소로 올라간 뒤로 그 이펙트는 **승계를 되돌리는 일만** 했다 — 대문
   * (`/indoorshop/zones/assembly`, 경로에 공장이 없다)에서 정반으로 들어가면 공장이 `없음 → asm-*`
   * 로 바뀐 것이 되어, 방금 실어 온 `?tab=viewer` 를 마운트 직후 status 로 덮었다.
   * 사용자가 두 번 겪은 "3D 에서 정반 눌렀는데 현황으로 서 있다"가 정확히 그것이다.
   *
   * 없앨 수 있는 이유는 주소가 원본이기 때문이다: 실려 온 값이 이 화면에 없는 축이면
   * `WORKSPACE_TAB_KEYS` 검사가 이미 기본 탭으로 접는다. 되돌릴 화면 안 사본이 없다.
   */
  const { tab: selectedTab, setTab: setWorkTab } = useWorkspaceTab(WORKSPACE_TAB_KEYS, 'status')
  /*
   * 탭 강조는 누르는 즉시(`selectedTab`), 오른쪽 내용은 **한 박자 뒤에** 그린다(사용자 확정: 탭을 먼저
   * 전환하고 그리기). 3D 장면·배치 그림처럼 무거운 내용을 급하지 않은 업데이트로 미뤄, 그 사이에도
   * 탭 줄은 바로 반응한다. 그리는 동안은 이전 탭 내용이 그대로 남아 있다.
   */
  const workTab = useDeferredValue(selectedTab)
  /*
   * 화면 안 이동은 보던 축을 유지한다 (R30) — 3D 에서 정반을 눌러 들어갈 때 `?tab=` 을
   * 두고 가면 도착 화면이 기본 탭(현황)으로 서서, 방금 한 조작의 결과를 못 보게 된다.
   */
  const carryAxisTab = useWorkspaceTabCarry()
  /* 갈래(`?view=`)도 같이 들고 간다 — 현황에서 공장을 바꿨는데 기본 갈래(실적)로 튕기면 안 된다 */
  const carryTab = useCallback(
    (path: string) => {
      const next = carryAxisTab(path)
      if (pageView !== 'status') return next
      return `${next}${next.includes('?') ? '&' : '?'}${PAGE_VIEW_PARAM}=status`
    },
    [carryAxisTab, pageView]
  )

  /** 베이 화면에서 라벨/카드 클릭으로 선택된 블록 — 선택 시 뷰어가 블록 단독 뷰로 전환 */
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  /* 선택 승계 (W8-3) — 통합실적의 'PCD 뷰' 가 `?block={proj}-{blk}` 로 들어온다.
   * 진입 시점에 한 번만 읽는다(통합실적 딥링크와 같은 규칙 — 이후 화면 안 조작이
   * URL 에 되밀려 선택을 되돌리지 않도록). */
  const handoffBlockRef = useRef<string | null>(searchParams.get(PCD_BLOCK_PARAM))
  /** LiDAR 카드 클릭 시 같은 센서 재클릭도 카메라 요청으로 전달한다. */
  const [sensorFocus, setSensorFocus] = useState<{
    id: string | null
    index: number
    request: number
  } | null>(null)
  useEffect(() => {
    setSensorFocus(null)
  }, [routeFactoryId, locationId])
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
  /* `전체보기` — 화면을 떠나지 않고 카메라만 전 베이로 물린다(공장 뷰 전용) */
  const [fitAllRequest, setFitAllRequest] = useState(0)
  /* 실측 뷰어의 정합 범례가 포털해 들어올 자리(오른쪽 위 손잡이 열) */
  const [legendSlot, setLegendSlot] = useState<HTMLDivElement | null>(null)

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
    : 'h-[72vh] min-h-[480px] md:h-full md:min-h-0'

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
  }, [locationId, routeFactoryId])

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

  /*
   * 펼 공장 — 경로에 없으면 `?factory=`(총괄 점프), 그것도 없으면 첫 공장 (R22).
   * 공정별 맵 진입 화면을 걷으면서 `/indoorshop/zones/assembly` 의 대문이 이 워크스페이스가 됐고,
   * 그래서 공장 없이 들어오는 길이 생겼다. 규칙은 세 공정이 함께 쓰는 한 자리에 있다.
   */
  const factoryId = resolveZoneFactoryId(base?.factories ?? [], {
    factoryId: routeFactoryId,
    search: searchParams,
  })

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
    /*
     * ⚠️ 키는 **풀어낸 `factoryId`** 다 — 경로의 `routeFactoryId` 가 아니다 (P0).
     *
     * `/indoorshop/zones/assembly` 처럼 공장 없이 들어오면 `routeFactoryId` 는 처음부터 끝까지
     * undefined 이고, 펼 공장은 `base` 가 도착한 **뒤에야** null → 'asm-pbs' 로 정해진다.
     * 경로 값으로 키를 잡으면 그 사이 한 번 돈 로더가 `factoryId` 없음을 보고 null 을
     * 돌려준 채로 다시 돌지 않는다 — 씬이 영영 null 이라 3D 뷰어 탭이 **빈 테두리만**
     * 남는다(로그도 WebGL 도 멀쩡한 채로). 로더가 읽는 값이 곧 키여야 한다.
     */
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
            /* 상세 카드 미리보기 모델 — 실측 정반은 스캔 CAD 메시에서 온다(bayModel 과 별개) */
            fetchBlockPreviewModel(locationId),
          ]).then(([sensors, blocks, bayModel, previewModel]) => ({
            locationId,
            sensors,
            blocks,
            bayModel,
            previewModel,
          }))
        : Promise.resolve(null),
    [locationId]
  )

  /* 승계 소비 — 인식 목록이 도착하면 그 블록의 detection 을 선택하고 승계는 끝난다.
   * 못 찾으면(그 정반에 그 블록이 없으면) 조용히 접힌다 — 전체 뷰가 그대로 선다. */
  useEffect(() => {
    if (!handoffBlockRef.current || !detail) return
    const match = detectionForBlockKey(detail.blocks, handoffBlockRef.current)
    handoffBlockRef.current = null
    if (match) setSelectedBlockId(match.id)
  }, [detail])

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

  /*
   * ESC = **한 단계 위** (정반 → 공장).
   *
   * 3D 에서 정반 라벨을 눌러 들어오면 나오는 길이 브라우저 뒤로가기 하나뿐이었다.
   * 뷰어가 ESC 를 먼저 듣지만, 풀 것(고른 정반·초점)이 없으면 소비하지 않고 넘기므로
   * (`useEscapeKey` 의 계약) 여기 도착한 ESC 는 "이 화면에서 나가겠다" 는 뜻이다.
   * 머리글의 뒤로 링크와 **같은 계단**을 쓴다 — 두 길이 다른 곳으로 가면 안 된다.
   */
  const upToFactory = useCallback(() => {
    navigate(carryTab(`/indoorshop/zones/assembly/${factoryId}`))
  }, [navigate, carryTab, factoryId])
  useDrilldownEscape(upToFactory, Boolean(selectedLocation))

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

  /*
   * 축 탭 — 공장 목록 **바로 오른쪽**, 탭 내용 칸의 맨 위에 선다(사용자 확정). 폴더 탭이라 고른 탭과
   * 아래 내용 칸이 한 테두리로 이어진다(`FolderTabs` · 보드의 `FolderPanel`).
   * 헤더 줄에는 맨 위 갈래 [현황 | 실적] 만 남는다.
   */
  const axisTabs = (
    <FolderTabs
      ariaLabel={t('assembly.workspace.tabAria')}
      items={WORKSPACE_TABS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
      value={selectedTab}
      onChange={setWorkTab}
    />
  )

  return (
    /*
     * 이 화면은 문서가 아니라 계기판이다 — 넓은 화면에서는 뷰포트에 딱 맞춰 고정하고,
     * 넘치는 목록은 페이지가 아니라 각 패널이 안에서 스크롤한다.
     */
    <div className="flex flex-col gap-5 md:h-full md:min-h-0 md:gap-3">
      <FixedViewport />

      {/*
        머리글은 한 줄이다 — 제목(좌) + 식별 정보 · 축 탭(우).

        페이지 자체 경로 표기('조립 > 조립 1공장 > 1번 베이')는 없앴다. 툴바가 이미
        같은 경로를 내고 있고, 공장·정반 전환은 3D 상자의 탭과 유리 도구줄이 맡는다 —
        세 곳에서 같은 말을 하면 그만큼 뷰어 높이만 줄어든다.
      */}
      {/* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 헤더 메뉴의 드롭다운이 갈래를 고른다 */}
      {pageView === 'status' && selectedLocation ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:flex-1">
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
          </div>
        </div>
      ) : null}

      {/*
        탭 본문 — ①현황·②뷰어·③블록이 **같은 어두운 판** 위에 선다(감사 A10). 그 판은 폴더 탭 아래
        내용 칸(`FolderPanel`)에만 깔고, 왼쪽 공장 목록은 페이지 바탕 그대로 둔다(사용자 확정).
      */}
      {pageView === 'status' ? (
        <div className="flex min-w-0 flex-col gap-6 md:min-h-0 md:flex-1 md:gap-4">
          {/*
            왼쪽 공장 목록은 **모든 탭에 남고**, 탭의 내용은 오른쪽 칸에 선다(사용자 확정). ①현황은
            설비 현황(버드뷰·그리드), ②3D·③블록은 그 자리를 바꿔 끼운다(`mainOverride`).

            ① 현황 — 정반을 골라 들어와 있어도 **공장 전체**를 보여 준다: 여기서 묻는 것은
            "이 공장에 무엇이 몇 대 있고 어디가 이상인가"이고, 그 답은 정반 하나로 좁히면
            나오지 않는다. 3D 장면을 기다리지 않는다 — 재료는 설비 엔티티와 상태 스냅샷이다.
          */}
          <div
            className={cn(
              'flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1',
              workTab === 'status' && 'md:-m-1.5 md:overflow-y-auto md:p-1.5'
            )}
          >
            <AssemblyStatusTab
              selectedFactory={factory.name}
              onSelectFactory={(next) => {
                const spec = base.factories.find((entry) => entry.name === next)
                /* 보던 탭을 들고 간다 — 3D 를 보다가 공장을 바꾸면 그 공장의 3D 로 */
                if (spec) navigate(carryTab(`/indoorshop/zones/assembly/${spec.id}`))
              }}
              /*
               * 정반에서 건너왔으면 그 베이를 골라 둔 채로 선다.
               *
               * 이 탭은 공장 전체를 펴지만, 5번 베이를 보다가 '현황' 을 누른 사람에게
               * 전 베이가 똑같이 서 있으면 자기 자리를 **목록에서 다시 찾아야** 한다 —
               * 화면을 옮긴 대가를 사용자가 치르는 셈이다. 배치 그림은 그 칸을 강조하고
               * 목록은 그 구획을 맨 앞에 세운다(칸을 직접 누른 것과 같은 상태).
               */
              focusBay={assemblyBayKeyOfLocationId(factory.id, selectedLocation?.id ?? '')}
              className="md:min-h-0 md:flex-1"
              mainHeader={axisTabs}
              mainOverride={
                workTab === 'status' ? undefined : workTab === 'production' ? (
                  /* 일일 소조 생산 현황 — 공장 단위, 정반에 서 있어도 그 공장 것을 편다 */
                  <div className="min-w-0 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
                    <DailyProductionView factoryId={factory.id} embedded />
                  </div>
                ) : selectedLocation ? (
                  // ── 정반 레벨 ──
                  !detail || !bayScene ? (
                    /* 첫 진입 — 장면은 아직 없지만 탭과 상자는 자리에 선다 (기다리는 동안에도 갈아탈 수 있어야 한다) */
                    <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
                      <div
                        style={{ background: viewportEdge.background }}
                        className="flex h-[72vh] min-h-[480px] w-full items-center justify-center rounded-inshop-lg border border-border md:h-auto md:min-h-0 md:flex-1"
                      >
                        {showDetailSpinner && <Spinner size={26} label={t('viewer.loadingDetection')} className="text-accent" />}
                      </div>
                    </div>
                  ) : workTab === 'viewer' ? (
                    /* ② 3D 뷰어 — 순수 뷰어(전폭). 센서 목록·블록 목록은 제 축의 탭으로 갔다.
                       유리 도구줄·범례·선택 블록 카드는 뷰어의 조작 부속이라 남는다. */
                    <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
                      <div
                        ref={viewportRef}
                        // 전체 화면에서는 이 칸이 곧 화면이다 — 지금 팔레트의 바탕을 직접 칠한다
                        style={isFullscreen ? { background: viewportEdge.background } : undefined}
                        className="viewport-frame relative md:min-h-0 md:flex-1"
                      >
                        {realView ? (
                          <AfterPaint label={t('viewer.building')} className={viewerSizeClass}>
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
                              legendContainer={legendSlot}
                            />
                          </AfterPaint>
                        ) : (
                          <AfterPaint label={t('viewer.building')} className={viewerSizeClass}>
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
                          </AfterPaint>
                        )}
                        {/*
                          왼쪽 위는 유리 도구줄(정반 전환·표시 옵션) 자리다. 블록 상세는
                          그 **아래에 이어 붙인다** — 절대좌표 둘을 겹치면 도구줄 높이가
                          바뀔 때마다 상세의 자리를 다시 재야 한다.
                        */}
                        {/*
                          위쪽 한 줄 — 왼쪽 도구줄과 오른쪽 손잡이(조작·전체 화면·범례)를 **한 흐름**에
                          세운다. 둘을 따로 띄우면 도구줄이 오른쪽 몫을 어림값으로만 비켜, 좁은 화면에서
                          범례·버튼 밑으로 파고든다. 빈 가운데는 3D 조작을 가로채지 않는다.
                        */}
                        <div className="pointer-events-none absolute inset-x-[var(--vp-inset,1rem)] top-[var(--vp-inset,1rem)] z-10 flex items-start justify-between gap-2">
                        <div className="pointer-events-auto flex min-w-0 flex-1 flex-col items-start gap-2">
                          <ViewportToolbar
                            title={t('assembly.workspace.registeredCloud')}
                            hint={t('assembly.workspace.registeredCloudHint')}
                            nav={
                              <AssemblyLocationTabs
                                factories={base.factories}
                                locations={base.locations}
                                currentFactoryId={factory.id}
                                currentLocationId={selectedLocation.id}
                                /* 정반 단계에서는 탭에 손을 얹어도 화면 상태를 바꾸지 않는다 — 강조할 지도·3D 가
                                   없는데 매번 워크스페이스를 다시 그려 뷰어가 다시 그려지는 것처럼 보였다(사용자 지적) */
                                tone="glass"
                                parts="bays"
                              />
                            }
                            className="static max-w-full"
                            /* 공장으로 나가는 칩은 두지 않는다(사용자 확정) — 탭 줄의 '전체' 가 같은 자리로 간다 */
                          >
                            <PointCloudViewControls {...viewerControlProps} tone="glass" />
                          </ViewportToolbar>
                          {selectedBlock && (
                            <BlockDetailOverlay block={selectedBlock} className="static w-64 max-w-full" />
                          )}
                        </div>
                        {/* 우상단 도구 묶음 — 늘어놓지 않고 한 줄로 모으고, 범례는 그 아래 */}
                        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
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
                        {!viewerOwnsLegend && <PointCloudLegend colorMode={colorMode} className="static" />}
                        {/* 실측 뷰어가 쥔 정합 범례가 서는 자리 — 같은 열이라 도구줄과 겹치지 않는다 */}
                        <div ref={setLegendSlot} className="flex flex-col items-end empty:hidden" />
                        </div>
                        </div>
                        {showDetailSpinner && <SpinnerOverlay label={t('viewer.loadingDetection')} />}
                      </div>
                    </div>
                  ) : (
                    /* ③ 블록·실적 — 인식 목록이 옆구리 패널이 아니라 전면이다.
                       일일 생산은 이제 제 축 탭(④)이 맡는다 — 여기 따로 문을 두지 않는다 */
                    <div className="flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1">
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                        <h2 className="text-inshop-base font-semibold text-foreground">
                          {t('blocks.listTitle')}{' '}
                          <span className="font-normal text-foreground/54">{detail.blocks.length}</span>
                        </h2>
                      </div>
                      <div className="md:-m-1.5 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-1.5">
                        <DetectedBlockList
                          blocks={detail.blocks}
                          model={detail.previewModel}
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
                  <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
                    <div
                      ref={viewportRef}
                      style={isFullscreen ? { background: viewportEdge.background } : undefined}
                      className="viewport-frame relative min-w-0 md:min-h-0 md:flex-1"
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
                        <AfterPaint label={t('viewer.building')} className={viewerSizeClass}>
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
                            onOpenBay={(locId) => navigate(carryTab(`/indoorshop/zones/assembly/${factory.id}/${locId}`))}
                            highlightedBayId={highlightedBayId}
                            onHoverBay={setHighlightedBayId}
                            dimmedBayIds={dimmedBayIds}
                            fitRequest={fitRequest}
                            fitAllRequest={fitAllRequest}
                            className={viewerSizeClass}
                          />
                        </AfterPaint>
                      )}
                      {/*
                        왼쪽 위 묶음 — 정반 뷰와 **같은 구조**다(나가는 문 → 도구줄). 두 화면이
                        같은 자리에 같은 순서로 서야, 들어가고 나오는 동안 눈이 다시 적응하지 않는다.
                      */}
                      {/*
                        위쪽 한 줄 — 왼쪽 도구줄과 오른쪽 손잡이(조작·전체 화면·범례)를 **한 흐름**에
                        세운다. 둘을 따로 띄우면 도구줄이 오른쪽 몫을 어림값으로만 비켜, 좁은 화면에서
                        범례·버튼 밑으로 파고든다. 빈 가운데는 3D 조작을 가로채지 않는다.
                      */}
                      <div className="pointer-events-none absolute inset-x-[var(--vp-inset,1rem)] top-[var(--vp-inset,1rem)] z-10 flex items-start justify-between gap-2">
                      <div className="pointer-events-auto flex min-w-0 flex-1 flex-col items-start gap-2">
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
                          className="static max-w-full"
                          /*
                           * 공장 뷰의 물러나기는 **카메라**다 — 화면을 떠나지 않는다.
                           * 여기가 이미 이 공장의 '전체' 이므로, 한 계단 더 나가는 문(공장 목록)은
                           * 머리글 칩이 맡는다. 3D 안의 손잡이는 3D 안에서 끝난다.
                           */
                          back={
                            <BackAction
                              label={t('viewer.fit.all')}
                              title={t('viewer.fit.allHint')}
                              onClick={() => setFitAllRequest((count) => count + 1)}
                            />
                          }
                        >
                          <PointCloudViewControls {...viewerControlProps} tone="glass" />
                        </ViewportToolbar>
                      </div>
                      {/* 우상단 — 조작·전체 화면, 범례는 그 아래로 */}
                      <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
                        <div className="flex items-start gap-2">
                          {factoryScene && <ViewportHelp className="static flex-col-reverse" />}
                          {fullscreenSupported && (
                            <ViewportFullscreenButton
                              isFullscreen={isFullscreen}
                              onToggle={toggleFullscreen}
                            />
                          )}
                        </div>
                        {factoryScene && !viewerOwnsLegend && (
                          <PointCloudLegend colorMode={colorMode} className="static" />
                        )}
                      </div>
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
                        <FirstRunHint className="absolute bottom-[calc(var(--vp-inset,1rem)+3rem)] left-1/2 z-10 -translate-x-1/2" />
                      )}
                      {showFactorySpinner && <SpinnerOverlay label={t('viewer.loadingFusion')} />}
                    </div>
                  </div>
                ) : !factoryScene ? (
                  /* 센서·블록 탭도 장면 데이터가 재료다 — 오는 동안 자리만 지킨다 */
                  <div className="flex h-[50vh] items-center justify-center rounded-inshop-lg border border-border">
                    {showFactorySpinner && <Spinner size={24} className="text-accent" />}
                  </div>
                ) : (
                  /* ③ 공장 블록·실적 — 정반 상세 패널(작업 상태·필터)이 전면이다.
                     일일 생산 링크는 머리글(공장 뷰 상시)이 이미 낸다 — 같은 문을 두 번 세우지 않는다 */
                  <div className="flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1">
                    {/* 이 공장에서 지금 붙이고 있는 것 — 정반이 '무엇이 서 있나' 라면 이건 '무엇이
                        만들어지고 있나' 다. 완료분은 떠났으므로 여기 없는 것이 맞다(W7-7-5). */}
                    <JudgingAssyList
                      assys={judgingAssys ?? null}
                      loading={judgingLoading}
                      className="shrink-0"
                    />
                    <div className="flex h-[72vh] min-h-[480px] flex-col md:h-auto md:min-h-0 md:flex-1">
                      <BayDetailPanel
                        bays={factoryScene.bays}
                        selectedBayId={selectedBayId}
                        highlightedBayId={highlightedBayId}
                        filter={bayFilter}
                        onFilterChange={setBayFilter}
                        onSelectBay={setSelectedBayId}
                        onHoverBay={setHighlightedBayId}
                        onOpenBay={(locId) => navigate(carryTab(`/indoorshop/zones/assembly/${factory.id}/${locId}`))}
                        onFitBay={() => {
                          /* 맞춤은 3D 의 동작이다 — 요청을 올리고 뷰어 탭으로 넘긴다 */
                          setFitRequest((count) => count + 1)
                          setWorkTab('viewer')
                        }}
                        className="min-h-0 flex-1"
                      />
                    </div>
                  </div>
                )
              }
            />
          </div>
        </div>
      ) : (
        /* 실적 갈래 — 통합실적의 조회 바로 **조립만** 찾는다(사용자 확정) */
        <div
          role="tabpanel"
          aria-label={t('assembly.workspace.viewPerformance')}
          className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1"
        >
          <AssemblyPerformanceView />
        </div>
      )}
    </div>
  )
}
