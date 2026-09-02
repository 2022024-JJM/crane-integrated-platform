import type { Vector3Tuple } from '@crane/core/types/math';
import { displayRotationValue, formatRotation } from '../lib/format-transform';
import { AxisVectorController } from './axis-vector-controller';

export function RotationController({
  vec,
  onChange,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  // min/max clamp 없음 — 450 같은 범위 밖 입력은 커밋 경로(applyAxisUpdate)가
  // [0,360)으로 wrap하고, 표시도 toValue/format이 wrap한다.
  return (
    <AxisVectorController
      vec={vec}
      onChange={onChange}
      format={formatRotation}
      unit="°"
      toValue={displayRotationValue}
    />
  );
}
