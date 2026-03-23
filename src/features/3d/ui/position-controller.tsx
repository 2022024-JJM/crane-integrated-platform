import { numRound } from '@/entities/3d';
import { InputNumber } from '@/shared/ui/atoms/input-number';
import type { Vector3 } from 'three';

export function PositionController({
  vec,
  onChange,
}: {
  vec: Vector3 | undefined;
  onChange: (axis: 'x' | 'y' | 'z', v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-2">
          <span className="w-5 uppercase">{axis}</span>
          <InputNumber
            value={vec ? numRound(vec[axis]) : 0} // 소수점 4번째 자리에서 반올림
            step={0.1}
            className="flex-1"
            onChange={(v) => onChange(axis, Number(v))}
          />
        </div>
      ))}
    </div>
  );
}
