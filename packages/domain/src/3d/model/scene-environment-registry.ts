/**
 * region → 씬 배경(등장방형 파노라마 EXR) 매핑.
 *
 * 등록된 region만 스카이박스 배경을 얻고, 나머지는 기존 단색 배경을
 * 유지한다. 파일은 apps/shell/public/scenes/에 두며, scene-file-registry와
 * 같은 규칙으로 BASE_URL(sub-path 배포 /crane_rnd/)을 씌워 반환한다.
 */

/**
 * -web 파일은 원본을 4096×2048 half-float/DWAA로 리사이즈한 웹 배포용이다.
 * 원본(9K/6.5K)은 MAX_TEXTURE_SIZE 8192인 GPU에서 업로드가 실패해 배경이
 * 검게 나오고, GPU 메모리도 수백 MB를 먹는다 — 원본을 직접 등록하지 말 것.
 */
import { getSceneEnvironmentById } from './scene-environment-catalog';

const ENVIRONMENT_FILE_URL_BY_REGION_ID: Record<string, string> = {
  // 교체 후보: 'scenes/sky-blue-open-water-web.exr'
  // (수평선 RED 채널이 0인 에셋 특성상 네온 시안으로 보인다)
  'philly-dock-2': 'scenes/overcast-sky-over-the-atlantic-web.exr',
};

function withBase(relativeUrl: string): string {
  // Vite가 주입한 BASE_URL (예: '/crane_rnd/') 뒤에 상대 경로를 붙인다.
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${relativeUrl}`;
}

/** 매핑이 없는 region은 null — 배경 컴포넌트가 아예 마운트하지 않는다. */
export function getEnvironmentFileUrlByRegionId(regionId: string): string | null {
  const relativeUrl = ENVIRONMENT_FILE_URL_BY_REGION_ID[regionId];
  return relativeUrl ? withBase(relativeUrl) : null;
}

/**
 * 씬의 배경 선택을 최종 URL로 해석한다. 우선순위:
 *
 *  1. `environmentId`가 문자열 → 카탈로그에서 찾은 파일. 사용자가 에디터에서
 *     고른 값이므로 region 기본값을 덮는다.
 *  2. `environmentId`가 null → 배경 없음. "명시적으로 껐다"는 뜻이라
 *     region 기본값으로 되돌아가지 않는다.
 *  3. `environmentId`가 undefined → 배경을 지정한 적 없는 씬. region 기본값을
 *     쓴다. 이 경로 덕분에 기존 저장본이 하늘을 잃지 않는다.
 *
 * 카탈로그에 없는 id(에셋이 빠졌거나 오타)는 배경 없음으로 떨어진다 —
 * 404를 로더까지 끌고 가 Suspense를 영구히 매달리게 두지 않는다.
 */
export function resolveEnvironmentFileUrl(
  regionId: string,
  environmentId: string | null | undefined,
): string | null {
  if (environmentId === null) return null;
  if (environmentId === undefined) {
    return getEnvironmentFileUrlByRegionId(regionId);
  }
  const item = getSceneEnvironmentById(environmentId);
  return item ? withBase(item.path) : null;
}
