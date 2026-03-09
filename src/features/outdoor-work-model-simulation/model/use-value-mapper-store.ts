import {
  degToRad,
  numRound,
  radToDeg,
} from '@/entities/3d-model/lib/math-utils';
import {
  type SavedModelInfo,
  type ValueMapType,
  type Vector3Tuple,
} from '@/entities/3d-model/model/types';

import type { Scene } from 'three';
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
  applyValue: (scene: Scene, key: string, value: number) => void;
  clear: () => void;
}

export const useValueMapperStore = create<ValueMapperState>()((set, get) => ({
  map: {},
  register: (key, value) =>
    set((state) => {
      const prev = state.map[key] ?? [];

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

        map[vm.key].push({
          id: model.id,
          type: vm.type,
          originTransform: {
            position: [...model.position],
            rotation: [...model.rotation],
            scale: [...model.scale],
          },
        });
      }

      return { map };
    }),
  applyValue: (scene, key, value) => {
    const list = get().map[key];
    if (!list) return;

    list.forEach(({ id, type, originTransform }) => {
      const object = scene.getObjectByName(id);
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
