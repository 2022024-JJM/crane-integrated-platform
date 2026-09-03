import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type ReactElement,
} from 'react'
import {
  YardMap,
  type LatLon,
  type LatLonBounds,
  type YardLayers,
  type YardParcelBaySpan,
  type YardParcelLayer,
  type YardParcelLotGroup,
  type YardView,
  type Viewport,
} from '../../yard-map'
import { takeCameraHandoff } from '../../yard-map/lib/cameraHandoff'
import {
  boundsOfLots,
  colorOfProcess,
  type YardParcelFactory,
} from '../../../entities/yard-parcels'
import { restyleDarkBasemap } from '../../dashboard-map/lib/darkMapRestyle'
import {
  bayCameraBounds,
  factoryCameraBoundsOf,
  overviewCameraBounds,
  OVERVIEW_BOUNDS_PADDING,
} from '../../dashboard-map/lib/overviewCamera'
import {
  DashboardMiniMap,
  type DashboardMiniMapHandle,
} from '../../dashboard-map/ui/DashboardMiniMap'
import { summarizeBay } from '../../dashboard-map/lib/bayDetail'
import { BayDetailCard } from '../../dashboard-map/ui/BayDetailCard'
import { spotlitLot } from '../../dashboard-map/lib/lotSpot'
import {
  FactoryHudLabel,
  type FactoryHudCamera,
  type FactoryHudLabelHandle,
} from '../../dashboard-map/ui/FactoryHudLabel'
import { ChevronDownIcon } from '../../../ui/icons'
import { DraggableCard } from '../../../ui/atoms/DraggableCard'
import {
  DrilldownBreadcrumb,
  type BreadcrumbStep,
} from '../../../ui/atoms/DrilldownBreadcrumb'
import { useDrilldown } from '../../../lib/useDrilldown'
import { useDrilldownEscape } from '../../../lib/useDrilldownEscape'
import { YARD_DRILLDOWN } from '../../../lib/drilldownUrl'
import { cn } from '../../../lib/utils'
import type {
  MapEntryMarker,
  ProcessMapEntryHandle,
  ProcessMapEntryProps,
} from '../model/types'
import {
  demoteNonMemberLots,
  memberExtentOf,
  memberFactoriesOf,
  memberProcessesOf,
  orderFactoryNames,
  sameBounds,
} from '../lib/members'
import { MapMarkerLayer, type MapMarkerLayerHandle } from './MapMarkerLayer'

/*
 * '맵 진입 공정 화면' 공통 프레임 — 도장 배치 맵(PaintingYardMap)에서 공정 무관 골격을
 * 들어 올린 것이다. 문법은 그대로다: 대시보드와 같은 "실제 지도" 룩(밝힌 다크 베이스맵 +
 * 3D 공장 모형 + 좌하단 미니맵) 위에 **주인공 공장만** process 네온으로 피워 올리고, 타
 * 공정 지번은 소속을 지워 무색 실루엣로만 남긴다. 공장을 골라 드릴인하면 베이가 눌리는
 * 칸이 되고, 이름은 떠 있는 이름패(FactoryHudLabel)로 일어난다. 좌상단 한 자리는 공정
 * 상세(`detailOverlay`)와 베이 카드가 번갈아 쓴다(공장 → 베이 → 상세 한 갈래). 우측은
 * 공장 접이식 카드 패널이다.
 *
 * 무엇이 다른가 — **공정이 끼어드는 자리가 전부 계약(props)이 되었다**: 주인공 공장
 * (`factoryNames`), 강조색(`accentOf`), 마커(`renderMarker`), 카드 요약·본문·베이 본문·
 * 범례(슬롯), 문구(`labels`). 계약의 근거는 `model/types.ts` 참조.
 *
 * 다크 베이스맵을 강제한다 — 어두운 바탕이라야 네온이 산다(대시보드와 같은 규칙).
 */

/** 지번/마커만 보이게 — 야드 fixture 레이어는 전부 끈다 */
const ENTRY_LAYERS: YardLayers = {
  basemap: true,
  facilities: false,
  lots: false,
  blocks: false,
  moves: false,
  plans: false,
  shops: false,
}

const DIM = '#000'

/** 마커를 내지 않는 공정이 받는 빈 마커 목록 — 참조가 고정이라 매 렌더 다시 그리지 않는다 */
const NO_MARKERS = [] as const

/**
 * 베이를 골랐을 때 화면에 담을 **공장 범위의 최소 비율** — 확대 배율의 상한이다.
 * 대시보드와 같은 값: 베이 크기가 제각각이라 여백만으로 맞추면 착지 거리가 널뛴다.
 */
const BAY_CAMERA_MIN_RATIO = 0.55

