import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import {
  YardMap,
  type BasemapLayer,
  type LatLonBounds,
  type MapTheme,
  type YardBlock,
  type YardLayers,
  type YardLot,
  type YardMove,
  type YardParcelBaySpan,
  type YardParcelLayer,
  type YardParcelLotGroup,
  type YardPlan,
  type YardView,
  type Viewport,
} from '../../yard-map'
import {
  recallYardCamera,
  rememberYardCamera,
  takeCameraHandoff,
} from '../../yard-map/lib/cameraHandoff'
import { rememberYardMapSearch } from '../../../lib/lastYardMap'
import { fitView, project, screenToWorld } from '../../yard-map/lib/projection'
import { performanceLinkFor, sitesOfBlock } from '../../../entities/vessel'
import {
  loadYardParcels,
  boundsOfLots,
  colorOfProcess,
  type YardParcels,
} from '../../../entities/yard-parcels'
import { useAsyncData } from '../../../lib/useAsyncData'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import { getProcessMapDrilldown, fetchYardMapBackdrop } from '../../../model/processRegistry'
import type { YardMapBackdrop } from '../../../model/yardMapBackdrop'
import {
} from '../../../entities/zone/model/types'
import { DraggableCard } from '../../../ui/atoms/DraggableCard'
import { useDrilldown } from '../../../lib/useDrilldown'
import { useBaseDate } from '../../../lib/useBaseDate'
import { useDrilldownEscape } from '../../../lib/useDrilldownEscape'
import { YARD_DRILLDOWN } from '../../../lib/drilldownUrl'
import type { ProcessMapLocation } from '../../../model/processMapDrilldown'
import {
  mapSpotlight,
  drilldownOfSelection,
  selectionOfDrilldown,
  selectBay as nextBaySelection,
  selectFactory as nextFactorySelection,
  selectLocation as nextLocationSelection,
  type DashboardMapSelection,
} from '../lib/mapSpotlight'
import { restyleDarkBasemap } from '../lib/darkMapRestyle'
import { FactoryBayList, FactoryWorkSummary } from './FactoryBayList'
import { FaultBayPanel } from './FaultBayPanel'
import { CameraReadout, type CameraReadoutHandle } from './CameraReadout'
import { useProcessPaletteId } from '../lib/useProcessPaletteId'
import { MapHoverCard, type MapHoverInfo } from './MapHoverCard'
import { FaultSpotTooltip } from './FaultSpotTooltip'
import { FactoryNavPanel } from './FactoryNavPanel'
import { CardTrail, type CardTrailStep } from './CardTrail'
import { BayFaultList } from './BayFaultList'
import { workingCountOf } from '../lib/factoryNav'
import {
  loadOccupantProgress,
  occupantGroupOf,
  occupantProgressKey,
  type OccupantGroup,
  type OccupantProgress,
} from '../lib/occupantProgress'
import { nowDate } from '../../../lib/now'
import type { FaultBay } from '../lib/bayEquipmentFaults'
import { BayOccupantList } from './BayOccupantList'
import {
  bayOccupancyOf,
  fabricationOccupantsOf,
  factoryBayOccupancy,
  type BayOccupancy,
  type BayOccupant,
} from '../lib/bayOccupancy'
import {
  bayCameraBounds,
  factoryCameraBoundsOf,
  overviewCameraBounds,
  factoryOutlinePoints,
  overviewBoundsCentered,
  type ScreenRect,
  OVERVIEW_BOUNDS_PADDING,
} from '../lib/overviewCamera'
import { useMapLocations, locationsOf } from '../lib/useMapLocations'
import { locationOfBay, summarizeBay } from '../lib/bayDetail'
import {
  factoryPerformanceHref,
  isBaylessProcess,
  paintingBayBlocksJumpHref,
  zoneBayJumpHref,
  zoneJumpHref,
  zoneTabJumpHref,
} from '../lib/zoneJump'
import { BLOCKS_TAB, STATUS_TAB, VIEWER_TAB, withWorkspaceTab } from '../../../lib/workspaceTabUrl'
import { bayTabHref } from '../lib/occupantViewer'
import { StatusJumpButton } from './StatusJumpButton'
import { ScreenPreviewDialog, type ScreenPreview } from './ScreenPreviewDialog'
import { withEquipmentFocus, withEquipmentLanding } from '../../../lib/equipmentFocus'
import { bayHudTarget } from '../lib/bayHud'
import { BayDetailCard } from './BayDetailCard'
import {
  BlockSitePins,
  MapFocusCard,
  type BlockSearchPinHandle,
  type FocusPin,
} from './BlockSearch'
import {
  SearchField,
  clearMapFocusSearch,
  parseMapFocus,
  useYardBlockIndex,
} from '../../global-search'
import { boundsOfSites, locateSites } from '../lib/blockSites'
import {
  FactoryHudLabel,
  type FactoryHudCamera,
  type FactoryHudLabelHandle,
} from './FactoryHudLabel'

/**
 * 대시보드 지도 — 옥포 야드를 배경으로 **painting 지번/공장**을 얹은 요약 화면.
 *
 * 지도가 주인공이다: 공장 지번을 공정색 네온으로 그린다(샵 네비 룩). 오른쪽 **하나의 패널**에
 * 공정존 카드 4개(가공/조립/의장/도장)를 세우고, 각 카드는 **접기/펴기** 된다 — 접으면
 * 한 줄 요약(공정색·공정명·건전성·처리건수), 펴면 상태 상세(서비스/품질·처리건수·수집시각·
 * 점검 항목)와 **그 공정의 공장 목록**이 카드 안에 함께 뜬다. 공장을 누르면(지도든 목록이든)
 * 그 공장이 네온으로 밝아지며 카메라가 날아가고 패널 맨 위에 공장 상세가 열린다.
 *
 * 왼쪽을 비워 지도를 최대한 넓게 쓴다 — 예전의 좌(공장 찾기)·우(공정존) 두 패널을 하나로 합쳤다.
 *
 * 경계: `@/processes/**` 를 import 하지 않는다 — 배경(베이스맵·범위)은 레지스트리
 * (`fetchYardMapBackdrop`)로, 공장/지번은 `@/shared/entities/yard-parcels` 로 읽는다.
 */

/* 베이스맵만 쓰고 야드 자체 레이어(지번·블록·이동·시설)는 끈다 — 공장은 parcels 로 그린다 */
const MAP_LAYERS: YardLayers = {
  basemap: true,
  facilities: false,
  lots: false,
  blocks: false,
  moves: false,
  plans: false,
  shops: false,
}

/* YardMap 이 required 로 요구하지만 대시보드가 쓰지 않는 값들 — 참조를 고정해 재드로를 막는다 */
const NO_LOTS: YardLot[] = []
const NO_BLOCKS: YardBlock[] = []
const NO_MOVES: YardMove[] = []
const NO_PLANS: YardPlan[] = []
const NO_CATEGORY_COLOR = () => '#000'

/*
 * 공정존(zone.id) → painting 지번 데이터의 공정 문자열(한국어). 대시보드가 "이 카드가 지도
 * 어느 공정인가"를 잇는 조인 키다. painting 원본이 공정을 한국어로 들고 있어(조립/도장/의장/
 * 가공) 여기서 맞춘다.
 */
const ZONE_PROCESS: Record<string, string> = {
  assembly: '조립',
  painting: '도장',
  outfitting: '의장',
  fabrication: '가공',
}

/** 위 조인 키의 역방향 — 고른 공장의 공정으로 "어느 공정 모듈에게 물을지"를 찾는다 */
const ZONE_ID_BY_PROCESS: Record<string, string> = Object.fromEntries(
  Object.entries(ZONE_PROCESS).map(([zoneId, process]) => [process, zoneId])
)

/**
 * 베이를 골랐을 때 화면에 담을 **공장 범위의 최소 비율** — 확대 배율의 상한이다.
 * 베이 크기가 지번 한 장(≈100m)에서 세 장(≈300m)까지 제각각이라 여백만으로는 배율이
 * 널뛰므로, 범위 쪽을 묶어 어느 베이를 눌러도 비슷한 거리에 착지하게 한다.
 */
const BAY_CAMERA_MIN_RATIO = 0.55

/**
 * 야드 맵 카메라 방위(도) — 야드를 -30° 돌려 본다(사용자 확정). 전경·하위 단계 모두 같은 방위라
 * 단계를 오가도 방향 감각이 흔들리지 않는다. 사용자가 돌려 볼 수 있고, 단계를 옮기면 이 방위로 돌아온다.
 */
const MAP_BEARING = -48

/**
 * 야드 전경의 가장자리 여백(px) — 전경은 중심·줌을 고정하지 않고 **모든 공장이 다 보이고
 * 한가운데에** 서도록 화면 크기에 맞춰 찾는다(사용자 확정, `overviewBoundsCentered`). 회전은
 * `MAP_BEARING`, 기울기는 `OVERVIEW_PITCH`. 위·아래는 검색창·토글 줄과 조작 안내가 서는 자리라
 * 넉넉히 둔다.
 */
const OVERVIEW_MARGIN = { x: 64, y: 144 }

/** 야드 전경의 카메라 기울기(도) — 지도 기본(52°)보다 조금 낮춰 공장이 서로 덜 가리게(사용자 확정) */
const OVERVIEW_PITCH =50

/**
 * 공정(공장 목록) 카메라의 배율 상한 — 공장이 한곳에 모인 공정(가공)은 꼭 맞추면 야드 전경의
 * 3.6배까지 들어가, **다른 권역의 점검 필요 핀**이 화면 밖·카드 밑으로 밀려 사라진다(사용자 지적).
 * 공장 목록은 아직 야드를 훑는 단계라 이 이상 들어가지 않는다(조립·의장·도장은 이보다 낮다).
 */
const PROCESS_MAX_SCALE = 90_000

/** 공장·베이 단계의 카메라 기울기(도) — 0 이 바로 위. 야드 전경·공정(공장 목록)은 OVERVIEW_PITCH */
const DRILL_PITCH = 0

/**
 * 고른 공장 칠의 공정별 세기 배율 — 네 공정 모두 조금 낮추고(0.85), 밝은 공정색(의장 주황·
 * 도장 분홍)은 거기서 더 옅게(사용자 확정)
 */
const SELECTED_FILL_SCALE: Readonly<Record<string, number>> = {
  가공: 0.45,
  조립: 0.45,
  의장: 0.5,
  도장: 0.5,
}

/** 선택 — 공장 하나(클릭) 또는 공정 하나(카드 헤더 클릭). 둘 다 카메라를 움직인다 */
type Selection = DashboardMapSelection


interface Loaded {
  backdrop: YardMapBackdrop | null
  parcels: YardParcels
}

