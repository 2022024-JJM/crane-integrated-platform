import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  stashCameraHandoff,
  takeCameraHandoff,
} from '../../yard-map/lib/cameraHandoff'
import { performanceLinkFor, sitesOfBlock } from '../../../entities/vessel'
import {
  loadYardParcels,
  boundsOfLots,
  PARCEL_CATEGORY_COLORS,
  colorOfProcess,
  type YardParcels,
} from '../../../entities/yard-parcels'
import { useAsyncData } from '../../../lib/useAsyncData'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import { getProcessMapDrilldown, fetchYardMapBackdrop } from '../../../model/processRegistry'
import type { YardMapBackdrop } from '../../../model/yardMapBackdrop'
import {
  type Zone,
  type ZoneHealth,
  ZONE_CHECK_META,
  ZONE_HEALTH_META,
} from '../../../entities/zone/model/types'
import { StatusBadge } from '../../../entities/zone/ui/StatusBadge'
import { HealthBadge } from '../../../entities/zone/ui/HealthBadge'
import { ChevronDownIcon, CloseIcon } from '../../../ui/icons'
import { cn } from '../../../lib/utils'
import type { ProcessMapLocation } from '../../../model/processMapDrilldown'
import {
  bayClickIntent,
  mapSpotlight,
  selectBay as nextBaySelection,
  selectFactory as nextFactorySelection,
  selectLocation as nextLocationSelection,
  selectProcess as nextProcessSelection,
  type DashboardMapSelection,
} from '../lib/mapSpotlight'
import { restyleDarkBasemap } from '../lib/darkMapRestyle'
import {
  bayCameraBounds,
  factoryCameraBoundsOf,
  overviewCameraBounds,
  OVERVIEW_BOUNDS_PADDING,
} from '../lib/overviewCamera'
import { useMapLocations, locationsOf, type MapLocationsState } from '../lib/useMapLocations'
import { mapLinkNote } from '../lib/mapLinkNote'
import { DashboardMiniMap, type DashboardMiniMapHandle } from './DashboardMiniMap'
import { locationOfBay, summarizeBay } from '../lib/bayDetail'
import { BayDetailCard } from './BayDetailCard'
import { PerformanceBadge } from './PerformanceBadge'
import {
  BlockSearch,
  BlockSitePins,
  type BlockSearchHit,
  type BlockSearchPinHandle,
} from './BlockSearch'
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

/** 건전성(수집 품질) → 상태점 색. 접힌 카드의 한 줄 요약에서 상태를 색으로 말한다 */
const HEALTH_DOT: Record<ZoneHealth, string> = {
  healthy: 'bg-status-healthy',
  degraded: 'bg-status-degraded',
  unhealthy: 'bg-status-unhealthy',
}

/** 선택 — 공장 하나(클릭) 또는 공정 하나(카드 헤더 클릭). 둘 다 카메라를 움직인다 */
type Selection = DashboardMapSelection

interface DashboardZoneMapProps {
  zones: Zone[]
}

interface Loaded {
  backdrop: YardMapBackdrop | null
  parcels: YardParcels
}

