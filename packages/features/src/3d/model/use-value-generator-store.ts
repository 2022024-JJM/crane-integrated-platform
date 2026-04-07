import { create } from 'zustand';
import type { GenValue, ValueGeneratorConfig } from './types';
import { useValueMapperStore } from './use-value-mapper-store';

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
  tick: () => void;
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
    tick: () => {
      // 시뮬 값을 mutate할 때 zustand set()을 호출하면 모든 subscribers가
      // 매 tick 리렌더된다. 시뮬 값은 Three.js Object3D 매트릭스에 직접
      // 반영되므로 runtimeValues 배열을 in-place 갱신하고 React 상태
      // 변경은 일으키지 않는다. (UI 패널이 시뮬값을 보여줘야 한다면 추후
      // useSyncExternalStore + throttle subscribe로 분리)
      const runtimeValues = get().runtimeValues;
      const applyValue = useValueMapperStore.getState().applyValue;

      for (const v of runtimeValues) {
        const range = v.max - v.min;
        const step = range * 0.05;

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

        applyValue(v.key, nextValue);

        v.value = nextValue;
        v.direction = nextDirection;
      }
    },
  }),
);
