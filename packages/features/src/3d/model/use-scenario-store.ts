import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  clampVirtualTagTick,
  createEmptyScenarioSet,
  loadScenarioSet,
  SCENARIO_NAME_MAX,
  SCENARIO_TAGS_MAX,
  SCENARIOS_MAX,
  sanitizeScenario,
  sanitizeScenarioTag,
  saveScenarioSet,
  scenarioTagKey,
  type ScenarioSet,
  type ScenarioTag,
  type SimulationScenario,
} from '@crane/domain/virtual-tag';
import {
  collectScenarioEntries,
  type ScenarioTagIssue,
  type VirtualTagEntry,
} from '../lib/scenario-entries';
import { rigValueStore } from './rig-value-store';
import { tagLiveValues } from './tag-value-bus';
import { useRealtimeStore } from './use-realtime-store';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 시나리오 스토어 — 전역. 시나리오 목록과 활성 시나리오, 그리고 활성
 * 시나리오를 **붙어 있는 씬**으로 편 평탄 목록(`entries`)을 든다. 러너·
 * 리포트·패널이 보는 것은 이 평탄 목록이고, 시나리오·씬·활성이 바뀔 때마다
 * `commit` 한 곳에서 다시 만들어 러너에 `syncDefinitions` 한다.
 *
 * 씬은 3D 플레이 뷰가 `attachScene` 으로 넣는다(언마운트에 null). 시나리오는
 * 씬 파일 단위라 그 파일의 것만 활성 후보다.
 *
 * 영속화는 씬과 같은 규칙이다(scenario-storage): dev 는 배포 파일
 * `public/simulation/scenarios.json` 에, 운영은 localStorage 봉투에. 편집은
 * 메모리에만 쌓이고 `save()` 를 불러야 기록된다 — `isDirty` 는 마지막 저장
 * 스냅샷과의 차이다.
 *
 * 값(현재값·파형 진행)은 여기 없다 — virtual-tag-runner 의 mutable 런타임이
 * 들고 있고, 이 스토어는 정의와 재생 여부만 React 상태로 둔다. 배속 `speed`
 * 와 활성 시나리오는 세션 전용(저장 안 함).
 *
 * 시간 단위: 저장본·스토어는 초(`tickSec`), 러너 시계는 ms — `runnerConfig`
 * 가 바꿔 넘긴다.
 */

/** 배속 허용 범위 — 선택지(SIMULATION_SPEED_OPTIONS) 밖 값도 이 안이면 받는다. */
export const SIMULATION_SPEED_MIN = 0.1;
export const SIMULATION_SPEED_MAX = 16;

export interface ScenarioDraft {
  name: string;
  sceneFile: string;
  /** id 없이 받는다 — 스토어가 붙인다. */
  tags?: readonly Omit<ScenarioTag, 'id'>[];
}

export type ScenarioAddResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'invalid-name' | 'limit' };

/** 여러 태그를 한 번에 넣은 결과 — 선택 다이얼로그가 쓴다. */
export interface ScenarioTagAddResult {
  added: number;
  /** `(modelId, code)` 중복·상한·손상으로 넣지 못한 수. */
  skipped: number;
}

/** 묶음 태그 수정(체크 차집합)을 적용한 결과. */
export interface ScenarioTagEditResult extends ScenarioTagAddResult {
  /** 키로 지운 수. 모르는 키는 세지 않는다. */
  removed: number;
}

export interface ScenarioTagEdit {
  /** 새로 체크한 태그 — id 없이 받는다. */
  add: readonly Omit<ScenarioTag, 'id'>[];
  /** 체크를 푼 태그의 `(modelId, code)` 키(`scenarioTagKey`). */
  removeKeys: readonly string[];
}

