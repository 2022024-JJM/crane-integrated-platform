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
  /**
   * 블록 검색 색인 로더 — **첫 검색 때** 부른다(대시보드 초기 무게 불변). 야드의 블록
   * 위치(BTS 계열)를 검색 가능한 형태로 낸다. 새 provides 를 만들지 않고 backdrop 에
   * 얹는 이유: 검색은 이 지도 위에서만 뜻이 있고, 배경 로더를 늘리면 예전처럼 같은
   * 목적의 provides 가 다시 갈라진다 — 배경은 `mapBackdrop` 하나로 둔다.
   */
  blockIndex?: () => Promise<readonly YardBackdropBlock[]>
}

/** 블록 검색 색인의 한 건 — 야드 블록 위치의 대시보드 몫 요약 */
export interface YardBackdropBlock {
  /** 운반 오브젝트 원문 ID (예: `5510_726_S1`) */
  id: string
  /** 호선 번호 */
  projNo: string
  /** 블록 번호 */
  blkNo: string
  /** WGS84 위치 */
  lat: number
  lon: number
  /** 서 있는 지번코드 — 없으면 null (이동 중 등) */
  lot: string | null
  /** 지번의 사람 이름(원본 설명) — 위치 설명 맥락으로만 쓴다 */
  lotLabel: string | null
  /** 마지막 위치 갱신 (`YYYYMMDDHHMMSS`) — 없으면 null */
  updatedAt: string | null
}
