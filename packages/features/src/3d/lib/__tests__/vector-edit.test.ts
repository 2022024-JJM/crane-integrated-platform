import { describe, expect, it } from 'vitest';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  applyAxisUpdate,
  normalizeRotationTuple,
  roundCommittedField,
  roundVectorValue,
  scaleVectorUniformly,
  updateVectorValue,
} from '../vector-edit';

describe('updateVectorValue', () => {
  it.each([
    ['x', 0, [45, 0, 0]],
    ['y', 1, [0, 45, 0]],
    ['z', 2, [0, 0, 45]],
  ] as const)(
    '%s축만 바꾸고 나머지 축은 정확히 0을 유지한다',
    (axis, idx, expected) => {
      const result = updateVectorValue([0, 0, 0], axis, 45);
      expect(result).toEqual(expected);
      result.forEach((v, i) => {
        if (i !== idx) {
          // epsilon 튐·-0 오염 없이 비트 단위로 0이어야 한다
          expect(Object.is(v, 0)).toBe(true);
        }
      });
    },
  );

  it('0이 아닌 기존 값도 편집한 축 외에는 그대로 유지한다', () => {
    expect(updateVectorValue([1.5, -2.25, 3], 'y', 45)).toEqual([1.5, 45, 3]);
  });

  it('입력 tuple을 변이하지 않고 새 배열을 반환한다', () => {
    const input: Vector3Tuple = [0, 0, 0];
    const result = updateVectorValue(input, 'x', 45);
    expect(input).toEqual([0, 0, 0]);
    expect(result).not.toBe(input);
  });

  it('같은 값으로 설정해도 새 참조를 반환한다 (현행 동작 특성화)', () => {
    const input: Vector3Tuple = [1, 2, 3];
    const result = updateVectorValue(input, 'x', 1);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(input);
  });
});

describe('roundVectorValue', () => {
  it('각 성분을 소수점 3자리로 반올림한다', () => {
    expect(roundVectorValue([1.23456, -1.23456, 0.0004])).toEqual([
      1.235, -1.235, 0,
    ]);
  });

  it('정수는 보존한다', () => {
    expect(roundVectorValue([1, -2, 300])).toEqual([1, -2, 300]);
  });
});

describe('scaleVectorUniformly (특성화)', () => {
  it('기준 축 변경 비율을 나머지 축에도 곱한다', () => {
    expect(scaleVectorUniformly([2, 4, 6], 'x', 4)).toEqual([4, 8, 12]);
  });

  it('기준 축이 0이면 세 축을 모두 value로 맞춘다 (문서화된 폴백)', () => {
    expect(scaleVectorUniformly([0, 2, 3], 'x', 5)).toEqual([5, 5, 5]);
  });

  it('비율 곱 결과는 소수점 3자리로 반올림된다', () => {
    expect(scaleVectorUniformly([3, 1, 1], 'x', 1)).toEqual([1, 0.333, 0.333]);
  });

  it('value가 0이면 나머지 축도 0이 된다 (현행 동작 특성화)', () => {
    expect(scaleVectorUniformly([2, 4, 6], 'x', 0)).toEqual([0, 0, 0]);
  });
});

