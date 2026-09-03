import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from '../../../../shared/lib/i18n/useTranslation'
import {
  busiestMoveDate,
  colorOfCategory,
  fetchYardBlocks,
  fetchYardLots,
  lotCountsByUseType,
  moveDates,
  movesOn,
  occupiedLotCount,
  plansOn,
  yardExtent,
} from '../../api/yardRepository'
import { YardMap, type YardLayers } from '../../../../shared/features/yard-map'
import { BASEMAP_LAYERS } from '../../lib/basemapStyle'
import { YardMapControls } from '../YardMapControls'
import { YardMapLegend } from '../YardMapLegend'
import {
  YardViewReadout,
  type YardViewReadoutHandle,
} from '../YardViewReadout'
import { YardBlockOverlay } from '../YardBlockOverlay'
import { YardBlockList } from '../YardBlockList'
import { YardMoveOverlay } from '../YardMoveOverlay'
import { YardMoveList } from '../YardMoveList'
import { YardShopOverlay } from '../YardShopOverlay'
import {
  buildYardShops,
  findShopBay,
  type MonitoredShop,
  type YardShop,
  type YardShopBay,
} from '../../lib/assemblyShops'
import { YardFacilityList } from '../YardFacilityList'
import { YardFacilityOverlay } from '../YardFacilityOverlay'
import {
  fetchYardFacilities,
  findFacility,
  routedFacilityCount,
  type YardFacility,
} from '../../lib/facilities'
import type { YardView, YardViewMode } from '../../lib/projection'
import { resolveMapTheme, type MapThemeSetting } from '../../lib/basemapStyle'
/*
 * 조립 쪽 집계를 그대로 가져온다 — 야드 맵에 뜨는 정반 상태(점유·라이다·오늘 실적)가
 * 공장 목록 화면과 **한 글자도 다르면 안 되기** 때문이다. 같은 수를 두 곳에서 따로
 * 세면 두 화면이 서로 다른 말을 하고, 그 순간 둘 중 무엇을 믿을지 사용자가 정해야 한다.
 *
 * 다만 조립 모듈을 **직접 부르지는 않는다** — 공정 모듈끼리 직접 참조하면 한쪽 변경이
 * 다른 쪽 빌드를 깨고 두 공정을 나란히 개발할 수 없게 된다. 대신 레지스트리에
 * "공장 현황을 내는 모듈"을 물어본다 (shared 경유). 내는 모듈이 없으면 빈 목록이다.
 */
import { fetchFactoryOverviews } from '../../../../shared/model/processRegistry'
import type { FactoryOverview } from '../../../../shared/entities/factory/model/overview'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { useEffectiveTheme } from '../../../../shared/lib/theme/useEffectiveTheme'
import { ViewportFullscreenButton } from '../../../../shared/ui/atoms/ViewportFullscreenButton'
import { FixedViewport } from '../../../../shared/lib/fixed-viewport/FixedViewport'
import { ResizeHandle } from '../../../../shared/ui/atoms/ResizeHandle'
import { Segmented, type SegmentedOption } from '../../../../shared/ui/atoms/Segmented'
import { useResizablePanel } from '../../../../shared/lib/useResizablePanel'
import { useFullscreen } from '../../../../shared/lib/useFullscreen'
import { DraggableCard } from '../../../../shared/ui/atoms/DraggableCard'
import { drilldownHref, YARD_DRILLDOWN } from '../../../../shared/lib/drilldownUrl'
import { cn } from '../../../../shared/lib/utils'
import { useBaseDate } from '../../../../shared/lib/useBaseDate'

/** 필터 칩에 낼 용도 수 — 나머지는 접는다 (칩이 줄바꿈되면 필터가 아니라 벽이다) */
const VISIBLE_USE_TYPES = 6

