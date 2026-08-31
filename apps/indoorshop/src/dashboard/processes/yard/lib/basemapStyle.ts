import {
  BUILDING,
  LAND,
  LANDUSE,
  PIER,
  ROADMAJOR,
  ROADMINOR,
  WATER,
} from '../api/basemapFixture'
import {
  SEA_COLOR,
  resolveMapTheme,
  type BasemapLayer,
  type MapTheme,
  type MapThemeSetting,
  type Ring,
} from '../../../shared/features/yard-map/lib/basemapStyle'

/**
 * 옥포 야드 베이스맵 — **fixture 에서 만든 실제 벡터 레이어.**
 *
 * 배색 규약(타입·바다색·테마 해석)은 `shared/features/yard-map` 이 소유하고, 여기서는
 * 그것을 다시 내보내(re-export) 야드 모듈 안의 기존 참조를 그대로 둔다. 이 파일이 더하는
 * 유일한 것은 옥포 지형 데이터(`basemapFixture`)를 shared 의 `BasemapLayer` 형태로 편
 * `BASEMAP_LAYERS` 다 — 이 값이 야드 페이지에서 지도에 props 로 주입된다.
 *
 * 두 벌을 둔다. **어두움**은 OSM 표준 배색을 눕힌 것으로, 지번(원색)과 블록(주황)이
 * 주인공이 되도록 땅·건물·도로를 명도만으로 갈라 둔 것이다. **밝음**은 OSM 표준 배색
 * 그대로이며, 레퍼런스 뷰어(`temp/옥포야드_오프라인지도뷰어.html`)가 쓰던 배색이다.
 */
export { SEA_COLOR, resolveMapTheme }
export type { BasemapLayer, MapTheme, MapThemeSetting, Ring }

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
    { rings: LAND, role: 'land', fill: '#1b222a', closed: true },
    { rings: LANDUSE, role: 'landuse', fill: '#1f272f', closed: true },
    { rings: WATER, role: 'water', fill: SEA_COLOR.dark, closed: true },
    { rings: PIER, role: 'pier', fill: '#242c35', closed: true },
    {
      rings: BUILDING,
      kind: 'building',
      role: 'building',
      fill: '#252d36',
      stroke: '#2c353f',
      lineWidth: 0.5,
      minScale: BUILDING_MIN_SCALE,
      closed: true,
    },
    {
      rings: ROADMINOR,
      role: 'road-minor',
      stroke: '#2f3843',
      lineWidth: 1.2,
      minScale: ROADMINOR_MIN_SCALE,
      closed: false,
    },
    { rings: ROADMAJOR, role: 'road-major', stroke: '#39434e', lineWidth: 2.5, closed: false },
  ],
  light: [
    { rings: LAND, role: 'land', fill: '#f2efe9', stroke: '#9dc3cf', lineWidth: 1, closed: true },
    { rings: LANDUSE, role: 'landuse', fill: '#e6e4dd', closed: true },
    {
      rings: WATER,
      role: 'water',
      fill: SEA_COLOR.light,
      stroke: '#7ab8cc',
      lineWidth: 1,
      closed: true,
    },
    { rings: PIER, role: 'pier', fill: '#d5d0c5', stroke: '#b0aa9d', lineWidth: 2, closed: true },
    {
      rings: BUILDING,
      kind: 'building',
      role: 'building',
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
      role: 'road-minor',
      stroke: '#c9c4bc',
      lineWidth: 3.4,
      minScale: ROADMINOR_MIN_SCALE,
      closed: false,
    },
    {
      rings: ROADMINOR,
      role: 'road-minor',
      stroke: '#ffffff',
      lineWidth: 2.2,
      minScale: ROADMINOR_MIN_SCALE,
      closed: false,
    },
    { rings: ROADMAJOR, role: 'road-major', stroke: '#fcd6a4', lineWidth: 4, closed: false },
  ],
}
