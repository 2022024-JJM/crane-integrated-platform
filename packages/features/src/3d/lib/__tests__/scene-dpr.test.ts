import { describe, expect, it } from 'vitest';
import { SCENE_DEFAULT_DPR, resolveSceneDpr } from '../scene-dpr';

describe('resolveSceneDpr — 배율 1(기본)은 기본 범위 그대로', () => {
  it('기기 값과 무관하게 [1, 1.5] 범위를 돌려준다 (R3F 가 클램프한다)', () => {
    for (const device of [1, 1.25, 2, 3]) {
      expect(resolveSceneDpr(device, 1)).toEqual([...SCENE_DEFAULT_DPR]);
    }
  });

  it('프리셋 상수를 그대로 내주지 않는다 (호출자가 고쳐도 프리셋은 그대로)', () => {
    const first = resolveSceneDpr(1, 1) as [number, number];
    first[1] = 9;
    expect(SCENE_DEFAULT_DPR).toEqual([1, 1.5]);
    expect(resolveSceneDpr(1, 1)).toEqual([1, 1.5]);
  });
});

describe('resolveSceneDpr — 배율 1 미만은 클램프한 기기 값 × 배율', () => {
  it('기기 값 1 인 PC 도 실제로 줄어든다 (범위에 곱하면 1 로 남는 경우)', () => {
    expect(resolveSceneDpr(1, 0.7)).toBeCloseTo(0.7, 10);
    expect(resolveSceneDpr(1, 0.5)).toBeCloseTo(0.5, 10);
  });

  it('범위 안의 기기 값은 그대로 곱한다', () => {
    expect(resolveSceneDpr(1.25, 0.85)).toBeCloseTo(1.0625, 10);
  });

  it('상한: 1.5 는 그대로, 그 위(2·3)는 1.5 로 잘라 곱한다', () => {
    expect(resolveSceneDpr(1.5, 0.5)).toBeCloseTo(0.75, 10);
    expect(resolveSceneDpr(1.51, 0.5)).toBeCloseTo(0.75, 10);
    expect(resolveSceneDpr(2, 0.5)).toBeCloseTo(0.75, 10);
    expect(resolveSceneDpr(3, 0.7)).toBeCloseTo(1.05, 10);
  });

  it('하한: 1 은 그대로, 그 아래(브라우저 축소 0.8)는 1 로 올려 곱한다', () => {
    expect(resolveSceneDpr(1, 0.85)).toBeCloseTo(0.85, 10);
    expect(resolveSceneDpr(0.99, 0.85)).toBeCloseTo(0.85, 10);
    expect(resolveSceneDpr(0.8, 0.85)).toBeCloseTo(0.85, 10);
  });

  it('숫자 하나를 돌려준다 (범위가 아니다)', () => {
    expect(typeof resolveSceneDpr(1.25, 0.7)).toBe('number');
  });
});

describe('resolveSceneDpr — 잘못된 입력', () => {
  it('기기 값이 비유한·0 이하면 범위 하한(1)으로 본다', () => {
    for (const device of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
      -2,
    ]) {
      expect(resolveSceneDpr(device, 0.7)).toBeCloseTo(0.7, 10);
    }
  });

  it('배율이 비유한·0 이하·1 초과면 기본 범위다 (해상도를 올리거나 0 으로 만들지 않는다)', () => {
    for (const scale of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      -0.5,
      1.0001,
      2,
    ]) {
      expect(resolveSceneDpr(2, scale)).toEqual([1, 1.5]);
    }
  });

  it('경계: 1 바로 아래 배율은 줄인 숫자다', () => {
    expect(resolveSceneDpr(1, 0.999)).toBeCloseTo(0.999, 10);
  });
});