export function DashboardZoneMap() {
  const { t } = useTranslation()
  const hudRef = useRef<FactoryHudLabelHandle>(null)
  /*
   * 마지막으로 받은 카메라 — 떠 있는 이름패가 붙는 **첫 프레임**에 쓸 값이다. 이름패는
   * 공장을 고르는 순간 붙는데 그때 카메라 알림은 아직 오지 않았고, 카메라를 state 로
   * 들면 비행 매 프레임마다 이 화면 전체(우측 공정존 패널까지)가 다시 그려진다.
   */
  const cameraRef = useRef<FactoryHudCamera | null>(null)
  /* 지도 위 카메라 값 표시 — 카메라가 움직일 때마다 값을 밀어 넣는다(React 렌더 없이) */
  const cameraReadoutRef = useRef<CameraReadoutHandle>(null)

  /*
   * 공정 맵 화면에서 넘어온 카메라 승계(1회성·TTL 3s) — 첫 렌더에서 한 번만 가져와
   * YardMap 의 시작 화각으로 쓴다. 없으면(직접 진입·새로고침) 기존 initialBounds 폴백.
   */
  const handoffRef = useRef<YardView | null | undefined>(undefined)
  if (handoffRef.current === undefined) handoffRef.current = takeCameraHandoff()
  const handoffView = handoffRef.current
  /*
   * 다른 화면에 갔다가 '야드 맵' 으로 돌아오면 **마지막 상태**로 선다(사용자 확정) — 선택은
   * 헤더 링크가 마지막 주소(`lastYardMap`)로 데려오고, 화각은 여기서 그 주소에서 마지막으로
   * 본 카메라로 놓는다. 승계(공정 화면 → 대문)가 있으면 그쪽이 먼저다.
   */
  const routeLocation = useLocation()
  const searchRef = useRef(routeLocation.search)
  searchRef.current = routeLocation.search
  const restoredRef = useRef<YardView | null | undefined>(undefined)
  if (restoredRef.current === undefined) {
    restoredRef.current = handoffView ? null : recallYardCamera(routeLocation.search)
  }
  const restoredView = restoredRef.current
  /* 돌아온 주소를 떠나기 전까지는 카메라를 붙든다 — 대문 범위가 카드 측정으로 한 번 바뀌는
     것만으로도 비행이 시작돼, 돌아온 화각을 곧장 빼앗는다. 선택(주소)이 바뀌면 놓는다 */
  const [holdSearch, setHoldSearch] = useState<string | null>(restoredView ? routeLocation.search : null)
  const holdingCamera = holdSearch != null && holdSearch === routeLocation.search
  useEffect(() => {
    rememberYardMapSearch(routeLocation.search)
    if (holdSearch != null && routeLocation.search !== holdSearch) setHoldSearch(null)
  }, [routeLocation.search, holdSearch])
  /*
   * 승계로 시작한 화면은 첫 focusBounds 관찰이 "이미 본 것"으로 넘어가 카메라가 승계
   * 화각에 머문다 — 지도가 준비된 뒤 목표 범위를 **복제**해 정체성을 바꿔 주면
   * 거기서 제 프레이밍으로 미끄러진다(전환 글라이드). 두 번 차는 건 ResizeObserver
   * 측정 경쟁으로 첫 발이 무시될 때의 보험이다.
   */
  const [glideKick, setGlideKick] = useState(0)

  /* 배경(베이스맵·범위)과 지번/공장 데이터를 함께 당긴다 — 둘 다 무거운 fixture(lazy) */
  const { data } = useAsyncData<Loaded>(
    () =>
      Promise.all([fetchYardMapBackdrop(), loadYardParcels()]).then(([backdrop, parcels]) => ({
        backdrop,
        parcels,
      })),
    []
  )

  /*
   * 선택은 **URL 이 원본**이다 — `?process=` `?factory=` `?bay=`
   * (규칙은 `shared/lib/drilldownUrl`). 화면 안 state 였을 때는 새로고침이 자리를
   * 잃었고, 뒤로가기가 드릴아웃이 아니라 **이전 화면**으로 나갔다.
   *
   * 무엇이 무엇을 끄는가(같은 것 재클릭 = 해제, 공정 갈아타면 그 아래가 사라진다)는
   * 여전히 `mapSpotlight` 의 전이 함수가 정한다 — 여기서는 그 결과를 주소로 옮길 뿐이다.
   *
   * 작업 위치(`location`)만은 주소에 싣지 않는다: 그것을 고르는 동작은 곧장 공정 상세로
   * 나가는 동작이라 총괄 화면에 남을 자리가 아니다(`drilldownOfSelection` 주석).
   */
  const drill = useDrilldown()
  /* 조회 기준일 — 지도는 늘 '지금'을 그리므로, 되감긴 축으로 들어오면 그 사실을 적는다(P1 ⑤) */
  const { baseDate, isToday } = useBaseDate()
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const selection = useMemo<Selection>(
    () => selectionOfDrilldown(drill, selectedLocationId),
    [drill, selectedLocationId]
  )

  /** 전이 함수가 낸 다음 선택을 주소에 적는다 — 화면이 드릴다운 state 를 따로 들지 않게 */
  const applySelection = useCallback(
    (next: Selection) => {
      setSelectedLocationId(next?.kind === 'factory' ? (next.location ?? null) : null)
      /* 공장을 고르면 그 공정도 주소에 함께 싣는다 — 한 단계 뒤로(빈 곳 클릭·ESC·경로)가
         그 공정의 공장 목록으로 오게. 뎁스: 공정 목록 › 공장 목록 › 공장 › BAY */
      const state = drilldownOfSelection(next)
      if (next?.kind === 'factory') {
        state.process = data?.parcels.factories.find((f) => f.name === next.name)?.process ?? null
      }
      drill.set(state)
    },
    [drill, data]
  )

  const [hoveredFactory, setHoveredFactory] = useState<string | null>(null)
  /* 고른 공장 안에서 손이 얹힌 작업 위치 — 지도 칸이 살짝 밝아진다(누를 수 있음) */
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null)
  /* 지도에서 손이 얹힌 **베이** — 목록의 작업 위치와 id 공간이 달라 따로 든다 */
  const [hoveredBay, setHoveredBay] = useState<string | null>(null)
  /*
   * 블록 검색이 고른 블록 — 선택(`selection`)과 나란히 두지 않는 것은 이것이 드릴다운
   * 단계가 아니기 때문이다: 검색은 지도에게 "이 블록이 어디냐"를 물을 뿐 무엇을
   * 골랐는지를 바꾸지 않으므로, 상위 선택 전이 규칙(mapSpotlight)에 들어갈 자리가 없다.
   * 카메라는 이 값이 선택보다 우선한다(찾은 자리를 보여 주는 것이 질문의 답이므로).
   */
  /*
   * 검색이 무엇을 비추는가 — **주소가 정본이다**(`?vessel=&block=&assy=`).
   * 화면 안 state 였을 때는 팔레트(Cmd+K)에서 고른 블록을 지도로 전달할 길이 없었고,
   * 새로고침·링크 공유에도 표시가 사라졌다. 야드 BTS 색인이 늦게 오므로 그 원천도 함께 읽는다.
   */
  const [searchParams] = useSearchParams()
  const yardBlockIndex = useYardBlockIndex()
  const mapFocus = useMemo(
    () => parseMapFocus(searchParams, yardBlockIndex),
    [searchParams, yardBlockIndex]
  )
  const searchPinRef = useRef<BlockSearchPinHandle>(null)
  /* 카드별 펴짐 상태(공정명 집합). 기본은 전부 접힘 — 지도가 넓게 보이는 상태에서 시작한다 */

  const parcels = data?.parcels ?? null
  const navigate = useNavigate()

  /* 승계 글라이드 발차 — 지도 데이터가 선 뒤 두 번(측정 경쟁 보험) */
  useEffect(() => {
    if (!handoffView || !data) return
    const first = setTimeout(() => setGlideKick(1), 120)
    const second = setTimeout(() => setGlideKick(2), 600)
    return () => {
      clearTimeout(first)
      clearTimeout(second)
    }
  }, [handoffView, data])

  const focusedFactory = selection?.kind === 'factory' ? selection.name : null

  /*
   * 고른 공장의 **작업 위치**(조립: 베이·정반). 공정 모듈이 소유한 데이터라 레지스트리로
   * 물어보고(PRD FR-3), 공장을 고른 뒤에 지연 조회한다(FR-7). 어느 공정에게 물을지는
   * 그 공장의 공정에서 나온다 — 대시보드가 공정 모듈을 직접 부르지는 않는다.
   */
  const processOfFactory = useCallback(
    (name: string) => parcels?.factories.find((f) => f.name === name)?.process ?? null,
    [parcels]
  )
  const focusedZoneId = useMemo(() => {
    const process = focusedFactory ? processOfFactory(focusedFactory) : null
    return process ? (ZONE_ID_BY_PROCESS[process] ?? null) : null
  }, [focusedFactory, processOfFactory])
  const drilldown = useMemo(
    () => (focusedZoneId ? getProcessMapDrilldown(focusedZoneId) : null),
    [focusedZoneId]
  )
  const { state: locationsState } = useMapLocations(
    drilldown,
    focusedFactory
  )
  const locations = locationsOf(locationsState)
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  )

  /*
   * 공장 밀집 구역 — 대문 카메라의 목적지이자 "홈". 야드 전체를 맞추면 공장이 점으로
   * 밀려 "지도 위의 3D 모형" 이 서지 않으므로, 소속 지번 전체를 감싸는 범위로 당겨서
   * 연다. 선택을 풀 때도 여기로 돌아온다 — 전체 야드는 이 화면의 홈이 아니다.
   * 계산은 overviewCamera 공용 — 도장 배치 화면과 같은 대문을 쓴다.
   */
  /*
   * 패널을 지도 위에 겹칠 자리가 있는가 — 셸이 고정 뷰포트를 켜는 선(md)과 **같은 선**을
   * 쓴다. 그보다 좁으면 셸도 문서처럼 스크롤하는데 지도만 패널을 겹쳐 두면, 좌(상세
   * 27rem)·우(문제 BAY 23rem) 두 기둥이 서로 올라타 글자가 글자 위에 얹힌다.
   * 좁은 화면에서는 패널을 지도 **아래**로 내려 페이지가 스크롤하게 둔다.
   */
  const wide = useMediaQuery('(min-width: 48rem)')

  /*
   * 대문 카메라를 **카드를 피해 최대로 확대**하려면 지도 상자 크기와 그 위를 덮은 카드 자리를
   * 알아야 한다(사용자 확정: "양쪽 카드에 가려지지 않을 정도로만 확대"). 지도 상자 · 왼쪽 카드를
   * 재어 둔다(오른쪽 위 점검 필요 토글 · 색 시안은 걷었다). 왼쪽 카드는 단계마다 키가 바뀌므로, 대문이 쓰는
   * 공정 목록일 때(무선택)만 잰다 — 공장 카드를 연 채로 재면 대문이 그 키만큼 물러난다.
   */
  const mapBoxRef = useRef<HTMLDivElement>(null)
  const leftCardRef = useRef<HTMLDivElement>(null)
  const atOverviewRef = useRef(true)
  atOverviewRef.current = selection == null
  const [overviewLayout, setOverviewLayout] = useState<{
    width: number
    height: number
    obstacles: ScreenRect[]
  } | null>(null)
  useEffect(() => {
    const box = mapBoxRef.current
    if (!box || !wide) return
    const snap = (n: number) => Math.round(n / 8) * 8
    const measure = () => {
      /* 대문에는 왼쪽 카드가 없다(베이를 고를 때만 뜬다) — 대문일 때만 잰다 */
      if (!atOverviewRef.current) return
      const b = box.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) return
      const rel = (el: Element | null | undefined): ScreenRect | null => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return null
        return { x: snap(r.left - b.left), y: snap(r.top - b.top), width: snap(r.width), height: snap(r.height) }
      }
      const obstacles = [rel(leftCardRef.current?.querySelector('section'))].filter(
        (r): r is ScreenRect => r != null
      )
      /* 지도 크기는 반올림하지 않는다 — 계산한 화면과 실제
         화면이 1px 이라도 다르면 도착 배율이 그만큼 어긋난다 */
      const next = { width: Math.round(b.width), height: Math.round(b.height), obstacles }
      setOverviewLayout((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    if (leftCardRef.current) observer.observe(leftCardRef.current)
    return () => observer.disconnect()
  }, [wide, parcels, selection])

  /* 카드를 피해 최대로 확대한 대문 — 잴 수 없으면(좁은 화면·첫 렌더) 군집이 꼭 맞는 범위로 */
  const overviewOutline = useMemo(() => (parcels ? factoryOutlinePoints(parcels) : []), [parcels])
  const avoidingBounds = useMemo<LatLonBounds | null>(
    () =>
      overviewLayout && wide && overviewOutline.length > 0
        ? overviewBoundsCentered(
            overviewOutline,
            { width: overviewLayout.width, height: overviewLayout.height },
            { bearing: MAP_BEARING, pitch: OVERVIEW_PITCH },
            { project, screenToWorld },
            OVERVIEW_MARGIN
          )
        : null,
    [overviewLayout, wide, overviewOutline]
  )
  const overviewBounds = useMemo<LatLonBounds | null>(
    () => avoidingBounds ?? (parcels ? overviewCameraBounds(parcels, MAP_BEARING) : null),
    [avoidingBounds, parcels]
  )

  /*
   * 공정(공장 목록)도 대문과 **같은 계산**으로 잡는다 — 공장 목록은 대문 기울기 그대로 서므로
   * (사용자 확정), 바로 위 시점 기준의 상자(`processBounds`)를 쓰면 기울인 원근만큼 한 번 더
   * 물러나고 돌린 상자의 모서리까지 담느라 지나치게 줌아웃된다. 그 공정 공장들의 외곽이 카드를
   * 피해 꼭 맞게 선다. 잴 수 없으면(좁은 화면·첫 렌더) 상자로 떨어진다.
   */
  const processAvoidingBounds = useMemo<LatLonBounds | null>(() => {
    if (!parcels || selection?.kind !== 'process' || !overviewLayout || !wide) return null
    const codes = new Set(
      parcels.factories.filter((f) => f.process === selection.process).flatMap((f) => f.lotCodes)
    )
    const points = factoryOutlinePoints({ ...parcels, lots: parcels.lots.filter((lot) => codes.has(lot.lot)) })
    if (points.length === 0) return null
    const viewport = { width: overviewLayout.width, height: overviewLayout.height }
    const camera = { bearing: MAP_BEARING, pitch: OVERVIEW_PITCH }
    const fitted = overviewBoundsCentered(points, viewport, camera, { project, screenToWorld }, OVERVIEW_MARGIN)
    if (!fitted) return null
    /* 상한보다 깊이 들어가면 같은 중심에서 그만큼 범위를 넓힌다 */
    const scale = fitView(fitted, viewport, 0, camera).scale
    if (scale <= PROCESS_MAX_SCALE) return fitted
    const k = scale / PROCESS_MAX_SCALE
    const cLat = (fitted.minLat + fitted.maxLat) / 2
    const cLon = (fitted.minLon + fitted.maxLon) / 2
    const hLat = ((fitted.maxLat - fitted.minLat) / 2) * k
    const hLon = ((fitted.maxLon - fitted.minLon) / 2) * k
    return { minLat: cLat - hLat, maxLat: cLat + hLat, minLon: cLon - hLon, maxLon: cLon + hLon }
  }, [parcels, selection, overviewLayout, wide])

  /*
   * 대시보드 전용 베이스맵 보정 — "실제 지도" 느낌. 야드 화면은 지번·블록이 주인공이라
   * 지형을 명도 한 줌으로 눌러 두지만, 대문은 지형 자체가 무대다: 땅/바다 대비를 세우고
   * 해안선·부두를 긋고, 건물·잔 도로를 배율 문턱 없이 항상 켠다 — 그래야 첫눈에 "지도
   * 위에 모형이 서 있다"로 읽힌다. 배색은 도장 배치 화면과 공유한다(darkMapRestyle).
   */
  const basemapLayers = useMemo<Record<MapTheme, BasemapLayer[]> | null>(() => {
    const src = data?.backdrop?.basemapLayers
    if (!src) return null
    /* 대시보드는 다크 지도만 쓴다 — light 는 계약을 채우기 위한 통과값 */
    return restyleDarkBasemap(src)
  }, [data])


  /* 공장 선택 = 지도/목록 공통 동작. 그 공장의 공정 카드를 펴 목록에서 선택이 보이게 한다 */
  const selectFactory = useCallback(
    (name: string | null) => {
      applySelection(nextFactorySelection(selection, name))
      /* 공장이 바뀌면 이전 공장의 위치 호버가 남지 않게 지운다 (선택은 전이 함수가 지운다) */
      setHoveredLocation(null)
      setHoveredBay(null)
    },
    [applySelection, selection]
  )

  /*
   * 한 단계만 뒤로 — 작업 위치/베이 → 공장 → 야드 순으로 **한 칸씩** 올라온다.
   * 지도의 빈 곳 클릭과 ESC 가 같은 계단을 쓴다(같은 제스처 = 같은 의미). 오클릭 한 번이
   * 공장→베이까지 쌓은 선택 전부를 무너뜨리던 동작을 없앤다(UX 감사 O1 과 같은 계급).
   * 작업 위치(location)는 URL 밖의 화면 state 라 여기서 먼저 걷는다.
   */
  const stepBack = useCallback(() => {
    if (selectedLocationId) {
      setSelectedLocationId(null)
      return
    }
    drill.up()
  }, [selectedLocationId, drill])

  /*
   * `/?factory=<공장명>` 딥링크는 **따로 소비하지 않는다** — 그 쿼리가 곧 선택이기
   * 때문이다(위 `selection`). 예전에는 마운트 뒤 한 번 베껴 오는 effect 가 있었는데,
   * 그러면 같은 사실을 두 곳(주소와 state)이 들고 있어 뒤로가기가 둘을 어긋나게 했다.
   *
   * 지도에 없는 공장 이름이 와도 조용히 둔다: 카드는 그 이름으로 열리고 카메라만 못
   * 움직인다 — 오류 화면을 세울 만큼의 사고가 아니다(기존 동작 유지).
   */

  /* 공장을 갈아타면 이전 공장의 작업 위치는 뜻을 잃는다 — 뒤로가기로 온 변화도 포함 */
  const drilledFactory = drill.factory
  useEffect(() => {
    setSelectedLocationId(null)
  }, [drilledFactory])

  /* ESC = 한 단계 위 (작업 위치/베이 → 공장/공정 → 야드). 글자를 치는 중이면 삼킨다 */
  useDrilldownEscape(stepBack)


  /*
   * **목록**의 작업 위치 클릭 — 그 위치를 고르고 곧장 상세 화면으로 들어간다.
   *
   * PRD §5.3 은 "1회 클릭은 선택, 명시적 링크 또는 재활성화로 이동"을 기본안으로 두되
   * 즉시 이동을 제품 책임자가 선호하면 확정하라고 열어 두었고(열린 결정 3), 목록에서는
   * 즉시 이동으로 확정했다 — 목록의 줄은 화살표가 달린 **링크**라 눌렀을 때 나가는 것이
   * 그 줄의 약속이고, 훑어보기는 호버가 맡는다.
   *
   * **지도의 베이 클릭은 이 길로 오지 않는다**(아래 `selectMapUnit`). 지도에서 칸을
   * 눌러 보는 일이 곧 화면을 떠나는 일이 되면 베이를 훑어볼 수가 없기 때문이다.
   *
   * 선택을 먼저 세우고 이동하므로, 뒤로가기로 돌아오는 흐름에서도 어떤 위치를 보고
   * 왔는지가 상태로 남는다. 상세 경로는 공정 모듈이 준 `detailPath` 그대로 쓴다 —
   * 대시보드가 URL 을 조합하지 않는다(FR-3).
   */
  const openLocation = useCallback(
    (locationId: string) => {
      const location = locationById.get(locationId)
      applySelection(nextLocationSelection(selection, locationId))
      if (location) navigate(location.detailPath)
    },
    [applySelection, selection, locationById, navigate]
  )

  /* 공정 카드 헤더 클릭 = 스포트라이트 토글. 켤 때는 그 카드도 펴 준다(상세·목록이 바로 보이게) */

  const selectedLocation = selection?.kind === 'factory' ? (selection.location ?? null) : null
  /* 가공 공장은 베이를 고르지 않는다(사용자 확정) — 주소에 `#베이` 가 실려 와도 공장까지만 선다 */
  const selectedBay =
    selection?.kind === 'factory' && !isBaylessProcess(processOfFactory(selection.name))
      ? (selection.bay ?? null)
      : null

  /*
   * 지도 스포트라이트 — 공장을 고르면 그 공장의 **공정도 함께** 켠다 (FR-5 강조 문법).
   * 고른 공장은 가장 진하게('selected'), 같은 공정의 다른 공장은 네온('on')으로 남아
   * 동일 공정이 어디인지 보이고, 무관 공정만 가라앉는다. 카드 활성(activeProcess)과
   * 카메라(focusBounds)는 여전히 selection 원본을 쓴다 — 공장 클릭이 공정 카드를
   * 활성으로 바꾸거나 카메라를 공정 전체로 넓히지는 않는다.
   */
  /*
   * 공장 목록 줄에 손을 얹은 공장 — 아무것도 고르지 않은 상태에서는 그 공장을 **고른 것처럼**
   * 미리 비춘다(그 공장 가장 진하게, 같은 공정은 남기고 나머지는 가라앉힘). 지도 호버의 한 단
   * 밝아짐만으로는 목록에서 고른 이름이 지도 어디인지 잘 보이지 않았다(사용자 지적). 카메라·
   * 카드·주소는 그대로다 — 비춤만 바꾼다. 지도 위 호버에는 걸지 않는다(손이 지나갈 때마다
   * 야드 전체가 깜빡이면 지도를 훑을 수 없다).
   */
  const [navHoveredFactory, setNavHoveredFactory] = useState<string | null>(null)
  /* 선택이 바뀌면(지도 클릭·뒤로가기·주소) 목록 미리 비춤은 뜻을 잃는다 — 남겨 두면 목록으로
     돌아왔을 때 손을 얹지 않은 공장이 비춰진 채로 선다 */
  /* 선택 객체는 렌더마다 새로 만들어질 수 있어, **값**(종류·공장·베이)이 바뀔 때만 걷는다 */
  const selectionKey =
    selection == null
      ? ''
      : selection.kind === 'factory'
        ? `factory:${selection.name}:${selection.bay ?? ''}`
        : `process:${selection.process}`
  useEffect(() => {
    setNavHoveredFactory(null)
  }, [selectionKey])
  const spotlight = useMemo(
    () =>
      (selection == null || selection.kind === 'process') && navHoveredFactory
        ? mapSpotlight({ kind: 'factory', name: navHoveredFactory }, processOfFactory)
        : mapSpotlight(selection, processOfFactory),
    [selection, navHoveredFactory, processOfFactory]
  )


  /*
   * 베이 목록 — 지도가 공장 안을 나누는 칸이자, 눌러 상세를 여는 단위. 매핑(엑셀)이 있는
   * **모든 공정**(조립·도장·의장·가공)에 함께 건다: 공정마다 다르게 굴면 같은 지도에서
   * 어떤 공장은 눌리고 어떤 공장은 안 눌리는 이유를 설명할 수 없다.
   *
   * 매핑이 없는 공장은 여기 들어오지 않으므로 지금까지처럼 한 덩어리로 선다.
   */
  const factoryBays = useMemo<YardParcelBaySpan[]>(() => {
    if (!parcels) return []
    /* 고른 베이의 지붕에 눕혀 새길 이름 — 원본(엑셀)의 `설명` 열 그대로 쓴다.
     * 우리가 지어낸 이름이 아니라 현장이 그 칸을 부르는 이름이라야 지도와 현장이 같은 말을 한다. */
    const labelOfLot = new Map(parcels.lots.map((lot) => [lot.lot, lot.label]))
    return parcels.bays.map((bay) => {
      const lotLabels: Record<string, string> = {}
      for (const code of bay.lotCodes) {
        const label = labelOfLot.get(code)
        if (label) lotLabels[code] = label
      }
      return {
        factory: bay.factory,
        id: bay.id,
        label: bay.label,
        lotLabels,
        lotCodes: bay.lotCodes,
      }
    })
  }, [parcels])

  /*
   * 3D 로 세울 베이 — **전부**다. 한때는 분류(CATC)가 건물인 지번을 가진 베이만 세우고
   * 옥외 베이(느태 NP5·NP7, 텍사코 T6·T7)는 지면에 남겼는데, 그러면 같은 공장 안에서
   * 어떤 칸은 건물로 서고 어떤 칸은 바닥 무늬로 남아 그 차이가 뜻이 있는 것처럼 읽힌다.
   * 지도가 말하려는 것은 "여기가 그 공장의 칸이다"이므로 모습도 하나여야 한다.
   *
   * 옛 규칙이 막으려던 것(옥외 줄들의 지붕이 서로 교차해 화면이 깨지던 SSY)은 이제
   * YardMap 이 인접 토막(3m)마다 한 채로 갈라 세우는 것으로 풀린다 — 원본 엑셀의
   * `지번인접여부(3m)` 그룹 구조가 그 잣대다.
   */
  /* 고른 공장의 베이 — 지도가 그 공장 안을 나누는 칸이자, 눌러 상세를 여는 단위 */
  /* 가공 공장은 칸을 나누지 않는다 — 베이를 누르거나 짚을 수 없다(사용자 확정, `isBaylessProcess`) */
  const focusedBays = useMemo(
    () =>
      focusedFactory && !isBaylessProcess(processOfFactory(focusedFactory))
        ? factoryBays.filter((bay) => bay.factory === focusedFactory)
        : [],
    [factoryBays, focusedFactory, processOfFactory]
  )
  /**
   * 지도의 칸이 **베이**인가, 공정 모듈이 준 작업 위치인가.
   *
   * 베이 매핑이 있는 공장(지금은 조립)에서는 화면에 실제로 서 있는 것이 베이 스팬이므로
   * 누르는 것도 그것이어야 한다 — 눈에 보이는 덩어리와 눌리는 덩어리가 다르면 지도를
   * 믿을 수 없다. 매핑이 없는 공장은 지금까지처럼 작업 위치가 칸이다.
   */
  const mapUnitIsBay = focusedBays.length > 0

  /*
   * 지도의 베이 ↔ 목록의 작업 위치(정반) 잇기 — 지번이 겹치는 것끼리(`locationOfBay`).
   * 목록에 손을 얹으면 지도의 그 스팬이, 지도에 손을 얹으면 목록의 그 줄이 함께 밝아진다.
   * 두 자료가 개수도 이름도 다르므로(PBS 는 지도 8베이 · 조립 3정반) 짝이 없을 수 있다.
   */
  const bayLinks = useMemo(() => {
    const locationOfBayId = new Map<string, ProcessMapLocation>()
    const bayIdOfLocation = new Map<string, string>()
    for (const bay of focusedBays) {
      const location = locationOfBay(locations, bay.lotCodes)
      if (!location) continue
      locationOfBayId.set(bay.id, location)
      if (!bayIdOfLocation.has(location.id)) bayIdOfLocation.set(location.id, bay.id)
    }
    return { locationOfBayId, bayIdOfLocation }
  }, [focusedBays, locations])

  /*
   * 설비 장애 베이 — 설비 마스터·링크 상태 한 원천에서 읽는다(`bayEquipmentFaults`).
   * 야드 전체 목록(오른쪽 패널)과 고른 공장의 베이별 수(카드·지도)가 같은 값에서 나온다.
   * 설비 목록은 고정 데이터라 지도 베이가 서면 한 번만 센다. 동적 import 로 초기 청크를 지킨다.
   */
  const [faultBays, setFaultBays] = useState<readonly FaultBay[]>([])
  useEffect(() => {
    if (!parcels) return
    let alive = true
    void import('../lib/bayEquipmentFaults').then((m) => {
      if (alive) setFaultBays(m.faultBaysOf(parcels.bays))
    })
    return () => {
      alive = false
    }
  }, [parcels])
  /* 지번코드 → 베이 id — 다른 공장의 칸을 눌렀을 때 그 자리의 베이로 바로 가는 데 쓴다 */
  const bayIdOfLot = useMemo(() => {
    const map = new Map<string, string>()
    for (const bay of parcels?.bays ?? []) for (const code of bay.lotCodes) map.set(code, bay.id)
    return map
  }, [parcels])
  /* 지도에 늘 짚어 둘 점검 필요 베이들의 지번 묶음 */
  const faultSpotGroups = useMemo(() => faultBays.map((bay) => bay.lotCodes), [faultBays])
  /* 공장 → 점검 필요 BAY 수 — 왼쪽 카드의 공정·공장 줄 ⚠ 아이콘 */
  const factoryFaultCounts = useMemo<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>()
    for (const bay of faultBays) counts.set(bay.factory, (counts.get(bay.factory) ?? 0) + 1)
    return counts
  }, [faultBays])
  const equipmentFaults = useMemo<ReadonlyMap<string, number>>(
    () => new Map(faultBays.map((bay) => [bay.bayId, bay.equipment.length])),
    [faultBays]
  )
  /*
   * 화면 창 — 카드의 3D·실적·현황은 지도를 떠나지 않고 이 창에 띄운다(`ScreenPreviewDialog`).
   * 닫으면 지도·선택·카메라가 그대로 남아 있다.
   */
  const [preview, setPreview] = useState<ScreenPreview | null>(null)
  const openPreview = useCallback((href: string, title: string) => setPreview({ href, title }), [])
  const closePreview = useCallback(() => setPreview(null), [])

  /* 오른쪽 장애 목록에 손이 얹힌 베이 — 지도가 그 칸을 짚는다(`spotLots`) */
  const [hoveredFaultBay, setHoveredFaultBay] = useState<FaultBay | null>(null)
  /*
   * 점검 필요 베이의 핀 · 하이라이트 — 늘 켠다. 지도 오른쪽 위의 켜고 끄는 토글은 걷었다(사용자 확정).
   */
  const faultPins = true
  const faultHighlight = true
  /* 핀·하이라이트에 손이 얹힌 베이(묶음 번호) + 지도 상자 기준 커서 자리 — hover 카드를 띄운다 */
  const [hoveredSpot, setHoveredSpot] = useState<{
    index: number
    x: number
    y: number
    boxWidth: number
  } | null>(null)
  /* 점검 필요 카드는 **핀**에 손을 얹었을 때만(사용자 확정) — 하이라이트 칸 위에서는 여느 베이처럼
     베이 hover 카드가 뜬다 */
  const hoverSpotGroup = useCallback(
    (index: number | null, at: { x: number; y: number } | null, via?: 'pin' | 'highlight') => {
      setHoveredSpot((prev) =>
        index == null || !at || via !== 'pin'
          ? prev && null
          : { index, x: at.x, y: at.y, boxWidth: mapBoxRef.current?.clientWidth ?? 0 }
      )
    },
    []
  )
  /*
   * 장애 목록의 줄 = 그 베이의 **현황 화면을 창으로** 띄운다 — 카드의 현황·3D·실적과 같은
   * 몸짓이다(화면을 떠나지 않는다. 닫으면 지도·선택이 그대로다).
   *
   * 갈 곳은 공정 모듈이 정한다(드릴다운 계약) — 작업 위치를 내는 공정(조립)이면 지번이
   * 겹치는 작업 위치의 상세(`detailPath`, 정반현황)로, 아니면 그 공정 화면에 베이를 실어
   * (`?bay=`) 보낸다. 어느 쪽이든 **아픈 설비**(`?equip=`, 오류 먼저)를 함께 실어 도착 화면이
   * 그 베이·설비를 고른 채로 서게 한다(알람 딥링크와 같은 계약). 갈 곳이 아무 데도 없으면
   * (가공 등) 지도에서 그 베이를 연다.
   */
  const openFaultBay = useCallback(
    async (bay: FaultBay) => {
      setHoveredFaultBay(null)
      const zoneId = ZONE_ID_BY_PROCESS[bay.process]
      const provider = zoneId ? getProcessMapDrilldown(zoneId) : null
      let href: string | null = null
      if (provider) {
        const result = await provider.fetchLocations(bay.factory).catch(() => null)
        if (result?.kind === 'ok') {
          href = locationOfBay(result.locations, bay.lotCodes)?.detailPath ?? null
        }
      }
      href ??= zoneBayJumpHref(bay.process, bay.factory, bay.bayId)
      if (href) {
        const culprit = bay.equipment.find((e) => e.link === 'error') ?? bay.equipment[0]
        openPreview(
          /* 현황 축까지 싣는다 — '페이지로 열기' 로 창 밖에 나가도 실적이 아니라 설비 현황에 선다 */
          culprit ? withEquipmentLanding(href, culprit.id, STATUS_TAB) : withWorkspaceTab(href, STATUS_TAB),
          t('dashboard.map.preview.statusTitle', { name: `${bay.factory} ${bay.label}` })
        )
        return
      }
      applySelection({ kind: 'factory', name: bay.factory, bay: bay.bayId, location: null })
    },
    [applySelection, openPreview, t]
  )

  /*
   * 지도에 넘길 칸 묶음 — 지번 낱장 대신 **한 칸**으로 그릴 단위다.
   *
   * 작업 위치를 쓸 때, 지도 연결 키(`yardLotCodes`)가 없는 위치는 여기 들어오지 않는다:
   * 그리면 자리가 없는 칸이 생긴다. 그런 위치도 목록과 상세 이동은 그대로 되고 화면이
   * `지도 위치 정보 없음`이라고 말한다 (PRD §5.4·§7).
   */
  const lotGroups = useMemo<YardParcelLotGroup[]>(() => {
    if (mapUnitIsBay) {
      return focusedBays.map((bay) => ({
        id: bay.id,
        label: bay.label,
        lotCodes: [...bay.lotCodes],
      }))
    }
    return locations.flatMap((location) =>
      location.yardLotCodes?.length
        ? [{ id: location.id, label: location.displayName, lotCodes: location.yardLotCodes }]
        : []
    )
  }, [mapUnitIsBay, focusedBays, locations])

  /* 지도가 보는 선택·호버 — 칸이 베이인 화면에서는 베이 id 공간으로 옮겨 준다 */
  const mapSelectedUnit = mapUnitIsBay ? selectedBay : selectedLocation
  const mapHoveredUnit = mapUnitIsBay
    ? (hoveredBay ?? (hoveredLocation ? (bayLinks.bayIdOfLocation.get(hoveredLocation) ?? null) : null))
    : hoveredLocation

  /*
   * 지도의 칸 클릭 — 작업 위치면 지금까지처럼 곧장 상세로 가고, 베이면 **그 베이를 고른다**.
   * 이미 고른 베이를 한 번 더 눌러도 아무 일도 하지 않는다(사용자 확정) — 예전에는 재클릭이
   * 선택을 풀거나(한 단계 뒤로) 공정 상세 페이지로 나갔다. 상세는 베이 카드의 '현황' 이 연다.
   */
  const selectMapUnit = useCallback(
    (id: string) => {
      if (!mapUnitIsBay) {
        openLocation(id)
        return
      }
      if (selection?.kind === 'factory' && selection.bay === id) return
      applySelection(nextBaySelection(selection, id))
    },
    [mapUnitIsBay, openLocation, applySelection, selection]
  )

  const hoverMapUnit = useCallback(
    (id: string | null) => {
      if (mapUnitIsBay) setHoveredBay(id)
      else setHoveredLocation(id)
    },
    [mapUnitIsBay]
  )

  /*
   * 카메라가 날아갈 범위 — 베이를 고르면 그 베이, 공장이면 그 공장 지번, 공정이면 그
   * 공정 전체 지번. 없으면 홈(전체). 베이까지 내려가면 그 칸이 화면을 채워야 지번 이름을
   * 읽으며 상세 카드와 대조할 수 있다.
   *
   * 공장은 지번 범위를 그대로 쓰지 않고 군집 대비로 한 번 조인다(`factoryCameraBoundsOf`) —
   * 그래야 큰 공장(1DOCK)과 작은 공장이 비슷한 거리에 착지한다. 그 안의 베이도 **조인
   * 범위**를 기준으로 잰다: 조이기 전 범위로 재면 1DOCK 은 베이 하나가 공장만큼 커진다.
   */
  const focusBounds = useMemo<LatLonBounds | null>(() => {
    if (!parcels || !selection) return null
    if (selection.kind === 'process') return processAvoidingBounds ?? processBounds(parcels, selection.process)
    const factory = factoryCameraBoundsOf(parcels, selection.name)
    if (!factory) return null
    const bay = selection.bay ? parcels.bays.find((b) => b.id === selection.bay) : null
    if (!bay) return factory
    const around = boundsOfLots(parcels, bay.lotCodes)
    return around ? bayCameraBounds(around, factory, BAY_CAMERA_MIN_RATIO) : factory
  }, [parcels, selection, processAvoidingBounds])

  /*
   * 검색이 비추는 **자리들** — 재공 블록은 생애 단계에 따라 자리가 여럿이고(조립 중이면
   * ASSY 가 흩어진 공장마다 하나), **호선을 고르면 그 호선 블록 전부의 자리**가 함께 선다.
   * 야드 실측 위치는 점 하나다. 가공 중인 블록은 자리가 없어 빈 배열이고, 그러면 카메라도
   * 움직이지 않는다 — 갈 자리가 없는데 날아가면 아무 데나 도착한 것처럼 보인다.
   *
   * 자리마다 제 블록의 이름·링크를 달아 보낸다(마커가 어느 블록의 것인지 말해야 한다).
   */
  const searchSites = useMemo<FocusPin[]>(() => {
    if (!parcels || !mapFocus) return []
    if (mapFocus.yard) {
      const { yard } = mapFocus
      return [
        {
          id: `yard@${yard.id}`,
          zone: 'assembly' as const,
          factory: yard.lotLabel ?? '',
          assys: [],
          path: '',
          lat: yard.lat,
          lon: yard.lon,
          lotCodes: yard.lot ? [yard.lot] : [],
          bayResolved: false,
          label: mapFocus.label,
          to: performanceLinkFor({ projNo: yard.projNo, blocks: [yard.blkNo] }),
        },
      ]
    }
    return mapFocus.blocks.flatMap((block) => {
      const label = `${block.projNo}-${block.blockNo}`
      const to = performanceLinkFor({ projNo: block.projNo, blocks: [block.blockNo] })
      /* ASSY 를 포커스한 링크면 그 덩이의 자리만 — 나머지는 이 질문의 답이 아니다 */
      const sites = sitesOfBlock(block).filter(
        (site) =>
          mapFocus.assys.length === 0 ||
          site.assys.some((assy) => mapFocus.assys.includes(assy.assyNo))
      )
      return locateSites(parcels, sites).map((site) => ({ ...site, label, to }))
    })
  }, [parcels, mapFocus])

  /* 검색 카메라 자리 — 자리 전부를 담는 상자. 선택 카메라보다 우선한다 */
  const searchFocus = useMemo<LatLonBounds | null>(
    () => boundsOfSites(searchSites),
    [searchSites]
  )

  /*
   * 카메라 목표 — 검색 핀 > 선택 > 대문. 승계 글라이드 kick 이 오르면 **같은 목표를
   * 새 정체성으로** 다시 낸다: YardMap 은 focusBounds 의 참조가 바뀔 때만 굴리므로,
   * 승계 화각에서 제 프레이밍으로 넘어가는 첫 비행이 여기서 시작된다.
   */
  const focusTarget = searchFocus ?? focusBounds ?? overviewBounds
  /* 목표의 여백 — 첫 화각과 이후 비행이 같은 값을 써야 도착 프레이밍이 같다 */
  const focusPadding = searchFocus
    ? /* 블록 핀 주변 — 이웃 지번이 함께 남을 만큼 */
      0.35
    : selection?.kind === 'process'
      ? /* 카드를 피해 계산한 범위는 그 범위 그대로(여백 0) — 대문과 같다 */
        processAvoidingBounds
        ? 0
        : -0.04
      : selection?.kind === 'factory'
        ? /* 베이도 같은 여백을 쓴다 — 배율은 여백이 아니라 `bayCameraBounds` 의
             범위가 묶는다(베이 크기가 제각각이라 여백으로 묶으면 널뛴다) */
          0.12
        : /* 카드를 피해 계산한 대문은 그 범위 그대로(여백 0) — 계산이 여백까지 이미 담았다 */
          avoidingBounds
          ? 0
          : OVERVIEW_BOUNDS_PADDING
  /*
   * 카메라 기울기 — 야드 전경(무선택·검색 핀)과 공정(공장 목록)은 기본 기울기 그대로 건물로 서고,
   * **공장을 고른 때부터** 위에서 내려다보는 버드뷰로 눕는다(사용자 확정). 공장·베이는 칸·베이를
   * 짚는 단계라 지붕이 서로 가리지 않게 세워서 본다. 단계가 바뀔 때 카메라 이동과 함께 미끄러지듯 바뀐다.
   */
  const focusPitch = !searchFocus && selection?.kind === 'factory' ? DRILL_PITCH : OVERVIEW_PITCH
  const glidedFocusBounds = useMemo(
    () => (glideKick > 0 && focusTarget ? { ...focusTarget } : focusTarget),
    [glideKick, focusTarget]
  )

  /*
   * 지도에 넘길 공장 목록 — **참조를 안정되게** 따로 memo 한다. 이 배열이 매번 새로 나오면
   * YardMap 이 지번 정렬·공장 껍질·베이 지붕을 통째로 다시 세운다(한 번에 30~40ms) —
   * 호버 하나 바뀔 때마다 그 일이 일어나면 카메라가 눈에 띄게 끊긴다.
   */
  const layerFactories = useMemo(
    () =>
      parcels?.factories.map((factory) =>
        factory.name === '조립의장 1공장 BOS 1'
          ? {
              ...factory,
              /* 1~5 BAY 본동에서 6~7 BAY 상부동으로 이어지는 실제 꺾인 외곽. */
              footprintPolygon: [
                { lat: 34.874408, lon: 128.701226 },
                { lat: 34.87467, lon: 128.700836 },
                { lat: 34.875568, lon: 128.701724 },
                { lat: 34.876402, lon: 128.701632 },
                { lat: 34.876777, lon: 128.702001 },
                { lat: 34.876608, lon: 128.702253 },
                { lat: 34.876234, lon: 128.701883 },
                { lat: 34.875306, lon: 128.702114 },
              ],
            }
          : factory
      ) ?? [],
    [parcels]
  )


  /*
   * 공정 색 시안 — 시안이 바뀌면 지도에 넘기는 색 함수의 정체성을
   * 바꿔 다시 칠하게 한다(`colorOfProcess` 는 늘 지금 시안을 읽는다)
   */
  const paletteId = useProcessPaletteId()
  const processColorOfPalette = useMemo(() => {
    void paletteId
    return (process: string) => colorOfProcess(process)
  }, [paletteId])

  const parcelLayer = useMemo<YardParcelLayer | undefined>(() => {
    if (!parcels) return undefined
    return {
      lots: parcels.lots,
      factories: layerFactories,
      categoryColor: parcels.categoryColor,
      /* 샵 네비 룩: 공장 지번을 그 공정색 네온으로. 공정 카드 클릭이면 그 공정만,
       * 공장 클릭이면 그 공장(selected) + 같은 공정을 스포트라이트 (FR-5) */
      colorMode: 'process',
      processColor: processColorOfPalette,
      /* 대시보드 스포트라이트는 언제나 공정 하나 — 단일 원소 배열이 옛 단일 값과 등가다 */
      focusedProcesses: spotlight.focusedProcess ? [spotlight.focusedProcess] : null,
      focusedFactory: spotlight.focusedFactory,
      /* 같은 공정의 다른 공장은 크게 눌린 네온 — 고른 공장과 대비가 분명해야 한다.
         (FR-5 의 "동일 공정 45~60%" 는 고른 공장과 구분이 안 된다는 피드백으로 낮췄다) */
      relatedDimFactor: 0.18,
      /* 베이를 고르면 그 베이는 밝히고 같은 공장의 다른 베이는 어둡게 물린다 */
      bayFocusDim: 0.3,
      /* 손이 얹힌 공장·베이는 디밍을 벗고 한 단 더 밝게 — 누를 수 있는 곳이 먼저 보이게 */
      strongHover: true,
      /* 오른쪽 장애 목록에 손을 얹은 베이 — 어느 공장이든 그 칸을 맨 위에 짚는다 */
      spotLots: hoveredFaultBay?.lotCodes,
      /* 점검이 필요한 베이는 **늘** 짚어 둔다(사용자 확정) — 목록에 손을 얹을 때만 보이면
         지도만 보는 사람은 장애 베이를 모른다. 손을 얹은 베이는 위 spotLots 가 한 번 더 */
      spotGroups: faultSpotGroups,
      spotPins: faultPins,
      /* 핀 머리 주위의 고리를 깜빡인다(사용자 확정) */
      spotPinBlink: true,
      spotHighlight: faultHighlight,
      onHoverSpotGroup: hoverSpotGroup,
      /*
       * 핀·하이라이트를 누르면 — 누른 베이가 **지금 선택된 그 베이**면 현황 화면을 창으로 띄우고,
       * 아니면 그 베이를 고른다(지도에서 베이를 누른 것과 같은 자리: 공장 › 베이 카드, 카메라가
       * 베이로). 다른 베이를 보던 중에 누른 핀도 먼저 그 베이로 데려간다(사용자 확정).
       */
      onSelectSpotGroup: (index: number) => {
        const bay = faultBays[index]
        if (!bay) return
        setHoveredSpot(null)
        if (selectedBay === bay.bayId) void openFaultBay(bay)
        /* 가공 공장 핀은 공장까지만 고른다 — 베이로 내려가지 않는다 */
        else if (isBaylessProcess(processOfFactory(bay.factory))) applySelection({ kind: 'factory', name: bay.factory })
        else applySelection({ kind: 'factory', name: bay.factory, bay: bay.bayId })
      },
      /* 핀이 겹친 패널 밑으로 숨지 않게 — 오른쪽 장애 목록(23rem), 왼쪽 카드(목록 18rem / 상세 28rem) */
      spotSafeArea: wide
        ? {
            /* 오른쪽 위의 핀·하이라이트 토글 — 높이만 피하면 된다(top) */
            right: 24,
            /* 왼쪽 카드 — 공장 목록은 좁게(18rem), 공장·BAY 상세는 28rem(글자를 키운 뒤에도 작업 칩이 가장 많은
               베이 줄에 점검 필요 칩까지 한 줄에 들도록). 한 카드에서 내용만 갈아 끼워진다 */
            /* 왼쪽 카드는 공장·베이를 골랐을 때 선다(28rem) */
            left: focusedFactory ? 28 * 16 + 24 : 24,
            top: 96,
          }
        : undefined,
      /* 지번이 나뉜 형태를 연하게 남긴다(2D·3D 공통) — 야드가 구역으로 읽히게 */
      lotOutlineOpacity: 0.1,
      /* 고른 공장 안을 나누는 칸 — 베이 매핑이 있으면 베이, 없으면 공정 모듈의 작업 위치 */
      lotGroups: lotGroups,
      /* 공장을 이루는 스팬 — 3D 에서 베이마다 세모 지붕이 서고 공장 외곽선이 그것을 묶는다.
         건물이 아닌 베이(옥외 적치장 줄)는 빠져 지면으로 남는다 */
      factoryBays,
      /* 고른 공장 안의 칸 — 지붕 위 구분선 + 눌린 칸 강조 + 클릭/호버 */
      selectedLot: mapSelectedUnit,
      hoveredLot: mapHoveredUnit,
      /* 블록 검색이 고른 블록이 선 지번 — 핀(점)에 자리 문맥(칸)을 더한다 */
      /* 고른 블록이 선 지번 — 핀(점)에 자리 문맥(칸)을 더한다. 자리가 여럿일 때는
         한 칸만 밝히면 나머지가 덜 중요해 보이므로, 자리가 하나일 때만 밝힌다. */
      highlightedLot: searchSites.length === 1 ? (searchSites[0].lotCodes[0] ?? null) : null,
      hoveredFactory,
      /* 고른 공장의 이름은 지붕에서 일어나 떠오른다 — 캔버스는 그 자리를 비운다 */
      floatingFocusedLabel: focusedFactory != null,
      /* 베이도 같다 — 고르면 그 이름이 지붕에서 일어나 패로 뜬다(FactoryHudLabel) */
      floatingSelectedBayLabel: true,
      /* 공장 이름은 핀처럼 늘 화면 정면으로(사용자 확정) — 지도를 돌리고 기울여도 똑바로 읽힌다 */
      billboardLabels: true,
      /* 고른 공장 칠 — 네 공정 모두 조금 낮추고 의장(주황)·도장(분홍)은 더 옅게(사용자 확정) */
      selectedFillScale: SELECTED_FILL_SCALE,
      /*
       * 빈 곳 클릭은 null 로 온다 = **한 단계만** 뒤로.
       *
       * 공장·베이를 고른 동안에도 **다른 공장을 누르면 그 공장으로** 간다(사용자 확정 — 공정이
       * 달라도. 예전에는 다른 공정의 공장을 빈 곳으로 쳐서, 누른 공장이 무시되고 한 단계 뒤로
       * 물러났다). 베이까지 내려와 있으면 누른 자리의 **베이로** 바로 간다 — 보던 깊이를 지킨다.
       */
      onSelectFactory: (name: string | null, lot?: string) => {
        if (!name) {
          stepBack()
          return
        }
        /* 공정 목록(무선택)에서는 공장을 곧바로 열지 않고 **그 공장의 공정(공장 목록)으로** 간다
           (사용자 확정) — 공정 목록 › 공장 목록 › 공장 계단을 지도 클릭도 한 칸씩 밟는다 */
        if (selection == null) {
          const process = processOfFactory(name)
          if (process) {
            applySelection({ kind: 'process', process })
            return
          }
        }
        const bayId = selectedBay && lot ? bayIdOfLot.get(lot) : undefined
        if (bayId) applySelection({ kind: 'factory', name, bay: bayId })
        else selectFactory(name)
      },
      onHoverFactory: setHoveredFactory,
      onSelectLot: selectMapUnit,
      onHoverLot: hoverMapUnit,
    }
  }, [
    parcels,
    layerFactories,
    spotlight,
    hoveredFactory,
    selectFactory,
    stepBack,
    bayIdOfLot,
    mapSelectedUnit,
    mapHoveredUnit,
    selectMapUnit,
    hoverMapUnit,
    lotGroups,
    factoryBays,
    mapUnitIsBay,
    hoveredFaultBay,
    faultSpotGroups,
    faultPins,
    faultHighlight,
    hoverSpotGroup,
    faultBays,
    applySelection,
    openFaultBay,
    processOfFactory,
    wide,
    selectedBay,
    focusedFactory,
    searchSites,
    processColorOfPalette,
    selection,
  ])

  const selectedFactoryData = useMemo(() => {
    if (!parcels || selection?.kind !== 'factory') return null
    return summarizeFactory(parcels, selection.name)
  }, [parcels, selection])

  /* 공장 상세의 본문 — 그 공장의 베이별 **재실**(P1 ①). 원천은 로스터의 자리 */
  /* 공장 이름에만 매단다 — 베이를 골라도 공장 재실·진행 상태를 다시 읽지 않게 */
  const selectedFactoryName = selection?.kind === 'factory' ? selection.name : null
  /* 가공 공장 카드에는 베이 목록이 없다(사용자 확정) — 대신 그 공장에서 가공 중인 블록을 공장 단위로 */
  const selectedFactoryOccupants = useMemo(
    () =>
      selectedFactoryName && isBaylessProcess(processOfFactory(selectedFactoryName))
        ? fabricationOccupantsOf(selectedFactoryName)
        : [],
    [selectedFactoryName, processOfFactory]
  )
  const selectedFactoryBays = useMemo(
    () =>
      parcels && selectedFactoryName && !isBaylessProcess(processOfFactory(selectedFactoryName))
        ? factoryBayOccupancy(parcels, selectedFactoryName)
        : [],
    [parcels, selectedFactoryName, processOfFactory]
  )

  /*
   * 재실의 **진행 상태** — 놓였다고 작업 중인 것은 아니다(`occupantProgress`). 공장 카드의
   * '진행 작업' 수와 베이 카드의 상태 표식이 같은 값을 본다. 실적 배지와 같은 기준일(오늘).
   */
  const [occupantProgress, setOccupantProgress] = useState<ReadonlyMap<string, OccupantProgress>>(
    () => new Map()
  )
  useEffect(() => {
    let alive = true
    setOccupantProgress(new Map())
    const occupants = [...selectedFactoryBays.flatMap((bay) => bay.occupants), ...selectedFactoryOccupants]
    if (occupants.length === 0) return
    const d = nowDate()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    void loadOccupantProgress(occupants, today).then((progress) => {
      if (alive) setOccupantProgress(progress)
    })
    return () => {
      alive = false
    }
  }, [selectedFactoryBays, selectedFactoryOccupants])

  /*
   * 공장 목록의 줄마다 **진행 작업 수** — 공장 카드 '진행 작업' 합과 같은 규칙(`workingCountOf`).
   * 야드 전체의 재실과 그 진행 상태를 한 번 읽는다(로스터·실적이 고정 mock 이라 지도가 설 때
   * 한 번이면 된다). 다 읽기 전에는 목록에 수를 내지 않는다.
   */
  const [factoryWorkCounts, setFactoryWorkCounts] = useState<ReadonlyMap<string, number> | undefined>()
  /* 공장 → 작업 상태별(작업 중 · 작업 전 · 작업 완료) 블록 수 — 공장 hover 카드(같은 읽기에서 센다) */
  const [factoryGroupCounts, setFactoryGroupCounts] = useState<
    ReadonlyMap<string, Readonly<Record<OccupantGroup, number>>> | undefined
  >()
  useEffect(() => {
    if (!parcels) return
    let alive = true
    const mapped = new Set(parcels.bays.map((bay) => bay.factory))
    const occupantsByFactory = new Map(
      [...mapped].map((name) => [name, factoryBayOccupancy(parcels, name).flatMap((bay) => bay.occupants)])
    )
    const d = nowDate()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    void loadOccupantProgress([...occupantsByFactory.values()].flat(), today).then((progress) => {
      if (!alive) return
      setFactoryWorkCounts(
        new Map([...occupantsByFactory].map(([name, occupants]) => [name, workingCountOf(occupants, progress)]))
      )
      setFactoryGroupCounts(
        new Map(
          [...occupantsByFactory].map(([name, occupants]) => {
            const counts: Record<OccupantGroup, number> = { inProgress: 0, notStarted: 0, done: 0 }
            for (const o of occupants) counts[occupantGroupOf(o, progress.get(occupantProgressKey(o)))] += 1
            return [name, counts]
          })
        )
      )
    })
    return () => {
      alive = false
    }
  }, [parcels])

  /* 고른 베이의 재실 — 베이 상세의 본문. 공장 목록의 그 행과 같은 값이다 */
  const selectedBayOccupancy = useMemo(
    () => (parcels && selectedBay ? bayOccupancyOf(parcels, selectedBay) : null),
    [parcels, selectedBay]
  )

  /* 베이 행 클릭 = 그 베이로 드릴인 — 지도의 베이 클릭과 같은 계단(URL 문법) */
  const openBay = useCallback(
    (bayId: string) => applySelection(nextBaySelection(selection, bayId)),
    [applySelection, selection]
  )

  /*
   * 왼쪽 카드의 공장 목록 줄 — 지도의 공장 클릭과 같은 동작(`selectFactory`). 목록은 그
   * 자리에서 공장 상세로 갈아 끼워지므로, 사라진 줄에 남은 호버도 함께 걷는다.
   */
  const selectNavFactory = useCallback(
    (name: string) => {
      setHoveredFactory(null)
      setNavHoveredFactory(null)
      selectFactory(name)
    },
    [selectFactory]
  )

  /* 고른 베이의 상세 — 소속 지번과 그 **원본 설명**. 매핑에 없는 베이면 null */
  const selectedBayData = useMemo(
    () => (parcels && selectedBay ? summarizeBay(parcels, selectedBay) : null),
    [parcels, selectedBay]
  )


  /* 같은 뎁스는 앱 헤더가 아니라 카드 머리(`CardTrail`)가 말한다 — 아래 `cardTrailSteps` */

  /*
   * 떠 있는 이름패가 설 자리 — 가로는 고른 공장의 지번 centroid, 세로는 그 공장 **실루엣
   * 위**다. 실루엣을 재려면 소속 지번의 꼭짓점이 필요하므로 여기서 함께 모아 넘긴다.
   */
  const hudFactory = useMemo(() => {
    if (!parcels || !focusedFactory) return null
    /*
     * 베이까지 내려가면 이름패는 물러난다 — 그 단계의 주인공은 지붕 위에 붙은 베이 패이고,
     * 카메라가 베이로 바싹 붙으면 공장 centroid 는 화면 구석으로 밀려 패가 상단 카드와
     * 겹친다. 한 화면에 떠 있는 이름은 하나면 된다(공장 이름은 카드 머리가 이어받는다).
     */
    if (selectedBay) return null
    const factory = parcels.factories.find((f) => f.name === focusedFactory)
    if (!factory) return null
    const codes = new Set(factory.lotCodes)
    const outline = parcels.lots.flatMap((lot) =>
      codes.has(lot.lot) || lot.factory === factory.name ? lot.polygon : []
    )
    return { factory, outline }
  }, [parcels, focusedFactory, selectedBay])

  /*
   * 베이까지 내려갔을 때의 이름패 — 공장 패가 물러난 자리를 그 베이가 잇는다.
   *
   * 공장에서 하던 것과 **같은 동작**이다: 지붕에 누워 있던 이름이 일어서 뜨고, 그 밑에
   * 다음 걸음(그 베이의 작업 위치 상세)으로 나가는 문이 붙는다. 지도에서 칸을 눌렀는데
   * 들어가는 문은 왼쪽 카드에서 찾아야 했던 것을, 누른 자리에서 끝나게 하는 것이다.
   */
  const hudBay = useMemo(
    () => (parcels && selectedBay ? bayHudTarget(parcels, selectedBay) : null),
    [parcels, selectedBay]
  )
  /* 이 베이로 들어가는 문의 목적지 — 지번이 겹치는 작업 위치. 짝이 없으면 문은 서지 않는다 */
  const hudBayLocation = hudBay ? (bayLinks.locationOfBayId.get(hudBay.id) ?? null) : null



  /*
   * 좁은 화면에서 상세 카드는 지도 아래에 선다 — 지도에서 공장을 눌렀는데 카드가 화면
   * 밖이면 누른 것이 아무 반응도 없었던 것처럼 보인다. `nearest` 라서 이미 보이는
   * 경우에는 화면을 흔들지 않는다.
   */
  const stackedPanelsRef = useRef<HTMLDivElement>(null)
  const openDetailKey = selectedBay ?? focusedFactory ?? null
  useEffect(() => {
    if (wide || !openDetailKey) return
    stackedPanelsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [wide, openDetailKey])

  /* 고른 베이의 현황 주소 — 짝지은 작업 위치(조립 정반현황)가 있으면 거기, 없으면 공정 화면에
     베이를 실어(`?bay=`) 보낸다. 머리의 '현황'·점검 필요 목록·오른쪽 목록이 같은 착지다.
     현황 축까지 싣는다 — 공정 화면의 기본 갈래는 실적이라, '페이지로 열기' 로 창 밖에 나가면
     축을 말하지 않은 주소는 실적에 선다 */
  const selectedBayBaseHref = selectedBayData
    ? (bayLinks.locationOfBayId.get(selectedBayData.id)?.detailPath ??
      zoneBayJumpHref(selectedBayData.process, selectedBayData.factory, selectedBayData.id))
    : null
  const selectedBayStatusHref = selectedBayBaseHref ? withWorkspaceTab(selectedBayBaseHref, STATUS_TAB) : null
  /* 고른 공장의 현황 주소 — 베이와 같은 이유로 현황 축까지 싣는다 */
  const selectedFactoryJumpHref = selectedFactoryData
    ? zoneJumpHref(selectedFactoryData.process, selectedFactoryData.name)
    : null
  const selectedFactoryStatusHref = selectedFactoryJumpHref
    ? withWorkspaceTab(selectedFactoryJumpHref, STATUS_TAB)
    : null
  /* 고른 베이의 점검 필요 설비 — 오른쪽 목록과 같은 원천(`faultBays`) */
  const selectedBayFaults = useMemo(
    () => (selectedBay ? (faultBays.find((bay) => bay.bayId === selectedBay)?.equipment ?? []) : []),
    [faultBays, selectedBay]
  )

  /*
   * 카드 머리의 뎁스 경로 — 카드 제목까지 온 길. 앱 헤더에 잇던 것을 카드 위로 옮겼다
   * (사용자 확정). 공정은 이제 카드 한 단계(그 공정의 공장 목록)라 누를 수 있는 조각이다.
   * 뎁스: 공장 목록 › 조립 › PBS (제목 5BAY).
   */
  /*
   * 지도의 공장·베이에 손을 얹으면 커서 옆에 그 정보를 띄운다(사용자 확정, `MapHoverCard`) —
   * 왼쪽 카드가 펼쳐져 있어도 늘 뜬다. 베이는 고른 공장 안의 칸만 손이 닿는다(지도의 베이
   * 호버 규칙 그대로). 점검 필요 핀·하이라이트 위에서는 그쪽 카드가 먼저다.
   */
  const hoverInfo = useMemo<MapHoverInfo | null>(() => {
    if (!wide || !parcels) return null
    if (mapUnitIsBay && hoveredBay) {
      const bay = parcels.bays.find((b) => b.id === hoveredBay)
      if (!bay) return null
      const occupants = bayOccupancyOf(parcels, hoveredBay)?.occupants ?? []
      /* 작업 상태별 블록 수 — 베이 카드의 작업 목록과 같은 규칙(작업 중 · 작업 전 · 작업 완료) */
      const groups: Record<OccupantGroup, number> = { inProgress: 0, notStarted: 0, done: 0 }
      for (const o of occupants) groups[occupantGroupOf(o, occupantProgress.get(occupantProgressKey(o)))] += 1
      return {
        kind: 'bay',
        factory: bay.factory,
        label: bay.label,
        process: processOfFactory(bay.factory) ?? '',
        groups,
        fault: faultBays.find((f) => f.bayId === hoveredBay) ?? null,
      }
    }
    if (!hoveredFactory) return null
    return {
      kind: 'factory',
      name: hoveredFactory,
      process: processOfFactory(hoveredFactory) ?? '',
      groups: factoryGroupCounts?.get(hoveredFactory),
      faultBays: factoryFaultCounts.get(hoveredFactory) ?? 0,
    }
  }, [
    wide,
    parcels,
    mapUnitIsBay,
    hoveredBay,
    hoveredFactory,
    occupantProgress,
    processOfFactory,
    faultBays,
    factoryGroupCounts,
    factoryFaultCounts,
  ])
  /* 지도 위 마지막 커서 자리 — hover 카드가 첫 프레임부터 제자리에 서게(상태가 아니라 ref) */
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)

  const cardTrailSteps = useMemo<CardTrailStep[]>(() => {
    if (!selection) return []
    const steps: CardTrailStep[] = [
      { key: 'list', label: t('dashboard.map.factoryNav.title'), href: drill.hrefFor(YARD_DRILLDOWN) },
    ]
    if (selection.kind === 'process') return steps
    const process = processOfFactory(selection.name)
    if (process) {
      steps.push({ key: 'process', label: process, href: drill.hrefFor({ ...YARD_DRILLDOWN, process }) })
    }
    if (selection.bay) {
      steps.push({
        key: 'factory',
        label: selection.name,
        href: drill.hrefFor({ ...YARD_DRILLDOWN, factory: selection.name }),
      })
    }
    return steps
  }, [selection, drill, t, processOfFactory])

  const detailCard = selectedBayData ? (
    <BayDetailCard
      bay={selectedBayData}
      locationNoun={drilldown ? t(drilldown.locationNounKey) : t('dashboard.map.locationNoun')}
      /* linkedLocation 을 주지 않는다 — 카드 맨 아래 '현황 열기'·'통합실적' 문은 걷었다.
         현황은 머리의 '현황', 실적은 블록마다의 '실적' 이 맡는다 */
      /* 총괄 화면은 지번 표면을 내지 않는다 — 드릴다운은 공장→베이까지, 지번은 야드 몫 */
      showLotList={false}
      /* 면적·옥내외 같은 기준정보도 내지 않는다(P1 ①) — 이 카드의 본문은 아래 재실이다 */
      showMetrics={false}
      trail={<CardTrail steps={cardTrailSteps} className="mb-5.5" />}
      /* 머리의 '현황' — 짝지은 작업 위치(조립 정반현황)가 있으면 거기, 없으면 공정 화면에
         베이를 실어(`?bay=`) 보낸다. 문제 BAY 목록과 같은 착지 규칙이다 */
      statusHref={selectedBayStatusHref}
      onOpenStatus={openPreview}
      /* 머리의 '3D'·'실적' — 블록을 고르지 않은 이 베이의 3D 탭·블록실적 탭
         (조립 정반 / 의장 베이). 도장은 3D 축이 없어 '실적'(현황 › 블록·실적)만 선다 */
      viewerHref={bayTabHref(
        selectedBayOccupancy?.occupants ?? [],
        bayLinks.locationOfBayId.get(selectedBayData.id)?.detailPath ?? null,
        VIEWER_TAB
      )}
      blocksHref={
        bayTabHref(
          selectedBayOccupancy?.occupants ?? [],
          bayLinks.locationOfBayId.get(selectedBayData.id)?.detailPath ?? null,
          BLOCKS_TAB
        ) ?? paintingBayBlocksJumpHref(selectedBayData.process, selectedBayData.factory, selectedBayData.id)
      }
      /* 이 베이의 설비 장애 — '현황' 옆에 (공장 카드와 같은 자리) */
      /* 이름 옆 '점검 필요' 표시는 두지 않는다(사용자 확정) — 아래 점검 필요 목록이 말한다 */
    >
      {/* 이 베이에 서 있는 것 — 상세의 본문(P1 ①). 로스터의 자리가 원천이다 */}
      <BayOccupantList
        occupants={selectedBayOccupancy?.occupants ?? []}
        progress={occupantProgress}
        onPreview={openPreview}
        className="mb-2"
      />
      {/* 작업 목록 아래 — 이 베이의 점검 필요 설비. 줄을 누르면 그 설비를 짚은 현황 창 */}
      <BayFaultList
        process={selectedBayData.process ?? ''}
        equipment={selectedBayFaults}
        onOpen={(equipment) => {
          if (!selectedBayStatusHref) return
          openPreview(
            withEquipmentFocus(selectedBayStatusHref, equipment.id),
            t('dashboard.map.preview.statusTitle', { name: `${selectedBayData.label} ${equipment.id}` })
          )
        }}
        className="mb-2 mt-3"
      />
      {/* 판별 기반 실적 카드는 걷었다 — 블록마다의 '실적' 문이 통합실적으로 데려간다 */}
    </BayDetailCard>
  ) : selectedFactoryData ? (
    <FactoryDetailCard
      data={selectedFactoryData}
      trail={<CardTrail steps={cardTrailSteps} className="mb-5.5" />}
      statusHref={selectedFactoryStatusHref}
      /* '3D'·'실적' — 그 공장 공정 화면의 3D 탭·블록실적 탭 (조립·의장만) */
      viewerHref={zoneTabJumpHref(selectedFactoryData.process, selectedFactoryData.name, VIEWER_TAB)}
      blocksHref={factoryPerformanceHref(selectedFactoryData.process, selectedFactoryData.name)}
      onOpenStatus={openPreview}
      bays={selectedFactoryBays}
      occupants={selectedFactoryOccupants}
      progress={occupantProgress}
      equipmentFaults={equipmentFaults}
      onOpenBay={openBay}
      onHoverBay={setHoveredBay}
    />
  ) : null

  /* 왼쪽 카드의 앞 두 단계 — 공정 목록(무선택), 그 공정의 공장 목록(`?process=`) */
  const selectedProcess = selection?.kind === 'process' ? selection.process : null
  const navCard = parcels ? (
    <FactoryNavPanel
      factories={parcels.factories}
      process={selectedProcess}
      trail={<CardTrail steps={cardTrailSteps} />}
      workCounts={factoryWorkCounts}
      faultCounts={factoryFaultCounts}
      onSelectProcess={(process) => applySelection({ kind: 'process', process })}
      onSelectFactory={selectNavFactory}
      onHoverFactory={(name) => {
        setHoveredFactory(name)
        setNavHoveredFactory(name)
      }}
    />
  ) : null
  /* 카드 내용의 단계 — 바뀔 때마다 새 내용이 살짝 떠오른다 */
  const cardStep = selectedBayData
    ? 'bay'
    : selectedFactoryData
      ? 'factory'
      : selectedProcess
        ? `process:${selectedProcess}`
        : 'list'

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      {/*
        지도 상자. 넓은 화면에서는 남은 높이를 다 쓰고(패널이 그 위에 뜬다), 좁은 화면에서는
        아래에 선 패널이 화면 밖으로 밀리지 않도록 높이를 덜어 준다.
      */}
      <div
        ref={mapBoxRef}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          lastPointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        }}
        data-tour="dashboard-map"
        className="relative min-h-0 w-full overflow-hidden rounded-inshop-xl border border-border bg-[#0b0f14] max-md:h-[min(60vh,34rem)] max-md:min-h-[22rem] md:flex-1"
      >
        {/* 지도 — 준비되면 붙는다. 그 전엔 패널이 먼저 서 있고 여기만 로딩 표시 */}
        {data?.backdrop && parcelLayer && basemapLayers ? (
          <YardMap
            lots={NO_LOTS}
            blocks={NO_BLOCKS}
            moves={NO_MOVES}
            plans={NO_PLANS}
            basemapLayers={basemapLayers}
            extent={data.backdrop.extent}
            /* 최대 축소 한도 — 대문이 지도를 돌려(-30°) 모든 공장을 카드 밖에 담으려면 35,000 보다
               더 물러나야 해서 낮췄다(사용자 확정). 한도에 걸리면 외곽 공장이 카드 밑에 남는다 */
            minScale={20_000}
            maxScale={900_000}
            colorOfCategory={NO_CATEGORY_COLOR}
            layers={MAP_LAYERS}
            /* 지도 영역은 라이트 테마에서도 다크 베이스맵 — 어두운 바탕이라야 네온이 산다. */
            mapTheme="dark"
            viewMode="3d"
            onViewChange={(view: YardView, viewport: Viewport) => {
              cameraRef.current = { view, viewport }
              /* 마지막 화각 — 다른 화면에 다녀오면 여기로 돌아온다 */
              rememberYardCamera(view, searchRef.current)
              /* 카메라가 움직이면 hover 카드가 가리키던 자리가 떠난다 — 다음 손짓이 다시 띄운다 */
              setHoveredSpot((prev) => prev && null)
              hudRef.current?.updateView(view, viewport)
              cameraReadoutRef.current?.updateView(view)
              searchPinRef.current?.updateView(view, viewport)
            }}
            lotOpacity={0.7}
            parcels={parcelLayer}
            /* 첫 화각 = **지금 주소가 가리키는 자리**(카메라 목표). 선택이 없으면 대문 —
             * 공장 밀집 구역이 홈이고, 음수 패딩은 범위보다 한 발 안으로 들어간 카메라다.
             * 예전엔 늘 대문으로 시작했는데, YardMap 은 첫 focusBounds 를 "이미 본 것"으로
             * 넘기므로 뒤로 가기·딥링크로 공장·베이를 연 채 들어오면 카드는 베이를 말하는데
             * 카메라는 대문에 남았다. YardMap 이 이 값을 마운트 때 한 번만 읽으므로, 그 뒤의
             * 선택 변경은 지금처럼 focusBounds 비행이 맡는다. */
            initialBounds={focusTarget}
            initialBoundsPadding={focusPadding}
            initialPitch={focusPitch}
            initialBearing={MAP_BEARING}
            /* 공정 맵에서 이어 온 화각 — 있으면 첫 프레임이 그 자리에서 시작한다 */
            initialView={handoffView ?? restoredView}
            /* 돌아온 화각을 붙드는 동안은 비행 목표를 비운다(위 `holdSearch`) */
            focusBounds={holdingCamera ? null : glidedFocusBounds}
            focusBoundsPadding={focusPadding}
            focusBoundsPitch={focusPitch}
            focusBoundsBearing={MAP_BEARING}
            /* 각도는 단계가 정하고(전경 · 하위 단계 버드뷰), 그 사이에는 사용자가 돌리고 기울일 수
               있다(사용자 확정 — 오른쪽 끌기 또는 Shift+끌기). 단계를 옮기면 그 단계 각도로 돌아간다 */
            parcelSpotlightDuration={0}
            showFacilityLabels={false}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-inshop-sm text-white/45">
            {t('dashboard.map.loading')}
          </div>
        )}

        {/* 고른 블록의 자리 마커들 — 카메라를 따라 imperative 로만 움직인다.
            누르면 어느 자리든 그 블록의 통합실적으로 간다. */}
        {mapFocus && (
          <BlockSitePins
            key={mapFocus.label}
            ref={searchPinRef}
            sites={searchSites}
            initialCamera={cameraRef.current}
          />
        )}

        {/* 지도 위 가운데 — 지금 카메라 값. 누르면 JSON 으로 복사(사용자 요청) */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <CameraReadout ref={cameraReadoutRef} />
        </div>

        {/* 점검 필요 핀·하이라이트 hover 카드 — 베이와 점검이 필요한 장비 */}
        {hoveredSpot && faultBays[hoveredSpot.index] && (
          <FaultSpotTooltip
            bay={faultBays[hoveredSpot.index]}
            x={hoveredSpot.x}
            y={hoveredSpot.y}
            boxWidth={hoveredSpot.boxWidth}
          />
        )}

        {/* 왼쪽 카드를 접어 둔 동안의 공장·베이 hover 카드 — 점검 필요 hover 카드가 먼저다 */}
        {hoverInfo && !hoveredSpot && (
          <MapHoverCard
            key={hoverInfo.kind === 'bay' ? `bay:${hoverInfo.label}` : `factory:${hoverInfo.name}`}
            info={hoverInfo}
            boxRef={mapBoxRef}
            initial={lastPointerRef.current}
          />
        )}

        {/* 고른 공장의 떠 있는 이름패. key 가 공장이라, 공장을 갈아타면 떠오름이 다시 연주된다 */}
        {hudFactory && (
          <FactoryHudLabel
            key={hudFactory.factory.name}
            ref={hudRef}
            name={hudFactory.factory.name}
            anchor={hudFactory.factory.labelAnchor}
            outline={hudFactory.outline}
            color={colorOfProcess(hudFactory.factory.process)}
            caption={
              focusedBays.length > 0
                ? t('dashboard.map.bayCount', { count: focusedBays.length })
                : (hudFactory.factory.process || undefined)
            }
            initialCamera={cameraRef.current}
            /* 이름패 클릭 = 드릴인 (P1 ③) — 지도 폴리곤을 누르는 것과 같은 동작.
               이미 그 공장이 열려 있어도 selectFactory 는 선택을 유지한다(전이 함수) */
            onSelect={() => selectFactory(hudFactory.factory.name)}
            /* 패 밑의 '공정 화면 열기' 문은 걷었다 — 카드 머리의 '현황' 이 같은 곳으로 간다 */
          />
        )}

        {/* 고른 베이의 떠 있는 이름패 — 공장 패와 같은 층·같은 몸짓. 둘은 동시에 서지
            않는다(공장 패는 베이를 고르면 물러난다) */}
        {hudBay && (
          <FactoryHudLabel
            key={hudBay.id}
            ref={hudRef}
            name={hudBay.name}
            anchor={hudBay.anchor}
            outline={hudBay.outline}
            color={hudBay.process ? colorOfProcess(hudBay.process) : '#9a9890'}
            /* 공장 이름은 패가 물러났으므로 여기서 문맥을 잇는다 — 어느 공장의 몇 베이인가 */
            caption={hudBay.process ? `${hudBay.factory} · ${hudBay.process}` : hudBay.factory}
            initialCamera={cameraRef.current}
            /* 패 클릭 = 그 베이의 작업 위치 상세로 — 갈 곳이 없으면 누를 수 없는 표식으로 남는다 */
            onSelect={
              hudBayLocation ? () => navigate(hudBayLocation.detailPath) : undefined
            }
            /* 패 밑의 '현황 열기' 문은 걷었다 — 카드 머리의 '현황' 이 같은 곳으로 간다 */
          />
        )}

        {/*
         * 지도 위 오버레이는 **하나의 격자**다 — 왼쪽 기둥(제목·현 위치·상세·안내·미니맵)과
         * 오른쪽 기둥(공정존 패널). 예전엔 이것들이 저마다 `top-[8.25rem]`·`bottom-[12.5rem]`
         * 같은 손계산으로 떠 있어서, 화면이 짧아지면 안내문이 상세 카드 위로 올라타고 카드
         * 내용은 줄 중간에서 잘렸다. 자리는 계산이 아니라 **흐름**이어야 한다: 격자와
         * `gap` 이 간격을 맡고, 남는 높이는 상세 카드가 가져가며(`flex-1`), 그래도 모자라면
         * 카드가 제 안에서 스크롤한다.
         *
         * 왼쪽 칸은 `minmax(0,1fr)` 이라 오른쪽 패널 자리를 결코 침범하지 않는다.
         */}
        <div className="pointer-events-none absolute inset-3 z-10 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="flex min-h-0 min-w-0 flex-col items-start gap-2.5">
            {/* 지도 위 자취는 걷었다 — 같은 뎁스는 왼쪽 카드 머리(`CardTrail`)가 말한다 */}

            {/*
              제목패('전체 현황' + '4개 공정존…')는 걷었다 (P1 ④/R21) — 헤더의 현재 위치와
              브레드크럼이 이미 같은 말을 하고 있었고, 지도 왼쪽 위는 안내문이 아니라
              지금 보고 있는 것에 내줄 자리다.

              '현 위치' 버튼도 걷었다 — 전부 풀고 대문으로 돌아가는 문은 브레드크럼의
              '야드' 조각 하나면 된다(공정 화면의 '전체 보기'와 같은 뜻·같은 한 개).
            */}

            {/*
              기준일이 되감긴 채 들어왔을 때의 한 줄 단서 (P1 ⑤).
              지도가 그리는 재실·마커는 **지금**의 사실이라 조회 기준일을 따라가지 않는다 —
              그 어긋남을 말하지 않으면 사용자는 지도가 과거를 보여 준다고 읽는다.
            */}
            {!isToday && (
              <p className="pointer-events-auto max-w-full shrink-0 rounded-inshop-md border border-white/10 bg-[#0b0e12]/85 px-2.5 py-1.5 text-2xs text-white/62 backdrop-blur-md">
                {t('dashboard.map.liveNote', { date: baseDate })}
              </p>
            )}

            <div className="flex max-w-full shrink-0 flex-wrap items-start gap-2">
            {/* 검색 — 팔레트(Cmd+K)와 **같은 모듈**의 임베드 변형(같은 색인·같은 결과 줄).
                '현 위치' 버튼은 R21 로 제거됨 — 복귀 문은 브레드크럼 '야드' 하나다. */}
            <SearchField data-tour="block-search" />
            </div>

            {/* 지금 지도가 무엇을 비추는지 — 주소가 정본이라 팔레트에서 고른 것도 여기 선다 */}
            {mapFocus && (
              <MapFocusCard
                focus={mapFocus}
                onClear={() => void navigate(`/indoorshop${clearMapFocusSearch(searchParams)}`)}
              />
            )}

            {/* 선택한 공장(또는 그 안의 베이) 상세 — 공정존 탐색을 가리지 않도록 지도 왼쪽에
                둔다. 베이를 고르면 같은 자리를 베이 상세가 이어받는다(두 카드를 나란히
                세우면 지도를 반쯤 덮고, 어느 쪽이 지금 이야기인지도 흐려진다).
                남는 높이를 전부 가져가되(`flex-1`), 넘치는 내용은 카드 안에서 스크롤한다. */}
            {/* 왼쪽 카드는 **공장·베이를 골랐을 때** 선다(사용자 확정 — 공장 카드를 되살렸다). 대문·공정
                단계에는 카드가 없고, 그 단계의 정보는 지도 hover 카드(`MapHoverCard`)가 말한다. 접기·펴기도, 지금
                단계를 적은 탭도, 닫기(×)도 두지 않는다 — 빈 곳 클릭·ESC 가 한 단계 뒤로 간다.
                자리는 고정이다(끌어 옮기지 않는다) */}
            {wide && parcels && detailCard && (
              /* 이 상자는 남는 높이를 다 받는다(카드가 길면 그 안에서 스크롤하도록) — 그래서 상자
                 자체는 클릭을 **통과**시킨다. 눈에 보이는 카드(section)만 클릭을 받고, 카드 아래
                 빈 자리를 누르면 지도에 닿는다(사용자 지적: 카드 밑이 눌리지 않았다) */
              <div
                ref={leftCardRef}
                data-yard-card="detail"
                className="pointer-events-none flex min-h-0 w-[28rem] max-w-full flex-1 flex-col"
              >
                <div key={cardStep} className="flex min-h-0 flex-1 flex-col animate-fade-in">
                  {detailCard}
                </div>
              </div>
            )}

            {/*
             * 왼쪽 아래 — 조작 안내. 위 항목들과 한 흐름이라 어떤 높이에서도
             * 서로 올라타지 않는다(예전의 `bottom-[10.75rem]` 손계산은 화면이 짧아지는 순간
             * 어긋났다). 남는 높이가 없으면 자연히 아래로 붙는다.
             */}
            <div className="mt-auto flex min-w-0 max-w-full shrink-0 flex-col items-start gap-2.5">
              <DraggableCard
                cardKey="hint"
                className="pointer-events-auto max-w-full rounded-inshop-md bg-black/55 px-2.5 py-1 text-2xs text-white/60 backdrop-blur-sm"
              >
                {t('dashboard.map.hint3d')}
              </DraggableCard>
            </div>
          </div>

        </div>

      </div>

      {/*
        좁은 화면 — 겹칠 자리가 없으므로 패널을 지도 아래 문서 흐름에 세운다. 지도에서 공장을
        고르면 그 상세가 여기 열리는데, 화면 밖이면 아무 일도 없었던 것처럼 보이므로
        스크롤로 데려온다.
      */}
      {preview && <ScreenPreviewDialog preview={preview} onClose={closePreview} />}

      {!wide && (
        <div ref={stackedPanelsRef} className="flex flex-col gap-3">
          {(detailCard ?? navCard) && (
            <div key={cardStep} className="animate-slide-up">
              {detailCard ?? navCard}
            </div>
          )}
          <FaultBayPanel
            bays={faultBays}
            selectedBayId={selectedBay}
            onOpenBay={openFaultBay}
            onHoverBay={setHoveredFaultBay}
          />
        </div>
      )}
    </div>
  )
}

