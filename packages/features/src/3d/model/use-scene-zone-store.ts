import { create } from 'zustand';
import type { SavedModelZoneLevel } from '@crane/domain/3d';
import { holdRunners, releaseRunners } from './scene-collision-hold';
import type { ZoneTransition } from './scene-zone-runtime';

/**
 * 모델 영역 침범 감지의 React 상태 — 세션 전용(씬 데이터·localStorage 아님).
 * 충돌 스토어(use-scene-collision-store)와 같은 자리(충돌 탭)에 UI 가 놓이지만
 * 의미가 달라 합치지 않는다 — 영역은 **상태**(지금 누가 안에 있나)일 뿐이고
 * 정지·자세 복원·기록이 없다(진입 기록은 2026-09-12 에 뺐다 — 현재 목록과
 * 링만으로 충분하고 편집 드래그가 기록을 오염시켰다).
 *
 * `enabled` 기본 ON — 충돌 감지와 같은 이유(관제자가 매번 켜지 않게). 씬에
 * 영역이 없으면 비용도 0 이다. 끄면 현재 침범 목록을 비운다.
 *
 * 프레임 루프(scene-zone-runtime)는 여기에 쓰지 않는다. 검출기 훅이 tick 의
 * 전이(enter/exit)를 `applyTransitions` 로 한 번에 넣는다 — 빈 배열이면
 * set 하지 않아 참조가 유지된다.
 *
 * 등급(2026-09-12): 영역마다 `level`(warn 기본 / stop). 'stop' 영역에 들어오면
 * `stopOnIntrusion`(세션, 기본 ON)일 때 충돌 시 정지와 같은 경로로 값 생산자를
 * 멈춘다(`holdRunners` — 시뮬레이션 pause, 실시간 화면 반영 보류). 멈춘 쌍은
 * `held` 에 하나만 두고, 재개(`resume` — 경보 배너 [이어서 재생]·독 ▶)하면
 * `acknowledged` 에 넣어 그 쌍이 **이탈하기 전까지** 다시 멈추지 않는다 —
 * 그렇지 않으면 재생하자마자 같은 침범으로 또 멈춰 영영 못 나간다.
 * 침범 중인 상태 자체(링·목록·경보)는 acknowledged 여도 그대로다.
 */

export interface ZoneIntruderRef {
  kind: 'model' | 'zone';
  /** 모델 id, 또는 상대 영역의 zoneKey. */
  id: string;
  /** 표시 이름 — 모델 equipName, 영역은 "소유 모델 · 영역 이름". */
  name: string;
}

export interface ZoneIntrusion {
  zoneKey: string;
  ownerId: string;
  ownerName: string;
  zoneId: string;
  zoneName: string;
  color: string;
  /** 영역 등급 — 경보 색·정지 여부의 근거. */
  level: SavedModelZoneLevel;
  /** 첫 침범자가 들어온 시각(ms) — 경보 배너 표시용. */
  at: number;
  intruders: ZoneIntruderRef[];
}

/** 정지 중인 침범 쌍. */
export interface ZoneHold {
  zoneKey: string;
  intruderId: string;
  at: number;
}

function pairKey(zoneKey: string, intruderId: string): string {
  return `${zoneKey}|${intruderId}`;
}

/** 영역↔영역은 어느 한쪽이 stop 이면 stop. */
function transitionLevel(t: ZoneTransition): SavedModelZoneLevel {
  return t.zone.level === 'stop' || t.intruderZone?.level === 'stop'
    ? 'stop'
    : 'warn';
}

