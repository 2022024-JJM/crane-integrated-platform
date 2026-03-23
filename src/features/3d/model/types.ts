export type AxisKey = 'x' | 'y' | 'z';

export type SceneTransformField = 'position' | 'rotation' | 'scale';

export const AXIS_INDEX = {
  x: 0,
  y: 1,
  z: 2,
} as const;

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
