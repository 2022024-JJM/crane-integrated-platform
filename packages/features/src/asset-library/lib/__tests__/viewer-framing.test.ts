import { describe, expect, it } from 'vitest';
import { computeFramingPose, VIEW_PRESETS } from '../viewer-framing';

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
