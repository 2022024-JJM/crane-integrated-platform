import type { ReactNode } from 'react'
import type { BasemapLayer, LatLonBounds, MapTheme } from '../../yard-map'
import type {
  YardParcelFactory,
  YardParcelLot,
  YardParcels,
} from '../../../entities/yard-parcels'
import type { BaySummary } from '../../dashboard-map/lib/bayDetail'

/*
 * '맵 진입 공정 화면' 공통 프레임의 계약.
 *
 * 이 프레임은 **공정을 모른다** — 어느 공장이 주인공인지(`factoryNames`), 무슨 색인지
 * (`accentOf`), 마커가 무엇인지(`renderMarker`), 카드·범례에 무엇을 쓰는지(슬롯)가 전부
 * 밖에서 들어온다. 화면 문구도 마찬가지다: 프레임은 t() 를 부르지 않고 **번역이 끝난
 * 문자열**(`labels`)만 받는다 — shared 가 공정 로케일 키를 알게 되는 사고를 계약 수준에서
 * 차단한다. 각 공정의 문구는 각자의 `processes/{zone}/i18n/` 에 남는다.
 */

/** 마커 최소 계약 — 프레임은 자리(위도·경도)와 소속 공장만 안다. 생김새는 renderMarker 몫 */
export interface MapEntryMarker {
  id: string
  /** 소속 공장 — 드릴인한 공장의 마커만 누를 수 있게 하는 가드에 쓴다 */
  factory: string
  lat: number
  lon: number
  /** 버튼 title/aria-label — 프레임이 버튼을 만들므로 접근성 문구도 데이터로 받는다 */
  title?: string
  ariaLabel?: string
}

export interface MarkerRenderCtx {
  selected: boolean
  /** 드릴인한 공장 소속이라 누를 수 있는 상태 */
  selectable: boolean
  inOverview: boolean
}

/** 프레임이 쓰는 문구 — 전부 호출자가 번역해 넣는다 (shared 는 t() 를 모른다) */
export interface MapEntryLabels {
  /** 우측 패널 제목 */
  panelTitle: string
  /** "○○ 전체 보기" 버튼 */
  viewAll: string
  viewAllHint: string
  /** 공장 카드 펴기/접기 aria-label */
  expand: string
  collapse: string
  /** 공장 카드 본체(카메라 이동) title */
  viewOnMap: string
  /** 드릴인한 공장 이름패 캡션 — 베이 수. 없으면 캡션을 생략한다 */
  bayCount?: (n: number) => string
}

/** 베이 카드에 덧붙일 공정 몫의 본문을 만들 때 프레임이 건네는 문맥 */
export interface BayBodyCtx {
  bay: BaySummary
  factory: string
}

export interface ProcessMapEntryProps<M extends MapEntryMarker = MapEntryMarker> {
  /* ── 데이터 (공정 모듈 소유) ── */
  parcels: YardParcels
  /**
   * 이 화면의 주인공 공장 이름들 — 우측 패널의 순서이기도 하다. 이 밖의 지번은 소속을
   * 지운 무색 실루엣(클릭 불가)으로 강등된다. 서로 다른 공정의 공장을 섞어도 된다
   * (조립 화면의 CAS·PAS 편입) — 각 공장은 제 공정색으로 선다.
   */
  factoryNames: readonly string[]
  /** 공장별 강조색 — 기본은 그 공장 공정색(colorOfProcess). 카드 좌색 막대·이름패·호버 글로우 */
  accentOf?: (factory: YardParcelFactory) => string
  /**
   * 홈/전체 범위를 잴 지번의 판정 — 기본은 주인공 공장 소속 지번. 도장처럼 공장에 묶이지
   * 않은 제 공정 지번까지 홈 범위에 담아 온 화면은 기존 잣대를 그대로 주입한다(회귀 0).
   */
  extentLotFilter?: (lot: YardParcelLot) => boolean
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  /** 야드 전체 범위 — 미니맵의 프레임. 없으면 이 화면의 지번 범위로 대신한다 */
  yardExtent?: LatLonBounds | null

  /* ── 선택 상태 (부모 소유 — 딥링크와 결선) ── */
  selectedFactory: string
  onSelectFactory: (factory: string) => void
  /** true 면 처음을 전체 보기로 연다 (딥링크 `?shop=` 진입은 false 로 그 공장을 연다) */
  initialOverview?: boolean

  /* ── 마커 층 (선택 — 없으면 층 자체를 그리지 않는다) ── */
  markers?: readonly M[]
  selectedMarkerId?: string | null
  onSelectMarker?: (id: string | null) => void
  renderMarker?: (marker: M, ctx: MarkerRenderCtx) => ReactNode

  /* ── 오버레이 슬롯 ── */
  /** 좌상단 상세 — 차 있으면 베이 카드를 덮는다(공장 → 베이 → 상세 한 갈래) */
  detailOverlay?: ReactNode
  /** 우측 공장 카드 요약 줄의 우측 콘텐츠(집계·상태점) */
  factorySummary?: (factory: string) => ReactNode
  /** 우측 공장 카드의 펼침 본문 */
  factoryBody?: (factory: string) => ReactNode
  /** 우측 패널 제목 아래 자리 — 조립의 ①센서/②수집 2단 토글이 여기 꽂힌다 */
  panelHeaderExtra?: ReactNode
  /** 베이 카드의 지번 목록 아래에 덧붙는 본문 — 의장의 블록 목록 자리 */
  bayBody?: (ctx: BayBodyCtx) => ReactNode
  /** 좌하단 범례 박스 내용 — 없으면 박스를 만들지 않는다 */
  legend?: ReactNode
  labels: MapEntryLabels

  className?: string
}

export interface ProcessMapEntryHandle {
  returnToOverview(): void
}
