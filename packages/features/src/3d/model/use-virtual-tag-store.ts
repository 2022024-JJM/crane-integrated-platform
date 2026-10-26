import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import {
  clampVirtualTagTick,
  collectVirtualTagEntries,
  createEmptyVirtualTagSet,
  loadVirtualTagSet,
  normalizeVirtualEquipmentId,
  normalizeVirtualEquipmentKey,
  normalizeVirtualTagCode,
  sanitizeVirtualEquipment,
  sanitizeVirtualTag,
  sanitizeVirtualTagGroup,
  saveVirtualTagSet,
  VIRTUAL_EQUIPMENT_GROUPS_MAX,
  VIRTUAL_EQUIPMENT_TAGS_MAX,
  VIRTUAL_EQUIPMENTS_MAX,
  VIRTUAL_TAG_PERIOD_DEFAULT,
  type VirtualEquipment,
  type VirtualTagDataType,
  type VirtualTagDefinition,
  type VirtualTagEntry,
  type VirtualTagGroup,
  type VirtualTagGroupPreset,
  type VirtualTagLimits,
  type VirtualTagPattern,
  type VirtualTagSet,
} from '@crane/domain/virtual-tag';
import { rigValueStore } from './rig-value-store';
import { tagLiveValues } from './tag-value-bus';
import { useRealtimeStore } from './use-realtime-store';
import { virtualTagRuntime } from './virtual-tag-runner';

/**
 * 가상 태그 정의 스토어 — 전역(region 무관). 장비 › 그룹 › 태그 계층을 들고
 * 있고, 러너·카탈로그가 보는 평탄 목록(`entries`)은 장비가 바뀔 때마다 한 번
 * 파생한다.
 *
 * 영속화는 씬과 같은 규칙이다(virtual-tag-storage): dev 는 배포 파일
 * `public/simulation/virtual-tags.json` 에, 운영은 localStorage 봉투에.
 * 편집은 메모리에만 쌓이고 `save()` 를 불러야 기록된다 — `isDirty` 는 마지막
 * 저장 스냅샷과의 차이다.
 *
 * 값(현재값·파형 진행)은 여기 없다 — virtual-tag-runner 의 mutable 런타임이
 * 들고 있고, 이 스토어는 정의와 재생 여부만 React 상태로 둔다. 정의가 바뀌면
 * 러너가 다음 틱에서 반영한다. 배속 `speed` 는 세션 전용(저장 안 함).
 */

/** 배속 허용 범위 — 선택지(SIMULATION_SPEED_OPTIONS) 밖 값도 이 안이면 받는다. */
export const SIMULATION_SPEED_MIN = 0.1;
export const SIMULATION_SPEED_MAX = 16;

export interface VirtualEquipmentDraft {
  craneId: string;
  name?: string;
  bay?: string;
  enabled?: boolean;
  /** 등록 때 시드할 그룹(기본 그룹 등). 없으면 빈 목록. */
  groups?: VirtualTagGroup[];
}

export type VirtualEquipmentAddResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'invalid-id' | 'duplicate-id' | 'limit' };

export interface VirtualTagDraft {
  code: string;
  name?: string;
  groupId?: string;
  dataType?: VirtualTagDataType;
  unit?: string;
  min?: number;
  max?: number;
  initial?: number;
  pattern?: VirtualTagPattern;
  enabled?: boolean;
  limits?: VirtualTagLimits;
}

export type VirtualTagAddResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: 'invalid-code' | 'duplicate-code' | 'limit' | 'no-equipment';
    };

export type VirtualTagGroupAddResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'limit' | 'no-equipment' };

/** 여러 태그를 한 번에 넣은 결과 — 복제가 쓴다. */
export interface VirtualTagImportResult {
  added: number;
  /** 코드 중복·상한·손상으로 넣지 못한 수. */
  skipped: number;
}

