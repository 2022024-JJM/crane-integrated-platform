import type { Vector3Tuple } from '@crane/core/types/math';
import type { RigAxis } from '@crane/domain/3d';

const AXIS_INDEX: Record<RigAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/**
 * 관절 피벗(rest 원점 기준 부모 프레임 m 오프셋)의 한 성분을 바꾼 새 피벗 —
 * 인스펙터의 X·Y·Z 입력이 쓴다. 세 성분이
 * 전부 비거나 0 이면 피벗 자체를 없앤다(원점 회전과 같다). 비어 있던 피벗에 한 성분만 넣으면
 * 나머지는 0 이다. 비유한수는 비운 것으로 본다.
 */
export function withPivotAxis(
  pivot: Vector3Tuple | undefined,
  axis: RigAxis,
  value: number | undefined,
): Vector3Tuple | undefined {
  const next: [number | undefined, number | undefined, number | undefined] = [
    pivot?.[0],
    pivot?.[1],
    pivot?.[2],
  ];
  next[AXIS_INDEX[axis]] =
    value !== undefined && Number.isFinite(value) ? value : undefined;
  if (next.every((v) => v === undefined || v === 0)) return undefined;
  return [next[0] ?? 0, next[1] ?? 0, next[2] ?? 0];
}
