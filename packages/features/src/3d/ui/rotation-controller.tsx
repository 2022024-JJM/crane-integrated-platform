import type { Vector3Tuple } from '@crane/core/types/math';
import { displayRotationValue, formatRotation } from '../lib/format-transform';
import { AxisVectorController } from './axis-vector-controller';

export function RotationController({
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
  // min/max clamp 없음 — 450 같은 범위 밖 입력은 커밋 경로(applyAxisUpdate)가
  // [0,360)으로 wrap하고, 표시도 toValue/format이 wrap한다.
  return (
    <AxisVectorController
      vec={vec}
      onChange={onChange}
      step={step}
      stepValue={stepValue}
      format={formatRotation}
      unit="°"
      toValue={displayRotationValue}
    />
  );
}
