import { create } from 'zustand';
import type { GenValue, ValueGeneratorConfig } from './types';
import { useValueMapperStore } from './use-value-mapper-store';
import type { Scene } from 'three';

interface RuntimeValue extends GenValue {
  direction: number;
}

interface ValueGeneratorState {
  values: GenValue[];
  interval: number;
  isRunning: boolean;
  runtimeValues: RuntimeValue[];
  start: () => void;
  pause: () => void;
  updateConfig: (v: ValueGeneratorConfig) => void;
  tick: (scene: Scene) => void;
}

export const useValueGeneratorStore = create<ValueGeneratorState>(
  (set, get) => ({
    values: [
      {
        key: 'ship_position_x',
        value: 0,
        min: 0,
        max: 10,
      },
      {
        key: 'crane_rotation_y',
        value: 0,
        min: 0,
        max: 60,
      },
    ],
    interval: 100,
    isRunning: false,
    runtimeValues: [
      {
        key: 'ship_position_x',
        value: 0,
        min: 0,
        max: 10,
        direction: 1,
      },
      {
        key: 'crane_rotation_y',
        value: 0,
        min: 0,
        max: 60,
        direction: 1,
      },
    ],

    start: () => set({ isRunning: true }),
    pause: () => set({ isRunning: false }),
    updateConfig: (v) =>
      set({
        values: v.values,
        interval: v.interval,
        runtimeValues: v.values.map((i) => ({
          ...i,
          direction: 1,
        })),
      }),
    tick: (scene) => {
      const { runtimeValues } = get();
      const applyValue = useValueMapperStore.getState().applyValue;

      const next = runtimeValues.map((v) => {
        const range = v.max - v.min;
        const step = range * 0.05; // 🔹 5%씩 이동 (조절 가능)

        let nextValue = v.value + step * v.direction;
        let nextDirection = v.direction;

        if (nextValue >= v.max) {
          nextValue = v.max;
          nextDirection = -1;
        }

        if (nextValue <= v.min) {
          nextValue = v.min;
          nextDirection = 1;
        }

        applyValue(scene, v.key, nextValue);

        return {
          ...v,
          value: nextValue,
          direction: nextDirection,
        };
      });

      set({ runtimeValues: next });
    },
  }),
);
