import { numRound } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { AXIS_INDEX, type AxisKey } from '../model/types';

/**
 * position/rotation/scale 컨트롤러 공통 골격. 슬라이스 내부 전용이며
 * index.ts로 export하지 않는다 — 외부는 세 컨트롤러 이름을 쓴다.
 */
export function AxisVectorController({
  vec,
  onChange,
  min,
  max,
  format,
  toValue = numRound,
}: {
  vec: Vector3Tuple | undefined;
  onChange: (axis: AxisKey, v: number) => void;
  min?: number;
  max?: number;
  /** 비포커스 표시 문자열 (단위 접미사·자릿수 고정) */
  format: (v: number) => string;
  /** InputNumber value로 넘길 숫자 변환 (rotation은 wrap 포함) */
  toValue?: (v: number) => number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-1.5">
          <span className="text-muted-foreground w-4 shrink-0 text-center font-mono text-[11px] uppercase">
            {axis}
          </span>
          <InputNumber
            value={vec ? toValue(vec[AXIS_INDEX[axis]]) : 0}
            step={0.1}
            min={min}
            max={max}
            format={format}
            inputClassName="text-center"
            className="border-border bg-muted/50 h-7 flex-1 rounded-sm text-[12px]"
            onChange={(v) => onChange(axis, Number(v))}
          />
        </div>
      ))}
    </div>
  );
}
