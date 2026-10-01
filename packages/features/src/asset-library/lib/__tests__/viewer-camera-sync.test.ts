import { describe, expect, it, vi } from 'vitest';
import {
  createViewerCameraSync,
  fromRelativeCameraPose,
  toRelativeCameraPose,
} from '../viewer-camera-sync';

const small = { min: [-1, -1, -1], max: [1, 1, 1] } as {
  min: [number, number, number];
  max: [number, number, number];
};
const large = { min: [90, 0, -10], max: [110, 20, 10] } as typeof small;

describe('상대 카메라 자세', () => {
  it('같은 경계로 되돌리면 원래 자세다', () => {
    const pose = {
      position: [4, 3, 5] as [number, number, number],
      target: [0.2, -0.1, 0.3] as [number, number, number],
    };
    const relative = toRelativeCameraPose(pose, small)!;
    const back = fromRelativeCameraPose(relative, small);
    back.position.forEach((v, i) => expect(v).toBeCloseTo(pose.position[i]));
    back.target.forEach((v, i) => expect(v).toBeCloseTo(pose.target[i]));
  });

  it('크기·위치가 다른 물체에는 같은 구도로 옮긴다', () => {
    // 작은 물체: 중심에서 +Z 로 반지름의 3배 거리.
    const radius = Math.hypot(2, 2, 2) / 2;
    const relative = toRelativeCameraPose(
      { position: [0, 0, 3 * radius], target: [0, 0, 0] },
      small,
    )!;
    expect(relative.direction).toEqual([0, 0, 1]);
    expect(relative.distance).toBeCloseTo(3);

    // 10배 큰 물체에서는 그 중심에서 +Z 로 자기 반지름의 3배.
    const applied = fromRelativeCameraPose(relative, large);
    expect(applied.target).toEqual([100, 10, 0]);
    expect(applied.position[0]).toBeCloseTo(100);
    expect(applied.position[2]).toBeCloseTo(3 * radius * 10);
  });

  it('대상이 중심에서 벗어난 만큼도 반지름 비율로 옮긴다', () => {
    const radius = Math.hypot(2, 2, 2) / 2;
    const relative = toRelativeCameraPose(
      { position: [radius, 0, 5], target: [radius, 0, 0] },
      small,
    )!;
    expect(relative.targetOffset[0]).toBeCloseTo(1);
    const applied = fromRelativeCameraPose(relative, large);
    expect(applied.target[0]).toBeCloseTo(100 + radius * 10);
  });

  it('카메라가 대상과 겹치거나 좌표가 비정상이면 null', () => {
    expect(
      toRelativeCameraPose({ position: [1, 1, 1], target: [1, 1, 1] }, small),
    ).toBeNull();
    expect(
      toRelativeCameraPose(
        { position: [Number.NaN, 0, 0], target: [0, 0, 0] },
        small,
      ),
    ).toBeNull();
  });

  it('크기 0 인 경계는 반지름 1 로 본다(0 으로 나누지 않는다)', () => {
    const point = { min: [5, 5, 5], max: [5, 5, 5] } as typeof small;
    const relative = toRelativeCameraPose(
      { position: [5, 5, 9], target: [5, 5, 5] },
      point,
    )!;
    expect(relative.distance).toBe(4);
    expect(relative.targetOffset).toEqual([0, 0, 0]);
  });
});

describe('createViewerCameraSync', () => {
  const pose = {
    direction: [0, 0, 1] as [number, number, number],
    distance: 3,
    targetOffset: [0, 0, 0] as [number, number, number],
  };

  it('구독자 모두에게 보낸 쪽 id 와 함께 전한다', () => {
    const sync = createViewerCameraSync();
    const a = vi.fn();
    const b = vi.fn();
    sync.subscribe(a);
    sync.subscribe(b);
    sync.publish('left', pose);
    expect(a).toHaveBeenCalledWith('left', pose);
    expect(b).toHaveBeenCalledWith('left', pose);
  });

  it('구독을 풀면 더 받지 않고, 두 번 풀어도 안전하다', () => {
    const sync = createViewerCameraSync();
    const listener = vi.fn();
    const unsubscribe = sync.subscribe(listener);
    unsubscribe();
    unsubscribe();
    sync.publish('left', pose);
    expect(listener).not.toHaveBeenCalled();
  });

  it('구독자가 없어도 보낼 수 있다', () => {
    expect(() => createViewerCameraSync().publish('left', pose)).not.toThrow();
  });
});
