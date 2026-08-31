import type {
  BasemapLayer,
  LatLonBounds,
  MapTheme,
  YardFacility,
} from '../features/yard-map'

/**
 * 야드 지도 배경 데이터 — **타입 계약**.
 *
 * 대시보드가 야드 지도를 배경으로 깔려면 베이스맵 벡터 레이어·전체 범위·지번 색·시설
 * 목록이 필요하다. 이 값들은 옥포 야드 fixture(베이스맵만 ~980KB)에 묶여 있어,
 * `shared` 가 직접 들 수 없고(공정·fixture 를 몰라야 한다) 무게도 초기 번들에 실으면
 * 안 된다. 그래서 **야드 모듈이 `provides.mapBackdrop` 로 lazy 하게 내보내고**,
 * 대시보드는 레지스트리(`fetchYardMapBackdrop`)를 통해 이 계약 타입으로만 읽는다 —
 * 공정존 좌표를 읽는 `ProcessFacilityAnchor` 와 같은 방식이다.
 *
 * 모든 필드가 야드 지도(`shared/features/yard-map`)의 프레젠테이션 계약을 그대로
 * 재사용하므로, 대시보드는 이 묶음을 `YardMap` 에 그대로 주입할 수 있다.
 */
export interface YardMapBackdrop {
  /** 베이스맵 벡터 레이어 (테마별) */
  basemapLayers: Record<MapTheme, BasemapLayer[]>
  /** 야드 전체 범위 — 처음 열 때와 "홈"으로 되돌릴 때 맞추는 자리 */
  extent: LatLonBounds
  /** 지번 성격 → 색 (대시보드는 지번을 그리지 않지만 `YardMap` 이 required 로 요구한다) */
  colorOfCategory: (category: string) => string
  /** 공장·샵 41곳 — 네온 외곽선 배경으로 깐다 */
  facilities: YardFacility[]
}
