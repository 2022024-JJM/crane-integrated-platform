/**
 * region → 현장 위치(위경도·시간대) 표.
 *
 * 3D 씬의 낮/밤·태양 위치(`lighting.sunMode === 'solar'`)가 이 표를 읽는다.
 * 씬 JSON 이 아니라 region 표인 이유: 위치는 씬(배치 데이터)이 아니라
 * 현장의 사실이고, 같은 region 의 여러 씬(리플레이·에디터·모니터링)이
 * 같은 하늘을 봐야 한다. scene-file-map·scene-environment-registry 와 같은
 * 자리의 표다.
 *
 * 위경도는 `@crane/domain/region` 의 `center`(대시보드 지도 핀)와 같은 값을
 * 쓴다 — 태양 위치는 km 단위 오차에 둔감해(1km ≈ 0.01°) 두 표가 조금
 * 어긋나도 화면에 차이가 없지만, 운영 좌표가 확정되면 두 곳을 함께
 * 고친다. 표에 없는 region 은 null — 호출자는 수동 태양(기존 동작)으로
 * 떨어진다.
 *
 * 시간대는 IANA 이름이다(core/lib/time-zone). 브라우저 로컬이 아니라 현장
 * 시각을 써야 한국에서 필리 조선소 화면을 봐도 필라델피아의 낮/밤이 나온다.
 */

export interface SceneSiteGeo {
  latitude: number;
  longitude: number;
  /** IANA 시간대. 현장 벽시계 ↔ UTC 변환에 쓴다. */
  timeZone: string;
}

const GEOJE_OKPO_TIME_ZONE = 'Asia/Seoul';
const PHILADELPHIA_TIME_ZONE = 'America/New_York';

export const SCENE_SITE_GEO_BY_REGION_ID: Record<string, SceneSiteGeo> = {
  // 한화오션 거제(옥포) 조선소
  'dock-1': {
    latitude: 34.871991,
    longitude: 128.695966,
    timeZone: GEOJE_OKPO_TIME_ZONE,
  },
  'dock-2': {
    latitude: 34.874952,
    longitude: 128.703929,
    timeZone: GEOJE_OKPO_TIME_ZONE,
  },
  'dock-in': {
    latitude: 34.865481,
    longitude: 128.70622,
    timeZone: GEOJE_OKPO_TIME_ZONE,
  },
  // 필리 조선소(Philly Shipyard, 필라델피아) — goliath.json 도 philly 지도를
  // 쓰는 씬이라 같은 현장이다(AGENTS.md "philly 두 씬").
  goliath: {
    latitude: 39.8895,
    longitude: -75.1827,
    timeZone: PHILADELPHIA_TIME_ZONE,
  },
  'philly-dock-2': {
    latitude: 39.8895,
    longitude: -75.1827,
    timeZone: PHILADELPHIA_TIME_ZONE,
  },
};

/** 등록된 region 의 현장 위치. 미등록이면 null(수동 태양으로 폴백). */
export function getSceneSiteGeo(regionId: string): SceneSiteGeo | null {
  return SCENE_SITE_GEO_BY_REGION_ID[regionId] ?? null;
}
