/**
 * 씬의 지역(시간 기준) → 현장 위치(위경도·시간대) 표.
 *
 * 지역은 씬의 현장 시각·낮/밤이 어느 시간대를 기준으로 하는지다. 에디터
 * 배경 탭의 드롭다운으로 고르고(`SavedSceneInfo.siteLocation`, 씬 파일 단위
 * 저장), 모니터링·3D 플레이는 읽기만 한다. 필드가 없는 씬은 region 기본
 * 지역(SCENE_SITE_LOCATION_BY_REGION_ID)을 쓴다.
 *
 * 지역 하나가 시간대와 대표 현장 좌표를 함께 갖는다. 태양 위치는 UTC 시각과
 * 위경도로 정해지므로 시간대만 바꾸면 벽시계와 하늘이 어긋난다 — 좌표는
 * 그 시간대에 있는 조선소(`@crane/domain/region` 의 site `center`)다. 태양
 * 위치는 km 단위 오차에 둔감해(1km ≈ 0.01°) 같은 조선소의 독끼리 좌표를
 * 나누지 않는다. 같은 좌표를 현장 날씨(use-scene-weather)도 쓴다.
 *
 * 시간대는 IANA 이름이다(core/lib/time-zone). 브라우저 로컬이 아니라 현장
 * 시각을 써야 한국에서 필리 조선소 화면을 봐도 필라델피아의 낮/밤이 나온다.
 */

import type { SavedSceneInfo } from './types';

export interface SceneSiteGeo {
  latitude: number;
  longitude: number;
  /** IANA 시간대. 현장 벽시계 ↔ UTC 변환에 쓴다. */
  timeZone: string;
}

/** 드롭다운 순서 그대로다. */
export const SCENE_SITE_LOCATIONS = ['asia-seoul', 'america-new-york'] as const;

export type SceneSiteLocation = (typeof SCENE_SITE_LOCATIONS)[number];

export const SCENE_SITE_GEO_BY_LOCATION: Record<
  SceneSiteLocation,
  SceneSiteGeo
> = {
  // 한화오션 거제(옥포) 조선소
  'asia-seoul': {
    latitude: 34.873071,
    longitude: 128.710288,
    timeZone: 'Asia/Seoul',
  },
  // 필리 조선소(Philly Shipyard, 필라델피아)
  'america-new-york': {
    latitude: 39.8895,
    longitude: -75.1827,
    timeZone: 'America/New_York',
  },
};

/** region 기본 지역 — 씬이 `siteLocation` 을 지정하지 않았을 때. */
export const SCENE_SITE_LOCATION_BY_REGION_ID: Record<
  string,
  SceneSiteLocation
> = {
  'dock-1': 'asia-seoul',
  'dock-2': 'asia-seoul',
  'dock-in': 'asia-seoul',
  // goliath.json 도 philly 지도를 쓰는 씬이라 같은 현장이다.
  goliath: 'america-new-york',
  'philly-dock-2': 'america-new-york',
};

/**
 * 지역 표시 이름 — IANA 시간대 이름 그대로(밑줄만 공백)라 화면 언어와
 * 무관하게 같다. 드롭다운과 시계 패널이 이 이름을 쓴다.
 */
export function formatSceneSiteLocation(location: SceneSiteLocation): string {
  return SCENE_SITE_GEO_BY_LOCATION[location].timeZone.replaceAll('_', ' ');
}

export function isSceneSiteLocation(
  value: unknown,
): value is SceneSiteLocation {
  return (
    typeof value === 'string' &&
    (SCENE_SITE_LOCATIONS as readonly string[]).includes(value)
  );
}

/**
 * 씬의 유효 지역. 명시값(`siteLocation`)이 우선이고, 없으면 region 기본값,
 * 둘 다 없으면 null. 로드 경계의 sanitize 를 거치지 않은 편집 중 상태도
 * 받으므로 목록에 없는 값은 미지정으로 본다.
 */
export function resolveSceneSiteLocation(
  regionId: string,
  sceneInfo: Pick<SavedSceneInfo, 'siteLocation'> | null | undefined,
): SceneSiteLocation | null {
  const explicit = sceneInfo?.siteLocation;
  if (isSceneSiteLocation(explicit)) return explicit;
  return Object.hasOwn(SCENE_SITE_LOCATION_BY_REGION_ID, regionId)
    ? SCENE_SITE_LOCATION_BY_REGION_ID[regionId]
    : null;
}

/** 씬의 현장 위치. 지역이 정해지지 않으면 null(수동 태양으로 폴백). */
export function resolveSceneSiteGeo(
  regionId: string,
  sceneInfo: Pick<SavedSceneInfo, 'siteLocation'> | null | undefined,
): SceneSiteGeo | null {
  const location = resolveSceneSiteLocation(regionId, sceneInfo);
  return location ? SCENE_SITE_GEO_BY_LOCATION[location] : null;
}
