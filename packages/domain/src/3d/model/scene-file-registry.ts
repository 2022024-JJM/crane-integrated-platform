import {
  SCENE_DIR,
  getKnownRegionIds,
  getSceneFileNameByRegionId,
  isKnownRegionId,
} from './scene-file-map';

/**
 * region → 씬 파일 URL. 표 자체는 scene-file-map(의존성 0)에 있고, 여기서는
 * BASE_URL(sub-path 배포 `/crane_rnd/`)만 씌운다.
 *
 * 미등록 region은 null을 반환한다 — 예전에는 기본 파일(`1dock.json`)로
 * 떨어졌는데, 그 fallback 탓에 "다른 지역을 편집했는데 1dock이 로드되고,
 * 저장하니 1dock이 덮어써지는" 사고가 났다. 모르는 region은 모른다고 답한다.
 */

function withBase(relativeUrl: string): string {
  // Vite가 주입한 BASE_URL (예: '/crane_rnd/') 뒤에 상대 경로를 붙인다.
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${relativeUrl}`;
}

/** 미등록 region은 null. 호출부가 명시적으로 처리해야 한다. */
export function getSceneFileUrlByRegionId(regionId: string): string | null {
  const fileName = getSceneFileNameByRegionId(regionId);
  return fileName ? withBase(`${SCENE_DIR}/${fileName}`) : null;
}

export { getKnownRegionIds, isKnownRegionId };
