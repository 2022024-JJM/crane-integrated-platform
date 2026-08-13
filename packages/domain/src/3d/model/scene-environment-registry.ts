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
