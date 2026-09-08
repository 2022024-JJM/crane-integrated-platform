import type { Vector3Tuple } from '@crane/core/types/math';
import { formatScale } from '../lib/format-transform';
import { AxisVectorController } from './axis-vector-controller';

export function ScaleController({
  vec,
  onChange,
  step,
  stepValue,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
  /** 스테퍼 한 칸(스냅 단위). 없으면 기본 델타. */
  step?: number;
  /** 스테퍼 계산 전략 — 스냅 격자 이동. */
  stepValue?: (value: number, step: number, direction: 1 | -1) => number;
}) {
  return (
    <AxisVectorController
      vec={vec}
      onChange={onChange}
      step={step}
      stepValue={stepValue}
      min={0.1}
      max={100}
      format={formatScale}
    />
  );
}
