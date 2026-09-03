import { create } from 'zustand';
import type { SceneTransformSpace } from './types';

/**
 * 기즈모 스냅 단위. three TransformControls 의 `translationSnap` /
 * `rotationSnap` / `scaleSnap` 에 그대로 들어간다 — rotation 은 라디안이다
 * (15°). 켜져 있을 때만 적용하고, 꺼지면 세 값 모두 null 로 보낸다.
 */
export const SCENE_TRANSFORM_SNAP = {
  translation: 1,
  rotation: Math.PI / 12,
  scale: 0.1,
} as const;

interface SceneEditorViewState {
  /** 기즈모 드래그를 SCENE_TRANSFORM_SNAP 단위로 끊을지. */
  snapEnabled: boolean;
  /** 기즈모 축 기준. scale 모드는 three 가 강제로 local 을 쓴다. */
  transformSpace: SceneTransformSpace;
  /** 원점 기준 바닥 격자(시각 전용) 표시 여부. */
  showGrid: boolean;
  toggleSnap: () => void;
  setTransformSpace: (space: SceneTransformSpace) => void;
  toggleGrid: () => void;
}

/**
 * 편집기 상단 도구 모음의 보기·기즈모 옵션.
 *
 * 세션 전용이라 새로고침하면 기본값으로 돌아간다 — 패널 접힘·비율 유지
 * (useUniformScaleStore)와 같은 규칙이고, 씬 데이터·히스토리에는 남지
 * 않는다. 캔버스는 이 값을 페이지에서 prop 으로 받는다(스토어를 직접
 * 구독하지 않아 캔버스 리렌더 경로를 페이지가 통제한다).
 */
export const useSceneEditorViewStore = create<SceneEditorViewState>()(
  (set) => ({
    snapEnabled: false,
    transformSpace: 'local',
    showGrid: false,
    toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
    setTransformSpace: (space) =>
      set((state) =>
        state.transformSpace === space ? state : { transformSpace: space },
      ),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  }),
);
