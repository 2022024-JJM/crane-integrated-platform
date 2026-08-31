import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { LatLon, LatLonBounds, YardBlock, YardLot, YardMove, YardPlan } from '../model/types'
import { boundsOf, mergeBounds, quadContains } from '../model/types'
import { factoryOutlineRings } from '../lib/factoryOutline'
import { cn } from '../../../lib/utils'
import { SEA_COLOR, type BasemapLayer, type MapTheme, type Ring } from '../lib/basemapStyle'
import {
  BAY_GABLE_SCALE,
  BAY_ROOF,
  BAY_ROOF_ALPHA,
  BAY_WALL_ALPHA,
  BUILDING_EXTRUDE,
  FACTORY_PODIUM,
  RELIEF_METERS,
} from '../lib/relief'
import {
  adjacentLotGroups,
  alignedAxes,
  bayRoofOf,
  centerOfPoints,
  orientedExtentOf,
  outlineOf,
  ridgeAxisOf,
  ringExtentAround,
  straightenBayFootprints,
  unmappedFactoryLots,
  type BayRoof,
} from '../lib/bayGable'
import {
  FLAT_ROOF_LIGHT,
  SHADOW_FILL,
  WALL_FOOT_DARKEN,
  isCounterClockwise,
  shadowOffset,
  slopeLightOf,
  wallLightOf,
} from '../lib/lighting'
import { convexHull, minAreaRect, polygonArea, ringSitsOn } from '../lib/footprint'
import { bayColor, moveColor, paletteOf } from '../lib/yardColors'
import type { YardShop, YardShopBay } from '../model/shop'
import { facilityContains, type YardFacility } from '../model/facility'
import { YardShopChips } from './YardShopChips'
import { YardFacilityLabels } from './YardFacilityLabels'
import {
  LON_SQUEEZE,
  MAX_PITCH,
  MIN_TILTED_PITCH,
  TILTED_PITCH,
  clampScale,
  containsPoint,
  easeInOutCubic,
  fitView,
  intersects,
  lerpView,
  panBy,
  project,
  screenToWorld,
  visibleBounds,
  worldToScreen,
  wrapBearing,
  zoomAt,
  type ScreenPoint,
  type Viewport,
  type YardView,
  type YardViewMode,
} from '../lib/projection'

export interface YardLayers {
  basemap: boolean
  /** 공장·샵 41곳 — 공정색으로 발광하는 이 화면의 기본 무대 */
  facilities: boolean
  lots: boolean
  blocks: boolean
  /** 이동 실적 (from → to 경로) */
  moves: boolean
  /** 배정 계획 (목적지 지번) */
  plans: boolean
  /** 감시 대상 조립공장 (정반 단위) */
  shops: boolean
}

/**
 * painting 지번 레이어의 지번 하나 — 색은 `category`(분류)가 정한다.
 * (yard-parcels 엔티티의 `YardParcelLot` 이 이 형태에 구조적으로 대입된다 — 여유 필드는 무시된다.)
 */
export interface YardParcelLayerLot {
  lot: string
  category: string
  polygon: LatLon[]
  /** 공정(조립/도장…) — `colorMode: 'process'` 에서 색·스포트라이트의 기준. 없으면 무공정 */
  process?: string
  /** 소속 공장 — `null` 이면 무소속. process 모드에서 무소속 지번은 옅은 배경으로만 깐다 */
  factory?: string | null
}

/**
 * 지번 여러 장을 **베이 한 덩어리**로 묶는 그룹.
 *
 * painting 지번은 정반(베이)보다 잘게 나뉘어 있어(한 베이가 지번 두세 장), 고른 공장
 * 안을 지번 낱장으로 보여 주면 현장이 부르는 이름("3BAY")과 화면의 단위가 어긋난다.
 * 그룹을 주면 그 공장의 상호작용 단위가 지번이 아니라 이 그룹이 된다 — 지붕 위 구획도
 * 그룹 외곽 **하나**로 그려지고 그 위에 이름이 얹히며, `selectedLot`/`hoveredLot`/
 * `onSelectLot`/`onHoverLot` 이 주고받는 값도 지번코드가 아니라 **그룹 id** 다.
 * 그룹에 안 든 지번은 지금까지처럼 낱장 그대로 동작한다.
 */
export interface YardParcelLotGroup {
  /** 그룹 id — 선택/호버 계약에서 지번코드 자리에 그대로 쓰인다 */
  id: string
  /** 지붕 위와 소비자 화면에 함께 쓰는 이름 (예: `3BAY`) */
  label: string
  /** 이 그룹으로 묶이는 지번코드 */
  lotCodes: readonly string[]
}

/**
 * 공장을 이루는 **베이 스팬** 하나.
 *
 * `YardParcelLotGroup`(위)과 모양이 비슷하지만 뜻이 다르다: 저것은 "고른 공장 안에서
 * 무엇을 누를 수 있나"(선택·호버 계약)이고, 이것은 **건물이 어떻게 생겼나**(구조)다.
 * 그래서 이쪽은 고르기 전부터 늘 있고, 소속 공장을 스스로 안다.
 *
 * 주면 그 공장은 발자국 하나(평지붕)가 아니라 **스팬마다 박공 지붕을 얹은 다중 스팬**으로
 * 서고, 공장 외곽선 한 줄이 그 스팬들을 묶는다. 안 주는 공장은 지금까지 그대로다.
 */
export interface YardParcelBaySpan {
  /** 소속 공장 (`YardParcelLayerFactory.name`) */
  factory: string
  /** 식별자 — `selectedLot`/`hoveredLot` 과는 무관하다 (그쪽은 lotGroups 의 id 다) */
  id: string
  /** 지붕 위에 얹는 이름 (예: `3BAY`) */
  label: string
  /**
   * 지번코드 → 그 칸의 지붕에 **눕혀 새길 이름**(원본 설명 등).
   *
   * **고른** 베이에만 그린다: 스팬마다 칸 이름이 서면 지붕이 글자로 덮여 건물이 안 보인다.
   * 고른 베이의 지붕은 그 베이가 무엇으로 이뤄졌는지를 말하는 자리가 된다.
   */
  lotLabels?: Readonly<Record<string, string>>
  /** 이 스팬이 차지하는 지번코드 */
  lotCodes: readonly string[]
}

/** painting 지번 레이어의 공장 하나 — 이름줄 자리와 소속 지번 */
export interface YardParcelLayerFactory {
  name: string
  labelAnchor: LatLon
  lotCodes: readonly string[]
  /** 3D 공장 발자국 표현. rectangle은 떨어진 지번도 하나의 정돈된 회전 사각형으로 묶는다. */
  footprintShape?: 'auto' | 'rectangle'
  /** 실제 동 배치를 따라 별도로 정돈한 3D 외곽. 지정하면 자동 hull보다 우선한다. */
  footprintPolygon?: readonly LatLon[]
  /** 공정 — process 모드에서 이름줄 글로우 색과 스포트라이트 판정에 쓴다 */
  process?: string
}

/**
 * painting 방식 공장 표현 레이어 — **선택적**. 주면 각 지번을 분류색으로 채우고 공장
 * 단위로 묶어 이름줄을 얹으며, `focusedFactory` 를 주면 그 공장 지번만 네온으로 띄우고
 * 나머지는 디밍한다. 안 주면 이 레이어는 아무것도 그리지 않는다(= 기존 야드 화면과 동일).
 *
 * 대시보드·도장 화면이 공장을 그리는 공용 수단이다. 카메라를 특정 공장으로 날리는 것은
 * 기존 `focusBounds` prop 을 그대로 쓴다(엔티티의 `factoryBounds()` 로 범위를 구해 넘긴다).
 */
export interface YardParcelLayer {
  lots: readonly YardParcelLayerLot[]
  factories: readonly YardParcelLayerFactory[]
  /** 분류 → 색 */
  categoryColor: (category: string) => string
  /**
   * 채움 색을 무엇으로 정하나. `'category'`(기본) = 지번 분류색(도장 화면·야드 룩).
   * `'process'` = **그 공장의 공정색 네온**(대시보드 샵 네비 룩) — `processColor` 를 함께 준다.
   */
  colorMode?: 'category' | 'process'
  /** 공정 → 색. `colorMode: 'process'` 일 때 쓴다 */
  processColor?: (process: string) => string
  /**
   * 스포트라이트할 공정 — 이 공정 공장들만 네온으로 밝히고 나머지는 강하게 디밍한다
   * (painting nav 모드). process 모드에서만 뜻이 있다. null 이면 전 공정이 네온.
   */
  focusedProcess?: string | null
  /** focus 대상 공장 이름 — 이 공장 지번만 밝게, 나머지는 디밍. null 이면 전부 평상 밝기 */
  focusedFactory?: string | null
  /** 손이 얹힌 공장 — 이름줄·지번이 함께 밝아진다 */
  hoveredFactory?: string | null
  /** 지번 채움 불투명도 (기본 0.55). process 모드는 painting 원본 수치를 쓰므로 무시한다 */
  opacity?: number
  /**
   * process 모드에서 **스포트라이트 밖(dim) 공장 지번의 채움 불투명도**. 안 주면(기본)
   * 대시보드 스포트라이트처럼 거의 검게(0.0025) 가라앉힌다. 값을 주면 그만큼 형상이
   * 보이게 남긴다(도장 화면: 타 공정 공장을 은은히 보이게 ~0.15). 테두리·라벨은 이 값에
   * 맞춰 살짝 함께 오른다. category 모드에는 영향 없다.
   */
  dimOpacity?: number
  /**
   * **공장을 고른 상태**에서 같은 공정의 다른 공장('on')을 이 배율(0~1)만큼 눌러
   * 그린다 — FR-5 의 중간 계층("동일 공정 단계 45~60%"): 고른 공장은 가장 진하게,
   * 같은 공정은 연하게-그러나-보이게, 무관은 dim. 안 주면 기존처럼 평상 네온 그대로
   * (도장 화면). 공정 카드만 스포트라이트한 경우(공장 미선택)에는 적용하지 않는다.
   */
  relatedDimFactor?: number
  /**
   * process 모드에서 모든 지번(무소속·dim 포함)에 이 불투명도의 얇은 흰 윤곽을 남겨
   * 구역이 나뉘어 있는 형태가 연하게 읽히게 한다. 3D 에서도 껍질(한 동) 아래 **바닥에**
   * 같은 윤곽을 깔아 2D 와 동일하게 구역이 읽힌다. 안 주면 기존 그대로(무소속·dim 은
   * 윤곽 없음).
   */
  lotOutlineOpacity?: number
  /**
   * **스포트라이트한 공장 안의 베이(지번) 선택.** `focusedFactory` 가 있을 때 그 공장
   * 소속 지번을 누르면 공장 재선택 대신 `onSelectLot(지번코드)` 가 온다 — 소비자가
   * 토글해 `selectedLot` 으로 되돌려 주면 그 베이가 **눌린(pressed) 형태**(가라앉은
   * 채움 + 흰 테두리)로 강조된다. 3D 에서는 지붕 위에 베이 구분선과 함께 그려진다.
   */
  selectedLot?: string | null
  /** 스포트라이트한 공장 안에서 손이 얹힌 베이(지번) — 살짝 밝아져 누를 수 있음을 알린다 */
  hoveredLot?: string | null
  /**
   * 지도가 **한 장을 짚어 보이는** 지번코드 — 베이 상세 카드에서 지번 줄에 손을 얹거나
   * 누르면, "그게 어디냐"에 지도가 대답하는 자리다.
   *
   * `selectedLot`/`hoveredLot` 과 축이 다르다. 저쪽은 **누를 수 있는 칸**(베이 묶음이
   * 있으면 그룹 id)의 상태라 클릭 계약과 짝을 이루지만, 이쪽은 언제나 **지번 낱장의
   * 코드**이고 상호작용을 만들지 않는다 — 지도는 짚기만 하고, 무엇을 짚을지는 목록이 정한다.
   * 그래서 두 값이 동시에 켜져 있어도 다투지 않는다(고른 베이 **안의** 한 칸을 짚는 것이
   * 본래 쓰임이다).
   */
  highlightedLot?: string | null
  /**
   * 지번을 베이 한 덩어리로 묶는 그룹 목록 (`YardParcelLotGroup` 참조). 주면 위
   * `selectedLot`/`hoveredLot`/`onSelectLot`/`onHoverLot` 이 그 지번 대신 **그룹 id** 로
   * 오간다. 안 주면 지금까지처럼 지번 낱장이 단위다.
   */
  lotGroups?: readonly YardParcelLotGroup[]
  /**
   * 공장의 **베이 스팬**(`YardParcelBaySpan` 참조) — 3D 에서 그 공장을 다중 스팬 공장동으로
   * 세운다. 목록에 없는 공장은 지금까지처럼 발자국 하나(평지붕)로 선다.
   */
  factoryBays?: readonly YardParcelBaySpan[]
  /** 공장 이름줄을 캔버스에 그릴지 (기본 true) */
  showLabels?: boolean
  /**
   * 고른 공장의 이름줄만 캔버스에서 뺀다 — 소비자가 그 자리에 **떠 있는 라벨**(DOM
   * 오버레이)을 얹기 때문이다. 캔버스 이름줄은 지붕 평면에 누워 있어서, 그대로 두면
   * 누운 글씨와 떠 있는 패가 같은 이름을 두 번 말하며 겹친다. 나머지 공장은 그대로다.
   */
  floatingFocusedLabel?: boolean
  onSelectFactory?: (name: string | null) => void
  onHoverFactory?: (name: string | null) => void
  /** 스포트라이트한 공장 안의 베이(지번) 클릭 — 그 공장 소속 지번을 눌렀을 때만 온다 */
  onSelectLot?: (lot: string) => void
  /** 스포트라이트한 공장 안의 베이(지번) 호버 — 벗어나면 null */
  onHoverLot?: (lot: string | null) => void
}

export interface YardMapProps {
  lots: YardLot[]
  blocks: YardBlock[]
  /** 고른 날의 이동 실적 — 색이 배열 순서로 돌아가므로 순서가 곧 신원이다 */
  moves: YardMove[]
  /** 고른 날의 배정 계획 */
  plans: YardPlan[]
  /*
   * ── 야드 데이터 주입 ──
   * 아래 셋은 예전에 이 컴포넌트가 야드 fixture 에서 정적으로 끌어오던 값이다. 지도가
   * 특정 야드를 알지 않도록(shared 는 공정·fixture 를 모른다) 이제 **props 로 주입**받는다.
   * 야드 페이지는 자기 fixture 를, 다른 화면은 자기 데이터를 넘긴다.
   */
  /** 베이스맵 벡터 레이어 (테마별) — 없으면 베이스맵 층은 그리지 않는다 */
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  /** 전체 범위 — 처음 열 때와 "홈"으로 되돌릴 때 이 범위에 맞춘다 */
  extent: LatLonBounds
  /** 화면별 확대/축소 하한·상한(px/위도 1도). 생략하면 공통 전역 범위를 사용한다. */
  minScale?: number
  maxScale?: number
  /** 지번 성격 → 색. 지번 채움을 이 함수로 칠한다 */
  colorOfCategory: (category: string) => string
  /**
   * 감시 대상 조립공장 — 정반이 야드에서 차지하는 지번까지 붙은 것.
   * 비어 있으면 이 레이어는 아무것도 그리지 않는다 (매핑이 덜 된 상태도 정상이다).
   */
  shops?: YardShop[]
  layers: YardLayers
  /** 베이스맵 밝기 — 배경이 바뀌면 그 위에 얹는 색도 함께 뒤집힌다 */
  mapTheme: MapTheme
  /** 평면으로 볼지 기울여 볼지 — 바뀌면 카메라가 그 자세까지 굴러간다 */
  viewMode: YardViewMode
  /** 지번 채움 불투명도 (0.05~0.9) — 베이스맵을 얼마나 비칠지 정한다 */
  lotOpacity: number
  /** 필터에서 빠진 지번 — 지우지 않고 흐리게 남긴다 (사라지면 야드 모양이 무너진다) */
  dimmedLots?: Set<string>
  selectedBlockId?: string | null
  /** 고른 이동 — `moves` 안의 자리. 하나를 고르면 나머지는 배경으로 물러난다 */
  selectedMoveIndex?: number | null
  /** 고른 정반 (locationId) */
  selectedBayId?: string | null
  hoveredLot?: string | null
  /** 손이 얹힌 정반 — 칩과 도형이 같이 밝아진다 */
  hoveredBayId?: string | null
  onSelectBlock?: (blockId: string | null) => void
  onSelectMove?: (index: number | null) => void
  onSelectBay?: (locationId: string | null) => void
  onHoverLot?: (lot: string | null) => void
  onHoverBay?: (locationId: string | null) => void
  onViewChange?: (view: YardView, viewport: Viewport) => void
  /** 공장 화면 경로를 만드는 함수 — 맵은 앱의 라우팅 규칙을 알지 않는다 */
  shopHref?: (shop: YardShop) => string
  /** 정반 3D 화면 경로 */
  bayHref?: (bay: YardShopBay) => string
  /** 공장·샵 목록 — `layers.facilities` 가 켜져 있을 때 그린다 */
  facilities?: YardFacility[]
  /** 고른 공장 (이름이 곧 식별자) */
  selectedFacility?: string | null
  hoveredFacility?: string | null
  onSelectFacility?: (name: string | null) => void
  onHoverFacility?: (name: string | null) => void
  /** 공정 화면 경로 — 없는 공장(전처리·미지정)은 null 을 받아 링크를 만들지 않는다 */
  facilityHref?: (facility: YardFacility) => string | null
  /** 이 공장이 다 보이도록 맞춘다 (목록에서 고른 경우) */
  focusFacilityName?: string | null
  /**
   * 공장 이름줄(DOM 라벨)을 띄울지. 야드 화면은 켜 두지만, 대시보드처럼 지도 위에
   * **자기 오버레이**를 따로 얹는 소비자는 꺼서 라벨이 겹치지 않게 한다. 캔버스의
   * 네온 외곽선은 이 값과 무관하게 `layers.facilities` 를 따른다.
   */
  showFacilityLabels?: boolean
  /**
   * 이 범위가 여백을 두고 다 보이도록 **0.7s 이징으로 카메라를 굴린다** (레퍼런스
   * 뷰어의 `flyToBounds` 느낌). `focusFacilityName` 과 달리 시설 목록을 몰라도 되고,
   * `null` 로 되돌리면 야드 전체로 다시 굴러 나온다. 대시보드가 공정존에 손을 얹을 때
   * 그 공정 자리로 미끄러져 들어가는 데 쓴다. 값 하나가 바뀔 때만 새로 굴린다.
   */
  focusBounds?: LatLonBounds | null
  /** `focusBounds` 카메라 이동 시간(ms). 기본값은 700ms */
  focusBoundsDuration?: number
  /** `focusBounds` 로 맞출 때의 여백 비율 — 이웃이 함께 남을 만큼 넉넉히 둔다 */
  focusBoundsPadding?: number
  /**
   * `focusBounds` 로 굴러갈 때 함께 맞출 방위(도). 주면 카메라가 회전·기울여져 있어도
   * 최단 방향으로 이 방위까지 돌아오고 **기울기도 뷰 모드 기본값으로** 되돌린다 —
   * "원위치" 성격의 이동이 0 을 준다. null(기본)이면 지금 자세를 그대로 지킨다(기존 동작).
   */
  focusBoundsBearing?: number | null
  /** 공장·공정 스포트라이트 진입·해제 시간(ms). 0이면 즉시 반영한다 */
  parcelSpotlightDuration?: number
  /** 외부 탐색 UI(미니맵 등)가 요청한 중심 좌표. 새 객체가 들어올 때마다 이동한다 */
  navigationTarget?: LatLon | null
  /**
   * 처음 열 때의 카메라 — 공정 화면에 다녀온 뒤 보던 자리로 되돌아오기 위한 것.
   * 없으면 야드 전체를 맞춘다. 기울기·방위는 viewMode 가 정하므로 받지 않는다.
   */
  initialView?: { centerLat: number; centerLon: number; scale: number } | null
  /**
   * 처음 열 때 이 범위를 맞춘다 (`initialView` 가 없을 때만). 대시보드처럼 야드 전체가
   * 아니라 **관심 구역(공장 밀집부)** 을 대문으로 삼는 화면이 쓴다 — 전체 범위는 여전히
   * `extent` 가 홈이다. 값은 마운트 시 한 번만 읽는다.
   */
  initialBounds?: LatLonBounds | null
  /** `initialBounds` 로 맞출 때의 여백 비율 */
  initialBoundsPadding?: number
  /** 이 신호가 바뀌면 야드 전체 보기로 되돌린다 */
  resetSignal?: number
  /** 이 블록이 화면 가운데 오도록 맞춘다 (목록에서 고른 경우) */
  focusBlockId?: string | null
  /** 이 이동 경로가 다 보이도록 맞춘다 (목록에서 고른 경우) */
  focusMoveIndex?: number | null
  /**
   * painting 방식 공장 표현 레이어 — 선택적. 주면 지번을 분류색으로 채우고 공장 이름줄과
   * 네온 focus 를 그린다. 안 주면 기존 야드 렌더와 완전히 동일하다(회귀 0).
   */
  parcels?: YardParcelLayer
  className?: string
}

/*
 * 캔버스 글꼴 — 앱 토큰(`--font-inshop-sans`/`--font-mono`)과 같은 서체를 캔버스에서도 쓴다.
 * 캔버스는 CSS 변수를 읽지 못하므로 여기서 한 번 못 박는다 (FR-7: Pretendard / IBM Plex Mono).
 * 시스템 sans 폴백으로 두면 지도 글씨만 다른 앱처럼 보인다.
 */
const CANVAS_SANS = "'Pretendard Variable', Pretendard, system-ui, sans-serif"
const CANVAS_MONO = "'IBM Plex Mono', ui-monospace, monospace"

/** 블록 점 반지름(px) — 배율과 무관하게 일정해야 멀리서도 "여기 있다"가 보인다 */
const BLOCK_RADIUS = 3.5
const BLOCK_HIT_RADIUS = 9
/** 경로를 집는 반경(px) — 선은 2px 이라 그대로 두면 아무도 못 누른다 */
const MOVE_HIT_RADIUS = 10
/** 계획 목적지 점 반지름(px) */
const PLAN_RADIUS = 3
/** 이 배율(px/도) 위에서만 지번 이름을 그린다 — 아래에서는 글자가 겹쳐 회색 띠가 된다 */
const LABEL_MIN_SCALE = 500_000
/** 공장 외곽이 이만큼(px)은 되어야 모서리 표시를 그린다 — 작으면 표시가 도형을 먹는다 */
const BRACKET_MIN_SIZE = 44
/** 2D ↔ 3D 카메라가 굴러가는 시간(ms) — 순간이동하면 어디를 보고 있었는지 놓친다 */
const TILT_DURATION = 480
/** 스포트라이트(네온/디밍) 진입·해제 페이드 시간(ms) — 카메라 이동(700ms)보다 짧게 끊어
 *  줘야 색이 먼저 자리잡고 카메라가 뒤따르는 느낌 없이 둘이 같이 시작한다 */
const SPOTLIGHT_DURATION = 200
/* 기본값을 렌더마다 새로 만들지 않는다 — 다시 그리기 조건이 매 렌더 참이 되어 버린다 */
const NO_SHOPS: YardShop[] = []
const NO_FACILITIES: YardFacility[] = []

/** 화면에서 이보다 작은(가로+세로 px) 건물은 세우지 않는다 — 지붕 발자국 하나로 줄인다 */
const BUILDING_LOD_PX = 16
/** 카메라가 도는 동안의 문턱 — 그동안은 더 굵게 걸러 프레임을 지킨다(멈추면 되돌아온다) */
const BUILDING_LOD_MOVING_PX = 34

/**
 * 베이스맵 레이어별 링 경계 상자 캐시 — 컬링(화면에 걸치는가)을 점 순회 없이 O(1)로.
 * 링 좌표는 불변이고 레이어 객체 참조가 안정적이라(WeakMap 키) 레이어당 한 번만 잰다.
 * 이전에는 프레임마다 모든 링의 모든 점을 훑었다 — 건물·잔 도로가 배율 문턱 없이 상시
 * 켜지는 화면(대시보드)에서는 그 비용이 카메라 애니메이션의 프레임 예산을 다 먹는다.
 */
/**
 * hex 색(#rrggbb)을 밝기 배율로 — 지붕/옆면을 **같은 색의 명도 단계**로 갈라, 위에서
 * 빛이 오는 실제 건물처럼 읽히게 한다 (OSM 건물 압출과 같은 규칙). hex 가 아니면
 * 그대로 돌려준다 — 색이 틀어지는 것보다 음영이 빠지는 쪽이 안전하다.
 */
/**
 * 같은 공장의 동 사이를 이만큼까지는 메워 **한 덩어리**로 본다.
 *
 * 야드의 큰 공장은 통로로 갈려 여러 동으로 앉아 있다(SSY 는 세 동, 사이 16~28m). 사람은
 * 그것을 "SSY 한 공장"으로 세므로 지도도 한 채로 말해야 한다. 6m 면 SSY·2DOCK 도장공장
 * 같은 곳이 한 덩어리가 되고, 늘어나는 면적은 대부분 0.1% 안쪽이다. 더 키우면 모서리가
 * 둥글어지고 진짜로 떨어진 동까지 붙기 시작한다.
 *
 * 메운 자리는 실제 통로다 — 공장을 세는 데는 낫고, 다니는 길을 읽는 데는 나빠진다.
 * 그 교환을 알고 고른 값이다.
 */
