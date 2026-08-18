import {
  getKnownRegionIds,
  getSceneFileUrlByRegionId,
  isKnownRegionId,
} from '../model/scene-file-registry';
import type { SavedSceneInfo } from '../model/types';
import { sanitizeSceneInfo } from './sanitize-scene-info';

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

/**
 * 이 환경의 저장이 **이 브라우저 안에만** 남는지 여부.
 *
 * dev는 파일(public/scenes/*.json)에 쓰므로 커밋해 공유할 수 있지만, 운영은
 * localStorage뿐이라 캐시를 지우거나 다른 PC·다른 사람이 열면 존재하지 않는다.
 * 그런데 화면은 둘을 똑같이 "저장됨"으로 표시해 왔다 — 사용자는 배포됐다고
 * 믿는데 실제로는 자기 브라우저에만 있는 상태다. UI가 이 차이를 밝히도록
 * 노출한다. 백엔드 API가 붙으면 이 함수는 false를 반환하게 된다.
 */
export function isSceneStoredLocallyOnly(): boolean {
  return !isDevEnv();
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

/** 미등록 region을 다룰 때 던지는 에러. 호출부가 메시지를 그대로 보여준다. */
export class UnknownRegionError extends Error {
  // 파라미터 프로퍼티(readonly regionId) 문법은 erasableSyntaxOnly에서 금지된다.
  readonly regionId: string;

  constructor(regionId: string) {
    super(
      `등록되지 않은 지역입니다: "${regionId}". 등록된 지역: ${getKnownRegionIds().join(', ')}`,
    );
    this.name = 'UnknownRegionError';
    this.regionId = regionId;
  }
}

/**
 * 씬 로드의 유일한 경계. 어디서 왔든(파일/localStorage) **정규화를 거쳐서만**
 * 반환한다 — 에디터·뷰어·리플레이가 같은 데이터를 보게 하는 지점이다.
 * 예전에는 에디터만 정규화해서, legacy 단수 `map` 씬이 뷰어에서 지형 없이
 * 떴다(sanitize-scene-info 주석 참고).
 */
export async function loadSceneInfoByRegionId(regionId: string) {
  // 운영: 사용자가 편집해 둔 localStorage 값이 있으면 우선 사용.
  if (!isDevEnv()) {
    const cached = loadSceneInfoFromLocalStorage(regionId);
    if (cached) return sanitizeSceneInfo(cached);
  }

  const sceneFileUrl = getSceneFileUrlByRegionId(regionId);

  // 미등록 region은 기본 파일로 떨어뜨리지 않는다. 예전에는 1dock.json을
  // 대신 보여줬는데, 사용자는 그 지역의 씬을 편집한다고 믿은 채로 저장해
  // 1dock을 덮어썼다. 로드 단계에서 명확히 실패해야 그 경로가 끊긴다.
  if (!sceneFileUrl) {
    throw new UnknownRegionError(regionId);
  }

  // 파일이 404여도 다른 지역 파일로 대체하지 않는다 — 같은 이유다.
  return sanitizeSceneInfo(await loadSceneInfoFromUrl(sceneFileUrl));
}

export async function saveSceneInfoByRegionId(
  regionId: string,
  sceneInfo: SavedSceneInfo,
) {
  // 저장은 되돌릴 수 없으므로 가장 먼저 막는다. dev에서는 미등록 region이
  // 기본 파일(1dock.json)로 떨어져 남의 씬을 덮어썼다.
  if (!isKnownRegionId(regionId)) {
    throw new UnknownRegionError(regionId);
  }

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
