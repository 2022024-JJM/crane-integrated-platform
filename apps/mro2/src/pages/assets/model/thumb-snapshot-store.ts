import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { CraneType } from '@crane/domain/asset';

/**
 * 3D 썸네일 스냅샷 캐시 — 크레인 종류마다 WebGL 로 한 번만 그리고 이미지로 재사용한다.
 * 카드마다 WebGL 컨텍스트를 띄우면 브라우저 한도(16개 안팎)에 걸려 100대에서 깨진다.
 * 종류마다 썸네일 하나(토큰)만 렌더링을 맡고, 나머지는 결과를 기다린다. 맡기·풀기는
 * effect 에서 하므로 StrictMode 의 이중 실행에도 안전하다.
 */
const snapshots = new Map<CraneType, string>();
const claimedBy = new Map<CraneType, symbol>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function getSnapshot(type: CraneType): string | undefined {
  return snapshots.get(type);
}

/** 이 토큰이 렌더링을 맡는다 — 이미 스냅샷이 있거나 다른 토큰이 맡았으면 false. */
export function claimRender(type: CraneType, token: symbol): boolean {
  if (snapshots.has(type)) return false;
  const cur = claimedBy.get(type);
  if (cur && cur !== token) return false;
  if (cur !== token) {
    claimedBy.set(type, token);
    notify();
  }
  return true;
}

/** 맡았던 토큰이 물러난다(언마운트) — 다른 토큰이 맡고 있으면 건드리지 않는다. */
export function releaseRender(type: CraneType, token: symbol): void {
  if (claimedBy.get(type) !== token) return;
  claimedBy.delete(type);
  notify();
}

export function isRenderer(type: CraneType, token: symbol): boolean {
  return claimedBy.get(type) === token;
}

export function publishSnapshot(type: CraneType, dataUrl: string): void {
  if (!dataUrl || snapshots.get(type) === dataUrl) return;
  snapshots.set(type, dataUrl);
  claimedBy.delete(type);
  notify();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useThumbSnapshot(type: CraneType): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => snapshots.get(type),
    () => undefined,
  );
}

/** 이 썸네일이 실제 캔버스를 띄워야 하는지 — 종류별로 하나만 true. */
export function useRenderClaim(type: CraneType): boolean {
  const tokenRef = useRef<symbol | null>(null);
  if (tokenRef.current === null) tokenRef.current = Symbol('thumb');
  const token = tokenRef.current;
  useEffect(() => {
    claimRender(type, token);
    return () => releaseRender(type, token);
  }, [type, token]);
  return useSyncExternalStore(
    subscribe,
    () => isRenderer(type, token),
    () => false,
  );
}

/** 테스트용 초기화 */
export function resetSnapshotsForTest(): void {
  snapshots.clear();
  claimedBy.clear();
}