interface VirtualTagState {
  equipments: VirtualEquipment[];
  /** 장비 계층의 평탄 목록 — equipments 가 바뀔 때만 새 참조. */
  entries: VirtualTagEntry[];
  tickMs: number;
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
   * 전역이라 관리 페이지를 떠나도 편집본이 남는데, "저장하지 않고 나가기"
   * 는 이 호출로 완성된다. 러너 정의도 함께 되돌린다. dirty 아니면 no-op.
   */
  discard: () => void;

  addEquipment: (draft: VirtualEquipmentDraft) => VirtualEquipmentAddResult;
  /** 장비 ID 변경은 정규화 키 유일성을 검사한다(중복이면 false, 나머지도 적용 안 함). */
  updateEquipment: (
    id: string,
    patch: Partial<
      Pick<VirtualEquipment, 'craneId' | 'name' | 'bay' | 'enabled'>
    >,
  ) => boolean;
  removeEquipment: (id: string) => void;
  /** 그룹·태그까지 새 id 로 복제. 장비 ID 는 접미사로 유일하게. */
  duplicateEquipment: (id: string) => VirtualEquipmentAddResult;

  addGroup: (
    equipmentId: string,
    name: string,
    preset?: VirtualTagGroupPreset,
  ) => VirtualTagGroupAddResult;
  updateGroup: (
    equipmentId: string,
    groupId: string,
    patch: Partial<Pick<VirtualTagGroup, 'name'>>,
  ) => boolean;
  /** 그룹을 지우면 그 그룹의 태그는 미분류가 된다. */
  removeGroup: (equipmentId: string, groupId: string) => void;
  /** 순서 이동(-1 위, +1 아래). 끝에서는 false. */
  moveGroup: (equipmentId: string, groupId: string, delta: -1 | 1) => boolean;

  addTag: (equipmentId: string, draft: VirtualTagDraft) => VirtualTagAddResult;
  /** 코드 변경은 장비 안 유일성을 검사한다(중복이면 false, 나머지 필드도 적용 안 함). */
  updateTag: (
    equipmentId: string,
    tagId: string,
    patch: Partial<Omit<VirtualTagDefinition, 'id'>>,
  ) => boolean;
  removeTag: (equipmentId: string, tagId: string) => void;
  duplicateTag: (equipmentId: string, tagId: string) => VirtualTagAddResult;
  /**
   * 그룹·태그를 한 번에 추가한다(실시간 복제). 그룹은 id 가 없는 것만 뒤에
   * 붙이고, 태그는 코드가 겹치지 않는 것만 상한까지 넣는다.
   */
  importTags: (
    equipmentId: string,
    payload: { groups?: VirtualTagGroup[]; tags: VirtualTagDefinition[] },
  ) => VirtualTagImportResult;

