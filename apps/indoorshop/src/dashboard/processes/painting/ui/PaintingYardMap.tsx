import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import {
  RELIEF_METERS,
  YardMap,
  boundsOf,
  worldToScreen,
  type BasemapLayer,
  type LatLon,
  type LatLonBounds,
  type MapTheme,
  type YardLayers,
  type YardParcelBaySpan,
  type YardParcelLayer,
  type YardParcelLotGroup,
  type YardView,
  type Viewport,
} from '../../../shared/features/yard-map'
import {
  boundsOfLots,
  colorOfProcess,
  type YardParcels,
} from '../../../shared/entities/yard-parcels'
import { restyleDarkBasemap } from '../../../shared/widgets/dashboard-map/darkMapRestyle'
import {
  bayCameraBounds,
  factoryCameraBoundsOf,
  overviewCameraBounds,
  OVERVIEW_BOUNDS_PADDING,
} from '../../../shared/widgets/dashboard-map/overviewCamera'
import {
  DashboardMiniMap,
  type DashboardMiniMapHandle,
} from '../../../shared/widgets/dashboard-map/DashboardMiniMap'
import { summarizeBay } from '../../../shared/widgets/dashboard-map/bayDetail'
import { BayDetailCard } from '../../../shared/widgets/dashboard-map/BayDetailCard'
import { spotlitLot } from '../../../shared/widgets/dashboard-map/lotSpot'
import {
  FactoryHudLabel,
  type FactoryHudCamera,
  type FactoryHudLabelHandle,
} from '../../../shared/widgets/dashboard-map/FactoryHudLabel'
import { ChevronDownIcon } from '../../../shared/ui/icons'
import { cn } from '../../../shared/lib/utils'
import type { PaintingEquipment } from '../model/equipment'
import { type PaintingEquipmentStatus } from '../model/equipmentStatus'
import { ScadaModuleDetail, ScadaRackBody } from './scada'
import {
  DEHUMIDIFIER,
  DEHUMIDIFIER_DEEP,
  EquipmentChip,
  EquipmentGlyph,
  GAS_HEATER,
  GAS_HEATER_DEEP,
} from './equipmentIcon'

/*
 * 도장 공정 배치 맵 (화면 주 영역) — 대시보드 전체 현황과 같은 "실제 지도" 룩.
 *
 * 대시보드와 같은 문법으로 그린다: 밝힌 다크 베이스맵(darkMapRestyle 공유) 위에 공장을
 * **3D 모형**(viewMode 3d)으로 세우고, 좌하단에 미니맵을 둔다. **도장 공장만** `parcels`
 * 의 **process 모드**로 그린다: 도장 5공장은 공정색(#e87ba4) 네온으로 피워 올리고(주인공),
 * 타 공정 지번은 소속을 지워 무색 실루엣으로만 남긴다 — 색도 없고 클릭도 안 된다.
 * 고른 도장 공장은 가장 강한 글로우. 그 위에 설비를 상태색 DOM 마커로 얹고 — 3D 에서는
 * 지붕 높이로 띄운다 — 공장을 골라 드릴인해야 그 공장의 설비(제습기·가스히터)를 고를 수
 * 있고, 설비를 고르면 상세가 **좌상단** 오버레이로 뜬다.
 *
 * 공장은 발자국 한 덩어리가 아니라 **베이마다 한 채**(`factoryBays`)로 선다 — 전체 현황
 * 지도와 같은 구성이다: 박공 지붕이 베이 경계에서 갈리고, 공장을 고르면 그 베이들이
 * 눌리는 칸이 되며(`lotGroups`), 고른 공장의 이름은 지붕에서 일어나 **떠 있는 이름패**
 * (FactoryHudLabel)로 뜬다. 베이를 누르면 그 칸의 지번 구성이 좌상단 카드에 펼쳐진다 —
 * 설비 상세와 **같은 자리**를 쓰고, 설비를 고르면 그 위로 덮였다가 되돌아온다(공장 →
 * 베이 → 설비 한 갈래). 베이 매핑(엑셀)은 야드 지번 데이터가 이미 들고 있으므로 이
 * 화면이 새로 만드는 자료는 없다.
 *
 * 다크 베이스맵을 강제한다 — 어두운 바탕이라야 네온이 산다(대시보드와 같은 규칙).
 */

/** 지번/설비만 보이게 — 야드 fixture 레이어는 전부 끈다 */
const PAINTING_LAYERS: YardLayers = {
  basemap: true,
  facilities: false,
  lots: false,
  blocks: false,
  moves: false,
  plans: false,
  shops: false,
}

const PAINTING_PROCESS = '도장'
/** 도장 공정색 — 카드의 색 막대·상태점이 지도 네온과 같은 언어를 쓴다 */
const PAINTING_COLOR = colorOfProcess(PAINTING_PROCESS)

const DIM = '#000'

/**
 * 베이를 골랐을 때 화면에 담을 **공장 범위의 최소 비율** — 확대 배율의 상한이다.
 * 대시보드와 같은 값을 쓴다: 베이 크기가 지번 한 장에서 여러 장까지 제각각이라 여백만으로
 * 맞추면 누를 때마다 다른 거리에 착지한다 (`bayCameraBounds` 가 그 사정을 적고 있다).
 */
