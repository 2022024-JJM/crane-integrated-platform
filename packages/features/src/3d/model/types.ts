export type AxisKey = 'x' | 'y' | 'z';

export type SceneTransformField = 'position' | 'rotation' | 'scale';
export type SceneTransformMode = 'translate' | 'rotate' | 'scale';
/** 기즈모 기준 축 — three TransformControls 의 `space` 와 같은 값. */
export type SceneTransformSpace = 'local' | 'world';
/**
 * 다중 선택 변형 기준점. individual = 각자 자기 원점(제자리 회전·크기),
 * primary = 프라이머리(마지막 Ctrl 클릭) 원점을 피벗으로 선택 전체를 강체처럼.
 */
export type SceneTransformPivot = 'individual' | 'primary';

export const AXIS_INDEX = {
  x: 0,
  y: 1,
  z: 2,
} as const;

export const TRANSFORM_FIELD_BY_MODE = {
  translate: 'position',
  rotate: 'rotation',
  scale: 'scale',
} as const satisfies Record<SceneTransformMode, SceneTransformField>;

export interface GenValue {
  key: string;
  value: number;
  min: number;
  max: number;
}

export interface ValueGeneratorConfig {
  values: GenValue[];
  interval: number;
}