  setTickMs: (tickMs: number) => void;
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

type SetLike = Pick<VirtualTagState, 'equipments' | 'tickMs'>;

function toSet(state: SetLike): VirtualTagSet {
  return { version: 2, tickMs: state.tickMs, equipments: state.equipments };
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

/** `base`, `base_2`, `base_3` … 중 `taken` 에 없는 첫 것. */
function nextUniqueSuffix(
  base: string,
  isTaken: (candidate: string) => boolean,
): string {
  if (!isTaken(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!isTaken(candidate)) return candidate;
  }
  return `${base}_${createId().slice(0, 4)}`;
}

function equipmentKeyTaken(
  equipments: readonly VirtualEquipment[],
  craneId: string,
  exceptId?: string,
): boolean {
  const key = normalizeVirtualEquipmentKey(craneId);
  return equipments.some(
    (e) => e.id !== exceptId && normalizeVirtualEquipmentKey(e.craneId) === key,
  );
}

function defaultPattern(dataType: VirtualTagDataType): VirtualTagPattern {
  return dataType === 'bool'
    ? { kind: 'manual' }
    : { kind: 'triangle', periodMs: VIRTUAL_TAG_PERIOD_DEFAULT };
}

let loadPromise: Promise<void> | null = null;

export const useVirtualTagStore = create<VirtualTagState>()((set, get) => {
  /** 장비 목록 교체 — 평탄 목록을 파생하고 러너에 동기화한다. */
  const commit = (equipments: VirtualEquipment[]) => {
    const entries = collectVirtualTagEntries(equipments);
    set({ equipments, entries });
    virtualTagRuntime.syncDefinitions(entries);
  };

  /** 장비 하나를 바꾼 새 목록. 없으면 null. */
  const replaceEquipment = (
    id: string,
    update: (equipment: VirtualEquipment) => VirtualEquipment | null,
  ): boolean => {
    const { equipments } = get();
    const index = equipments.findIndex((e) => e.id === id);
    if (index < 0) return false;
    const next = update(equipments[index]);
    if (!next) return false;
    const list = equipments.slice();
    list[index] = next;
    commit(list);
    return true;
  };

  const runnerConfig = () => {
    const { entries, tickMs, isRunning, speed } = get();
    return { entries, tickMs, isRunning, speed };
  };

  return {
    equipments: [],
    entries: [],
    tickMs: createEmptyVirtualTagSet().tickMs,
    speed: 1,
    hasSession: false,
    savedSnapshot: snapshotOf(createEmptyVirtualTagSet()),
    hydrated: false,
    isSaving: false,
    isRunning: false,

    load: () => {
      if (get().hydrated) return Promise.resolve();
      if (loadPromise) return loadPromise;
      loadPromise = loadVirtualTagSet()
        .then((loaded) => {
          commit(loaded.equipments);
          set({
            tickMs: loaded.tickMs,
            savedSnapshot: snapshotOf(loaded),
            hydrated: true,
          });
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
        commit(saved.equipments);
        set({
          tickMs: saved.tickMs,
          savedSnapshot: snapshotOf(saved),
          isSaving: false,
        });
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
      commit(saved.equipments);
      set({ tickMs: saved.tickMs });
    },

    addEquipment: (draft) => {
      const craneId = normalizeVirtualEquipmentId(draft.craneId);
      if (craneId === null) return { ok: false, reason: 'invalid-id' };
      const { equipments } = get();
      if (equipmentKeyTaken(equipments, craneId)) {
        return { ok: false, reason: 'duplicate-id' };
      }
      if (equipments.length >= VIRTUAL_EQUIPMENTS_MAX) {
        return { ok: false, reason: 'limit' };
      }
      const equipment = sanitizeVirtualEquipment({
        id: createId(),
        craneId,
        name: draft.name,
        bay: draft.bay,
        enabled: draft.enabled ?? true,
        groups: draft.groups ?? [],
        tags: [],
      });
      if (!equipment) return { ok: false, reason: 'invalid-id' };
      commit([...equipments, equipment]);
      return { ok: true, id: equipment.id };
    },

    updateEquipment: (id, patch) => {
      const { equipments } = get();
      const current = equipments.find((e) => e.id === id);
      if (!current) return false;
      let craneId = current.craneId;
      if (patch.craneId !== undefined) {
        const normalized = normalizeVirtualEquipmentId(patch.craneId);
        if (normalized === null) return false;
        if (equipmentKeyTaken(equipments, normalized, id)) return false;
        craneId = normalized;
      }
      return replaceEquipment(id, (equipment) =>
        sanitizeVirtualEquipment({ ...equipment, ...patch, id, craneId }),
      );
    },

    removeEquipment: (id) => {
      const { equipments } = get();
      const next = equipments.filter((e) => e.id !== id);
      if (next.length === equipments.length) return;
      commit(next);
    },

    duplicateEquipment: (id) => {
      const { equipments } = get();
      const source = equipments.find((e) => e.id === id);
      if (!source) return { ok: false, reason: 'invalid-id' };
      if (equipments.length >= VIRTUAL_EQUIPMENTS_MAX) {
        return { ok: false, reason: 'limit' };
      }
      const craneId = nextUniqueSuffix(source.craneId, (candidate) =>
        equipmentKeyTaken(equipments, candidate),
      );
      const groupIdMap = new Map<string, string>();
      const groups = source.groups.map((group) => {
        const next = { ...group, id: createId() };
        groupIdMap.set(group.id, next.id);
        return next;
      });
      const tags = source.tags.map((tag) => {
        const next: VirtualTagDefinition = { ...tag, id: createId() };
        if (tag.groupId) {
          const mapped = groupIdMap.get(tag.groupId);
          if (mapped) next.groupId = mapped;
          else delete next.groupId;
        }
        return next;
      });
      const copy = sanitizeVirtualEquipment({
        ...source,
        id: createId(),
        craneId,
        groups,
        tags,
      });
      if (!copy) return { ok: false, reason: 'invalid-id' };
      commit([...equipments, copy]);
      return { ok: true, id: copy.id };
    },

    addGroup: (equipmentId, name, preset) => {
      const equipment = get().equipments.find((e) => e.id === equipmentId);
      if (!equipment) return { ok: false, reason: 'no-equipment' };
      if (equipment.groups.length >= VIRTUAL_EQUIPMENT_GROUPS_MAX) {
        return { ok: false, reason: 'limit' };
      }
      const group = sanitizeVirtualTagGroup({ id: createId(), name, preset });
      if (!group) return { ok: false, reason: 'no-equipment' };
      replaceEquipment(equipmentId, (e) => ({
        ...e,
        groups: [...e.groups, group],
      }));
      return { ok: true, id: group.id };
    },

    updateGroup: (equipmentId, groupId, patch) =>
      replaceEquipment(equipmentId, (equipment) => {
        const index = equipment.groups.findIndex((g) => g.id === groupId);
        if (index < 0) return null;
        const merged = sanitizeVirtualTagGroup({
          ...equipment.groups[index],
          ...patch,
          id: groupId,
        });
        if (!merged) return null;
        const groups = equipment.groups.slice();
        groups[index] = merged;
        return { ...equipment, groups };
      }),

    removeGroup: (equipmentId, groupId) => {
      replaceEquipment(equipmentId, (equipment) => {
        if (!equipment.groups.some((g) => g.id === groupId)) return null;
        return {
          ...equipment,
          groups: equipment.groups.filter((g) => g.id !== groupId),
          tags: equipment.tags.map((tag) => {
            if (tag.groupId !== groupId) return tag;
            const { groupId: _dropped, ...rest } = tag;
            void _dropped;
            return rest;
          }),
        };
      });
    },

    moveGroup: (equipmentId, groupId, delta) =>
      replaceEquipment(equipmentId, (equipment) => {
        const index = equipment.groups.findIndex((g) => g.id === groupId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= equipment.groups.length) {
          return null;
        }
        const groups = equipment.groups.slice();
        [groups[index], groups[target]] = [groups[target], groups[index]];
        return { ...equipment, groups };
      }),

    addTag: (equipmentId, draft) => {
      const equipment = get().equipments.find((e) => e.id === equipmentId);
      if (!equipment) return { ok: false, reason: 'no-equipment' };
      const code = normalizeVirtualTagCode(draft.code);
      if (code === null) return { ok: false, reason: 'invalid-code' };
      if (equipment.tags.some((t) => t.code === code)) {
        return { ok: false, reason: 'duplicate-code' };
      }
      if (equipment.tags.length >= VIRTUAL_EQUIPMENT_TAGS_MAX) {
        return { ok: false, reason: 'limit' };
      }
      const dataType: VirtualTagDataType =
        draft.dataType === 'bool' ? 'bool' : 'number';
      const tag = sanitizeVirtualTag(
        {
          id: createId(),
          code,
          name: draft.name ?? '',
          groupId: draft.groupId,
          dataType,
          unit: draft.unit,
          min: draft.min ?? 0,
          max: draft.max ?? 100,
          initial: draft.initial ?? draft.min ?? 0,
          pattern: draft.pattern ?? defaultPattern(dataType),
          enabled: draft.enabled ?? true,
          limits: draft.limits,
        },
        new Set(equipment.groups.map((g) => g.id)),
      );
      if (!tag) return { ok: false, reason: 'invalid-code' };
      replaceEquipment(equipmentId, (e) => ({ ...e, tags: [...e.tags, tag] }));
      return { ok: true, id: tag.id };
    },

    updateTag: (equipmentId, tagId, patch) =>
      replaceEquipment(equipmentId, (equipment) => {
        const index = equipment.tags.findIndex((t) => t.id === tagId);
        if (index < 0) return null;
        const current = equipment.tags[index];
        let code = current.code;
        if (patch.code !== undefined) {
          const normalized = normalizeVirtualTagCode(patch.code);
          if (normalized === null) return null;
          if (
            normalized !== current.code &&
            equipment.tags.some((t) => t.code === normalized)
          ) {
            return null;
          }
          code = normalized;
        }
        const merged = sanitizeVirtualTag(
          { ...current, ...patch, id: tagId, code },
          new Set(equipment.groups.map((g) => g.id)),
        );
        if (!merged) return null;
        const tags = equipment.tags.slice();
        tags[index] = merged;
        return { ...equipment, tags };
      }),

    removeTag: (equipmentId, tagId) => {
      replaceEquipment(equipmentId, (equipment) => {
        const tags = equipment.tags.filter((t) => t.id !== tagId);
        if (tags.length === equipment.tags.length) return null;
        return { ...equipment, tags };
      });
    },

    duplicateTag: (equipmentId, tagId) => {
      const equipment = get().equipments.find((e) => e.id === equipmentId);
      if (!equipment) return { ok: false, reason: 'no-equipment' };
      const source = equipment.tags.find((t) => t.id === tagId);
      if (!source) return { ok: false, reason: 'invalid-code' };
      const taken = new Set(equipment.tags.map((t) => t.code));
      return get().addTag(equipmentId, {
        ...source,
        code: nextUniqueSuffix(source.code, (c) => taken.has(c)),
      });
    },

    importTags: (equipmentId, payload) => {
      const equipment = get().equipments.find((e) => e.id === equipmentId);
      if (!equipment) return { added: 0, skipped: payload.tags.length };
      const groups = equipment.groups.slice();
      const groupIds = new Set(groups.map((g) => g.id));
      for (const raw of payload.groups ?? []) {
        if (groups.length >= VIRTUAL_EQUIPMENT_GROUPS_MAX) break;
        const group = sanitizeVirtualTagGroup(raw);
        if (!group || groupIds.has(group.id)) continue;
        groups.push(group);
        groupIds.add(group.id);
      }
      const tags = equipment.tags.slice();
      const codes = new Set(tags.map((t) => t.code));
      let added = 0;
      let skipped = 0;
      for (const raw of payload.tags) {
        const tag = sanitizeVirtualTag(raw, groupIds);
        if (
          !tag ||
          codes.has(tag.code) ||
          tags.length >= VIRTUAL_EQUIPMENT_TAGS_MAX
        ) {
          skipped += 1;
          continue;
        }
        tags.push(tag);
        codes.add(tag.code);
        added += 1;
      }
      if (added > 0 || groups.length !== equipment.groups.length) {
        replaceEquipment(equipmentId, (e) => ({ ...e, groups, tags }));
      }
      return { added, skipped };
    },

    setTickMs: (tickMs) => {
      const clamped = clampVirtualTagTick(tickMs);
      if (clamped === get().tickMs) return;
      set({ tickMs: clamped });
    },

    start: () => {
      if (get().isRunning) return;
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
export function resetVirtualTagLoadState(): void {
  loadPromise = null;
}