/* ── 공장 상세 (선택 시 패널 맨 위) ── */

interface FactorySummary {
  name: string
  process: string | null
}

function FactoryDetailCard({
  data,
  trail,
  statusHref,
  viewerHref,
  blocksHref,
  onOpenStatus,
  bays,
  occupants,
  equipmentFaults,
  progress,
  onOpenBay,
  onHoverBay,
}: {
  data: FactorySummary
  /** 머리의 뎁스 경로(`공장 목록 › 조립`) — 누르면 그 단계로(공장 목록 = 같은 카드의 첫 화면) */
  trail: ReactNode
  /** 머리의 '현황' 문 — 이 공장의 공정 현황 화면. 없으면(가공 등) 문을 세우지 않는다 */
  statusHref: string | null
  /** 머리의 '3D' 문 — 이 공장 공정 화면의 3D 탭. 없으면(도장·가공) 세우지 않는다 */
  viewerHref: string | null
  /** 머리의 '실적' 문 — 이 공장 공정 화면의 블록·실적 탭. 없으면 세우지 않는다 */
  blocksHref: string | null
  /** '현황'·'3D'·'실적' 열기 — 화면 창으로 띄운다 (주소·제목을 넘긴다) */
  onOpenStatus: (href: string, title: string) => void
  /** 이 공장의 베이별 재실(P1 ①) — 빈 배열이면 목록을 만들지 않는다 */
  bays: readonly BayOccupancy[]
  /** 베이 없이 공장 단위로 센 재실 — 가공 공장. 있으면 베이 목록 대신 작업 현황 + 작업 목록을 세운다 */
  occupants: readonly BayOccupant[]
  /** 베이 id → 장애 설비 수. 장애 베이는 작업이 없어도 목록에 선다 */
  equipmentFaults: ReadonlyMap<string, number>
  /** 재실의 진행 상태 — 작업 전·완료는 '진행 작업' 에서 뺀다 */
  progress: ReadonlyMap<string, OccupantProgress>
  onOpenBay: (bayId: string) => void
  onHoverBay?: (bayId: string | null) => void
}) {
  const { t } = useTranslation()
  const processColor = data.process ? colorOfProcess(data.process) : '#9a9890'
  /*
   * 카드 머리(공장 이름·닫기)는 고정, 그 아래 본문은 통째로 스크롤한다.
   *
   * 예전에는 작업 위치 목록만 스크롤했는데, 그 위아래(요약 숫자·분류 구성)는 줄어들지
   * 않는 블록이라 낮은 해상도(1280×720 등)에서는 카드 높이가 그 합에도 못 미쳤다.
   * 그러면 넘친 부분이 `overflow-hidden` 에 **줄 중간에서 잘려** 잘못 그린 화면처럼
   * 보인다. 모자란 높이는 잘라 낼 것이 아니라 스크롤로 돌려줄 것이다.
   */
  return (
    <section className="pointer-events-auto flex max-h-full min-h-0 flex-col overflow-hidden rounded-inshop-xl border border-white/12 bg-[#0b0e12]/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="h-0.5 w-full shrink-0" style={{ backgroundColor: processColor }} />
      {/* 머리글이 이 카드의 드래그 손잡이 — 아래 본문은 스크롤이 제 일이라 잡히지 않는다 */}
      <div data-drag-handle className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0 space-y-1.5">
          {trail}
          {/* 제목 옆이 '현황' 의 자리 — 무엇의 현황인지가 바로 옆 이름이다 */}
          {/* 제목 줄 — 제목은 잘리지 않는다 */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
            <h3 className="shrink-0 whitespace-nowrap text-inshop-2xl font-semibold leading-tight tracking-[-0.03em]">
              {data.name}
            </h3>
          </div>
          {/* 제목 아래 — 현황·3D·실적 창 열기 버튼 줄(사용자 확정) */}
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            {statusHref && (
              <StatusJumpButton
                title={t('dashboard.map.statusJump.factoryHint', { factory: data.name })}
                onOpen={() =>
                  onOpenStatus(statusHref, t('dashboard.map.preview.statusTitle', { name: data.name }))
                }
              />
            )}
            {viewerHref && (
              <StatusJumpButton
                label={t('dashboard.map.occupant.open3d')}
                icon="viewer"
                title={t('dashboard.map.occupant.viewerHint', { block: data.name })}
                onOpen={() =>
                  onOpenStatus(viewerHref, t('dashboard.map.preview.viewerTitle', { block: data.name }))
                }
              />
            )}
            {blocksHref && (
              <StatusJumpButton
                label={t('dashboard.map.occupant.openPerformance')}
                icon="performance"
                title={t('dashboard.map.preview.blocksTitle', { name: data.name })}
                onOpen={() =>
                  onOpenStatus(blocksHref, t('dashboard.map.preview.blocksTitle', { name: data.name }))
                }
              />
            )}
          </div>
        </div>
      </div>

      <div className="scroll-thin scroll-shadow-y flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* 공장 드릴인의 본문은 베이별 재실 목록이다(P1 ①) — 행은 베이 상세의 축약판이고,
          누르면 그 베이로 드릴인한다. 실적·작업 위치는 이 아래로 물러난다 */}
      <FactoryBayList
        bays={bays}
        equipmentFaults={equipmentFaults}
        progress={progress}
        onOpenBay={onOpenBay}
        onHoverBay={onHoverBay}
      />
      {/* 가공 공장 — 베이가 없으니 공장 합계와 그 아래 블록 작업 목록(베이 카드의 본문과 같은 모양) */}
      {bays.length === 0 && isBaylessProcess(data.process) && (
        <div className="shrink-0 px-3 py-3">
          <FactoryWorkSummary occupants={occupants} progress={progress} />
          <BayOccupantList occupants={occupants} progress={progress} onPreview={onOpenStatus} />
        </div>
      )}

      {/* 면적·옥내외 같은 **기준정보는 두지 않는다**(P1 ①) — 지번 대장에서 온 그 숫자는
          어느 날 봐도 같아서, 매일 보는 화면에서 자리만 차지한다. 이 카드가 말하는 것은
          위의 베이별 재실이다. */}


      {/* 작업 위치(베이·정반) 목록·분류 구성은 걷었다 — 위의 베이별 작업 목록과 같은 칸을
          두 번 말하거나, 매일 보는 화면에 필요 없는 기준정보였다(사용자 확정). 정반 현황으로는
          베이 카드 머리의 '현황' 이 간다 */}

      </div>
    </section>
  )
}

