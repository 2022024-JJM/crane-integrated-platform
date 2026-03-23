import { numRound } from '@/entities/3d';
import type { Vector3Tuple } from '@/shared/types/math';
import { InputNumber } from '@/shared/ui/atoms/input-number';
import { AXIS_INDEX } from '../model/types';

export function PositionController({
  vec,
  onChange,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-2">
          <span className="w-5 uppercase">{axis}</span>
          <InputNumber
            value={vec ? numRound(vec[AXIS_INDEX[axis]]) : 0}
            step={0.1}
            className="flex-1"
            onChange={(v) => onChange(axis, Number(v))}
          />
        </div>
      ))}
    </div>
  );
}
