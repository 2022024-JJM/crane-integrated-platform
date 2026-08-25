import type { MapTheme } from './basemapStyle'

/**
 * 3D 보기에서 무엇을 얼마나 세우는가.
 *
 * 야드에는 높이 데이터가 없다 — OSM 건물 윤곽에도, 지번 마스터에도 층수·표고가 없다.
 * 그래서 여기 있는 값은 **측정치가 아니라 표현 상수**다. 목적은 실제 높이를 재현하는
 * 것이 아니라 겹쳐 있는 것들을 갈라 보이게 하는 것이다: 건물은 배경, 감시 정반은
 * 그 안에서 도드라져야 하고, 블록은 그 위에 떠서 어느 지번에 서 있는지 짚혀야 한다.
 *
 * 따라서 값의 **순서**가 값 자체보다 중요하다. 건물보다 낮은 정반은 건물에 묻히고,
 * 정반보다 낮은 블록 표시는 정반 안으로 잠긴다.
 */
export const RELIEF_METERS = {
  /** OSM 건물 — 조선소 공장동은 대개 15~30m 지만, 낮춰야 그 위의 것이 보인다 */
  building: 11,
  /** 감시 대상 정반 — 건물과 비슷한 높이로 세워 "이 건물 안의 이 구획"으로 읽히게 한다 */
  bay: 10,
  /** 블록 표시가 뜨는 높이 — 지면에 그림자 대신 기둥을 내려 자리를 짚는다 */
  block: 24,
} as const

export interface ExtrudeStyle {
  /** 지붕(윗면) */
  roof: string
  roofEdge: string
  /** 옆면 — 빛이 위에서 오므로 지붕보다 어둡다 */
  wall: string
  wallEdge: string
}

/**
 * 세운 것들의 면 색.
 *
 * 밝은 지도에서는 OSM 건물색(#d9d0c9)을 지붕으로 두고 옆면만 눌렀다 — 위에서 보던
 * 색이 기울여도 그대로여야 "같은 건물"로 읽힌다. 어두운 지도도 같은 규칙이다.
 */
export const BUILDING_EXTRUDE: Record<MapTheme, ExtrudeStyle> = {
  dark: {
    roof: '#2c343e',
    roofEdge: '#3b4550',
    wall: '#1d242c',
    wallEdge: '#2a323b',
  },
  light: {
    roof: '#ded5cd',
    roofEdge: '#b9ab9a',
    wall: '#c3b8ab',
    wallEdge: '#a99c8c',
  },
}

/** 정반 옆면은 상태색을 그대로 쓴다 — 색이 곧 상태라 다른 색을 섞으면 안 된다 */
export const BAY_WALL_ALPHA = 0.94
export const BAY_ROOF_ALPHA = 0.5
