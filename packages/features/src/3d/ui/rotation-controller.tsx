import { numRound } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { AXIS_INDEX } from '../model/types';

export function RotationController({
  vec,
  onChange,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-1.5">
          <span className="w-4 text-[10px] font-semibold text-muted-foreground uppercase">
            {axis}
          </span>
          <InputNumber
            value={vec ? numRound(vec[AXIS_INDEX[axis]]) : 0}
            step={0.1}
            min={-360}
            max={360}
            className="h-7 flex-1 rounded-sm border-border bg-muted/50 text-[12px]"
            onChange={(v) => onChange(axis, Number(v))}
          />
        </div>
      ))}
    </div>
  );
}