/**
 * 값이 같으면 **이전 객체를 그대로** 돌려주는 bounds 안정화 훅.
 *
 * 카메라 목표(entryExtent→factoryExtent→bayExtent→focusBounds)는 참조 정체성이 곧
 * "비행 신호"다 — 소비자 화면의 시계·폴링 재렌더가 불안정한 prop(인라인 필터 등)으로
 * 이 사슬을 흔들면, 같은 값의 새 객체가 매초 흘러들어 지도가 매초 제 프레이밍으로
 * 되돌아 난다(B1 도장 깜빡임). 여기서 값 비교로 한 번 끊어 그 사고 계급을 막는다.
 * 일부러 새 객체로 재비행을 시키는 경로(overviewRequest·승계 글라이드 kick)는 이
 * 훅을 지나지 않으므로 그대로 산다.
 */
function useStableBounds<T extends LatLonBounds | null>(bounds: T): T {
  const ref = useRef<T>(bounds)
  const next = sameBounds(ref.current, bounds) ? ref.current : bounds
  ref.current = next
  return next
}

/** 지번 데이터가 비었을 때의 마지막 안전 범위 — 옥포 야드 언저리 */
const FALLBACK_EXTENT: LatLonBounds = {
  minLat: 34.86,
  minLon: 128.69,
  maxLat: 34.88,
  maxLon: 128.72,
}