interface SceneZoneState {
  enabled: boolean;
  /**
   * 씬 안 영역 이름 배지(+침범자 수)를 그릴지. 링·감지와는 무관한 표시
   * 설정이라 감지를 끄지 않고 배지만 숨길 수 있다 — 영역이 여러 개인 야드에서
   * 배지가 화면을 덮는다. 세션 전용(`enabled` 과 같은 규칙).
   */
  labelsVisible: boolean;
  /** 침범자가 하나라도 있는 영역만. zoneKey 순 정렬로 안정. */
  intrusions: ZoneIntrusion[];
  /** 'stop' 등급 영역 침범 시 값 생산자를 멈출지. 세션 전용, 기본 ON. */
  stopOnIntrusion: boolean;
  /** 지금 정지시킨 침범 쌍. null 이면 정지 아님. */
  held: ZoneHold | null;
  /** 재개로 승인된 쌍(pairKey) — 이탈 전까지 다시 멈추지 않는다. */
  acknowledged: string[];
  toggle: () => void;
  setStopOnIntrusion: (stop: boolean) => void;
  /**
   * 정지 해제 — 경보 배너 [이어서 재생]·독 ▶ 재생 전이가 부른다. 정지 중이
   * 아니면 no-op(참조 유지). 실시간 보류를 풀고(가상 태그는 호출자가 ▶ 로
   * 켠다) 그 쌍을 승인한다.
   */
  resume: () => void;
  /** false 면 현재 침범 목록을 비운다. */
  setEnabled: (enabled: boolean) => void;
  setLabelsVisible: (visible: boolean) => void;
  /** 검출기만 호출. 전이를 반영한다 — 빈 배열은 no-op. */
  applyTransitions: (transitions: readonly ZoneTransition[]) => void;
  /** 검출기 언마운트 — 현재 침범 목록을 비운다. */
  clear: () => void;
}

function modelName(model: { id: string; equipName: string }): string {
  return model.equipName || model.id;
}

function zoneDisplayName(zone: { name: string; id: string }): string {
  return zone.name || zone.id;
}

function intruderRef(transition: ZoneTransition): ZoneIntruderRef {
  if (transition.intruderKind === 'zone' && transition.intruderZone) {
    return {
      kind: 'zone',
      id: transition.intruderId,
      name: `${modelName(transition.intruder)} · ${zoneDisplayName(transition.intruderZone)}`,
    };
  }
  return {
    kind: 'model',
    id: transition.intruderId,
    name: modelName(transition.intruder),
  };
}

/** 영역↔영역 전이는 a 쪽 한 번만 오므로 상대 영역 항목에도 거울상을 넣는다. */
function mirroredRef(transition: ZoneTransition): ZoneIntruderRef {
  return {
    kind: 'zone',
    id: transition.zoneKey,
    name: `${modelName(transition.owner)} · ${zoneDisplayName(transition.zone)}`,
  };
}

function upsert(
  list: ZoneIntrusion[],
  zoneKey: string,
  make: () => Omit<ZoneIntrusion, 'intruders'>,
  intruder: ZoneIntruderRef,
): ZoneIntrusion[] {
  const index = list.findIndex((i) => i.zoneKey === zoneKey);
  if (index < 0) {
    const next = [...list, { ...make(), intruders: [intruder] }];
    next.sort((a, b) =>
      a.zoneKey < b.zoneKey ? -1 : a.zoneKey > b.zoneKey ? 1 : 0,
    );
    return next;
  }
  const current = list[index];
  if (current.intruders.some((i) => i.id === intruder.id)) return list;
  const next = list.slice();
  next[index] = { ...current, intruders: [...current.intruders, intruder] };
  return next;
}

function remove(
  list: ZoneIntrusion[],
  zoneKey: string,
  intruderId: string,
): ZoneIntrusion[] {
  const index = list.findIndex((i) => i.zoneKey === zoneKey);
  if (index < 0) return list;
  const current = list[index];
  const intruders = current.intruders.filter((i) => i.id !== intruderId);
  if (intruders.length === current.intruders.length) return list;
  const next = list.slice();
  if (intruders.length === 0) next.splice(index, 1);
  else next[index] = { ...current, intruders };
  return next;
}

