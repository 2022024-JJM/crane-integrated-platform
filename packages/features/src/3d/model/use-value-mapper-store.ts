import {
  degToRad,
  modelObjectRegistry,
  numRound,
  type SavedModelInfo,
  type ValueMapType,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { create } from 'zustand';

interface ValueMapObject {
  id: string;
  type: ValueMapType;
  /**
   * 단위 변환 계수. position = value * scale.
   * 씬 좌표 = 현실 미터 기준. value 단위가 0.1m이면 0.1.
   */
  scale: number;
  /**
   * 서버 값 0에 대응하는 월드 좌표(해당 축).
   * 적용 공식: world_position = offset + value * scale.
   * ValueMapItem.offset 생략 시 0.
   */
  offset: number;
  /** clear() 시 원위치 복귀용 */
  originTransform: {
    position: Vector3Tuple;
    rotation: Vector3Tuple;
    scale: Vector3Tuple;
  };
}

interface ValueMapperState {
  map: Record<string, ValueMapObject[]>;
  register: (key: string, value: ValueMapObject) => void;
  registerFromModel: (model: SavedModelInfo) => void;
  /** 단일 (id, type) 매핑 해제. 빈 배열이 되면 key 자체를 제거. */
  unregister: (key: string, predicate: { id: string; type: ValueMapType }) => void;
  /** 모델의 valueMapList 기준으로 모든 매핑 해제. */
  unregisterFromModel: (model: SavedModelInfo) => void;
  applyValue: (key: string, value: number) => void;
  /** map은 유지하면서 모든 Object3D를 originTransform으로 복귀. */
  resetToOrigin: () => void;
  /** map 초기화 + Object3D 원위치 복귀. */
  clear: () => void;
}

function isSameValueMapObject(a: ValueMapObject, b: ValueMapObject) {
  return a.id === b.id && a.type === b.type;
}

/**
 * 리그 태그 소스 연결 지점. 서버 연동 단계에서 createTagBindingSource 의
 * ingest 를 여기에 걸면 realtime/replay/generator 가 이미 부르는 applyValue 가
 * 그대로 관절까지 흘러간다. 기본 null — 이번 단계는 수동 조작만 켠다.
 */
let rigTagIngest: ((key: string, value: number) => void) | null = null;

export function setRigTagIngest(
  ingest: ((key: string, value: number) => void) | null,
): void {
  rigTagIngest = ingest;
}

export const useValueMapperStore = create<ValueMapperState>()((set, get) => ({
  map: {},

  register: (key, value) =>
    set((state) => {
      const prev = state.map[key] ?? [];
      if (prev.some((entry) => isSameValueMapObject(entry, value))) {
        return state;
      }
      return { map: { ...state.map, [key]: [...prev, value] } };
    }),

  registerFromModel: (model) =>
    set((s) => {
      const map = { ...s.map };

      for (const vm of model.valueMapList) {
        if (!map[vm.key]) map[vm.key] = [];

        const valueMapObject: ValueMapObject = {
          id: model.id,
          type: vm.type,
          scale: vm.scale ?? 1,
          offset: vm.offset ?? 0,
          originTransform: {
            position: [...model.position],
            rotation: model.rotation.map(degToRad) as Vector3Tuple,
            scale: [...model.scale],
          },
        };

        if (map[vm.key].some((entry) => isSameValueMapObject(entry, valueMapObject))) {
          continue;
        }

        map[vm.key].push(valueMapObject);
      }

      return { map };
    }),

  unregister: (key, predicate) =>
    set((state) => {
      const prev = state.map[key];
      if (!prev) return state;

      const next = prev.filter(
        (entry) => !isSameValueMapObject(entry, predicate as ValueMapObject),
      );

      if (next.length === prev.length) return state;

      const map = { ...state.map };
      if (next.length === 0) {
        delete map[key];
      } else {
        map[key] = next;
      }
      return { map };
    }),

  unregisterFromModel: (model) =>
    set((state) => {
      const map = { ...state.map };
      let changed = false;

      for (const vm of model.valueMapList) {
        const list = map[vm.key];
        if (!list) continue;

        const next = list.filter(
          (entry) =>
            !isSameValueMapObject(entry, {
              id: model.id,
              type: vm.type,
            } as ValueMapObject),
        );

        if (next.length === list.length) continue;

        changed = true;
        if (next.length === 0) {
          delete map[vm.key];
        } else {
          map[vm.key] = next;
        }
      }

      return changed ? { map } : state;
    }),

  applyValue: (key, value) => {
    rigTagIngest?.(key, value);
    const list = get().map[key];
    if (!list) return;

    list.forEach(({ id, type, scale, offset }) => {
      const object = modelObjectRegistry.get(id);
      if (!object) return;

      // world_position = offset + value * scale
      // offset: 서버 값 0에 대응하는 월드 좌표(축마다 다른 기준점 적용 가능)
      const v = numRound(value * scale);

      switch (type) {
        case 'PX': object.position.x = offset + v; break;
        case 'PY': object.position.y = offset + v; break;
        case 'PZ': object.position.z = offset + v; break;
        case 'RX': object.rotation.x = degToRad(v); break;
        case 'RY': object.rotation.y = degToRad(v); break;
        case 'RZ': object.rotation.z = degToRad(v); break;
        case 'SX': object.scale.x = v; break;
        case 'SY': object.scale.y = v; break;
        case 'SZ': object.scale.z = v; break;
      }
    });
  },

  resetToOrigin: () => {
    const { map } = get();
    for (const list of Object.values(map)) {
      for (const { id, originTransform } of list) {
        const object = modelObjectRegistry.get(id);
        if (!object) continue;
        object.position.set(...originTransform.position);
        object.rotation.set(...originTransform.rotation);
        object.scale.set(...originTransform.scale);
      }
    }
  },

  clear: () => {
    // 원위치 복귀 후 map 초기화
    const { map } = get();
    for (const list of Object.values(map)) {
      for (const { id, originTransform } of list) {
        const object = modelObjectRegistry.get(id);
        if (!object) continue;
        object.position.set(...originTransform.position);
        object.rotation.set(...originTransform.rotation);
        object.scale.set(...originTransform.scale);
      }
    }
    set({ map: {} });
  },
}));