interface ScenarioState {
  scenarios: SimulationScenario[];
  /** 재생·편집 대상(세션). 붙은 씬 파일의 시나리오 중 하나이거나 null. */
  activeScenarioId: string | null;
  /** 3D 플레이 뷰가 붙인 씬. 키 조립의 원천. */
  sceneInfo: SavedSceneInfo | null;
  /** 붙은 씬의 파일 이름 — 시나리오 필터. */
  sceneFile: string | null;
  /** 활성 시나리오 × 붙은 씬의 평탄 목록 — commit 할 때만 새 참조. */
  entries: VirtualTagEntry[];
  /** 평탄화에서 건너뛴 태그와 이유 — 패널이 amber 로 보인다. */
  issues: ScenarioTagIssue[];
  /** 값 갱신 주기(초). */
  tickSec: number;
  /** 배속(세션). */
  speed: number;
  /**
   * 시뮬레이션 세션이 살아 있는지 — 한 번 재생한 뒤 종료(stop) 전까지 true.
   * 일시정지 중에도 true 라 "시뮬레이션 값이 화면에 남아 있다" 를 표시한다.
   */
  hasSession: boolean;
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
   * 전역이라 3D 플레이를 떠나도 편집본이 남는데, "저장하지 않고 나가기" 는
   * 이 호출로 완성된다. 러너 정의도 함께 되돌린다. dirty 아니면 no-op.
   */
  discard: () => void;

  /** 씬을 붙인다/뗀다. 활성 시나리오가 그 씬 파일 것이 아니면 첫 것으로. */
  attachScene: (
    sceneInfo: SavedSceneInfo | null,
    sceneFile: string | null,
  ) => void;
  /**
   * 활성 시나리오 변경. 재생 중이면 일시정지하고 시간 0·initial 로 되돌린 뒤
   * 새 정의로 동기화한다 — 시나리오는 시간 0 에서 시작한다.
   */
  setActiveScenario: (id: string | null) => void;

  addScenario: (draft: ScenarioDraft) => ScenarioAddResult;
  /** 이름 변경. 빈 이름·없는 id 면 false. */
  renameScenario: (id: string, name: string) => boolean;
  /** 삭제. 활성이면 같은 씬 파일의 다음 것으로(없으면 null). */
  removeScenario: (id: string) => void;
  /** 태그까지 새 id 로 복제. 이름에 접미사. */
  duplicateScenario: (id: string) => ScenarioAddResult;

  /** 태그 추가 — `(modelId, code)` 가 겹치는 것·손상은 건너뛴다. */
  addTags: (
    scenarioId: string,
    tags: readonly Omit<ScenarioTag, 'id'>[],
  ) => ScenarioTagAddResult;
  /**
   * 묶음 태그 수정 — 체크를 푼 태그를 키로 지우고 새로 체크한 태그를 넣는
   * 것을 commit 한 번에 한다. 남는 태그의 정의는 그대로다. 모르는 키·중복·
   * 손상·상한은 건너뛰고, 바뀐 것이 없으면 참조를 유지한다.
   */
  editTags: (
    scenarioId: string,
    edit: ScenarioTagEdit,
  ) => ScenarioTagEditResult;
  /** 태그 정의 수정. 손상이면 false 이고 아무것도 적용하지 않는다. */
  updateTag: (
    scenarioId: string,
    tagId: string,
    patch: Partial<Omit<ScenarioTag, 'id' | 'modelId' | 'code'>>,
  ) => boolean;
  /** 모델의 태그 전부 제거(패널의 묶음 ✕). */
  removeModelTags: (scenarioId: string, modelId: string) => void;

  setTickSec: (tickSec: number) => void;
  start: () => void;
  pause: () => void;
  /**
   * 시뮬레이션 종료 — 관제 원래 상태로. 일시정지와 달리 자세를 남기지 않는다:
   * 러너 정지·시간 0, 값 저장소를 비워 모델이 rest(씬 배치)로 돌아가고,
   * 시뮬레이션이 남긴 live 값을 지워 운전 상태가 미확인이 되며, 실시간 화면
   * 반영 보류가 걸려 있었으면 풀어 다음 수신 값부터 실제 자세를 따라간다.
   * 배속도 1 로. 정의는 그대로다. 모니터링·에디터 화면 진입과 이탈에서도
   * 이걸 불러 화면마다 깨끗한 시뮬레이션으로 시작한다.
   */
  stop: () => void;
  setSpeed: (speed: number) => void;
  /** 경과 시간 이동(ms). 재생 여부 무관. */
  seek: (elapsedMs: number) => void;
}

type SetLike = Pick<ScenarioState, 'scenarios' | 'tickSec'>;

