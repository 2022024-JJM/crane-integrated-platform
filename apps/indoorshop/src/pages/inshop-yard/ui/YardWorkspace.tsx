import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from '../../../dashboard/shared/lib/i18n/useTranslation'
import {
  busiestMoveDate,
  fetchYardBlocks,
  fetchYardLots,
  lotCountsByUseType,
  moveDates,
  movesOn,
  occupiedLotCount,
  plansOn,
} from '../../../dashboard/entities/yard/api/yardRepository'
import { YardMap, type YardLayers } from '../../../dashboard/features/yard-map/ui/YardMap'
import { YardMapControls } from '../../../dashboard/features/yard-map/ui/YardMapControls'
import { YardMapLegend } from '../../../dashboard/features/yard-map/ui/YardMapLegend'
import { YardViewReadout } from '../../../dashboard/features/yard-map/ui/YardViewReadout'
import { YardBlockOverlay } from '../../../dashboard/features/yard-map/ui/YardBlockOverlay'
import { YardBlockList } from '../../../dashboard/features/yard-map/ui/YardBlockList'
import { YardMoveOverlay } from '../../../dashboard/features/yard-map/ui/YardMoveOverlay'
import { YardMoveList } from '../../../dashboard/features/yard-map/ui/YardMoveList'
import { YardShopOverlay } from '../../../dashboard/features/yard-map/ui/YardShopOverlay'
import {
  buildYardShops,
  findShopBay,
  type MonitoredShop,
  type YardShop,
  type YardShopBay,
} from '../../../dashboard/features/yard-map/lib/assemblyShops'
import type { YardView, YardViewMode } from '../../../dashboard/features/yard-map/lib/projection'
import { resolveMapTheme, type MapThemeSetting } from '../../../dashboard/features/yard-map/lib/basemapStyle'
/*
 * 조립 쪽 집계를 그대로 가져온다 — 야드 맵에 뜨는 정반 상태(점유·라이다·오늘 실적)가
 * 공장 목록 화면과 **한 글자도 다르면 안 되기** 때문이다. 같은 수를 두 곳에서 따로
 * 세면 두 화면이 서로 다른 말을 하고, 그 순간 둘 중 무엇을 믿을지 사용자가 정해야 한다.
 *
 * 지금은 mock API 가 페이지 안에 있어서 화면끼리 참조하는 모양이 되었다. 백엔드가
 * 붙으면 이 함수는 공용 데이터 계층으로 옮겨가고, 여기서는 import 경로만 바뀐다.
 */
import { fetchFactoryOverviews } from '../../inshop-assembly/api/assemblyApi'
import type { FactoryOverview } from '../../../dashboard/features/factory-monitoring/model/types'
import { useAsyncData } from '../../../dashboard/shared/lib/useAsyncData'
import { useEffectiveTheme } from '../../../dashboard/shared/lib/theme/useEffectiveTheme'
import { ViewportFullscreenButton } from '../../../dashboard/features/pointcloud-viewer/ui/ViewportFullscreenButton'
import { FixedViewport } from '../../../dashboard/shared/lib/fixed-viewport/FixedViewport'
import { ResizeHandle } from '../../../dashboard/shared/ui/atoms/ResizeHandle'
import { Segmented, type SegmentedOption } from '../../../dashboard/shared/ui/atoms/Segmented'
import { useResizablePanel } from '../../../dashboard/shared/lib/useResizablePanel'
import { useFullscreen } from '../../../dashboard/shared/lib/useFullscreen'
import { cn } from '../../../dashboard/shared/lib/utils'

/** 필터 칩에 낼 용도 수 — 나머지는 접는다 (칩이 줄바꿈되면 필터가 아니라 벽이다) */
const VISIBLE_USE_TYPES = 6

