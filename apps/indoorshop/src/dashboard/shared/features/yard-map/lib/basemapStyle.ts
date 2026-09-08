/**
 * 베이스맵 배색 계약 — 순수 프레젠테이션 부분.
 *
 * 두 벌을 둔다. **어두움**은 OSM 표준 배색을 눕힌 것으로, 지번(원색)과 블록(주황)이
 * 주인공이 되도록 땅·건물·도로를 명도만으로 갈라 둔 것이다. **밝음**은 OSM 표준 배색
 * 그대로이며, 레퍼런스 뷰어(`temp/옥포야드_오프라인지도뷰어.html`)가 쓰던 배색이다.
 *
 * 다만 **기본은 앱 테마를 따라간다**(`MapThemeSetting` 참조). 위의 구분은 골라 쓰는
 * 사람에게 필요한 것이지, 아무것도 고르지 않은 사람에게까지 화면과 따로 노는 지도를
 * 들이밀 이유가 되지는 않는다.
 *
 * 바다는 두 벌 모두 푸른 기를 남겼다 — 옥포는 바다가 야드 모양을 결정해서, 바다가
 * 보여야 "여기가 어디인지"가 잡힌다.
 *
 * 여기에는 **어느 야드인지 모르는** 배색 규약(타입·바다색·테마 해석)만 둔다. 실제 벡터
 * 레이어(`BASEMAP_LAYERS`)는 야드 fixture 에서 만들어져 지도에 **props 로 주입**된다 —
 * shared 는 특정 야드의 지형 데이터를 알지 않는다.
 */
export type MapTheme = 'dark' | 'light'

/**
 * 사용자가 고르는 값 — `auto` 는 **앱 테마를 따라간다**.
 *
 * 기본이 `auto` 인 이유는, 화면 전체를 어둡게 해 놓고 지도만 하얗게 타오르는 것이
 * 그 자체로 오작동처럼 보이기 때문이다. 야드 맵은 화면의 절반을 차지해서 더 그렇다.
 * 그래도 두 벌을 남겨 두는 것은 밝기가 **읽는 목적**을 가르는 경우가 있어서다 — 앱은
 * 어둡게 두고 지도만 종이지도 색으로 보고 싶을 때가 있다.
 */
export type MapThemeSetting = MapTheme | 'auto'

/** 고른 값 + 지금 앱 밝기 → 실제로 쓸 배색 */
export function resolveMapTheme(setting: MapThemeSetting, appTheme: MapTheme): MapTheme {
  return setting === 'auto' ? appTheme : setting
}

/** 폴리곤/폴리라인 링 — GeoJSON 과 같은 [lon, lat] 순서다 */
export type Ring = [number, number][]

/**
 * 층의 지형적 역할 — 배색이 아니라 **의미**의 이름표다. 소비자(대시보드 등)가 자기
 * 화면에 맞게 특정 층만 재배색·재게이팅하려면 배열 순서나 색값 추측이 아니라 이 값으로
 * 골라야 한다. 없는 층은 재스타일 대상이 아니라는 뜻이다.
 */
export type BasemapRole =
  | 'land'
  | 'landuse'
  | 'water'
  | 'pier'
  | 'building'
  | 'road-minor'
  | 'road-major'

export interface BasemapLayer {
  rings: readonly Ring[]
  /**
   * 3D 에서 이 층을 세울지 — `building` 인 층만 기둥이 된다.
   * 땅·물·부두·도로는 지면 자체라 세울 것이 없다.
   */
  kind?: 'building'
  /** 지형적 역할 — 소비자별 재스타일의 조인 키 (표시에는 영향 없음) */
  role?: BasemapRole
  /** 채움 (폴리곤) */
  fill?: string
  /** 선 (라인 또는 폴리곤 테두리) */
  stroke?: string
  lineWidth?: number
  /** 이 배율 아래에서는 그리지 않는다 — 멀리서 잔 도로·건물은 노이즈다 */
  minScale?: number
  closed: boolean
}

/** 캔버스 바탕 — 육지가 그 위를 덮는다 */
export const SEA_COLOR: Record<MapTheme, string> = {
  dark: '#0e1a24',
  light: '#aad3df',
}
