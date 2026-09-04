import { create } from 'zustand';
import {
  readSnapStep,
  writeSnapStep,
  type SceneSnapChannel,
  type SceneSnapStep,
} from '../lib/snap-storage';
import type { SceneTransformSpace } from './types';

export {
  SCENE_TRANSFORM_SNAP,
  SCENE_SNAP_STEP_OPTIONS,
  type SceneSnapChannel,
  type SceneSnapStep,
} from '../lib/snap-storage';

interface SceneEditorViewState {
  /** 기즈모 드래그를 snapStep 단위로 끊을지. */
  snapEnabled: boolean;
  /**
   * 기즈모 스냅 단위. 켜져 있을 때만 TransformControls 에 들어가고, 꺼지면
   * 세 값 모두 null 로 보낸다. 다른 필드와 달리 localStorage 에 영속된다
   * (snap-storage.ts).
   */
  snapStep: SceneSnapStep;
  /** 기즈모 축 기준. scale 모드는 three 가 강제로 local 을 쓴다. */
  transformSpace: SceneTransformSpace;
  /** 원점 기준 바닥 격자(시각 전용) 표시 여부. */
  showGrid: boolean;
  toggleSnap: () => void;
  setSnapStep: (channel: SceneSnapChannel, value: number) => void;
  setTransformSpace: (space: SceneTransformSpace) => void;
  toggleGrid: () => void;
}

/**
 * 편집기 도구 모음의 보기·기즈모 옵션.
 *
 * snapStep 을 제외하면 세션 전용이라 새로고침하면 기본값으로 돌아간다 —
 * 패널 접힘·비율 유지(useUniformScaleStore)와 같은 규칙이고, 씬 데이터·
 * 히스토리에는 남지 않는다. 캔버스는 이 값을 페이지에서 prop 으로 받는다
 * (스토어를 직접 구독하지 않아 캔버스 리렌더 경로를 페이지가 통제한다).
 */
export const useSceneEditorViewStore = create<SceneEditorViewState>()(
  (set, get) => ({
    snapEnabled: false,
    snapStep: readSnapStep(),
    transformSpace: 'local',
    showGrid: false,
    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
    setSnapStep: (channel, value) => {
      const current = get().snapStep;
      if (current[channel] === value) {
        return;
      }
      const snapStep = { ...current, [channel]: value };
      writeSnapStep(snapStep);
      set({ snapStep });
    },
    setTransformSpace: (space) =>
      set((state) =>
        state.transformSpace === space ? state : { transformSpace: space },
      ),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  }),
);
