import { describe, expect, it } from 'vitest';
import { computeTopViewEntryPose } from '@crane/core/lib/top-view-pose';
import { northUpPose } from '../north-up';
import { resolveCompassViewForPose } from '../compass';

describe('northUpPose', () => {
  it('원근 포즈 — 결과의 나침반 북쪽 각도가 0 이고 거리·높이·타깃은 그대로', () => {
    const pose = {
      position: [30, 40, 50] as const,
      target: [0, 0, 0] as const,
    };
    for (const trueNorth of [0, 50.6, 180, 270]) {
      const next = northUpPose(
        { position: [...pose.position], target: [...pose.target] },
        trueNorth,
      );
      const view = resolveCompassViewForPose(
        next.position,
        next.target,
        trueNorth,
      )!;
      expect(Math.min(view.northDeg, 360 - view.northDeg)).toBeLessThan(1e-6);
      expect(next.position[1]).toBe(40);
      expect(next.target).toEqual([0, 0, 0]);
      const before = Math.hypot(30, 40, 50);
      const after = Math.hypot(...next.position);
      expect(after).toBeCloseTo(before, 9);
    }
  });

  it('탑뷰(미세 tilt) 포즈 — 평면도가 north-up 이 된다', () => {
    const entry = computeTopViewEntryPose([100, 80, 100], [0, 0, 0]);
    const next = northUpPose(entry, 50.6);
    const view = resolveCompassViewForPose(next.position, next.target, 50.6)!;
    expect(Math.min(view.northDeg, 360 - view.northDeg)).toBeLessThan(1e-6);
    expect(view.tilt).toBeCloseTo(1, 5);
  });

  it('멱등 — 이미 북쪽 위면 같은 포즈', () => {
    const once = northUpPose({ position: [10, 20, 30], target: [1, 2, 3] }, 33);
    const twice = northUpPose(once, 33);
    expect(twice.position[0]).toBeCloseTo(once.position[0], 12);
    expect(twice.position[2]).toBeCloseTo(once.position[2], 12);
  });
});
