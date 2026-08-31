/**
 * 야드 지번/공장 — 단일 소스 데이터 계약.
 *
 * painting 원본(지번속성·지번좌표·공장)을 `scripts/build-yard-parcels-fixture.mjs` 가
 * 변환해 만든 fixture 를 이 타입으로 편다. **대시보드·도장 화면이 이 하나만 쓴다** —
 * 공장을 그리는 두 화면이 서로 다른 지번 데이터를 들고 어긋나지 않도록, 소유 지점을
 * 여기로 모은다. (shared 는 공정 모듈을 import 하지 않는다 — 여기서 공장·공정은 문자열
 * 데이터일 뿐 특정 공정 모듈에 대한 의존이 아니다.)
 */

export interface LatLon {
  lat: number
  lon: number
}

export interface LatLonBounds {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

/** 지번 하나 — 야드를 나눈 최소 구획. 색은 `category`(분류)가 정한다. */
export interface YardParcelLot {
  /** 지번코드 (예: `1BP153`) */
  lot: string
  /** 대표 소속 공장 — 첫 매칭. 소속이 없으면 null (그래도 분류색으로는 그린다) */
  factory: string | null
  /** 공정 (조립/도장/의장/가공/PE/조립검사/탑재/전처리, 빈칸 가능) */
  process: string
  /** 분류 (CATC) — 색이 뜻하는 단위. `categoryColor` 의 키다 */
  category: string
  /** 설명 (원본 `설명` 열) */
  label: string
  /** 면적 (m²) */
  area: number
  /** 옥내 / 옥외 */
  place: string
  /** 실제 구획 모양 — EPSG:5187 → WGS84 로 변환한 폴리곤 정점(4점 이상) */
  polygon: LatLon[]
}

/**
 * 공장 = 소속 지번들의 집합(한 덩어리 hull 이 아니다). 지번의 `공장` 열이 이 이름을
 * 가리키면 소속이며, 한 지번이 여러 공장에 속할 수 있다.
 */
export interface YardParcelFactory {
  /** 공장 이름 (원본 공장.js 기준, 곧 식별자) */
  name: string
  /** 공정 */
  process: string
  /** 소속 지번코드 — 이 공장을 focus 할 때 밝힐 지번 집합 */
  lotCodes: string[]
  /** 공장 이름줄을 놓을 자리 — 소속 지번들의 모든 정점 평균(centroid) */
  labelAnchor: LatLon
}

/**
 * 베이 하나 — 공장을 이루는 **스팬**. 지번보다 크고 공장보다 작다.
 *
 * 옥포 조립공장의 베이는 폭 25~55m · 길이 120~315m 의 긴 스팬이 나란히 붙은 형태이고,
 * 한 베이가 지번 한~네 장에 걸친다. 도형을 따로 갖지 않는 것은 의도다 — 소속 지번
 * 폴리곤(`YardParcelLot.polygon`)을 합치면 나오므로, 좌표를 두 벌 두어 어긋나게 하지 않는다.
 */
export interface YardParcelBay {
  /** 소속 공장 이름 (`YardParcelFactory.name`) */
  factory: string
  /** 베이 번호·기호 (예: `3`, `B10`) — 공장 안에서만 유일하다 */
  bay: string
  /** 공장을 가로지르지 않는 식별자 — `{공장}#{베이}` */
  id: string
  /** 화면에 쓰는 이름 (예: `3BAY`) */
  label: string
  /** 이 베이가 차지하는 지번코드 */
  lotCodes: string[]
}

/** loadYardParcels 의 반환 — 대시보드·도장이 받는 단일 묶음 */
export interface YardParcels {
  lots: YardParcelLot[]
  factories: YardParcelFactory[]
  /**
   * 공장의 베이 — 지도가 공장을 낱장 격자가 아니라 스팬으로 세우는 근거.
   * 매핑이 없는 공장은 여기 없다(그 공장은 지금까지처럼 한 덩어리로 선다).
   */
  bays: YardParcelBay[]
  /** 분류(category) → 색. 지번 채움을 이 함수로 칠한다 */
  categoryColor: (category: string) => string
}

/**
 * 분류(CATC) → 색 — painting 뷰어(라인 1024)의 배색을 그대로 쓴다. 야드 화면의
 * 지번 성격 배색과도 같은 값이라, 두 화면이 같은 색으로 야드를 읽는다.
 */
export const PARCEL_CATEGORY_COLORS: Readonly<Record<string, string>> = {
  '공장(Shop)': '#3987e5',
  검사장: '#eb6834',
  적치장: '#1baf7a',
  'PE·옥외의장': '#eda100',
  '도장(옥외)': '#e87ba4',
  '도크·안벽': '#008300',
  '기타·물류': '#9a9890',
}

/** 분류 색 — 모르는 분류는 기타·물류 회색으로 */
export function colorOfParcelCategory(category: string): string {
  return PARCEL_CATEGORY_COLORS[category] ?? '#9a9890'
}

/**
 * 공정(PRC) → 색 — painting 뷰어 원본 배색 그대로. 대시보드의 "샵 네비게이션" 룩에서
 * 공장 지번을 **그 공장의 공정색 네온**으로 피워 올릴 때 쓴다. 분류색(위)이 "이 땅이
 * 무엇에 쓰이나"라면, 공정색은 "어느 공정의 공장인가"라 축이 다르다 — 그래서 색표도 둘이다.
 */
export const PROCESS_COLORS: Readonly<Record<string, string>> = {
  조립: '#2a78d6',
  도장: '#e87ba4',
  의장: '#eb6834',
  가공: '#1baf7a',
  PE: '#eda100',
  조립검사: '#e34948',
  탑재: '#4a3aa7',
  전처리: '#008300',
}

/** 공정을 알 수 없거나 빈칸일 때의 무채색 — painting 원본의 무공정 색 */
export const NO_PROCESS_COLOR = '#c9c4bc'

/** 공정 색 — 모르는/빈 공정은 무공정 회색으로 */
export function colorOfProcess(process: string): string {
  return PROCESS_COLORS[process] ?? NO_PROCESS_COLOR
}
