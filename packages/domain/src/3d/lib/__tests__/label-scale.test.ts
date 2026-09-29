import { describe, expect, it } from 'vitest';
import {
  isLabelInRange,
  labelScaleAtDistance,
  LABEL_MIN_SCALE,
  LABEL_SCALE_REF_DISTANCE,
  LABEL_VISIBILITY_DISTANCE,
} from '../label-scale';

describe('isLabelInRange — 숨김 거리', () => {
  it('경계 — 정확히 그 거리는 보이고, 넘으면 숨긴다', () => {
    expect(isLabelInRange(LABEL_VISIBILITY_DISTANCE)).toBe(true);
    expect(isLabelInRange(LABEL_VISIBILITY_DISTANCE + 0.001)).toBe(false);
  });

  it('가까운 거리와 0 은 보인다', () => {
    expect(isLabelInRange(0)).toBe(true);
    expect(isLabelInRange(10)).toBe(true);
  });

  it('거리를 모르면(NaN) 숨긴다', () => {
    expect(isLabelInRange(Number.NaN)).toBe(false);
    expect(isLabelInRange(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('labelScaleAtDistance — 거리 축소', () => {
  it('기준 거리 안쪽은 원래 크기다', () => {
    expect(labelScaleAtDistance(1)).toBe(1);
    expect(labelScaleAtDistance(LABEL_SCALE_REF_DISTANCE / 2)).toBe(1);
  });

  it('경계 — 기준 거리에서 정확히 1, 넘으면 줄기 시작한다', () => {
    expect(labelScaleAtDistance(LABEL_SCALE_REF_DISTANCE)).toBe(1);
    expect(labelScaleAtDistance(LABEL_SCALE_REF_DISTANCE * 1.1)).toBeLessThan(
      1,
    );
  });

  it('멀어질수록 기준 ÷ 거리 비율로 줄어든다', () => {
    expect(labelScaleAtDistance(LABEL_SCALE_REF_DISTANCE * 1.25)).toBe(0.8);
    expect(labelScaleAtDistance(LABEL_SCALE_REF_DISTANCE * 2)).toBe(0.5);
  });

  it('최소 배율 밑으로는 내려가지 않는다', () => {
    // 기준 ÷ 최소 배율보다 먼 거리는 전부 최소 배율이다.
    const floorDistance = LABEL_SCALE_REF_DISTANCE / LABEL_MIN_SCALE;
    expect(labelScaleAtDistance(floorDistance * 1.1)).toBe(LABEL_MIN_SCALE);
    expect(labelScaleAtDistance(floorDistance * 10)).toBe(LABEL_MIN_SCALE);
    expect(labelScaleAtDistance(LABEL_VISIBILITY_DISTANCE)).toBe(
      LABEL_MIN_SCALE,
    );
  });

  it('멀어지는 동안 커지지 않는다(단조 감소)', () => {
    let previous = 1;
    for (let distance = 100; distance <= 1200; distance += 25) {
      const scale = labelScaleAtDistance(distance);
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
  });

  it('배율은 0.02 단위로 끊긴다 — 조금 움직여도 같은 값이면 style 을 다시 쓰지 않는다', () => {
    for (const distance of [310, 333, 377, 450, 512, 640]) {
      const scale = labelScaleAtDistance(distance);
      expect(Math.round(scale * 50)).toBeCloseTo(scale * 50, 9);
    }
    expect(labelScaleAtDistance(405)).toBe(labelScaleAtDistance(410));
  });

  it('거리를 모르면(0·음수·NaN·Infinity) 원래 크기', () => {
    for (const bad of [
      0,
      -10,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(labelScaleAtDistance(bad)).toBe(1);
    }
  });
});
