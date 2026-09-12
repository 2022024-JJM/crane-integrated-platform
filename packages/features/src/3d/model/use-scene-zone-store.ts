import { create } from 'zustand';
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
  intruders: ZoneIntruderRef[];
}

interface SceneZoneState {
  enabled: boolean;
  /** 침범자가 하나라도 있는 영역만. zoneKey 순 정렬로 안정. */
  intrusions: ZoneIntrusion[];
  toggle: () => void;
  /** false 면 현재 침범 목록을 비운다. */
  setEnabled: (enabled: boolean) => void;
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
  intrusions: [],

  toggle: () => get().setEnabled(!get().enabled),

  setEnabled: (enabled) => {
    const state = get();
    if (enabled === state.enabled) return;
    set(
      enabled || state.intrusions.length === 0
        ? { enabled }
        : { enabled, intrusions: [] },
    );
  },

  applyTransitions: (transitions) => {
    if (transitions.length === 0) return;
    const state = get();
    let intrusions = state.intrusions;
    for (const t of transitions) {
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
            }),
            mirroredRef(t),
          );
        }
      } else {
        intrusions = remove(intrusions, t.zoneKey, t.intruderId);
        if (t.intruderKind === 'zone') {
          intrusions = remove(intrusions, t.intruderId, t.zoneKey);
        }
      }
    }
    if (intrusions === state.intrusions) return;
    set({ intrusions });
  },

  clear: () => {
    if (get().intrusions.length === 0) return;
    set({ intrusions: [] });
  },
}));
