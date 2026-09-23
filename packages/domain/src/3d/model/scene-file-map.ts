/**
 * region → 씬 파일명 매핑의 **단일 소스**.
 *
 * 이 파일은 의존성이 0이다(React·three·import.meta 사용 금지). 브라우저
 * 런타임(scene-file-registry)과 Node 컨텍스트인 `apps/shell/vite.config.ts`의
 * dev 저장 미들웨어가 **같은 표를 읽어야** 하기 때문이다.
 *
 * 예전에는 두 곳에 표가 복붙돼 있었다. 지금은 일치하더라도 한쪽만 고치는
 * 순간 저장과 로드가 서로 다른 파일을 가리키게 되고, 그 결과는 조용한
 * 씬 파일 파괴다. 그래서 표를 하나로 묶고, 미등록 region은 양쪽 모두
 * "모른다"고 답하도록(null) 만들었다 — 기본 파일로 떨어지는 fallback은
 * 남의 씬을 덮어쓰는 사고의 직접적 원인이었다.
 *
 * 여러 region 이 한 파일을 **공유**할 수 있다(옥포 dock-1·dock-2 → okpo.json).
 * 지도·모델 구성은 하나이고 region 별로 다른 것은 카메라뿐이라, 씬 JSON 의
 * `cameraByRegion` 슬롯에 region 별 카메라를 두고 `camera` 는 폴백이다
 * (lib/scene-region-camera.ts). 두 region 의 에디터 탭이 동시에 저장하면
 * 마지막 저장이 이긴다.
 */

/** 씬 파일 이름 (public/scenes/ 기준). */
export const SCENE_FILE_NAME_BY_REGION_ID: Record<string, string> = {
  'dock-1': 'okpo.json',
  'dock-2': 'okpo.json',
  'dock-in': 'dock-in.json',
  goliath: 'goliath.json',
  'philly-dock-2': 'philly-2dock.json',
};

/** public 디렉터리 안에서 씬 파일이 놓이는 하위 경로. */
export const SCENE_DIR = 'scenes';

/**
 * 등록된 region인지 확인한다. 저장처럼 되돌릴 수 없는 작업은 반드시
 * 이걸로 먼저 걸러야 한다.
 */
export function isKnownRegionId(regionId: string): boolean {
  return Object.hasOwn(SCENE_FILE_NAME_BY_REGION_ID, regionId);
}

/**
 * region의 씬 파일 상대 경로(`scenes/xxx.json`). 미등록이면 **null**.
 *
 * null을 기본 파일로 대체하지 말 것 — 그 fallback이 "다른 지역을 편집한 줄
 * 알았는데 1dock을 덮어썼다"는 사고를 만들었다.
 */
export function getSceneFileNameByRegionId(regionId: string): string | null {
  return SCENE_FILE_NAME_BY_REGION_ID[regionId] ?? null;
}

/** 등록된 모든 region id. 에러 메시지에 후보를 보여줄 때 쓴다. */
export function getKnownRegionIds(): string[] {
  return Object.keys(SCENE_FILE_NAME_BY_REGION_ID);
}

/**
 * 이 region 의 씬 파일을 다른 region 도 쓰는가. 공유 파일에서는 카메라를
 * `cameraByRegion` 슬롯에 저장한다(scene-region-camera.ts). 미등록이면 false.
 */
export function isSceneFileShared(regionId: string): boolean {
  const fileName = SCENE_FILE_NAME_BY_REGION_ID[regionId];
  if (!fileName) return false;
  let count = 0;
  for (const name of Object.values(SCENE_FILE_NAME_BY_REGION_ID)) {
    if (name === fileName) count += 1;
  }
  return count > 1;
}