function toSet(state: SetLike): ScenarioSet {
  return { version: 1, tickSec: state.tickSec, scenarios: state.scenarios };
}

function snapshotOf(state: SetLike): string {
  return JSON.stringify(toSet(state));
}

/** 페이지의 dirty 파생이 스토어와 같은 직렬화를 쓰게 한다. */
export function serializeScenarioSet(state: SetLike): string {
  return snapshotOf(state);
}

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 1;
  return Math.min(SIMULATION_SPEED_MAX, Math.max(SIMULATION_SPEED_MIN, speed));
}

function normalizeName(raw: string): string | null {
  const name = raw.trim().slice(0, SCENARIO_NAME_MAX);
  return name.length > 0 ? name : null;
}

/** 붙은 씬 파일의 시나리오만. 파일이 없으면 빈 목록. */
export function scenariosOfSceneFile(
  scenarios: readonly SimulationScenario[],
  sceneFile: string | null,
): SimulationScenario[] {
  if (!sceneFile) return [];
  return scenarios.filter((s) => s.sceneFile === sceneFile);
}

/** 활성 후보 — 지금 활성이 그 파일 것이면 유지, 아니면 그 파일의 첫 것. */
function resolveActiveId(
  scenarios: readonly SimulationScenario[],
  sceneFile: string | null,
  current: string | null,
): string | null {
  const candidates = scenariosOfSceneFile(scenarios, sceneFile);
  if (current && candidates.some((s) => s.id === current)) return current;
  return candidates[0]?.id ?? null;
}

let loadPromise: Promise<void> | null = null;

