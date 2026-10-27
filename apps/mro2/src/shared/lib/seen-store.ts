import { useCallback, useSyncExternalStore } from 'react';

/**
 * "마지막으로 본 시각" — 메모·배정 배지의 기준. 브라우저 로컬이며 사이드(office|field) 별로 따로 둔다.
 * 값은 ref 키(`kind:refId`) → ISO, `*` 는 목록 전체를 본 시각.
 */
export const SEEN_KEY_PREFIX = 'mro2.seen.';
export type SeenMap = Record<string, string>;

const listeners = new Set<() => void>();
const cache = new Map<string, SeenMap>();

function load(scope: string): SeenMap {
  const hit = cache.get(scope);
  if (hit) return hit;
  let v: SeenMap = {};
  try {
    const raw = localStorage.getItem(SEEN_KEY_PREFIX + scope);
    if (raw) v = JSON.parse(raw) as SeenMap;
  } catch {
    v = {};
  }
  cache.set(scope, v);
  return v;
}

export function markSeen(
  scope: string,
  key: string,
  at: string = new Date().toISOString(),
): void {
  const prev = load(scope);
  if (prev[key] && prev[key] >= at) return;
  const next = { ...prev, [key]: at };
  cache.set(scope, next);
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + scope, JSON.stringify(next));
  } catch {
    /* 저장 불가 — 세션 내 캐시만 */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSeen(scope: string): SeenMap {
  const get = useCallback(() => load(scope), [scope]);
  return useSyncExternalStore(subscribe, get, get);
}
