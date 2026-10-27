import { getAssetContentHash, withBaseUrl } from '@crane/core/lib/asset-url';
import type { ScenarioSet } from '../model/types';
import { sanitizeScenarioSet } from './sanitize-scenarios';

/**
 * 시나리오 세트 저장 / 로드 어댑터 — 씬(scene-dev-storage) 과 같은 규칙.
 *
 * - dev (`pnpm dev`): POST /__dev/scenarios → Vite 미들웨어가
 *   public/simulation/scenarios.json 에 기록. git 으로 커밋해 클론·배포의
 *   기준값이 된다. 로드도 항상 그 파일.
 * - 운영 (Docker/nginx): 미들웨어가 없으므로 localStorage 에 **배포 버전
 *   도장(baseVersion = 배포 파일의 콘텐츠 해시)** 과 함께 봉투로 저장한다.
 *   로드는 도장이 현재 배포와 같을 때만 로컬을 쓰고, 아니면 배포본이 이긴다
 *   — 도장이 없으면 한 번 저장한 브라우저가 이후 배포를 영원히 못 본다(씬에서
 *   실제로 겪은 장애).
 *
 * 경로 문자열은 apps/shell/vite.config.ts 에도 한 번 더 있다(그 파일은 이
 * 모듈을 import 할 수 없다). 바꾸면 양쪽을 함께 바꾼다.
 */
export const SCENARIOS_PUBLIC_PATH = '/simulation/scenarios.json';
const DEV_SCENARIOS_API_PATH = '/__dev/scenarios';
export const SCENARIOS_STORAGE_KEY = 'crane:scenarios';

function isDevEnv() {
  return Boolean(import.meta.env.DEV);
}

function isBrowser() {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

/** 이 환경의 저장이 이 브라우저 안에만 남는지(씬의 isSceneStoredLocallyOnly 와 동일). */
export function isScenarioSetStoredLocallyOnly(): boolean {
  return !isDevEnv();
}

interface StoredScenarioEnvelope {
  baseVersion: string | null;
  set: ScenarioSet;
}

function isEnvelope(value: unknown): value is StoredScenarioEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'set' in value &&
    'baseVersion' in value
  );
}

interface StoredRecord {
  set: ScenarioSet;
  isCurrent: boolean;
}

/**
 * 삭제 없이 읽고 신선도만 판정한다. 삭제는 배포본 fetch 성공 뒤에만 —
 * 먼저 지우면 일시 장애 때 로컬 편집까지 잃는다. 봉투 이전 포맷(세트가
 * 그대로 저장된 초기 버전)은 어느 배포 기준인지 알 수 없어 stale 로 본다.
 */
function readRecordFromLocalStorage(): StoredRecord | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(
      '[scenario-storage] Failed to parse localStorage entry. Falling back to deployed file.',
      error,
    );
    return null;
  }

  if (!isEnvelope(parsed)) {
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { set: sanitizeScenarioSet(parsed), isCurrent: false };
  }
  return {
    set: sanitizeScenarioSet(parsed.set),
    isCurrent:
      parsed.baseVersion === getAssetContentHash(SCENARIOS_PUBLIC_PATH),
  };
}

async function loadFromDeployedFile(): Promise<ScenarioSet> {
  const response = await fetch(withBaseUrl(SCENARIOS_PUBLIC_PATH), {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Failed to load scenarios. HTTP ${response.status}`);
  }
  return sanitizeScenarioSet(await response.json());
}

/** 로드의 유일한 경계 — 어디서 왔든 정규화를 거쳐 돌려준다. */
export async function loadScenarioSet(): Promise<ScenarioSet> {
  const stored = isDevEnv() ? null : readRecordFromLocalStorage();
  if (stored?.isCurrent) return stored.set;

  try {
    const deployed = await loadFromDeployedFile();
    if (stored && isBrowser()) {
      window.localStorage.removeItem(SCENARIOS_STORAGE_KEY);
    }
    return deployed;
  } catch (error) {
    if (stored) {
      console.warn(
        '[scenario-storage] Failed to load deployed scenarios. Falling back to stale local copy.',
        error,
      );
      return stored.set;
    }
    throw error;
  }
}

export async function saveScenarioSet(set: ScenarioSet): Promise<ScenarioSet> {
  if (!isDevEnv()) {
    if (!isBrowser()) {
      throw new Error('localStorage is not available in this environment.');
    }
    const envelope: StoredScenarioEnvelope = {
      baseVersion: getAssetContentHash(SCENARIOS_PUBLIC_PATH),
      set,
    };
    window.localStorage.setItem(
      SCENARIOS_STORAGE_KEY,
      JSON.stringify(envelope),
    );
    return set;
  }

  const response = await fetch(DEV_SCENARIOS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(set),
  });
  if (!response.ok) {
    throw new Error(`Failed to save scenarios. HTTP ${response.status}`);
  }
  return sanitizeScenarioSet(await response.json());
}
