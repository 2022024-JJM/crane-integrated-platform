import { getDefaultSceneFileUrl, getSceneFileUrlByRegionId } from '../model/scene-file-registry';
import type { SavedSceneInfo } from '../model/types';

const DEV_SCENE_API_PATH = '/__dev/scene';

function buildSceneDevApiUrl(regionId: string) {
  const searchParams = new URLSearchParams({ regionId });
  return `${DEV_SCENE_API_PATH}?${searchParams.toString()}`;
}

async function loadSceneInfoFromUrl(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load scene info. HTTP ${response.status}`);
  }

  return (await response.json()) as SavedSceneInfo;
}

export async function loadSceneInfoByRegionId(regionId: string) {
  const sceneFileUrl = getSceneFileUrlByRegionId(regionId);

  try {
    return await loadSceneInfoFromUrl(sceneFileUrl);
  } catch (error) {
    if (sceneFileUrl === getDefaultSceneFileUrl()) {
      throw error;
    }

    return loadSceneInfoFromUrl(getDefaultSceneFileUrl());
  }
}

export async function saveSceneInfoByRegionId(
  regionId: string,
  sceneInfo: SavedSceneInfo,
) {
  const response = await fetch(buildSceneDevApiUrl(regionId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sceneInfo),
  });

  if (!response.ok) {
    throw new Error(`Failed to save scene info. HTTP ${response.status}`);
  }

  return (await response.json()) as SavedSceneInfo;
}
