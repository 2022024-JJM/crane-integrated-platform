import { JOURNAL_MAX, type JournalEnvelope } from '../model/types';

/**
 * journal localStorage 어댑터 — virtual-tag-storage 의 봉투 관례를 따르되,
 * journal 은 배포 파일 기준값이 없으므로 baseVersion 도장 없이
 * `{version, entries}` 봉투만 쓴다. append-only 라 손상 시 빈 배열로 폴백해도
 * 다음 append 가 정상 봉투로 덮어써 자연 복구된다.
 *
 * localStorage 부재·quota 초과(시크릿 모드 등)는 조용히 no-op — journal 은
 * 편의 이력이지 동작 필수 데이터가 아니다.
 */

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function isEnvelope(value: unknown): value is JournalEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { version?: unknown }).version === 1 &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

/** 최신 먼저 배열을 돌려준다. 손상·부재·버전 불일치는 빈 배열. */
export function readJournal<T>(
  storageKey: string,
  sanitizeEntry: (raw: unknown) => T | null,
): T[] {
  if (!isBrowser()) return [];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(
      `[journal-storage] Failed to parse ${storageKey}. Starting empty.`,
      error,
    );
    return [];
  }
  if (!isEnvelope(parsed)) return [];

  const entries: T[] = [];
  for (const item of parsed.entries) {
    const entry = sanitizeEntry(item);
    if (entry !== null) entries.push(entry);
  }
  return entries.slice(0, JOURNAL_MAX);
}

/**
 * 새 항목을 앞에 붙여 저장하고 병합 결과를 돌려준다. `getKey` 로 기존 항목과
 * 중복을 제거하며(새 항목이 이김), cap(JOURNAL_MAX) 초과분은 오래된 쪽부터
 * 버린다. 새 항목이 없으면 저장 없이 `current` 를 **같은 참조**로 돌려준다.
 */
export function appendJournal<T>(
  storageKey: string,
  current: readonly T[],
  newEntries: readonly T[],
  getKey: (entry: T) => string,
): T[] {
  if (newEntries.length === 0) return current as T[];

  const incomingKeys = new Set(newEntries.map(getKey));
  const merged = [
    ...newEntries,
    ...current.filter((entry) => !incomingKeys.has(getKey(entry))),
  ].slice(0, JOURNAL_MAX);

  if (isBrowser()) {
    const envelope: JournalEnvelope<T> = { version: 1, entries: merged };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch (error) {
      console.warn(`[journal-storage] Failed to persist ${storageKey}.`, error);
    }
  }
  return merged;
}
