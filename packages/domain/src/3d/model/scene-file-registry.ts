const DEFAULT_SCENE_FILE_URL = 'scenes/1dock.json';

const SCENE_FILE_URL_BY_REGION_ID: Record<string, string> = {
  'dock-1': 'scenes/1dock.json',
  'dock-2': 'scenes/2dock.json',
  'dock-in': 'scenes/dock-in.json',
  goliath: 'scenes/goliath.json',
};

function withBase(relativeUrl: string): string {
  // Vite가 주입한 BASE_URL (예: '/crane_rnd/') 뒤에 상대 경로를 붙인다.
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${relativeUrl}`;
}

export function getSceneFileUrlByRegionId(regionId: string) {
  return withBase(SCENE_FILE_URL_BY_REGION_ID[regionId] ?? DEFAULT_SCENE_FILE_URL);
}

export function getDefaultSceneFileUrl() {
  return withBase(DEFAULT_SCENE_FILE_URL);
}