describe('applyAxisUpdate', () => {
  it('회전: 한 축을 수정해도 다른 축은 정확히 0을 유지한다 (값 튐 회귀)', () => {
    const result = applyAxisUpdate('rotation', [0, 0, 0], 'y', 45);
    expect(result).toEqual([0, 45, 0]);
    expect(Object.is(result[0], 0)).toBe(true);
    expect(Object.is(result[2], 0)).toBe(true);
  });

  it('회전: 편집하지 않은 축의 음수 저장값은 재작성하지 않는다', () => {
    // 남의 축을 함께 정규화하면 그게 곧 "값 튐"으로 보인다 — 그대로 둔다.
    expect(applyAxisUpdate('rotation', [-90, 0, 0], 'y', 45)).toEqual([
      -90, 45, 0,
    ]);
  });

  it('회전: 범위 밖 입력을 [0,360)으로 wrap해 커밋한다', () => {
    expect(applyAxisUpdate('rotation', [0, 0, 0], 'x', 450)).toEqual([
      90, 0, 0,
    ]);
    expect(applyAxisUpdate('rotation', [0, 0, 0], 'x', -30)).toEqual([
      330, 0, 0,
    ]);
    expect(applyAxisUpdate('rotation', [0, 0, 0], 'x', 360)).toEqual([0, 0, 0]);
  });

  it('회전: 소수점 둘째자리에서 반올림해 커밋한다', () => {
    expect(applyAxisUpdate('rotation', [0, 0, 0], 'z', 45.67)).toEqual([
      0, 0, 45.7,
    ]);
    expect(applyAxisUpdate('rotation', [0, 0, 0], 'z', 45.64)).toEqual([
      0, 0, 45.6,
    ]);
  });

  it('회전: 반올림이 먼저라 359.96은 0으로 커밋된다', () => {
    expect(applyAxisUpdate('rotation', [0, 0, 0], 'z', 359.96)).toEqual([
      0, 0, 0,
    ]);
  });

  it('위치는 정규화 없이 음수를 그대로 커밋한다', () => {
    expect(applyAxisUpdate('position', [0, 0, 0], 'x', -30)).toEqual([
      -30, 0, 0,
    ]);
    expect(applyAxisUpdate('position', [0, 0, 0], 'x', 400)).toEqual([
      400, 0, 0,
    ]);
  });

  it('크기는 정규화 없이 반올림만 한다', () => {
    expect(applyAxisUpdate('scale', [1, 1, 1], 'y', 2.34567)).toEqual([
      1, 2.346, 1,
    ]);
  });

  it('uniformScale 옵션은 scale 필드에서만 비율 유지를 적용한다', () => {
    expect(
      applyAxisUpdate('scale', [2, 4, 6], 'x', 4, { uniformScale: true }),
    ).toEqual([4, 8, 12]);
    // rotation/position에서는 uniform 경로를 타지 않는다
    expect(
      applyAxisUpdate('rotation', [10, 20, 30], 'x', 45, {
        uniformScale: true,
      }),
    ).toEqual([45, 20, 30]);
    expect(
      applyAxisUpdate('position', [2, 4, 6], 'x', 4, { uniformScale: true }),
    ).toEqual([4, 4, 6]);
  });
});

describe('normalizeRotationTuple', () => {
  it('세 축 모두 [0,360)으로 wrap한다', () => {
    expect(normalizeRotationTuple([-30, 370, 0])).toEqual([330, 10, 0]);
  });

  it('이미 범위 안인 값은 그대로다', () => {
    expect(normalizeRotationTuple([0, 45, 359.999])).toEqual([0, 45, 359.999]);
  });

  it('-0은 +0이 된다', () => {
    const result = normalizeRotationTuple([-0, 0, 0]);
    expect(Object.is(result[0], 0)).toBe(true);
  });
});

describe('roundCommittedField', () => {
  it('rotation 필드는 소수점 둘째자리 반올림 후 [0,360) 정규화한다', () => {
    expect(roundCommittedField('rotation', [-30, 359.96, -0.04])).toEqual([
      330, 0, 0,
    ]);
    expect(roundCommittedField('rotation', [45.67, 45.64, 0])).toEqual([
      45.7, 45.6, 0,
    ]);
  });

  it('position/scale 필드는 반올림만 하고 음수를 보존한다', () => {
    expect(roundCommittedField('position', [-30.1234, 400, 0])).toEqual([
      -30.123, 400, 0,
    ]);
    expect(roundCommittedField('scale', [1.23456, 2, 3])).toEqual([
      1.235, 2, 3,
    ]);
  });
});