const BAY_CAMERA_MIN_RATIO = 0.55

/*
 * 3D 에서 무엇을 얼마나 띄우나 — 공장이 **박공 지붕**으로 서고 나서의 잣대다.
 * 평지붕 시절의 `RELIEF_METERS.parcel` 에 맞추면 마커도 이름패도 용마루 아래로 파묻힌다.
 */
/** 설비 마커가 얹히는 높이 — 베이 지붕 언저리 */
const MARKER_METERS = RELIEF_METERS.parcel * 1.4
/** 공장 이름이 뜨는 높이 — 지붕 위. 떠 있는 이름패(FactoryHudLabel)와 같은 높이다 */
const NAME_METERS = RELIEF_METERS.parcel * 2.2

interface PaintingYardMapProps {
  parcels: YardParcels
  factories: string[]
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  equipment: readonly PaintingEquipment[]
  statusById: Map<string, PaintingEquipmentStatus>
  selectedId: string | null
  onSelectEquipment: (id: string | null) => void
  now: number
  polledAt: number | null
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  /** 야드 전체 범위 — 미니맵의 프레임. 없으면 도장 지번 범위로 대신한다 */
  yardExtent?: LatLonBounds | null
  /** true 면 처음을 도장 전체 보기로 연다 (딥링크 `?shop=` 진입은 false 로 그 공장을 연다) */
  initialOverview?: boolean
  className?: string
}

/* ── 카메라를 따라가는 DOM 층 (설비 마커 + 공장 이름 라벨) ──
 *
 * 카메라는 비행·드래그 중 **매 프레임** 바뀐다. 뷰를 PaintingYardMap 의 state 로 들면
 * 프레임마다 우측 공장 패널·SCADA 상세까지 통째로 리렌더돼 애니메이션이 뚝뚝 끊긴다.
 * 그래서 뷰는 이 층만 아는 상태로 내리고, 지도는 imperative handle 로 밀어 넣는다 —
 * 미니맵(DashboardMiniMap)과 같은 결이다. 프레임마다 다시 그리는 것은 이 층뿐이다.
 */
interface PaintingCameraLayerHandle {
  update: (view: YardView) => void
}

interface PaintingCameraLayerProps {
  equipment: readonly PaintingEquipment[]
  statusById: Map<string, PaintingEquipmentStatus>
  selectedId: string | null
  onSelectEquipment: (id: string | null) => void
  selectedFactory: string
  inOverview: boolean
  hoveredFactory: string | null
  paintingFactories: YardParcels['factories']
  viewport: Viewport
}

