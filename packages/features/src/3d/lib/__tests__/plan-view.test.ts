import { describe, expect, it } from 'vitest';
import {
  PLAN_HEADING_MIN_RATIO,
  PLAN_STACK_GAP_PX,
  isPlanLabelVisible,
  PLAN_LABEL_MAX_EXTENT_M,
  visibleExtentM,
  planHeading,
  PLAN_VIEW_MIN_DOWN,
  equipmentFocusPose,
  isPlanView,
  stackMarkerRows,
} from '../plan-view';

describe('isPlanView', () => {
  it('하한 정확값은 평면, 그보다 덜 수직이면 아님, NaN 은 아님', () => {
    expect(isPlanView(-PLAN_VIEW_MIN_DOWN)).toBe(true);
    expect(isPlanView(-1)).toBe(true);
    expect(isPlanView(-PLAN_VIEW_MIN_DOWN + 1e-6)).toBe(false);
    expect(isPlanView(0)).toBe(false);
    expect(isPlanView(NaN)).toBe(false);
  });
});

describe('stackMarkerRows', () => {
  it('겹치지 않으면 0, 겹치면 아래로 내리고, 연쇄로 쌓인다', () => {
    const h = 16;
    const far = [
      { x: 0, y: 0, w: 40, h },
      { x: 100, y: 0, w: 40, h },
    ];
    expect(stackMarkerRows(far)).toEqual([0, 0]);
    const same = [
      { x: 0, y: 0, w: 40, h },
      { x: 5, y: 2, w: 40, h },
      { x: 2, y: 4, w: 40, h },
    ];
    const off = stackMarkerRows(same);
    expect(off[0]).toBe(0);
    expect(off[1]).toBeCloseTo(h + PLAN_STACK_GAP_PX - 2, 6);
    expect(off[2]).toBeCloseTo(2 * (h + PLAN_STACK_GAP_PX) - 4, 6);
  });

  it('입력 순서를 유지한 오프셋 — 정렬은 내부 일이다', () => {
    const h = 10;
    const boxes = [
      { x: 0, y: 5, w: 20, h },
      { x: 0, y: 0, w: 20, h },
    ];
    const off = stackMarkerRows(boxes);
    expect(off[1]).toBe(0);
    expect(off[0]).toBeCloseTo(h + PLAN_STACK_GAP_PX - 5, 6);
    expect(stackMarkerRows([])).toEqual([]);
  });
});

describe('equipmentFocusPose', () => {
  it('타깃은 중심, 위치는 위·남동쪽으로 거리/mpu 만큼', () => {
    const pose = equipmentFocusPose([10, 0, 10], 2);
    expect(pose.target).toEqual([10, 0, 10]);
    expect(pose.position[1]).toBeGreaterThan(0);
    const dx = pose.position[0] - 10;
    const dy = pose.position[1];
    const dz = pose.position[2] - 10;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(70, 6);
    expect(equipmentFocusPose([0, 0, 0], 0).position[1]).toBeGreaterThan(0);
  });
});

describe('planHeading', () => {
  it('중심이 치우친 쪽의 각, 문턱 안이면 null, 비유한은 null', () => {
    expect(planHeading(0, 0, 10, 0, 20)).toBeCloseTo(0, 6);
    expect(planHeading(0, 0, 0, 10, 20)).toBeCloseTo(Math.PI / 2, 6);
    expect(planHeading(0, 0, -10, 0, 20)).toBeCloseTo(Math.PI, 6);
    const r = 20;
    expect(
      planHeading(0, 0, r * PLAN_HEADING_MIN_RATIO - 1e-6, 0, r),
    ).toBeNull();
    expect(planHeading(0, 0, r * PLAN_HEADING_MIN_RATIO, 0, r)).not.toBeNull();
    expect(planHeading(0, 0, NaN, 0, r)).toBeNull();
  });
});

describe('isPlanLabelVisible / visibleExtentM', () => {
  it('상한 정확값까지 보이고 그 위·NaN 은 숨김', () => {
    expect(isPlanLabelVisible(PLAN_LABEL_MAX_EXTENT_M)).toBe(true);
    expect(isPlanLabelVisible(PLAN_LABEL_MAX_EXTENT_M + 1)).toBe(false);
    expect(isPlanLabelVisible(NaN)).toBe(false);
  });
  it('세로 실거리 = 2·높이·tan(fov/2)·mpu, mpu 0 은 1', () => {
    expect(visibleExtentM(100, 90, 1)).toBeCloseTo(200, 6);
    expect(visibleExtentM(100, 90, 2)).toBeCloseTo(400, 6);
    expect(visibleExtentM(100, 90, 0)).toBeCloseTo(200, 6);
  });
});
