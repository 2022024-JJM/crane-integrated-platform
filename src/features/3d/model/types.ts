import type { SavedModelInfo } from '@/entities/3d';

export type AxisKey = 'x' | 'y' | 'z';

export type SceneTransformField = 'position' | 'rotation' | 'scale';
export type SceneTransformMode = 'translate' | 'rotate' | 'scale';

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

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface MonitoringHoveredModel {
  model: SavedModelInfo;
  position: ScreenPosition;
}

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
