import { degToRad, numRound, radToDeg } from '@/entities/3d';
import { InputNumber } from '@/shared/ui/atoms/input-number';
import { type Euler } from 'three';

export function RotationController({
  vec,
  onChange,
}: {
  vec: Euler | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-2">
          <span className="w-5 uppercase">{axis}</span>
          <InputNumber
            value={vec ? numRound(radToDeg(vec[axis])) : 0}
            step={1}
            min={0}
            max={360}
            className="flex-1"
            onChange={(v) => onChange(axis, degToRad(Number(v)))}
          />
        </div>
      ))}
    </div>
  );
}
