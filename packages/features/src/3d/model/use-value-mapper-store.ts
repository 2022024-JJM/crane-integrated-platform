import {
  degToRad,
  modelObjectRegistry,
  numRound,
  radToDeg,
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
  applyValue: (key: string, value: number) => void;
  /** map은 유지하면서 모든 Object3D를 originTransform으로 복귀. */
  resetToOrigin: () => void;
  /** map 초기화 + Object3D 원위치 복귀. */
  clear: () => void;
}

function isSameValueMapObject(a: ValueMapObject, b: ValueMapObject) {
  return a.id === b.id && a.type === b.type;
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

  applyValue: (key, value) => {
    const list = get().map[key];
    if (!list) return;

    list.forEach(({ id, type, scale }) => {
      const object = modelObjectRegistry.get(id);
      if (!object) return;

      // 씬 좌표 = 현실 미터 기준. position = value * scale (단위 변환만).
      const v = numRound(value * scale);

      switch (type) {
        case 'PX': object.position.x = v; break;
        case 'PY': object.position.y = v; break;
        case 'PZ': object.position.z = v; break;
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