/** 처음 열었을 때의 레이어 — 이동은 켜 둔다. 꺼 두면 있는 줄도 모른다 */
const DEFAULT_LAYERS: YardLayers = {
  basemap: true,
  lots: true,
  blocks: true,
  moves: true,
  plans: false,
  /* 조립공장도 켜 둔다 — 이 화면과 조립 화면을 잇는 유일한 길이라, 꺼 두면 길이 없다 */
  shops: true,
}

/** 지번 채움 — 레퍼런스 뷰어의 기본값. 베이스맵이 비칠 만큼은 열어 둔다 */
const DEFAULT_LOT_OPACITY = 0.55

/**
 * 지도 밝기와 2D/3D 는 기억한다 — 어떤 지도를 보느냐는 그날의 기분이 아니라
 * **그 사람이 야드를 읽는 방식**이라, 화면을 열 때마다 다시 고르게 하면 안 된다.
 *
 * 기본값은 **자동**, 즉 앱 테마(라이트/다크/시스템)를 그대로 따라간다. 야드 맵은 이
 * 화면의 절반을 차지해서, 앱을 어둡게 해 둔 사람에게 지도만 하얗게 타오르면 설정이
 * 하나 빠진 것처럼 보인다. 밝음·어두움을 직접 고르는 길은 남겨 둔다 — 밝기가 취향이
 * 아니라 **읽는 목적**을 가르는 경우가 있어서다(`basemapStyle` 주석 참조).
 *
 * 예전에 밝음/어두움을 직접 골라 둔 값은 그대로 존중한다. 그때의 선택도 선택이다.
 */
const MAP_THEME_KEY = 'yard-map-theme'
const VIEW_MODE_KEY = 'yard-map-view-mode'

function readMapThemeSetting(): MapThemeSetting {
  try {
    const stored = localStorage.getItem(MAP_THEME_KEY)
    return stored === 'dark' || stored === 'light' ? stored : 'auto'
  } catch {
    // 사생활 보호 모드 등에서 접근이 막힐 수 있다 — 기본값으로 넘어간다
    return 'auto'
  }
}

/** 기본은 평면이다 — 3D 는 깊이를 보는 특수한 읽기이고, 재는 일은 평면이 한다 */
function readViewMode(): YardViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

/*
 * 야드에서 조립 화면으로 가는 두 길 — 경로 규칙은 이 화면이 안다.
 * 맵(feature)은 라우팅을 모른 채 "누르면 여기로"만 전달받는다.
 */
const shopHref = (shop: YardShop) => `/zones/assembly/${shop.factoryId}`
const bayHref = (bay: YardShopBay) => `/zones/assembly/${bay.factoryId}/${bay.locationId}`

/**
 * 공장 집계(FactoryOverview) → 맵이 아는 좁은 계약(MonitoredShop).
 *
 * 야드 지번이 매핑되지 않은 정반은 여기서 빠진다 — 맵에 그릴 자리가 없기 때문이다.
 * 필드를 하나씩 옮겨 적는 것은, 조립 쪽 뷰 모델에 새 필드가 생겨도 맵으로 조용히
 * 흘러 들어가지 않게 하려는 것이다.
 */
function toMonitoredShops(overviews: FactoryOverview[]): MonitoredShop[] {
  return overviews.map((overview) => ({
    factoryId: overview.factory.id,
    name: overview.factory.displayName,
    assyShop: overview.factory.assyShop,
    bays: overview.bays
      .filter((bay) => (bay.yardLots?.length ?? 0) > 0)
      .map((bay) => ({
        locationId: bay.locationId,
        name: bay.name,
        workCntr: bay.workCntr,
        status: bay.status,
        projNo: bay.projNo,
        blkNo: bay.blkNo,
        sensorOnline: bay.sensorOnline,
        sensorTotal: bay.sensorTotal,
        todayCount: bay.todayCount,
        lastScanAt: bay.lastScanAt,
        yardLots: bay.yardLots ?? [],
      })),
  }))
}

type PanelTab = 'blocks' | 'moves'

