import { numRound } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { AXIS_INDEX } from '../model/types';

export function ScaleController({
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
          <span className="text-muted-foreground w-4 shrink-0 text-center font-mono text-[11px] uppercase">
            {axis}
          </span>
          <InputNumber
            value={vec ? numRound(vec[AXIS_INDEX[axis]]) : 0}
            step={0.1}
            min={0.1}
            max={100}
            className="border-border bg-muted/50 h-7 flex-1 rounded-sm text-[12px]"
            onChange={(v) => onChange(axis, Number(v))}
          />
        </div>
      ))}
    </div>
  );
}