export function DashboardZoneMap({ zones }: DashboardZoneMapProps) {
  const { t } = useTranslation()
  const miniMapRef = useRef<DashboardMiniMapHandle>(null)
  const hudRef = useRef<FactoryHudLabelHandle>(null)
  /*
   * 마지막으로 받은 카메라 — 떠 있는 이름패가 붙는 **첫 프레임**에 쓸 값이다. 이름패는
   * 공장을 고르는 순간 붙는데 그때 카메라 알림은 아직 오지 않았고, 카메라를 state 로
   * 들면 비행 매 프레임마다 이 화면 전체(우측 공정존 패널까지)가 다시 그려진다.
   */
  const cameraRef = useRef<FactoryHudCamera | null>(null)
  const [navigationTarget, setNavigationTarget] = useState<{ lat: number; lon: number } | null>(null)
  const [resetSignal, setResetSignal] = useState(0)

  /*
   * 공정 맵 화면에서 넘어온 카메라 승계(1회성·TTL 3s) — 첫 렌더에서 한 번만 가져와
   * YardMap 의 시작 화각으로 쓴다. 없으면(직접 진입·새로고침) 기존 initialBounds 폴백.
   */
  const handoffRef = useRef<YardView | null | undefined>(undefined)
  if (handoffRef.current === undefined) handoffRef.current = takeCameraHandoff()
  const handoffView = handoffRef.current
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

  const [selection, setSelection] = useState<Selection>(null)
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
  const [searchHit, setSearchHit] = useState<BlockSearchHit | null>(null)
  const searchPinRef = useRef<BlockSearchPinHandle>(null)
  /* 카드별 펴짐 상태(공정명 집합). 기본은 전부 접힘 — 지도가 넓게 보이는 상태에서 시작한다 */
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
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

  /* 공정 화면으로 떠나는 링크가 클릭 시점의 카메라를 맡긴다 — 도착 화면이 이어받는다 */
  const stashCamera = useCallback(() => {
    const camera = cameraRef.current
    if (camera) stashCameraHandoff(camera.view)
  }, [])

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
  const { state: locationsState, retry: retryLocations } = useMapLocations(
    drilldown,
    focusedFactory
  )
  const locations = locationsOf(locationsState)
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  )

  /* 선택을 해제해 전체 현황으로 돌아오면 우측 공정존 카드도 모두 접힌 초기 상태로 맞춘다. */
  useEffect(() => {
    if (selection !== null) return
    setExpanded((prev) => (prev.size === 0 ? prev : new Set()))
  }, [selection])

  /*
   * 공장 밀집 구역 — 대문 카메라의 목적지이자 "홈". 야드 전체를 맞추면 공장이 점으로
   * 밀려 "지도 위의 3D 모형" 이 서지 않으므로, 소속 지번 전체를 감싸는 범위로 당겨서
   * 연다. 선택을 풀 때도 여기로 돌아온다 — 전체 야드는 이 화면의 홈이 아니다.
   * 계산은 overviewCamera 공용 — 도장 배치 화면과 같은 대문을 쓴다.
   */
  const overviewBounds = useMemo<LatLonBounds | null>(
    () => (parcels ? overviewCameraBounds(parcels) : null),
    [parcels]
  )

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

  const expandProcess = useCallback((process: string) => {
    /* 지도 강조를 먼저 그린 뒤 무거운 공장·베이 목록을 낮은 우선순위로 펼친다. */
    startTransition(() => setExpanded(new Set([process])))
  }, [])

  /* 공장 선택 = 지도/목록 공통 동작. 그 공장의 공정 카드를 펴 목록에서 선택이 보이게 한다 */
  const selectFactory = useCallback(
    (name: string | null) => {
      setSelection((prev) => nextFactorySelection(prev, name))
      /* 공장이 바뀌면 이전 공장의 위치 호버가 남지 않게 지운다 (선택은 전이 함수가 지운다) */
      setHoveredLocation(null)
      setHoveredBay(null)
      if (name) {
        const p = processOfFactory(name)
        if (p) expandProcess(p)
      }
    },
    [processOfFactory, expandProcess]
  )

  /*
   * `/?factory=<공장명>` 딥링크 소비 — 통합실적의 '맵에서 보기'가 이 계약으로 보낸다
   * (도장 `?shop=` 전례). 공장 검증에 parcels 가 필요해 로드 후 **한 번만** 소비하고,
   * 지도에 없는 이름은 조용히 무시한다(오류 화면을 세울 만큼의 사고가 아니다).
   */
  const [searchParams] = useSearchParams()
  const deepLinkConsumed = useRef(false)
  useEffect(() => {
    if (deepLinkConsumed.current || !parcels) return
    deepLinkConsumed.current = true
    const name = searchParams.get('factory')
    if (name && parcels.factories.some((f) => f.name === name)) selectFactory(name)
  }, [parcels, searchParams, selectFactory])


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
      setSelection((prev) => nextLocationSelection(prev, locationId))
      if (location) navigate(location.detailPath)
    },
    [locationById, navigate]
  )

  /* 상세 카드의 해제 버튼 — 이동 없이 위치 선택만 푼다 */
  const clearLocation = useCallback(() => {
    setSelection((prev) => nextLocationSelection(prev, null))
  }, [])

  /* 공정 카드 헤더 클릭 = 스포트라이트 토글. 켤 때는 그 카드도 펴 준다(상세·목록이 바로 보이게) */
  const focusProcess = useCallback(
    (process: string) => {
      setSelection((prev) => nextProcessSelection(prev, process))
      expandProcess(process)
    },
    [expandProcess]
  )

  const toggleExpand = useCallback((process: string) => {
    setExpanded((prev) => (prev.has(process) ? new Set() : new Set([process])))
  }, [])

  const focusedProcess = selection?.kind === 'process' ? selection.process : null
  const selectedLocation = selection?.kind === 'factory' ? (selection.location ?? null) : null
  const selectedBay = selection?.kind === 'factory' ? (selection.bay ?? null) : null

  /* 베이 상세의 "← 공장 이름" — 베이 선택만 풀고 공장 요약으로 돌아온다 */
  const clearBay = useCallback(() => {
    setSelection((prev) => nextBaySelection(prev, null))
  }, [])

  /*
   * 지도 스포트라이트 — 공장을 고르면 그 공장의 **공정도 함께** 켠다 (FR-5 강조 문법).
   * 고른 공장은 가장 진하게('selected'), 같은 공정의 다른 공장은 네온('on')으로 남아
   * 동일 공정이 어디인지 보이고, 무관 공정만 가라앉는다. 카드 활성(activeProcess)과
   * 카메라(focusBounds)는 여전히 selection 원본을 쓴다 — 공장 클릭이 공정 카드를
   * 활성으로 바꾸거나 카메라를 공정 전체로 넓히지는 않는다.
   */
  const spotlight = useMemo(
    () => mapSpotlight(selection, processOfFactory),
    [selection, processOfFactory]
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
  const focusedBays = useMemo(
    () => (focusedFactory ? factoryBays.filter((bay) => bay.factory === focusedFactory) : []),
    [factoryBays, focusedFactory]
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
  /* 목록이 보는 호버 — 반대 방향. 지도에 손을 얹으면 짝지어진 줄이 밝아진다 */
  const listHoveredLocation =
    hoveredLocation ?? (hoveredBay ? (bayLinks.locationOfBayId.get(hoveredBay)?.id ?? null) : null)

  /*
   * 지도의 칸 클릭 — 작업 위치면 지금까지처럼 곧장 상세로 가고, 베이면 **한 번은 선택,
   * 이미 고른 베이를 한 번 더 누르면 그 베이의 상세로** 들어간다(`bayClickIntent`).
   * 훑어보기(첫 클릭)는 그대로 두면서, 카드 안의 링크를 찾아 누르지 않고도 들어갈 수 있다.
   *
   * 이동 여부는 `selection` 을 읽어 정하므로 setState 갱신 함수 안에서 판단하지 않는다 —
   * 갱신 함수는 순수해야 하고(StrictMode 에서 두 번 불린다) 그 안의 navigate 는 사고다.
   */
  const selectMapUnit = useCallback(
    (id: string) => {
      if (!mapUnitIsBay) {
        openLocation(id)
        return
      }
      const intent = bayClickIntent(
        selection,
        id,
        bayLinks.locationOfBayId.get(id)?.detailPath ?? null
      )
      if (intent.kind === 'open') navigate(intent.path)
      else setSelection(intent.selection)
    },
    [mapUnitIsBay, openLocation, selection, bayLinks, navigate]
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
    if (selection.kind === 'process') return processBounds(parcels, selection.process)
    const factory = factoryCameraBoundsOf(parcels, selection.name)
    if (!factory) return null
    const bay = selection.bay ? parcels.bays.find((b) => b.id === selection.bay) : null
    if (!bay) return factory
    const around = boundsOfLots(parcels, bay.lotCodes)
    return around ? bayCameraBounds(around, factory, BAY_CAMERA_MIN_RATIO) : factory
  }, [parcels, selection])

  /*
   * 검색으로 고른 블록의 **자리들** — 재공 블록은 생애 단계에 따라 자리가 여럿이다
   * (조립 중이면 ASSY 가 흩어진 공장마다 하나). 야드 실측 위치는 지금까지처럼 점 하나다.
   * 가공 중인 블록은 자리가 없어 빈 배열이고, 그러면 카메라도 움직이지 않는다 —
   * 갈 자리가 없는데 날아가면 아무 데나 도착한 것처럼 보인다.
   */
  const searchSites = useMemo(() => {
    if (!parcels || !searchHit) return []
    if (searchHit.kind === 'yard') {
      const { yard } = searchHit
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
        },
      ]
    }
    return locateSites(parcels, sitesOfBlock(searchHit.block))
  }, [parcels, searchHit])

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

  const parcelLayer = useMemo<YardParcelLayer | undefined>(() => {
    if (!parcels) return undefined
    return {
      lots: parcels.lots,
      factories: layerFactories,
      categoryColor: parcels.categoryColor,
      /* 샵 네비 룩: 공장 지번을 그 공정색 네온으로. 공정 카드 클릭이면 그 공정만,
       * 공장 클릭이면 그 공장(selected) + 같은 공정을 스포트라이트 (FR-5) */
      colorMode: 'process',
      processColor: colorOfProcess,
      /* 대시보드 스포트라이트는 언제나 공정 하나 — 단일 원소 배열이 옛 단일 값과 등가다 */
      focusedProcesses: spotlight.focusedProcess ? [spotlight.focusedProcess] : null,
      focusedFactory: spotlight.focusedFactory,
      /* 같은 공정의 다른 공장은 절반쯤 눌린 네온 — FR-5 "동일 공정 45~60%" 중간 계층 */
      relatedDimFactor: 0.5,
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
      floatingFocusedLabel: true,
      onSelectFactory: selectFactory,
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
    mapSelectedUnit,
    mapHoveredUnit,
    selectMapUnit,
    hoverMapUnit,
    lotGroups,
    factoryBays,
    searchSites,
  ])

  const selectedFactoryData = useMemo(() => {
    if (!parcels || selection?.kind !== 'factory') return null
    return summarizeFactory(parcels, selection.name)
  }, [parcels, selection])

  /* 고른 베이의 상세 — 소속 지번과 그 **원본 설명**. 매핑에 없는 베이면 null */
  const selectedBayData = useMemo(
    () => (parcels && selectedBay ? summarizeBay(parcels, selectedBay) : null),
    [parcels, selectedBay]
  )

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
   * 지도 fixture 에 실제로 존재하는 지번만 골라 낸다 — 연결 키는 있는데 지도에 그 지번이
   * 없으면 `매핑 불일치` 이고, 아예 없으면 `지도 위치 정보 없음` 이다. 둘은 사용자에게
   * 다른 사실이라 화면에서도 다른 문구로 말한다 (PRD §7 표).
   */
  const knownLots = useMemo(
    () => new Set((parcels?.lots ?? []).map((lot) => lot.lot)),
    [parcels]
  )

  /*
   * 패널을 지도 위에 겹칠 자리가 있는가 — 셸이 고정 뷰포트를 켜는 선(xl)과 **같은 선**을
   * 쓴다. 그보다 좁으면 셸도 문서처럼 스크롤하는데 지도만 패널을 겹쳐 두면, 좌(상세
   * 19rem)·우(공정존 21rem) 두 기둥이 서로 올라타 글자가 글자 위에 얹힌다.
   * 좁은 화면에서는 패널을 지도 **아래**로 내려 페이지가 스크롤하게 둔다.
   */
  const wide = useMediaQuery('(min-width: 80rem)')
  /* 세로가 빠듯한 화면(1366×768·1280×720 같은 현장 모니터) — 미니맵이 몸집을 줄인다 */
  const shortScreen = useMediaQuery('(max-height: 900px)')

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

  const detailCard = selectedBayData ? (
    <BayDetailCard
      bay={selectedBayData}
      locationNoun={drilldown ? t(drilldown.locationNounKey) : t('dashboard.map.locationNoun')}
      linkedLocation={bayLinks.locationOfBayId.get(selectedBayData.id) ?? null}
      /* 총괄 화면은 지번 표면을 내지 않는다 — 드릴다운은 공장→베이까지, 지번은 야드 몫 */
      showLotList={false}
      onBack={clearBay}
      onClose={() => setSelection(null)}
    >
      {/* 베이 카드에도 같은 절점 실적 참고 — 절점 귀속이 공장 단위 mock 이라 공장 기준 수치다 */}
      <PerformanceBadge factory={selectedBayData.factory} className="border-b-0 px-0 py-0" />
      {/* 이 공장 문맥 그대로 공정 화면으로 — 선택·카메라를 승계한다 (W4-6a D3) */}
      {focusedZoneId && focusedFactory && (
        <Link
          to={`/indoorshop/zones/${focusedZoneId}?shop=${encodeURIComponent(focusedFactory)}`}
          onClick={stashCamera}
          className="inline-flex items-center gap-1 rounded-inshop-sm px-1.5 py-0.5 text-2xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {t('dashboard.map.openZoneShort')} →
        </Link>
      )}
    </BayDetailCard>
  ) : selectedFactoryData ? (
    <FactoryDetailCard
      data={selectedFactoryData}
      locationNoun={drilldown ? t(drilldown.locationNounKey) : t('dashboard.map.locationNoun')}
      state={locationsState}
      knownLots={knownLots}
      selectedLocation={selectedLocation}
      hoveredLocation={listHoveredLocation}
      onHoverLocation={setHoveredLocation}
      onOpenLocation={openLocation}
      onClearLocation={clearLocation}
      onRetry={retryLocations}
      onClose={() => setSelection(null)}
    />
  ) : null

  const zonePanel = (
    <ProcessZonePanel
      zones={zones}
      parcels={parcels}
      expanded={expanded}
      onToggleExpand={toggleExpand}
      activeProcess={focusedProcess}
      onFocusProcess={focusProcess}
      selectedFactory={focusedFactory}
      onSelectFactory={selectFactory}
      locationsState={locationsState}
      selectedLocation={selectedLocation}
      onOpenLocation={openLocation}
      hoveredFactory={hoveredFactory}
      onHoverFactory={setHoveredFactory}
      hoveredLocation={listHoveredLocation}
      onHoverLocation={setHoveredLocation}
      onStashCamera={stashCamera}
    />
  )

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      {/*
        지도 상자. 넓은 화면에서는 남은 높이를 다 쓰고(패널이 그 위에 뜬다), 좁은 화면에서는
        아래에 선 패널이 화면 밖으로 밀리지 않도록 높이를 덜어 준다.
      */}
      <div className="relative min-h-0 w-full overflow-hidden rounded-inshop-xl border border-border bg-[#0b0f14] max-xl:h-[min(60vh,34rem)] max-xl:min-h-[22rem] xl:flex-1">
        {/* 지도 — 준비되면 붙는다. 그 전엔 패널이 먼저 서 있고 여기만 로딩 표시 */}
        {data?.backdrop && parcelLayer && basemapLayers ? (
          <YardMap
            lots={NO_LOTS}
            blocks={NO_BLOCKS}
            moves={NO_MOVES}
            plans={NO_PLANS}
            basemapLayers={basemapLayers}
            extent={data.backdrop.extent}
            minScale={35_000}
            maxScale={900_000}
            resetSignal={resetSignal}
            colorOfCategory={NO_CATEGORY_COLOR}
            layers={MAP_LAYERS}
            /* 지도 영역은 라이트 테마에서도 다크 베이스맵 — 어두운 바탕이라야 네온이 산다. */
            mapTheme="dark"
            viewMode="3d"
            onViewChange={(view: YardView, viewport: Viewport) => {
              cameraRef.current = { view, viewport }
              miniMapRef.current?.updateView(view, viewport)
              hudRef.current?.updateView(view, viewport)
              searchPinRef.current?.updateView(view, viewport)
            }}
            lotOpacity={0.7}
            parcels={parcelLayer}
            /* 대문은 공장 밀집 구역이 홈 — 선택이 없을 때도 야드 전체로 물러나지 않는다.
             * 음수 패딩 = 범위보다 한 발 **안으로** 들어간 카메라: 외곽 공장 한둘이 살짝
             * 잘리더라도 모델이 가깝게 서는 쪽을 대문으로 삼는다 (드래그로 언제든 나온다). */
            initialBounds={overviewBounds}
            initialBoundsPadding={OVERVIEW_BOUNDS_PADDING}
            /* 공정 맵에서 이어 온 화각 — 있으면 첫 프레임이 그 자리에서 시작한다 */
            initialView={handoffView}
            focusBounds={glidedFocusBounds}
            focusBoundsDuration={420}
            focusBoundsPadding={
              searchFocus
                ? /* 블록 핀 주변 — 이웃 지번이 함께 남을 만큼 */
                  0.35
                : selection?.kind === 'process'
                ? -0.04
                : selection?.kind === 'factory'
                  ? /* 베이도 같은 여백을 쓴다 — 배율은 여백이 아니라 `bayCameraBounds` 의
                       범위가 묶는다(베이 크기가 제각각이라 여백으로 묶으면 널뛴다) */
                    0.12
                  : OVERVIEW_BOUNDS_PADDING
            }
            parcelSpotlightDuration={0}
            navigationTarget={navigationTarget}
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
        {searchHit && (
          <BlockSitePins
            key={searchHit.id}
            ref={searchPinRef}
            label={`${searchHit.projNo}-${searchHit.blkNo}`}
            to={performanceLinkFor({ projNo: searchHit.projNo, blocks: [searchHit.blkNo] })}
            sites={searchSites}
            initialCamera={cameraRef.current}
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
        <div
          className={cn(
            'pointer-events-none absolute inset-3 z-10 grid gap-3',
            wide ? 'grid-cols-[minmax(0,1fr)_21rem]' : 'grid-cols-1'
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-col items-start gap-2.5">
            <div className="pointer-events-none max-w-full shrink-0 rounded-inshop-xl border border-white/10 bg-[#0b0f14]/82 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="h-9 w-1 shrink-0 rounded-full bg-accent shadow-[0_0_12px_rgba(249,145,55,0.42)]" />
                <div className="min-w-0">
                  <h1 className="truncate text-inshop-xl font-bold leading-tight tracking-[-0.035em] text-white">
                    {t('dashboard.title')}
                  </h1>
                  <p className="mt-1 hidden max-w-80 truncate text-inshop-xs tracking-[-0.01em] text-white/50 sm:block">
                    {t('dashboard.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex max-w-full shrink-0 flex-wrap items-start gap-2">
            <button
              type="button"
              onClick={() => {
                setSelection(null)
                setNavigationTarget(null)
                setResetSignal((value) => value + 1)
              }}
              className="pointer-events-auto flex h-9 shrink-0 items-center gap-2 rounded-inshop-lg border border-white/12 bg-[#0b0e12]/90 px-3 text-inshop-xs font-medium text-white/75 shadow-lg backdrop-blur-md transition-colors hover:bg-[#151b23] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              title={t('dashboard.map.returnToCurrentLocation')}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
                <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {t('dashboard.map.currentLocation')}
            </button>
            {/* 블록 검색 — 색인은 첫 사용 때 backdrop 로더에서 받는다 */}
            <BlockSearch
              loadIndex={data?.backdrop?.blockIndex ?? null}
              hit={searchHit}
              onPick={setSearchHit}
              onClear={() => setSearchHit(null)}
            />
            </div>

            {/* 선택한 공장(또는 그 안의 베이) 상세 — 공정존 탐색을 가리지 않도록 지도 왼쪽에
                둔다. 베이를 고르면 같은 자리를 베이 상세가 이어받는다(두 카드를 나란히
                세우면 지도를 반쯤 덮고, 어느 쪽이 지금 이야기인지도 흐려진다).
                남는 높이를 전부 가져가되(`flex-1`), 넘치는 내용은 카드 안에서 스크롤한다. */}
            {wide && detailCard && (
              <div
                key={selectedBayData ? 'bay' : 'factory'}
                className="flex min-h-0 w-[19rem] max-w-full flex-1 animate-slide-up flex-col"
              >
                {detailCard}
              </div>
            )}

            {/*
             * 왼쪽 아래 — 조작 안내와 전체 야드 미니맵. 위 항목들과 한 흐름이라 어떤 높이에서도
             * 서로 올라타지 않는다(예전의 `bottom-[10.75rem]` 손계산은 화면이 짧아지는 순간
             * 어긋났다). 남는 높이가 없으면 자연히 아래로 붙는다.
             */}
            <div className="mt-auto flex min-w-0 max-w-full shrink-0 flex-col items-start gap-2.5">
              <p className="max-w-full rounded-inshop-md bg-black/55 px-2.5 py-1 text-2xs text-white/60 backdrop-blur-sm">
                {t('dashboard.map.hint3d')}
              </p>
              {data?.backdrop && parcels && (
                <DashboardMiniMap
                  ref={miniMapRef}
                  extent={data.backdrop.extent}
                  parcels={parcels}
                  /* 다시 그릴 밑천 — 접혔다 펴져도 빈 판이 서 있지 않게 한다 */
                  initialCamera={cameraRef.current}
                  /* 상세 카드가 열린 낮은 해상도에서는 몸집을 줄여 카드에 높이를 내준다 */
                  compact={Boolean(detailCard) && shortScreen}
                  onNavigate={(point) => setNavigationTarget({ ...point })}
                />
              )}
            </div>
          </div>

          {/* 오른쪽 기둥은 공정존 탐색 전용으로 유지한다 — 넓은 화면에서만 지도 위에 선다 */}
          {wide && (
            <div className="scroll-thin flex min-h-0 flex-col gap-3 overflow-y-auto">
              {zonePanel}
            </div>
          )}
        </div>
      </div>

      {/*
        좁은 화면 — 겹칠 자리가 없으므로 패널을 지도 아래 문서 흐름에 세운다. 지도에서 공장을
        고르면 그 상세가 여기 열리는데, 화면 밖이면 아무 일도 없었던 것처럼 보이므로
        스크롤로 데려온다.
      */}
      {!wide && (
        <div ref={stackedPanelsRef} className="flex flex-col gap-3">
          {detailCard && (
            <div key={selectedBayData ? 'bay' : 'factory'} className="animate-slide-up">
              {detailCard}
            </div>
          )}
          {zonePanel}
        </div>
      )}
    </div>
  )
}

/* ── 통합 패널: 공정존 접이식 카드 목록 ── */

function ProcessZonePanel({
  zones,
  parcels,
  expanded,
  onToggleExpand,
  activeProcess,
  onFocusProcess,
  selectedFactory,
  onSelectFactory,
  locationsState,
  selectedLocation,
  onOpenLocation,
  hoveredFactory,
  onHoverFactory,
  hoveredLocation,
  onHoverLocation,
  onStashCamera,
}: {
  zones: Zone[]
  parcels: YardParcels | null
  expanded: Set<string>
  onToggleExpand: (process: string) => void
  activeProcess: string | null
  onFocusProcess: (process: string) => void
  selectedFactory: string | null
  onSelectFactory: (name: string) => void
  /** 고른 공장의 작업 위치 조회 상태 — 고른 공장 줄 아래에만 편다 */
  locationsState: MapLocationsState
  selectedLocation: string | null
  onOpenLocation: (id: string) => void
  /* 지도와 목록이 나눠 갖는 호버 — 어느 쪽에 손을 얹어도 반대쪽이 같이 켜진다 */
  hoveredFactory: string | null
  onHoverFactory: (name: string | null) => void
  hoveredLocation: string | null
  onHoverLocation: (id: string | null) => void
  /** 공정 화면으로 떠나는 링크가 클릭 순간의 카메라를 승계 저장소에 맡긴다 */
  onStashCamera: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="pointer-events-auto rounded-inshop-lg border border-white/12 bg-black/75 p-2.5 backdrop-blur-md">
      <div className="mb-2 flex items-center px-0.5">
        {/* 한글에 uppercase 는 무의미하다 — 크기 대신 자간·명도 한 단으로 구획 제목을 만든다 */}
        <h2 className="text-inshop-xs font-semibold tracking-[-0.01em] text-white/55">
          {t('dashboard.map.zonesTitle')}
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {zones.map((zone) => {
          const process = ZONE_PROCESS[zone.id] ?? null
          /* 그 공정의 공장 목록 — 큰 공장(소속 지번 많은 순 = 크기 순)이 먼저. 칩에는
           * 베이 수를 적는다(총괄 화면의 최소 단위 — 지번 어휘는 표면에 내지 않는다) */
          const factories =
            parcels && process
              ? parcels.factories
                  .filter((f) => f.process === process)
                  .map((f) => ({
                    name: f.name,
                    size: f.lotCodes.length,
                    bayCount: parcels.bays.filter((b) => b.factory === f.name).length,
                  }))
                  .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name))
              : []
          return (
            <ProcessZoneCard
              key={zone.id}
              zone={zone}
              process={process}
              factories={factories}
              expanded={process ? expanded.has(process) : false}
              onToggle={process ? () => onToggleExpand(process) : undefined}
              active={process !== null && process === activeProcess}
              onFocus={process ? () => onFocusProcess(process) : undefined}
              selectedFactory={selectedFactory}
              onSelectFactory={onSelectFactory}
              locationsState={locationsState}
              selectedLocation={selectedLocation}
              onOpenLocation={onOpenLocation}
              hoveredFactory={hoveredFactory}
              onHoverFactory={onHoverFactory}
              hoveredLocation={hoveredLocation}
              onHoverLocation={onHoverLocation}
              onStashCamera={onStashCamera}
            />
          )
        })}
      </div>
    </section>
  )
}

/**
 * 공정존 접이식 카드.
 * - 접힘: 한 줄 요약 — [펴기버튼] 공정색점 · 공정명 · 건전성점 · 처리건수.
 * - 펴짐: 서비스/품질 2축 배지 + 근거, 처리건수·마지막 수집, 점검 항목, **그 공정의 공장 목록**, 공정 화면 링크.
 * - 헤더(요약) 본체 클릭 = 스포트라이트(카메라). 펴기버튼은 별도라 서로 충돌하지 않는다.
 */
function ProcessZoneCard({
  zone,
  process,
  factories,
  expanded,
  onToggle,
  active,
  onFocus,
  selectedFactory,
  onSelectFactory,
  locationsState,
  selectedLocation,
  onOpenLocation,
  hoveredFactory,
  onHoverFactory,
  hoveredLocation,
  onHoverLocation,
  onStashCamera,
}: {
  zone: Zone
  process: string | null
  factories: { name: string; size: number; bayCount: number }[]
  expanded: boolean
  onToggle?: () => void
  active: boolean
  onFocus?: () => void
  selectedFactory: string | null
  onSelectFactory: (name: string) => void
  locationsState: MapLocationsState
  selectedLocation: string | null
  onOpenLocation: (id: string) => void
  hoveredFactory: string | null
  onHoverFactory: (name: string | null) => void
  hoveredLocation: string | null
  onHoverLocation: (id: string | null) => void
  onStashCamera: () => void
}) {
  const { t } = useTranslation()
  const procColor = process ? colorOfProcess(process) : '#9a9890'
  const healthLabel = t(ZONE_HEALTH_META[zone.health].labelKey)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-inshop-lg border transition-colors',
        active ? 'border-white/45 bg-white/[0.07]' : 'border-white/10 bg-white/[0.025]'
      )}
      style={{ borderLeftColor: procColor, borderLeftWidth: 3 }}
    >
      {/* 요약 줄 — 펴기버튼(별도) + 스포트라이트 버튼(본체) */}
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? t('dashboard.map.collapse') : t('dashboard.map.expand')}
          className="flex shrink-0 items-center px-1.5 text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        >
          <ChevronDownIcon size={14} className={cn('transition-transform', !expanded && '-rotate-90')} />
        </button>
        <button
          type="button"
          onClick={onFocus}
          disabled={!onFocus}
          title={onFocus ? t('dashboard.map.viewOnMap') : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 py-2 pr-2.5 text-left',
            onFocus && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70'
          )}
        >
          <span
            className="h-3.5 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: procColor }}
          />
          {/* 순백 대신 반 톤 눌린 흰색 — 유리판 위에서 덜 번지고, 선택·hover 의 순백이 설 자리가 남는다 */}
          <span className="truncate text-inshop-sm font-bold tracking-[-0.02em] text-white/95">
            {t(zone.displayNameKey)}
          </span>
          <span
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', HEALTH_DOT[zone.health])}
            title={healthLabel}
          />
          <span className="shrink-0 text-2xs text-white/60">{healthLabel}</span>
          <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
            {t('dashboard.map.processing', { n: zone.processingCount })}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {/* 서비스 / 수집 품질 — 두 축을 무엇에 대한 판정인지 이름표와 함께 */}
          <div className="divide-y divide-white/10 px-3">
            <div className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs font-normal text-white/55">{t('zone.service')}</span>
                <StatusBadge status={zone.status} />
              </div>
            </div>
            <div className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs font-normal text-white/55">{t('zone.quality')}</span>
                <HealthBadge health={zone.health} />
              </div>
            </div>
          </div>

          {/* 처리건수 · 마지막 수집 */}
          <dl className="grid grid-cols-2 divide-x divide-white/10 px-3 py-2">
            <div className="pr-3">
              <dt className="text-2xs font-normal text-white/55">{t('zone.processing')}</dt>
              <dd className="mt-0.5 text-inshop-base font-semibold tabular-nums text-white">
                {t('dashboard.map.processing', { n: zone.processingCount })}
              </dd>
            </div>
            <div className="pl-3">
              <dt className="text-2xs font-normal text-white/55">{t('zone.lastCollected')}</dt>
              <dd className="mt-0.5 text-inshop-xs font-medium text-white/85">{t(zone.lastUpdateKey)}</dd>
            </div>
          </dl>

          {/* 점검 항목 — 수집 경로 / 판별 / 적재 */}
          <dl className="space-y-1.5 px-3 py-2">
            {zone.checks.map((check) => {
              const meta = ZONE_CHECK_META[check.state]
              return (
                <div key={check.labelKey} className="flex items-start gap-2">
                  <span
                    className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', meta.dotClass)}
                    title={t(meta.labelKey)}
                  />
                  <dt className="w-14 shrink-0 text-2xs text-white/50">{t(check.labelKey)}</dt>
                  <dd className="min-w-0 flex-1 text-2xs leading-relaxed text-white/75">
                    {t(check.detailKey)}
                    <span className="sr-only"> ({t(meta.labelKey)})</span>
                  </dd>
                </div>
              )
            })}
          </dl>

          {/*
            이 공정의 공장 목록 — 누르면 지도의 공장 클릭과 동일(줌인+글로우+상세).
            호버도 지도와 **양방향으로 잇는다**: 행에 손을 얹으면 지도의 그 지번이
            밝아지고, 지도에서 얹으면 이 행이 켜진다 — "이 줄이 지도의 그 건물"임을
            색이 직접 말하므로 별도 아이콘·설명이 필요 없다. 선택·호버의 강조색은
            흰색이 아니라 **그 공정의 네온색**이다 (지도와 카드가 같은 언어를 쓴다).
          */}
          {factories.length > 0 && (
            <div className="px-3 py-2">
              <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium text-white/55">
                {t('dashboard.map.factoriesLabel')}
                <span className="font-mono text-white/30">{factories.length}</span>
              </p>
              <ul className="space-y-0.5">
                {factories.map((f) => {
                  const isActive = f.name === selectedFactory
                  const isHovered = !isActive && f.name === hoveredFactory
                  return (
                    <li key={f.name}>
                      <button
                        type="button"
                        onClick={() => onSelectFactory(f.name)}
                        onMouseEnter={() => onHoverFactory(f.name)}
                        onMouseLeave={() => onHoverFactory(null)}
                        onFocus={() => onHoverFactory(f.name)}
                        onBlur={() => onHoverFactory(null)}
                        aria-pressed={isActive}
                        title={t('dashboard.map.factoryOnMap')}
                        /* 상태색은 공정색에서 온다 — 클래스가 아니라 팔레트가 정하므로 인라인 */
                        style={
                          isActive
                            ? {
                                backgroundColor: `${procColor}2b`,
                                boxShadow: `inset 0 0 0 1px ${procColor}73`,
                              }
                            : isHovered
                              ? { backgroundColor: `${procColor}17` }
                              : undefined
                        }
                        className={cn(
                          'flex w-full items-center gap-2 rounded-inshop-md px-2 py-1.5 text-left text-2xs',
                          'transition-[background-color,box-shadow,color] duration-150',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70',
                          isActive
                            ? 'font-medium text-white'
                            : isHovered
                              ? 'text-white'
                              : 'text-white/72'
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full transition-shadow duration-150"
                          style={{
                            backgroundColor: procColor,
                            /* 켜진 행의 점은 지도 네온과 같은 글로우 — 점이 아니라 불빛으로 읽힌다 */
                            boxShadow:
                              isActive || isHovered ? `0 0 6px 1px ${procColor}b3` : undefined,
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span
                          className="shrink-0 rounded-full border px-1.5 py-px font-mono text-2xs tabular-nums leading-4 transition-colors duration-150"
                          style={
                            isActive
                              ? {
                                  borderColor: `${procColor}59`,
                                  backgroundColor: `${procColor}33`,
                                  color: '#fff',
                                }
                              : {
                                  borderColor: 'rgba(255,255,255,0.08)',
                                  color: isHovered
                                    ? 'rgba(255,255,255,0.72)'
                                    : 'rgba(255,255,255,0.45)',
                                }
                          }
                        >
                          {f.bayCount > 0
                            ? t('dashboard.map.bayCount', { count: f.bayCount })
                            : t('dashboard.map.noBays')}
                        </span>
                      </button>
                      {/*
                        고른 공장의 **작업 위치**(조립: 베이·정반) — 공정 모듈이 낸 목록을
                        공정색을 옅게 깐 소패널로 위 행에 붙인다. 지도만으로 제공되는 핵심
                        정보가 없도록 목록에도 같은 선택·이동을 둔다 (PRD §5.4). 조회
                        상태(로딩·빈 값·오류·매핑 없음·미제공)는 각각 다른 문구다 (FR-5).
                      */}
                      {isActive && (
                        <div
                          className="mt-1 rounded-inshop-md border p-2"
                          style={{
                            borderColor: `${procColor}38`,
                            backgroundColor: `${procColor}0d`,
                          }}
                        >
                          <LocationChips
                            state={locationsState}
                            color={procColor}
                            selectedLocation={selectedLocation}
                            hoveredLocation={hoveredLocation}
                            onOpenLocation={onOpenLocation}
                            onHoverLocation={onHoverLocation}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end px-3 py-2">
            {/*
             * 이 공정의 공장을 골라 둔 채 넘어가면 선택(?shop=)과 카메라(stash)를 함께
             * 승계한다 — 공정 화면이 같은 화각·같은 공장에서 이어진다 (W4-6a D3).
             */}
            <Link
              to={
                selectedFactory && factories.some((f) => f.name === selectedFactory)
                  ? `/zones/${zone.id}?shop=${encodeURIComponent(selectedFactory)}`
                  : `/zones/${zone.id}`
              }
              onClick={onStashCamera}
              className="rounded-inshop-sm px-1.5 py-0.5 text-2xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t('dashboard.map.openZoneShort')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 작업 위치 (공정 → 공장 다음 단계) ── */

/**
 * 조회 상태별 안내 한 줄 — 로딩·빈 값·오류·매핑 없음·미제공을 **각각 다른 말로** 한다
 * (PRD FR-5, §7 표). 목록이 있는 `ready` 는 여기서 null 을 내고 호출부가 목록을 그린다.
 */
function LocationNotice({
  state,
  locationNoun,
  onRetry,
}: {
  state: MapLocationsState
  locationNoun: string
  /** 없으면 재시도 버튼을 두지 않는다 — 같은 조회에 재시도 버튼이 둘일 이유가 없다 */
  onRetry?: () => void
}) {
  const { t } = useTranslation()

  if (state.kind === 'loading') {
    /* 로딩 자리를 스켈레톤으로 잡아 둔다 — 앞 공장의 목록이 남아 오인되지 않게 (FR-5) */
    return (
      <div className="space-y-1" aria-live="polite" aria-busy="true">
        <span className="sr-only">{t('dashboard.map.locationsLoading')}</span>
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-7 animate-pulse rounded-inshop-md bg-white/[0.06]" />
        ))}
      </div>
    )
  }

  const message =
    state.kind === 'error'
      ? t('dashboard.map.locationsError')
      : state.kind === 'unmapped'
        ? t('dashboard.map.locationsUnmapped')
        : state.kind === 'unsupported'
          ? t('dashboard.map.locationsUnsupported')
          : state.kind === 'idle'
            ? t('dashboard.map.locationsIdle', { noun: locationNoun })
            : t('dashboard.map.locationsEmpty', { noun: locationNoun })

  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1.5" aria-live="polite">
      <p className="min-w-0 text-2xs leading-relaxed text-white/55">{message}</p>
      {state.kind === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-inshop-md border border-white/15 px-2 py-1 text-2xs text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {t('dashboard.map.retry')}
        </button>
      )}
    </div>
  )
}

/**
 * 공장 상세 카드의 작업 위치 목록 — 한 줄에 이름 + 운영 코드(정반코드) + 상태.
 *
 * 항목은 **링크**다: 누르면 그 위치의 상세 화면으로 곧장 가고(즉시 이동 확정, PRD
 * 열린 결정 3), 손을 얹거나 포커스만 줘도 지도의 그 칸이 켜져 "어디인지"를 먼저 보여
 * 준다. 링크라서 키보드·새 탭·스크린리더가 전부 그대로 동작한다 (FR-6).
 *
 * 값이 없는 보조 정보(코드·상태)는 가짜 기본값을 만들지 않고 그 줄을 생략한다.
 * 지도에 걸 자리가 없으면 `지도 위치 정보 없음`을 그 자리에 말한다 (PRD §5.4).
 */
function LocationSection({
  state,
  color,
  knownLots,
  locationNoun,
  selectedLocation,
  hoveredLocation,
  onHoverLocation,
  onOpenLocation,
  onRetry,
}: {
  state: MapLocationsState
  color: string
  knownLots: Set<string>
  locationNoun: string
  selectedLocation: string | null
  hoveredLocation: string | null
  onHoverLocation: (id: string | null) => void
  onOpenLocation: (id: string) => void
  onRetry: () => void
}) {
  const { t } = useTranslation()
  /* 목록이 아직/아예 없으면 그 사정을 말한다. 엘리먼트는 언제나 truthy 라 상태로 가른다 */
  if (state.kind !== 'ready' || state.locations.length === 0) {
    return <LocationNotice state={state} locationNoun={locationNoun} onRetry={onRetry} />
  }
  const locations = state.locations

  return (
    <>
      {/* min-h 는 화면이 낮아도 목록이 완전히 접히지 않게 두세 줄을 보장한다 */}
      <ul className="scroll-thin max-h-64 min-h-20 space-y-1 overflow-y-auto pr-0.5">
        {locations.map((location) => {
          const isActive = location.id === selectedLocation
          const isHovered = !isActive && location.id === hoveredLocation
          const mapNote = mapLinkNote(location, knownLots)
          return (
            <li key={location.id}>
              <Link
                to={location.detailPath}
                onClick={(event) => {
                  /* 새 탭·다운로드 같은 브라우저 기본 동작은 가로채지 않는다 */
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                  event.preventDefault()
                  onOpenLocation(location.id)
                }}
                onMouseEnter={() => onHoverLocation(location.id)}
                onMouseLeave={() => onHoverLocation(null)}
                onFocus={() => onHoverLocation(location.id)}
                onBlur={() => onHoverLocation(null)}
                aria-current={isActive ? 'true' : undefined}
                style={
                  isActive
                    ? { backgroundColor: `${color}2b`, boxShadow: `inset 0 0 0 1px ${color}73` }
                    : isHovered
                      ? { backgroundColor: `${color}17` }
                      : undefined
                }
                className={cn(
                  'flex items-center gap-2 rounded-inshop-md px-2 py-1.5 transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70',
                  isActive ? 'text-white' : 'text-white/78 hover:text-white'
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-inshop-xs font-medium">
                      {location.displayName}
                    </span>
                    {location.locationCode && (
                      <span
                        className="shrink-0 rounded border px-1 py-px font-mono text-2xs leading-4 text-white/62"
                        style={{ borderColor: `${color}4d` }}
                        title={t('dashboard.map.locationCode')}
                      >
                        {location.locationCode}
                      </span>
                    )}
                  </span>
                  {(location.statusLabelKey || mapNote) && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-white/48">
                      {location.statusLabelKey && <span>{t(location.statusLabelKey)}</span>}
                      {location.statusLabelKey && mapNote && <span aria-hidden="true">·</span>}
                      {mapNote && <span>{t(mapNote)}</span>}
                    </span>
                  )}
                </span>
                <span aria-hidden="true" className="shrink-0 text-2xs text-white/45">
                  →
                </span>
                <span className="sr-only">{t('dashboard.map.openLocationDetail')}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {state.kind === 'ready' && state.facilityPath && (
        <Link
          to={state.facilityPath}
          className="mt-1.5 inline-flex shrink-0 self-start rounded-inshop-sm px-1 py-0.5 text-2xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {t('dashboard.map.openFacility')}
        </Link>
      )}
    </>
  )
}

/**
 * 우측 패널의 압축판 — 같은 작업 위치를 칩 한 줄로. 지도 없이도 같은 데까지 갈 수
 * 있어야 한다는 요구(PRD §5.4·수용 기준 8)를 위해 상세 카드와 **같은 동작**을 둔다.
 */
function LocationChips({
  state,
  color,
  selectedLocation,
  hoveredLocation,
  onOpenLocation,
  onHoverLocation,
}: {
  state: MapLocationsState
  color: string
  selectedLocation: string | null
  hoveredLocation: string | null
  onOpenLocation: (id: string) => void
  onHoverLocation: (id: string | null) => void
}) {
  const { t } = useTranslation()
  if (state.kind !== 'ready' || state.locations.length === 0) {
    /* 재시도는 왼쪽 상세 카드가 맡는다 — 같은 조회에 버튼을 둘 두지 않는다 */
    return <LocationNotice state={state} locationNoun={t('dashboard.map.locationNoun')} />
  }
  const locations = state.locations
  return (
    <>
      <p className="mb-1.5 px-0.5 text-2xs font-medium text-white/45">
        {t('dashboard.map.locationsOpenLabel')}
      </p>
      <div className="flex flex-wrap gap-1">
        {locations.map((location) => {
          const isActive = location.id === selectedLocation
          const isHovered = !isActive && location.id === hoveredLocation
          return (
            <Link
              key={location.id}
              to={location.detailPath}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                event.preventDefault()
                onOpenLocation(location.id)
              }}
              onMouseEnter={() => onHoverLocation(location.id)}
              onMouseLeave={() => onHoverLocation(null)}
              onFocus={() => onHoverLocation(location.id)}
              onBlur={() => onHoverLocation(null)}
              aria-current={isActive ? 'true' : undefined}
              title={
                location.locationCode
                  ? `${location.displayName} · ${location.locationCode}`
                  : location.displayName
              }
              className={cn(
                'rounded border px-1.5 py-0.5 text-2xs',
                'transition-[background-color,border-color,box-shadow,color] duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
              )}
              style={
                isActive
                  ? {
                      borderColor: color,
                      backgroundColor: `${color}42`,
                      color: '#fff',
                      boxShadow: `0 0 8px ${color}59`,
                    }
                  : isHovered
                    ? {
                        borderColor: `${color}80`,
                        backgroundColor: `${color}1a`,
                        color: 'rgba(255,255,255,0.9)',
                      }
                    : { borderColor: `${color}4d`, color: 'rgba(255,255,255,0.78)' }
              }
            >
              {location.displayName}
            </Link>
          )
        })}
      </div>
    </>
  )
}

/* ── 공장 상세 (선택 시 패널 맨 위) ── */

interface FactorySummary {
  name: string
  process: string | null
  lotCount: number
  area: number
  indoor: number
  outdoor: number
  categories: { category: string; count: number }[]
}

function FactoryDetailCard({
  data,
  locationNoun,
  state,
  knownLots,
  selectedLocation,
  hoveredLocation,
  onHoverLocation,
  onOpenLocation,
  onClearLocation,
  onRetry,
  onClose,
}: {
  data: FactorySummary
  /** 이 공정이 작업 위치를 부르는 말 — 공정 모듈이 준다 (PRD FR-3 locationNounKey) */
  locationNoun: string
  state: MapLocationsState
  /** 지도 fixture 에 실제로 있는 지번 — 연결 키의 매핑 불일치를 가려내는 데 쓴다 */
  knownLots: Set<string>
  selectedLocation: string | null
  hoveredLocation: string | null
  onHoverLocation: (id: string | null) => void
  onOpenLocation: (id: string) => void
  onClearLocation: () => void
  onRetry: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const processColor = data.process ? colorOfProcess(data.process) : '#9a9890'
  const maxCategoryCount = Math.max(...data.categories.map((category) => category.count), 1)
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
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-2xs font-medium text-white/52">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: processColor }} />
            <span>{data.process || t('dashboard.map.noProcess')}</span>
          </div>
          <h3 className="truncate text-inshop-xl font-semibold leading-tight tracking-[-0.03em]">
            {data.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('dashboard.map.close')}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-inshop-lg border border-white/8 text-white/48 transition-colors hover:border-white/15 hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="scroll-thin scroll-shadow-y flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* 세로가 빠듯한 화면(≤900px)에서는 이 요약 칸이 여백과 숫자를 한 단계 줄여
          아래 목록에 줄을 내준다 — 스크롤로 밀어내기 전에 먼저 자리를 만든다 */}
      <dl className="grid shrink-0 grid-cols-2 gap-2 border-y border-white/8 bg-white/[0.018] p-3 text-inshop-xs [@media(max-height:900px)]:gap-1.5 [@media(max-height:900px)]:p-2">
        {/* 지번 수 타일은 두지 않는다 — 총괄 화면의 최소 단위는 베이다(지번은 야드 몫) */}
        <div className="col-span-2 rounded-inshop-lg border border-white/8 bg-white/[0.035] p-3 [@media(max-height:900px)]:p-2">
          <dt className="text-2xs text-white/45">{t('dashboard.map.area')}</dt>
          <dd className="mt-1 text-inshop-2xl font-semibold tracking-[-0.04em] tabular-nums [@media(max-height:900px)]:text-inshop-xl">
            {Math.round(data.area).toLocaleString()}
            <span className="ml-1 text-2xs font-normal text-white/42">m²</span>
          </dd>
        </div>
        <div className="flex items-center justify-between px-2 py-1">
          <dt className="text-white/48">{t('dashboard.map.indoor')}</dt>
          <dd className="font-medium tabular-nums text-white/86">{data.indoor}</dd>
        </div>
        <div className="flex items-center justify-between px-2 py-1">
          <dt className="text-white/48">{t('dashboard.map.outdoor')}</dt>
          <dd className="font-medium tabular-nums text-white/86">{data.outdoor}</dd>
        </div>
      </dl>

      {/* 절점 기반 실적 참고 배지 — 통합실적과 같은 원천(mock). 데이터 없는 공장은 스스로 빠진다 */}
      <PerformanceBadge factory={data.name} />

      {/*
        작업 위치 섹션 (PRD §5.3) — 이 공장의 다음 선택 단계. 이름과 운영 코드(조립:
        정반코드)를 함께 세우고, 상태는 값이 있을 때만 보조로 붙인다. 목록이 길어질 수
        있어 이 섹션만 따로 스크롤한다 — 카드가 지도를 덮지 않도록.
      */}
      {/*
        `shrink-0` 이 중요하다 — 이 칸은 눌러도 더 이상 줄지 않는다(안의 목록이 최소
        높이를 갖고 있어서, 칸만 줄면 목록이 칸 밖으로 **삐져나와 아래 칸 글자 위에
        겹쳐 그려진다**). 모자란 높이는 칸을 줄여서가 아니라 바깥 본문 스크롤로 낸다.
      */}
      <div className="flex shrink-0 flex-col border-b border-white/8 px-3 py-3">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
          <p className="text-2xs font-medium text-white/55">
            {locationNoun}
            {state.kind === 'ready' && state.locations.length > 0 && (
              <span className="ml-1.5 font-mono text-white/30">{state.locations.length}</span>
            )}
          </p>
          {selectedLocation && (
            <button
              type="button"
              onClick={onClearLocation}
              className="shrink-0 rounded-inshop-sm px-1 py-0.5 text-2xs text-white/55 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {t('dashboard.map.locationDeselect')}
            </button>
          )}
        </div>
        <LocationSection
          state={state}
          color={processColor}
          knownLots={knownLots}
          locationNoun={locationNoun}
          selectedLocation={selectedLocation}
          hoveredLocation={hoveredLocation}
          onHoverLocation={onHoverLocation}
          onOpenLocation={onOpenLocation}
          onRetry={onRetry}
        />
      </div>

      {data.categories.length > 0 && (
        <div className="shrink-0 px-4 py-3.5">
          <p className="text-2xs font-medium text-white/45">
            {t('dashboard.map.categories')}
          </p>
          <ul className="mt-2.5 space-y-2.5">
            {data.categories.map((c) => (
              <li key={c.category} className="text-inshop-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PARCEL_CATEGORY_COLORS[c.category] ?? '#9a9890' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-white/72">{c.category}</span>
                  <span className="shrink-0 font-mono tabular-nums text-white/48">{c.count}</span>
                </div>
                <div className="ml-4 mt-1.5 h-1 overflow-hidden rounded-full bg-white/7">
                  <div
                    className="h-full rounded-full opacity-80"
                    style={{
                      backgroundColor: PARCEL_CATEGORY_COLORS[c.category] ?? '#9a9890',
                      width: `${(c.count / maxCategoryCount) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
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

/** 공장 상세 카드에 필요한 집계 — 소속 지번의 수·면적·옥내외·분류 구성 */
function summarizeFactory(parcels: YardParcels, name: string): FactorySummary {
  const factory = parcels.factories.find((f) => f.name === name) ?? null
  const codes = new Set(factory?.lotCodes ?? [])
  const lots = parcels.lots.filter((lot) => codes.has(lot.lot) || lot.factory === name)

  let area = 0
  let indoor = 0
  let outdoor = 0
  const categoryCounts = new Map<string, number>()
  for (const lot of lots) {
    area += lot.area
    if (lot.place === '옥내') indoor += 1
    else if (lot.place === '옥외') outdoor += 1
    categoryCounts.set(lot.category, (categoryCounts.get(lot.category) ?? 0) + 1)
  }
  const categories = [...categoryCounts]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  return {
    name,
    process: factory?.process ?? lots[0]?.process ?? null,
    lotCount: lots.length,
    area,
    indoor,
    outdoor,
    categories,
  }
}
