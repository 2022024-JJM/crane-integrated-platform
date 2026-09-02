import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import {
  clampVirtualTagTick,
  createEmptyVirtualTagSet,
  loadVirtualTagSet,
  normalizeVirtualTagKey,
  sanitizeVirtualTag,
  saveVirtualTagSet,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAGS_MAX,
  type VirtualTagDefinition,
  type VirtualTagPattern,
  type VirtualTagSet,
} from '@crane/domain/virtual-tag';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 가상 태그 정의 스토어 — 전역(region 무관).
 *
 * 영속화는 씬과 같은 규칙이다(virtual-tag-storage): dev 는 배포 파일
 * `public/simulation/virtual-tags.json` 에, 운영은 localStorage 봉투에.
 * 편집은 메모리에만 쌓이고 `save()` 를 불러야 기록된다 — `isDirty` 는 마지막
 * 저장 스냅샷과의 차이다.
 *
 * 값(현재값·파형 진행)은 여기 없다 — virtual-tag-runner 의 mutable 런타임이
 * 들고 있고, 이 스토어는 정의와 재생 여부만 React 상태로 둔다. 정의가 바뀌면
 * 러너가 다음 틱에서 반영한다.
 */

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
  /** 마지막 저장(또는 로드) 시점의 직렬화 — dirty 판정 기준. */
  savedSnapshot: string;
  hydrated: boolean;
  isSaving: boolean;
  isRunning: boolean;
  /** 배포 파일 로드. 한 번만 실제로 읽고 이후 호출은 no-op. */
  load: () => Promise<void>;
  /** 저장. 성공 true. 실패는 console.error 후 false — 메모리 상태는 유지. */
  save: () => Promise<boolean>;
  isDirty: () => boolean;
  addTag: (draft: VirtualTagDraft) => VirtualTagAddResult;
  /** 키 변경은 유일성을 검사한다(중복이면 false, 나머지 필드는 적용 안 함). */
  updateTag: (
    id: string,
    patch: Partial<Omit<VirtualTagDefinition, 'id'>>,
  ) => boolean;
  removeTag: (id: string) => void;
  duplicateTag: (id: string) => VirtualTagAddResult;
  setTickMs: (tickMs: number) => void;
  start: () => void;
  pause: () => void;
}

function toSet(state: Pick<VirtualTagState, 'tags' | 'tickMs'>): VirtualTagSet {
  return { version: 1, tickMs: state.tickMs, tags: state.tags };
}

function snapshotOf(state: Pick<VirtualTagState, 'tags' | 'tickMs'>): string {
  return JSON.stringify(toSet(state));
}

function nextUniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${createId().slice(0, 4)}`;
}

let loadPromise: Promise<void> | null = null;

export const useVirtualTagStore = create<VirtualTagState>()((set, get) => ({
  tags: [],
  tickMs: createEmptyVirtualTagSet().tickMs,
  savedSnapshot: snapshotOf(createEmptyVirtualTagSet()),
  hydrated: false,
  isSaving: false,
  isRunning: false,

  load: () => {
    if (get().hydrated) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = loadVirtualTagSet()
      .then((loaded) => {
        set({
          tags: loaded.tags,
          tickMs: loaded.tickMs,
          savedSnapshot: snapshotOf(loaded),
          hydrated: true,
        });
        virtualTagRuntime.syncDefinitions(loaded.tags);
      })
      .catch((error: unknown) => {
        // 배포 파일이 없거나(404) 네트워크 장애 — 빈 세트로 시작하되 다음
        // 저장이 새 파일을 만들도록 hydrated 는 세운다.
        console.error('[virtual-tags] Failed to load virtual tags.', error);
        set({ hydrated: true });
      })
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  },

  save: async () => {
    if (get().isSaving) return false;
    set({ isSaving: true });
    try {
      const saved = await saveVirtualTagSet(toSet(get()));
      set({
        tags: saved.tags,
        tickMs: saved.tickMs,
        savedSnapshot: snapshotOf(saved),
        isSaving: false,
      });
      virtualTagRuntime.syncDefinitions(saved.tags);
      return true;
    } catch (error) {
      console.error('[virtual-tags] Failed to save virtual tags.', error);
      set({ isSaving: false });
      return false;
    }
  },

  isDirty: () => snapshotOf(get()) !== get().savedSnapshot,

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
    const nextTags = [...tags, tag];
    set({ tags: nextTags });
    virtualTagRuntime.syncDefinitions(nextTags);
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
    set({ tags: nextTags });
    virtualTagRuntime.syncDefinitions(nextTags);
    return true;
  },

  removeTag: (id) => {
    const { tags } = get();
    const nextTags = tags.filter((t) => t.id !== id);
    if (nextTags.length === tags.length) return;
    set({ tags: nextTags });
    virtualTagRuntime.syncDefinitions(nextTags);
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
    set({ tickMs: clamped });
  },

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

/** 스토어 밖(테스트·리셋)에서 로드 상태를 초기화할 때 쓴다. */
export function resetVirtualTagLoadState(): void {
  loadPromise = null;
}