function ProcessMapEntryInner<M extends MapEntryMarker>(
  {
    parcels,
    factoryNames,
    accentOf,
    extentLotFilter,
    basemapLayers,
    yardExtent,
    selectedFactory,
    onSelectFactory,
    initialOverview = false,
    markers,
    selectedMarkerId = null,
    onSelectMarker,
    renderMarker,
    detailOverlay,
    factorySummary,
    factoryBody,
    panelHeaderExtra,
    bayBody,
    legend,
    labels,
    className,
  }: ProcessMapEntryProps<M>,
  handleRef: ForwardedRef<ProcessMapEntryHandle>
) {
  const boxRef = useRef<HTMLDivElement>(null)
  const miniMapRef = useRef<DashboardMiniMapHandle>(null)
  /* 카메라(매 프레임)는 state 가 아니라 이 층들의 handle 로만 흐른다 — MapMarkerLayer 참조 */
  const markerLayerRef = useRef<MapMarkerLayerHandle>(null)
  const hudRef = useRef<FactoryHudLabelHandle>(null)
  /* 마지막으로 받은 카메라 — 이름패가 붙는 **첫 프레임**에 쓸 값(대시보드와 같은 이유) */
  const cameraRef = useRef<FactoryHudCamera | null>(null)
  /*
   * 총괄('/')에서 이어 온 카메라 승계(1회성·TTL 3s) — 있으면 첫 프레임이 떠나온
   * 화각 그대로 서고(initialView), 잠시 뒤 제 프레이밍으로 미끄러진다(glide kick).
   * 없으면(직접 진입·새로고침) 기존 initialBounds 폴백 — 동작 그대로.
   */
  const handoffRef = useRef<YardView | null | undefined>(undefined)
  if (handoffRef.current === undefined) handoffRef.current = takeCameraHandoff()
  const handoffView = handoffRef.current
  const [glideKick, setGlideKick] = useState(0)
  useEffect(() => {
    if (!handoffView) return
    /* 두 번 차는 건 ResizeObserver 측정 경쟁으로 첫 발이 무시될 때의 보험 */
    const first = setTimeout(() => setGlideKick(1), 120)
    const second = setTimeout(() => setGlideKick(2), 600)
    return () => {
      clearTimeout(first)
      clearTimeout(second)
    }
  }, [handoffView])
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 })
  const [hoveredFactory, setHoveredFactory] = useState<string | null>(null)
  /*
   * 고른 베이 — **URL 이 원본**이다(`?bay=`). 화면 안 state 였을 때는 새로고침이 베이를
   * 잃었고 링크로 자리를 건넬 수 없었다. 규칙은 `shared/lib/drilldownUrl` 참조.
   *
   * 전체 보기에서는 베이가 설 자리가 없으므로(공장 안의 칸이다) 쿼리에 남아 있어도
   * 없는 것으로 읽는다 — 표현할 수 없는 상태를 들고 있지 않는다.
   */
  const drill = useDrilldown()
  const selectedBay = initialOverview ? null : drill.bay
  const [hoveredBay, setHoveredBay] = useState<string | null>(null)
  /* 베이 카드가 짚은 지번 낱장 — 누른 것과 손 얹힌 것을 따로 들어 미리보기가 이긴다 */
  const [spottedLot, setSpottedLot] = useState<string | null>(null)
  const [hoveredLotRow, setHoveredLotRow] = useState<string | null>(null)
  /* 짚기는 그 베이 카드의 것 — 베이가 바뀌거나 카드가 닫히면 함께 사라진다 */
  useEffect(() => {
    setSpottedLot(null)
    setHoveredLotRow(null)
  }, [selectedBay])
  /* 대시보드와 같은 탐색 장치 — 미니맵 클릭 이동과 "전체 보기" */
  const [navigationTarget, setNavigationTarget] = useState<LatLon | null>(null)

  /* 대시보드 전체 현황과 같은 "실제 지도" 배색 — 한 야드가 여러 화면에서 같게 읽힌다 */
  const restyledBasemap = useMemo(() => restyleDarkBasemap(basemapLayers), [basemapLayers])

  /* 주인공 공장·강등된 지번·스포트라이트 공정 — lib/members 의 순수 계산 */
  const memberFactories = useMemo(
    () => memberFactoriesOf(parcels, factoryNames),
    [parcels, factoryNames]
  )
  const memberLots = useMemo(
    () => demoteNonMemberLots(parcels, memberFactories),
    [parcels, memberFactories]
  )
  const focusedProcesses = useMemo(() => memberProcessesOf(memberFactories), [memberFactories])

  /* 공장별 강조색 — 기본은 그 공장의 공정색. 카드 좌색 막대·이름패·호버 글로우가 쓴다 */
  const accentByName = useMemo(() => {
    const of = accentOf ?? ((f: YardParcelFactory) => colorOfProcess(f.process))
    return new Map(memberFactories.map((f) => [f.name, of(f)]))
  }, [memberFactories, accentOf])
  const accentOfName = useCallback(
    (name: string) => accentByName.get(name) ?? '#c9c4bc',
    [accentByName]
  )

  /* 홈 범위 — 기본은 주인공 공장 소속 지번. 소비자가 제 잣대를 주입할 수 있다(도장) */
  const entryExtent = useStableBounds(
    useMemo<LatLonBounds>(() => {
      const memberNames = new Set(memberFactories.map((f) => f.name))
      const filter =
        extentLotFilter ??
        ((lot: (typeof parcels.lots)[number]) => lot.factory != null && memberNames.has(lot.factory))
      return memberExtentOf(parcels, filter, FALLBACK_EXTENT)
    }, [parcels, memberFactories, extentLotFilter])
  )

  /* 전체 보기 카메라 — 대시보드 전체 현황의 대문과 같은 자리(같은 범위·같은 오프셋) */
  const overviewBounds = useMemo<LatLonBounds>(
    () => overviewCameraBounds(parcels) ?? entryExtent,
    [parcels, entryExtent]
  )

  /*
   * 전체 보기인가 — **URL 이 말한다**(`?factory=` 가 없으면 전체 보기). 부모가 이 화면의
   * 공장 목록으로 한 번 검증한 값이 `initialOverview` 로 들어온다(이름은 옛 계약이지만
   * 값은 마운트 뒤에도 URL 을 따라간다) — 그래서 브라우저 뒤로가기가 곧 드릴아웃이다.
   */
  const inOverview = initialOverview

  /*
   * '전체 보기' 버튼을 **다시** 누를 때의 재비행 표. 이미 전체 보기라 URL 이 그대로면
   * 카메라도 그대로일 텐데, 그사이 손으로 지도를 끌어 다른 데를 보고 있을 수 있다.
   * 이 수가 오르면 같은 범위를 **새 객체**로 내어 카메라가 제자리를 다시 맞춘다.
   */
  const [overviewNonce, setOverviewNonce] = useState(0)
  const overviewTarget = useMemo<LatLonBounds>(
    () => ({ ...overviewBounds }),
    /* nonce 는 값이 아니라 정체성을 갈아 끼우는 손잡이다 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overviewBounds, overviewNonce]
  )

  /* 첫 프레임의 카메라 판단은 마운트 때 한 번 굳힌다 — YardMap 의 initialBounds 는
     마운트 전용이라, 뒤에 URL 이 바뀌었다고 이 값이 흔들릴 이유가 없다 */
  const mountOverviewRef = useRef(initialOverview)
  /* 우측 패널에서 펴져 있는 공장 카드 — 대시보드 공정존 카드처럼 한 번에 하나만 편다 */
  const [expandedFactory, setExpandedFactory] = useState<string | null>(() =>
    initialOverview ? null : selectedFactory
  )

  /* 고른 공장의 카메라 범위 — 군집 대비로 한 번 조인다(대시보드와 같은 잣대) */
  const factoryExtent = useStableBounds(
    useMemo(
      () => factoryCameraBoundsOf(parcels, selectedFactory) ?? entryExtent,
      [parcels, selectedFactory, entryExtent]
    )
  )

  /* 고른 베이의 카메라 범위 — 공장 범위의 일정 비율을 함께 담아 착지 거리를 고른다 */
  const bayExtent = useStableBounds(
    useMemo<LatLonBounds | null>(() => {
      if (!selectedBay) return null
      const bay = parcels.bays.find((b) => b.id === selectedBay)
      if (!bay) return null
      const around = boundsOfLots(parcels, bay.lotCodes)
      return around ? bayCameraBounds(around, factoryExtent, BAY_CAMERA_MIN_RATIO) : null
    }, [parcels, selectedBay, factoryExtent])
  )

  /* 카메라 목표 — 전체 보기 > 고른 베이 > 고른 공장 순으로 좁혀 들어간다 */
  const cameraBounds = inOverview ? overviewTarget : (bayExtent ?? factoryExtent)
  /*
   * 승계 글라이드 — kick 이 오르면 같은 목표를 새 정체성으로 다시 낸다. YardMap 은
   * focusBounds 참조가 바뀔 때만 굴리고 마운트 첫 관찰은 넘기므로, 승계 화각에서
   * 제 프레이밍으로 넘어가는 첫 비행이 여기서 시작된다.
   */
  const glidedCameraBounds = useMemo(
    () => (glideKick > 0 && cameraBounds ? { ...cameraBounds } : cameraBounds),
    [glideKick, cameraBounds]
  )

  /* 공장 선택(지도·카드 공통) — 전체 보기를 접고 그 공장으로 날아가며, 그 카드를 편다 */
  const selectFactory = useCallback(
    (name: string) => {
      setExpandedFactory(name)
      setHoveredBay(null)
      /* 베이는 URL 이 턴다 — 공장이 바뀌면 그 아래는 뜻을 잃는다(narrowDrilldown) */
      onSelectFactory(name)
    },
    [onSelectFactory]
  )

  /* 지도의 베이 클릭 — 고르기까지. 재클릭은 접기. 좌상단 자리는 하나라 상세는 접는다 */
  const selectBay = useCallback(
    (id: string) => {
      drill.go({ bay: drill.bay === id ? null : id })
      onSelectMarker?.(null)
    },
    [drill, onSelectMarker]
  )

  /* 원 위치 — '전체 보기' 버튼 전용: 대문 자리로 나가며 전부 닫는다.
     지도의 빈 곳 클릭은 이 길로 오지 않는다(아래 stepBack — 오클릭 한 번이 쌓아 둔
     선택 전부를 무너뜨리면 안 된다, UX 감사 O1). */
  const returnToOverview = useCallback(() => {
    setNavigationTarget(null)
    setExpandedFactory(null)
    setHoveredBay(null)
    onSelectMarker?.(null)
    /* 이미 전체 보기여서 URL 이 그대로여도 카메라는 제자리를 다시 맞춘다 */
    setOverviewNonce((n) => n + 1)
    onSelectFactory(null)
  }, [onSelectFactory, onSelectMarker])

  /*
   * 한 단계만 뒤로 — 지번 짚기 → 베이 → 공장 → 전체 보기 순으로 **한 칸씩** 올라온다.
   * 배경 오클릭과 ESC 가 같은 계단을 쓴다(같은 제스처 = 같은 의미). 이미 전체 보기면
   * 카메라만 제자리로 다시 맞춘다 — 물러날 것이 없을 때의 빈 곳 클릭은 "다시 정렬"이다.
   */
  const stepBack = useCallback(() => {
    if (spottedLot) {
      setSpottedLot(null)
      return
    }
    if (inOverview) {
      setNavigationTarget(null)
      setOverviewNonce((n) => n + 1)
      return
    }
    onSelectMarker?.(null)
    drill.up()
  }, [spottedLot, inOverview, drill, onSelectMarker])

  useImperativeHandle(handleRef, () => ({ returnToOverview }), [returnToOverview])

  /*
   * URL 이 밖에서 바뀌었을 때(뒤로가기·브레드크럼·딥링크) 카드가 따라가게 하는 뒷받침.
   * 카메라는 `cameraBounds` 가 이미 URL 파생이라 손댈 것이 없다 — 여기서는 URL 에 담지
   * 않는 곁가지(펴 둔 카드·호버)만 맞춘다.
   */
  const prevFactoryRef = useRef<string | null>(inOverview ? null : selectedFactory)
  useEffect(() => {
    const next = inOverview ? null : selectedFactory
    if (prevFactoryRef.current === next) return
    prevFactoryRef.current = next
    setExpandedFactory(next)
    setHoveredBay(null)
  }, [inOverview, selectedFactory])

  /* ESC = 한 단계 위 (지번 → 베이 → 공장 → 야드). 글자를 치는 중이면 삼킨다 */
  useDrilldownEscape(stepBack)

  /* 주인공 공장의 베이 스팬 — 공장을 베이마다 한 채로 세우는 근거(전체 현황과 같은 자료) */
  const memberBays = useMemo<YardParcelBaySpan[]>(() => {
    const names = new Set(memberFactories.map((f) => f.name))
    const labelOfLot = new Map(parcels.lots.map((lot) => [lot.lot, lot.label]))
    return parcels.bays
      .filter((bay) => names.has(bay.factory))
      .map((bay) => {
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
  }, [parcels, memberFactories])

  /* 드릴인한 공장의 베이 — 이때만 지도의 칸이 되어 눌리고 지붕에 이름이 선다 */
  const focusedBays = useMemo(
    () => (inOverview ? [] : memberBays.filter((bay) => bay.factory === selectedFactory)),
    [memberBays, inOverview, selectedFactory]
  )
  const lotGroups = useMemo<YardParcelLotGroup[]>(
    () => focusedBays.map((bay) => ({ id: bay.id, label: bay.label, lotCodes: [...bay.lotCodes] })),
    [focusedBays]
  )

  // 주인공 공장만 process 모드로: 각자 제 공정색 네온, 타 공정 = 무색 실루엣
  const parcelLayer: YardParcelLayer = useMemo(
    () => ({
      lots: memberLots,
      factories: memberFactories,
      categoryColor: parcels.categoryColor,
      colorMode: 'process',
      processColor: colorOfProcess,
      focusedProcesses,
      /* 전체 보기에서는 어느 공장도 고르지 않은 상태 — 모든 공장이 같은 밝기로 선다 */
      focusedFactory: inOverview ? null : selectedFactory,
      hoveredFactory,
      /* 공장을 고르면 나머지 주인공 공장은 절반쯤 눌린 네온 — 대시보드 FR-5 와 같은 문법 */
      relatedDimFactor: 0.5,
      /* 지번이 나뉜 형태를 연하게 남긴다(대시보드와 동일) — 야드가 구역으로 읽히게 */
      lotOutlineOpacity: 0.1,
      /* 공장을 이루는 스팬 — 베이마다 박공 지붕이 서고 공장 외곽선이 그것을 묶는다 */
      factoryBays: memberBays,
      /* 드릴인한 공장 안의 칸 = 베이. 지번 낱장이 아니라 이 단위로 눌리고 이름이 선다 */
      lotGroups,
      selectedLot: selectedBay,
      hoveredLot: hoveredBay,
      /* 베이 카드가 짚은 지번 한 장 — 호버(미리보기)가 눌러 둔 것을 잠시 덮는다 */
      highlightedLot: spotlitLot(spottedLot, hoveredLotRow),
      /* 이름은 캔버스가 아니라 마커 위 DOM 층이 그린다 — 캔버스에 그리면 마커에 가려진다 */
      showLabels: false,
      /* 공장 밖(빈 야드·타 공정) 클릭은 null 로 온다 = **한 단계만** 뒤로 — 전체 리셋은 '전체 보기' 버튼의 몫 */
      onSelectFactory: (name) => (name ? selectFactory(name) : stepBack()),
      onHoverFactory: setHoveredFactory,
      onSelectLot: selectBay,
      onHoverLot: setHoveredBay,
    }),
    [
      memberLots,
      memberFactories,
      parcels.categoryColor,
      focusedProcesses,
      inOverview,
      selectedFactory,
      hoveredFactory,
      selectFactory,
      stepBack,
      memberBays,
      lotGroups,
      selectedBay,
      hoveredBay,
      selectBay,
      spottedLot,
      hoveredLotRow,
    ]
  )

  // 오버레이 투영에 쓸 뷰포트 크기 — 캔버스와 같은 박스를 잰다
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => {
      const rect = box.getBoundingClientRect()
      setViewport({ width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  /* 고른 베이의 상세 — 소속 지번과 그 원본 설명. 매핑에 없는 베이면 null */
  const selectedBayData = useMemo(
    () => (selectedBay ? summarizeBay(parcels, selectedBay) : null),
    [parcels, selectedBay]
  )

  /*
   * 드릴다운 자취 — `야드 › 조립 › GBS › 3BAY`.
   *
   * 상태를 새로 들지 않는다: 조각은 전부 지금 URL 에서 나오고, 누르면 그 단계의 주소로
   * 갈 뿐이다. 그래서 브라우저 뒤로가기와 이 줄이 어긋날 수가 없다.
   *
   * 첫 조각 '야드'는 이 화면 밖(총괄 '/')으로 나가는 문이라 프레임이 문구를 지어낼 수
   * 없다 — 문구가 안 들어오면 줄을 세우지 않는다(프레임은 t() 를 모른다는 계약).
   */
  const breadcrumbSteps = useMemo<BreadcrumbStep[]>(() => {
    const yardLabel = labels.breadcrumbYard
    if (!yardLabel) return []
    const steps: BreadcrumbStep[] = [{ key: 'yard', label: yardLabel, href: '/' }]

    /* 공정 이름은 문구가 없으면 지번 데이터가 부르는 이름을 쓴다(번역이 아니라 고유명사) */
    const processLabel = labels.breadcrumbProcess ?? focusedProcesses[0] ?? ''
    if (processLabel) {
      steps.push({
        key: 'process',
        label: processLabel,
        /* 이 화면의 전체 보기 = 공정 단계. 지금 거기면 링크가 아니다 */
        href: inOverview ? null : drill.hrefFor(YARD_DRILLDOWN),
      })
    }
    if (!inOverview && selectedFactory) {
      steps.push({
        key: 'factory',
        label: selectedFactory,
        href: selectedBayData
          ? drill.hrefFor({ ...YARD_DRILLDOWN, factory: selectedFactory })
          : null,
      })
    }
    if (selectedBayData) {
      steps.push({ key: 'bay', label: selectedBayData.label, href: null })
    }
    return steps
  }, [
    labels.breadcrumbYard,
    labels.breadcrumbProcess,
    focusedProcesses,
    inOverview,
    selectedFactory,
    selectedBayData,
    drill,
  ])

  /*
   * 떠 있는 이름패가 설 자리 — 가로는 고른 공장의 지번 centroid, 세로는 그 공장 실루엣
   * 위다. 베이까지 내려가면 이름패는 물러난다 — 그 단계의 주인공은 지붕에 새겨진 베이
   * 이름이고, 공장 이름은 베이 카드의 머리가 이어받는다(대시보드와 같은 규칙).
   */
  const hudFactory = useMemo(() => {
    if (inOverview || selectedBay) return null
    const factory = memberFactories.find((f) => f.name === selectedFactory)
    if (!factory) return null
    const codes = new Set(factory.lotCodes)
    const outline = parcels.lots.flatMap((lot) =>
      codes.has(lot.lot) || lot.factory === factory.name ? lot.polygon : []
    )
    return { factory, outline }
  }, [parcels, memberFactories, selectedFactory, inOverview, selectedBay])

  /* 드릴인한 공장의 카드가 목록 제일 위로 — 펴진 내용이 접힘 없이 바로 보인다 */
  const orderedFactories = useMemo(
    () => orderFactoryNames(factoryNames, selectedFactory, inOverview),
    [factoryNames, selectedFactory, inOverview]
  )

  return (
    <div
      ref={boxRef}
      className={cn(
        'relative overflow-hidden rounded-inshop-lg border border-border bg-[#0b0f14]',
        className
      )}
    >
      <YardMap
        lots={[]}
        blocks={[]}
        moves={[]}
        plans={[]}
        basemapLayers={restyledBasemap}
        /* 홈은 이 화면의 지번 전체 — "전체 보기"가 여기로 나온다 */
        extent={entryExtent}
        minScale={35_000}
        colorOfCategory={() => DIM}
        layers={ENTRY_LAYERS}
        parcels={parcelLayer}
        /* 처음은 대시보드 전체 현황과 같은 대문 — 딥링크 진입만 그 공장을 바로 맞춘다 */
        initialBounds={mountOverviewRef.current ? overviewBounds : factoryExtent}
        initialBoundsPadding={mountOverviewRef.current ? OVERVIEW_BOUNDS_PADDING : 0.12}
        /* 총괄에서 이어 온 화각 — 있으면 첫 프레임이 그 자리에서 시작한다 */
        initialView={handoffView}
        focusBounds={glidedCameraBounds}
        focusBoundsPadding={inOverview ? OVERVIEW_BOUNDS_PADDING : 0.12}
        /* 전체 보기는 "원위치" — 회전해 둔 방위도 대문 방향(북쪽 0°)으로 함께 되돌린다 */
        focusBoundsBearing={inOverview ? 0 : null}
        navigationTarget={navigationTarget}
        showFacilityLabels={false}
        mapTheme="dark"
        /* 대시보드 전체 현황과 같은 3D 모형 룩 */
        viewMode="3d"
        lotOpacity={0.7}
        onViewChange={(nextView: YardView, nextViewport: Viewport) => {
          /* 매 프레임 들어온다 — state 대신 handle 로 마커 층·미니맵·이름패만 갱신한다 */
          cameraRef.current = { view: nextView, viewport: nextViewport }
          markerLayerRef.current?.update(nextView)
          miniMapRef.current?.updateView(nextView, nextViewport)
          hudRef.current?.updateView(nextView, nextViewport)
        }}
        className="h-full w-full"
      />

      {/* 드릴인한 공장의 떠 있는 이름패. key 가 공장이라, 갈아타면 떠오름이 다시 연주된다 */}
      {hudFactory && (
        <FactoryHudLabel
          key={hudFactory.factory.name}
          ref={hudRef}
          name={hudFactory.factory.name}
          anchor={hudFactory.factory.labelAnchor}
          outline={hudFactory.outline}
          color={accentOfName(hudFactory.factory.name)}
          caption={
            focusedBays.length > 0 && labels.bayCount
              ? labels.bayCount(focusedBays.length)
              : undefined
          }
          initialCamera={cameraRef.current}
        />
      )}

      {/* ── 카메라를 따라가는 층(마커 + 공장 이름 라벨) — 뷰는 handle 로만 들어온다.
           **마커가 아니라 공장이 있으면 선다.** 이름패가 이 층에 살기 때문에, 마커를
           예전처럼 조건에 걸면 마커 없는 공정(선행의장 — LiDAR 실좌표 미수령)은 공장
           이름까지 함께 사라진다. 마커는 층 안에서 renderMarker 가 있을 때만 그린다 ── */}
      {memberFactories.length > 0 && (
        <MapMarkerLayer
          ref={markerLayerRef}
          markers={markers ?? NO_MARKERS}
          selectedMarkerId={selectedMarkerId}
          onSelectMarker={onSelectMarker ?? (() => {})}
          renderMarker={renderMarker}
          selectedFactory={selectedFactory}
          inOverview={inOverview}
          hoveredFactory={hoveredFactory}
          memberFactories={memberFactories}
          accentByName={accentByName}
          viewport={viewport}
        />
      )}

      {/* ── 좌하단: 대시보드와 같은 스택 — 전체 보기 · 범례(슬롯) · 미니맵 ── */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={returnToOverview}
          className="pointer-events-auto flex h-9 items-center gap-2 rounded-inshop-lg border border-white/12 bg-[#0b0e12]/90 px-3 text-inshop-xs font-medium text-white/75 shadow-lg backdrop-blur-md transition-colors hover:bg-[#151b23] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title={labels.viewAllHint}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
            <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {labels.viewAll}
        </button>

        {/* 범례 — 잡아 옮길 수 있어야 하므로 포인터를 받는다(예전엔 통과시켰다) */}
        {legend != null && (
          <DraggableCard
            cardKey="legend"
            className="pointer-events-auto flex flex-col gap-1 rounded-inshop-md bg-surface/85 px-2.5 py-2 text-2xs text-foreground/75 backdrop-blur-sm"
          >
            {legend}
          </DraggableCard>
        )}

        {/* 야드 전체 미니맵 — 대시보드와 같은 전술 지도. 클릭하면 그 자리로 이동한다.
            판(캔버스)은 클릭이 제 일이라 손잡이가 아니다 — 머리글 줄을 잡아 옮긴다 */}
        <DraggableCard cardKey="minimap" className="pointer-events-auto">
          <DashboardMiniMap
            ref={miniMapRef}
            extent={yardExtent ?? entryExtent}
            parcels={parcels}
            onNavigate={(point) => setNavigationTarget({ ...point })}
          />
        </DraggableCard>
      </div>

      {/* ── 좌상단: 지금 고른 한 가지 — 공정 상세(detailOverlay) 또는 지도에서 누른
           **베이**의 지번 구성. 두 카드를 나란히 세우면 지도를 반쯤 덮고 어느 쪽이 지금
           이야기인지도 흐려지므로 한 자리를 번갈아 쓴다(대시보드와 같다). 공정 상세는
           베이보다 안쪽 단계라 위에 덮이고, 닫으면 베이로 되돌아온다 ── */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-h-[max(45%,calc(100%-23rem))] w-[min(94vw,360px)] flex-col items-start gap-2">
        {/* 자취는 **고정**이다 — 지금 어디인지 말하는 줄이 카드와 함께 떠다니면
            "여기가 어디인가"를 매번 다시 찾아야 한다 */}
        {breadcrumbSteps.length > 0 && (
          <DrilldownBreadcrumb
            steps={breadcrumbSteps}
            label={labels.breadcrumbLabel ?? labels.breadcrumbYard ?? ''}
            className="pointer-events-auto shrink-0"
          />
        )}

      {(detailOverlay != null || selectedBayData) && (
        <DraggableCard
          key={detailOverlay != null ? 'detail' : 'bay'}
          cardKey="detail"
          className="pointer-events-auto flex min-h-0 w-full flex-1 flex-col"
        >
          {detailOverlay != null
            ? detailOverlay
            : selectedBayData && (
                /* 이 화면에 "작업 위치" 단계가 없는 소비자를 위해 linkedLocation 은 주지
                   않는다(없는 문을 없다고 말하지 않는다). 베이 본문은 공정 몫(bayBody) */
                <BayDetailCard
                  bay={selectedBayData}
                  highlightedLot={spottedLot}
                  onSelectLot={setSpottedLot}
                  onHoverLot={setHoveredLotRow}
                  onBack={() => drill.go({ bay: null })}
                  onClose={returnToOverview}
                >
                  {bayBody?.({ bay: selectedBayData, factory: selectedBayData.factory })}
                </BayDetailCard>
              )}
        </DraggableCard>
      )}
      </div>

      {/* ── 우측 패널: 공장 접이식 카드 (대시보드 공정존 패널과 같은 문법).
           패널 전체가 화면보다 길어지면 제목은 남고 카드 목록만 스크롤한다 ── */}
      <DraggableCard
        cardKey="factory-panel"
        className="pointer-events-none absolute inset-y-3 right-3 z-10 flex w-[min(94vw,384px)] flex-col"
      >
        <section className="pointer-events-auto flex max-h-full min-h-0 flex-col overflow-hidden rounded-inshop-lg border border-white/12 bg-black/75 p-2.5 backdrop-blur-md">
          {/* 제목 줄이 이 패널의 손잡이 — 안쪽 목록은 스크롤이 제 일이라 잡히지 않는다 */}
          <div data-drag-handle className="mb-2 flex shrink-0 items-center px-0.5">
            <h2 className="text-inshop-xs font-semibold tracking-[-0.01em] text-white/55">
              {labels.panelTitle}
            </h2>
          </div>
          {panelHeaderExtra != null && <div className="mb-2 shrink-0">{panelHeaderExtra}</div>}
          <div className="scroll-thin flex min-h-0 flex-col gap-2 overflow-y-auto">
            {orderedFactories.map((factory) => {
              /* 전체 보기에서는 활성 표시도 걷는다 — 닫힌 처음 상태로 읽히게 */
              const active = !inOverview && factory === selectedFactory
              const expanded = factory === expandedFactory
              const accent = accentOfName(factory)
              const body = expanded ? factoryBody?.(factory) : null
              return (
                <div
                  key={factory}
                  onMouseEnter={() => setHoveredFactory(factory)}
                  onMouseLeave={() => setHoveredFactory(null)}
                  className={cn(
                    /* shrink-0 — 스크롤 컨테이너 안에서 카드가 눌려 찌그러지지 않게 */
                    'shrink-0 overflow-hidden rounded-inshop-lg border transition-colors',
                    active ? 'border-white/45 bg-white/[0.07]' : 'border-white/10 bg-white/[0.025]'
                  )}
                  style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
                >
                  {/* 요약 줄 — 펴기버튼(별도) + 카메라 이동 버튼(본체). 대시보드 카드와 동일 */}
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setExpandedFactory(expanded ? null : factory)}
                      aria-expanded={expanded}
                      aria-label={expanded ? labels.collapse : labels.expand}
                      className="flex shrink-0 items-center px-1.5 text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                    >
                      <ChevronDownIcon
                        size={14}
                        className={cn('transition-transform', !expanded && '-rotate-90')}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectFactory(factory)}
                      aria-pressed={active}
                      title={labels.viewOnMap}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pr-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                    >
                      <span
                        className="h-3.5 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <span className="truncate text-inshop-sm font-bold tracking-[-0.02em] text-white/95">
                        {factory}
                      </span>
                      {/* 요약(집계·상태점)은 공정 몫 — 없으면 이름만 남는다 */}
                      {factorySummary?.(factory)}
                    </button>
                  </div>

                  {/* 펴짐 — 그 공장의 본문(공정 몫) */}
                  {body != null && <div className="border-t border-white/10">{body}</div>}
                </div>
              )
            })}
          </div>
        </section>
      </DraggableCard>
    </div>
  )
}

/* 제네릭을 살린 forwardRef — 마커 타입 M 이 renderMarker 시그니처까지 흐르게 한다 */
export const ProcessMapEntry = forwardRef(ProcessMapEntryInner) as <M extends MapEntryMarker>(
  props: ProcessMapEntryProps<M> & { ref?: ForwardedRef<ProcessMapEntryHandle> }
) => ReactElement