const PaintingCameraLayer = forwardRef<PaintingCameraLayerHandle, PaintingCameraLayerProps>(
  function PaintingCameraLayer(
    {
      equipment,
      statusById,
      selectedId,
      onSelectEquipment,
      selectedFactory,
      inOverview,
      hoveredFactory,
      paintingFactories,
      viewport,
    },
    ref
  ) {
    /*
     * 카메라는 **state 로 들지 않는다.** 마커가 87개라 프레임마다 다시 그리면 React 가
     * 87개 엘리먼트를 새로 만들고(dev 에서 특히 비싸다), 무엇보다 `left/top` 을 고쳐
     * 브라우저가 87번 레이아웃을 다시 잰다 — 카메라가 도는 동안 프레임이 눈에 띄게 밀린다.
     *
     * 그래서 카메라는 ref 로 받고, 자리는 **DOM 노드의 transform 에 직접** 쓴다. React 가
     * 다시 그리는 것은 자료(설비·상태·선택)가 바뀔 때뿐이고, 매 프레임 하는 일은 87번의
     * transform 쓰기다(레이아웃 없이 합성만 다시 한다).
     */
    const viewRef = useRef<YardView | null>(null)
    const markerNodes = useRef(new Map<string, HTMLElement>())
    const labelNodes = useRef(new Map<string, HTMLElement>())

    const place = useCallback(() => {
      const view = viewRef.current
      if (!view || viewport.width === 0) return
      /*
       * 3D(기울인) 카메라에서 마커를 얹는 높이 — 드릴인하면 지붕 높이(설비를 고르는 화면).
       * **전체 보기에서는 지면(0)에 깐다**: 설비가 공장 발자국 밑단으로 가라앉아 배경이 되고,
       * 지붕 위 공장 이름이 주인공으로 남는다.
       */
      const markerAltitude = view.pitch > 0 && !inOverview ? MARKER_METERS : 0
      for (const item of equipment) {
        const node = markerNodes.current.get(item.id)
        if (!node) continue
        const { sx, sy } = worldToScreen(view, viewport, item.lat, item.lon, markerAltitude)
        const off = sx < -20 || sy < -20 || sx > viewport.width + 20 || sy > viewport.height + 20
        node.style.visibility = off ? 'hidden' : 'visible'
        if (!off) node.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`
      }
      /* 공장 이름 라벨은 캔버스 라벨과 같은 앵커·높이(지붕 위)를 쓴다 */
      const labelAltitude = view.pitch > 0 ? NAME_METERS : 0
      for (const factory of paintingFactories) {
        const node = labelNodes.current.get(factory.name)
        if (!node) continue
        const { sx, sy } = worldToScreen(
          view,
          viewport,
          factory.labelAnchor.lat,
          factory.labelAnchor.lon,
          labelAltitude
        )
        const off = sx < -80 || sy < -20 || sx > viewport.width + 80 || sy > viewport.height + 20
        node.style.visibility = off ? 'hidden' : 'visible'
        if (!off) node.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`
      }
    }, [equipment, paintingFactories, viewport, inOverview])

    useImperativeHandle(
      ref,
      () => ({
        update: (next: YardView) => {
          viewRef.current = next
          place()
        },
      }),
      [place]
    )

    /* 자료·뷰포트가 바뀌어 다시 그린 뒤에는 새 노드가 제자리를 모른다 — 그릴 때마다 한 번 */
    useLayoutEffect(place)

    return (
      <>
        {/* 설비 마커 — 캔버스 위 DOM 층. 지도 조작은 아래 캔버스가 받도록 층 자체는 클릭 투과.
            설비는 **공장을 골라 드릴인한 뒤에만** 누를 수 있다 — 전체 보기·타 공장 마커는
            클릭 투과라, 그 자리를 누르면 지도가 받아 그 공장 선택(또는 전체 보기 복귀)이 된다 */}
        <div className="pointer-events-none absolute inset-0">
          {equipment.map((item) => {
            const status = statusById.get(item.id)
            const isHeater = item.kind === '가스히터'
            const color = isHeater ? GAS_HEATER : DEHUMIDIFIER
            const deep = isHeater ? GAS_HEATER_DEEP : DEHUMIDIFIER_DEEP
            const selected = item.id === selectedId
            const online = !status || status.modbusLink === 'OK'
            const operating = status?.operatingMode ?? false
            const fault = (status?.faultCode ?? 0) !== 0
            const selectable = !inOverview && item.factory === selectedFactory
            const dim = !inOverview && !selectable
            return (
              <button
                key={item.id}
                ref={(node) => {
                  if (node) markerNodes.current.set(item.id, node)
                  else markerNodes.current.delete(item.id)
                }}
                type="button"
                onClick={() => onSelectEquipment(item.id)}
                tabIndex={selectable ? 0 : -1}
                title={`${item.id} · ${item.kind}`}
                aria-label={`${item.id} ${item.kind}`}
                className={cn(
                  'absolute left-0 top-0 flex h-7 w-7 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  selectable ? 'pointer-events-auto' : 'pointer-events-none',
                  /* 전체 보기 — 설비는 지면에 깔린 배경: 작고 흐리게 물러난다 */
                  inOverview ? 'opacity-60' : dim && 'opacity-45',
                  selected && 'z-10'
                )}
                /* 자리는 place() 가 transform 으로 넣는다 — 첫 프레임 전에는 숨겨 둔다 */
                style={{ visibility: 'hidden', willChange: 'transform' }}
              >
                <span
                  className={cn(
                    'flex items-center justify-center rounded-inshop-md border transition-transform duration-150',
                    inOverview ? 'h-[12px] w-[12px]' : 'h-[18px] w-[18px]',
                    selected ? 'scale-125' : !inOverview && 'hover:scale-110',
                    fault && online && 'animate-pulse'
                  )}
                  style={{
                    background: operating
                      ? `linear-gradient(180deg, ${color} 0%, ${deep} 100%)`
                      : 'rgba(9,14,20,0.85)',
                    borderColor: operating ? 'rgba(255,255,255,0.4)' : color,
                    color: operating ? '#fff' : color,
                    opacity: online ? 1 : 0.35,
                    boxShadow: [
                      operating ? `0 0 10px ${color}b3` : '0 1px 3px rgba(0,0,0,0.5)',
                      fault ? '0 0 0 2px #ff5252' : selected ? `0 0 0 3px ${color}59` : null,
                    ]
                      .filter(Boolean)
                      .join(', '),
                  }}
                >
                  <EquipmentGlyph heater={isHeater} size={inOverview ? 8 : 11} />
                </span>
              </button>
            )
          })}
        </div>

        {/* ── 공장 이름 라벨 — 마커 **위** 층: 이름이 항상 제일 위에 남는다. 클릭은 투과해
             그 자리의 공장 폴리곤(캔버스)이 받는다. **드릴인한 공장은 라벨을 지운다** —
             그 이름은 이미 우측 카드·상세 헤더가 크게 말하고 있고, 지붕 위 라벨은 설비
             마커만 가린다 ── */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {paintingFactories.map(({ name }) => {
            if (!inOverview && name === selectedFactory) return null
            const hovered = name === hoveredFactory
            return (
              <span
                key={name}
                ref={(node) => {
                  if (node) labelNodes.current.set(name, node)
                  else labelNodes.current.delete(name)
                }}
                className={cn(
                  'absolute left-0 top-0 whitespace-nowrap rounded-inshop-md border px-2 py-0.5 text-[11px] font-bold tracking-[-0.01em] backdrop-blur-[2px] transition-opacity',
                  hovered || inOverview ? 'opacity-100' : 'opacity-60'
                )}
                style={{
                  visibility: 'hidden',
                  willChange: 'transform',
                  color: '#fff',
                  background: 'rgba(7,11,16,0.78)',
                  borderColor: hovered ? PAINTING_COLOR : 'rgba(255,255,255,0.18)',
                  boxShadow: hovered
                    ? `0 0 10px ${PAINTING_COLOR}80, 0 2px 6px rgba(0,0,0,0.5)`
                    : '0 2px 6px rgba(0,0,0,0.5)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {name}
              </span>
            )
          })}
        </div>
      </>
    )
  }
)

export function PaintingYardMap({
  parcels,
  factories,
  selectedFactory,
  onSelectFactory,
  equipment,
  statusById,
  selectedId,
  onSelectEquipment,
  now,
  polledAt,
  basemapLayers,
  yardExtent,
  initialOverview = false,
  className,
}: PaintingYardMapProps) {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const miniMapRef = useRef<DashboardMiniMapHandle>(null)
  /* 카메라(매 프레임)는 state 가 아니라 이 층의 handle 로만 흐른다 — 위 주석 참조 */
  const cameraLayerRef = useRef<PaintingCameraLayerHandle>(null)
  const hudRef = useRef<FactoryHudLabelHandle>(null)
  /* 마지막으로 받은 카메라 — 이름패가 붙는 **첫 프레임**에 쓸 값(대시보드와 같은 이유) */
  const cameraRef = useRef<FactoryHudCamera | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 })
  const [hoveredFactory, setHoveredFactory] = useState<string | null>(null)
  /* 고른/얹힌 베이 — 드릴인한 공장 안에서만 뜻이 있다 (id 는 `{공장}#{베이}`) */
  const [selectedBay, setSelectedBay] = useState<string | null>(null)
  const [hoveredBay, setHoveredBay] = useState<string | null>(null)
  /*
   * 베이 카드의 지번 줄이 짚은 **지번 낱장** — 대시보드와 같은 장치다. 누른 것과 손이
   * 얹힌 것을 따로 들어, 훑는 동안은 미리보기가 이기고 손을 떼면 눌러 둔 자리로 돌아온다.
   */
  const [spottedLot, setSpottedLot] = useState<string | null>(null)
  const [hoveredLotRow, setHoveredLotRow] = useState<string | null>(null)
  /* 짚기는 그 베이 카드의 것 — 베이가 바뀌거나 카드가 닫히면 함께 사라진다 */
  useEffect(() => {
    setSpottedLot(null)
    setHoveredLotRow(null)
  }, [selectedBay])
  /* 대시보드와 같은 탐색 장치 — 미니맵 클릭 이동과 "도장 전체 보기" */
  const [navigationTarget, setNavigationTarget] = useState<LatLon | null>(null)

  /* 대시보드 전체 현황과 같은 "실제 지도" 배색 — 한 야드가 두 화면에서 같게 읽힌다 */
  const restyledBasemap = useMemo(() => restyleDarkBasemap(basemapLayers), [basemapLayers])

  /*
   * 이 화면의 주인공은 도장뿐 — 타 공정 지번은 **소속(공장)을 지워** 무소속 실루엣으로
   * 강등한다. 무소속 지번은 레이어가 옅은 회색 배경으로만 깔고 히트테스트에서도 빠지므로,
   * 색도 없고 클릭도 안 된다(그 자리를 누르면 빈 야드 클릭 = 전체 보기 복귀). 공장 목록도
   * 도장만 남겨 타 공정 공장의 이름줄·3D 동이 서지 않게 한다.
   *
   * 분홍으로 남길 지번의 판정은 **대시보드 전체 현황과 같은 잣대** — 지번 자신의 공정이
   * 아니라 소속 공장의 공정이다. 두 화면의 분홍 영역(도장 공장 발자국)이 정확히 같아진다.
   */
  const paintingFactories = useMemo(
    () => parcels.factories.filter((f) => f.process === PAINTING_PROCESS),
    [parcels]
  )
  const paintingLots = useMemo(() => {
    const names = new Set(paintingFactories.map((f) => f.name))
    return parcels.lots.map((lot) =>
      lot.factory != null && names.has(lot.factory)
        ? lot
        : { ...lot, factory: null, process: '' }
    )
  }, [parcels, paintingFactories])

  // 도장 지번 전체를 감싸는 범위 — 공장 bounds 가 없을 때의 안전한 홈
  const paintingExtent = useMemo<LatLonBounds>(() => {
    const pts = parcels.lots.filter((l) => l.process === PAINTING_PROCESS).flatMap((l) => l.polygon)
    return pts.length > 0
      ? boundsOf(pts)
      : { minLat: 34.86, minLon: 128.69, maxLat: 34.88, maxLon: 128.72 }
  }, [parcels])

  /*
   * 전체 보기 카메라 범위 — **대시보드 전체 현황의 대문과 같은 자리**(공장 밀집 구역 +
   * 같은 오프셋). 두 화면을 오가도 지도가 같은 곳에서 시작해 한 야드로 읽힌다.
   */
  const overviewBounds = useMemo<LatLonBounds>(
    () => overviewCameraBounds(parcels) ?? paintingExtent,
    [parcels, paintingExtent]
  )

  /*
   * 전체 보기 요청 — 버튼을 누를 때마다 대문 범위의 **새 객체**를 넣어, 이미 전체
   * 보기인 채로 드래그해 나갔더라도 다시 누르면 카메라가 다시 맞춰지게 한다. 공장을
   * 고르면 `null` 로 접혀 고른 공장으로 돌아간다. 초기 상태도 전체 보기다(대시보드처럼
   * 야드 전경이 대문) — 딥링크 진입만 예외로 그 공장에서 시작한다.
   */
  const [overviewRequest, setOverviewRequest] = useState<LatLonBounds | null>(() =>
    initialOverview ? overviewBounds : null
  )
  /* 우측 패널에서 펴져 있는 공장 카드 — 대시보드 공정존 카드처럼 한 번에 하나만 편다 */
  const [expandedFactory, setExpandedFactory] = useState<string | null>(() =>
    initialOverview ? null : selectedFactory
  )

  /*
   * 고른 공장의 카메라 범위 — 카메라를 이 공장으로 날린다(focusBounds). 초기 마운트 fit 도
   * 이 값이다.
   *
   * 지번 범위를 그대로 쓰지 않고 **군집 대비로 한 번 조인다**(`factoryCameraBoundsOf`) —
   * 그래야 긴 1DOCK 도장공장과 한 채짜리 GPS 가 비슷한 거리에 착지한다. 대시보드 전체
   * 현황이 공장 카드를 누를 때 쓰는 것과 같은 잣대다. 조이면 긴 공장은 양 끝이 화면 밖으로
   * 나가지만(드래그로 따라간다), 눌렀을 때 실제로 다가서는 쪽이 낫다.
   */
  const factoryExtent = useMemo(
    () => factoryCameraBoundsOf(parcels, selectedFactory) ?? paintingExtent,
    [parcels, selectedFactory, paintingExtent]
  )

  /*
   * 고른 베이의 카메라 범위 — 대시보드와 같은 잣대다: 베이에 딱 맞추지 않고 공장 범위의
   * 일정 비율을 함께 담아, 어느 베이를 눌러도 비슷한 거리에 착지하며 이웃 칸이 남는다.
   */
  const bayExtent = useMemo<LatLonBounds | null>(() => {
    if (!selectedBay) return null
    const bay = parcels.bays.find((b) => b.id === selectedBay)
    if (!bay) return null
    const around = boundsOfLots(parcels, bay.lotCodes)
    return around ? bayCameraBounds(around, factoryExtent, BAY_CAMERA_MIN_RATIO) : null
  }, [parcels, selectedBay, factoryExtent])

  /* 카메라 목표 — 전체 보기 > 고른 베이 > 고른 공장 순으로 좁혀 들어간다 */
  const cameraBounds = overviewRequest ?? bayExtent ?? factoryExtent

  /* 공장 선택(지도·카드 공통) — 전체 보기를 접고 그 공장으로 날아가며, 그 카드를 편다.
   * 공장을 갈아타면 앞 공장에서 보던 베이는 남지 않는다(그 칸은 여기 없다). */
  const selectFactory = useCallback(
    (name: string) => {
      setOverviewRequest(null)
      setExpandedFactory(name)
      setSelectedBay(null)
      setHoveredBay(null)
      onSelectFactory(name)
    },
    [onSelectFactory]
  )

  /*
   * 지도의 베이 클릭 — **고르기까지**다. 같은 칸을 다시 누르면 접힌다(대시보드와 같은 토글).
   * 좌상단 자리는 하나뿐이라 설비 상세는 접어 둔다 — 베이를 보겠다는 뜻이므로.
   */
  const selectBay = useCallback(
    (id: string) => {
      setSelectedBay((prev) => (prev === id ? null : id))
      onSelectEquipment(null)
    },
    [onSelectEquipment]
  )

  /* 원 위치 — 버튼과 지도의 빈 곳 클릭이 같은 동작을 쓴다: 대시보드와 같은 대문 자리로.
   * 전체 보기로 나가면 열려 있던 것(펴진 공장 카드·설비 상세)도 전부 닫아 처음 상태로 돌린다. */
  const returnToOverview = useCallback(() => {
    setNavigationTarget(null)
    setExpandedFactory(null)
    setSelectedBay(null)
    setHoveredBay(null)
    onSelectEquipment(null)
    setOverviewRequest({ ...overviewBounds })
  }, [overviewBounds, onSelectEquipment])

  /* 밖에서 온 공장 변경(마운트 후 딥링크 등)도 카메라·카드가 따라가게 하는 뒷받침 */
  const prevFactoryRef = useRef(selectedFactory)
  useEffect(() => {
    if (prevFactoryRef.current === selectedFactory) return
    prevFactoryRef.current = selectedFactory
    setOverviewRequest(null)
    setExpandedFactory(selectedFactory)
    setSelectedBay(null)
    setHoveredBay(null)
  }, [selectedFactory])

  /* 전체 보기 중인가 — 마커 상호작용·카드 활성 표시가 이 플래그로 갈린다 */
  const inOverview = overviewRequest != null

  /*
   * 도장 공장의 **베이 스팬** — 공장을 발자국 한 덩어리가 아니라 베이마다 한 채로 세우는
   * 근거다(전체 현황 지도와 같은 자료·같은 구성). 지붕에 눕혀 새길 칸 이름은 지어내지 않고
   * 원본(엑셀)의 `설명` 열을 그대로 쓴다 — 현장이 그 칸을 부르는 이름이라야 말이 맞는다.
   */
  const paintingBays = useMemo<YardParcelBaySpan[]>(() => {
    const names = new Set(paintingFactories.map((f) => f.name))
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
  }, [parcels, paintingFactories])

  /* 드릴인한 공장의 베이 — 이때만 지도의 칸이 되어 눌리고 지붕에 이름이 선다 */
  const focusedBays = useMemo(
    () => (inOverview ? [] : paintingBays.filter((bay) => bay.factory === selectedFactory)),
    [paintingBays, inOverview, selectedFactory]
  )
  const lotGroups = useMemo<YardParcelLotGroup[]>(
    () => focusedBays.map((bay) => ({ id: bay.id, label: bay.label, lotCodes: [...bay.lotCodes] })),
    [focusedBays]
  )

  // 도장 공장만 process 모드로: 도장 = 네온(+드릴인한 공장 강글로우), 타 공정 = 무색 실루엣
  const parcelLayer: YardParcelLayer = useMemo(
    () => ({
      lots: paintingLots,
      factories: paintingFactories,
      categoryColor: parcels.categoryColor,
      colorMode: 'process',
      processColor: colorOfProcess,
      focusedProcess: PAINTING_PROCESS,
      /* 전체 보기에서는 어느 공장도 고르지 않은 상태 — 다섯 공장이 같은 밝기로 선다 */
      focusedFactory: inOverview ? null : selectedFactory,
      hoveredFactory,
      /* 공장을 고르면 나머지 도장 공장은 절반쯤 눌린 네온 — 대시보드 FR-5 와 같은 문법 */
      relatedDimFactor: 0.5,
      /* 지번이 나뉜 형태를 연하게 남긴다(대시보드와 동일) — 야드가 구역으로 읽히게 */
      lotOutlineOpacity: 0.1,
      /* 공장을 이루는 스팬 — 베이마다 박공 지붕이 서고 공장 외곽선이 그것을 묶는다 */
      factoryBays: paintingBays,
      /* 드릴인한 공장 안의 칸 = 베이. 지번 낱장이 아니라 이 단위로 눌리고 이름이 선다 */
      lotGroups,
      selectedLot: selectedBay,
      hoveredLot: hoveredBay,
      /* 베이 카드가 짚은 지번 한 장 — 호버(미리보기)가 눌러 둔 것을 잠시 덮는다 */
      highlightedLot: spotlitLot(spottedLot, hoveredLotRow),
      /* 이름은 캔버스가 아니라 마커 **위** DOM 층이 그린다 — 캔버스에 그리면 마커에 가려진다 */
      showLabels: false,
      /* 공장 밖(빈 야드·타 공정) 클릭은 `null` 로 온다 — 원 위치(도장 전체 보기)로 나간다 */
      onSelectFactory: (name) => (name ? selectFactory(name) : returnToOverview()),
      onHoverFactory: setHoveredFactory,
      onSelectLot: selectBay,
      onHoverLot: setHoveredBay,
    }),
    [
      paintingLots,
      paintingFactories,
      parcels.categoryColor,
      inOverview,
      selectedFactory,
      hoveredFactory,
      selectFactory,
      returnToOverview,
      paintingBays,
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

  /* 공장별 설비 목록 — 카드가 펴질 때 그 공장의 SCADA 랙 본문에 들어간다 */
  const equipmentByFactory = useMemo(() => {
    const map = new Map<string, PaintingEquipment[]>()
    for (const item of equipment) {
      const list = map.get(item.factory)
      if (list) list.push(item)
      else map.set(item.factory, [item])
    }
    for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id))
    return map
  }, [equipment])

  // 공장별 상태 요약 — 카드의 접힌 한 줄(가동 수·이상 점)이 폴링으로 갱신된다
  const statsByFactory = useMemo(() => {
    const map = new Map<
      string,
      { operating: number; online: number; issues: number; total: number }
    >()
    for (const factory of factories) {
      map.set(factory, { operating: 0, online: 0, issues: 0, total: 0 })
    }
    for (const item of equipment) {
      const row = map.get(item.factory)
      if (!row) continue
      const s = statusById.get(item.id)
      row.total += 1
      if (s?.operatingMode) row.operating += 1
      if (!s || s.modbusLink === 'OK') row.online += 1
      if (s && (s.modbusLink !== 'OK' || s.faultCode !== 0)) row.issues += 1
    }
    return map
  }, [factories, equipment, statusById])

  const selectedEquipment = selectedId
    ? (equipment.find((e) => e.id === selectedId) ?? null)
    : null

  /* 고른 베이의 상세 — 소속 지번과 그 **원본 설명**. 매핑에 없는 베이면 null */
  const selectedBayData = useMemo(
    () => (selectedBay ? summarizeBay(parcels, selectedBay) : null),
    [parcels, selectedBay]
  )

  /*
   * 떠 있는 이름패가 설 자리 — 가로는 고른 공장의 지번 centroid, 세로는 그 공장 실루엣
   * 위다(실루엣을 재려면 소속 지번의 꼭짓점이 필요해 함께 모아 넘긴다).
   *
   * 베이까지 내려가면 이름패는 물러난다 — 그 단계의 주인공은 지붕에 새겨진 베이 이름이고,
   * 공장 이름은 베이 카드의 머리가 이어받는다(대시보드와 같은 규칙).
   */
  const hudFactory = useMemo(() => {
    if (inOverview || selectedBay) return null
    const factory = paintingFactories.find((f) => f.name === selectedFactory)
    if (!factory) return null
    const codes = new Set(factory.lotCodes)
    const outline = parcels.lots.flatMap((lot) =>
      codes.has(lot.lot) || lot.factory === factory.name ? lot.polygon : []
    )
    return { factory, outline }
  }, [parcels, paintingFactories, selectedFactory, inOverview, selectedBay])

  /* 드릴인한 공장의 이름(카드)이 목록 **제일 위**로 올라온다 — 펴진 내용이 접힘 없이
   * 바로 보인다. 전체 보기에서는 원래 순서 그대로다. */
  const orderedFactories = useMemo(() => {
    if (inOverview || !factories.includes(selectedFactory)) return factories
    return [selectedFactory, ...factories.filter((f) => f !== selectedFactory)]
  }, [factories, inOverview, selectedFactory])

  return (
    <div
      ref={boxRef}
      className={cn('relative overflow-hidden rounded-inshop-lg border border-border bg-[#0b0f14]', className)}
    >
      <YardMap
        lots={[]}
        blocks={[]}
        moves={[]}
        plans={[]}
        basemapLayers={restyledBasemap}
        /* 홈은 도장 전체 — "도장 전체 보기"가 여기로 나온다 */
        extent={paintingExtent}
        minScale={35_000}
        colorOfCategory={() => DIM}
        layers={PAINTING_LAYERS}
        parcels={parcelLayer}
        /* 처음은 대시보드 전체 현황과 **같은 대문**(같은 범위·같은 음수 패딩) —
         * 딥링크(?shop=) 진입만 그 공장을 바로 맞춘다. */
        initialBounds={initialOverview ? overviewBounds : factoryExtent}
        initialBoundsPadding={initialOverview ? OVERVIEW_BOUNDS_PADDING : 0.12}
        focusBounds={cameraBounds}
        focusBoundsDuration={420}
        focusBoundsPadding={overviewRequest ? OVERVIEW_BOUNDS_PADDING : 0.12}
        /* 전체 보기는 "원위치" — 회전해 둔 방위도 대문 방향(북쪽 0°)으로 함께 되돌린다 */
        focusBoundsBearing={overviewRequest ? 0 : null}
        navigationTarget={navigationTarget}
        showFacilityLabels={false}
        mapTheme="dark"
        /* 대시보드 전체 현황과 같은 3D 모형 룩 */
        viewMode="3d"
        lotOpacity={0.7}
        onViewChange={(nextView, nextViewport) => {
          /* 매 프레임 들어온다 — state 대신 handle 로 마커 층·미니맵·이름패만 갱신한다 */
          cameraRef.current = { view: nextView, viewport: nextViewport }
          cameraLayerRef.current?.update(nextView)
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
          color={PAINTING_COLOR}
          caption={
            focusedBays.length > 0
              ? t('dashboard.map.bayCount', { count: focusedBays.length })
              : undefined
          }
          initialCamera={cameraRef.current}
        />
      )}

      {/* 카메라를 따라가는 층(설비 마커·공장 라벨) — 뷰는 handle 로만 들어온다 */}
      <PaintingCameraLayer
        ref={cameraLayerRef}
        equipment={equipment}
        statusById={statusById}
        selectedId={selectedId}
        onSelectEquipment={onSelectEquipment}
        selectedFactory={selectedFactory}
        inOverview={inOverview}
        hoveredFactory={hoveredFactory}
        paintingFactories={paintingFactories}
        viewport={viewport}
      />

      {/* ── 좌하단: 대시보드와 같은 스택 — 도장 전체 보기 · 범례 · 미니맵 ── */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={returnToOverview}
          className="pointer-events-auto flex h-9 items-center gap-2 rounded-inshop-lg border border-white/12 bg-[#0b0e12]/90 px-3 text-inshop-xs font-medium text-white/75 shadow-lg backdrop-blur-md transition-colors hover:bg-[#151b23] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          title={t('painting.workspace.viewAllHint')}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
            <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t('painting.workspace.viewAll')}
        </button>

        <div className="pointer-events-none flex flex-col gap-1 rounded-inshop-md bg-surface/85 px-2.5 py-2 text-2xs text-foreground/75 backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <EquipmentChip kind="제습기" size={14} />
            {t('painting.workspace.legend.dehumidifier')}
          </span>
          <span className="flex items-center gap-1.5">
            <EquipmentChip kind="가스히터" size={14} />
            {t('painting.workspace.legend.gasHeater')}
          </span>
          <span className="mt-0.5 text-foreground/45">{t('painting.workspace.approxNote')}</span>
          <span className="text-foreground/45">{t('painting.workspace.hint3d')}</span>
          {polledAt && (
            <span className="text-foreground/45">
              {t('painting.workspace.polledAt', { time: new Date(polledAt).toLocaleTimeString() })}
            </span>
          )}
        </div>

        {/* 야드 전체 미니맵 — 대시보드와 같은 전술 지도. 클릭하면 그 자리로 이동한다 */}
        <DashboardMiniMap
          ref={miniMapRef}
          extent={yardExtent ?? paintingExtent}
          parcels={parcels}
          onNavigate={(point) => setNavigationTarget({ ...point })}
        />
      </div>

      {/* ── 좌상단: 지금 고른 한 가지 — 설비(제습기·가스히터)의 SCADA 모듈 상세, 또는
           지도에서 누른 **베이**의 지번 구성. 두 카드를 나란히 세우면 지도를 반쯤 덮고
           어느 쪽이 지금 이야기인지도 흐려지므로 한 자리를 번갈아 쓴다(대시보드와 같다).
           설비는 베이보다 안쪽 단계라 위에 덮이고, 닫으면(← 설비 목록) 베이로 되돌아온다.
           내용이 길면 카드 안에서 스스로 스크롤한다 ── */}
      {(selectedEquipment || selectedBayData) && (
        <div
          key={selectedEquipment ? 'equipment' : 'bay'}
          className="pointer-events-auto absolute left-3 top-3 z-20 flex max-h-[max(45%,calc(100%-23rem))] w-[min(94vw,360px)] flex-col"
        >
          {selectedEquipment ? (
            <ScadaModuleDetail
              equipment={selectedEquipment}
              status={statusById.get(selectedEquipment.id)}
              now={now}
              onBack={() => onSelectEquipment(null)}
            />
          ) : (
            selectedBayData && (
              /* 이 화면에는 "작업 위치" 단계가 없다 — `linkedLocation` 을 주지 않아
                 카드가 나가는 문 자리를 만들지 않는다(없는 문을 없다고 말하지 않는다) */
              <BayDetailCard
                bay={selectedBayData}
                highlightedLot={spottedLot}
                onSelectLot={setSpottedLot}
                onHoverLot={setHoveredLotRow}
                onBack={() => setSelectedBay(null)}
                onClose={returnToOverview}
              />
            )
          )}
        </div>
      )}

      {/* ── 우측 패널: 도장 공장 접이식 카드 (대시보드 공정존 패널과 같은 문법).
           패널 전체가 화면보다 길어지면 제목은 남고 카드 목록만 스크롤한다 ── */}
      <div className="pointer-events-none absolute inset-y-3 right-3 z-10 flex w-[min(94vw,384px)] flex-col">
        <section className="pointer-events-auto flex max-h-full min-h-0 flex-col overflow-hidden rounded-inshop-lg border border-white/12 bg-black/75 p-2.5 backdrop-blur-md">
          <div className="mb-2 flex shrink-0 items-center px-0.5">
            <h2 className="text-inshop-xs font-semibold tracking-[-0.01em] text-white/55">
              {t('painting.workspace.factoriesTitle')}
            </h2>
          </div>
          <div className="scroll-thin flex min-h-0 flex-col gap-2 overflow-y-auto">
            {orderedFactories.map((factory) => {
              const stats = statsByFactory.get(factory) ?? {
                operating: 0,
                online: 0,
                issues: 0,
                total: 0,
              }
              /* 전체 보기에서는 활성 표시도 걷는다 — 닫힌 처음 상태로 읽히게 */
              const active = !inOverview && factory === selectedFactory
              const expanded = factory === expandedFactory
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
                  style={{ borderLeftColor: PAINTING_COLOR, borderLeftWidth: 3 }}
                >
                  {/* 요약 줄 — 펴기버튼(별도) + 카메라 이동 버튼(본체). 대시보드 카드와 동일 */}
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setExpandedFactory(expanded ? null : factory)}
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? t('painting.workspace.collapse')
                          : t('painting.workspace.expand')
                      }
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
                      title={t('painting.workspace.viewOnMap')}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 pr-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
                    >
                      <span
                        className="h-3.5 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: PAINTING_COLOR }}
                      />
                      <span className="truncate text-inshop-sm font-bold tracking-[-0.02em] text-white/95">
                        {factory}
                      </span>
                      <span
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          stats.issues > 0 ? 'bg-status-degraded' : 'bg-status-healthy'
                        )}
                        title={`${stats.issues} ${t('painting.workspace.summary.issues')}`}
                      />
                      <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-white/55">
                        {stats.operating}/{stats.total} {t('painting.workspace.summary.running')}
                      </span>
                    </button>
                  </div>

                  {/* 펴짐 — 그 공장의 SCADA 랙 본문(요약 지표 + 설비 모듈 그리드) */}
                  {expanded && (
                    <div className="border-t border-white/10">
                      <ScadaRackBody
                        equipment={equipmentByFactory.get(factory) ?? []}
                        statusById={statusById}
                        selectedId={selectedId}
                        polledAt={polledAt}
                        onSelect={onSelectEquipment}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
