import { describe, expect, it } from 'vitest';
import { toRelativeCameraPose } from '../viewer-camera-sync';
import {
  computeFramingPose,
  computeViewFramingPose,
  VIEW_PRESETS,
} from '../viewer-framing';

const cube = { min: [-1, -1, -1], max: [1, 1, 1] } as const;
const bounds = { min: [...cube.min], max: [...cube.max] } as {
  min: [number, number, number];
  max: [number, number, number];
};
const distanceBetween = (a: number[], b: number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('computeFramingPose', () => {
  it('대상은 상자 중심, 반지름은 대각선의 절반', () => {
    const pose = computeFramingPose(
      { min: [0, 0, 0], max: [4, 2, 6] },
      35,
      1.5,
      'iso',
    );
    expect(pose.target).toEqual([2, 1, 3]);
    expect(pose.radius).toBeCloseTo(0.5 * Math.hypot(4, 2, 6));
  });

  it('카메라는 대상에서 정확히 distance 만큼 떨어져 있다', () => {
    for (const preset of VIEW_PRESETS) {
      const pose = computeFramingPose(bounds, 35, 1.6, preset);
      expect(distanceBetween(pose.position, pose.target)).toBeCloseTo(pose.distance);
    }
  });

  it('경계 구가 좁은 쪽 화각에 들어온다(여백 1 이면 딱 접한다)', () => {
    const fov = 40;
    const wide = computeFramingPose(bounds, fov, 2, 'front', 1);
    // 가로가 넓으면 세로 화각이 기준.
    expect(wide.distance).toBeCloseTo(
      wide.radius / Math.sin((fov * Math.PI) / 360),
    );
    // 세로로 긴 화면은 가로 화각이 더 좁아 더 멀리 물러난다.
    const tall = computeFramingPose(bounds, fov, 0.5, 'front', 1);
    expect(tall.distance).toBeGreaterThan(wide.distance);
  });

  it('탑뷰는 정수직이 아니다 — 카메라 up(+Y)과 시선이 평행하면 lookAt 이 퇴화한다', () => {
    const pose = computeFramingPose(bounds, 35, 1, 'top');
    expect(pose.position[1]).toBeGreaterThan(0);
    expect(pose.position[2]).not.toBe(pose.target[2]);
  });

  it('크기 0 인 상자는 반지름 1 로 본다', () => {
    const pose = computeFramingPose(
      { min: [5, 5, 5], max: [5, 5, 5] },
      35,
      1,
      'iso',
    );
    expect(pose.radius).toBe(1);
    expect(Number.isFinite(pose.distance)).toBe(true);
  });

  it('비정상 종횡비·화각에도 유한한 포즈를 낸다', () => {
    for (const [fov, aspect] of [
      [35, 0],
      [35, Number.NaN],
      [35, -2],
      [0, 1],
      [500, 1],
    ]) {
      const pose = computeFramingPose(bounds, fov, aspect, 'iso');
      expect(pose.position.every(Number.isFinite)).toBe(true);
      expect(pose.distance).toBeGreaterThan(0);
    }
  });
});

describe('computeViewFramingPose', () => {
  const box = { min: [0, 0, 0], max: [4, 2, 6] } as typeof bounds;
  const radius = 0.5 * Math.hypot(4, 2, 6);

  it('대상은 중심 + 오프셋×반지름, 거리는 배수×반지름, 카메라는 그 방향에 선다', () => {
    const pose = computeViewFramingPose(box, {
      direction: [0, 0, 1],
      distance: 3,
      targetOffset: [0.5, 0, 0],
    });
    expect(pose.radius).toBeCloseTo(radius);
    expect(pose.distance).toBeCloseTo(3 * radius);
    expect(pose.target[0]).toBeCloseTo(2 + 0.5 * radius);
    expect(pose.target[1]).toBeCloseTo(1);
    expect(pose.target[2]).toBeCloseTo(3);
    expect(pose.position[0]).toBeCloseTo(pose.target[0]);
    expect(pose.position[2]).toBeCloseTo(3 + 3 * radius);
    expect(distanceBetween(pose.position, pose.target)).toBeCloseTo(
      pose.distance,
    );
  });

  it('찍은 자세(toRelativeCameraPose)를 같은 경계에 되돌리면 원래 카메라다', () => {
    const camera = {
      position: [7, 5, -3] as [number, number, number],
      target: [1.5, 0.5, 2] as [number, number, number],
    };
    const relative = toRelativeCameraPose(camera, box)!;
    const pose = computeViewFramingPose(box, relative);
    pose.position.forEach((v, i) => expect(v).toBeCloseTo(camera.position[i]));
    pose.target.forEach((v, i) => expect(v).toBeCloseTo(camera.target[i]));
  });

  it('크기가 2배인 경계에서는 거리도 2배다 — 새 버전이 커져도 같은 구도', () => {
    const view = {
      direction: [1, 1, 1] as [number, number, number],
      distance: 2.5,
      targetOffset: [0, 0, 0] as [number, number, number],
    };
    const small = computeViewFramingPose(bounds, view);
    const large = computeViewFramingPose(
      { min: [-2, -2, -2], max: [2, 2, 2] },
      view,
    );
    expect(large.distance).toBeCloseTo(small.distance * 2);
    expect(large.radius).toBeCloseTo(small.radius * 2);
  });

  it('방향이 단위 벡터가 아니어도 거리는 그대로다(정규화)', () => {
    const pose = computeViewFramingPose(bounds, {
      direction: [0, 0, 10],
      distance: 3,
      targetOffset: [0, 0, 0],
    });
    expect(distanceBetween(pose.position, pose.target)).toBeCloseTo(
      pose.distance,
    );
    expect(pose.position[2]).toBeCloseTo(3 * pose.radius);
  });

  it('크기 0 인 상자는 반지름 1 로 본다', () => {
    const pose = computeViewFramingPose(
      { min: [5, 5, 5], max: [5, 5, 5] },
      { direction: [0, 0, 1], distance: 3, targetOffset: [0, 0, 0] },
    );
    expect(pose.radius).toBe(1);
    expect(pose.distance).toBe(3);
    expect(pose.position).toEqual([5, 5, 8]);
  });

  it('프리셋 프레이밍과 같은 모양(FramingPose)을 돌려준다', () => {
    const fit = computeFramingPose(bounds, 35, 1.5, 'iso');
    const pose = computeViewFramingPose(bounds, {
      direction: [1, 0.72, 1.12],
      distance: fit.distance / fit.radius,
      targetOffset: [0, 0, 0],
    });
    expect(Object.keys(pose).sort()).toEqual(Object.keys(fit).sort());
    pose.position.forEach((v, i) => expect(v).toBeCloseTo(fit.position[i]));
  });
});
