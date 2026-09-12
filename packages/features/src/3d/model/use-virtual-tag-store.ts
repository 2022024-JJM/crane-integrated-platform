import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import {
  clampVirtualTagTick,
  createEmptyVirtualTagSet,
  loadVirtualTagSet,
  normalizeKeyframes,
  normalizeVirtualTagKey,
  sanitizeScenario,
  sanitizeVirtualTag,
  saveVirtualTagSet,
  SCENARIO_NAME_MAX,
  SCENARIOS_MAX,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  VIRTUAL_TAGS_MAX,
  type ScenarioKeyframe,
  type VirtualScenario,
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
 *
 * 시뮬레이션 시계(2026-09-12): `speed`(배속)·`activeScenarioId` 는 세션 전용
 * (저장 안 함), `scenarios` 는 태그와 같은 세트에 저장된다. 시나리오가 활성인
 * 채 끝에 닿으면(loop 아님) 러너가 알려 와 `pause()` 한다.
 */

/** 배속 허용 범위 — 선택지(SIMULATION_SPEED_OPTIONS) 밖 값도 이 안이면 받는다. */
export const SIMULATION_SPEED_MIN = 0.1;
export const SIMULATION_SPEED_MAX = 16;

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
  scenarios: VirtualScenario[];
  /** 배속(세션). */
  speed: number;
  /** 활성 시나리오 id(세션). 없으면 null = 파형만. */
  activeScenarioId: string | null;
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
  /**
   * 미저장 편집을 마지막 저장(또는 로드) 스냅샷으로 되돌린다. 스토어가
   * 전역이라 관리 페이지를 떠나도 편집본이 남는데, "저장하지 않고 나가기"
   * 는 이 호출로 완성된다. 러너 정의도 함께 되돌린다. dirty 아니면 no-op.
   */
  discard: () => void;
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
  setSpeed: (speed: number) => void;
  /** 활성 시나리오 선택 — 바꾸면 0초로 seek 한다(정지 중에도 첫 자세가 보이게). */
  setActiveScenario: (id: string | null) => void;
  /** 경과 시간 이동(ms). 재생 여부 무관. */
  seek: (elapsedMs: number) => void;
  addScenario: (name?: string) => string | null;
  updateScenario: (
    id: string,
    patch: Partial<Pick<VirtualScenario, 'name' | 'loop'>>,
  ) => boolean;
  removeScenario: (id: string) => void;
  duplicateScenario: (id: string) => string | null;
  /** 트랙 추가 — 이미 있으면 false. 첫 키프레임은 태그 initial(없으면 0) at 0. */
  addScenarioTrack: (scenarioId: string, key: string) => boolean;
  /** 트랙 키프레임 교체(정렬·중복 제거 후). 비면 트랙 삭제. */
  setScenarioTrackKeyframes: (
    scenarioId: string,
    key: string,
    keyframes: readonly ScenarioKeyframe[],
  ) => boolean;
  removeScenarioTrack: (scenarioId: string, key: string) => void;
}

type SetLike = Pick<VirtualTagState, 'tags' | 'tickMs' | 'scenarios'>;

function toSet(state: SetLike): VirtualTagSet {
  const set: VirtualTagSet = {
    version: 1,
    tickMs: state.tickMs,
    tags: state.tags,
  };
  if (state.scenarios.length > 0) set.scenarios = state.scenarios;
  return set;
}

function snapshotOf(state: SetLike): string {
  return JSON.stringify(toSet(state));
}

/** 페이지의 dirty 파생이 스토어와 같은 직렬화를 쓰게 한다. */
export function serializeVirtualTagSet(state: SetLike): string {
  return snapshotOf(state);
}

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(SIMULATION_SPEED_MAX, Math.max(SIMULATION_SPEED_MIN, speed));
}

function nextUniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} ${createId().slice(0, 4)}`;
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
  scenarios: [],
  speed: 1,
  activeScenarioId: null,
  savedSnapshot: snapshotOf({ ...createEmptyVirtualTagSet(), scenarios: [] }),
  hydrated: false,
  isSaving: false,
  isRunning: false,

  load: () => {
    if (get().hydrated) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = loadVirtualTagSet()
      .then((loaded) => {
        const scenarios = loaded.scenarios ?? [];
        set({
          tags: loaded.tags,
          tickMs: loaded.tickMs,
          scenarios,
          savedSnapshot: snapshotOf({ ...loaded, scenarios }),
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
      const scenarios = saved.scenarios ?? [];
      set({
        tags: saved.tags,
        tickMs: saved.tickMs,
        scenarios,
        savedSnapshot: snapshotOf({ ...saved, scenarios }),
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

  discard: () => {
    if (!get().isDirty()) return;
    // 스냅샷은 이 스토어가 toSet 으로 직렬화한 것이라 그대로 믿는다.
    const saved = JSON.parse(get().savedSnapshot) as VirtualTagSet;
    const scenarios = saved.scenarios ?? [];
    const activeScenarioId = scenarios.some(
      (s) => s.id === get().activeScenarioId,
    )
      ? get().activeScenarioId
      : null;
    set({
      tags: saved.tags,
      tickMs: saved.tickMs,
      scenarios,
      activeScenarioId,
    });
    virtualTagRuntime.syncDefinitions(saved.tags);
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
    virtualTagRuntime.start(
      () => {
        const { tags, tickMs, isRunning, speed, scenarios, activeScenarioId } =
          get();
        return {
          tags,
          tickMs,
          isRunning,
          speed,
          scenario: scenarios.find((s) => s.id === activeScenarioId) ?? null,
        };
      },
      // loop 아닌 시나리오가 끝나면 멈춘다 — 다시 ▶ 하면 이어서(끝에서) 돌고,
      // 처음부터 보려면 seek(0)·리셋.
      () => get().pause(),
    );
  },

  pause: () => {
    if (!get().isRunning) return;
    set({ isRunning: false });
    virtualTagRuntime.pause();
  },

  setSpeed: (speed) => {
    const next = clampSpeed(speed);
    if (next === get().speed) return;
    set({ speed: next });
  },

  setActiveScenario: (id) => {
    const next =
      id !== null && get().scenarios.some((s) => s.id === id) ? id : null;
    if (next === get().activeScenarioId) return;
    set({ activeScenarioId: next });
    // 러너 getter 는 스토어를 읽으므로 set 뒤에 seek 하면 새 시나리오 기준.
    ensureRunnerConfig(get);
    virtualTagRuntime.seek(0);
  },

  seek: (elapsedMs) => {
    ensureRunnerConfig(get);
    virtualTagRuntime.seek(elapsedMs);
  },

  addScenario: (name) => {
    const { scenarios } = get();
    if (scenarios.length >= SCENARIOS_MAX) return null;
    const taken = new Set(scenarios.map((s) => s.name));
    const scenario: VirtualScenario = {
      id: createId(),
      name: nextUniqueName(
        (name ?? 'Scenario').trim().slice(0, SCENARIO_NAME_MAX) || 'Scenario',
        taken,
      ),
      loop: false,
      tracks: [],
    };
    set({ scenarios: [...scenarios, scenario] });
    return scenario.id;
  },

  updateScenario: (id, patch) => {
    const { scenarios } = get();
    const index = scenarios.findIndex((s) => s.id === id);
    if (index < 0) return false;
    const merged = sanitizeScenario({ ...scenarios[index], ...patch, id });
    if (!merged) return false;
    const next = scenarios.slice();
    next[index] = merged;
    set({ scenarios: next });
    return true;
  },

  removeScenario: (id) => {
    const { scenarios, activeScenarioId } = get();
    const next = scenarios.filter((s) => s.id !== id);
    if (next.length === scenarios.length) return;
    set({
      scenarios: next,
      activeScenarioId: activeScenarioId === id ? null : activeScenarioId,
    });
  },

  duplicateScenario: (id) => {
    const { scenarios } = get();
    const source = scenarios.find((s) => s.id === id);
    if (!source || scenarios.length >= SCENARIOS_MAX) return null;
    const taken = new Set(scenarios.map((s) => s.name));
    const copy: VirtualScenario = {
      ...structuredClone(source),
      id: createId(),
      name: nextUniqueName(source.name, taken).slice(0, SCENARIO_NAME_MAX),
    };
    set({ scenarios: [...scenarios, copy] });
    return copy.id;
  },

  addScenarioTrack: (scenarioId, key) => {
    const { scenarios, tags } = get();
    const normalized = normalizeVirtualTagKey(key);
    if (normalized === null) return false;
    const index = scenarios.findIndex((s) => s.id === scenarioId);
    if (index < 0) return false;
    const scenario = scenarios[index];
    if (scenario.tracks.some((t) => t.key === normalized)) return false;
    const tag = tags.find((t) => t.key === normalized);
    const next = scenarios.slice();
    next[index] = {
      ...scenario,
      tracks: [
        ...scenario.tracks,
        { key: normalized, keyframes: [{ atMs: 0, value: tag?.initial ?? 0 }] },
      ],
    };
    set({ scenarios: next });
    return true;
  },

  setScenarioTrackKeyframes: (scenarioId, key, keyframes) => {
    const { scenarios } = get();
    const index = scenarios.findIndex((s) => s.id === scenarioId);
    if (index < 0) return false;
    const scenario = scenarios[index];
    if (!scenario.tracks.some((t) => t.key === key)) return false;
    const normalized = normalizeKeyframes(keyframes);
    const tracks =
      normalized.length === 0
        ? scenario.tracks.filter((t) => t.key !== key)
        : scenario.tracks.map((t) =>
            t.key === key ? { key, keyframes: normalized } : t,
          );
    const next = scenarios.slice();
    next[index] = { ...scenario, tracks };
    set({ scenarios: next });
    return true;
  },

  removeScenarioTrack: (scenarioId, key) => {
    const { scenarios } = get();
    const index = scenarios.findIndex((s) => s.id === scenarioId);
    if (index < 0) return;
    const scenario = scenarios[index];
    if (!scenario.tracks.some((t) => t.key === key)) return;
    const next = scenarios.slice();
    next[index] = {
      ...scenario,
      tracks: scenario.tracks.filter((t) => t.key !== key),
    };
    set({ scenarios: next });
  },
}));

/**
 * 정지 상태에서 seek 하려면 러너가 설정 getter 를 갖고 있어야 한다 — 아직 한
 * 번도 start 하지 않았으면 getter 만 붙인다(타이머는 켜지 않음).
 */
function ensureRunnerConfig(get: () => VirtualTagState): void {
  virtualTagRuntime.attachConfig(() => {
    const { tags, tickMs, isRunning, speed, scenarios, activeScenarioId } =
      get();
    return {
      tags,
      tickMs,
      isRunning,
      speed,
      scenario: scenarios.find((s) => s.id === activeScenarioId) ?? null,
    };
  });
}

/** 스토어 밖(테스트·리셋)에서 로드 상태를 초기화할 때 쓴다. */
export function resetVirtualTagLoadState(): void {
  loadPromise = null;
}
