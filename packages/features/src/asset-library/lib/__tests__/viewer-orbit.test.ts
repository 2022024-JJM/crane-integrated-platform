import { describe, expect, it } from 'vitest';
import { orbitCameraPose, VIEWER_ORBIT_STEP_DEG } from '../viewer-orbit';

type Tuple = [number, number, number];

const distanceBetween = (a: Tuple, b: Tuple) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 대상에서 앞(+Z)에 선 카메라. */
const front = {
  position: [0, 2, 10] as Tuple,
  target: [0, 0, 0] as Tuple,
};

/**
 * 카메라 오른쪽 벡터(forward × up, up 은 +Y). 물체의 앞면(대상 + Z)이 화면의
 * 어느 쪽에 보이는지 판정하는 데 쓴다.
 */
function screenRight(pose: { position: Tuple; target: Tuple }): Tuple {
  const forward: Tuple = [
    pose.target[0] - pose.position[0],
    pose.target[1] - pose.position[1],
    pose.target[2] - pose.position[2],
  ];
  // (fx, fy, fz) × (0, 1, 0) = (-fz, 0, fx)
  return [-forward[2], 0, forward[0]];
}

describe('orbitCameraPose', () => {
  it('카메라-대상 거리와 높이는 그대로이고 대상은 움직이지 않는다', () => {
    const pose = {
      position: [3, 4, 5] as Tuple,
      target: [10, -2, 7] as Tuple,
    };
    for (const direction of ['left', 'right'] as const) {
      const next = orbitCameraPose(pose, direction);
      expect(distanceBetween(next.position, next.target)).toBeCloseTo(
        distanceBetween(pose.position, pose.target),
      );
      expect(next.position[1]).toBeCloseTo(pose.position[1]);
      expect(next.target).toEqual(pose.target);
    }
  });

  it('오른쪽으로 돌리면 물체의 앞면이 화면 오른쪽으로 간다', () => {
    const next = orbitCameraPose(front, 'right');
    const right = screenRight(next);
    // 앞면(+Z)을 오른쪽 벡터에 투영한 값이 양수면 화면 오른쪽에 있다.
    expect(right[2]).toBeGreaterThan(0);
    // 카메라는 앞에서 왼쪽(-X)으로 물러난다.
    expect(next.position[0]).toBeLessThan(0);
    expect(next.position[2]).toBeGreaterThan(0);
  });

  it('왼쪽으로 돌리면 물체의 앞면이 화면 왼쪽으로 간다', () => {
    const next = orbitCameraPose(front, 'left');
    expect(screenRight(next)[2]).toBeLessThan(0);
    expect(next.position[0]).toBeGreaterThan(0);
  });

  it('한 걸음은 정확히 기본 각도다', () => {
    const next = orbitCameraPose(front, 'right');
    const radius = Math.hypot(front.position[0], front.position[2]);
    const angle = Math.atan2(next.position[0], next.position[2]);
    expect(Math.abs(angle)).toBeCloseTo(
      (VIEWER_ORBIT_STEP_DEG * Math.PI) / 180,
    );
    expect(Math.hypot(next.position[0], next.position[2])).toBeCloseTo(radius);
  });

  it('왼쪽과 오른쪽은 서로 되돌린다', () => {
    const back = orbitCameraPose(orbitCameraPose(front, 'right'), 'left');
    back.position.forEach((v, i) => expect(v).toBeCloseTo(front.position[i]));
  });

  it('한 바퀴(360°)를 같은 방향으로 돌면 제자리다', () => {
    const steps = 360 / VIEWER_ORBIT_STEP_DEG;
    expect(Number.isInteger(steps)).toBe(true);
    let pose = front;
    for (let i = 0; i < steps; i += 1) pose = orbitCameraPose(pose, 'right');
    pose.position.forEach((v, i) => expect(v).toBeCloseTo(front.position[i]));
  });

  it('각도 0 은 자세를 바꾸지 않는다', () => {
    const next = orbitCameraPose(front, 'left', 0);
    next.position.forEach((v, i) => expect(v).toBeCloseTo(front.position[i]));
  });

  it('카메라가 대상과 겹쳐 있으면 그대로다', () => {
    const pose = { position: [1, 2, 3] as Tuple, target: [1, 2, 3] as Tuple };
    expect(orbitCameraPose(pose, 'right')).toEqual(pose);
  });

  it('대상 바로 위(탑뷰)에서도 유한한 자세를 낸다', () => {
    const next = orbitCameraPose(
      { position: [0, 10, 0.01], target: [0, 0, 0] },
      'right',
    );
    expect(next.position.every(Number.isFinite)).toBe(true);
    expect(next.position[1]).toBeCloseTo(10);
  });
});