/* ── 파생 계산 (fixture 비의존, 순수) ── */



/**
 * 한 공정에 속한 지번 전체를 감싸는 경계 상자 — 공정 카드 클릭 시 카메라 범위.
 * 스포트라이트가 **소속 공장의 공정** 기준으로 밝히므로, 카메라 범위도 그 공정 공장들의
 * 지번으로 잡아 밝아진 것과 화면이 어긋나지 않게 한다.
 */
function processBounds(parcels: YardParcels, process: string): LatLonBounds | null {
  const codes = new Set<string>()
  for (const f of parcels.factories) {
    if (f.process !== process) continue
    for (const c of f.lotCodes) codes.add(c)
  }
  let minLat = Infinity
  let minLon = Infinity
  let maxLat = -Infinity
  let maxLon = -Infinity
  for (const lot of parcels.lots) {
    if (!codes.has(lot.lot)) continue
    for (const p of lot.polygon) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lon < minLon) minLon = p.lon
      if (p.lon > maxLon) maxLon = p.lon
    }
  }
  if (minLat === Infinity) return null
  return { minLat, minLon, maxLat, maxLon }
}

/** 공장 상세 카드에 필요한 것 — 이름과 공정(색·'현황' 문의 재료) */
function summarizeFactory(parcels: YardParcels, name: string): FactorySummary {
  const factory = parcels.factories.find((f) => f.name === name) ?? null
  const codes = new Set(factory?.lotCodes ?? [])
  const firstLot = parcels.lots.find((lot) => codes.has(lot.lot) || lot.factory === name)
  return { name, process: factory?.process ?? firstLot?.process ?? null }
}
