import { numRound } from '@/entities/3d';
import type { Vector3Tuple } from '@/shared/types/math';
import { InputNumber } from '@/shared/ui/atoms/input-number';
import { AXIS_INDEX } from '../model/types';

export function RotationController({
  vec,
  onChange,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-1.5">
          <span className="w-4 text-[11px] font-medium uppercase text-white/58">
            {axis}
          </span>
          <InputNumber
            value={vec ? numRound(vec[AXIS_INDEX[axis]]) : 0}
            step={1}
            min={0}
            max={360}
            className="h-7 flex-1 rounded-sm px-2 text-[12px]"
            onChange={(v) => onChange(axis, Number(v))}
          />
        </div>
      ))}
    </div>
  );
}
