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

      return {
        map: {
          ...state.map,
          [key]: [...prev, value],
        },
      };
    }),

  registerFromModel: (model) =>
    set((s) => {
      const map = { ...s.map };

      for (const vm of model.valueMapList) {
        if (!map[vm.key]) {
          map[vm.key] = [];
        }

        const valueMapObject: ValueMapObject = {
          id: model.id,
          type: vm.type,
          originTransform: {
            position: [...model.position],
            rotation: [...model.rotation],
            scale: [...model.scale],
          },
        };

        if (
          map[vm.key].some((entry) => isSameValueMapObject(entry, valueMapObject))
        ) {
          continue;
        }

        map[vm.key].push(valueMapObject);
      }

      return { map };
    }),
  applyValue: (key, value) => {
    const list = get().map[key];
    if (!list) return;

    list.forEach(({ id, type, originTransform }) => {
      const object = modelObjectRegistry.get(id);
      if (!object) return;

      switch (type) {
        case 'PX':
          object.position.x = numRound(originTransform.position[0] + value);
          break;

        case 'PY':
          object.position.y = numRound(originTransform.position[1] + value);
          break;

        case 'PZ':
          object.position.z = numRound(originTransform.position[2] + value);
          break;

        case 'RX':
          object.rotation.x = degToRad(
            radToDeg(originTransform.rotation[0]) + value,
          );
          break;

        case 'RY':
          object.rotation.y = degToRad(
            radToDeg(originTransform.rotation[1]) + value,
          );
          break;

        case 'RZ':
          object.rotation.z = degToRad(
            radToDeg(originTransform.rotation[2]) + value,
          );
          break;

        case 'SX':
          object.scale.x = numRound(originTransform.scale[0] + value);
          break;

        case 'SY':
          object.scale.y = numRound(originTransform.scale[1] + value);
          break;

        case 'SZ':
          object.scale.z = numRound(originTransform.scale[2] + value);
          break;
      }
    });
  },
  clear: () =>
    set({
      map: {},
    }),
}));
