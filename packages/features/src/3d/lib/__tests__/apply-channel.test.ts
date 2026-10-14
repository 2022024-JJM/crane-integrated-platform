import { describe, expect, it } from 'vitest';
import { Object3D, Quaternion, Vector3 } from 'three';
import { seedRestPose, getRestPose } from '@crane/domain/3d';
import { addChannelDelta, beginNodePose } from '../apply-channel';

const zDeg = (o: Object3D) =>
  (2 * Math.atan2(o.quaternion.z, o.quaternion.w) * 180) / Math.PI;

function node(): Object3D {
  const n = new Object3D();
  n.position.set(1, 2, 3);
  n.scale.set(1, 1, 1);
  seedRestPose(n);
  return n;
}

describe('beginNodePose', () => {
  it('위치·회전·크기를 rest 로 되돌린다(크기 포함 — scale 채널이 생겼다)', () => {
    const n = node();
    n.position.set(9, 9, 9);
    n.rotation.set(1, 0, 0);
    n.scale.set(4, 4, 4);
    beginNodePose(n, getRestPose(n));
    expect(n.position.toArray()).toEqual([1, 2, 3]);
    expect(n.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-9);
    expect(n.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('임의의 rest(루트 배치 transform)도 받는다', () => {
    const n = node();
    const rest = {
      position: new Vector3(10, 0, -5),
      quaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1),
      scale: new Vector3(2, 2, 2),
    };
    beginNodePose(n, rest);
    expect(n.position.toArray()).toEqual([10, 0, -5]);
    expect(n.scale.x).toBe(2);
    expect(n.quaternion.angleTo(rest.quaternion)).toBeLessThan(1e-9);
  });
});

describe('addChannelDelta — 누적', () => {
  it('같은 노드의 다른 축 Δ 가 서로를 지우지 않는다', () => {
    const n = node();
    beginNodePose(n, getRestPose(n));
    addChannelDelta(n, 'position', 'x', 1);
    addChannelDelta(n, 'position', 'z', -2);
    expect(n.position.toArray()).toEqual([2, 2, 1]);
  });

  it('rotation 은 rest 에 post-multiply 로 누적된다', () => {
    const n = node();
    beginNodePose(n, getRestPose(n));
    addChannelDelta(n, 'rotation', 'z', 30);
    addChannelDelta(n, 'rotation', 'z', 15);
    expect(zDeg(n)).toBeCloseTo(45, 6);
  });

  it('scale 은 rest.scale 에 더한다', () => {
    const n = node();
    beginNodePose(n, getRestPose(n));
    addChannelDelta(n, 'scale', 'y', 0.5);
    expect(n.scale.toArray()).toEqual([1, 1.5, 1]);
  });

  it('position 은 부모 scale 체인을 나눠 로컬 단위로 환산한다', () => {
    const parent = new Object3D();
    parent.scale.setScalar(10);
    const n = node();
    parent.add(n);
    beginNodePose(n, getRestPose(n));
    addChannelDelta(n, 'position', 'y', 5);
    expect(n.position.y).toBeCloseTo(2.5, 9);
  });

  it('Δ 0·NaN·Infinity 는 no-op', () => {
    const n = node();
    beginNodePose(n, getRestPose(n));
    addChannelDelta(n, 'position', 'x', 0);
    addChannelDelta(n, 'position', 'x', NaN);
    addChannelDelta(n, 'rotation', 'x', Infinity);
    addChannelDelta(n, 'scale', 'x', -Infinity);
    expect(n.position.toArray()).toEqual([1, 2, 3]);
    expect(n.scale.x).toBe(1);
    expect(n.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-9);
  });
});

describe('addChannelDelta — 선회 중심(orbit)', () => {
  it('pivot 을 주면 위치가 pivot 둘레를 돌고(pivot + R·(p − pivot)) 회전은 그대로 쌓인다', () => {
    const n = new Object3D();
    n.position.set(10, 5, 0); // 노드 원점이 선회축(x=0,z=0)에서 10 떨어진 Top
    seedRestPose(n);
    const rest = getRestPose(n);
    beginNodePose(n, rest);
    addChannelDelta(n, 'rotation', 'y', 90, {
      pivot: [0, 5, 0],
      rest: rest.quaternion,
    });
    // y 축 +90° 회전: (10,0,0) → (0,0,-10)
    expect(n.position.x).toBeCloseTo(0, 9);
    expect(n.position.y).toBeCloseTo(5, 9);
    expect(n.position.z).toBeCloseTo(-10, 9);
    expect(
      (2 * Math.atan2(n.quaternion.y, n.quaternion.w) * 180) / Math.PI,
    ).toBeCloseTo(90, 9);
  });

  it('orbit 없이 같은 Δ 를 주면 위치는 움직이지 않는다(기존 동작)', () => {
    const n = new Object3D();
    n.position.set(10, 5, 0);
    seedRestPose(n);
    beginNodePose(n, getRestPose(n));
    addChannelDelta(n, 'rotation', 'y', 90);
    expect(n.position.toArray()).toEqual([10, 5, 0]);
  });

  it('rest 회전이 있으면 축을 부모 프레임으로 옮겨 돈다 — rest 가 z 축 90° 면 로컬 y 는 부모 −x', () => {
    const n = new Object3D();
    n.position.set(0, 10, 0);
    n.rotation.set(0, 0, Math.PI / 2);
    seedRestPose(n);
    const rest = getRestPose(n);
    beginNodePose(n, rest);
    addChannelDelta(n, 'rotation', 'y', 90, {
      pivot: [0, 0, 0],
      rest: rest.quaternion,
    });
    // 부모 −x 축 둘레 +90°: (0,10,0) → (0,0,−10)
    expect(n.position.x).toBeCloseTo(0, 9);
    expect(n.position.y).toBeCloseTo(0, 9);
    expect(n.position.z).toBeCloseTo(-10, 9);
  });

  it('Δ 0·비유한은 orbit 이 있어도 아무것도 바꾸지 않는다', () => {
    const n = new Object3D();
    n.position.set(10, 5, 0);
    seedRestPose(n);
    const rest = getRestPose(n);
    beginNodePose(n, rest);
    addChannelDelta(n, 'rotation', 'y', 0, {
      pivot: [0, 0, 0],
      rest: rest.quaternion,
    });
    addChannelDelta(n, 'rotation', 'y', NaN, {
      pivot: [0, 0, 0],
      rest: rest.quaternion,
    });
    expect(n.position.toArray()).toEqual([10, 5, 0]);
  });
});
