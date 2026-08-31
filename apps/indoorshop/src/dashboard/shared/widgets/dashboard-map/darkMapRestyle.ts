import type { BasemapLayer, BasemapRole, MapTheme } from '../../features/yard-map'

/**
 * 어두운 지도 위 지형의 대시보드 배색 — 야드 화면(명도 최소)보다 한 단씩 밝혀 땅·바다·
 * 길·건물이 첫눈에 갈라지게 한다. `minScale: 0` 은 배율 문턱 제거(항상 그리기)다.
 * water 는 손대지 않는다 — 바다는 캔버스 바탕색(SEA_COLOR)과 같아야 이음새가 없다.
 *
 * 대시보드 전용이던 것을 파일로 빼 둔 이유: 도장 배치 화면이 같은 "실제 지도" 룩을
 * 쓴다 — 두 지도가 한 배색을 공유해야 화면을 오갈 때 같은 야드로 읽힌다.
 */
export const DARK_MAP_RESTYLE: Partial<Record<BasemapRole, Partial<BasemapLayer>>> = {
  land: { fill: '#212932', stroke: '#3c4b59', lineWidth: 1.2 },
  landuse: { fill: '#262f38' },
  pier: { fill: '#2c3641', stroke: '#43505d', lineWidth: 1 },
  building: { fill: '#2c3540', stroke: '#3a4551', minScale: 0 },
  'road-minor': { stroke: '#3a4552', minScale: 0 },
  'road-major': { stroke: '#4d5a68', lineWidth: 3 },
}

/**
 * 야드 원본 베이스맵에 위 배색을 입힌다. 역할(role)로 골라 고치므로 야드 화면의 스타일
 * 원본과 배열 순서에는 손대지 않는다. 다크 지도만 쓰는 화면용이라 light 는 통과값이다.
 */
export function restyleDarkBasemap(
  src: Record<MapTheme, BasemapLayer[]>
): Record<MapTheme, BasemapLayer[]> {
  const restyled = src.dark.map((l) =>
    l.role && DARK_MAP_RESTYLE[l.role] ? { ...l, ...DARK_MAP_RESTYLE[l.role] } : l
  )
  return { dark: restyled, light: src.light }
}