const FACTORY_BRIDGE_M = 6

function shadeColor(color: string, factor: number): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)))
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 0xff)}, ${ch(n & 0xff)})`
  }
  /* `rgb()`/`rgba()` 도 받는다 — 팔레트 색(정반·테두리)이 그 꼴이라, 여기서 걸러내면
     그 도형만 음영 없이 납작하게 선다 */
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(
    color
  )
  if (!rgb) return color
  const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number)
  const a = rgb[4]
  return a === undefined
    ? `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`
    : `rgba(${ch(r)}, ${ch(g)}, ${ch(b)}, ${a})`
}


/**
 * 공장 실루엣을 이룰 변 하나. 꼭짓점 키를 함께 들고 다니는 것은 **고리로 잇기 위해서**다
 * (좌표를 매번 다시 문자열로 만들면 반올림이 어긋나 이음매가 끊긴다).
 */
interface BoundaryEdge {
  a: LatLon
  b: LatLon
  ka: string
  kb: string
  /** 몇 번 나왔나 — 2면 두 베이가 맞물린 안쪽 이음매다 */
  count: number
}

/** 꼭짓점 → 키. 잇는 쪽과 모으는 쪽이 **같은 자리수**를 써야 이음매가 맞는다 */
function vertexKey(p: LatLon): string {
  return `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`
}


/**
 * 도형이 붙은 베이 — 이어진 박공 지붕 한 장과, 그 위의 지번 구획.
 *
 * 발자국은 소속 지번 폴리곤을 합친 그대로라 벽이 지면의 2D 지번선과 정확히 겹친다.
 */
interface BaySpanShape {
  id: string
  /**
   * 용마루에 붙일 이름 — 도로로 끊긴 베이는 토막마다 한 채로 서므로, 이름은 가장 큰
   * 토막 하나만 갖는다(빈 문자열 = 이 토막은 이름을 그리지 않는다). 같은 이름이 토막마다
   * 반복되면 베이 하나가 여러 베이처럼 읽힌다.
   */
  label: string
  lotLabels?: Readonly<Record<string, string>>
  factory: string
  /** 실제로 도형을 찾은 지번만 — 이 토막(인접 그룹)에 속한 것들이다 */
  lotCodes: string[]
  roof: BayRoof
  /** 색조(bayTints) 선택용 베이 순번 — 한 베이의 토막들은 같은 색조를 쓴다 */
  tintIndex: number
  bounds: LatLonBounds
  center: LatLon
}

const RING_BOUNDS_CACHE = new WeakMap<BasemapLayer, LatLonBounds[]>()
function ringBoundsOf(layer: BasemapLayer): LatLonBounds[] {
  let bounds = RING_BOUNDS_CACHE.get(layer)
  if (!bounds) {
    bounds = layer.rings.map((ring) => {
      let minLat = Infinity
      let minLon = Infinity
      let maxLat = -Infinity
      let maxLon = -Infinity
      for (const [lon, lat] of ring) {
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
      }
      return { minLat, minLon, maxLat, maxLon }
    })
    RING_BOUNDS_CACHE.set(layer, bounds)
  }
  return bounds
}

/** 손으로 돌릴 때의 감도 — 화면 1px 당 몇 도 */
const ORBIT_YAW_PER_PX = 0.28
const ORBIT_PITCH_PER_PX = 0.22

/**
 * 옥포 야드 맵.
 *
 * 베이스맵(OSM 벡터) 위에 지번 1,977개와 블록 669개를 겹쳐 그린다. SVG 로 두면
 * 노드가 8천 개가 되어 확대·이동마다 레이아웃이 돌지만, **캔버스는 보이는 것만
 * 그리면 된다** — 화면 밖 도형은 그리기 전에 버리므로 확대할수록 오히려 가벼워진다.
 *
 * 지번은 경계 상자가 아니라 **회전 사각형**으로 그린다. 옥포 야드는 안벽 방향을 따라
 * 구획이 돌아가 있어서, 상자로 그리면 서로 겹치고 없는 빈틈이 생긴다.
 *
 * 라벨·범례·상세는 캔버스가 아니라 DOM 으로 얹는다 (3D 뷰어와 같은 규칙) — 글자는
 * 브라우저가 그리는 편이 또렷하고, 테마·글자 크기 설정을 그대로 따른다.
 *
 * **2D 와 3D 는 같은 그림이다.** 기울기는 뷰(`YardView.pitch`)에만 있고 좌표 변환은
 * `projection` 한 곳에서 갈라지므로, 아래 코드는 대부분 기울기를 모른다. 3D 에서만
 * 다른 것은 딱 두 가지다: **세우는 것**(건물·정반·블록에 높이를 준다)과 **그리는
 * 순서**(가까운 것이 먼 것을 가려야 하므로 깊이로 정렬한다). Z 버퍼가 없는 캔버스에서
 * 순서는 곧 가림이라, 세운 것들은 반드시 뒤에서부터 그린다.
 */
export function YardMap({
  lots,
  blocks,
  moves,
  plans,
  basemapLayers,
  extent,
  colorOfCategory,
  shops = NO_SHOPS,
  layers,
  mapTheme,
  viewMode,
  lotOpacity,
  dimmedLots,
  selectedBlockId,
  selectedMoveIndex = null,
  selectedBayId = null,
  hoveredLot,
  hoveredBayId = null,
  onSelectBlock,
  onSelectMove,
  onSelectBay,
  onHoverLot,
  onHoverBay,
  onViewChange,
  shopHref,
  bayHref,
  facilities = NO_FACILITIES,
  selectedFacility = null,
  hoveredFacility = null,
  onSelectFacility,
  onHoverFacility,
  facilityHref,
  focusFacilityName = null,
  showFacilityLabels = true,
  focusBounds = null,
  focusBoundsDuration = 700,
  focusBoundsPadding = 0.35,
  focusBoundsBearing = null,
  parcelSpotlightDuration = SPOTLIGHT_DURATION,
  navigationTarget = null,
  initialView = null,
  initialBounds = null,
  initialBoundsPadding = 0.12,
  minScale,
  maxScale,
  resetSignal = 0,
  focusBlockId,
  focusMoveIndex = null,
  parcels,
  className,
}: YardMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<YardView>({
    centerLat: 34.874,
    centerLon: 128.709,
    scale: 100_000,
    pitch: viewMode === '3d' ? TILTED_PITCH : 0,
    bearing: 0,
  })
  const clampViewScale = useCallback(
    (view: YardView): YardView => ({
      ...view,
      scale: Math.min(maxScale ?? Infinity, Math.max(minScale ?? 0, view.scale)),
    }),
    [minScale, maxScale]
  )
  /** 화면별 배율 한계에 닿으면 커서 기준 중심 보정도 하지 않아 지도가 밀리지 않게 한다. */
  const zoomWithinScaleRange = useCallback(
    (view: YardView, viewport: Viewport, sx: number, sy: number, factor: number): YardView => {
      const targetScale = Math.min(
        maxScale ?? Infinity,
        Math.max(minScale ?? 0, clampScale(view.scale * factor))
      )
      if (targetScale === view.scale) return view
      return zoomAt(view, viewport, sx, sy, targetScale / view.scale)
    },
    [minScale, maxScale]
  )
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 })
  const [cursor, setCursor] = useState<'grab' | 'grabbing' | 'pointer' | 'move'>('grab')
  /*
   * 맵 위의 DOM 칩(조립공장 이름줄·정반 칩)은 뷰가 바뀔 때마다 자리를 다시 잡아야 한다.
   * 뷰는 ref 에 있어서 바뀌어도 React 가 모르므로, 프레임당 한 번 이것으로 렌더를
   * 깨운다 — 값이 아니라 **신호**다. 칩은 열 개 남짓이라 프레임마다 그려도 싸다.
   */
  const [, bumpChips] = useReducer((tick: number) => tick + 1, 0)
  /** 카메라가 지금 움직이는 중인가 — 그리기가 이걸 보고 한 단 가볍게 그린다 (아래 markMoving) */
  const movingRef = useRef(false)

  /* 콜백은 ref 로 받는다 — 부모가 매번 새 함수를 넘겨도 캔버스를 다시 묶지 않는다 */
  const handlers = useRef({
    onSelectBlock,
    onSelectMove,
    onSelectBay,
    onHoverLot,
    onHoverBay,
    onSelectFacility,
    onHoverFacility,
    onViewChange,
    onParcelSelect: parcels?.onSelectFactory,
    onParcelHover: parcels?.onHoverFactory,
    onParcelLotSelect: parcels?.onSelectLot,
    onParcelLotHover: parcels?.onHoverLot,
  })
  handlers.current = {
    onSelectBlock,
    onSelectMove,
    onSelectBay,
    onHoverLot,
    onHoverBay,
    onSelectFacility,
    onHoverFacility,
    onViewChange,
    onParcelSelect: parcels?.onSelectFactory,
    onParcelHover: parcels?.onHoverFactory,
    onParcelLotSelect: parcels?.onSelectLot,
    onParcelLotHover: parcels?.onHoverLot,
  }

  /** 건물 층 — 테마 두 벌이 같은 링 배열을 공유하므로 참조로 중복을 걷어낸다 */
  const parcelBuildingLayers = useMemo(() => {
    const seen = new Set<readonly Ring[]>()
    const out: BasemapLayer[] = []
    for (const theme of ['dark', 'light'] as const) {
      for (const layer of basemapLayers[theme] ?? []) {
        if (layer.kind !== 'building' || seen.has(layer.rings)) continue
        seen.add(layer.rings)
        out.push(layer)
      }
    }
    return out
  }, [basemapLayers])

  /*
   * painting 지번 레이어의 **모양** — 폴리곤별 경계 상자(화면 밖 컬링용), 공장↔지번 색인,
   * 공장 발자국과 베이 지붕. 없으면 null 이라 아래 draw·히트테스트가 전부 건너뛴다
   * (= 기존 야드 렌더와 동일).
   *
   * 의존성은 **레이어 객체가 아니라 그 안의 자료(지번·공장·베이)** 다. 여기 계산은 무거운데
   * (지번 정렬·볼록 껍질·박공 지붕: 한 번에 30~40ms) 그 결과는 호버·선택 같은 순간 상태와
   * 아무 상관이 없다. 객체를 통째로 걸어 두면 소비자가 호버 하나 바꿀 때마다 새 객체가
   * 와서 지붕을 전부 다시 세우고, 손이 공장 위를 지나가는 동안 카메라가 끊긴다.
   *
   * 그래서 소비자는 이 네 배열의 **참조를 안정되게** 유지해야 한다(각자 useMemo). 순간
   * 상태(focus·hover·selected)는 아래 `parcelState` 가 매 렌더 얹으므로 여기 들어오지 않는다.
   */
  const parcelLotsInput = parcels?.lots
  const parcelFactoriesInput = parcels?.factories
  const parcelFactoryBaysInput = parcels?.factoryBays
  const parcelCategoryColorInput = parcels?.categoryColor
  const parcelShapes = useMemo(() => {
    if (!parcelLotsInput || !parcelFactoriesInput || !parcelCategoryColorInput) return null
    const parcels = {
      lots: parcelLotsInput,
      factories: parcelFactoriesInput,
      factoryBays: parcelFactoryBaysInput,
      categoryColor: parcelCategoryColorInput,
    }
    /*
     * 격자에서 돌아간 지번을 돌려 세운다(`straightenBayFootprints`). 잣대는 두 겹이다:
     * 베이가 통째로 들어앉은 OSM 건물이 있으면 **그 건물의 방향**(실측, `ringAxisAround`),
     * 없으면 공장 안 이웃과의 격자 정렬(추정). 1DOCK A5·A6 은 건물 자체가 격자에서 11°
     * 돌아앉아 있어, 실측 없이 격자로만 세우면 오히려 제 건물 밖으로 비어져 나온다.
     * **다른 모든 것보다 먼저** 한다 — 지면의 2D 지번선, 3D 벽, 히트테스트가 전부 이
     * 폴리곤 하나를 보고 서야 서로 어긋나지 않는다.
     */
    const buildingRings = parcelBuildingLayers.flatMap((layer) => layer.rings)
    const rawPolygonOf = new Map(parcels.lots.map((l) => [l.lot, l.polygon]))
    const bayBuildingOf = new Map<string, ReturnType<typeof ringExtentAround>>()
    const baysWithBuilding = (parcels.factoryBays ?? []).map((bay) => {
      const centroids = bay.lotCodes.flatMap((code) => {
        const polygon = rawPolygonOf.get(code)
        return polygon && polygon.length >= 3 ? [centerOfPoints(polygon)] : []
      })
      const building = ringExtentAround(centroids, buildingRings)
      bayBuildingOf.set(bay.id, building)
      return { ...bay, building }
    })
    const straightened = straightenBayFootprints(parcels.lots, baysWithBuilding)
    const polygonOf = (lot: YardParcelLayerLot) => straightened.get(lot.lot) ?? lot.polygon
    const lots = parcels.lots.map((l) => {
      const polygon = polygonOf(l)
      return {
        lot: l.lot,
        category: l.category,
        process: l.process ?? '',
        factory: l.factory ?? null,
        polygon,
        bounds: boundsOf(polygon),
      }
    })
    const factoryLotSet = new Map<string, Set<string>>()
    const factoryOfLot = new Map<string, string>()
    /* 공장 → 그 공장의 공정. 지번 색은 지번 자체의 공정이 아니라 **소속 공장의 공정**으로 통일한다 */
    const factoryProcess = new Map<string, string>()
    for (const f of parcels.factories) {
      factoryLotSet.set(f.name, new Set(f.lotCodes))
      factoryProcess.set(f.name, f.process ?? '')
      for (const code of f.lotCodes) if (!factoryOfLot.has(code)) factoryOfLot.set(code, f.name)
    }
    /* 공장 → 건물 발자국(소속 지번 점 전체의 볼록 껍질). 3D 에서 공장을 한 동으로 세운다 */
    const factoryPoints = new Map<string, LatLon[]>()
    for (const l of lots) {
      if (l.factory == null) continue
      let pts = factoryPoints.get(l.factory)
      if (!pts) factoryPoints.set(l.factory, (pts = []))
      for (const p of l.polygon) pts.push(p)
    }
    const factoryHull = new Map<string, LatLon[]>()
    /* 공장 → 라벨이 따라 누울 지면 방향(동·북 성분, 단위 벡터) — 그 건물의 ↗쪽 대각선 */
    const factoryAxis = new Map<string, { be: number; bn: number }>()
    const factoryByName = new Map(parcels.factories.map((factory) => [factory.name, factory]))
    for (const [name, pts] of factoryPoints) {
      const hull = convexHull(pts)
      if (hull.length < 3) continue
      /*
       * 발자국은 회전 사각형을 우선한다 — 공장동은 직사각형이 기본형이라 그쪽이 "건물
       * 한 채"로 읽힌다. 사각형이 껍질보다 절반 넘게 남으면(심한 비정형 배치) 껍질을
       * 쓴다 — 빈 마당까지 지붕으로 덮는 것보다 낫다.
       */
      const rect = minAreaRect(hull)
      const factory = factoryByName.get(name)
      const shape = factory?.footprintPolygon?.length && factory.footprintPolygon.length >= 3
        ? [...factory.footprintPolygon]
        : factory?.footprintShape === 'rectangle' || polygonArea(rect) <= polygonArea(hull) * 1.5
          ? rect
          : hull
      factoryHull.set(name, shape)

      /*
       * 라벨 축 = 발자국의 변들 중 **북동(↗) 기준에 가장 가까운 변**. 건물에 맞추되
       * 읽는 방향은 항상 왼쪽 아래→오른쪽 위 계열이어야 하므로, 가장 긴 변이 아니라
       * ↗에 가까운 변을 고른다 — 수직인 두 변 중 하나는 반드시 ↗의 ±45° 안에 들어,
       * 어떤 건물도 라벨이 세로로 서지 않는다. 동쪽 성분이 양이 되게 뒤집어 왼→오를 지킨다.
       */
      const REF_E = Math.cos((35 * Math.PI) / 180)
      const REF_N = Math.sin((35 * Math.PI) / 180)
      let bestDot = -Infinity
      let be = REF_E
      let bn = REF_N
      for (let i = 0; i < shape.length; i++) {
        const a = shape[i]
        const b = shape[(i + 1) % shape.length]
        const dx = (b.lon - a.lon) * LON_SQUEEZE
        const dy = b.lat - a.lat
        const len = Math.hypot(dx, dy)
        if (len < 1e-9) continue
        let ex = dx / len
        let en = dy / len
        if (ex < 0) {
          ex = -ex
          en = -en
        }
        const dot = ex * REF_E + en * REF_N
        if (dot > bestDot) {
          bestDot = dot
          be = ex
          bn = en
        }
      }
      factoryAxis.set(name, { be, bn })
    }

    /* 정렬을 마친 지번 도형 — 아래 베이 스팬과 베이 그룹(다음 memo)이 함께 본다 */
    const lotPolygon = new Map(lots.map((l) => [l.lot, l.polygon]))

    /*
     * ── 베이 ── 공장을 한 덩어리로 세우는 대신 **베이마다 한 채**로 세운다.
     *
     * 발자국은 문서(공장-베이-지번 매핑)가 준 소속 지번 폴리곤을 **합친 그대로**다 —
     * 벽이 곧 지면에 깔린 2D 지번선이라 3D 가 그 선에서 벗어날 자리가 없다(베이를 사각형
     * 하나로 펴면 폭이 다른 칸에서 선 밖으로 넘어간다: NPS 3BAY 의 `NP3B01` 은 폭 19m).
     * 지붕은 스팬을 따라 한 장으로 이어지고, 그 안의 지번 경계는 지붕 위의 구획(patch)으로
     * 남아 그리는 쪽이 선과 색조 단차로 나타낸다.
     *
     * 용마루 방향은 **공장 안에서 서로 맞춘다**(`alignedAxes`) — 베이마다 제 긴 축을
     * 그대로 쓰면 같은 건물 안에서 지붕이 몇 도씩 어긋나 톱니처럼 삐뚤어 보이고(원본
     * 지번의 반올림, 반듯한 칸의 축 뒤집힘), 공장 하나에 축 하나를 강제하면 꺾인 별동이
     * 건물 가로로 눕는다. 나란한 것끼리 무리를 지어 그 무리의 방향을 함께 쓴다.
     *
     * 공장 외곽선(`factoryFence`)은 베이 전체의 볼록 껍질을 3% 밖으로 민 것이다. 실제 건물
     * 외곽(기단)을 아는 공장은 그쪽을 쓰고, 이것은 그것을 모를 때의 갈음이다.
     */
    const baySpans = new Map<string, BaySpanShape[]>()
    const factoryFence = new Map<string, LatLon[]>()
    /** 공장 → 그 공장을 두르는 닫힌 고리들 (통로로 갈린 동까지 묶은 실루엣) */
    const factoryOutline = new Map<string, LatLon[][]>()
    /*
     * 먼저 공장별로 모은다 — 축은 이웃을 봐야 정해지므로 베이 하나만 보고는 못 세운다.
     *
     * 세우는 단위는 베이가 아니라 **베이 안의 인접 토막**(`adjacentLotGroups`)이다.
     * 도로로 끊긴 베이(SSY)를 한 지붕으로 이으면 경계를 못 만들어 볼록 껍질로 물러나고,
     * 그 껍질이 이웃 베이를 삼켜 지붕끼리 교차한다. 토막마다 한 채로 서면 용마루가
     * 제 토막의 긴 방향을 따라 지나 조립 공장동과 같은 결이 된다.
     */
    const bayDrafts = new Map<
      string,
      {
        bay: YardParcelBaySpan
        /** 공장 안 베이 순번 — 토막들이 같은 색조(bayTints)를 나눠 갖는 근거 */
        tintIndex: number
        /** 이 토막이 베이 이름을 갖는가 — 가장 큰 토막 하나만 */
        carriesLabel: boolean
        polygons: { lot: string; polygon: LatLon[] }[]
        extent: ReturnType<typeof orientedExtentOf>
        center: LatLon
      }[]
    >()
    const bayOrdinal = new Map<string, number>()
    for (const bay of parcels.factoryBays ?? []) {
      const polygons: { lot: string; polygon: LatLon[] }[] = []
      for (const code of bay.lotCodes) {
        const polygon = lotPolygon.get(code)
        if (polygon && polygon.length >= 3) polygons.push({ lot: code, polygon })
      }
      if (polygons.length === 0) continue
      const tintIndex = bayOrdinal.get(bay.factory) ?? 0
      bayOrdinal.set(bay.factory, tintIndex + 1)
      const pieces = adjacentLotGroups(polygons.map((p) => p.polygon))
      let labelAt = 0
      for (let i = 1; i < pieces.length; i++) {
        if (pieces[i].length > pieces[labelAt].length) labelAt = i
      }
      const list = bayDrafts.get(bay.factory) ?? []
      pieces.forEach((indices, pieceIndex) => {
        const member = indices.map((k) => polygons[k])
        const hull = convexHull(member.flatMap((p) => p.polygon))
        list.push({
          bay,
          tintIndex,
          carriesLabel: pieceIndex === labelAt,
          polygons: member,
          extent: orientedExtentOf(hull),
          /* 이웃이 어느 쪽에 붙어 있는지 재는 기준 — 반듯한 칸의 용마루 방향은 여기서 나온다 */
          center: centerOfPoints(hull),
        })
      })
      bayDrafts.set(bay.factory, list)
    }

    /*
     * ── 베이 매핑이 없는 공장을 세운다 ── 그 공장이 지붕 없는 평지로 남지 않도록, 소속
     * 지번을 같은 박공으로 세운다 (`unmappedFactoryLots` 가 잣대와 거르는 것을 적고 있다).
     *
     * **베이 매핑이 있는 공장은 베이만 선다** — 매핑 밖에 남은 지번은 마당·통로이지
     * 건물이 아니다. 그래서 `hasBays` 를 넘겨 그 공장은 이 갈래에서 빠지게 한다.
     *
     * 이름은 없다(`label: ''`) — 베이 매핑이 없으니 부를 이름이 없고, 그 자리는 공장
     * 이름줄이 말한다. 색조 순번(tintIndex)은 그 공장의 베이 뒤를 이어 받아, 새로 선
     * 동이 이웃 베이와 같은 결로 보이지 않게 한다.
     */
    const spannedLots = new Set<string>()
    const mappedFactories = new Set(bayDrafts.keys())
    for (const drafts of bayDrafts.values())
      for (const draft of drafts) for (const p of draft.polygons) spannedLots.add(p.lot)
    for (const factory of parcels.factories) {
      const groups = unmappedFactoryLots(factory, {
        hasBays: mappedFactories.has(factory.name),
        spanned: spannedLots,
        ownerOf: factoryOfLot,
        polygonOf: lotPolygon,
      })
      if (groups.length === 0) continue
      const list = bayDrafts.get(factory.name) ?? []
      let tintIndex = bayOrdinal.get(factory.name) ?? 0
      for (const member of groups) {
        const hull = convexHull(member.flatMap((p) => p.polygon))
        list.push({
          bay: {
            factory: factory.name,
            id: `${factory.name}#${member[0].lot}`,
            label: '',
            lotCodes: member.map((m) => m.lot),
          },
          tintIndex: tintIndex++,
          carriesLabel: false,
          polygons: member,
          extent: orientedExtentOf(hull),
          center: centerOfPoints(hull),
        })
      }
      bayOrdinal.set(factory.name, tintIndex)
      bayDrafts.set(factory.name, list)
    }

    for (const [name, drafts] of bayDrafts) {
      const axes = alignedAxes(drafts.map(({ extent, center }) => ({ extent, center })))
      const shapes: BaySpanShape[] = []
      drafts.forEach((draft, index) => {
        /* 용마루는 **제 긴 쪽**을 따른다 — 실측·격자 추정은 그 쪽을 다듬을 때만 받는다
         * (`ridgeAxisOf` 가 그 규칙과 근거를 적고 있다) */
        const roof = bayRoofOf(
          draft.polygons,
          ridgeAxisOf({
            own: draft.extent,
            measured: bayBuildingOf.get(draft.bay.id)?.axis,
            aligned: axes[index],
          })
        )
        if (!roof) return
        shapes.push({
          id: draft.bay.id,
          label: draft.carriesLabel ? draft.bay.label : '',
          lotLabels: draft.bay.lotLabels,
          factory: draft.bay.factory,
          lotCodes: draft.polygons.map((p) => p.lot),
          roof,
          tintIndex: draft.tintIndex,
          bounds: boundsOf(roof.outline),
          center: centerOfPoints(roof.outline),
        })
      })
      if (shapes.length > 0) baySpans.set(name, shapes)
    }
    for (const [name, spans] of baySpans) {
      const corners = spans.flatMap((span) => span.roof.outline)
      const center = centerOfPoints(corners)
      factoryFence.set(
        name,
        convexHull(corners).map((p) => ({
          lat: center.lat + (p.lat - center.lat) * 1.03,
          lon: center.lon + (p.lon - center.lon) * 1.03,
        }))
      )
      /*
       * 공장 한 채를 두르는 바깥선. 베이 발자국의 합집합이되, **같은 공장끼리는
       * `FACTORY_BRIDGE_M` 만큼 벌어진 틈을 메워** 한 덩어리로 본다 — SSY 처럼 통로로
       * 갈린 세 동은 야드에서 한 공장으로 세므로, 지도도 한 채로 말해야 한다.
       * 값이 변하지 않는 계산이라 여기서 한 번만 돌린다(프레임마다가 아니다).
       */
      factoryOutline.set(
        name,
        factoryOutlineRings(
          spans.map((span) => span.roof.outline),
          FACTORY_BRIDGE_M
        )
      )
    }
    return {
      lots,
      lotPolygon,
      factories: parcels.factories,
      categoryColor: parcels.categoryColor,
      factoryLotSet,
      factoryOfLot,
      factoryProcess,
      factoryHull,
      factoryAxis,
      baySpans,
      factoryFence,
      factoryOutline,
    }
  }, [
    parcelLotsInput,
    parcelFactoriesInput,
    parcelFactoryBaysInput,
    parcelCategoryColorInput,
    parcelBuildingLayers,
  ])

  /**
   * 베이 그룹 — 묶인 지번들을 **인접 토막마다 한 도형**으로 편다. painting 의 한 베이는
   * 대개 같은 축을 따라 나란히 붙은 지번들이라 토막이 하나고, 그 외곽(공유 변을 지운
   * 경계)이 곧 베이 외형이다. 도로로 끊긴 베이(SSY — 원본 `지번인접여부(3m)` 열이
   * "분리(3개 그룹)"라고 적는 곳)는 토막이 여럿인데, 이걸 볼록 껍질 하나로 뭉치면
   * 길 건너까지 삼켜 이웃 베이와 겹친 거대한 칸이 된다 — 토막마다 갈라 그린다.
   *
   * 위 `parcelShapes` 와 갈라 둔 이유는 이것이 **고른 공장에 따라 바뀌기** 때문이다
   * (소비자는 드릴인한 공장의 베이만 `lotGroups` 로 준다). 한 덩어리로 두면 공장을 고를
   * 때마다 야드 전체의 지붕을 다시 세운다 — 이쪽은 그 공장의 베이 몇 칸만 편다.
   */
  const parcelLotGroupsInput = parcels?.lotGroups
  const parcelData = useMemo(() => {
    if (!parcelShapes) return null
    const lotGroupOf = new Map<string, string>()
    /* 이름 붙은 베이 칸을 가진 공장 — 고를 때 지붕 글씨를 베이에게 넘긴다 (아래 이름줄).
     * 스팬으로 서는 공장도 마찬가지다 — 이름줄과 베이 이름이 겹치지 않게 */
    const factoryHasBayGroups = new Set<string>(parcelShapes.baySpans.keys())
    const lotGroupShapes = new Map<
      string,
      {
        id: string
        label: string
        /** 실제로 도형을 찾은 지번만 — 소속 공장 판정에 쓴다 */
        lotCodes: string[]
        /** 인접 토막마다 한 폴리곤 — 한 덩어리 베이는 길이 1 */
        polygons: LatLon[][]
        /** 이름을 얹을 토막(가장 큰 것) — 토막마다 이름을 반복하지 않는다 */
        labelAt: number
        bounds: LatLonBounds
      }
    >()
    for (const group of parcelLotGroupsInput ?? []) {
      const polys: LatLon[][] = []
      const codes: string[] = []
      for (const code of group.lotCodes) {
        const polygon = parcelShapes.lotPolygon.get(code)
        if (!polygon || polygon.length < 3) continue
        lotGroupOf.set(code, group.id)
        codes.push(code)
        polys.push(polygon)
      }
      if (polys.length === 0) continue
      const owner = parcelShapes.factoryOfLot.get(codes[0])
      if (owner) factoryHasBayGroups.add(owner)
      const pieces = adjacentLotGroups(polys)
      const polygons = pieces.map((indices) => {
        const member = indices.map((k) => polys[k])
        return outlineOf(member) ?? convexHull(member.flat())
      })
      let labelAt = 0
      for (let i = 1; i < pieces.length; i++) {
        if (pieces[i].length > pieces[labelAt].length) labelAt = i
      }
      lotGroupShapes.set(group.id, {
        id: group.id,
        label: group.label,
        lotCodes: codes,
        polygons,
        labelAt,
        bounds: boundsOf(polys.flat()),
      })
    }
    return { ...parcelShapes, lotGroupOf, lotGroupShapes, factoryHasBayGroups }
  }, [parcelShapes, parcelLotGroupsInput])


  /**
   * ── 공장 기단 ── 공장이 딛고 선 **OSM 건물 발자국**, 그리고 회색 층에서 뺄 링들.
   *
   * 공정색으로 세운 공장 자리에 회색 OSM 건물이 함께 서면 두 모형이 겹쳐 어긋난 것처럼
   * 보인다. 그래서 **공장 지번 위에 선 회색 건물은 세우지 않는다**(`claimed`) — 그 자리는
   * 색이 있고 누를 수 있는 우리 도형이 맡는다. 공장 밖(시가지·부두 창고)의 회색 건물은
   * 배경으로 그대로 둔다: 그것까지 지우면 공장이 허공에 뜬다.
   *
   * 베이 스팬으로 서는 공장은 한 걸음 더 간다. 스팬이 그 건물의 72~99% 만 덮어(옥포 조립:
   * PBS 72% · 3DS 76%) 나머지가 빈 자리로 남으므로, 뺀 링을 **공정색 기단**으로 낮게 다시
   * 세워 스팬이 그 위에 오르게 한다. 측정해 보면 지번은 건물 안에 98% 들어 있어(최적 정합
   * 오차 2m ≈ 좌표 반올림) 좌표를 옮길 이유가 없다 — 어긋나 보이던 것은 좌표가 아니라
   * **덮이지 않은 건물 면적**이었다.
   *
   * 소유 판정은 "링의 무게중심이 그 공장 소속 지번 안에 드는가"다.
   */
  const factoryPodium = useMemo(() => {
    const byFactory = new Map<string, Ring[]>()
    /** 그 발자국을 조금 밖으로 민 선 — 스팬들을 한 공장으로 묶는 외곽선 */
    const outlineByFactory = new Map<string, LatLon[][]>()
    const claimed = new Set<Ring>()
    if (!parcelShapes) return { byFactory, outlineByFactory, claimed }

    const centroidOf = (ring: Ring) => {
      let lon = 0
      let lat = 0
      for (const [x, y] of ring) {
        lon += x
        lat += y
      }
      return { lon: lon / ring.length, lat: lat / ring.length }
    }

    /* 공장별 소속 지번 도형 — 스팬이 있든 없든 회색 건물을 걷어내는 잣대는 같다 */
    const shapesOf = new Map<string, { polygon: LatLon[]; bounds: LatLonBounds }[]>()
    for (const lot of parcelShapes.lots) {
      const name = parcelShapes.factoryOfLot.get(lot.lot) ?? lot.factory
      if (!name) continue
      const list = shapesOf.get(name)
      if (list) list.push({ polygon: lot.polygon, bounds: lot.bounds })
      else shapesOf.set(name, [{ polygon: lot.polygon, bounds: lot.bounds }])
    }

    for (const [name, shapes] of shapesOf) {
      if (shapes.length === 0) continue
      /* 링 전체를 훑지 않도록 이 공장의 경계 상자로 먼저 거른다 */
      const box = shapes.map((shape) => shape.bounds).reduce(mergeBounds)
      const rings: Ring[] = []
      for (const layer of parcelBuildingLayers) {
        for (const ring of layer.rings) {
          if (claimed.has(ring)) continue
          const c = centroidOf(ring)
          if (!containsPoint(box, c.lat, c.lon)) continue
          if (!ringSitsOn(ring, shapes)) continue
          rings.push(ring)
          claimed.add(ring)
        }
      }
      /* 기단은 스팬으로 서는 공장에만 필요하다 — 한 덩어리로 서는 공장은 그 도형이 곧 건물이다 */
      if (rings.length === 0 || !parcelShapes.baySpans.has(name)) continue
      byFactory.set(name, rings)
      outlineByFactory.set(
        name,
        rings.map((ring) => {
          const c = centroidOf(ring)
          return ring.map(([lon, lat]) => ({
            lat: c.lat + (lat - c.lat) * 1.02,
            lon: c.lon + (lon - c.lon) * 1.02,
          }))
        })
      )
    }
    return { byFactory, outlineByFactory, claimed }
  }, [parcelShapes, parcelBuildingLayers])

  const parcelState = parcelData
    ? {
        ...parcelData,
        podium: factoryPodium,
        colorMode: parcels?.colorMode ?? 'category',
        processColor: parcels?.processColor,
        focusedProcess: parcels?.focusedProcess ?? null,
        focusedFactory: parcels?.focusedFactory ?? null,
        hoveredFactory: parcels?.hoveredFactory ?? null,
        opacity: parcels?.opacity ?? 0.55,
        dimOpacity: parcels?.dimOpacity ?? null,
        relatedDimFactor: parcels?.relatedDimFactor ?? null,
        lotOutlineOpacity: parcels?.lotOutlineOpacity ?? null,
        selectedLot: parcels?.selectedLot ?? null,
        hoveredLot: parcels?.hoveredLot ?? null,
        highlightedLot: parcels?.highlightedLot ?? null,
        showLabels: parcels?.showLabels ?? true,
        floatingFocusedLabel: parcels?.floatingFocusedLabel ?? false,
      }
    : null

  /**
   * 스포트라이트(네온/디밍) 진입·해제에 짧은 페이드를 준다 — 대시보드 공장/공정 클릭,
   * 도장 화면의 공장 전환처럼 `parcels` 의 focus 유무가 바뀔 때. **양방향**으로 부드럽다:
   * `parcelFadeFromRef` 가 전환 시작 시점의(=바뀌기 직전) focus 를, 현재 props 가 도착
   * 지점을 맡고, `parcelFadeProgressRef` 가 그 사이를 0→1 로 이징한다(아래 효과 참조).
   * draw() 는 지번마다 "그 지점의 focus 라면 어떤 스타일이었을지"를 양쪽에서 계산해 섞으므로,
   * 밝아지는 지번도 어두워지는 지번도 같은 이징을 탄다. 이 값을 쓰지 않는 야드 화면(plain
   * 지번·시설 네온, `parcels` 를 안 주는 화면)은 영향이 없다.
   */
  const parcelSpotlightActive = parcelState
    ? parcelState.focusedFactory != null || parcelState.focusedProcess != null
    : false
  const parcelFadeFromRef = useRef<{ focusedFactory: string | null; focusedProcess: string | null }>(
    {
      focusedFactory: parcelState?.focusedFactory ?? null,
      focusedProcess: parcelState?.focusedProcess ?? null,
    }
  )
  /** 0 = `parcelFadeFromRef` 그대로, 1 = 지금 props(도착 지점) 그대로. 정착해 있으면 항상 1 */
  const parcelFadeProgressRef = useRef(1)

  /* 그리기 입력도 ref 로 — draw 를 의존성 없는 안정된 함수로 유지한다 */
  const data = useRef({
    lots,
    blocks,
    moves,
    plans,
    basemapLayers,
    extent,
    colorOfCategory,
    shops,
    layers,
    mapTheme,
    lotOpacity,
    dimmedLots,
    selectedBlockId,
    selectedMoveIndex,
    selectedBayId,
    hoveredLot,
    hoveredBayId,
    facilities,
    selectedFacility,
    hoveredFacility,
    parcels: parcelState,
  })
  data.current = {
    lots,
    blocks,
    moves,
    plans,
    basemapLayers,
    extent,
    colorOfCategory,
    shops,
    layers,
    mapTheme,
    lotOpacity,
    dimmedLots,
    selectedBlockId,
    selectedMoveIndex,
    selectedBayId,
    hoveredLot,
    hoveredBayId,
    facilities,
    selectedFacility,
    hoveredFacility,
    parcels: parcelState,
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const view = viewRef.current
    const viewport = viewportRef.current
    const dpr = window.devicePixelRatio || 1
    const current = data.current
    const theme = current.mapTheme
    const palette = paletteOf(theme)
    /** 기울어져 있는가 — 세우기와 깊이 정렬은 이 값 하나로만 갈린다 */
    const tilted = view.pitch > 0

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    /* 캔버스 바탕은 바다다 — 육지는 베이스맵이 그 위에 덮는다 */
    ctx.fillStyle = SEA_COLOR[theme]
    ctx.fillRect(0, 0, viewport.width, viewport.height)

    const window_ = visibleBounds(view, viewport, 60)

    /** 위경도 + 고도(m) → 화면 */
    const at = (lat: number, lon: number, altitude = 0) =>
      worldToScreen(view, viewport, lat, lon, altitude)

    /** 화면 점 목록을 닫힌 경로로 — 세운 도형은 좌표를 두 벌 쓰므로 이 단계를 나눈다 */
    const traceScreen = (points: readonly ScreenPoint[]) => {
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].sx, points[i].sy)
        else ctx.lineTo(points[i].sx, points[i].sy)
      }
    }

    /** 링 하나를 경로로 옮긴다. GeoJSON 은 [lon, lat] 순서다 */
    const traceRing = (ring: readonly [number, number][]) => {
      ctx.beginPath()
      for (let i = 0; i < ring.length; i++) {
        const { sx, sy } = at(ring[i][1], ring[i][0])
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
    }

    /** 위경도 점 목록을 경로로 옮긴다 (지번·경로는 {lat, lon} 을 쓴다) */
    const tracePath = (points: readonly LatLon[]) => {
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        const { sx, sy } = at(points[i].lat, points[i].lon)
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
    }

    /*
     * 카메라가 도는 동안에는 그러데이션을 걷는다 — 그러데이션 채움은 단색보다 훨씬 비싸서
     * (측정: 대문 화면 끌기 한 프레임 17ms → 28ms), 움직이는 화면에서는 그 값을 치를
     * 이유가 없다. 손을 놓는 순간의 마무리 그리기에서 제 모습으로 돌아온다
     * (`markMoving` — 시가지 건물 LOD 가 쓰는 것과 같은 규칙이다).
     */
    const softShading = !movingRef.current

    /**
     * 벽 한 벌에 씌우는 세로 그러데이션 — 발치는 어둡고 처마는 밝다 (`WALL_FOOT_DARKEN`).
     *
     * 좌표는 화면 세로축만 쓴다. 고도는 화면에서 거의 위로만 올라가므로(원근 때문에 x 도
     * 조금 밀리지만 벽 한 채 안에서는 몇 px 이다) 세로 한 축이면 충분하고, 축을 하나로
     * 두면 같은 건물의 벽들이 **같은 자리에서 같은 밝기**가 되어 이음매가 보이지 않는다.
     */
    const wallPaint = (color: string, light: number, footY: number, headY: number) => {
      if (!softShading || Math.abs(footY - headY) < 0.5) return shadeColor(color, light)
      const g = ctx.createLinearGradient(0, footY, 0, headY)
      g.addColorStop(0, shadeColor(color, light * WALL_FOOT_DARKEN))
      g.addColorStop(1, shadeColor(color, light))
      return g
    }

    /** 화면 점들의 세로 평균 — 그러데이션 축의 양 끝을 잡는 데만 쓴다 */
    const meanY = (points: readonly ScreenPoint[]) => {
      let sum = 0
      for (const p of points) sum += p.sy
      return sum / (points.length || 1)
    }

    /**
     * 옆면 하나를 경로에 담는다 — 화면 감김을 한쪽으로 맞춰서.
     *
     * nonzero 채움 규칙 때문이다: 한 경로 안에서 뒷면이 앞면과 겹치는데 감김이 서로
     * 반대면 겹친 자리가 상쇄돼 구멍으로 뚫린다.
     */
    const addWallFace = (
      path: Path2D,
      a: ScreenPoint,
      b: ScreenPoint,
      c: ScreenPoint,
      d: ScreenPoint
    ) => {
      path.moveTo(a.sx, a.sy)
      if ((b.sx - a.sx) * (c.sy - b.sy) - (b.sy - a.sy) * (c.sx - b.sx) >= 0) {
        path.lineTo(b.sx, b.sy)
        path.lineTo(c.sx, c.sy)
        path.lineTo(d.sx, d.sy)
      } else {
        path.lineTo(d.sx, d.sy)
        path.lineTo(c.sx, c.sy)
        path.lineTo(b.sx, b.sy)
      }
      path.closePath()
    }

    /**
     * 옆면을 **해가 비치는 방향으로 갈라** 담는다 — 벽마다 밝기가 다르면 모서리가 각으로
     * 보이고, 그때 비로소 상자가 상자로 읽힌다 (`lighting.ts`).
     *
     * 면마다 fill 을 부르면 건물 한 채에 캔버스 호출이 8쌍씩 드는데, 밝기를 몇 단으로
     * 양자화해 **같은 단끼리 한 경로에 모으면** 직사각형 건물은 두세 번이면 끝난다.
     */
    const LIGHT_STEP = 0.06
    const litWallPaths = (
      world: readonly LatLon[],
      base: readonly ScreenPoint[],
      top: readonly ScreenPoint[],
      skip?: (i: number, j: number) => boolean
    ) => {
      const ccw = isCounterClockwise(world)
      const bins = new Map<number, { light: number; path: Path2D }>()
      for (let i = 0; i < base.length; i++) {
        const j = (i + 1) % base.length
        if (skip?.(i, j)) continue
        const light = wallLightOf(world[i], world[j], ccw)
        const key = Math.round(light / LIGHT_STEP)
        let bin = bins.get(key)
        if (!bin) {
          bin = { light: key * LIGHT_STEP, path: new Path2D() }
          bins.set(key, bin)
        }
        addWallFace(bin.path, base[i], base[j], top[j], top[i])
      }
      return [...bins.values()]
    }

    const drawPrism = (
      world: readonly LatLon[],
      base: readonly ScreenPoint[],
      top: readonly ScreenPoint[],
      style: { wall: string; wallEdge: string; roof: string; roofEdge: string },
      /** 면마다 해를 따로 재는가 — 켜면 벽이 갈리고, 끄면 한 색에 그러데이션만 얹는다 */
      lit = false
    ) => {
      if (lit) {
        const footY = meanY(base)
        const headY = meanY(top)
        ctx.lineWidth = 0.6
        ctx.strokeStyle = style.wallEdge
        for (const bin of litWallPaths(world, base, top)) {
          ctx.fillStyle = wallPaint(style.wall, bin.light, footY, headY)
          ctx.fill(bin.path)
          ctx.stroke(bin.path)
        }
      } else {
        /*
         * 옆면을 **전부** 그린다. 뒷면은 나중에 그리는 윗면이 덮으므로(건물이 제 높이보다
         * 깊으면 언제나 그렇다) 뒷면을 골라내는 계산을 하지 않는 편이 싸고 안전하다.
         *
         * 다만 옆면을 **한 경로에 모아** 한 번만 칠한다. 면마다 fill/stroke 를 부르면 건물
         * 한 채에 캔버스 호출이 7~8쌍씩 들고, 대문처럼 800채가 함께 서는 화면에서는 그것이
         * 곧 프레임을 잡아먹는다(측정: 3D 대문 한 프레임 21ms 중 건물 세우기가 11ms).
         * 그 화면에서는 면을 가르는 대신 그러데이션 한 겹으로만 부피를 말한다 — 호출 수는
         * 그대로이고, 벽이 발치에서 어두워지는 것만으로 건물이 지면에 닿아 보인다.
         */
        const path = new Path2D()
        for (let i = 0; i < base.length; i++) {
          const j = (i + 1) % base.length
          addWallFace(path, base[i], base[j], top[j], top[i])
        }
        ctx.fillStyle = style.wall
        ctx.fill(path)
        ctx.strokeStyle = style.wallEdge
        ctx.lineWidth = 0.6
        ctx.stroke(path)
      }

      traceScreen(top)
      ctx.closePath()
      /* 평지붕은 하늘을 정면으로 본다 — 벽 중 가장 밝은 면보다도 밝아야 위아래가 갈린다 */
      ctx.fillStyle = lit ? shadeColor(style.roof, FLAT_ROOF_LIGHT) : style.roof
      ctx.fill()
      ctx.strokeStyle = style.roofEdge
      ctx.lineWidth = 0.8
      ctx.stroke()
    }

    // ── 베이스맵 ──
    /*
     * 3D 에서는 건물만 빼 둔다. 건물은 지번 **위에** 서 있어야 하므로, 지번을 다 깐
     * 뒤에 세운다 — 순서를 바꾸지 않으면 건물 밑의 지번이 지붕 위로 떠오른다.
     */
    const standing: BasemapLayer[] = []
    if (current.layers.basemap) {
      for (const layer of current.basemapLayers[theme]) {
        if (layer.minScale && view.scale < layer.minScale) continue
        if (tilted && layer.kind === 'building') {
          standing.push(layer)
          continue
        }
        if (layer.fill) ctx.fillStyle = layer.fill
        if (layer.stroke) ctx.strokeStyle = layer.stroke
        ctx.lineWidth = layer.lineWidth ?? 1

        const ringBounds = ringBoundsOf(layer)
        for (let r = 0; r < layer.rings.length; r++) {
          if (!intersects(ringBounds[r], window_)) continue
          const ring = layer.rings[r]
          traceRing(ring)
          if (layer.closed) {
            ctx.closePath()
            if (layer.fill) ctx.fill()
            if (layer.stroke) ctx.stroke()
          } else if (layer.stroke) {
            ctx.stroke()
          }
        }
      }
    }

    // ── 지번 ──
    if (current.layers.lots) {
      for (const lot of current.lots) {
        if (!intersects(lot.bounds, window_)) continue
        const isDim = current.dimmedLots?.has(lot.lot) ?? false
        const color = current.colorOfCategory(lot.category)

        ctx.beginPath()
        for (let i = 0; i < lot.quad.length; i++) {
          const { sx, sy } = at(lot.quad[i].lat, lot.quad[i].lon)
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.closePath()

        ctx.globalAlpha = isDim ? current.lotOpacity * 0.15 : current.lotOpacity
        ctx.fillStyle = color
        ctx.fill()
        ctx.globalAlpha = isDim ? 0.15 : 0.9
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.globalAlpha = 1

        if (lot.lot === current.hoveredLot) {
          ctx.strokeStyle = palette.highlight
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      // 지번 이름 — 사각형이 글자를 담을 만큼 클 때만
      if (view.scale >= LABEL_MIN_SCALE) {
        ctx.fillStyle = palette.label
        ctx.font = `10px ${CANVAS_MONO}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (const lot of current.lots) {
          if (!intersects(lot.bounds, window_)) continue
          if (current.dimmedLots?.has(lot.lot)) continue
          const span = at(lot.bounds.minLat, lot.bounds.maxLon)
          const origin = at(lot.bounds.maxLat, lot.bounds.minLon)
          if (span.sx - origin.sx < 44 || span.sy - origin.sy < 14) continue
          const c = at(lot.center.lat, lot.center.lon)
          ctx.fillText(lot.lot, c.sx, c.sy)
        }
      }
    }

    // ── painting 지번 레이어 (선택적) ──
    /*
     * 공장 = 소속 지번들의 집합(hull 아님). 각 지번을 분류(category)색으로 채우고, 공장
     * 하나를 focus 하면 그 공장 지번만 발광시키고 나머지는 가라앉힌다 — 야드의 공장 네온
     * focus 와 같은 결이다(발광은 상대적이라, 고른 것만 밝아야 눈에 든다). `parcels` 가
     * 없으면 이 블록 전체를 건너뛴다(= 기존 야드 화면).
     */
    /*
     * 3D 에서 세울 공정색 지번 — 기울인 화면에서 스포트라이트 안('on'/'selected')의 공장
     * 지번은 평면이 아니라 **실제 건물 같은 불투명 부피**로 선다(공정색 지붕 + 어두운
     * 옆면). 건물(베이스맵)을 깐 **뒤에** 세워야 회색 지붕에 덮이지 않으므로, 여기 모아
     * 두고 그리기는 미룬다. 이름줄도 지붕 위에 얹혀야 하므로 같이 미룬다. 2D 에서는 둘 다
     * 빈 채라 기존 렌더와 같다.
     */
    const parcelPrisms: {
      polygon: readonly LatLon[]
      color: string
      kind: 'selected' | 'on'
      /** 불투명도 — 스포트라이트 페이드가 여기로 들어와 켜지고 꺼진다 */
      alpha: number
      hovered: boolean
      progress: number
      /** 이 껍질의 공장 — 고른 공장이면 지붕 위에 베이(지번) 구분을 그릴 때 쓴다 */
      factory: string
      /**
       * 베이면 그 베이 — 있으면 평지붕 대신 박공 지붕 한 채로 서고, 이어진 지붕 위에
       * 지번 구획이 선과 색조로 나뉜다. 없으면(베이 매핑이 없는 공장) 발자국 한 덩어리다.
       */
      span?: BaySpanShape
      /** 공장 안에서 몇 번째 베이인가 — 이웃 베이와 색조를 어긋나게 하는 데 쓴다 */
      spanIndex?: number
      /** 그 베이가 지금 고른/얹힌 베이인가 — 드릴다운(lotGroups)의 상태를 옮겨 받은 것 */
      spanState?: { pressed: boolean; hovered: boolean }
    }[] = []
    /* 공장 기단 — 스팬이 딛고 설 OSM 건물 발자국. 회색 건물 층에서 뺀 링을 여기서 세운다 */
    const parcelPodiums: { rings: readonly Ring[]; color: string; alpha: number }[] = []
    let deferredParcelLabels: (() => void) | null = null
    /*
     * 베이 한 칸을 그리는 붓 — 2D 는 제자리에서 바로 쓰지만, 3D 는 지붕이 세워진 **뒤에**
     * 그 위에 얹혀야 해서 프리즘 블록까지 들고 가야 한다. 지번 레이어(process 모드)에서만
     * 만들어지므로 그 밖에서는 null 이다.
     */
    let drawBayCellRef:
      | ((
          polygon: readonly LatLon[],
          label: string | null,
          color: string,
          altitude: number,
          pressed: boolean,
          hovered: boolean,
          alpha: number
        ) => void)
      | null = null
    /*
     * 짚어 보이는 지번 한 장(`highlightedLot`)을 그리는 붓. `drawBayCellRef` 와 같은 이유로
     * 밖에 둔다 — 3D 는 지붕이 다 선 **뒤에** 그 위에 얹어야 앞 스팬에 가려지지 않는다.
     */
    let drawLotSpotRef:
      | ((pieces: readonly (readonly ScreenPoint[])[], code: string) => void)
      | null = null

    const parcels = current.parcels
    if (parcels) {
      const tracePolygon = (polygon: readonly LatLon[]) => {
        ctx.beginPath()
        for (let i = 0; i < polygon.length; i++) {
          const { sx, sy } = at(polygon[i].lat, polygon[i].lon)
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.closePath()
      }

      const hoverSet =
        parcels.hoveredFactory != null
          ? parcels.factoryLotSet.get(parcels.hoveredFactory) ?? null
          : null

      if (parcels.colorMode === 'process') {
        /*
         * ── 샵 네비게이션 룩 (painting 뷰어 재현) ──
         * 각 공장의 지번을 **그 공장의 공정색**으로 채우고 글로우로 피워 올린다. 공정 하나를
         * 스포트라이트하면(focusedProcess) 그 공정 공장만 밝고 나머지는 강하게 디밍, 공장 하나를
         * 고르면(focusedFactory) 그것만 가장 강한 글로우. 무소속 지번은 옅은 배경으로만 깐다.
         * 수치는 painting 원본: 채움 선택0.5/기본0.34/디밍0.07 × opacity 1/0.8/0.12, 흰 테두리
         * 선택1.6/1.1, 글로우 0 0 3+9px, 선택 +16px.
         */
        const processColor = parcels.processColor ?? (() => '#c9c4bc')
        const factoryProcess = parcels.factoryProcess
        const focusedFactory = parcels.focusedFactory
        const focusedProcess = parcels.focusedProcess
        const focusSet = focusedFactory
          ? parcels.factoryLotSet.get(focusedFactory) ?? null
          : null
        /*
         * 스포트라이트 페이드 — `parcelFadeFromRef`(전환 시작 지점의 focus) 와 지금 props
         * (도착 지점) 사이를 `parcelFadeProgressRef` 로 0→1 이징한다. 진행률이 1(정착)이면
         * `fromFocus`가 곧 지금 focus 와 같아서 아래 블렌드는 항상 기존 수치와 정확히
         * 같은 값을 낸다(회귀 없음) — 전환 중(0<progress<1)에만 "페이드 중"인 그림이 된다.
         */
        const progress = parcelFadeProgressRef.current
        const fromFocus = parcelFadeFromRef.current
        const ON_FILL = 0.8 * 0.34
        const ON_STROKE = 0.8
        const ON_GLOW = 9
        /* 같은 공정 중간 계층('rel') 배율 — 소비자가 켠 경우에만 존재한다 */
        const relFactor = parcels.relatedDimFactor ?? null
        /* 구역 분할 윤곽 — 지번이 나뉜 형태를 연하게 남긴다. 3D 도 바닥에 같은 윤곽을 깐다
         * (껍질은 한 동으로 서지만, 그 아래 지면에서 구역이 나뉜 형태가 2D 처럼 읽히게) */
        const lotOutline = parcels.lotOutlineOpacity ?? null
        /* 현재 trace 된 지번 경로에 연한 윤곽 한 줄 — 2D 무소속, 3D 에서 낱장을 건너뛴 지번 공용 */
        const strokeLotOutline = () => {
          if (lotOutline == null) return
          ctx.globalAlpha = lotOutline
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 0.8
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        /** 'rel' 라벨 불투명도 — 이름은 남되 선택 공장보다 한 발 물러난다 */
        const REL_LABEL_ALPHA = 0.55

        /**
         * 베이 이름 — 칸 가운데(꼭짓점 화면좌표 평균)에 어두운 후광 한 겹을 두르고 얹는다.
         * 칸이 글자보다 좁게 보이는 배율에서는 **그리지 않는다** — 겹쳐 뭉개진 이름은
         * 없는 것만 못하다. 글자 크기도 칸의 짧은 변에 맞춰 함께 줄인다.
         */
        const drawBayLabel = (
          points: readonly ScreenPoint[],
          label: string,
          alpha: number,
          strong: boolean
        ) => {
          let cx = 0
          let cy = 0
          let minX = Infinity
          let maxX = -Infinity
          let minY = Infinity
          let maxY = -Infinity
          for (const p of points) {
            cx += p.sx
            cy += p.sy
            if (p.sx < minX) minX = p.sx
            if (p.sx > maxX) maxX = p.sx
            if (p.sy < minY) minY = p.sy
            if (p.sy > maxY) maxY = p.sy
          }
          const span = Math.min(maxX - minX, maxY - minY)
          if (span < 22) return
          const size = Math.max(9, Math.min(14, span * 0.34))
          ctx.save()
          ctx.font = `650 ${size}px ${CANVAS_SANS}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineJoin = 'round'
          ctx.globalAlpha = (strong ? 1 : 0.78) * alpha
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(0,0,0,0.55)'
          ctx.strokeText(label, cx / points.length, cy / points.length)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(label, cx / points.length, cy / points.length)
          ctx.restore()
          ctx.globalAlpha = 1
        }

        /**
         * 고른 공장 안의 **베이 한 칸**. 2D 는 지면(altitude 0)에, 3D 는 지붕 높이에 같은
         * 문법으로 그린다 — 흰 외곽으로 공장이 어떻게 나뉘어 있는지 보이고, 손이 얹히면
         * 흰 베일로 밝아지며(누를 수 있음), 누르면 공정색을 어둡게 가라앉힌 채움 + 또렷한
         * 흰 테두리로 눌린 형태가 된다. 이름이 있는 칸(베이 그룹)은 이름을 칸 가운데에
         * 얹어 "몇 번 베이"인지 지도가 직접 말한다 — 지번코드를 외우게 하지 않으려는 것이다.
         */
        const drawBayCell = (
          polygon: readonly LatLon[],
          label: string | null,
          color: string,
          altitude: number,
          pressed: boolean,
          hovered: boolean,
          alpha: number
        ) => {
          const points = polygon.map((p) => at(p.lat, p.lon, altitude))
          traceScreen(points)
          ctx.closePath()
          if (!pressed && hovered) {
            ctx.globalAlpha = 0.14 * alpha
            ctx.fillStyle = '#ffffff'
            ctx.fill()
          }
          if (pressed) {
            ctx.globalAlpha = 0.55 * alpha
            ctx.fillStyle = shadeColor(color, 0.35)
            ctx.fill()
          }
          ctx.globalAlpha = (pressed ? 0.95 : hovered ? 0.72 : 0.4) * alpha
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = pressed ? 1.8 : hovered ? 1.4 : 0.8
          ctx.stroke()
          ctx.globalAlpha = 1
          if (label) drawBayLabel(points, label, alpha, pressed || hovered)
        }
        drawBayCellRef = drawBayCell

        /**
         * **짚기** — 목록(베이 상세 카드)에서 고른 지번 한 장이 지도의 어디인가.
         *
         * 베이 칸(`drawBayCell`)과 문법을 일부러 다르게 둔다: 저것은 "누를 수 있는 칸"의
         * 상태(흰 외곽·눌린 채움)이고 이것은 **손가락**이다. 그래서 흰 베일과 번지는 링으로
         * 칸을 들어올리고, 그 위에 지번코드 패를 대에 얹어 세운다 — 칸이 작아 링만으로는
         * 어느 것인지 헷갈리는 배율에서도 이름이 자리를 못 박는다. 패는 화면에 똑바로 서고
         * (지붕에 누운 설명 글씨와 다른 층위다) 칸의 위쪽 밖에 놓여 칸 자체를 가리지 않는다.
         */
        const drawLotSpot = (pieces: readonly (readonly ScreenPoint[])[], code: string) => {
          const rings = pieces.filter((piece) => piece.length >= 3)
          if (rings.length === 0) return
          let cx = 0
          let cy = 0
          let n = 0
          let minY = Infinity
          for (const piece of rings) {
            for (const p of piece) {
              cx += p.sx
              cy += p.sy
              n += 1
              if (p.sy < minY) minY = p.sy
            }
          }
          cx /= n
          cy /= n

          ctx.save()
          ctx.globalAlpha = 0.2
          ctx.fillStyle = '#ffffff'
          for (const piece of rings) {
            traceScreen(piece)
            ctx.closePath()
            ctx.fill()
          }
          ctx.globalAlpha = 0.95
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2.4
          ctx.shadowColor = 'rgba(255,255,255,0.85)'
          ctx.shadowBlur = 14
          for (const piece of rings) {
            traceScreen(piece)
            ctx.closePath()
            ctx.stroke()
          }
          ctx.restore()

          /* 대 — 칸의 위쪽 끝(또는 중심 중 더 위)에서 짧게 세운다. 패는 하나뿐이다 */
          const foot = Math.min(minY, cy) - 3
          const stem = 15
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(cx, foot)
          ctx.lineTo(cx, foot - stem)
          ctx.strokeStyle = 'rgba(255,255,255,0.82)'
          ctx.lineWidth = 1.2
          ctx.stroke()

          /* 지번코드 패 — 코드는 자릿수가 뜻을 갖는 식별자라 고정폭으로 */
          ctx.font = `700 11px ${CANVAS_MONO}`
          const boxW = ctx.measureText(code).width + 12
          const boxH = 17
          const boxY = foot - stem - boxH
          ctx.beginPath()
          ctx.roundRect(cx - boxW / 2, boxY, boxW, boxH, 4)
          ctx.fillStyle = 'rgba(10,14,19,0.92)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#ffffff'
          ctx.fillText(code, cx, boxY + boxH / 2 + 0.5)
          ctx.restore()
        }
        drawLotSpotRef = drawLotSpot

        /**
         * `focusedFactory`/`focusedProcess` 조합 하나로 지번(또는 공장 이름줄) 하나의
         * on/rel/dim 을 가른다(선택 여부는 뺀다 — 'selected' halo·크기는 각자 따로 맡는다.
         * 어느 focus 에서 봐도 "그 factory 에 속했었다"는 'on' 취급한다). 'rel' 은
         * `relatedDimFactor` 를 켠 소비자가 공장까지 고른 경우에만 나온다 — 같은 공정의
         * 다른 공장이 눌린 네온으로 남는 FR-5 중간 계층. 전환의 양 끝(from/to)에 같은
         * 규칙을 적용해야 어느 쪽에서 왔든 같은 잣대로 섞인다. `belongsToFocused` 는
         * 호출부가 지번(지번 집합 조회)이냐 이름줄(이름 비교)이냐에 따라 다르게 판정해 넘긴다.
         */
        const classifyDim = (
          proc: string,
          belongsToFocused: boolean,
          ff: string | null,
          fp: string | null
        ): 'on' | 'rel' | 'dim' =>
          belongsToFocused || (!fp && !ff)
            ? 'on'
            : fp
              ? proc === fp
                ? relFactor != null && ff
                  ? 'rel'
                  : 'on'
                : 'dim'
              : 'dim'

        for (const lot of parcels.lots) {
          if (!intersects(lot.bounds, window_)) continue
          tracePolygon(lot.polygon)

          /* 무소속 지번 — 야드 실루엣만 아주 옅게 남긴다 (네온이 주인공이라 배경으로 물러난다) */
          if (lot.factory == null) {
            ctx.globalAlpha = 0.05
            ctx.fillStyle = theme === 'dark' ? '#8b8f96' : '#5b616b'
            ctx.fill()
            ctx.globalAlpha = 1
            strokeLotOutline()
            continue
          }

          /* 색은 지번 자체의 공정이 아니라 **소속 공장의 공정**으로 통일한다 (요구 1) */
          const proc = factoryProcess.get(lot.factory) ?? ''
          const color = processColor(proc)
          const hovered = hoverSet?.has(lot.lot) ?? false
          /*
           * 상태 결정 — 공장 선택과 공정 스포트라이트를 함께 쓸 수 있다.
           *  · 고른 공장 지번           → 'selected' (가장 강한 글로우)
           *  · 스포트라이트 공정과 같은 공장 → 'on' (네온, 도장 화면) 또는 'rel'
           *    (눌린 네온 — `relatedDimFactor` 를 켠 대시보드에서 공장까지 고른 경우:
           *    같은 공정이 연하게 남아 동일 공정이 어디인지 보인다, FR-5 중간 계층)
           *  · 그 외                     → 'dim'
           * 공정 스포트라이트 없이 공장만 고른 경우(공정을 모르는 공장)는 고른 공장만
           * 'selected', 나머지 'dim'.
           */
          const state: 'selected' | 'on' | 'rel' | 'dim' =
            focusedFactory && (focusSet?.has(lot.lot) ?? false)
              ? 'selected'
              : classifyDim(proc, false, focusedFactory, focusedProcess)

          /*
           * 선택 공장은 확실히 "빛난다" — 공정색 헤일로(여러 패스) + 두꺼운 채움 + 두꺼운 흰
           * 테두리. 줌인해도 shadowBlur 는 화면 px 라 반경이 유지된다 (요구 3).
           *
           * `progress` 로 헤일로·흰 테두리의 세기를 0→1 로 올린다 — 막 골랐을 때(작음)는
           * 평상시 'on' 룩에 가깝게, 자리잡으면(→1) 원래의 강한 글로우 그대로. 반경은 그대로
           * 두고 알파만 올리는 편이 "빛이 번지며 켜지는" 느낌에 가깝다. (골랐던 공장을
           * 해제할 때는 `state` 자체가 다음 렌더에 바로 'on'/'dim' 으로 바뀌어 이 분기를 벗어
           * 나므로, halo 는 즉시 사라진다 — 아래 on/dim 쪽의 양방향 페이드가 그 뒤를 잇는다.)
           */
          if (state === 'selected') {
            /* 3D 에서는 지번 낱장을 그리지 않는다 — 이 공장은 아래에서 껍질 한 동으로 선다.
             * 다만 구역 윤곽은 바닥에 연하게 남겨 지면의 구획이 2D 처럼 읽히게 한다 */
            if (tilted) {
              strokeLotOutline()
              continue
            }
            ctx.strokeStyle = color
            ctx.lineWidth = 3
            ctx.globalAlpha = 0.85 * progress
            if (progress > 0.02) {
              for (const b of [36, 22, 12]) {
                ctx.shadowColor = color
                ctx.shadowBlur = b
                ctx.stroke()
              }
            }
            ctx.globalAlpha = ON_FILL + (0.6 - ON_FILL) * progress
            ctx.fillStyle = color
            if (progress > 0.02) {
              for (const b of [26, 12]) {
                ctx.shadowColor = color
                ctx.shadowBlur = b
                ctx.fill()
              }
            } else {
              ctx.fill()
            }
            ctx.shadowBlur = 0
            ctx.globalAlpha = 1
            /*
             * 베이 묶음(그룹)에 든 지번은 여기서 낱장 테두리·상호작용을 그리지 않는다 —
             * 채움(네온)만 깔고, 외곽·이름·호버·눌림은 아래 그룹 패스가 **한 칸으로** 그린다.
             * 그렇지 않으면 한 베이 안에 지번 경계선이 남아 칸이 셋으로 쪼개져 보인다.
             */
            if (parcels.lotGroupOf.has(lot.lot)) continue
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2.4 * progress
            if (progress > 0.02) ctx.stroke()
            /* 베이 상호작용(2D) — 3D 지붕과 같은 문법: 호버는 흰 베일, 누르면 가라앉은
             * 채움 + 또렷한 흰 테두리(눌린 형태) */
            const pressed = lot.lot === parcels.selectedLot
            if (!pressed && lot.lot === parcels.hoveredLot) {
              ctx.globalAlpha = 0.14
              ctx.fillStyle = '#ffffff'
              ctx.fill()
            }
            if (pressed) {
              ctx.globalAlpha = 0.55
              ctx.fillStyle = shadeColor(color, 0.35)
              ctx.fill()
              ctx.globalAlpha = 0.95
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 1.8
              ctx.stroke()
            }
            ctx.globalAlpha = 1
            continue
          }

          /*
           * 스포트라이트 밖(dim). 기본은 **거의 검게**(0.0025) 가라앉혀 선택 공정과 대비를
           * 낸다(대시보드). `dimOpacity` 를 주면 그만큼 형상이 보이게 남긴다 — 도장 화면은
           * 타 공정 공장을 은은히(≈0.15) 보이게 해 공간 맥락을 읽게 한다. 이때 테두리도
           * 살짝 함께 올려 윤곽이 서게 한다.
           */
          const dimFill = parcels.dimOpacity ?? 0.05 * 0.05
          const dimStroke = parcels.dimOpacity != null ? Math.min(0.45, parcels.dimOpacity + 0.12) : 0.06
          const styleOf = (s: 'on' | 'rel' | 'dim') =>
            s === 'on'
              ? { fillA: ON_FILL, strokeA: ON_STROKE, glow: ON_GLOW }
              : s === 'rel'
                ? {
                    fillA: ON_FILL * (relFactor ?? 1),
                    strokeA: ON_STROKE * (relFactor ?? 1),
                    glow: ON_GLOW * (relFactor ?? 1),
                  }
                : { fillA: dimFill, strokeA: dimStroke, glow: 0 }
          /*
           * **양방향** 페이드: "이 지번이 `fromFocus` 였다면 어떤 스타일이었을지"(a)와 "지금
           * props 라면 어떤 스타일인지"(b, = `state`) 사이를 `progress` 로 섞는다. 스포트라이트에
           * 들어갈 때도(a='on'→b='dim', 어두워짐) 나갈 때도(a='dim'→b='on', 밝아짐) 같은 식이
           * 그대로 맞는다 — 진행률이 1(정착)이면 a 와 b 가 같은 focus 를 가리켜 값이 같아지므로
           * 기존 수치와 정확히 일치한다(회귀 없음).
           */
          const belongedToFromFactory = fromFocus.focusedFactory
            ? (parcels.factoryLotSet.get(fromFocus.focusedFactory)?.has(lot.lot) ?? false)
            : false
          const a = styleOf(
            classifyDim(proc, belongedToFromFactory, fromFocus.focusedFactory, fromFocus.focusedProcess)
          )
          const b = styleOf(state)
          let fillA = a.fillA + (b.fillA - a.fillA) * progress
          let strokeA = a.strokeA + (b.strokeA - a.strokeA) * progress
          let glow = a.glow + (b.glow - a.glow) * progress
          if (hovered) {
            /* dim 이라도 손이 얹히면 누를 수 있음을 살짝 알린다 */
            fillA = Math.min(0.5, fillA + (state === 'on' ? 0.14 : 0.1))
            strokeA = Math.max(strokeA, state === 'on' ? 0.95 : 0.35)
            glow = Math.max(glow, state === 'on' ? 14 : 6)
          }
          /* 2D 구역 윤곽 — dim 이라도 지번 경계는 이만큼은 남는다 */
          if (lotOutline != null) strokeA = Math.max(strokeA, lotOutline)

          /*
           * 3D 의 'on'/'rel' 지번은 낱장을 그리지 않는다 — 그 공장은 아래 공장 블록에서
           * 볼록 껍질 **한 동**으로 선다. 'dim' 은 기울여도 평면으로 남는다: 가라앉은
           * 것이 부피를 가지면 스포트라이트가 죽는다. 구역 윤곽만 바닥에 연하게 남긴다.
           */
          if (tilted && (state === 'on' || state === 'rel')) {
            strokeLotOutline()
            continue
          }

          if (glow > 0) {
            ctx.shadowColor = color
            ctx.shadowBlur = glow
          }
          ctx.globalAlpha = fillA
          ctx.fillStyle = color
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.globalAlpha = strokeA
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.1
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        /*
         * 2D — 고른 공장의 베이 묶음을 **한 칸씩** 얹는다. 위 지번 루프가 채움만 깔고
         * 넘긴 자리다: 여기서 그룹 외곽 하나와 이름, 호버·눌림을 그린다. (3D 는 이 그림이
         * 지붕 위로 올라가므로 아래 프리즘 블록이 같은 `drawBayCell` 로 다시 그린다.)
         */
        if (!tilted && focusedFactory && progress > 0.02) {
          const focusedColor = processColor(factoryProcess.get(focusedFactory) ?? '')
          for (const group of parcels.lotGroupShapes.values()) {
            if (!intersects(group.bounds, window_)) continue
            /* 고른 공장 밖의 그룹은 지금 그릴 자리가 아니다 — 그 공장은 낱장으로 남는다 */
            if (!(focusSet?.has(group.lotCodes[0]) ?? false)) continue
            /* 토막마다 한 칸 — 이름은 가장 큰 토막에만 얹는다 */
            group.polygons.forEach((polygon, index) => {
              drawBayCell(
                polygon,
                index === group.labelAt ? group.label : null,
                focusedColor,
                0,
                group.id === parcels.selectedLot,
                group.id === parcels.hoveredLot,
                progress
              )
            })
          }
        }

        /*
         * 2D — 목록이 짚은 지번 한 장을 **맨 위에** 얹는다. 칸(그룹) 그림 뒤에 그려야
         * 그룹 외곽선이 짚은 링을 덮지 않는다. (3D 는 지붕이 다 선 뒤 프리즘 블록 다음에
         * 같은 붓으로 그린다 — 그리는 자리만 다르고 문법은 하나다.)
         */
        if (!tilted && parcels.highlightedLot) {
          const polygon = parcels.lotPolygon.get(parcels.highlightedLot)
          if (polygon) {
            drawLotSpot([polygon.map((p) => at(p.lat, p.lon))], parcels.highlightedLot)
          }
        }

        /*
         * 3D — 스포트라이트 안('on'/'selected')의 공장을 **한 동**으로 세운다. 발자국은
         * 소속 지번 점 전체의 볼록 껍질(`factoryHull`): 지번 격자는 지붕 아래로 사라지고
         * 공장 하나가 건물 하나로 읽힌다. 상태·페이드는 어차피 공장 단위라 껍질로 옮겨도
         * 뜻이 같다 — 페이드 알파는 지번 루프와 같은 블렌드(ON_FILL↔dim)를 공장 단위로
         * 다시 셈해 **50% 채움**(지형이 비치는 모형)으로 정규화한다.
         */
        if (tilted) {
          const dimFill = parcels.dimOpacity ?? 0.05 * 0.05
          /* 상태별 목표 채움 — 'rel' 은 눌린 네온(FR-5 중간 계층)으로 선다 */
          const fillOf = (s: 'on' | 'rel' | 'dim') =>
            s === 'on' ? ON_FILL : s === 'rel' ? ON_FILL * (relFactor ?? 1) : dimFill
          /*
           * 스팬으로 나뉜 공장이 "고른 베이·손이 얹힌 베이"를 아는 길 — 선택 계약은
           * 드릴다운이 준 그룹 id 로 오가는데(`selectedLot`), 스팬은 그것을 모르므로
           * **지번코드가 겹치는지**로 잇는다. 조립에서는 그룹과 스팬이 같은 베이라 정확히 맞다.
           */
          const pressedGroup = parcels.selectedLot
            ? parcels.lotGroupShapes.get(parcels.selectedLot)
            : undefined
          const hoveredGroup = parcels.hoveredLot
            ? parcels.lotGroupShapes.get(parcels.hoveredLot)
            : undefined
          const spanStateOf = (span: BaySpanShape) => {
            const shares = (group: { lotCodes: string[] } | undefined) =>
              group != null && group.lotCodes.some((code) => span.lotCodes.includes(code))
            return { pressed: shares(pressedGroup), hovered: shares(hoveredGroup) }
          }
          for (const factory of parcels.factories) {
            const proc = factoryProcess.get(factory.name) ?? factory.process ?? ''
            const state: 'selected' | 'on' | 'rel' | 'dim' =
              focusedFactory === factory.name
                ? 'selected'
                : classifyDim(proc, false, focusedFactory, focusedProcess)
            if (state === 'dim') continue
            const hull = parcels.factoryHull.get(factory.name)
            if (!hull) continue
            const color = processColor(proc)
            /*
             * 칸 매핑이 있는 공장은 **지번 한 장을 한 칸**으로 나눠 세운다 — 프리즘 하나가
             * 곧 칸 하나이므로, 아래 그리기 루프의 깊이 정렬이 칸 단위로 이뤄져 앞 칸이
             * 뒷 칸을 가린다(여러 채가 붙어 선 공장이 그렇게 보인다).
             */
            const spans = parcels.baySpans.get(factory.name) ?? null
            const podium = parcels.podium.byFactory.get(factory.name)
            if (state === 'selected') {
              /* 바탕(채움)은 ~1/3 — 지도(지형)가 비쳐야 "지도 위의 모형"으로 남는다 */
              const alpha = 0.32
              if (podium) parcelPodiums.push({ rings: podium, color, alpha: 0.5 })
              if (spans) {
                for (const span of spans) {
                  parcelPrisms.push({
                    polygon: span.roof.outline,
                    color,
                    kind: 'selected',
                    alpha,
                    hovered: false,
                    progress,
                    factory: factory.name,
                    span,
                    /* 색조는 베이 순번으로 — 한 베이의 토막들이 같은 결로 선다 */
                    spanIndex: span.tintIndex,
                    spanState: spanStateOf(span),
                  })
                }
                continue
              }
              parcelPrisms.push({
                polygon: hull,
                color,
                kind: 'selected',
                alpha,
                hovered: false,
                progress,
                factory: factory.name,
              })
              continue
            }
            const fromState = classifyDim(
              proc,
              fromFocus.focusedFactory === factory.name,
              fromFocus.focusedFactory,
              fromFocus.focusedProcess
            )
            const fromFill = fillOf(fromState)
            const fillA = fromFill + (fillOf(state) - fromFill) * progress
            /* 바탕(채움) ~1/3 — 페이드 진행률만 여기에 실어 켜고 끈다 */
            const alpha = Math.min(0.34, (fillA / ON_FILL) * 0.32)
            const hovered = parcels.hoveredFactory === factory.name
            if (podium)
              parcelPodiums.push({ rings: podium, color, alpha: Math.min(0.5, alpha + 0.16) })
            if (spans) {
              for (const span of spans) {
                parcelPrisms.push({
                  polygon: span.roof.outline,
                  color,
                  kind: 'on',
                  alpha,
                  hovered,
                  progress: 1,
                  factory: factory.name,
                  span,
                  spanIndex: span.tintIndex,
                })
              }
              continue
            }
            parcelPrisms.push({
              polygon: hull,
              color,
              kind: 'on',
              alpha,
              hovered,
              progress: 1,
              factory: factory.name,
            })
          }
        }

        /* 공장 이름줄 — 흰 글자 + 공정색 후광(painting textShadow).
         * 3D 에서는 세운 지붕 **위에** 얹혀야 하므로 그리기를 프리즘 다음으로 미루고,
         * 앵커도 지붕 높이로 띄운다 — 바닥에 두면 자기 공장의 옆면에 가려진다. */
        const drawProcessLabels = () => {
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const labelAltitude = tilted ? RELIEF_METERS.parcel + 4 : 0
          for (const factory of parcels.factories) {
            if (!containsPoint(window_, factory.labelAnchor.lat, factory.labelAnchor.lon)) continue
            /*
             * 고른 공장이 이름 붙은 베이로 나뉘어 있으면 지붕의 글씨는 **베이가 가진다** —
             * 공장 이름줄은 지붕 한가운데라 베이 이름과 반드시 겹치고, 그 이름은 이미 옆
             * 상세 카드가 큰 글씨로 말하고 있다. 겹쳐 뭉갠 두 이름보다 베이 이름 하나가 낫다.
             * 떠 있는 라벨을 쓰는 화면(`floatingFocusedLabel`)에서는 베이가 없는 공장도
             * 마찬가지로 넘긴다 — 이름은 지붕 위로 떠올라 있고, 여기 남으면 두 벌이 된다.
             */
            if (
              factory.name === focusedFactory &&
              (parcels.floatingFocusedLabel || parcels.factoryHasBayGroups.has(factory.name))
            )
              continue
            const fp = factoryProcess.get(factory.name) ?? factory.process ?? ''
            const lstate: 'selected' | 'on' | 'rel' | 'dim' =
              focusedFactory && factory.name === focusedFactory
                ? 'selected'
                : classifyDim(fp, false, focusedFactory, focusedProcess)
            /*
             * 스포트라이트(공정·공장 선택) 밖의 라벨은 디밍만으로는 여전히 얼비쳐 선택 공정
             * 이름을 가리므로 결국 지운다 — 다만 **뚝 지우지 않고** 양방향으로 페이드한다.
             * 지번과 같은 `classifyDim` 잣대를 이름줄에도 적용해 "이 공장이 `fromFocus`
             * 였다면 보였을지"(a)와 "지금은 보이는지"(b)를 `progress` 로 섞는다 — 사라질
             * 때도(a='on'→b='dim') 나타날 때도(a='dim'→b='on') 대칭적으로 옅어지거나
             * 짙어진다. 안 보일 정도면 그리기 자체를 건너뛴다 — 그릴 이유가 없다.
             */
            const labelFrom = classifyDim(
              fp,
              fromFocus.focusedFactory === factory.name,
              fromFocus.focusedFactory,
              fromFocus.focusedProcess
            )
            const labelTo = lstate === 'selected' ? 'on' : lstate
            /* 'rel' 라벨은 지우지 않고 반쯤 남긴다 — 이름이 있어야 동일 공정을 찾아간다 */
            const alphaOf = (s: 'on' | 'rel' | 'dim') =>
              s === 'on' ? 1 : s === 'rel' ? REL_LABEL_ALPHA : 0
            const labelAlpha = alphaOf(labelFrom) + (alphaOf(labelTo) - alphaOf(labelFrom)) * progress
            if (labelAlpha <= 0.02) continue
            const { sx, sy } = at(factory.labelAnchor.lat, factory.labelAnchor.lon, labelAltitude)

            /*
             * 2.5D — 글씨를 지붕 평면에 **눕힌다**. 앵커에서 지면 방향 두 개를 투영해
             * 글자의 가로(baseline)·세로축으로 삼으면, 글씨가 지붕에 페인트로 쓴 것처럼
             * 원근을 따라 비스듬히 눕는다. 쓰는 방향은 **그 건물의 ↗쪽 대각선**
             * (`factoryAxis`) — 건물마다 제 발자국의 변을 따라, 왼쪽 아래에서 오른쪽
             * 위로 올라가며 읽힌다. 축을 모르는 공장만 북동 35° 를 쓴다.
             * 지면에 심어 두므로 카메라를 돌려도 함께 돈다. 세로축은 원근 축약비를 그대로
             * 쓰되 0.55 아래로는 누르지 않는다(그보다 눕히면 못 읽는다). 카메라를 돌려
             * 글씨가 뒤집히면(가로축이 왼쪽을 향하면) 180° 돌려 바로 세운다. 2D 는 기존
             * 그대로다.
             */
            let plane: [number, number, number, number] | null = null
            if (tilted) {
              const eps = 0.0004
              const axis = parcels.factoryAxis.get(factory.name)
              const be = axis?.be ?? Math.cos((35 * Math.PI) / 180)
              const bn = axis?.bn ?? Math.sin((35 * Math.PI) / 180)
              const pE = at(
                factory.labelAnchor.lat + eps * bn,
                factory.labelAnchor.lon + (eps * be) / LON_SQUEEZE,
                labelAltitude
              )
              const pS = at(
                factory.labelAnchor.lat - eps * be,
                factory.labelAnchor.lon + (eps * bn) / LON_SQUEEZE,
                labelAltitude
              )
              const eLen = Math.hypot(pE.sx - sx, pE.sy - sy) || 1
              const sLen = Math.hypot(pS.sx - sx, pS.sy - sy) || 1
              const k = Math.max(0.55, Math.min(1, sLen / eLen))
              plane = [
                (pE.sx - sx) / eLen,
                (pE.sy - sy) / eLen,
                ((pS.sx - sx) / sLen) * k,
                ((pS.sy - sy) / sLen) * k,
              ]
              if (plane[0] < 0) plane = [-plane[0], -plane[1], -plane[2], -plane[3]]
            }
            ctx.save()
            ctx.translate(sx, sy)
            if (plane) ctx.transform(plane[0], plane[1], plane[2], plane[3], 0, 0)

            /*
             * 이름줄 타이포 — 일괄 700 순백 대신 위계를 글자에 싣는다: 고른 공장만
             * 700/순백, 평시는 600에 반 톤 눌린 흰색 + 옅은 자간. 굵기·밝기·자간이
             * 함께 움직여야 "선택됨"이 크기만으로 소리치지 않는다.
             */
            const selected = lstate === 'selected'
            const size = selected ? 14 : 11.5
            ctx.font = `${selected ? 650 : 550} ${size}px ${CANVAS_SANS}`
            ctx.letterSpacing = selected ? '-0.2px' : '-0.1px'
            ctx.globalAlpha = labelAlpha

            /* 공정색 네온 대신 중성 글라스 플레이트로 지도와 라벨을 분리한다. */
            const textWidth = ctx.measureText(factory.name).width
            const padX = selected ? 9 : 7
            const plateHeight = selected ? 25 : 20
            const plateWidth = textWidth + padX * 2
            const plateX = -plateWidth / 2
            const plateY = -plateHeight / 2

            ctx.beginPath()
            ctx.roundRect(plateX, plateY, plateWidth, plateHeight, selected ? 8 : 6)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.38)'
            ctx.shadowBlur = selected ? 12 : 7
            ctx.shadowOffsetY = selected ? 4 : 2
            ctx.fillStyle = selected ? 'rgba(19, 25, 33, 0.82)' : 'rgba(19, 25, 33, 0.66)'
            ctx.fill()

            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
            ctx.shadowOffsetY = 0
            ctx.strokeStyle = selected ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.18)'
            ctx.lineWidth = selected ? 1 : 0.75
            ctx.stroke()

            /* 상단의 가는 반사광이 유리 표면의 깊이만 만들고 글자는 발광시키지 않는다. */
            ctx.beginPath()
            ctx.moveTo(plateX + 6, plateY + 1)
            ctx.lineTo(plateX + plateWidth - 6, plateY + 1)
            ctx.strokeStyle = selected ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.13)'
            ctx.lineWidth = 0.75
            ctx.stroke()

            ctx.fillStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.9)'
            ctx.fillText(factory.name, 0, 0)
            ctx.restore()
          }
          ctx.globalAlpha = 1
        }
        if (parcels.showLabels) {
          if (tilted) deferredParcelLabels = drawProcessLabels
          else drawProcessLabels()
        }
      } else {
        /* ── 분류색 모드 (기존, 도장 화면·야드 룩) ── */
        const neon = parcels.focusedFactory != null
        const focusSet = neon
          ? parcels.factoryLotSet.get(parcels.focusedFactory ?? '') ?? null
          : null
        const baseOpacity = parcels.opacity

        for (const lot of parcels.lots) {
          if (!intersects(lot.bounds, window_)) continue
          const color = parcels.categoryColor(lot.category)
          const focused = !neon || (focusSet?.has(lot.lot) ?? false)
          const hovered = hoverSet?.has(lot.lot) ?? false

          tracePolygon(lot.polygon)

          if (focused && (neon || hovered)) {
            ctx.shadowColor = color
            ctx.shadowBlur = hovered ? 18 : 12
          }
          ctx.globalAlpha = focused
            ? hovered
              ? Math.min(0.9, baseOpacity + 0.2)
              : baseOpacity
            : baseOpacity * 0.12
          ctx.fillStyle = color
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.globalAlpha = focused ? 0.9 : 0.15
          ctx.strokeStyle = color
          ctx.lineWidth = focused && (neon || hovered) ? 1.8 : 1
          ctx.stroke()
          ctx.globalAlpha = 1
        }

        /* 공장 이름줄 — 어두운/밝은 후광 한 겹. focus 중이면 고른 공장만 또렷하다. */
        if (parcels.showLabels) {
          ctx.font = `600 11px ${CANVAS_SANS}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineJoin = 'round'
          for (const factory of parcels.factories) {
            if (!containsPoint(window_, factory.labelAnchor.lat, factory.labelAnchor.lon)) continue
            const dim = neon && factory.name !== parcels.focusedFactory
            const { sx, sy } = at(factory.labelAnchor.lat, factory.labelAnchor.lon)
            ctx.globalAlpha = dim ? 0.32 : 1
            ctx.lineWidth = 3
            ctx.strokeStyle = palette.bayOutline
            ctx.strokeText(factory.name, sx, sy)
            ctx.fillStyle = palette.label
            ctx.fillText(factory.name, sx, sy)
          }
          ctx.globalAlpha = 1
          ctx.lineJoin = 'miter'
        }
      }
    }

    // ── 건물 세우기 (3D 에서만) ──
    /*
     * 뒤에서부터 그린다 — 앞 건물이 뒷 건물을 가려야 어느 쪽이 가까운지 읽힌다.
     * 깊이는 링의 첫 꼭짓점 하나로 대신한다: 건물 하나는 화면에서 수십 px 이라,
     * 꼭짓점마다 재도 정렬 결과가 달라지지 않는다.
     */
    if (tilted) {
      const style = BUILDING_EXTRUDE[theme]
      /*
       * 베이 스팬으로 세우는 공장의 건물은 여기서 빼 둔다 — 회색으로 서면 우리 모형과
       * 겹쳐 어긋난 것처럼 보인다. 그 링은 아래에서 **공정색 기단**으로 다시 선다.
       */
      const claimed = current.parcels?.podium.claimed ?? null
      for (const layer of standing) {
        const ringBounds = ringBoundsOf(layer)
        const visible: { ring: Ring; depth: number }[] = []
        /*
         * LOD — 화면에서 작은 건물은 세워도 부피가 안 보인다. 벽 4~10면 대신 지붕색
         * 발자국 하나로 줄인다. 건물이 상시 켜진 화면(대시보드)에서는 먼 시가지 수천
         * 동이 이 분기로 빠져, 세우는 것은 가까운 것들뿐이다.
         */
        ctx.fillStyle = style.roof
        /*
         * 카메라가 도는 동안에는 그 문턱을 올린다 — 세우는 채수가 절반 아래로 떨어져
         * 프레임이 가벼워지고, 멈추는 순간(`markMoving` 의 마무리 그리기) 제 모습으로
         * 돌아온다. 움직이는 화면에서 먼 시가지 건물의 부피는 어차피 읽히지 않는다.
         */
        const lodPx = movingRef.current ? BUILDING_LOD_MOVING_PX : BUILDING_LOD_PX
        for (let r = 0; r < layer.rings.length; r++) {
          const ring = layer.rings[r]
          if (ring.length < 3 || !intersects(ringBounds[r], window_)) continue
          if (claimed?.has(ring)) continue
          const b = ringBounds[r]
          const p1 = at(b.minLat, b.minLon)
          const p2 = at(b.maxLat, b.maxLon)
          if (Math.abs(p2.sx - p1.sx) + Math.abs(p1.sy - p2.sy) < lodPx) {
            traceRing(ring)
            ctx.closePath()
            ctx.fill()
            continue
          }
          visible.push({ ring, depth: project(view, viewport, ring[0][1], ring[0][0]).depth })
        }
        visible.sort((a, b) => b.depth - a.depth)

        /*
         * 시가지 건물은 **다가섰을 때만** 면마다 해를 잰다. 대문 카메라에서는 한 화면에
         * 수백 채가 서므로 벽을 가르면 그만큼 캔버스 호출이 늘고(위 `drawPrism` 주석의
         * 11ms), 그 크기에서는 어차피 면이 몇 px 이라 갈라도 보이지 않는다. 배율이 오르면
         * 세우는 채수가 뷰포트 컬링으로 줄고, 그때부터 벽 하나하나가 형태를 말한다.
         */
        const litBuildings = view.scale >= BAY_GABLE_SCALE.massed && !movingRef.current
        for (const { ring } of visible) {
          const world = ring.map(([lon, lat]) => ({ lat, lon }))
          const base = ring.map(([lon, lat]) => at(lat, lon))
          const top = ring.map(([lon, lat]) => at(lat, lon, RELIEF_METERS.building))
          drawPrism(world, base, top, style, litBuildings)
        }
      }
    }

    // ── 공정색 지번 세우기 (3D · process 모드에서만) ──
    /*
     * 스포트라이트 안의 공장 지번을 **실제 건물처럼** 세운다: 지붕은 공정색, 옆면은 같은
     * 색을 어둡게 누른 명도 단계(빛은 위에서 온다) — OSM 건물 압출과 같은 조명 규칙이라
     * 지도 위에 이질감 없이 선다. 발광은 상태 신호로만 남긴다: 고른 공장의 흰 테두리와
     * 호버의 옅은 글로우. 건물 **다음에** 그린다 — 공장 지번이 곧 그 건물의 자리라,
     * 회색 OSM 지붕이 그 위에 남으면 이중으로 보인다. 깊이 정렬은 건물과 같은 규칙
     * (폴리곤 첫 꼭짓점 하나)이고, 히트 테스트는 정반과 같이 지면 기준이다.
     */
    if (tilted && parcelPrisms.length > 0) {
      /*
       * ── 그림자 ── 세운 것이 지면에 눕는 자리.
       *
       * 면마다 밝기를 갈라도 건물은 여전히 **지도 위에 떠 보인다** — 물체를 지면에 못
       * 박는 것은 그림자 하나뿐이라서다. 발자국을 해 반대쪽으로 `높이 ÷ tan(고도)` 만큼
       * 민 것이 그 자리이며(`shadowOffset`), 발자국 자신과 함께 한 경로에 담아 **한 번만**
       * 칠한다: 베이마다 따로 칠하면 겹친 자리가 두 배로 어두워져 공장 안에 없는 격자가
       * 생기고, 한 경로에 감김을 맞춰 담으면 nonzero 규칙이 그것을 합집합으로 메운다.
       */
      const shadowShift = shadowOffset(RELIEF_METERS.parcel)
      const shadowPath = new Path2D()
      let shadowAlpha = 0
      const addShadow = (polygon: readonly LatLon[], alpha: number) => {
        if (polygon.length < 3 || !intersects(boundsOf(polygon), window_)) return
        const ordered = isCounterClockwise(polygon) ? polygon : [...polygon].reverse()
        /* 발자국과 밀어 놓은 복사본 둘 — 겹치므로 합치면 실루엣 하나가 된다 */
        for (const shift of [0, 1]) {
          for (let i = 0; i < ordered.length; i++) {
            const p = ordered[i]
            const s = at(p.lat + shift * shadowShift.dLat, p.lon + shift * shadowShift.dLon)
            if (i === 0) shadowPath.moveTo(s.sx, s.sy)
            else shadowPath.lineTo(s.sx, s.sy)
          }
          shadowPath.closePath()
        }
        if (alpha > shadowAlpha) shadowAlpha = alpha
      }
      for (const prism of parcelPrisms) {
        addShadow(prism.span ? prism.span.roof.outline : prism.polygon, prism.alpha)
      }
      for (const podium of parcelPodiums) {
        for (const ring of podium.rings) {
          addShadow(
            ring.map(([lon, lat]) => ({ lat, lon })),
            podium.alpha
          )
        }
      }
      if (shadowAlpha > 0.02) {
        /* 스포트라이트가 켜지는 만큼 그림자도 함께 짙어진다 — 건물만 먼저 서면 떠 보인다 */
        ctx.globalAlpha = Math.min(1, shadowAlpha * 1.4)
        ctx.fillStyle = SHADOW_FILL[theme]
        ctx.fill(shadowPath)
        ctx.globalAlpha = 1
      }

      /*
       * ── 공장 기단 ── 회색 건물 층에서 뺀 OSM 발자국을 공정색으로 낮게 세운다.
       * 스팬보다 먼저·낮게 서서, 베이 사이 틈이 허공이 아니라 **공장 바닥**으로 읽힌다.
       */
      const podiumHeight = RELIEF_METERS.parcel * FACTORY_PODIUM.heightFactor
      for (const podium of parcelPodiums) {
        for (const ring of podium.rings) {
          if (ring.length < 3) continue
          const world = ring.map(([lon, lat]) => ({ lat, lon }))
          const base = ring.map(([lon, lat]) => at(lat, lon))
          const top = ring.map(([lon, lat]) => at(lat, lon, podiumHeight))
          ctx.globalAlpha = podium.alpha
          /* 스팬(0.6~1.05)보다 확실히 눌러 둔다 — 베이 사이 틈이 그늘로 읽혀야 갈라 보인다 */
          drawPrism(
            world,
            base,
            top,
            {
              wall: shadeColor(podium.color, 0.2),
              wallEdge: shadeColor(podium.color, 0.16),
              roof: shadeColor(podium.color, 0.3),
              roofEdge: shadeColor(podium.color, 0.52),
            },
            true
          )
          ctx.globalAlpha = 1
        }
      }

      /** 스팬 지붕 위 이름 — 건물을 다 세운 뒤에 얹는다(앞 스팬에 가려지지 않게) */
      const spanLabels: { at: ScreenPoint; label: string; alpha: number; strong: boolean }[] = []
      /** 고른 베이의 지붕에 눕혀 새길 지번 이름 — 지붕 면을 따라 기운 2×2 행렬과 함께 */
      const roofLotLabels: {
        at: ScreenPoint
        plane: [number, number, number, number]
        text: string
        alpha: number
      }[] = []
      /**
       * 목록이 짚은 지번(`highlightedLot`)의 지붕 조각 — 스팬을 그리며 모아 두었다가
       * 건물이 다 선 뒤에 얹는다. 조각이 여럿인 것은 한 지번이 용마루로 갈린 경우다.
       */
      const highlightPatches: ScreenPoint[][] = []

      const sorted = parcelPrisms
        .filter((p) => intersects(boundsOf(p.polygon), window_))
        .map((p) => ({
          ...p,
          /* 베이는 맞닿아 서로를 가리므로 첫 꼭짓점이 아니라 **중심**으로 잰다 */
          depth: p.span
            ? project(view, viewport, p.span.center.lat, p.span.center.lon).depth
            : project(view, viewport, p.polygon[0].lat, p.polygon[0].lon).depth,
        }))
        .sort((a, b) => b.depth - a.depth)

      /**
       * 박공이 선 정도(0~1) — **카메라 거리 하나**로 정한다 (`BAY_GABLE_SCALE`).
       *
       * 0이면 공장은 평지붕 한 덩어리, 1이면 베이마다 박공이 선 공장동이다. 그 사이는
       * 자라는 중이라, 확대하는 손짓을 따라 지붕이 솟고 축소하면 도로 눕는다 — 단이
       * 지지 않아야 같은 건물이 가까워진 것으로 읽힌다. 한 프레임에 한 번만 잰다.
       */
      const gable = Math.max(
        0,
        Math.min(
          1,
          (view.scale - BAY_GABLE_SCALE.massed) /
            (BAY_GABLE_SCALE.gabled - BAY_GABLE_SCALE.massed)
        )
      )

      /**
       * 같은 공장에서 맞닿은 베이는 **한 면**으로 다룬다 — 그 판단의 근거가 여기 모인다.
       *
       * 베이 외곽선을 공장별로 모아 두면, 두 번 나온 변은 두 베이가 맞물린 **안쪽 이음매**이고
       * 한 번만 나온 변은 공장의 바깥 실루엣이다. 이 구분 하나로 세 가지가 정해진다:
       * 안쪽 벽은 세우지 않고, 지붕은 공장 하나를 한 번에 칠하고, 테두리는 실루엣만 두른다.
       */
      const bayFences = new Map<
        string,
        {
          color: string
          height: number
          /** 지붕 한 면을 칠할 투명도의 바탕 — 스팬마다 같으므로 하나만 들고 있으면 된다 */
          alpha: number
          /** 이 공장에 고른/얹힌 베이가 있나 — 지붕 한 면에 실을 후광의 세기 */
          glow: number
          edges: Map<string, BoundaryEdge>
        }
      >()
      /*
       * **그리기 전에** 센다. 그리는 도중에 세면 아직 그리지 않은 이웃 베이를 알 수 없어,
       * 지금 세우는 벽이 안쪽인지 바깥인지 판단할 수가 없다.
       */
      for (const prism of sorted) {
        const { span } = prism
        if (!span) continue
        const grow = prism.kind === 'selected' ? 1.15 : 1
        const eaveH = RELIEF_METERS.parcel * (1 + (BAY_ROOF.eaveFactor * grow - 1) * gable)
        const glow =
          prism.kind === 'selected' && prism.progress > 0.02
            ? 14 * prism.progress
            : prism.hovered || prism.spanState?.hovered
              ? 8
              : 0
        let acc = bayFences.get(prism.factory)
        if (!acc) {
          acc = { color: prism.color, height: eaveH, alpha: prism.alpha, glow, edges: new Map() }
          bayFences.set(prism.factory, acc)
        } else if (glow > acc.glow) acc.glow = glow
        for (let i = 0; i < span.roof.outline.length; i++) {
          const a = span.roof.outline[i]
          const b = span.roof.outline[(i + 1) % span.roof.outline.length]
          const ka = vertexKey(a)
          const kb = vertexKey(b)
          const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
          const seen = acc.edges.get(key)
          if (seen) seen.count++
          else acc.edges.set(key, { a, b, ka, kb, count: 1 })
        }
      }

      /**
       * 지붕을 한 면으로 칠할 수 있는가 — 평지붕(덩어리)일 때만이다.
       *
       * 박공이 서면 베이마다 면의 기울기가 달라 한 장으로 칠할 수 없고, 그때는 그 선이 곧
       * 구획선이라 이음매가 보이는 편이 맞다.
       */
      const massedRoof = gable <= 0

      for (const prism of sorted) {
        /* 고른 공장은 살짝 더 높다 — 색·테두리에 더해 실루엣으로도 "이것"이라고 말한다 */
        const height =
          prism.kind === 'selected' ? RELIEF_METERS.parcel * 1.4 : RELIEF_METERS.parcel
        const base = prism.polygon.map((p) => at(p.lat, p.lon))
        const top = prism.polygon.map((p) => at(p.lat, p.lon, height))
        /* 호버는 도색이 한 단 밝아진다 — 누를 수 있음을 색으로 말한다 */
        const lift = prism.hovered || prism.spanState?.hovered ? 1.18 : 1
        const roofColor = shadeColor(prism.color, 0.88 * lift * FLAT_ROOF_LIGHT)
        const roofEdge = shadeColor(prism.color, 1.22 * lift)
        const wallEdge = shadeColor(prism.color, 0.38)

        /*
         * ── 베이(박공 지붕 한 채) ── 평지붕 한 덩어리 대신 **베이 하나**를 세운다.
         *
         * 발자국이 소속 지번을 합친 그대로라 벽이 지면의 2D 지번선과 정확히 겹친다.
         * 높이는 하나의 규칙(`ridgeRatio`)으로 정해진다: 용마루선에서 멀수록 낮다. 벽
         * 꼭대기도 같은 규칙을 쓰므로 짧은 끝에서 벽이 용마루까지 솟아 **박공 삼각형이
         * 저절로** 생긴다 — 삼각형을 따로 그리지 않는다.
         *
         * 지붕은 스팬을 따라 **한 장으로 이어지고**, 그 위의 지번 경계는 구획(patch)마다
         * 그은 선이 말한다. 색은 **베이 하나에 하나** — 이웃 베이와만 결이 다르다(같은
         * 공정색 안에서 명도만). 칸마다 색을 달리하면 한 베이가 여러 채로 쪼개져 보인다.
         */
        if (prism.span) {
          const { roof } = prism.span
          /**
           * ── 덩어리(massed) ── 멀리 선 공장은 **한 채**로 선다 (`gable` 참조).
           *
           * 무엇으로 가르는지가 요점이다: **고른 공장이냐가 아니라 얼마나 가까우냐**다.
           * 대문 카메라에서는 고르지 않은 공장도 고른 공장도 다 덩어리고, 카메라가 다가와
           * 베이 한 칸이 읽히는 배율이 되면 그때 다 함께 박공으로 갈린다. 선택으로 가르면
           * 같은 거리에 선 이웃 공장이 서로 다른 모습으로 서서 그 차이가 "고름"이 아니라
           * "다른 종류의 건물"로 읽힌다.
           */
          const grow = prism.kind === 'selected' ? 1.15 : 1
          /* 덩어리는 지번 높이(`parcel`) 그대로 — 박공이 없으니 처마로 낮출 이유가 없다.
             박공이 자라는 동안(0<gable<1) 처마도 함께 제자리를 찾아간다 */
          const eaveH = RELIEF_METERS.parcel * (1 + (BAY_ROOF.eaveFactor * grow - 1) * gable)
          const riseH = roof.rise * grow * gable
          const pressed = prism.spanState?.pressed ?? false
          /** 이 베이의 색조 — 베이 하나에 하나. 이웃 베이와만 결이 다르다.
           *  덩어리로 설 때는 하나(1)이고, 박공이 자라는 동안 제 색조로 갈라진다 */
          const tint =
            1 +
            (BAY_ROOF.bayTints[(prism.spanIndex ?? 0) % BAY_ROOF.bayTints.length] - 1) * gable
          /** 그 점의 실제 고도 — 처마에서 용마루까지 `ridgeRatio` 로 잇는다 */
          const lift3d = (p: LatLon) => at(p.lat, p.lon, eaveH + riseH * roof.ridgeRatio(p))

          const ground = roof.outline.map((p) => at(p.lat, p.lon))
          const wallTop = roof.outline.map(lift3d)
          /* 이 변이 같은 공장의 옆 베이와 맞물린 안쪽 이음매인가 */
          const seamEdges = bayFences.get(prism.factory)?.edges
          const isSeam = (a: LatLon, b: LatLon) => {
            const ka = vertexKey(a)
            const kb = vertexKey(b)
            const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
            return (seamEdges?.get(key)?.count ?? 1) > 1
          }

          /* 눌린 베이는 도색이 가라앉는다 — 색만으로 "이것을 골랐다"가 되게 */
          const faceK = (k: number) => (pressed ? k * 0.62 : k) * lift * tint
          const face = (k: number) => shadeColor(prism.color, faceK(k))

          ctx.globalAlpha = prism.alpha
          /*
           * 벽 — 옆면 전부. 뒷벽은 뒤이어 그리는 지붕·앞벽이 덮는다.
           *
           * 면마다 해를 따로 재고(`lighting.ts`), 같은 밝기끼리 한 경로에 모아 칠한다.
           * 이 한 가지가 스팬을 "누운 판"에서 "선 건물"로 바꾼다 — 네 벽이 같은 색이면
           * 모서리가 색으로 드러나지 않아, 아무리 높이 세워도 접힌 종이로 보인다.
           *
           * 덩어리로 설 때 **안쪽 벽은 세우지 않는다** — 맞닿은 두 베이 사이에는 실제로
           * 벽이 없다(한 채의 속이다). 반투명한 지붕 아래로 그 벽이 비쳐 표면에 줄로
           * 남던 것이 그 조각들이다. 박공이 서면 골이 생겨 실제로 벽이 보이므로 그때는
           * 그대로 세운다.
           */
          const footY = meanY(ground)
          const headY = meanY(wallTop)
          ctx.strokeStyle = shadeColor(prism.color, 0.34)
          ctx.lineWidth = 0.6
          for (const bin of litWallPaths(roof.outline, ground, wallTop, (i, j) =>
            massedRoof ? isSeam(roof.outline[i], roof.outline[j]) : false
          )) {
            ctx.fillStyle = wallPaint(prism.color, faceK(0.5 * bin.light), footY, headY)
            ctx.fill(bin.path)
            ctx.stroke(bin.path)
          }

          /*
           * 지붕 — 용마루로 갈린 두 면을 지번 구획으로 잘게 나눠 그린다. 구획은 같은
           * 지붕면 위에 있어 이어 그리면 한 장으로 보이고, 구획마다 그은 선이 곧 지번
           * 경계다. 처마가 용마루보다 화면 아래인 쪽이 카메라를 향한 앞면이라 뒤쪽부터
           * 그려 앞면이 덮게 한다(캔버스에는 깊이 버퍼가 없다).
           */
          const ridge = roof.ridge.map(lift3d)
          const patches = roof.patches.map((patch) => {
            const screen = patch.polygon.map(lift3d)
            return {
              patch,
              screen,
              midY: screen.reduce((sum, p) => sum + p.sy, 0) / (screen.length || 1),
            }
          })
          /*
           * 앞면은 **용마루 한쪽 전체**로 정한다 — 조각 하나를 용마루 중점과 견주면,
           * 화면에서 비스듬히 누운 긴 베이의 끝 조각이 반대쪽으로 뒤집혀 한 베이 안에서
           * 색이 튄다. 베이 하나는 한 색이어야 하므로 판정도 베이 단위여야 한다.
           */
          const sideMeanY = ([0, 1] as const).map((side) => {
            const own = patches.filter((item) => item.patch.side === side)
            return own.length === 0
              ? -Infinity
              : own.reduce((sum, item) => sum + item.midY, 0) / own.length
          })
          const nearSide = sideMeanY[1] > sideMeanY[0] ? 1 : 0
          /*
           * 두 지붕면의 밝기 — **해가 정한다**(그리는 순서만 카메라가 정한다).
           *
           * 예전에는 카메라를 향한 면을 어둡게 칠했는데, 그러면 지도를 돌려도 늘 앞면이
           * 그늘이라 빛이 관찰자를 따라다닌다 — 도는 것이 건물처럼 보이는 이유였다. 면의
           * 기울기(`slopeTan`)는 지금 실제로 세워진 높이에서 그대로 나오므로, 덩어리로
           * 누워 있을 때(riseH=0)는 두 면이 저절로 같은 평지붕 밝기가 된다.
           */
          const cross = { x: -roof.axis.y, y: roof.axis.x }
          const slopeTan = roof.width > 0 ? riseH / (roof.width / 2) : 0
          const slopeLight = [
            slopeLightOf({ x: -cross.x, y: -cross.y }, slopeTan),
            slopeLightOf(cross, slopeTan),
          ]
          /**
           * 지붕면 하나에 걸치는 결 — **처마가 어둡고 용마루가 밝다**.
           *
           * 벽의 발치를 눌러 둔 것과 같은 이유다: 한 면이 한 색이면 넓은 지붕은 색종이가
           * 되고, 면 안에서 밝기가 흐르면 그 면이 **기울어 있다**는 것이 보인다. 처마 쪽이
           * 어두운 것은 실제로도 그렇다 — 골에 가까울수록 하늘이 덜 보인다.
           *
           * 축은 용마루 가운데에서 처마 가운데로 긋는다(둘 다 지붕면 위의 점이라, 카메라가
           * 어디에 있든 화면에서 그 면을 가로지른다).
           */
          const ridgeMid = {
            lat: (roof.ridge[0].lat + roof.ridge[1].lat) / 2,
            lon: (roof.ridge[0].lon + roof.ridge[1].lon) / 2,
          }
          const halfWidthDeg = roof.width / 2 / 111_320
          const slopePaint = ([0, 1] as const).map((side) => {
            if (!softShading) return face(0.88 * slopeLight[side])
            const away = side === 1 ? 1 : -1
            const eave = at(
              ridgeMid.lat + away * cross.y * halfWidthDeg,
              ridgeMid.lon + (away * cross.x * halfWidthDeg) / LON_SQUEEZE,
              eaveH
            )
            const crest = at(ridgeMid.lat, ridgeMid.lon, eaveH + riseH)
            const base = 0.88 * slopeLight[side]
            if (Math.hypot(crest.sx - eave.sx, crest.sy - eave.sy) < 1) return face(base)
            const g = ctx.createLinearGradient(eave.sx, eave.sy, crest.sx, crest.sy)
            g.addColorStop(0, face(base * 0.84))
            g.addColorStop(1, face(base * 1.08))
            return g
          })
          /* 지붕은 벽보다 조금 진하되 **여전히 비친다** — 지면이 비쳐야 채도가 눌린다.
             다만 다가가 박공이 설수록 불투명해진다: 그 거리에서 지면이 지붕을 뚫고 비치면
             부피가 도로 사라져, 애써 세운 면들이 색유리처럼 읽힌다 */
          const roofAlpha = Math.min(1, prism.alpha + 0.06 + 0.24 * gable)
          ctx.globalAlpha = roofAlpha
          const isNear = (item: (typeof patches)[number]) => item.patch.side === nearSide
          /*
           * 덩어리로 설 때 지붕은 **공장 한 면**으로 칠한다 — 여기서는 칠하지 않고, 프리즘을
           * 다 세운 뒤 실루엣 안쪽을 한 번에 칠한다. 반투명한 면을 조각내 칠하면 맞닿은
           * 자리가 두 번 겹쳐 그 선이 표면에 남기 때문이다(같은 색으로 덮어도 덮개가 곧
           * 두 번째 겹이다). 맞닿은 베이는 한 면이므로, 칠하는 단위도 공장이어야 한다.
           */
          for (const item of [...patches].sort((a, b) => Number(isNear(a)) - Number(isNear(b)))) {
            if (item.screen.length < 3) continue
            /* 짚은 지번의 조각은 자리만 기억해 둔다 — 앞 스팬에 가리지 않게 맨 뒤에 그린다 */
            if (parcels && item.patch.lot === parcels.highlightedLot) {
              highlightPatches.push(item.screen)
            }
            /* 한 장으로 칠했으면 구획을 다시 칠하지 않는다 (자리만 기억하고 넘어간다) */
            if (massedRoof) continue
            traceScreen(item.screen)
            ctx.closePath()
            if (prism.kind === 'selected' && prism.progress > 0.02) {
              ctx.shadowColor = prism.color
              ctx.shadowBlur = 14 * prism.progress
            } else if (lift > 1) {
              ctx.shadowColor = prism.color
              ctx.shadowBlur = 8
            }
            /* 밝기는 그 면이 해를 얼마나 보는가로 정한다 — 베이 색조는 `face` 안에서
               이미 실린다. 덩어리 지붕은 평평해서 두 면이 같은 값을 받는다 */
            ctx.fillStyle = slopePaint[item.patch.side]
            ctx.fill()
            ctx.shadowBlur = 0
            /*
             * 채운 색 그대로 한 번 두른다 — 맞닿은 두 구획이 안티에일리어싱으로 남기는
             * 실낱 틈을 덮어, 덩어리로 설 때 지붕이 한 장으로 이어진다.
             */
            ctx.strokeStyle = ctx.fillStyle
            ctx.lineWidth = 1
            ctx.stroke()
            /*
             * 구획선(지번 경계) — **박공과 함께 짙어진다.** 지붕면 테두리는 어둡다: 밝게
             * 두면 처마선(베이 사이의 골)이 용마루와 같은 굵기로 빛나 톱니가 사라진다.
             * 골은 그늘이어야 한다. 덩어리로 설 때(gable=0)는 아예 긋지 않는다 — 그
             * 거리에서 세는 단위는 공장이고, 칸 선은 한 채를 여러 채로 도로 갈라 놓는다.
             */
            if (gable > 0) {
              ctx.globalAlpha = roofAlpha * gable
              ctx.strokeStyle = shadeColor(prism.color, 0.4)
              ctx.lineWidth = 0.9
              ctx.stroke()
              ctx.globalAlpha = roofAlpha
            }
          }

          if (gable > 0) {
            /* 용마루 — 능선 한 줄. 여기가 밝아야 두 면이 갈라져 지붕으로 읽힌다.
               구획선과 마찬가지로 박공이 자라는 만큼 짙어진다 */
            ctx.globalAlpha = Math.min(1, prism.alpha + 0.5) * gable
            ctx.strokeStyle = shadeColor(prism.color, 1.35)
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(ridge[0].sx, ridge[0].sy)
            ctx.lineTo(ridge[1].sx, ridge[1].sy)
            ctx.stroke()
          }

          /*
           * ── 베이 윤곽 ── 채움을 눌러 둔 만큼 윤곽이 형태를 말한다. 다만 여기는 **베이**
           * 한 칸이라 공장 테두리보다 한 단 낮고, **박공과 함께 나타난다**(`gable`).
           *
           * 멀리서 세는 단위는 공장이다 — 그 거리에서 베이 선을 다 그으면 지붕이 격자로
           * 덮여, 한 채를 두르는 테두리가 그 안에 묻힌다. 다가가 베이 한 칸이 읽히는
           * 배율이 되어야 칸 선이 뜻을 갖는다(공장 테두리는 정확히 그 반대로 옅어진다).
           *
           * 선은 **어둡다** — 이 선이 놓이는 자리는 이웃 베이와 맞물린 처마, 곧 지붕의
           * 골(谷)이다. 골은 두 지붕이 만나 하늘이 가장 안 보이는 자리라 밝을 수가 없고,
           * 밝게 그으면 용마루(밝은 능선)와 같은 선이 되어 골과 마루가 구별되지 않는다 —
           * 톱니가 사라지고 지붕이 줄무늬 판으로 읽히던 것이 그 때문이다.
           */
          if (gable > 0) {
            ctx.globalAlpha = Math.min(1, prism.alpha + 0.18) * gable
            ctx.strokeStyle = shadeColor(prism.color, 0.46 * lift)
            ctx.lineWidth = 1.1
            traceScreen(wallTop)
            ctx.closePath()
            ctx.stroke()
          }

          /* 고른 베이는 흰 윤곽 — 처마를 따라 지붕 바깥선을 한 바퀴 두른다 */
          if (pressed) {
            ctx.globalAlpha = 1
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1.8
            traceScreen(wallTop)
            ctx.closePath()
            ctx.stroke()
          }
          ctx.globalAlpha = 1

          /*
           * 고른 베이의 지붕에 **지번 이름**을 눕혀 새긴다 (레퍼런스: 지붕에 페인트로 쓴
           * 글씨). 자리는 그 칸의 지붕 조각 중심, 방향은 **용마루 축**이라 글씨가 스팬을
           * 따라 흐른다. 눕히는 법은 공장 이름줄과 같다: 앵커에서 지붕 위 두 방향을
           * 투영해 글자의 가로·세로축으로 삼으면 원근을 따라 비스듬히 눕는다.
           */
          if (pressed && prism.span.lotLabels) {
            const uAxis = roof.axis
            /*
             * 세로축은 용마루 축을 **-90°** 돌린 쪽이다. 화면의 y 는 아래로 가는데 위도는
             * 위로 가서, 반대쪽(+90°)을 고르면 기저의 방향이 뒤집혀 글씨가 거울상이 된다
             * (공장 이름줄이 `pS` 를 잡는 방식과 같은 이유).
             */
            const nAxis = { x: uAxis.y, y: -uAxis.x }
            /* 축 방향으로 살짝 옮긴 점 — 지붕 면 위의 기저를 재는 자 */
            const eps = 0.0002
            const step = (p: LatLon, a: { x: number; y: number }): LatLon => ({
              lat: p.lat + eps * a.y,
              lon: p.lon + (eps * a.x) / LON_SQUEEZE,
            })
            const byLot = new Map<string, LatLon[]>()
            for (const patch of roof.patches) {
              const list = byLot.get(patch.lot)
              if (list) list.push(...patch.polygon)
              else byLot.set(patch.lot, [...patch.polygon])
            }
            /*
             * 글씨는 용마루가 아니라 **카메라를 향한 지붕면**에 쓴다. 용마루 위에 쓰면
             * 스팬 이름 칩(`1BAY`)과 겹치고, 능선에 걸쳐 반은 앞면 반은 뒷면에 놓인다.
             * 앞면 한가운데로 내리면 두 글씨가 갈리고 실제 지붕 도장처럼 보인다.
             */
            const halfWidthDeg = roof.width / 2 / 111_320
            const slide = (nearSide === 1 ? 1 : -1) * halfWidthDeg * 0.45
            const onSlope = (p: LatLon): LatLon => ({
              lat: p.lat + slide * uAxis.x,
              lon: p.lon + (slide * -uAxis.y) / LON_SQUEEZE,
            })
            for (const [code, points] of byLot) {
              const text = prism.span.lotLabels[code]
              if (!text || points.length === 0) continue
              const center = onSlope(centerOfPoints(points))
              const c0 = lift3d(center)
              const cU = lift3d(step(center, uAxis))
              const cV = lift3d(step(center, nAxis))
              const uLen = Math.hypot(cU.sx - c0.sx, cU.sy - c0.sy) || 1
              const vLen = Math.hypot(cV.sx - c0.sx, cV.sy - c0.sy) || 1
              /* 세로축은 원근 축약비 그대로 쓰되 0.55 아래로는 누르지 않는다(못 읽는다) */
              const k = Math.max(0.55, Math.min(1, vLen / uLen))
              let plane: [number, number, number, number] = [
                (cU.sx - c0.sx) / uLen,
                (cU.sy - c0.sy) / uLen,
                ((cV.sx - c0.sx) / vLen) * k,
                ((cV.sy - c0.sy) / vLen) * k,
              ]
              /* 카메라를 돌려 글씨가 뒤집히면(가로축이 왼쪽을 향하면) 180° 돌려 바로 세운다 */
              if (plane[0] < 0) plane = [-plane[0], -plane[1], -plane[2], -plane[3]]

              /*
               * 칸이 이름을 담을 만큼 길게 보일 때만 쓴다 — 2DOCK 도장공장처럼 지번이 짧고
               * (24m) 이름이 긴 곳에서는 이웃 칸의 글씨끼리 겹쳐 셋 다 못 읽게 된다.
               * 잣대는 그 칸이 화면에서 **글자 방향으로** 차지하는 길이다.
               */
              ctx.font = `600 11px ${CANVAS_SANS}`
              const textWidth = ctx.measureText(text).width
              let minAlong = Infinity
              let maxAlong = -Infinity
              for (const p of points) {
                const s = lift3d(p)
                const along = (s.sx - c0.sx) * plane[0] + (s.sy - c0.sy) * plane[1]
                if (along < minAlong) minAlong = along
                if (along > maxAlong) maxAlong = along
              }
              if (maxAlong - minAlong < textWidth + 10) continue

              roofLotLabels.push({ at: c0, plane, text, alpha: prism.progress })
            }
          }

          /* 이름은 용마루 가운데 — 베이가 글자를 담을 만큼 길게 보일 때만.
           * 고른 베이는 길이와 무관하게 언제나 붙인다: 무엇을 골랐는지가 지도 위에서
           * 끝나야 하고, 짧다고 이름이 사라지면 고른 것만 이름이 없는 꼴이 된다.
           * 이름 없는 토막(label='')은 넘긴다 — 이름은 베이의 가장 큰 토막이 갖는다. */
          if (prism.kind === 'selected' && prism.progress > 0.02 && prism.span.label) {
            const ridgeLen = Math.hypot(ridge[1].sx - ridge[0].sx, ridge[1].sy - ridge[0].sy)
            if (ridgeLen > 46 || pressed) {
              spanLabels.push({
                at: {
                  sx: (ridge[0].sx + ridge[1].sx) / 2,
                  sy: (ridge[0].sy + ridge[1].sy) / 2,
                },
                label: prism.span.label,
                alpha: prism.progress,
                strong: pressed,
              })
            }
          }
          continue
        }

        ctx.globalAlpha = prism.alpha

        /* 옆면 — 전부 그린다. 뒷면은 지붕이 덮는다 (drawPrism 과 같은 이유).
           스팬과 마찬가지로 면마다 해를 재고 발치를 눌러, 벽이 부피를 말하게 한다 */
        ctx.strokeStyle = wallEdge
        ctx.lineWidth = 0.6
        {
          const footY = meanY(base)
          const headY = meanY(top)
          for (const bin of litWallPaths(prism.polygon, base, top)) {
            ctx.fillStyle = wallPaint(prism.color, 0.52 * lift * bin.light, footY, headY)
            ctx.fill(bin.path)
            ctx.stroke(bin.path)
          }
        }

        /* 지붕 — 공정색 면 + 밝은 모서리(빛을 받는 윗날) */
        traceScreen(top)
        ctx.closePath()
        if (prism.kind === 'selected' && prism.progress > 0.02) {
          /* 고른 공장만 은은한 후광 — 하이라이트지 홀로그램이 아니다 */
          ctx.shadowColor = prism.color
          ctx.shadowBlur = 16 * prism.progress
        } else if (prism.hovered) {
          ctx.shadowColor = prism.color
          ctx.shadowBlur = 8
        }
        ctx.fillStyle = roofColor
        ctx.fill()
        ctx.shadowBlur = 0
        /* 채움이 반투명이라 윤곽은 조금 더 세운다 — 형태가 지형에 뭉개지지 않게 */
        ctx.globalAlpha = Math.min(1, prism.alpha + 0.35)
        ctx.strokeStyle = roofEdge
        ctx.lineWidth = 1
        ctx.stroke()

        /* 선택 표시 — 흰 지붕 테두리가 progress 로 켜진다 */
        if (prism.kind === 'selected' && prism.progress > 0.02) {
          ctx.globalAlpha = prism.progress
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.stroke()
        }
        ctx.globalAlpha = 1

        /*
         * 고른 공장의 베이(지번) 구분 — 지붕 **위에** 구획선을 그려, 공장을 누르면
         * 안이 어떻게 나뉘어 있는지 보이게 한다. 손이 얹힌 베이는 흰 베일로 살짝
         * 밝아지고(누를 수 있음), 누른 베이는 공정색을 어둡게 가라앉힌 채움 + 또렷한
         * 흰 테두리로 **눌린 형태**가 된다. 전부 지붕과 같은 progress 로 함께 켜진다.
         */
        if (prism.kind === 'selected' && parcels && prism.progress > 0.02 && drawBayCellRef) {
          const lotSet = parcels.factoryLotSet.get(prism.factory)
          const belongs = (code: string) => lotSet?.has(code) ?? false
          /* 묶인 지번은 그룹 한 칸으로 — 낱장 격자 대신 이름이 붙은 베이가 지붕에 선다 */
          for (const group of parcels.lotGroupShapes.values()) {
            if (!belongs(group.lotCodes[0])) continue
            if (!intersects(group.bounds, window_)) continue
            /* 토막마다 한 칸 — 이름은 가장 큰 토막에만 얹는다 */
            group.polygons.forEach((polygon, index) => {
              drawBayCellRef!(
                polygon,
                index === group.labelAt ? group.label : null,
                prism.color,
                height,
                group.id === parcels.selectedLot,
                group.id === parcels.hoveredLot,
                prism.progress
              )
            })
          }
          /* 그룹에 안 든 지번은 지금까지처럼 낱장 그대로 */
          for (const lot of parcels.lots) {
            if (parcels.lotGroupOf.has(lot.lot)) continue
            if (lot.factory !== prism.factory && !belongs(lot.lot)) continue
            if (!intersects(lot.bounds, window_)) continue
            drawBayCellRef(
              lot.polygon,
              null,
              prism.color,
              height,
              lot.lot === parcels.selectedLot,
              lot.lot === parcels.hoveredLot,
              prism.progress
            )
          }
        }
      }

      /*
       * ── 공장 테두리 ── 한 공장을 두르는 **밝은 실선** 한 줄. 프리즘을 다 세운 뒤,
       * 지붕(처마)과 같은 높이에 긋는다.
       *
       * 선의 도형은 **세운 베이에서 딴다**(`bayFences`) — 발자국(OSM 기단)을 두르면 베이가
       * 실제로 선 자리와 어긋나 테두리가 건물에서 떠 보인다. 지붕 채움이 반투명한 지금은
       * "어디까지가 한 공장"인지를 이 선 하나가 말한다 — 예전에 발치에 깔던 점선 울타리는
       * 같은 경계를 두 겹으로 말해서 걷어냈다.
       *
       * 다가가면 지운다 — 베이가 갈리는 만큼(`gable`) 이 선을 뺀다. 멀리서 세는 단위는
       * **공장**이지만 베이 한 칸이 읽히는 배율에서는 세는 단위가 **베이**로 바뀐다. 그때까지
       * 공장선이 남으면 베이 윤곽과 같은 자리에 두 겹으로 겹쳐 굵은 테만 남고, 안이 어떻게
       * 나뉘었는지가 도로 가려진다. 박공이 자라는 것과 정확히 반대로 옅어져 단이 지지 않는다.
       */
      const factoryFenceAlpha = 0.9 * (1 - gable)
      if (massedRoof || factoryFenceAlpha > 0.02) {
        /* 모서리를 이어 긋는다 — 낱개 선분이 아니라 한 도형의 획이므로 */
        ctx.lineJoin = 'round'
        ctx.lineWidth = 1.2
        for (const [name, fence] of bayFences) {
          /*
           * 실루엣은 **미리 계산해 둔 것**을 쓴다 — 여기서 변을 세어 뽑던 방식은 지번끼리
           * 꼭짓점이 맞지 않아(T자 접합) 한 공장이 여러 조각으로 갈렸고, 통로로 떨어져 앉은
           * 동은 애초에 이을 수가 없었다. factoryOutline 은 그 둘을 같이 푼다.
           */
          const rings = parcels?.factoryOutline.get(name) ?? []
          const paths = rings.map((ring) => {
            const path = new Path2D()
            for (let i = 0; i < ring.length; i++) {
              const { sx, sy } = at(ring[i].lat, ring[i].lon, fence.height)
              if (i === 0) path.moveTo(sx, sy)
              else path.lineTo(sx, sy)
            }
            path.closePath()
            return path
          })

          /*
           * ── 지붕 한 면 ── 실루엣 안쪽을 **한 번에** 칠한다. 맞닿은 베이는 한 채의 속이라
           * 경계가 없고, 반투명한 면을 조각내 칠하면 그 경계가 없는 자리마다 두 겹이 겹쳐
           * 표면에 줄로 남는다. 후광은 그 공장에서 가장 센 것 하나만 면 전체에 실린다.
           */
          if (massedRoof) {
            ctx.globalAlpha = Math.min(1, fence.alpha + 0.06)
            /* 평지붕 한 장 — 하늘을 정면으로 보므로 스팬 지붕과 같은 상수를 쓴다 */
            ctx.fillStyle = shadeColor(fence.color, 0.88 * FLAT_ROOF_LIGHT)
            if (fence.glow > 0) {
              ctx.shadowColor = fence.color
              ctx.shadowBlur = fence.glow
            }
            for (const path of paths) ctx.fill(path)
            ctx.shadowBlur = 0
          }

          if (factoryFenceAlpha > 0.02) {
            ctx.globalAlpha = factoryFenceAlpha
            ctx.strokeStyle = shadeColor(fence.color, 1.35)
            for (const path of paths) ctx.stroke(path)
          }
        }
        ctx.globalAlpha = 1
        ctx.lineJoin = 'miter'
      }

      /*
       * 지붕 위 글씨 — 건물을 다 세운 뒤에 얹는다(앞 스팬에 가려지지 않게).
       *
       * 두 종류다. **스팬 이름**(`3BAY`)은 용마루 가운데의 작은 칩이고, **지번 이름**은
       * 고른 베이의 지붕 면에 페인트로 쓴 것처럼 눕는다 — 어느 칸이 무엇인지가 카드가
       * 아니라 건물 위에서 읽혀야 하고, 눕혀야 그 글씨가 그 지붕의 것으로 보인다.
       */
      if (spanLabels.length > 0) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        for (const item of spanLabels) {
          ctx.globalAlpha = item.alpha
          ctx.font = `${item.strong ? 700 : 600} 11px ${CANVAS_SANS}`
          ctx.strokeStyle = 'rgba(6,10,14,0.85)'
          ctx.lineWidth = 3
          ctx.strokeText(item.label, item.at.sx, item.at.sy)
          ctx.fillStyle = item.strong ? '#ffffff' : 'rgba(255,255,255,0.88)'
          ctx.fillText(item.label, item.at.sx, item.at.sy)
        }
        ctx.globalAlpha = 1
        ctx.lineJoin = 'miter'
      }

      if (roofLotLabels.length > 0) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        for (const item of roofLotLabels) {
          ctx.save()
          ctx.globalAlpha = item.alpha
          ctx.translate(item.at.sx, item.at.sy)
          ctx.transform(item.plane[0], item.plane[1], item.plane[2], item.plane[3], 0, 0)
          ctx.font = `600 11px ${CANVAS_SANS}`
          ctx.letterSpacing = '0.02em'
          ctx.strokeStyle = 'rgba(6,10,14,0.7)'
          ctx.lineWidth = 3
          ctx.strokeText(item.text, 0, 0)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(item.text, 0, 0)
          ctx.restore()
        }
        ctx.globalAlpha = 1
        ctx.letterSpacing = '0px'
        ctx.lineJoin = 'miter'
      }

      /*
       * 3D — 목록이 짚은 지번을 **맨 마지막에** 얹는다. 링과 패는 건물보다 위에 있어야
       * 앞 스팬에 잘리지 않는다(캔버스에는 깊이 버퍼가 없으니 순서가 곧 가림이다).
       */
      if (parcels?.highlightedLot && highlightPatches.length > 0 && drawLotSpotRef) {
        drawLotSpotRef(highlightPatches, parcels.highlightedLot)
      }
    }
    /* 이름줄은 세운 것들 위에 — 2D 에서는 이미 제자리에서 그려졌다(deferred 는 null) */
    deferredParcelLabels?.()

    // ── 공장·샵 ──
    /*
     * 두 상태를 오간다 (레퍼런스 뷰어의 방식):
     *
     * **평상시** — 지번·블록이 주인공이므로 공장은 공정색 외곽선과 옅은 채움으로
     * "여기가 어느 공정의 공장"이라고만 말한다. 손이 얹히면 조금 밝아져 누를 수
     * 있음을 알린다.
     *
     * **공장을 고르면 네온** — 부모가 다른 레이어를 접고 베이스맵을 가라앉히면, 여기는
     * 공장만 발광시킨다. 외곽선은 무채색(어두운 지도에서 흰색)이고 색은 빛(그림자)으로만
     * 말한다 — 여섯 공정색이 나란히 있어도 시끄럽지 않으려면 그래야 한다. 고른 공장이
     * 가장 밝고 나머지는 어두워진다 — 발광은 상대적인 것이라, 전부 빛나면 아무것도
     * 빛나지 않는 것과 같다.
     */
    if (current.layers.facilities) {
      const selected = current.selectedFacility
      const neon = selected !== null
      for (const facility of current.facilities) {
        if (!intersects(facility.bounds, window_)) continue
        const color = facility.process.color[theme]
        const hovered = facility.name === current.hoveredFacility

        tracePath(facility.hull)
        ctx.closePath()

        if (!neon) {
          ctx.globalAlpha = hovered ? 0.3 : 0.13
          ctx.fillStyle = color
          ctx.fill()
          ctx.globalAlpha = hovered ? 1 : 0.75
          ctx.strokeStyle = color
          ctx.lineWidth = hovered ? 2.2 : 1.2
          ctx.stroke()
          ctx.globalAlpha = 1
          continue
        }

        const dim = facility.name !== selected
        if (!dim) {
          ctx.shadowColor = color
          ctx.shadowBlur = 26
        }
        ctx.globalAlpha = dim ? (hovered ? 0.2 : 0.08) : 0.52
        ctx.fillStyle = color
        ctx.fill()

        ctx.globalAlpha = dim ? (hovered ? 0.55 : 0.22) : 1
        ctx.strokeStyle = palette.highlight
        ctx.lineWidth = dim ? 1.6 : 2.6
        ctx.stroke()
        /* 한 번 더 긋는다 — 그림자가 누적되어 네온 관처럼 심지가 밝아진다 */
        if (!dim) ctx.stroke()

        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
    }

    // ── 감시 대상 조립공장 ──
    /*
     * 정반 하나가 지번 구획 두세 개에 걸치므로 **채움 단위는 지번**이고, 그 구획들을
     * 감싸는 외곽선 한 겹이 "여기까지가 한 공장"이라고 말한다.
     *
     * 상태색은 정반만 갖는다 — 외곽선까지 색을 가지면 "공장 자체의 상태"라는 없는 뜻이
     * 생긴다. 외곽은 명도만으로 건물이라고 말하고, 색은 그 안의 정반이 쓴다.
     *
     * 지번 필터(흐리게)는 이 레이어에 걸지 않는다. 필터가 묻는 것은 "용도가 무엇인가"고
     * 이 레이어가 답하는 것은 "센서가 보고 있는가"라서, 서로 다른 질문이다.
     *
     * 3D 에서는 정반을 건물과 같은 높이로 세운다 — 건물 안에 파묻히면 감시 대상이라는
     * 이 레이어의 유일한 뜻이 사라진다. 공장 외곽은 세우지 않고 바닥 자국으로 남긴다:
     * 세운 것이 둘이면 어느 쪽이 정반인지 알 수 없다.
     */
    if (current.layers.shops) {
      for (const shop of current.shops) {
        if (!intersects(shop.bounds, window_)) continue

        /*
         * 순서가 곧 세기다: **바닥판 → 정반 → 외곽선.**
         * 판을 먼저 깔아 그 구역의 지번 색을 눌러 두어야 같은 정반 색이 진하게 서고,
         * 외곽선은 정반 위에 그어야 채움이 경계를 먹지 않는다.
         */
        tracePath(shop.hull)
        ctx.closePath()
        ctx.fillStyle = palette.shopPlate
        ctx.fill()

        /* 3D 에서는 정반도 깊이 순으로 — 앞 정반이 뒷 정반을 가려야 줄이 읽힌다 */
        const bays = tilted
          ? [...shop.bays].sort(
              (a, b) =>
                project(view, viewport, b.center.lat, b.center.lon).depth -
                project(view, viewport, a.center.lat, a.center.lon).depth
            )
          : shop.bays

        for (const bay of bays) {
          const active =
            bay.locationId === current.selectedBayId || bay.locationId === current.hoveredBayId
          const color = bayColor(bay.status, palette)

          for (const lot of bay.lots) {
            if (tilted) {
              const base = lot.quad.map((p) => at(p.lat, p.lon))
              const top = lot.quad.map((p) => at(p.lat, p.lon, RELIEF_METERS.bay))
              ctx.globalAlpha = active ? 1 : BAY_WALL_ALPHA
              drawPrism(
                lot.quad,
                base,
                top,
                {
                  wall: color,
                  wallEdge: palette.bayOutline,
                  roof: color,
                  roofEdge: palette.bayOutline,
                },
                true
              )
              /* 윗면만 한 겹 눌러 옆면과 갈라 놓는다 — 단색 덩어리는 부피로 안 읽힌다 */
              ctx.globalAlpha = active ? 0.32 : BAY_ROOF_ALPHA
              traceScreen(top)
              ctx.closePath()
              ctx.fillStyle = palette.bayOutline
              ctx.fill()
              ctx.globalAlpha = 1
              continue
            }

            tracePath(lot.quad)
            ctx.closePath()
            ctx.globalAlpha = active ? 0.88 : 0.62
            ctx.fillStyle = color
            ctx.fill()
            /* 테두리는 두 겹이다 — 바탕색 한 겹을 먼저 깔아야 어떤 지번 색 위에서도 경계가 산다 */
            ctx.globalAlpha = active ? 0.9 : 0.62
            ctx.strokeStyle = palette.bayOutline
            ctx.lineWidth = active ? 3.5 : 2.5
            ctx.stroke()
            ctx.globalAlpha = 1
            ctx.strokeStyle = color
            ctx.lineWidth = active ? 2 : 1.4
            ctx.stroke()
          }
        }

        /* 외곽선도 두 겹이다 — 바탕 한 겹을 깔아야 어떤 지번 색 위에서도 선이 끊기지 않는다 */
        tracePath(shop.hull)
        ctx.closePath()
        ctx.globalAlpha = 0.6
        ctx.strokeStyle = palette.bayOutline
        ctx.lineWidth = 4.5
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.strokeStyle = palette.shopHull
        ctx.lineWidth = 2
        ctx.stroke()

        /*
         * 모서리 표시 — 3D 뷰어가 블록 윤곽에 두르는 브래킷과 같은 모양이다.
         * 같은 신호를 두 화면이 같은 모양으로 쓰면 "이건 계측 대상"이라는 말을
         * 화면마다 새로 배우지 않아도 된다. 기울인 화면에서는 세운 정반의 꼭대기까지
         * 감싸야 하므로 바닥과 윗면을 함께 재서 상자를 잡는다.
         */
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const point of shop.hull) {
          const heights = tilted ? [0, RELIEF_METERS.bay] : [0]
          for (const height of heights) {
            const { sx, sy } = at(point.lat, point.lon, height)
            if (sx < minX) minX = sx
            if (sx > maxX) maxX = sx
            if (sy < minY) minY = sy
            if (sy > maxY) maxY = sy
          }
        }

        const shortSide = Math.min(maxX - minX, maxY - minY)
        if (shortSide >= BRACKET_MIN_SIZE) {
          const arm = Math.min(16, shortSide * 0.22)
          const corners = [
            [minX, minY, 1, 1],
            [maxX, minY, -1, 1],
            [minX, maxY, 1, -1],
            [maxX, maxY, -1, -1],
          ] as const
          ctx.strokeStyle = palette.shopHull
          ctx.lineCap = 'round'
          ctx.lineWidth = 2
          for (const [cx, cy, dx, dy] of corners) {
            ctx.beginPath()
            ctx.moveTo(cx, cy + dy * arm)
            ctx.lineTo(cx, cy)
            ctx.lineTo(cx + dx * arm, cy)
            ctx.stroke()
          }
          ctx.lineCap = 'butt'
        }
      }
    }

    // ── 배정 계획 ──
    /*
     * 계획을 실적보다 먼저 그린다 — 아직 일어나지 않은 것이 일어난 것을 덮으면
     * 무엇이 사실인지 헷갈린다. 계획은 목적지 점 하나로만 말한다: "여기에 넣기로 했다".
     */
    if (current.layers.plans) {
      ctx.strokeStyle = palette.plan
      ctx.fillStyle = palette.plan
      for (const plan of current.plans) {
        if (plan.path.length > 1) {
          ctx.globalAlpha = 0.5
          ctx.setLineDash([3, 5])
          ctx.lineWidth = 1.5
          tracePath(plan.path)
          ctx.stroke()
          ctx.setLineDash([])
        }
        if (!plan.at || !containsPoint(window_, plan.at.lat, plan.at.lon)) continue
        const { sx, sy } = at(plan.at.lat, plan.at.lon)
        ctx.globalAlpha = 0.62
        ctx.beginPath()
        ctx.arc(sx, sy, PLAN_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // ── 이동 실적 ──
    /*
     * 하루 54건이 한꺼번에 진하게 깔리면 야드가 실뭉치가 된다. 그래서 평상시에는
     * **아주 흐린 실선**으로 "여기에 길이 있었다"만 남기고, 하나를 고르면 그것만
     * 제 색을 되찾는다 — 나머지는 더 흐려져 배경으로 물러난다.
     *
     * 경로는 3D 에서도 지면에 붙인다. 띄우면 그림자가 없는 화면에서 어느 길 위를
     * 지났는지 알 수 없게 되고, 이 레이어가 답하려는 질문이 바로 그것이다.
     */
    if (current.layers.moves) {
      const selected = current.selectedMoveIndex
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      current.moves.forEach((move, index) => {
        if (index === selected) return
        if (!intersects(move.bounds, window_)) return
        ctx.globalAlpha = selected === null ? 0.34 : 0.1
        ctx.strokeStyle = moveColor(index, theme)
        ctx.lineWidth = 2
        tracePath(move.path)
        ctx.stroke()
      })

      if (selected !== null && current.moves[selected]) {
        const move = current.moves[selected]
        const color = moveColor(selected, theme)

        ctx.globalAlpha = 1
        ctx.strokeStyle = palette.moveHalo
        ctx.lineWidth = 7
        tracePath(move.path)
        ctx.stroke()

        ctx.strokeStyle = color
        ctx.lineWidth = 3.5
        /* 도로가 매핑되지 않은 구간은 점선이다 — 그은 선이 추정임을 선 모양이 말한다 */
        if (!move.onRoad) ctx.setLineDash([3, 6])
        tracePath(move.path)
        ctx.stroke()
        ctx.setLineDash([])

        const ends: [LatLon, number][] = [
          [move.path[0], 5],
          [move.path[move.path.length - 1], 6.5],
        ]
        for (const [point, radius] of ends) {
          if (!point) continue
          const { sx, sy } = at(point.lat, point.lon)
          ctx.beginPath()
          ctx.arc(sx, sy, radius, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = palette.moveHalo
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      ctx.lineJoin = 'miter'
      ctx.lineCap = 'butt'
    }

    // ── 블록 ──
    /*
     * 3D 에서는 점을 띄우고 지면까지 기둥을 내린다. 기울인 화면에서 떠 있는 점은
     * **어느 지번 위인지 말하지 못한다** — 같은 화면 자리가 "가까운 땅"도 되고
     * "먼 땅 위 공중"도 되기 때문이다. 기둥의 밑동이 그 답을 대신한다.
     */
    if (current.layers.blocks) {
      const altitude = tilted ? RELIEF_METERS.block : 0
      const visible = current.blocks.filter((block) =>
        containsPoint(window_, block.lat, block.lon)
      )
      if (tilted) {
        visible.sort(
          (a, b) =>
            project(view, viewport, b.lat, b.lon).depth - project(view, viewport, a.lat, a.lon).depth
        )
      }

      for (const block of visible) {
        const head = at(block.lat, block.lon, altitude)
        const selected = block.id === current.selectedBlockId

        if (tilted) {
          const foot = at(block.lat, block.lon)
          ctx.beginPath()
          ctx.moveTo(foot.sx, foot.sy)
          ctx.lineTo(head.sx, head.sy)
          ctx.strokeStyle = selected ? palette.blockSelected : palette.block
          ctx.globalAlpha = selected ? 0.9 : 0.5
          ctx.lineWidth = selected ? 1.6 : 1
          ctx.stroke()
          ctx.globalAlpha = 1

          ctx.beginPath()
          ctx.arc(foot.sx, foot.sy, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = palette.blockOutline
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(head.sx, head.sy, selected ? BLOCK_RADIUS + 2 : BLOCK_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = selected ? palette.blockSelected : palette.block
        ctx.fill()
        /* 어두운 테두리 한 겹 — 밝은 지번 위에서도 점이 떠 보이게 한다 */
        ctx.lineWidth = 1
        ctx.strokeStyle = palette.blockOutline
        ctx.stroke()

        if (selected) {
          ctx.beginPath()
          ctx.arc(head.sx, head.sy, BLOCK_RADIUS + 7, 0, Math.PI * 2)
          ctx.strokeStyle = palette.blockSelected
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    }
  }, [])


  /*
   * 뷰 상태를 바깥으로 흘릴 때는 프레임당 한 번으로 눌러 담는다.
   * 드래그는 pointermove 마다 들어오는데, 그때마다 부모가 다시 그리면 옆의 목록
   * (수백 줄)까지 같이 다시 그려진다 — 캔버스는 멀쩡한데 화면이 끈적해진다.
   */
  /*
   * 뷰가 바뀔 때마다 부모(onViewChange)와 맵 위 칩(bumpChips)에 알린다.
   *
   * 예전에는 이 알림 자체를 requestAnimationFrame 으로 한 번 더 감쌌다 — 드래그처럼
   * rAF 밖(pointermove)에서 여러 번 불려도 한 프레임에 한 번만 나가게 하려는 의도였다.
   * 그런데 카메라 애니메이션의 매 프레임(step)은 **이미 rAF 콜백 안**이라, 그 안에서 또
   * rAF 를 예약하면 실제 알림은 항상 "그 다음 프레임"에야 나간다 — 캔버스는 이번 프레임
   * 위치를 그렸는데 칩·설비 마커(DOM 오버레이)는 한 프레임 늦게 따라오는 것으로 보였다
   * (카메라가 빠르게 움직일수록 도드라진다). 마이크로태스크로 눌러 담으면 "같은 틱 안의
   * 여러 호출을 하나로" 라는 목적은 그대로 지키면서, 다음 페인트 전에 끝나 캔버스와 같은
   * 프레임에 반영된다. 취소 가능한 토큰이 없으므로 언마운트 후 한 번 더 불려도(React 19,
   * 안전) 예전처럼 "예약이 영영 안 풀리는" 문제도 생기지 않는다.
   */
  /*
   * ── 카메라가 도는 동안이라는 표시 ──
   *
   * 지도 위에 얹힌 패널·카드·이름패는 유리(backdrop-blur)다. 그 유리 아래 캔버스가 매
   * 프레임 바뀌면 브라우저는 **블러도 매 프레임 다시 계산**한다 — 넓은 패널 한 장이
   * 그리기보다 비싸서, 캔버스는 2ms 인데 프레임이 21ms 씩 걸린다(측정: 도장 배치 화면).
   * 블러를 끄면 같은 조작이 16ms 로 떨어진다.
   *
   * 그래서 **움직이는 동안만** 유리를 끈다(`body.camera-moving`, globals.css). 멈추면
   * 곧바로 되돌아오므로 정지 화면의 모습은 그대로다 — 움직이는 동안 뒤가 조금 덜 흐릴
   * 뿐이고, 그 대신 카메라가 끊기지 않는다. 표시는 클래스 하나라 React 를 거치지 않는다.
   */
  const motionTimerRef = useRef(0)
  const markMoving = useCallback(() => {
    movingRef.current = true
    document.body.classList.add('camera-moving')
    window.clearTimeout(motionTimerRef.current)
    motionTimerRef.current = window.setTimeout(() => {
      movingRef.current = false
      document.body.classList.remove('camera-moving')
      /* 멈추면 한 번 더 그린다 — 움직이는 동안 줄여 둔 것(작은 건물의 부피)을 되돌린다 */
      draw()
    }, 160)
  }, [draw])
  useEffect(
    () => () => {
      window.clearTimeout(motionTimerRef.current)
      document.body.classList.remove('camera-moving')
    },
    []
  )

  const publishScheduled = useRef(false)
  const publishView = useCallback(() => {
    markMoving()
    if (publishScheduled.current) return
    publishScheduled.current = true
    queueMicrotask(() => {
      publishScheduled.current = false
      handlers.current.onViewChange?.({ ...viewRef.current }, { ...viewportRef.current })
      bumpChips()
    })
  }, [markMoving])

  /* 최초 한 번만 쓰는 값 — ref 로 잡아 두면 이후 갱신이 카메라를 다시 끌고 가지 않는다 */
  const initialViewRef = useRef(initialView)
  const initialBoundsRef = useRef(initialBounds)
  const initialBoundsPaddingRef = useRef(initialBoundsPadding)

  const fitToYard = useCallback(() => {
    if (viewportRef.current.width === 0) return
    /* 전체 보기는 방위도 북쪽으로 되돌린다 — "집"이 매번 다른 방향이면 집이 아니다 */
    viewRef.current = clampViewScale(fitView(data.current.extent, viewportRef.current, 0.05, {
      pitch: viewRef.current.pitch,
      bearing: 0,
    }))
  }, [clampViewScale])

  // ── 크기 추적 + 최초 맞춤 ──
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    let initialised = false
    const resize = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = window.devicePixelRatio || 1
      viewportRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      if (!initialised) {
        initialised = true
        /* 공정 화면에 다녀온 자리가 있으면 거기로 — 다음은 관심 구역, 없으면 야드 전체 */
        if (initialViewRef.current) {
          viewRef.current = clampViewScale({
            ...viewRef.current,
            ...initialViewRef.current,
            scale: clampScale(initialViewRef.current.scale),
          })
        } else if (initialBoundsRef.current) {
          viewRef.current = clampViewScale(fitView(
            initialBoundsRef.current,
            viewportRef.current,
            initialBoundsPaddingRef.current,
            { pitch: viewRef.current.pitch, bearing: 0 }
          ))
        } else {
          fitToYard()
        }
        publishView()
      }
      draw()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw, publishView, fitToYard, clampViewScale])

  // 데이터·표시 설정이 바뀌면 다시 그린다
  useEffect(() => {
    draw()
  }, [
    draw,
    lots,
    blocks,
    moves,
    plans,
    basemapLayers,
    extent,
    colorOfCategory,
    shops,
    layers,
    mapTheme,
    lotOpacity,
    dimmedLots,
    selectedBlockId,
    selectedMoveIndex,
    selectedBayId,
    hoveredLot,
    hoveredBayId,
    facilities,
    selectedFacility,
    hoveredFacility,
    parcels,
  ])

  /*
   * 2D ↔ 3D — 카메라를 굴려서 간다.
   *
   * 순간이동시키면 같은 야드인데도 다른 화면으로 갈아탄 것처럼 보여서, 보고 있던
   * 자리를 눈으로 다시 찾아야 한다. 반 초 동안 기울어지는 동안 눈이 그 자리를 따라간다.
   * 3D 를 벗어날 때는 방위도 북쪽으로 되돌린다 — 2D 는 "북쪽이 위"인 지도라는 약속이다.
   */
  useEffect(() => {
    const targetPitch = viewMode === '3d' ? TILTED_PITCH : 0
    const targetBearing = viewMode === '3d' ? viewRef.current.bearing : 0
    const fromPitch = viewRef.current.pitch
    const fromBearing = viewRef.current.bearing
    if (fromPitch === targetPitch && fromBearing === targetBearing) return

    const settle = () => {
      viewRef.current = { ...viewRef.current, pitch: targetPitch, bearing: targetBearing }
      publishView()
      draw()
    }

    /* 움직임을 줄여 달라고 한 사람에게는 굴리지 않는다 — 그 설정의 뜻이 그것이다 */
    if (
      viewportRef.current.width === 0 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      settle()
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TILT_DURATION)
      /* ease-in-out — 시작과 끝이 부드러워야 "굴러갔다"로 읽힌다 */
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      viewRef.current = {
        ...viewRef.current,
        pitch: fromPitch + (targetPitch - fromPitch) * eased,
        bearing: fromBearing + (targetBearing - fromBearing) * eased,
      }
      publishView()
      draw()
      if (t < 1) frame = requestAnimationFrame(step)
      else settle()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [viewMode, draw, publishView])

  /*
   * 스포트라이트 진입·해제 페이드 — `parcelSpotlightActive` 가 바뀔 때만(=진입 또는 해제)
   * 0.2s 로 이징한다. 이미 스포트라이트 상태에서 다른 공장/공정으로 옮겨갈 때(계속 active)는
   * 다시 페이드하지 않는다 — 그 재색칠은 0.7s 카메라 비행 안에서 자연히 묻힌다(뚝 바뀌어도
   * 눈이 카메라를 좇고 있다).
   *
   * `parcelFadeFromRef` 는 **건드리지 않는다** — 이 효과가 불릴 때 그 안에는 아직 "바뀌기
   * 직전" focus 가 남아 있다(지난 전환의 settle() 에서 넣어 둔 값). 그래서 진입이든 해제든
   * "지금 있던 자리"에서 "새 props"로 진행률만 0→1 로 굴리면 방향에 상관없이 대칭적으로
   * 부드럽다 — 카메라의 `focusBounds` 효과와 같은 결(from = 지금 자리, to = 새 목표)이다.
   */
  const isFirstSpotlightRun = useRef(true)
  useEffect(() => {
    if (isFirstSpotlightRun.current) {
      /* 마운트 직후는 `parcelFadeFromRef` 초기값이 이미 현재 props 와 같아 페이드할 게 없다 */
      isFirstSpotlightRun.current = false
      return
    }

    /* `data.current` 를 읽는다(= 지금 렌더의 값, ref 라서 이 효과의 의존성 목록에 안 잡혀도
       된다) — `parcelState` 를 직접 넣으면 진입/해제 boolean 이 아니라 어느 공장·공정이든
       바뀔 때마다 이 효과가 다시 걸려, 같은 스포트라이트 안에서의 재타깃까지 다시 페이드해
       버린다(의도한 "카메라 비행 안에서 묻힌다" 설계와 어긋난다). */
    const liveFocus = {
      focusedFactory: data.current.parcels?.focusedFactory ?? null,
      focusedProcess: data.current.parcels?.focusedProcess ?? null,
    }
    parcelFadeProgressRef.current = 0

    const settle = () => {
      parcelFadeProgressRef.current = 1
      /* 도착했으니 다음 전환의 출발점을 지금 자리로 옮겨 둔다 */
      parcelFadeFromRef.current = liveFocus
      draw()
    }

    if (
      parcelSpotlightDuration <= 0 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      settle()
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / parcelSpotlightDuration)
      parcelFadeProgressRef.current = easeInOutCubic(t)
      draw()
      if (t < 1) frame = requestAnimationFrame(step)
      else settle()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [parcelSpotlightActive, parcelSpotlightDuration, draw])

  useEffect(() => {
    if (resetSignal === 0) return
    if (initialBoundsRef.current && viewportRef.current.width > 0) {
      viewRef.current = clampViewScale(
        fitView(
          initialBoundsRef.current,
          viewportRef.current,
          initialBoundsPaddingRef.current,
          { pitch: viewRef.current.pitch, bearing: 0 }
        )
      )
    } else {
      fitToYard()
    }
    publishView()
    draw()
  }, [resetSignal, draw, publishView, fitToYard, clampViewScale])

  // 목록에서 고른 블록으로 이동 — 지번이 읽힐 만큼은 당긴다
  useEffect(() => {
    if (!focusBlockId || viewportRef.current.width === 0) return
    const target = data.current.blocks.find((b) => b.id === focusBlockId)
    if (!target) return
    viewRef.current = {
      ...viewRef.current,
      centerLat: target.lat,
      centerLon: target.lon,
      scale: Math.max(viewRef.current.scale, 600_000),
    }
    publishView()
    draw()
  }, [focusBlockId, draw, publishView])

  // 목록에서 고른 공장 — 이웃 공장과의 관계가 남을 만큼 여백을 두고 맞춘다
  useEffect(() => {
    if (!focusFacilityName || viewportRef.current.width === 0) return
    const target = data.current.facilities.find((f) => f.name === focusFacilityName)
    if (!target) return
    viewRef.current = clampViewScale(fitView(target.bounds, viewportRef.current, 0.32, viewRef.current))
    publishView()
    draw()
  }, [focusFacilityName, draw, publishView, clampViewScale])

  /*
   * focusBounds — 0.7s 이징으로 카메라를 굴린다 (레퍼런스 뷰어의 `flyToBounds`).
   *
   * 값이 바뀔 때만 새로 굴린다: 새 범위면 그리로, `null` 이면 야드 전체로. 처음 한 번은
   * 넘긴다 — 마운트 직후 크기 측정이 이미 전체를 맞춰 두므로, 여기서 또 굴리면 두 번
   * 움직인다. 움직임을 줄여 달라고 한 사람에게는 굴리지 않고 바로 놓는다.
   */
  /* `undefined` = 아직 한 번도 안 봤다(마운트) — 그때는 굴리지 않는다. 크기 측정이 이미
   * 전체를 맞춰 두므로, 여기서 또 움직이면 두 번 움직인다. 그 뒤로 값이 바뀔 때만 굴린다. */
  const prevFocusBounds = useRef<LatLonBounds | null | undefined>(undefined)
  useEffect(() => {
    const first = prevFocusBounds.current === undefined
    const changed = prevFocusBounds.current !== focusBounds
    prevFocusBounds.current = focusBounds
    /*
     * **focusBounds 가 실제로 바뀌었을 때만** 굴린다. 이 효과는 viewMode 등 다른 deps 로도
     * 재실행되는데, 그때 focusBounds 가 null(야드 화면)이면 "홈으로 비행"이 시작돼 2D↔3D
     * 기울기 애니메이션의 pitch 를 매 프레임 lerp 로 덮어써 버린다 — 3D 버튼이 기울지 않고
     * 전체 보기로 리셋되는 버그의 원인. 같은 범위로 다시 맞추고 싶은 화면(도장 전체 보기)은
     * 새 객체를 넘겨 정체성을 바꾼다.
     */
    if (first || !changed || viewportRef.current.width === 0) {
      /* 첫 관찰은 넘기고, 크기를 아직 모르면(경쟁) 다음 데이터 갱신의 그리기에 맡긴다 */
      return
    }

    /*
     * 방위 요청이 있으면 그 방위의 **최단 회전 등가각**을 기준으로 맞춘다 — 350° 에서
     * 0° 으로 갈 때 한 바퀴(350° 역회전)를 돌지 않고 10° 만 돌게. fitView 도 이 방위
     * 기준으로 범위를 맞춰야 도착 화면과 맞는다.
     */
    const baseView =
      focusBounds && focusBoundsBearing != null
        ? {
            ...viewRef.current,
            bearing:
              viewRef.current.bearing +
              ((((focusBoundsBearing - viewRef.current.bearing) % 360) + 540) % 360) -
              180,
            /* 원위치 이동은 기울기도 함께 — 돌려 눕힌 카메라가 기본 자세로 돌아온다 */
            pitch: viewMode === '3d' ? TILTED_PITCH : 0,
          }
        : viewRef.current
    const target = clampViewScale(focusBounds
      ? fitView(focusBounds, viewportRef.current, focusBoundsPadding, baseView)
      : fitView(data.current.extent, viewportRef.current, 0.05, {
          pitch: viewRef.current.pitch,
          bearing: viewRef.current.bearing,
        }))
    const from = viewRef.current

    const settle = () => {
      /* 등가각으로 돌았으면 도착 후 표준 범위로 감아 둔다 — 다음 회전 계산이 어긋나지 않게 */
      viewRef.current = { ...target, bearing: wrapBearing(target.bearing) }
      publishView()
      draw()
    }
    if (
      focusBoundsDuration <= 0 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      settle()
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / focusBoundsDuration)
      viewRef.current = lerpView(from, target, easeInOutCubic(t))
      publishView()
      draw()
      if (t < 1) frame = requestAnimationFrame(step)
      else settle()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [focusBounds, focusBoundsDuration, focusBoundsPadding, focusBoundsBearing, viewMode, draw, publishView, clampViewScale])

  /* 미니맵 등 외부 탐색 UI에서 고른 위치로 이동한다. 확대·기울기·방위는 그대로 둔다. */
  useEffect(() => {
    if (!navigationTarget || viewportRef.current.width === 0) return
    const from = viewRef.current
    const target = {
      ...from,
      centerLat: navigationTarget.lat,
      centerLon: navigationTarget.lon,
    }

    const settle = () => {
      viewRef.current = target
      publishView()
      draw()
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      settle()
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 320)
      viewRef.current = lerpView(from, target, easeInOutCubic(t))
      publishView()
      draw()
      if (t < 1) frame = requestAnimationFrame(step)
      else settle()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [navigationTarget, draw, publishView])

  // 목록에서 고른 이동 — 출발과 도착이 한 화면에 다 들어와야 "어디서 어디로"가 읽힌다
  useEffect(() => {
    if (focusMoveIndex === null || viewportRef.current.width === 0) return
    const move = data.current.moves[focusMoveIndex]
    if (!move || move.path.length === 0) return
    viewRef.current = fitView(move.bounds, viewportRef.current, 0.22, viewRef.current)
    publishView()
    draw()
  }, [focusMoveIndex, draw, publishView])

  // ── 조작: 끌어서 이동, 휠로 확대, (3D) Shift·오른쪽 끌기로 돌리기 ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragging = false
    let orbiting = false
    let moved = false
    let lastX = 0
    let lastY = 0

    /** 블록 표시가 떠 있는 높이 — 그리는 자리와 집는 자리가 같아야 한다 */
    const blockAltitude = () => (viewRef.current.pitch > 0 ? RELIEF_METERS.block : 0)

    const pickBlock = (sx: number, sy: number): YardBlock | null => {
      if (!data.current.layers.blocks) return null
      const view = viewRef.current
      const viewport = viewportRef.current
      const altitude = blockAltitude()
      let best: YardBlock | null = null
      let bestDist = BLOCK_HIT_RADIUS * BLOCK_HIT_RADIUS
      for (const block of data.current.blocks) {
        const p = worldToScreen(view, viewport, block.lat, block.lon, altitude)
        const dx = p.sx - sx
        const dy = p.sy - sy
        const dist = dx * dx + dy * dy
        if (dist <= bestDist) {
          bestDist = dist
          best = block
        }
      }
      return best
    }

    /** 점에서 선분까지의 거리² — 경로는 선이라 "가까운 점"이 아니라 "가까운 선"을 찾아야 한다 */
    const distToSegment = (
      px: number,
      py: number,
      ax: number,
      ay: number,
      bx: number,
      by: number
    ): number => {
      const dx = bx - ax
      const dy = by - ay
      const lenSq = dx * dx + dy * dy
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
      const ex = px - (ax + t * dx)
      const ey = py - (ay + t * dy)
      return ex * ex + ey * ey
    }

    const pickMove = (sx: number, sy: number): number | null => {
      if (!data.current.layers.moves) return null
      const view = viewRef.current
      const viewport = viewportRef.current
      const window_ = visibleBounds(view, viewport, MOVE_HIT_RADIUS)
      let best: number | null = null
      let bestDist = MOVE_HIT_RADIUS * MOVE_HIT_RADIUS
      data.current.moves.forEach((move, index) => {
        if (!intersects(move.bounds, window_)) return
        for (let i = 0; i + 1 < move.path.length; i++) {
          const a = worldToScreen(view, viewport, move.path[i].lat, move.path[i].lon)
          const b = worldToScreen(view, viewport, move.path[i + 1].lat, move.path[i + 1].lon)
          const dist = distToSegment(sx, sy, a.sx, a.sy, b.sx, b.sy)
          if (dist <= bestDist) {
            bestDist = dist
            best = index
          }
        }
      })
      return best
    }

    const pickLot = (sx: number, sy: number): YardLot | null => {
      if (!data.current.layers.lots) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      /* 겹친 지번이 있으면 작은 쪽을 고른다 — 큰 구역 안에 작은 구획이 들어 있다 */
      let best: YardLot | null = null
      let bestArea = Infinity
      for (const lot of data.current.lots) {
        if (!containsPoint(lot.bounds, lat, lon)) continue
        if (!quadContains(lot.quad, lat, lon)) continue
        if (lot.area > 0 && lot.area < bestArea) {
          bestArea = lot.area
          best = lot
        } else if (!best) {
          best = lot
        }
      }
      return best
    }

    /**
     * 커서 아래의 감시 정반 — 지번 구획 단위로 판정한다.
     *
     * 정반은 지번 여러 개로 이루어지고 지번은 회전 사각형이라, 경계 상자로 판정하면
     * 옆 정반을 집는다. 상자로 먼저 걸러 낸 뒤 사각형 안쪽만 인정한다.
     *
     * 판정은 3D 에서도 **지면 기준**이다 — 세운 옆면을 눌러도 그 밑동의 지번을
     * 고르게 되므로, 손이 가리키는 것과 고르는 것이 어긋나지 않는다.
     */
    const pickBay = (sx: number, sy: number): YardShopBay | null => {
      if (!data.current.layers.shops) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      for (const shop of data.current.shops) {
        if (!containsPoint(shop.bounds, lat, lon)) continue
        for (const bay of shop.bays) {
          if (!containsPoint(bay.bounds, lat, lon)) continue
          for (const lot of bay.lots) {
            if (containsPoint(lot.bounds, lat, lon) && quadContains(lot.quad, lat, lon)) return bay
          }
        }
      }
      return null
    }

    /**
     * 커서 아래의 공장 — 샵 내비 모드에서만. 겹치는 외곽이 있으면(붙은 공장들)
     * 화면상 더 작은 쪽이 이긴다 — 큰 것이 이기면 작은 공장은 영원히 못 누른다.
     */
    const pickFacility = (sx: number, sy: number): YardFacility | null => {
      if (!data.current.layers.facilities) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      let best: YardFacility | null = null
      let bestSpan = Infinity
      for (const facility of data.current.facilities) {
        if (!containsPoint(facility.bounds, lat, lon)) continue
        if (!facilityContains(facility, lat, lon)) continue
        const span =
          (facility.bounds.maxLat - facility.bounds.minLat) *
          (facility.bounds.maxLon - facility.bounds.minLon)
        if (span < bestSpan) {
          bestSpan = span
          best = facility
        }
      }
      return best
    }

    /**
     * 커서 아래의 painting 지번 — 폴리곤 안에 들면 그 지번코드와 대표 공장 이름.
     * 겹치면 화면상 더 작은 지번이 이긴다(큰 구역 안의 작은 구획을 집을 수 있게).
     * `parcels` 가 없으면(야드 화면) 항상 null 이라 기존 동작에 영향이 없다.
     * 공장 선택은 이 결과의 `factory` 를, 베이 선택은 `bay` 를 쓴다 — `bay` 는 그 지번이
     * 베이 묶음(`lotGroups`)에 들면 **그룹 id**, 아니면 지번코드 그대로다. 선택·호버 계약이
     * 늘 "누른 칸"의 이름으로 오가도록 여기서 한 번에 맞춘다.
     */
    const pickParcelLot = (
      sx: number,
      sy: number
    ): { bay: string; factory: string } | null => {
      const parcels = data.current.parcels
      if (!parcels) return null
      const { lat, lon } = screenToWorld(viewRef.current, viewportRef.current, sx, sy)
      let best: { bay: string; factory: string } | null = null
      let bestArea = Infinity
      for (const lot of parcels.lots) {
        if (!containsPoint(lot.bounds, lat, lon)) continue
        if (!quadContains(lot.polygon, lat, lon)) continue
        const factory = parcels.factoryOfLot.get(lot.lot)
        if (!factory) continue
        const area =
          (lot.bounds.maxLat - lot.bounds.minLat) * (lot.bounds.maxLon - lot.bounds.minLon)
        if (area < bestArea) {
          bestArea = area
          best = { bay: parcels.lotGroupOf.get(lot.lot) ?? lot.lot, factory }
        }
      }
      return best
    }

    const localPoint = (event: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { sx: event.clientX - rect.left, sy: event.clientY - rect.top }
    }

    /** 돌리기는 기울어져 있을 때만 뜻이 있다 — 평면을 돌리면 북쪽만 잃는다 */
    const wantsOrbit = (event: PointerEvent) =>
      viewRef.current.pitch > 0 && (event.button === 2 || event.shiftKey)

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return
      canvas.setPointerCapture(event.pointerId)
      dragging = true
      orbiting = wantsOrbit(event)
      moved = false
      lastX = event.clientX
      lastY = event.clientY
      setCursor(orbiting ? 'move' : 'grabbing')
    }

    const onPointerMove = (event: PointerEvent) => {
      const { sx, sy } = localPoint(event)

      if (dragging) {
        const dx = event.clientX - lastX
        const dy = event.clientY - lastY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true
        lastX = event.clientX
        lastY = event.clientY
        if (orbiting) {
          const view = viewRef.current
          viewRef.current = {
            ...view,
            bearing: wrapBearing(view.bearing + dx * ORBIT_YAW_PER_PX),
            /* 3D 안에서는 완전히 눕지도 완전히 서지도 못한다 — 그러면 모드와 화면이 어긋난다 */
            pitch: Math.min(
              MAX_PITCH,
              Math.max(MIN_TILTED_PITCH, view.pitch - dy * ORBIT_PITCH_PER_PX)
            ),
          }
        } else {
          viewRef.current = panBy(viewRef.current, viewportRef.current, dx, dy)
        }
        publishView()
        draw()
        return
      }

      /* 작은 것 우선 — 점(블록)·면(정반)이 먼저고, 공장은 가장 큰 면이라 마지막이다 */
      const block = pickBlock(sx, sy)
      const bay = block ? null : pickBay(sx, sy)
      const facility = block || bay ? null : pickFacility(sx, sy)
      /* painting 지번 레이어의 지번/공장 — 야드 시설과 상호배타(둘 다 켜지는 화면은 없다) */
      const parcelHit = block || bay || facility ? null : pickParcelLot(sx, sy)
      setCursor(
        block || bay || facility || parcelHit || pickMove(sx, sy) !== null ? 'pointer' : 'grab'
      )
      handlers.current.onHoverLot?.(block?.lot ?? pickLot(sx, sy)?.lot ?? null)
      handlers.current.onHoverBay?.(bay?.locationId ?? null)
      handlers.current.onHoverFacility?.(facility?.name ?? null)
      handlers.current.onParcelHover?.(parcelHit?.factory ?? null)
      /* 스포트라이트한 공장 **안**의 지번만 베이 호버로 친다 — 밖은 공장 호버일 뿐이다 */
      handlers.current.onParcelLotHover?.(
        parcelHit && parcelHit.factory === data.current.parcels?.focusedFactory
          ? parcelHit.bay
          : null
      )
    }

    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      const wasDragging = dragging
      const wasOrbiting = orbiting
      dragging = false
      orbiting = false
      setCursor('grab')
      if (!wasDragging || moved || wasOrbiting) return

      /*
       * 끌지 않고 눌렀다 뗐다 = 선택. 작은 것이 먼저다 — 점(블록)·선(경로)·면(정반)
       * 순으로 본다. 같은 자리를 두고 다투면 큰 것이 언제나 이겨서, 면을 먼저 보면
       * 정반 위에 세워진 블록은 영원히 못 누른다. 빈 곳을 누르면 전부 해제다.
       */
      const { sx, sy } = localPoint(event)
      const block = pickBlock(sx, sy)
      if (block) {
        handlers.current.onSelectBlock?.(block.id)
        return
      }
      const move = pickMove(sx, sy)
      if (move !== null) {
        handlers.current.onSelectMove?.(move)
        return
      }
      const bay = pickBay(sx, sy)
      if (bay) {
        handlers.current.onSelectBay?.(bay.locationId)
        return
      }
      /* 공장은 마지막 — 블록·정반이 그 위에 서 있어서, 먼저 보면 그것들을 영영 못 누른다 */
      const facility = pickFacility(sx, sy)
      if (facility) {
        handlers.current.onSelectFacility?.(facility.name)
        return
      }
      /* painting 지번 레이어의 선택 (parcels 를 준 화면에서만 뜻이 있다) —
       * 이미 스포트라이트한 공장 안의 지번을 누르면 공장 재선택 대신 **그 베이**를
       * 고른다(눌리는 형태). 다른 공장 지번이면 여느 때처럼 공장 선택으로 간다. */
      const parcelHit = pickParcelLot(sx, sy)
      if (parcelHit) {
        if (
          parcelHit.factory === data.current.parcels?.focusedFactory &&
          handlers.current.onParcelLotSelect
        ) {
          handlers.current.onParcelLotSelect(parcelHit.bay)
        } else {
          handlers.current.onParcelSelect?.(parcelHit.factory)
        }
        return
      }
      handlers.current.onSelectFacility?.(null)
      handlers.current.onParcelSelect?.(null)
      handlers.current.onSelectBlock?.(null)
      handlers.current.onSelectMove?.(null)
      handlers.current.onSelectBay?.(null)
    }

    const onPointerLeave = () => {
      if (dragging) return
      handlers.current.onHoverLot?.(null)
      handlers.current.onHoverBay?.(null)
      handlers.current.onHoverFacility?.(null)
      handlers.current.onParcelLotHover?.(null)
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { sx, sy } = localPoint(event)
      /* 휠 한 칸에 약 1.15배 — 트랙패드의 작은 델타도 같은 식으로 눌러 담는다 */
      viewRef.current = zoomWithinScaleRange(
        viewRef.current,
        viewportRef.current,
        sx,
        sy,
        Math.exp(-event.deltaY * 0.0015)
      )
      publishView()
      draw()
    }

    const onDoubleClick = (event: MouseEvent) => {
      const { sx, sy } = localPoint(event)
      viewRef.current = zoomWithinScaleRange(viewRef.current, viewportRef.current, sx, sy, 1.8)
      publishView()
      draw()
    }

    /* 오른쪽 끌기가 돌리기이므로 메뉴는 막는다 — 안 막으면 한 번 돌리고 메뉴가 뜬다 */
    const onContextMenu = (event: MouseEvent) => {
      if (viewRef.current.pitch > 0) event.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('dblclick', onDoubleClick)
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDoubleClick)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [draw, publishView, clampViewScale, zoomWithinScaleRange])

  // 키보드 — 커서가 맵 위에 있을 때만 (뷰포트 단축키와 같은 규칙)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current?.matches(':hover')) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return

      const step = event.shiftKey ? 1.6 : 1.25
      if (event.key === '+' || event.key === '=') {
        viewRef.current = clampViewScale({ ...viewRef.current, scale: clampScale(viewRef.current.scale * step) })
      } else if (event.key === '-' || event.key === '_') {
        viewRef.current = clampViewScale({ ...viewRef.current, scale: clampScale(viewRef.current.scale / step) })
      } else if (event.key === 'Escape') {
        handlers.current.onSelectBlock?.(null)
        handlers.current.onSelectMove?.(null)
        handlers.current.onSelectBay?.(null)
        handlers.current.onSelectFacility?.(null)
        return
      } else {
        return
      }
      event.preventDefault()
      publishView()
      draw()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draw, publishView, clampViewScale])

  /*
   * 공장 이름줄을 누르면 그 공장이 다 보이도록 맞춘다 — 카메라만 움직이는 일이라
   * 바깥 상태를 거치지 않는다. 멀리서는 정반 칩이 뜨지 않으므로, 이 한 번의 확대가
   * "이름줄 → 정반 칩 → 3D 화면"으로 이어지는 첫 걸음이 된다.
   */
  const focusShop = useCallback(
    (shop: YardShop) => {
      if (viewportRef.current.width === 0) return
      viewRef.current = fitView(shop.bounds, viewportRef.current, 0.18, viewRef.current)
      publishView()
      draw()
    },
    [draw, publishView],
  )

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden rounded-inshop-lg', className)}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none select-none"
        style={{ cursor }}
      />

      {showFacilityLabels && layers.facilities && facilities.length > 0 && (
        <YardFacilityLabels
          facilities={facilities}
          view={viewRef.current}
          viewport={viewportRef.current}
          mapTheme={mapTheme}
          selectedFacility={selectedFacility}
          hoveredFacility={hoveredFacility}
          onSelectFacility={onSelectFacility}
          onHoverFacility={onHoverFacility}
          facilityHref={facilityHref}
        />
      )}

      {shops.length > 0 && layers.shops && shopHref && bayHref && (
        <YardShopChips
          shops={shops}
          view={viewRef.current}
          viewport={viewportRef.current}
          mapTheme={mapTheme}
          selectedBayId={selectedBayId}
          hoveredBayId={hoveredBayId}
          onHoverBay={onHoverBay}
          onFocusShop={focusShop}
          shopHref={shopHref}
          bayHref={bayHref}
        />
      )}
    </div>
  )
}