/** 처음 열었을 때의 레이어 — 이동은 켜 둔다. 꺼 두면 있는 줄도 모른다 */
const DEFAULT_LAYERS: YardLayers = {
  basemap: true,
  /* 공장·샵 외곽도 켜 둔다 — 공장을 눌러야 네온 뷰로 들어가는데, 안 보이면 못 누른다 */
  facilities: true,
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
const shopHref = (shop: YardShop) => `/indoorshop/zones/assembly/${shop.factoryId}`
const bayHref = (bay: YardShopBay) => `/indoorshop/zones/assembly/${bay.factoryId}/${bay.locationId}`

/**
 * 공장·샵 → 공정 화면 경로. 고른 공장을 쿼리(`?factory=`)로 넘겨, 공정 화면이 그 공장
 * 기준으로 열릴 수 있게 한다 (드릴다운 URL 계약 — `shared/lib/drilldownUrl`.
 * 옛 철자 `?shop=` 도 계속 읽히지만 새 링크는 새 철자로 낸다).
 * 화면이 없는 공정(전처리·미지정)은 null — 카드가 이동 대신 그 사실을 말한다.
 */
const facilityHref = (facility: YardFacility) =>
  facility.process.zonePath
    ? drilldownHref(facility.process.zonePath, '', { ...YARD_DRILLDOWN, factory: facility.name })
    : null

/**
 * 공장을 고른 동안의 레이어 — 베이스맵과 공장만 남긴다. 지번·블록이 깔린 채로
 * 발광시키면 네온이 아니라 소음이다. 선택을 풀면 원래 레이어가 그대로 돌아온다.
 */
const NEON_LAYERS: YardLayers = {
  basemap: true,
  facilities: true,
  lots: false,
  blocks: false,
  moves: false,
  plans: false,
  shops: false,
}

/**
 * 공정 화면에 다녀오면 보던 자리로 돌아와야 한다 (요청 문서의 수용 기준) —
 * 카메라와 선택을 세션에 남긴다. 세션 저장인 이유: 다음 날 다시 열 때는
 * "보던 자리"가 아니라 야드 전체에서 시작하는 것이 맞다.
 */
const RETURN_KEY = 'yard-return-state'

interface YardReturnState {
  facility: string | null
  view: { centerLat: number; centerLon: number; scale: number } | null
}

function readReturnState(): YardReturnState | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as YardReturnState
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

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

type PanelTab = 'facilities' | 'blocks' | 'moves'

const PANEL_TABS: SegmentedOption<PanelTab>[] = [
  { value: 'facilities', labelKey: 'yard.tab.facilities' },
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
  /* 지도에 주입하는 야드 fixture — 지도(shared)는 옥포를 모르므로 여기서 넘긴다 */
  const extent = useMemo(() => yardExtent(), [])
  const useTypes = useMemo(() => lotCountsByUseType(), [])
  const dates = useMemo(() => moveDates(), [])

  /*
   * 감시 대상 조립공장 — 지번·블록과 달리 이것만 비동기다(조립 쪽 집계를 기다린다).
   * 늦게 와도 맵은 이미 서 있고 공장 레이어만 나중에 얹힌다 — 야드를 보는 일이
   * 조립 데이터를 기다릴 이유가 없다.
   */
  /* 기준일 — `?date=` 를 따라온다. 지도 위 정반과 옆 목록이 같은 날을 말하게 */
  const { baseDate } = useBaseDate()
  const { data: overviews } = useAsyncData(() => fetchFactoryOverviews(baseDate), [baseDate])
  const shops = useMemo(
    () => (overviews ? buildYardShops(toMonitoredShops(overviews)) : []),
    [overviews],
  )

  /* 공정 화면에 다녀온 흔적 — 있으면 그 모드·선택·카메라에서 다시 시작한다 */
  const restored = useMemo(readReturnState, [])
  const facilities = useMemo(() => fetchYardFacilities(), [])

  const [layers, setLayers] = useState<YardLayers>(DEFAULT_LAYERS)
  const [lotOpacity, setLotOpacity] = useState(DEFAULT_LOT_OPACITY)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    restored?.facility ?? null,
  )
  const [hoveredFacilityId, setHoveredFacilityId] = useState<string | null>(null)
  const [focusFacilityName, setFocusFacilityName] = useState<string | null>(null)
  /*
   * 네온 안의 두 번째 걸음 — 고른 공장 안에서 BAY 하나를 고른다. 아직 이름뿐인
   * 선택이라(BAY 좌표·데이터 미확보) 카드의 칩으로만 서고, 공장이 바뀌면 접는다.
   */
  const [selectedFacilityBay, setSelectedFacilityBay] = useState<number | null>(null)

  /*
   * 화면은 하나다 — 평상시에는 지번·블록·이동의 작업 지도이고, **공장을 고르는 순간**
   * 그 지도가 가라앉으며 공장·샵만 발광하는 네온 뷰로 들어간다(레퍼런스 뷰어의 방식).
   * 모드 스위치가 따로 없는 이유: 네온은 화면이 아니라 "공장 하나를 골랐다"는 상태다.
   * 빈 곳을 누르거나 Esc·카드 닫기로 선택을 풀면 원래 지도가 그대로 돌아온다.
   */
  const neon = selectedFacilityId !== null
  const [mapThemeSetting, setMapThemeSetting] = useState<MapThemeSetting>(readMapThemeSetting)
  const [viewMode, setViewMode] = useState<YardViewMode>(readViewMode)
  /* 기본은 실적이 가장 많은 날 — 처음 열었을 때 텅 빈 야드를 보여 주지 않기 위해서다 */
  const [date, setDate] = useState(() => busiestMoveDate())
  /* 기본 탭은 샵 찾기 — 요청 문서의 첫 용례("PBS 어디지?")가 검색이라서다 */
  const [panel, setPanel] = useState<PanelTab>('facilities')

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null)
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null)
  const [focusMoveIndex, setFocusMoveIndex] = useState<number | null>(null)
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null)
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null)
  const [hoveredLot, setHoveredLot] = useState<string | null>(null)
  const [activeUseType, setActiveUseType] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)

  /*
   * 맵에 넘기는 것은 **풀어낸 값**이다. 아래 컴포넌트들(맵·범례·상세)은 'auto' 라는
   * 상태를 알 필요가 없고, 알게 되면 저마다 앱 테마를 다시 읽어 어긋날 자리가 생긴다.
   */
  const appTheme = useEffectiveTheme()
  /*
   * 공장을 고른 동안은 지도를 **무채색으로 가라앉힌다**(어두운 배색) — 요청 문서의
   * "베이스맵을 가라앉히고 공장만 발광"이 그것이고, 발광은 어두운 바탕에서만 성립한다.
   * 평상시에는 원래 규칙대로 고른 밝기(자동 = 앱 테마)를 쓴다.
   */
  const mapTheme = neon ? 'dark' : resolveMapTheme(mapThemeSetting, appTheme)

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
  const selectedFacility = useMemo(() => findFacility(selectedFacilityId), [selectedFacilityId])

  /*
   * 아래 콜백들은 useCallback 으로 고정한다 — 목록(memo)이 이것들을 props 로 받으므로,
   * 매 렌더마다 새 함수를 넘기면 memo 가 아무 일도 하지 않는다. 맵을 끄는 동안
   * 좌표 표시만 바뀌어도 목록 수백 줄이 다시 그려지는 것을 막는 것이 목적이다.
   */
  /* 블록·경로·정반을 고르면 공장 선택(네온)은 풀린다 — 상세 자리는 하나다 */
  const selectBlockFromList = useCallback((blockId: string) => {
    setSelectedBlockId(blockId)
    setFocusBlockId(blockId)
    setSelectedMoveIndex(null)
    setSelectedBayId(null)
    setSelectedFacilityId(null)
  }, [])

  /* 맵에서 고른 것은 이미 화면 안에 있다 — 카메라를 움직이면 오히려 손에서 빠진다 */
  const selectBlockFromMap = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId)
    setFocusBlockId(null)
    if (blockId) {
      setSelectedMoveIndex(null)
      setSelectedBayId(null)
      setSelectedFacilityId(null)
    }
  }, [])

  /** 목록에서 고른 경로는 출발·도착이 한 화면에 다 들어오도록 맞춘다 */
  const selectMoveFromList = useCallback((index: number) => {
    setSelectedMoveIndex(index)
    setFocusMoveIndex(index)
    setSelectedBlockId(null)
    setSelectedBayId(null)
    setSelectedFacilityId(null)
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
      setSelectedFacilityId(null)
      setPanel('moves')
    }
  }, [])

  /* 상세 자리는 하나다 — 정반을 고르면 블록·경로는 물러난다 */
  const selectBayFromMap = useCallback((locationId: string | null) => {
    setSelectedBayId(locationId)
    if (locationId) {
      setSelectedBlockId(null)
      setSelectedMoveIndex(null)
      setSelectedFacilityId(null)
    }
  }, [])

  const hoverBay = useCallback((locationId: string | null) => setHoveredBayId(locationId), [])
  const hoverLot = useCallback((lot: string | null) => setHoveredLot(lot), [])
  const hoverFacility = useCallback((name: string | null) => setHoveredFacilityId(name), [])

  /* 공장을 고르는 순간 네온으로 들어간다 — 다른 선택은 접는다 (상세 자리는 하나다) */
  const selectFacilityFromMap = useCallback((name: string | null) => {
    setSelectedFacilityId(name)
    setFocusFacilityName(null)
    setSelectedFacilityBay(null)
    if (name) {
      setSelectedBlockId(null)
      setSelectedMoveIndex(null)
      setSelectedBayId(null)
      setPanel('facilities')
    }
  }, [])

  /** 목록에서 골랐다는 것은 어디 있는지 모른다는 뜻이다 — 그 공장으로 데려간다 */
  const selectFacilityFromList = useCallback((name: string) => {
    setSelectedFacilityId(name)
    setFocusFacilityName(name)
    setSelectedFacilityBay(null)
    setSelectedBlockId(null)
    setSelectedMoveIndex(null)
    setSelectedBayId(null)
  }, [])

  /*
   * 카메라는 매 프레임 바뀐다 — state 로 들면 이 워크스페이스 전체(수백 줄 목록 포함)가
   * 프레임마다 리렌더돼 3D 카메라 애니메이션이 끈적해진다. 좌표 상자에는 handle 로만
   * 밀어 넣고, 세션 저장용 마지막 값은 ref 에 남긴다.
   */
  const latestView = useRef<YardView | null>(null)
  const readoutRef = useRef<YardViewReadoutHandle>(null)
  const handleViewChange = useCallback((next: YardView) => {
    latestView.current = next
    readoutRef.current?.update(next)
  }, [])

  useEffect(() => {
    const save = () => {
      try {
        const current = latestView.current
        const state: YardReturnState = {
          facility: selectedFacilityId,
          view: current
            ? { centerLat: current.centerLat, centerLon: current.centerLon, scale: current.scale }
            : null,
        }
        sessionStorage.setItem(RETURN_KEY, JSON.stringify(state))
      } catch {
        // 저장이 막혀도(사생활 보호 모드 등) 이번 화면 동작에는 영향이 없다
      }
    }
    save()
    /* 공정 화면으로 떠나는 언마운트 직전에 마지막 카메라까지 적는다 */
    return save
  }, [selectedFacilityId])

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
          {' · '}
          {/* 공장을 눌러야 열리는 길이 있다는 것을 요약 줄이 먼저 말한다 */}
          <span className="text-foreground/72">
            {t('yard.facility.summary', {
              count: facilities.length,
              routed: routedFacilityCount(),
            })}
          </span>
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
              basemapLayers={BASEMAP_LAYERS}
              extent={extent}
              colorOfCategory={colorOfCategory}
              shops={shops}
              layers={neon ? NEON_LAYERS : layers}
              facilities={facilities}
              selectedFacility={selectedFacilityId}
              hoveredFacility={hoveredFacilityId}
              onSelectFacility={selectFacilityFromMap}
              onHoverFacility={hoverFacility}
              facilityHref={facilityHref}
              focusFacilityName={focusFacilityName}
              initialView={restored?.view ?? null}
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
              onViewChange={handleViewChange}
              shopHref={shopHref}
              bayHref={bayHref}
              resetSignal={resetSignal}
              focusBlockId={focusBlockId}
              focusMoveIndex={focusMoveIndex}
              className={
                isFullscreen ? 'h-full min-h-0' : 'h-[72vh] min-h-[480px] xl:h-full xl:min-h-0'
              }
            />

            {/* 상세는 블록·경로·정반·공장이 같은 자리를 쓴다 — 한 번에 하나만 고르기 때문이다 */}
            {selectedFacility ? (
              <YardFacilityOverlay
                facility={selectedFacility}
                mapTheme={mapTheme}
                onClose={() => {
                  setSelectedFacilityId(null)
                  setSelectedFacilityBay(null)
                }}
                selectedBay={selectedFacilityBay}
                onSelectBay={setSelectedFacilityBay}
                /* 고른 BAY 는 경로에 실려 간다 — 공정 화면이 그 베이 기준으로 열리도록 */
                href={
                  selectedFacilityBay === null
                    ? facilityHref(selectedFacility)
                    : facilityHref(selectedFacility) &&
                      `${facilityHref(selectedFacility)}&bay=${selectedFacilityBay}`
                }
              />
            ) : selectedBlock ? (
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

            {/* 상세가 왼쪽 위를 쓰는 동안에는 범례를 오른쪽으로 비켜 세운다.
                네온 동안은 접는다 — 지번·블록이 물러나 있어 범례가 거짓말이 된다 */}
            {!neon && (
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
            )}

            <YardViewReadout ref={readoutRef} onGoHome={() => setResetSignal((n) => n + 1)} />

            {fullscreenSupported && (
              <ViewportFullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                className="absolute right-3 top-3"
              />
            )}

            {/* 조작 안내 — 잡아 옮길 수 있어야 하므로 포인터를 받는다(예전엔 통과시켰다) */}
            <DraggableCard
              cardKey="hint"
              className="pointer-events-auto absolute bottom-3 right-3 rounded-inshop-md glass-panel px-2 py-1 text-2xs text-glass-foreground/63"
            >
              {t(neon ? 'yard.facility.hint' : viewMode === '3d' ? 'yard.hint3d' : 'yard.hint')}
            </DraggableCard>
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
              {panel === 'facilities'
                ? facilities.length
                : panel === 'blocks'
                  ? listedBlocks.length
                  : moves.length}
            </span>
          </div>
          {/* 샵 목록은 자기 검색창·스크롤을 갖고 있어 스크롤 틀 바깥에 선다 */}
          {panel === 'facilities' ? (
            <YardFacilityList
              facilities={facilities}
              mapTheme={mapTheme}
              selectedFacility={selectedFacilityId}
              onSelectFacility={selectFacilityFromList}
              onHoverFacility={hoverFacility}
              facilityHref={facilityHref}
              className="xl:min-h-0 xl:flex-1"
            />
          ) : (
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
          )}
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
