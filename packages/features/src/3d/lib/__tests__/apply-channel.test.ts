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
