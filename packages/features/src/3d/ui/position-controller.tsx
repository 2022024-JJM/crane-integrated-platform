import type { Vector3Tuple } from '@crane/core/types/math';
import { formatPosition } from '../lib/format-transform';
import { AxisVectorController } from './axis-vector-controller';

export function PositionController({
  vec,
  onChange,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  return (
    <AxisVectorController
      vec={vec}
      onChange={onChange}
      format={formatPosition}
      unit=" m"
    />
  );
}
