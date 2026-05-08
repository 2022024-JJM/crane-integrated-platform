import {
  getDefaultSceneFileUrl,
  getSceneFileUrlByRegionId,
} from '../model/scene-file-registry';
import type { SavedSceneInfo } from '../model/types';

/**
 * Scene 정보 저장 / 로드 어댑터.
 *
 * 환경별 동작:
 * - dev (`pnpm dev`):
 *     POST /__dev/scene → Vite dev 미들웨어가 public/scenes/*.json 파일에 직접 저장.
 *     → 개발자가 git 으로 커밋해서 기본 scene 을 갱신할 수 있다.
 * - 운영 (Docker/nginx):
 *     localStorage 에 저장. nginx 에는 /__dev/scene 엔드포인트가 없으므로 사용 불가.
 *     → 사용자별/브라우저별로 분리 저장되며, 빈 상태에서는 public/scenes 의 기본값을 보여준다.
 *
 * TODO(backend): 운영용 백엔드 API 가 준비되면 운영 분기를 fetch('/api/scene/<regionId>')
 *   호출로 교체한다. 호출부(saveSceneInfoByRegionId / loadSceneInfoByRegionId) 는 그대로 두고
 *   이 파일 내부 분기만 수정하면 된다.
 */

const DEV_SCENE_API_PATH = '/__dev/scene';
const LOCAL_STORAGE_KEY_PREFIX = 'crane:scene:';

function buildSceneDevApiUrl(regionId: string) {
  const searchParams = new URLSearchParams({ regionId });
  return `${DEV_SCENE_API_PATH}?${searchParams.toString()}`;
}

function buildLocalStorageKey(regionId: string) {
  return `${LOCAL_STORAGE_KEY_PREFIX}${regionId}`;
}

function isDevEnv() {
  return Boolean(import.meta.env.DEV);
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

function loadSceneInfoFromLocalStorage(regionId: string): SavedSceneInfo | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(buildLocalStorageKey(regionId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SavedSceneInfo;
  } catch (error) {
    console.warn(
      `[scene-storage] Failed to parse localStorage entry for region "${regionId}". Falling back to default.`,
      error,
    );
    return null;
  }
}

function saveSceneInfoToLocalStorage(
  regionId: string,
  sceneInfo: SavedSceneInfo,
) {
  if (!isBrowser()) {
    throw new Error('localStorage is not available in this environment.');
  }

  window.localStorage.setItem(
    buildLocalStorageKey(regionId),
    JSON.stringify(sceneInfo),
  );
}

export async function loadSceneInfoByRegionId(regionId: string) {
  // 운영: 사용자가 편집해 둔 localStorage 값이 있으면 우선 사용.
  if (!isDevEnv()) {
    const cached = loadSceneInfoFromLocalStorage(regionId);
    if (cached) return cached;
  }

  // dev / 운영(localStorage 비어있음) 모두 빌드 시점에 박힌 기본 scene 으로 fallback.
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
  // 운영: localStorage 에 저장. 백엔드 API 도입 시 이 분기를 교체한다.
  if (!isDevEnv()) {
    saveSceneInfoToLocalStorage(regionId, sceneInfo);
    return sceneInfo;
  }

  // dev: Vite 미들웨어가 public/scenes/*.json 파일에 직접 기록.
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
