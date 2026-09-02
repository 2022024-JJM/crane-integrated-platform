import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import {
  clampVirtualTagTick,
  createEmptyVirtualTagSet,
  normalizeVirtualTagKey,
  sanitizeVirtualTag,
  sanitizeVirtualTagSet,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAGS_MAX,
  type VirtualTagDefinition,
  type VirtualTagPattern,
  type VirtualTagSet,
} from '@crane/domain/virtual-tag';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 가상 태그 정의 스토어 — 전역(region 무관). localStorage `crane:virtual-tags`
 * 에 봉투(`VirtualTagSet`)로 영속화한다. 서버 태그와 경합하지 않으므로 씬
 * 저장의 baseVersion 도장은 필요 없다.
 *
 * 값(현재값·파형 진행)은 여기 없다 — virtual-tag-runner 의 mutable 런타임이
 * 들고 있고, 이 스토어는 정의와 재생 여부만 React 상태로 둔다. 정의가 바뀌면
 * 러너가 다음 틱에서 반영한다.
 */

export const VIRTUAL_TAGS_STORAGE_KEY = 'crane:virtual-tags';

export interface VirtualTagDraft {
  key: string;
  name?: string;
  unit?: string;
  min?: number;
  max?: number;
  initial?: number;
  pattern?: VirtualTagPattern;
  enabled?: boolean;
}

export type VirtualTagAddResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'invalid-key' | 'duplicate-key' | 'limit' };

interface VirtualTagState {
  tags: VirtualTagDefinition[];
  tickMs: number;
  hydrated: boolean;
  isRunning: boolean;
  hydrate: () => void;
  addTag: (draft: VirtualTagDraft) => VirtualTagAddResult;
  /** 키 변경은 유일성을 검사한다(중복이면 false, 나머지 필드는 적용 안 함). */
  updateTag: (
    id: string,
    patch: Partial<Omit<VirtualTagDefinition, 'id'>>,
  ) => boolean;
  removeTag: (id: string) => void;
  duplicateTag: (id: string) => VirtualTagAddResult;
  setTickMs: (tickMs: number) => void;
  /** 가져오기 — 전체 교체. 손상 항목은 sanitize 가 버린다. */
  replaceAll: (raw: unknown) => void;
  toExport: () => VirtualTagSet;
  start: () => void;
  pause: () => void;
}

function persist(state: Pick<VirtualTagState, 'tags' | 'tickMs'>): void {
  const set: VirtualTagSet = { version: 1, tickMs: state.tickMs, tags: state.tags };
  // 쓰기 실패(쿼터 등)는 safe-storage 가 경고를 남긴다 — 메모리 상태는 유지.
  setStorageJson(VIRTUAL_TAGS_STORAGE_KEY, set);
}

function nextUniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${createId().slice(0, 4)}`;
}

export const useVirtualTagStore = create<VirtualTagState>()((set, get) => ({
  tags: [],
  tickMs: createEmptyVirtualTagSet().tickMs,
  hydrated: false,
  isRunning: false,

  hydrate: () => {
    if (get().hydrated) return;
    const stored = sanitizeVirtualTagSet(
      getStorageJson<unknown>(VIRTUAL_TAGS_STORAGE_KEY),
    );
    set({ tags: stored.tags, tickMs: stored.tickMs, hydrated: true });
    virtualTagRuntime.syncDefinitions(stored.tags);
  },

  addTag: (draft) => {
    const key = normalizeVirtualTagKey(draft.key);
    if (key === null) return { ok: false, reason: 'invalid-key' };
    const { tags } = get();
    if (tags.some((t) => t.key === key)) {
      return { ok: false, reason: 'duplicate-key' };
    }
    if (tags.length >= VIRTUAL_TAGS_MAX) return { ok: false, reason: 'limit' };
    const tag = sanitizeVirtualTag({
      id: createId(),
      key,
      name: draft.name ?? '',
      unit: draft.unit,
      min: draft.min ?? 0,
      max: draft.max ?? 100,
      initial: draft.initial ?? draft.min ?? 0,
      pattern: draft.pattern ?? {
        kind: 'triangle',
        periodMs: VIRTUAL_TAG_PERIOD_DEFAULT,
      },
      enabled: draft.enabled ?? true,
    });
    if (!tag) return { ok: false, reason: 'invalid-key' };
    const next = { tags: [...tags, tag], tickMs: get().tickMs };
    set(next);
    persist(next);
    virtualTagRuntime.syncDefinitions(next.tags);
    return { ok: true, id: tag.id };
  },

  updateTag: (id, patch) => {
    const { tags } = get();
    const index = tags.findIndex((t) => t.id === id);
    if (index < 0) return false;
    const current = tags[index];
    let key = current.key;
    if (patch.key !== undefined) {
      const normalized = normalizeVirtualTagKey(patch.key);
      if (normalized === null) return false;
      if (
        normalized !== current.key &&
        tags.some((t) => t.key === normalized)
      ) {
        return false;
      }
      key = normalized;
    }
    const merged = sanitizeVirtualTag({ ...current, ...patch, id, key });
    if (!merged) return false;
    const nextTags = tags.slice();
    nextTags[index] = merged;
    const next = { tags: nextTags, tickMs: get().tickMs };
    set(next);
    persist(next);
    virtualTagRuntime.syncDefinitions(next.tags);
    return true;
  },

  removeTag: (id) => {
    const { tags } = get();
    const nextTags = tags.filter((t) => t.id !== id);
    if (nextTags.length === tags.length) return;
    const next = { tags: nextTags, tickMs: get().tickMs };
    set(next);
    persist(next);
    virtualTagRuntime.syncDefinitions(next.tags);
  },

  duplicateTag: (id) => {
    const { tags } = get();
    const source = tags.find((t) => t.id === id);
    if (!source) return { ok: false, reason: 'invalid-key' };
    const taken = new Set(tags.map((t) => t.key));
    return get().addTag({
      ...source,
      key: nextUniqueKey(source.key, taken),
    });
  },

  setTickMs: (tickMs) => {
    const clamped = clampVirtualTagTick(tickMs);
    if (clamped === get().tickMs) return;
    const next = { tags: get().tags, tickMs: clamped };
    set(next);
    persist(next);
  },

  replaceAll: (raw) => {
    const stored = sanitizeVirtualTagSet(raw);
    const next = { tags: stored.tags, tickMs: stored.tickMs };
    set({ ...next, hydrated: true });
    persist(next);
    virtualTagRuntime.syncDefinitions(next.tags);
  },

  toExport: () => ({ version: 1, tickMs: get().tickMs, tags: get().tags }),

  start: () => {
    if (get().isRunning) return;
    set({ isRunning: true });
    virtualTagRuntime.start(() => {
      const { tags, tickMs, isRunning } = get();
      return { tags, tickMs, isRunning };
    });
  },

  pause: () => {
    if (!get().isRunning) return;
    set({ isRunning: false });
    virtualTagRuntime.pause();
  },
}));
