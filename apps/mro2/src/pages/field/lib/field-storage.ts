import { useCallback, useSyncExternalStore } from 'react';
import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';

/**
 * 현장 모드가 기기에 기억하는 것 — 작업자 이름과 최근 선택한 자산. 로그인이
 * 공용 계정(crane.MRO2) 하나라 "내가 올린 티켓" 을 가를 기준이 작업자 이름이다
 * (재고 입출고의 담당자 이름과 같은 방식). 백엔드가 없으므로 localStorage.
 */
export const FIELD_WORKER_KEY = 'mro2.field.worker';
export const FIELD_RECENT_KEY = 'mro2.field.recentAssets';
export const FIELD_RECENT_MAX = 5;
export const FIELD_WORKER_MAX = 20;

export function normalizeWorkerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, FIELD_WORKER_MAX);
}

/** 최근 목록 앞에 넣고 중복 제거, 상한으로 자른다. */
export function pushRecent(
  list: readonly string[],
  id: string,
  max: number = FIELD_RECENT_MAX,
): string[] {
  if (!id) return [...list];
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

function readRecent(): string[] {
  const raw = getStorageItem(FIELD_RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

/* ── 구독 가능한 모듈 캐시 ─────────────────────────────────────────── */
const listeners = new Set<() => void>();
let workerCache: string | null = null;
let recentCache: string[] | null = null;

function emit(): void {
  for (const l of listeners) l();
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function getWorker(): string {
  if (workerCache === null)
    workerCache = getStorageItem(FIELD_WORKER_KEY) ?? '';
  return workerCache;
}
function getRecent(): string[] {
  if (recentCache === null) recentCache = readRecent();
  return recentCache;
}

export function useFieldWorker(): [string, (name: string) => void] {
  const worker = useSyncExternalStore(subscribe, getWorker, () => '');
  const set = useCallback((name: string) => {
    workerCache = normalizeWorkerName(name);
    setStorageItem(FIELD_WORKER_KEY, workerCache);
    emit();
  }, []);
  return [worker, set];
}

const EMPTY: string[] = [];
export function useRecentAssets(): [string[], (id: string) => void] {
  const recent = useSyncExternalStore(subscribe, getRecent, () => EMPTY);
  const push = useCallback((id: string) => {
    recentCache = pushRecent(getRecent(), id);
    setStorageItem(FIELD_RECENT_KEY, JSON.stringify(recentCache));
    emit();
  }, []);
  return [recent, push];
}
