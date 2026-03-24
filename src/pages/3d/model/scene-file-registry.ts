const DEFAULT_SCENE_FILE_URL = '/scenes/1dock.json';

const SCENE_FILE_URL_BY_REGION_ID: Record<string, string> = {
  'dock-1': '/scenes/1dock.json',
  'dock-2': DEFAULT_SCENE_FILE_URL,
  'dock-in': DEFAULT_SCENE_FILE_URL,
};

export function getSceneFileUrlByRegionId(regionId: string) {
  return SCENE_FILE_URL_BY_REGION_ID[regionId] ?? DEFAULT_SCENE_FILE_URL;
}