const PANEL_TABS: SegmentedOption<PanelTab>[] = [
  { value: 'blocks', labelKey: 'yard.tab.blocks' },
  { value: 'moves', labelKey: 'yard.tab.moves' },
]

/**
 * BTS 블록 운반 현황 — 야드 맵.
 *
 * 구성은 조립 워크스페이스와 같다: 왼쪽이 공간(맵), 오른쪽이 목록, 그 사이를 끌어
 * 비율을 정한다. 두 화면이 다루는 것(정반 위 형상 / 야드 위 블록)은 다르지만 하는
 * 일은 같다 — **어디에 무엇이 있는지 보고, 하나를 골라 자세히 본다.** 화면마다
 * 조작이 다르면 그때마다 배워야 하므로 뼈대를 맞춘다.
 *
 * 야드는 두 가지를 겹쳐 본다. **블록**은 지금의 스냅샷("무엇이 어디 서 있는가")이고
 * **이동**은 하루치 기록("어떻게 거기까지 왔는가")이다. 둘은 같은 맵을 쓰지만 시간
 * 축이 다르므로, 오른쪽 목록을 갈아 끼워 지금 무엇을 읽고 있는지 분명히 한다.
 */
export function YardWorkspace() {
  const { t } = useTranslation()

  const lots = useMemo(() => fetchYardLots(), [])
  const blocks = useMemo(() => fetchYardBlocks(), [])
  const useTypes = useMemo(() => lotCountsByUseType(), [])
  const dates = useMemo(() => moveDates(), [])

  /*
   * 감시 대상 조립공장 — 지번·블록과 달리 이것만 비동기다(조립 쪽 집계를 기다린다).
   * 늦게 와도 맵은 이미 서 있고 공장 레이어만 나중에 얹힌다 — 야드를 보는 일이
   * 조립 데이터를 기다릴 이유가 없다.
   */
  const { data: overviews } = useAsyncData(() => fetchFactoryOverviews(), [])
  const shops = useMemo(
    () => (overviews ? buildYardShops(toMonitoredShops(overviews)) : []),
    [overviews],
  )

  const [layers, setLayers] = useState<YardLayers>(DEFAULT_LAYERS)
  const [lotOpacity, setLotOpacity] = useState(DEFAULT_LOT_OPACITY)
  const [mapThemeSetting, setMapThemeSetting] = useState<MapThemeSetting>(readMapThemeSetting)
  const [viewMode, setViewMode] = useState<YardViewMode>(readViewMode)
  /* 기본은 실적이 가장 많은 날 — 처음 열었을 때 텅 빈 야드를 보여 주지 않기 위해서다 */
  const [date, setDate] = useState(() => busiestMoveDate())
  const [panel, setPanel] = useState<PanelTab>('blocks')

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null)
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  const [focusMoveIndex, setFocusMoveIndex] = useState<number | null>(null)
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null)
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null)
  const [hoveredLot, setHoveredLot] = useState<string | null>(null)
  const [activeUseType, setActiveUseType] = useState<string | null>(null)
  const [view, setView] = useState<YardView | null>(null)
  const [resetSignal, setResetSignal] = useState(0)

  /*
   * 맵에 넘기는 것은 **풀어낸 값**이다. 아래 컴포넌트들(맵·범례·상세)은 'auto' 라는
   * 상태를 알 필요가 없고, 알게 되면 저마다 앱 테마를 다시 읽어 어긋날 자리가 생긴다.
   */
  const appTheme = useEffectiveTheme()
  const mapTheme = resolveMapTheme(mapThemeSetting, appTheme)

  /*
   * 맵과 목록이 **같은 배열**을 봐야 한다 — 선택을 인덱스로 주고받으므로, 정렬이
   * 두 곳에서 따로 일어나면 목록에서 고른 줄과 맵이 밝힌 경로가 어긋난다.
   */
  const moves = useMemo(
    () => [...movesOn(date)].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [date]
  )
  const plans = useMemo(() => plansOn(date), [date])

  const {
    width: listWidth,
    dragging: resizingList,
    containerRef: splitRef,
    separatorProps,
  } = useResizablePanel({
    storageKey: 'yard-list-width',
    defaultWidth: 320,
    min: 240,
    max: 560,
    minOpposite: 420,
  })

  const {
    ref: viewportRef,
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen<HTMLDivElement>()

  /*
   * 필터는 지번을 지우지 않고 **흐리게** 만든다 — 야드 모양은 지번이 만드는 것이라,
   * 걸러낸 지번을 없애면 남은 것들이 허공에 뜬 조각처럼 보인다.
   */
  const dimmedLots = useMemo(() => {
    if (!activeUseType) return undefined
    const dimmed = new Set<string>()
    for (const lot of lots) if (lot.useType !== activeUseType) dimmed.add(lot.lot)
    return dimmed
  }, [lots, activeUseType])

  /** 목록은 걸러낸다 — 흐린 지번의 블록까지 줄로 남으면 필터가 아무 일도 안 한 셈이다 */
  const listedBlocks = useMemo(() => {
    const visible = dimmedLots
      ? blocks.filter((block) => block.lot && !dimmedLots.has(block.lot))
      : blocks
    return [...visible].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  }, [blocks, dimmedLots])

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  )
  const selectedMove = selectedMoveIndex === null ? null : (moves[selectedMoveIndex] ?? null)
  const selectedBay = useMemo(() => findShopBay(shops, selectedBayId), [shops, selectedBayId])

  /*
   * 아래 콜백들은 useCallback 으로 고정한다 — 목록(memo)이 이것들을 props 로 받으므로,
   * 매 렌더마다 새 함수를 넘기면 memo 가 아무 일도 하지 않는다. 맵을 끄는 동안
   * 좌표 표시만 바뀌어도 목록 수백 줄이 다시 그려지는 것을 막는 것이 목적이다.
   */
  const selectBlockFromList = useCallback((blockId: string) => {
    setSelectedBlockId(blockId)
    setFocusBlockId(blockId)
    setSelectedMoveIndex(null)
    setSelectedBayId(null)
  }, [])

  /* 맵에서 고른 것은 이미 화면 안에 있다 — 카메라를 움직이면 오히려 손에서 빠진다 */
  const selectBlockFromMap = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId)
    setFocusBlockId(null)
    if (blockId) {
      setSelectedMoveIndex(null)
      setSelectedBayId(null)
    }
  }, [])

  /** 목록에서 고른 경로는 출발·도착이 한 화면에 다 들어오도록 맞춘다 */
  const selectMoveFromList = useCallback((index: number) => {
    setSelectedMoveIndex(index)
    setFocusMoveIndex(index)
    setSelectedBlockId(null)
    setSelectedBayId(null)
    /* 목록에서 골랐다는 것은 보고 싶다는 뜻이다 — 레이어가 꺼져 있으면 켜 준다 */
    setLayers((current) => (current.moves ? current : { ...current, moves: true }))
  }, [])

  /* 맵에서 경로를 고르면 목록도 그쪽으로 갈아 낀다 — 고른 줄이 안 보이면 비교가 안 된다 */
  const selectMoveFromMap = useCallback((index: number | null) => {
    setSelectedMoveIndex(index)
    setFocusMoveIndex(null)
    if (index !== null) {
      setSelectedBlockId(null)
      setSelectedBayId(null)
      setPanel('moves')
    }
  }, [])

  /* 상세 자리는 하나다 — 정반을 고르면 블록·경로는 물러난다 */
  const selectBayFromMap = useCallback((locationId: string | null) => {
    setSelectedBayId(locationId)
    if (locationId) {
      setSelectedBlockId(null)
      setSelectedMoveIndex(null)
    }
  }, [])

  const hoverBay = useCallback((locationId: string | null) => setHoveredBayId(locationId), [])
  const hoverLot = useCallback((lot: string | null) => setHoveredLot(lot), [])

  const changeMapTheme = useCallback((next: MapThemeSetting) => {
    setMapThemeSetting(next)
    try {
      localStorage.setItem(MAP_THEME_KEY, next)
    } catch {
      // 저장에 실패해도 이번 세션 동작에는 영향이 없다
    }
  }, [])

  const changeViewMode = useCallback((next: YardViewMode) => {
    setViewMode(next)
    try {
      localStorage.setItem(VIEW_MODE_KEY, next)
    } catch {
      // 저장에 실패해도 이번 세션 동작에는 영향이 없다
    }
  }, [])

  /** 날이 바뀌면 고른 경로는 뜻을 잃는다 — 인덱스가 다른 날의 다른 이동을 가리키게 된다 */
  const changeDate = useCallback((next: string) => {
    setDate(next)
    setSelectedMoveIndex(null)
    setFocusMoveIndex(null)
  }, [])

  return (
    /*
     * 조립 화면과 같이 — 문서가 아니라 계기판이다. 넓은 화면에서는 뷰포트에 맞춰
     * 고정하고, 넘치는 목록은 페이지가 아니라 오른쪽 패널이 안에서 스크롤한다.
     */
    <div className="flex flex-col gap-5 xl:h-full xl:min-h-0 xl:gap-3">
      <FixedViewport />

      <div className="shrink-0">
        <h1 className="text-inshop-xl font-semibold text-foreground">{t('yard.title')}</h1>
        <p className="mt-0.5 text-inshop-xs text-foreground/58">
          {t('yard.summary', {
            blocks: blocks.length,
            lots: lots.length,
            occupied: occupiedLotCount(),
          })}
          {/* 조립공장 레이어가 있다는 것을 요약 줄이 먼저 말한다 — 없으면 아무도 찾지 않는다 */}
          {shops.length > 0 && (
            <>
              {' · '}
              <span className="text-foreground/72">
                {t('yard.summaryShops', {
                  shops: shops.length,
                  bays: shops.reduce((sum, shop) => sum + shop.bayTotal, 0),
                })}
              </span>
            </>
          )}
        </p>
      </div>

      {/* 용도 필터 — 지번이 많은 순으로, 앞의 여섯만 낸다 */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <FilterChip
          label={t('yard.filter.all')}
          count={lots.length}
          active={activeUseType === null}
          onClick={() => setActiveUseType(null)}
        />
        {useTypes.slice(0, VISIBLE_USE_TYPES).map(({ useType, count }) => (
          <FilterChip
            key={useType}
            label={useType}
            count={count}
            active={activeUseType === useType}
            onClick={() => setActiveUseType(activeUseType === useType ? null : useType)}
          />
        ))}
      </div>

      <YardMapControls
        layers={layers}
        onLayersChange={setLayers}
        lotOpacity={lotOpacity}
        onLotOpacityChange={setLotOpacity}
        mapTheme={mapThemeSetting}
        onMapThemeChange={changeMapTheme}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        dates={dates}
        date={date}
        onDateChange={changeDate}
        moveCount={moves.length}
        planCount={plans.length}
        className="shrink-0"
      />

      <div
        ref={splitRef}
        style={{ '--list-w': `${listWidth}px` } as CSSProperties}
        className="flex flex-col gap-6 xl:min-h-0 xl:flex-1 xl:flex-row xl:gap-0"
      >
        <div className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
          <div
            ref={viewportRef}
            className={cn(
              'relative xl:min-h-0 xl:flex-1',
              resizingList && '[&_canvas]:pointer-events-none',
              isFullscreen && 'bg-viewport',
            )}
          >
            <YardMap
              lots={lots}
              blocks={blocks}
              moves={moves}
              plans={plans}
              shops={shops}
              layers={layers}
              mapTheme={mapTheme}
              viewMode={viewMode}
              lotOpacity={lotOpacity}
              dimmedLots={dimmedLots}
              selectedBlockId={selectedBlockId}
              selectedMoveIndex={selectedMoveIndex}
              selectedBayId={selectedBayId}
              hoveredLot={hoveredLot}
              hoveredBayId={hoveredBayId}
              onSelectBlock={selectBlockFromMap}
              onSelectMove={selectMoveFromMap}
              onSelectBay={selectBayFromMap}
              onHoverLot={hoverLot}
              onHoverBay={hoverBay}
              onViewChange={setView}
              shopHref={shopHref}
              bayHref={bayHref}
              resetSignal={resetSignal}
              focusBlockId={focusBlockId}
              focusMoveIndex={focusMoveIndex}
              className={
                isFullscreen ? 'h-full min-h-0' : 'h-[72vh] min-h-[480px] xl:h-full xl:min-h-0'
              }
            />

            {/* 상세는 블록·경로·정반이 같은 자리를 쓴다 — 한 번에 하나만 고르기 때문이다 */}
            {selectedBlock ? (
              <YardBlockOverlay block={selectedBlock} onClose={() => setSelectedBlockId(null)} />
            ) : selectedMove && selectedMoveIndex !== null ? (
              <YardMoveOverlay
                move={selectedMove}
                index={selectedMoveIndex}
                mapTheme={mapTheme}
                onClose={() => setSelectedMoveIndex(null)}
              />
            ) : selectedBay ? (
              <YardShopOverlay
                shop={selectedBay.shop}
                bay={selectedBay.bay}
                mapTheme={mapTheme}
                onClose={() => setSelectedBayId(null)}
                shopHref={shopHref(selectedBay.shop)}
                bayHref={bayHref(selectedBay.bay)}
              />
            ) : null}

            {/* 상세가 왼쪽 위를 쓰는 동안에는 범례를 오른쪽으로 비켜 세운다 */}
            <YardMapLegend
              mapTheme={mapTheme}
              showMoves={layers.moves}
              showPlans={layers.plans}
              showShops={layers.shops && shops.length > 0}
              className={
                selectedBlock || selectedMove || selectedBay
                  ? 'left-auto right-3 top-12'
                  : undefined
              }
            />

            <YardViewReadout view={view} onGoHome={() => setResetSignal((n) => n + 1)} />

            {fullscreenSupported && (
              <ViewportFullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                className="absolute right-3 top-3"
              />
            )}

            <p className="pointer-events-none absolute bottom-3 right-3 rounded-inshop-md glass-panel px-2 py-1 text-2xs text-glass-foreground/63">
              {t(viewMode === '3d' ? 'yard.hint3d' : 'yard.hint')}
            </p>
          </div>
        </div>

        <ResizeHandle {...separatorProps} dragging={resizingList} className="hidden xl:block" />

        <div className="flex min-w-0 flex-col xl:min-h-0 xl:w-[var(--list-w)] xl:shrink-0">
          <div className="mb-3 flex shrink-0 items-center gap-2">
            <Segmented
              legend={t('yard.tab.legend')}
              hideLegend
              value={panel}
              options={PANEL_TABS}
              onChange={setPanel}
            />
            <span className="font-mono text-inshop-xs text-foreground/54 tabular-nums">
              {panel === 'blocks' ? listedBlocks.length : moves.length}
            </span>
          </div>
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {panel === 'blocks' ? (
              <YardBlockList
                blocks={listedBlocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={selectBlockFromList}
                onHoverLot={hoverLot}
              />
            ) : (
              <YardMoveList
                moves={moves}
                mapTheme={mapTheme}
                selectedIndex={selectedMoveIndex}
                onSelectMove={selectMoveFromList}
                onHoverLot={hoverLot}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-inshop-md border px-2.5 py-1 text-inshop-xs font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        active
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border text-foreground/68 hover:border-accent/50 hover:text-foreground',
      )}
    >
      {label}
      <span className="font-mono text-2xs tabular-nums opacity-60">{count}</span>
    </button>
  )
}
