/**
 * 씬의 자산 참조(SceneAssetRef)와 배경(SavedEnvironmentInfo)의 로드 경계 방어·
 * 동등 비교. 모델·지도·배경이 같은 규칙을 쓴다.
 */
import type { SavedEnvironmentInfo, SceneAssetRef } from '../model/types';

/**
 * id 가 비어 있지 않은 문자열이고 버전이 1 이상의 정수일 때만 남긴다. 그 밖은
 * undefined — 필드가 빠져 "라이브러리가 모르는 파일" 로 다뤄진다. 버전을 고쳐
 * 맞추지 않는 이유: 어긋난 버전으로 굳히면 에디터가 틀린 버전을 최신이라 본다.
 */
export function sanitizeSceneAssetRef(raw: unknown): SceneAssetRef | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { id, version } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0) return undefined;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return undefined;
  }
  return { id, version };
}

export function isSceneAssetRefEqual(
  a: SceneAssetRef | undefined,
  b: SceneAssetRef | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && a.version === b.version;
}

/** 경로가 없는 배경은 그릴 것이 없다 — undefined(배경 없음)로 떨어진다. */
export function sanitizeSceneEnvironment(
  raw: unknown,
): SavedEnvironmentInfo | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { path, asset } = raw as Record<string, unknown>;
  if (typeof path !== 'string' || path.length === 0) return undefined;
  const safeAsset = sanitizeSceneAssetRef(asset);
  return safeAsset ? { path, asset: safeAsset } : { path };
}

export function isSceneEnvironmentEqual(
  a: SavedEnvironmentInfo | undefined,
  b: SavedEnvironmentInfo | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.path === b.path && isSceneAssetRefEqual(a.asset, b.asset);
}
