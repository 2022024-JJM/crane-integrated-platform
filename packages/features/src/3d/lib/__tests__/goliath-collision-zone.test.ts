import { describe, expect, it } from 'vitest';
import {
  GOLIATH_LEG_OFFSETS,
  buildGoliathCollisionZones,
  buildGoliathEgoTopPose,
} from '../goliath-collision-zone';

const near = (value: number, expected: number) =>
  expect(value).toBeCloseTo(expected, 6);

describe('buildGoliathCollisionZones', () => {
  it('회전 0° — 다리 두 개가 거더축(+X)을 따라 실측 오프셋만큼 벌어진다', () => {
    const zones = buildGoliathCollisionZones([100, 5, -40], 0);

    expect(zones).toHaveLength(2);
    expect(zones.map((z) => z.label)).toEqual(['L1', 'L2']);
    near(zones[0].center[0], 100 + GOLIATH_LEG_OFFSETS.L1);
    near(zones[0].center[1], -40);
    near(zones[1].center[0], 100 + GOLIATH_LEG_OFFSETS.L2);
    near(zones[1].center[1], -40);
    // 주행축은 거더의 수직 — +X 거더면 +Z 방향.
    near(zones[0].travel![0], 0);
    near(zones[0].travel![1], 1);
  });

  it('회전 90° — 거더가 -Z 로 눕고 주행축이 +X 가 된다', () => {
    const [l1, l2] = buildGoliathCollisionZones([0, 0, 0], 90);

    near(l1.center[0], 0);
    near(l1.center[1], -GOLIATH_LEG_OFFSETS.L1);
    near(l2.center[0], 0);
    near(l2.center[1], -GOLIATH_LEG_OFFSETS.L2);
    near(l1.travel![0], 1);
    near(l1.travel![1], 0);
  });

  it('존 높이(y)는 크레인 배치 y 를 폴백으로 그대로 쓴다', () => {
    const zones = buildGoliathCollisionZones([0, 4.25, 0], 0);
    expect(zones.every((z) => z.y === 4.25)).toBe(true);
  });

  it('반경·위험 반경·축척은 두 존이 같고, 차선 밴드는 다리마다 다르다', () => {
    const [l1, l2] = buildGoliathCollisionZones([0, 0, 0], 0);

    expect(l1.radius).toBe(l2.radius);
    expect(l1.dangerRadius).toBe(l2.dangerRadius);
    expect(l1.metersPerUnit).toBe(l2.metersPerUnit);
    expect(l1.dangerRadius).toBeLessThan(l1.radius);
    expect(l1.cameraRadius!).toBeGreaterThan(l1.dangerRadius);
    expect(l1.laneBandsM).not.toEqual(l2.laneBandsM);
  });

  it('두 감지 원은 서로 닿지 않는다 (GAP 은 센서 배치를 반영한 특성)', () => {
    const [l1, l2] = buildGoliathCollisionZones([0, 0, 0], 0);
    const gap = Math.hypot(
      l1.center[0] - l2.center[0],
      l1.center[1] - l2.center[1],
    );
    expect(gap).toBeGreaterThan(l1.radius + l2.radius);
  });

  it('호출마다 새 배열 — 입력이 같아도 참조를 공유하지 않는다', () => {
    const a = buildGoliathCollisionZones([1, 2, 3], 10);
    const b = buildGoliathCollisionZones([1, 2, 3], 10);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
  });
});

describe('buildGoliathEgoTopPose', () => {
  it('주시점은 크레인 xz 위 고정 높이, 카메라는 주행축 반대로 물러난다', () => {
    const pose = buildGoliathEgoTopPose([100, 5, -40], 0);

    near(pose.target[0], 100);
    near(pose.target[2], -40);
    expect(pose.target[1]).toBeGreaterThan(0);
    // 회전 0° 의 주행축은 +Z 이므로 카메라는 -Z 쪽.
    near(pose.position[0], 100);
    expect(pose.position[2]).toBeLessThan(-40);
    expect(pose.position[1]).toBeGreaterThan(pose.target[1]);
  });

  it('크레인이 회전해도 상대 구도(거리·높이)는 같다', () => {
    const a = buildGoliathEgoTopPose([0, 0, 0], 0);
    const b = buildGoliathEgoTopPose([0, 0, 0], 37);
    const dist = (p: { position: number[]; target: number[] }) =>
      Math.hypot(
        p.position[0] - p.target[0],
        p.position[1] - p.target[1],
        p.position[2] - p.target[2],
      );
    near(dist(a), dist(b));
    near(a.position[1], b.position[1]);
  });

  it('회전 인자 생략은 0° 와 같다', () => {
    expect(buildGoliathEgoTopPose([3, 0, 7])).toEqual(
      buildGoliathEgoTopPose([3, 0, 7], 0),
    );
  });
});