export const useSceneZoneStore = create<SceneZoneState>()((set, get) => ({
  enabled: true,
  labelsVisible: true,
  intrusions: [],
  stopOnIntrusion: true,
  held: null,
  acknowledged: [],

  toggle: () => get().setEnabled(!get().enabled),

  setEnabled: (enabled) => {
    const state = get();
    if (enabled === state.enabled) return;
    if (enabled) {
      set({ enabled });
      return;
    }
    // 끄면 침범 목록·정지·승인을 전부 비운다 — 정지 중이었으면 풀어 준다.
    if (state.held) releaseRunners();
    set({
      enabled,
      intrusions: state.intrusions.length === 0 ? state.intrusions : [],
      held: null,
      acknowledged: state.acknowledged.length === 0 ? state.acknowledged : [],
    });
  },

  setStopOnIntrusion: (stop) => {
    const state = get();
    if (stop === state.stopOnIntrusion) return;
    // 끄는 순간 정지 중이면 풀어 준다(정지가 남아 있을 이유가 없다).
    if (!stop && state.held) {
      releaseRunners();
      set({ stopOnIntrusion: stop, held: null });
      return;
    }
    set({ stopOnIntrusion: stop });
  },

  resume: () => {
    const state = get();
    if (!state.held) return;
    releaseRunners();
    const key = pairKey(state.held.zoneKey, state.held.intruderId);
    set({
      held: null,
      acknowledged: state.acknowledged.includes(key)
        ? state.acknowledged
        : [...state.acknowledged, key],
    });
  },

  setLabelsVisible: (visible) => {
    if (visible === get().labelsVisible) return;
    set({ labelsVisible: visible });
  },

  applyTransitions: (transitions) => {
    if (transitions.length === 0) return;
    const state = get();
    let intrusions = state.intrusions;
    let held = state.held;
    let acknowledged = state.acknowledged;
    const now = Date.now();
    for (const t of transitions) {
      const level = transitionLevel(t);
      if (t.kind === 'enter') {
        intrusions = upsert(
          intrusions,
          t.zoneKey,
          () => ({
            zoneKey: t.zoneKey,
            ownerId: t.owner.id,
            ownerName: modelName(t.owner),
            zoneId: t.zone.id,
            zoneName: t.zone.name,
            color: t.zone.color,
            level,
            at: now,
          }),
          intruderRef(t),
        );
        if (t.intruderKind === 'zone' && t.intruderZone) {
          const other = t.intruderZone;
          intrusions = upsert(
            intrusions,
            t.intruderId,
            () => ({
              zoneKey: t.intruderId,
              ownerId: t.intruder.id,
              ownerName: modelName(t.intruder),
              zoneId: other.id,
              zoneName: other.name,
              color: other.color,
              level,
              at: now,
            }),
            mirroredRef(t),
          );
        }
        // 'stop' 영역 진입 — 승인되지 않은 쌍이고 아직 정지 중이 아니면 멈춘다.
        if (
          level === 'stop' &&
          state.stopOnIntrusion &&
          held === null &&
          !acknowledged.includes(pairKey(t.zoneKey, t.intruderId))
        ) {
          holdRunners();
          held = { zoneKey: t.zoneKey, intruderId: t.intruderId, at: now };
        }
      } else {
        intrusions = remove(intrusions, t.zoneKey, t.intruderId);
        if (t.intruderKind === 'zone') {
          intrusions = remove(intrusions, t.intruderId, t.zoneKey);
        }
        // 이탈한 쌍의 승인은 지운다 — 다시 들어오면 다시 멈춘다.
        const key = pairKey(t.zoneKey, t.intruderId);
        if (acknowledged.includes(key)) {
          acknowledged = acknowledged.filter((k) => k !== key);
        }
        // 정지시킨 쌍이 (편집 등으로) 떨어졌으면 정지도 푼다.
        if (
          held &&
          held.zoneKey === t.zoneKey &&
          held.intruderId === t.intruderId
        ) {
          releaseRunners();
          held = null;
        }
      }
    }
    if (
      intrusions === state.intrusions &&
      held === state.held &&
      acknowledged === state.acknowledged
    ) {
      return;
    }
    set({ intrusions, held, acknowledged });
  },

  clear: () => {
    const state = get();
    if (
      state.intrusions.length === 0 &&
      state.held === null &&
      state.acknowledged.length === 0
    ) {
      return;
    }
    if (state.held) releaseRunners();
    set({ intrusions: [], held: null, acknowledged: [] });
  },
}));
