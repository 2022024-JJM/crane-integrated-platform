import { normalizeDegrees, numRound } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  AXIS_INDEX,
  type AxisKey,
  type SceneTransformField,
} from '../model/types';

export function updateVectorValue(
  tuple: Vector3Tuple,
  axis: AxisKey,
  value: number,
): Vector3Tuple {
  const nextTuple = [...tuple] as Vector3Tuple;
  nextTuple[AXIS_INDEX[axis]] = value;
  return nextTuple;
}

export function roundVectorValue(tuple: Vector3Tuple): Vector3Tuple {
  return tuple.map((value) => numRound(value)) as Vector3Tuple;
}

/**
 * axis를 value로 바꾸되 나머지 축도 같은 비율로 곱한다(인스펙터 "비율 유지").
 * 기준 축이 0이면 비율을 정의할 수 없으므로 세 축을 value로 맞춘다.
 */
export function scaleVectorUniformly(
  tuple: Vector3Tuple,
  axis: AxisKey,
  value: number,
): Vector3Tuple {
  const base = tuple[AXIS_INDEX[axis]];
  const ratio = value / base;
  if (base === 0 || !Number.isFinite(ratio)) {
    return [value, value, value];
  }
  return roundVectorValue(
    tuple.map((v, i) =>
      i === AXIS_INDEX[axis] ? value : v * ratio,
    ) as Vector3Tuple,
  );
}

/** 인스펙터 축 단위 입력 옵션. 기즈모 경로에서는 쓰지 않는다. */
export interface AxisUpdateOptions {
  /** scale 필드에서만 유효. 나머지 축을 같은 비율로 함께 바꾼다. */
  uniformScale?: boolean;
}

/** 회전값 반올림 자릿수 — 소수점 둘째자리에서 반올림해 첫째자리까지 저장·표시한다. */
export const ROTATION_DECIMALS = 1;

/**
 * 인스펙터 축 단위 입력 커밋의 단일 진입점. rotation 은 소수점 첫째자리로
 * 반올림 후 [0,360) 으로 정규화해 저장하고(UI 표시 단위와 저장값 일치),
 * 나머지는 numRound(3자리)만 한다. 편집한 축만 재작성한다 — 나머지 축을
 * 함께 정규화하면 "한 축 수정에 다른 축 값이 바뀌는" 것으로 보이므로
 * 그대로 둔다.
 */
export function applyAxisUpdate(
  field: SceneTransformField,
  base: Vector3Tuple,
  axis: AxisKey,
  value: number,
  options?: AxisUpdateOptions,
): Vector3Tuple {
  if (field === 'scale' && options?.uniformScale) {
    return scaleVectorUniformly(base, axis, numRound(value));
  }
  const next =
    field === 'rotation'
      ? normalizeDegrees(numRound(value, ROTATION_DECIMALS))
      : numRound(value);
  return updateVectorValue(base, axis, next);
}

/**
 * 회전 벡터 전체를 [0,360) 으로 정규화한다 — 기즈모 mouse-up 커밋용.
 * 오일러 각 각 성분에 ±360° 를 더해도 자세는 동일하므로 표현만 바뀐다.
 */
export function normalizeRotationTuple(vec: Vector3Tuple): Vector3Tuple {
  return vec.map((v) => normalizeDegrees(v)) as Vector3Tuple;
}

/**
 * 기즈모 커밋 직전 공통 처리. rotation 필드는 소수점 첫째자리 반올림 후
 * [0,360) 정규화하고(반올림이 먼저여야 359.96 → 360 → 0 으로 wrap 된다),
 * 나머지는 3자리 반올림만 한다. 커밋되는 필드 자체의 표현만 바뀌므로
 * use-scene-transform.ts commitFinal 주석이 경고하는 "다른 필드 역변환
 * 덮어쓰기" 경로와는 무관하다.
 */
export function roundCommittedField(
  field: SceneTransformField,
  vec: Vector3Tuple,
): Vector3Tuple {
  if (field === 'rotation') {
    return normalizeRotationTuple(
      vec.map((v) => numRound(v, ROTATION_DECIMALS)) as Vector3Tuple,
    );
  }
  return roundVectorValue(vec);
}
