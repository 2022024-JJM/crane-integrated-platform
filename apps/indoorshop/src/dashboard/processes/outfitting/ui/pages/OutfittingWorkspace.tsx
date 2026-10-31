import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import {
  detectionForBlockKey,
  formatDetectionId,
} from '../../../../shared/features/bay-viewer/model/lidarBlock'
import { LidarPointCloudViewer } from '../../../../shared/features/bay-viewer/ui/LidarPointCloudViewer'
import { PointCloudViewControls } from '../../../../shared/features/bay-viewer/ui/PointCloudViewControls'
import { PointCloudLegend } from '../../../../shared/features/bay-viewer/ui/PointCloudLegend'
import { ViewportHelp } from '../../../../shared/features/bay-viewer/ui/ViewportHelp'
import { ViewportToolbar } from '../../../../shared/features/bay-viewer/ui/ViewportToolbar'
import { BackAction } from '../../../../shared/ui/atoms/BackLink'
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
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { useFullscreen } from '../../../../shared/lib/useFullscreen'
import { useDelayedFlag } from '../../../../shared/lib/useDelayedFlag'
import { PCD_BLOCK_PARAM, performanceLinkFor } from '../../../../shared/entities/vessel'
import { useWorkspaceTab, useWorkspaceTabCarry } from '../../../../shared/lib/useWorkspaceTab'
import { Spinner, SpinnerOverlay } from '../../../../shared/ui/atoms/Spinner'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'
import { judgingBlocksOfFactory } from '../../api/wipBlocks'
import { JudgingBlockList } from '../JudgingBlockList'
import { cn } from '../../../../shared/lib/utils'
import { resolveZoneFactoryId } from '../../../../shared/lib/zoneEntryFactory'
import { OUTFITTING_STATUS_META, type OutfittingBlock } from '../../model/block'
import { fetchFactories } from '../../api/outfittingApi'
import { OutfittingStatusTab } from '../OutfittingStatusTab'
import { OutfittingPerformanceView } from '../OutfittingPerformanceView'
import { FolderTabs } from '../../../../shared/ui/atoms/FolderTabs'
import { AfterPaint } from '../../../../shared/ui/AfterPaint'
import {
  fetchOutfittingBayDetail,
  fetchOutfittingFactoryScene,
  fetchOutfittingLocations,
  bayNoOfLocationId,
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
type WorkspaceTab = 'status' | 'viewer' | 'blocks'
const WORKSPACE_TABS: {
  key: WorkspaceTab
  labelKey:
    | 'outfitting.workspace.tabStatus'
    | 'outfitting.workspace.tabViewer'
    | 'outfitting.workspace.tabBlocks'
}[] = [
  { key: 'status', labelKey: 'outfitting.workspace.tabStatus' },
  { key: 'viewer', labelKey: 'outfitting.workspace.tabViewer' },
  { key: 'blocks', labelKey: 'outfitting.workspace.tabBlocks' },
]
/** URL 이 실어 온 착지 탭을 이 화면의 축으로 알아보는 목록 (R28 — 조립과 같은 규칙) */
const WORKSPACE_TAB_KEYS = WORKSPACE_TABS.map((tab) => tab.key)
/** 맨 위 갈래 — [실적 | 현황] (조립과 같은 틀, 사용자 확정) */
type PageView = 'performance' | 'status'
const PAGE_VIEW_PARAM = 'view'


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


export function OutfittingWorkspace() {
  const { t } = useTranslation()
  const { factoryId: routeFactoryId, locationId } = useParams<{
    factoryId: string
    locationId?: string
  }>()
  const navigate = useNavigate()

  /* 진입 URL — 착지 탭(`?tab=`)과 선택 승계(`?block=`)를 여기서 한 번만 읽는다 */
  const [searchParams] = useSearchParams()
  /*
   * 맨 위 갈래 — [실적 | 현황](사용자 확정, 조립과 같은 규칙). 현황은 지금까지의 화면 전체이고
   * 실적은 통합실적의 의장 공정만이다. 축 탭(`?tab=`)과 다른 층이라 따로 `?view=` 에 싣는다.
   *
   * 기본은 **실적**이다. 다만 주소가 현황 안의 자리를 가리키면(축 탭 `?tab=` 이나 베이) 현황으로
   * 선다 — 지도·검색에서 3D 나 베이를 짚고 들어온 사람을 실적에 세우지 않는다.
   * 야드 맵의 창(임베드)에서는 갈래 탭을 걷고, `?view=performance` 가 오지 않는 한 현황이다.
   */
  const rawPageView = searchParams.get(PAGE_VIEW_PARAM)
  /* 기본은 **현황**이다(사용자 확정 — 탭도 [현황 | 실적] 순). `?view=performance` 일 때만 실적으로 선다 —
     야드 맵 창(임베드)도, 작업 카드의 실적 문도 같은 규칙이다 */
  /* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 갈래는 헤더 메뉴의 드롭다운이 `?view=` 로 고른다 */
  const pageView: PageView = rawPageView === 'performance' ? 'performance' : 'status'
  /** 현황 갈래를 지키는 주소 — 공장 주소엔 축·베이가 없어 그대로 두면 기본 갈래(실적)로 튕긴다 */
  const keepStatusView = useCallback(
    (path: string) =>
      pageView === 'status' ? `${path}${path.includes('?') ? '&' : '?'}${PAGE_VIEW_PARAM}=status` : path,
    [pageView]
  )

  /*
   * 축 탭 — 지금 서 있는 축은 주소가 말한다 (R28·R30, 조립 워크스페이스와 같은 규칙).
   *
   * "공장이 바뀌면 기본 탭으로" 라는 리셋 이펙트는 없앴다 — 축이 화면 안 state 이던
   * 시절의 잔재이고, 승계가 생긴 뒤로는 실어 온 축을 마운트 직후 덮는 일만 했다
   * (대문 `/indoorshop/zones/outfitting` 에서 베이로 들어가면 공장이 `없음 → ofit-*` 로 바뀐 것이
   * 되어 `?tab=viewer` 가 그 자리에서 status 로 되돌려졌다). 이 화면에 없는 축이 실려
   * 와도 `WORKSPACE_TAB_KEYS` 검사가 기본 탭으로 접으므로 되돌릴 사본이 없다.
   */
  const { tab: selectedTab, setTab: setWorkTab } = useWorkspaceTab(WORKSPACE_TAB_KEYS, 'status')
  /*
   * 탭 강조는 누르는 즉시(`selectedTab`), 오른쪽 내용은 **한 박자 뒤에** 그린다(사용자 확정: 탭을 먼저
   * 전환하고 그리기). 3D 장면·배치 그림처럼 무거운 내용을 급하지 않은 업데이트로 미뤄, 그 사이에도
   * 탭 줄은 바로 반응한다. 그리는 동안은 이전 탭 내용이 그대로 남아 있다.
   */
  const workTab = useDeferredValue(selectedTab)
  /* 화면 안 이동은 보던 축을 유지한다 (R30 — 조립 워크스페이스와 같은 규칙).
     갈래(`?view=`)도 같이 들고 간다 */
  const carryAxisTab = useWorkspaceTabCarry()
  const carryTab = useCallback((path: string) => keepStatusView(carryAxisTab(path)), [carryAxisTab, keepStatusView])

  /* `전체보기` — 화면을 떠나지 않고 카메라만 전 베이로 물린다(공장 뷰 전용) */
  const [fitAllRequest, setFitAllRequest] = useState(0)

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  /* 선택 승계 (W8-3) — 통합실적 'PCD 뷰' 의 `?block={proj}-{blk}`. 진입 때 한 번만 읽는다
   * (조립 워크스페이스와 같은 규칙). */
  const handoffBlockRef = useRef<string | null>(searchParams.get(PCD_BLOCK_PARAM))
  const [highlightedBayId, setHighlightedBayId] = useState<string | null>(null)
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null)
  useEffect(() => {
    setSelectedBlockId(null)
    setSelectedBayId(null)
  }, [routeFactoryId, locationId])

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
    : 'h-[72vh] min-h-[480px] md:h-full md:min-h-0'

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

  /*
   * 펼 공장 — 경로에 없으면 `?factory=`(총괄 점프), 그것도 없으면 첫 공장 (R22).
   * `/indoorshop/zones/outfitting` 의 대문이 맵 진입에서 이 워크스페이스로 바뀌면서 공장 없이
   * 들어오는 길이 생겼다. 규칙은 세 공정이 함께 쓰는 한 자리(zoneEntryFactory)에 있다.
   */
  const factoryId = resolveZoneFactoryId(factories ?? [], {
    factoryId: routeFactoryId,
    search: searchParams,
  })
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

  /* 승계 소비 — 베이 장면이 오면 그 블록의 detection 을 선택하고 승계는 끝난다 */
  useEffect(() => {
    if (!handoffBlockRef.current || !bayDetail) return
    const match = detectionForBlockKey(bayDetail.scene.blocks, handoffBlockRef.current)
    handoffBlockRef.current = null
    if (match) setSelectedBlockId(match.id)
  }, [bayDetail])

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
    factoryHref: (id) => keepStatusView(`/indoorshop/zones/outfitting/${id}`),
    bayHref: (id, bayId) => keepStatusView(`/indoorshop/zones/outfitting/${id}/${bayId}`),
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

  /*
   * 진행중 판별 — 통합실적 의장 카드와 **같은 함수**를 지난다(`api/wipBlocks`).
   * 화면이 가진 `allBlocks` 로 다시 거르지 않는 이유는, 그러면 두 화면의 필터가 각자
   * 살아 언젠가 갈리기 때문이다. 셈은 한 곳에서만 한다(W8-4).
   */
  const judgingBlocks = useMemo(
    () => judgingBlocksOfFactory(factoryId ?? '', baseDate),
    [factoryId, baseDate]
  )

  const bayScenes = locationId
    ? bayDetail
      ? [bayDetail.scene]
      : null
    : (factoryScene?.bays ?? null)

  if (factories && routeFactoryId && !factory) {
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

  const selectedBlock =
    selectedBlockId && bayScenes
      ? bayScenes.flatMap((scene) => scene.blocks).find((block) => block.id === selectedBlockId)
      : undefined

  /*
   * 공장 전환 탭바는 없앴다 (P4). 공장을 고르는 곳은 ① 현황 탭의 왼쪽 공장 목록 하나뿐이고,
   * 거기서 고르면 URL 이 바뀌어 세 탭이 같은 공장을 본다 — 선택지가 두 군데 있으면
   * 어느 쪽이 진짜인지 화면이 말해 주지 못한다. 베이 알약(아래)은 공장 안의 이동이라 남는다.
   */
  const bayPills = (
    <LocationTabs
      factories={tabFactories}
      locations={locations}
      routing={routing}
      currentFactoryId={factory.id}
      currentLocationId={locationId}
      /* 정반 단계에서는 탭 호버가 화면 상태를 바꾸지 않는다 — 다시 그리기만 일으킨다(사용자 지적) */
      highlightedId={locationId ? undefined : highlightedBayId}
      onHighlight={locationId ? undefined : setHighlightedBayId}
      tone="glass"
      parts="bays"
    />
  )

  /*
   * 축 탭 — 공장 목록 **바로 오른쪽**, 탭 내용 칸의 맨 위에 선다(사용자 확정). 폴더 탭이라 고른 탭과
   * 아래 내용 칸이 한 테두리로 이어진다(`FolderTabs` · 보드의 `FolderPanel`).
   * 헤더 줄에는 맨 위 갈래 [현황 | 실적] 만 남는다.
   */
  const axisTabs = (
    <FolderTabs
      ariaLabel={t('outfitting.workspace.tabAria')}
      items={WORKSPACE_TABS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
      value={selectedTab}
      onChange={setWorkTab}
    />
  )

  return (
    <div className="flex flex-col gap-5 md:h-full md:min-h-0 md:gap-3">
      <FixedViewport />

      {/*
        머리글 한 줄 — 조립 워크스페이스와 같은 문법: 맨 위 갈래 [실적 | 현황] 바로 옆에 축 탭(좌),
        식별 정보(우). 축 탭과 오른쪽은 현황 갈래에만 선다.
      */}
      {/* 화면 안의 [현황 | 실적] 탭은 걷었다(사용자 확정) — 헤더 메뉴의 드롭다운이 갈래를 고른다.
          탭이 빠진 머리 줄에 오른쪽 요약만 남으면 화면 위가 비어 보여(사용자 지적) 줄째 걷었다 */}

      {/*
        탭 본문 — ①현황·②뷰어·③블록이 **같은 어두운 판** 위에 선다(감사 A10).
        토큰만 바꾸는 판이라 마크업·레이아웃은 그대로다.
      */}
      {pageView === 'performance' ? (
        /* 실적 — 통합실적의 의장 공정만 (조회 조건 바 + 의장 레일) */
        <div
          role="tabpanel"
          aria-label={t('outfitting.workspace.viewPerformance')}
          className="flex min-w-0 flex-col md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1"
        >
          <OutfittingPerformanceView />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-6 md:min-h-0 md:flex-1 md:gap-4">
          {/*
            왼쪽 공장 목록은 **모든 탭에 남고**, 탭의 내용은 오른쪽 칸에 선다(조립과 같은 배치 — 사용자 확정).
            ① 현황은 설비 현황(버드뷰·그리드), ②3D·③블록은 그 자리를 바꿔 끼운다(`mainOverride`).

            ① 현황 — 예전 '센서 상태' 탭이 하던 일(그 공장의 설비 목록)은 보드의 그리드가 그대로 한다.
            위에 버드뷰가 붙어 "그게 어느 자리인가" 까지 한 화면에서 답한다.
            공장 선택은 보드의 왼쪽 목록이 쥔다 — 그래서 이 화면의 공장 탭바는 없앴다.
          */}
          <div
            className={cn(
              'flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1',
              workTab === 'status' && 'md:overflow-y-auto md:pr-1'
            )}
          >
            <OutfittingStatusTab
              selectedFactory={factory.name}
              onSelectFactory={(next) => {
                const spec = factories?.find((entry) => entry.name === next)
                /* 보던 탭을 들고 간다 — 3D 를 보다가 공장을 바꾸면 그 공장의 3D 로 */
                if (spec) navigate(carryTab(`/indoorshop/zones/outfitting/${spec.id}`))
              }}
              /* 베이에서 건너왔으면 그 구획을 골라 둔 채로 (조립과 같은 승계) */
              focusBay={locationId ? bayNoOfLocationId(factory.id, locationId) : null}
              className="md:min-h-0 md:flex-1"
              mainHeader={axisTabs}
              mainOverride={
                workTab === 'status' ? undefined : workTab === 'viewer' ? (
                  /* ② 3D 뷰어 — 공장 전체(전 베이 센서퓨전) 또는 베이 하나. 전폭 */
                  <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
                    <div
                      ref={viewportRef}
                      style={isFullscreen ? { background: viewportEdge.background } : undefined}
                      className="viewport-frame relative min-w-0 md:min-h-0 md:flex-1"
                    >
                      {!bayScenes ? (
                        <div
                          style={{ background: viewportEdge.background }}
                          className={cn('w-full rounded-inshop-lg border border-border', viewerSizeClass)}
                        />
                      ) : locationId ? (
                        <AfterPaint label={t('viewer.building')} className={viewerSizeClass}>
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
                        </AfterPaint>
                      ) : (
                        <AfterPaint label={t('viewer.building')} className={viewerSizeClass}>
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
                            onOpenBay={(locId) => navigate(carryTab(`/indoorshop/zones/outfitting/${factory.id}/${locId}`))}
                            highlightedBayId={highlightedBayId}
                            onHoverBay={setHighlightedBayId}
                            fitAllRequest={fitAllRequest}
                            className={viewerSizeClass}
                          />
                        </AfterPaint>
                      )}
                      {/*
                        위쪽 한 줄 — 조립 워크스페이스와 **같은 구조**다. 왼쪽 도구줄과 오른쪽 손잡이·범례를
                        한 흐름에 세워, 좁은 화면에서도 서로 밑으로 파고들지 않는다.
                      */}
                      <div className="pointer-events-none absolute inset-x-[var(--vp-inset,1rem)] top-[var(--vp-inset,1rem)] z-10 flex items-start justify-between gap-2">
                      <div className="pointer-events-auto flex min-w-0 flex-1 flex-col items-start gap-2">
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
                          className="static max-w-full"
                          /*
                           * 물러나기는 **서 있는 층에 따라 다르다** (조립과 같은 규칙):
                           *  · 베이에 들어와 있으면 → 그 공장으로 **나가는 문**
                           *  · 공장 뷰에 있으면 → 여기가 이미 '전체' 이므로 **카메라만** 물린다
                           *    (한 계단 더 나가는 문은 머리글 칩이 맡는다)
                           */
                          /* 정반 단계의 공장 칩은 두지 않는다(사용자 확정) — 탭 줄의 '전체' 가 같은 자리로 간다 */
                          back={
                            locationId ? undefined : (
                              <BackAction
                                label={t('viewer.fit.all')}
                                title={t('viewer.fit.allHint')}
                                onClick={() => setFitAllRequest((count) => count + 1)}
                              />
                            )
                          }
                        >
                          <PointCloudViewControls {...viewerControlProps} tone="glass" />
                        </ViewportToolbar>
                      </div>
                      <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-start gap-2">
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
                      <PointCloudLegend colorMode={colorMode} className="static" />
                      </div>
                      </div>
                      {bayScenes && !locationId && (
                        <FirstRunHint className="absolute bottom-[calc(var(--vp-inset,1rem)+3rem)] left-1/2 z-10 -translate-x-1/2" />
                      )}
                      {(locationId ? showDetailSpinner : showFactorySpinner) && (
                        <SpinnerOverlay
                          label={locationId ? t('viewer.loadingDetection') : t('viewer.loadingFusion')}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  /* ③ 블록·실적 — 문서형 리스트의 블록 현황이 제 축의 전면으로 (딥링크 유지) */
                  <div className="flex min-w-0 flex-col gap-3 md:min-h-0 md:flex-1">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                      <h2 className="text-inshop-base font-semibold text-foreground">
                        {t('outfitting.workspace.blockListTitle')}{' '}
                        <span className="font-normal text-foreground/54">{allBlocks.length}</span>
                      </h2>
                      <p className="text-inshop-xs text-foreground/55">{t('outfitting.workspace.blocksTabHint')}</p>
                    </div>
                    {/* 판별 렌즈의 요약 — 아래 목록(전체)과 답하는 질문이 다르다(W8-4) */}
                    <JudgingBlockList blocks={judgingBlocks} className="shrink-0" />
                    {allBlocks.length === 0 ? (
                      <p className="rounded-inshop-lg border border-border px-2 py-6 text-center text-inshop-sm text-foreground/45">
                        {t(
                          locationId
                            ? 'outfitting.workspace.noBayBlocks'
                            : 'outfitting.workspace.noBlocks'
                        )}
                      </p>
                    ) : (
                      <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
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
                )
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