export const useScenarioStore = create<ScenarioState>()((set, get) => {
  /**
   * 시나리오 목록·활성·씬 교체 — 평탄 목록을 파생하고 러너에 동기화한다.
   * 세 값 중 바뀐 것만 넘긴다.
   */
  const commit = (
    patch: Partial<
      Pick<
        ScenarioState,
        'scenarios' | 'activeScenarioId' | 'sceneInfo' | 'sceneFile'
      >
    >,
  ) => {
    const prev = get();
    const scenarios = patch.scenarios ?? prev.scenarios;
    const sceneInfo =
      'sceneInfo' in patch ? (patch.sceneInfo ?? null) : prev.sceneInfo;
    const sceneFile =
      'sceneFile' in patch ? (patch.sceneFile ?? null) : prev.sceneFile;
    const requested =
      'activeScenarioId' in patch
        ? (patch.activeScenarioId ?? null)
        : prev.activeScenarioId;
    const activeScenarioId = resolveActiveId(scenarios, sceneFile, requested);
    const active = scenarios.find((s) => s.id === activeScenarioId) ?? null;
    const { entries, issues } = collectScenarioEntries(active, sceneInfo);
    set({ scenarios, sceneInfo, sceneFile, activeScenarioId, entries, issues });
    virtualTagRuntime.syncDefinitions(entries);
  };

  /** 시나리오 하나를 바꾼 새 목록으로 commit. 없으면 false. */
  const replaceScenario = (
    id: string,
    update: (scenario: SimulationScenario) => SimulationScenario | null,
  ): boolean => {
    const { scenarios } = get();
    const index = scenarios.findIndex((s) => s.id === id);
    if (index < 0) return false;
    const next = update(scenarios[index]);
    if (!next) return false;
    // 같은 참조 = 바뀐 것이 없다 — 목록·entries 참조를 유지한다(dirty 오탐 방지).
    if (next === scenarios[index]) return true;
    const list = scenarios.slice();
    list[index] = next;
    commit({ scenarios: list });
    return true;
  };

  /** 러너 설정 — 저장본의 초를 러너 시계의 ms 로(정수, 고정 스텝 경계가 어긋나지 않게). */
  const runnerConfig = () => {
    const { entries, tickSec, isRunning, speed } = get();
    return { entries, tickMs: Math.round(tickSec * 1000), isRunning, speed };
  };

  /** 재생 중이면 멈추고 시간 0·initial 로 — 시나리오 전환·삭제의 공통 전처리. */
  const rewindIfRunning = () => {
    if (!get().isRunning) return;
    virtualTagRuntime.pause();
    set({ isRunning: false });
    virtualTagRuntime.resetValues(false);
  };

  return {
    scenarios: [],
    activeScenarioId: null,
    sceneInfo: null,
    sceneFile: null,
    entries: [],
    issues: [],
    tickSec: createEmptyScenarioSet().tickSec,
    speed: 1,
    hasSession: false,
    savedSnapshot: snapshotOf(createEmptyScenarioSet()),
    hydrated: false,
    isSaving: false,
    isRunning: false,

    load: () => {
      if (get().hydrated) return Promise.resolve();
      if (loadPromise) return loadPromise;
      loadPromise = loadScenarioSet()
        .then((loaded) => {
          commit({ scenarios: loaded.scenarios });
          set({
            tickSec: loaded.tickSec,
            savedSnapshot: snapshotOf(loaded),
            hydrated: true,
          });
        })
        .catch((error: unknown) => {
          // 배포 파일이 없거나(404) 네트워크 장애 — 빈 세트로 시작하되 다음
          // 저장이 새 파일을 만들도록 hydrated 는 세운다.
          console.error('[scenarios] Failed to load scenarios.', error);
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
        const saved = await saveScenarioSet(toSet(get()));
        commit({ scenarios: saved.scenarios });
        set({
          tickSec: saved.tickSec,
          savedSnapshot: snapshotOf(saved),
          isSaving: false,
        });
        return true;
      } catch (error) {
        console.error('[scenarios] Failed to save scenarios.', error);
        set({ isSaving: false });
        return false;
      }
    },

    isDirty: () => snapshotOf(get()) !== get().savedSnapshot,

    discard: () => {
      if (!get().isDirty()) return;
      // 스냅샷은 이 스토어가 toSet 으로 직렬화한 것이라 그대로 믿는다.
      const saved = JSON.parse(get().savedSnapshot) as ScenarioSet;
      commit({ scenarios: saved.scenarios });
      set({ tickSec: saved.tickSec });
    },

    attachScene: (sceneInfo, sceneFile) => {
      const prev = get();
      if (prev.sceneInfo === sceneInfo && prev.sceneFile === sceneFile) return;
      commit({ sceneInfo, sceneFile });
    },

    setActiveScenario: (id) => {
      if (id === get().activeScenarioId) return;
      rewindIfRunning();
      commit({ activeScenarioId: id });
    },

    addScenario: (draft) => {
      const name = normalizeName(draft.name);
      if (name === null) return { ok: false, reason: 'invalid-name' };
      const { scenarios } = get();
      if (scenarios.length >= SCENARIOS_MAX)
        return { ok: false, reason: 'limit' };
      const scenario = sanitizeScenario({
        id: createId(),
        name,
        sceneFile: draft.sceneFile,
        tags: (draft.tags ?? []).map((tag) => ({ ...tag, id: createId() })),
      });
      if (!scenario) return { ok: false, reason: 'invalid-name' };
      commit({
        scenarios: [...scenarios, scenario],
        activeScenarioId: scenario.id,
      });
      return { ok: true, id: scenario.id };
    },

    renameScenario: (id, raw) => {
      const name = normalizeName(raw);
      if (name === null) return false;
      return replaceScenario(id, (scenario) =>
        scenario.name === name ? scenario : { ...scenario, name },
      );
    },

    removeScenario: (id) => {
      const { scenarios, activeScenarioId } = get();
      const next = scenarios.filter((s) => s.id !== id);
      if (next.length === scenarios.length) return;
      if (activeScenarioId === id) rewindIfRunning();
      // 활성이었으면 같은 씬 파일의 첫 것으로(resolveActiveId 가 고른다).
      commit({
        scenarios: next,
        activeScenarioId: activeScenarioId === id ? null : activeScenarioId,
      });
    },

    duplicateScenario: (id) => {
      const { scenarios } = get();
      const source = scenarios.find((s) => s.id === id);
      if (!source) return { ok: false, reason: 'invalid-name' };
      if (scenarios.length >= SCENARIOS_MAX)
        return { ok: false, reason: 'limit' };
      const copy: SimulationScenario = {
        ...source,
        id: createId(),
        name: normalizeName(`${source.name} 2`) ?? source.name,
        tags: source.tags.map((tag) => ({ ...tag, id: createId() })),
      };
      commit({ scenarios: [...scenarios, copy], activeScenarioId: copy.id });
      return { ok: true, id: copy.id };
    },

    addTags: (scenarioId, incoming) => {
      const { added, skipped } = get().editTags(scenarioId, {
        add: incoming,
        removeKeys: [],
      });
      return { added, skipped };
    },

    editTags: (scenarioId, { add, removeKeys }) => {
      const scenario = get().scenarios.find((s) => s.id === scenarioId);
      if (!scenario) return { added: 0, removed: 0, skipped: add.length };
      const removeSet = new Set(removeKeys);
      const tags = scenario.tags.filter(
        (t) => !removeSet.has(scenarioTagKey(t)),
      );
      const removed = scenario.tags.length - tags.length;
      const keys = new Set(tags.map(scenarioTagKey));
      let added = 0;
      let skipped = 0;
      for (const raw of add) {
        const tag = sanitizeScenarioTag({ ...raw, id: createId() });
        const key = tag ? scenarioTagKey(tag) : null;
        if (!tag || !key || keys.has(key) || tags.length >= SCENARIO_TAGS_MAX) {
          skipped += 1;
          continue;
        }
        tags.push(tag);
        keys.add(key);
        added += 1;
      }
      if (added > 0 || removed > 0)
        replaceScenario(scenarioId, (s) => ({ ...s, tags }));
      return { added, removed, skipped };
    },

    updateTag: (scenarioId, tagId, patch) =>
      replaceScenario(scenarioId, (scenario) => {
        const index = scenario.tags.findIndex((t) => t.id === tagId);
        if (index < 0) return null;
        const current = scenario.tags[index];
        const merged = sanitizeScenarioTag({
          ...current,
          ...patch,
          id: tagId,
          modelId: current.modelId,
          code: current.code,
        });
        if (!merged) return null;
        const tags = scenario.tags.slice();
        tags[index] = merged;
        return { ...scenario, tags };
      }),

    removeModelTags: (scenarioId, modelId) => {
      replaceScenario(scenarioId, (scenario) => {
        const tags = scenario.tags.filter((t) => t.modelId !== modelId);
        if (tags.length === scenario.tags.length) return null;
        return { ...scenario, tags };
      });
    },

    setTickSec: (tickSec) => {
      const clamped = clampVirtualTagTick(tickSec);
      if (clamped === get().tickSec) return;
      set({ tickSec: clamped });
    },

    start: () => {
      const state = get();
      if (state.isRunning) return;
      // 활성 시나리오가 없거나 씬에 닿는 태그가 없으면 켤 것이 없다.
      if (!state.activeScenarioId || state.entries.length === 0) return;
      set({ isRunning: true, hasSession: true });
      virtualTagRuntime.start(runnerConfig);
    },

    pause: () => {
      if (!get().isRunning) return;
      set({ isRunning: false });
      virtualTagRuntime.pause();
    },

    stop: () => {
      const state = get();
      if (state.isRunning) virtualTagRuntime.pause();
      virtualTagRuntime.resetValues(false);
      if (state.isRunning || state.speed !== 1 || state.hasSession) {
        set({ isRunning: false, speed: 1, hasSession: false });
      }
      // 시뮬레이션이 버스에 남긴 값을 걷어낸다 — 채널이 비면 드라이버가 다음
      // 프레임에 노드를 rest 로 되돌리고, live 캐시가 비면 상태 판정이 unknown.
      rigValueStore.reset();
      tagLiveValues.clear();
      useRealtimeStore.getState().release();
    },

    setSpeed: (speed) => {
      const next = clampSpeed(speed);
      if (next === get().speed) return;
      set({ speed: next });
    },

    seek: (elapsedMs) => {
      // 정지 상태에서 seek 하려면 러너가 설정 getter 를 갖고 있어야 한다 —
      // 아직 한 번도 start 하지 않았으면 getter 만 붙인다(타이머는 켜지 않음).
      virtualTagRuntime.attachConfig(runnerConfig);
      virtualTagRuntime.seek(elapsedMs);
    },
  };
});

/** 스토어 밖(테스트·리셋)에서 로드 상태를 초기화할 때 쓴다. */
export function resetScenarioLoadState(): void {
  loadPromise = null;
}
