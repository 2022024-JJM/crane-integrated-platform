import {
  BUILDING,
  LAND,
  LANDUSE,
  PIER,
  ROADMAJOR,
  ROADMINOR,
  WATER,
} from '../../../entities/yard/api/basemapFixture'
import type { Ring } from '../../../entities/yard/api/basemapFixture'

/**
 * 베이스맵 배색.
 *
 * 두 벌을 둔다. **어두움**은 OSM 표준 배색을 눕힌 것으로, 지번(원색)과 블록(주황)이
 * 주인공이 되도록 땅·건물·도로를 명도만으로 갈라 둔 것이다. **밝음**은 OSM 표준 배색
 * 그대로이며, 레퍼런스 뷰어(`temp/옥포야드_오프라인지도뷰어.html`)가 쓰던 배색이다.
 *
 * 둘 다 필요한 이유는 읽는 목적이 다르기 때문이다 — 야드의 **상태**(어디가 찼는가)를
 * 볼 때는 지번 색이 튀어야 하므로 어두운 바탕이 낫고, 야드의 **지형**(어느 건물 옆
 * 어느 길인가)을 볼 때는 현장이 이미 아는 종이지도 색이 낫다.
 *
 * 다만 **기본은 앱 테마를 따라간다**(`MapThemeSetting` 참조). 위의 구분은 골라 쓰는
 * 사람에게 필요한 것이지, 아무것도 고르지 않은 사람에게까지 화면과 따로 노는 지도를
 * 들이밀 이유가 되지는 않는다.
 *
 * 바다는 두 벌 모두 푸른 기를 남겼다 — 옥포는 바다가 야드 모양을 결정해서, 바다가
 * 보여야 "여기가 어디인지"가 잡힌다.
 */
export type MapTheme = 'dark' | 'light'

/**
 * 사용자가 고르는 값 — `auto` 는 **앱 테마를 따라간다**.
 *
 * 기본이 `auto` 인 이유는, 화면 전체를 어둡게 해 놓고 지도만 하얗게 타오르는 것이
 * 그 자체로 오작동처럼 보이기 때문이다. 야드 맵은 화면의 절반을 차지해서 더 그렇다.
 * 그래도 두 벌을 남겨 두는 것은 위 주석의 이유 때문이다 — 밝기가 **읽는 목적**을
 * 가르는 경우가 있어서, 앱은 어둡게 두고 지도만 종이지도 색으로 보고 싶을 때가 있다.
 */
export type MapThemeSetting = MapTheme | 'auto'

/** 고른 값 + 지금 앱 밝기 → 실제로 쓸 배색 */
export function resolveMapTheme(setting: MapThemeSetting, appTheme: MapTheme): MapTheme {
  return setting === 'auto' ? appTheme : setting
}

export interface BasemapLayer {
  rings: readonly Ring[]
  /**
   * 3D 에서 이 층을 세울지 — `building` 인 층만 기둥이 된다.
   * 땅·물·부두·도로는 지면 자체라 세울 것이 없다.
   */
  kind?: 'building'
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

/** 건물·잔 도로를 그리기 시작하는 배율(px/도). 두 배색이 같은 기준을 쓴다 */
const BUILDING_MIN_SCALE = 250_000
const ROADMINOR_MIN_SCALE = 120_000

/*
 * 그리는 순서 = 배열 순서. 땅 → 용도 → 물 → 부두 → 건물 → 잔 도로 → 큰 도로.
 * 큰 도로를 마지막에 두는 이유는 교차점에서 잔 도로가 그 위를 덮으면 간선이
 * 끊겨 보이기 때문이다.
 */
export const BASEMAP_LAYERS: Record<MapTheme, BasemapLayer[]> = {
  dark: [
    { rings: LAND, fill: '#1b222a', closed: true },
    { rings: LANDUSE, fill: '#1f272f', closed: true },
    { rings: WATER, fill: SEA_COLOR.dark, closed: true },
    { rings: PIER, fill: '#242c35', closed: true },
    {
      rings: BUILDING,
      kind: 'building',
      fill: '#252d36',
      stroke: '#2c353f',
      lineWidth: 0.5,
      minScale: BUILDING_MIN_SCALE,
      closed: true,
    },
    {
      rings: ROADMINOR,
      stroke: '#2f3843',
      lineWidth: 1.2,
      minScale: ROADMINOR_MIN_SCALE,
      closed: false,
    },
    { rings: ROADMAJOR, stroke: '#39434e', lineWidth: 2.5, closed: false },
  ],
  light: [
    { rings: LAND, fill: '#f2efe9', stroke: '#9dc3cf', lineWidth: 1, closed: true },
    { rings: LANDUSE, fill: '#e6e4dd', closed: true },
    { rings: WATER, fill: SEA_COLOR.light, stroke: '#7ab8cc', lineWidth: 1, closed: true },
    { rings: PIER, fill: '#d5d0c5', stroke: '#b0aa9d', lineWidth: 2, closed: true },
    {
      rings: BUILDING,
      kind: 'building',
      fill: '#d9d0c9',
      stroke: '#c4b8a8',
      lineWidth: 0.7,
      minScale: BUILDING_MIN_SCALE,
      closed: true,
    },
    /*
     * 잔 도로는 두 번 긋는다 — 흰 길이 옅은 땅 위에서 저 혼자로는 보이지 않아서,
     * 먼저 회색 테를 깔고 그 안에 흰 길을 얹는다 (종이지도가 하는 것과 같다).
     */
    {
      rings: ROADMINOR,
      stroke: '#c9c4bc',
      lineWidth: 3.4,
      minScale: ROADMINOR_MIN_SCALE,
      closed: false,
    },
    {
      rings: ROADMINOR,
      stroke: '#ffffff',
      lineWidth: 2.2,
      minScale: ROADMINOR_MIN_SCALE,
      closed: false,
    },
    { rings: ROADMAJOR, stroke: '#fcd6a4', lineWidth: 4, closed: false },
  ],
}
