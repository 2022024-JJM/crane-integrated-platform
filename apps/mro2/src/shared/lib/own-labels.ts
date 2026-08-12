import { useCallback, useSyncExternalStore } from 'react';

/**
 * Own Labels (매뉴얼 필터 축 "Own Labels") — 사용자가 자산에 붙이는 개인 라벨.
 * 백엔드가 없으므로 localStorage 에 보관하고 구독자에게 tick 을 발행한다.
 */

const STORAGE_KEY = 'mro2.ownLabels';
const MAX_LABEL_LENGTH = 24;

export type OwnLabelMap = Record<string, string[]>;

/* ── 순수 연산 (테스트 대상) ────────────────────────────────────────── */

export function normalizeLabel(raw: string): string {
  return raw.trim().slice(0, MAX_LABEL_LENGTH);
}

export function addLabelTo(map: OwnLabelMap, craneId: string, raw: string): OwnLabelMap {
  const label = normalizeLabel(raw);
  if (!label) return map;
  const cur = map[craneId] ?? [];
  if (cur.some((l) => l.toLowerCase() === label.toLowerCase())) return map;
  return { ...map, [craneId]: [...cur, label] };
}

export function removeLabelFrom(map: OwnLabelMap, craneId: string, label: string): OwnLabelMap {
  const cur = map[craneId] ?? [];
  const next = cur.filter((l) => l !== label);
  if (next.length === cur.length) return map;
  return { ...map, [craneId]: next };
}

export function collectAllLabels(map: OwnLabelMap): string[] {
  const set = new Set<string>();
  for (const labels of Object.values(map)) for (const l of labels) set.add(l);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/* ── localStorage 스토어 ────────────────────────────────────────────── */

function load(): OwnLabelMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OwnLabelMap) : {};
  } catch {
    return {};
  }
}

let cache: OwnLabelMap = load();
const listeners = new Set<() => void>();

function commit(next: OwnLabelMap): void {
  if (next === cache) return;
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 저장 실패(사파리 프라이빗 모드 등)해도 세션 내 동작은 유지한다
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ── 훅 ─────────────────────────────────────────────────────────────── */

export function useOwnLabels() {
  const map = useSyncExternalStore(subscribe, () => cache);

  const addLabel = useCallback((craneId: string, raw: string) => {
    commit(addLabelTo(cache, craneId, raw));
  }, []);

  const removeLabel = useCallback((craneId: string, label: string) => {
    commit(removeLabelFrom(cache, craneId, label));
  }, []);

  const labelsFor = useCallback((craneId: string): string[] => map[craneId] ?? [], [map]);

  return { map, allLabels: collectAllLabels(map), labelsFor, addLabel, removeLabel };
}
