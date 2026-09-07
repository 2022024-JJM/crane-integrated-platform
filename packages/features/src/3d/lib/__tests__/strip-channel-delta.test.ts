import { describe, expect, it } from 'vitest';
import { Group, Object3D, Quaternion, Vector3 } from 'three';
import { capturePose, seedRestPose, type RestPose } from '@crane/domain/3d';
import {
  accumulatedParentScale,
  addChannelDelta,
  beginNodePose,
} from '../apply-channel';
import { stripChannelDeltas, type ChannelDelta } from '../strip-channel-delta';

function restNode(): Object3D {
  const n = new Object3D();
  n.position.set(1, 2, 3);
  n.rotation.set(0.3, -0.7, 1.1);
  n.scale.set(2, 2, 2);
  seedRestPose(n);
  return n;
}

/** rest 에 Δ 목록을 적용한 자세를 만든다(드라이버와 같은 순서). */
function applied(node: Object3D, rest: RestPose, deltas: ChannelDelta[]) {
  beginNodePose(node, rest);
  for (const { channel, axis, delta } of deltas) {
    addChannelDelta(node, channel, axis, delta);
  }
  return capturePose(node);
}

function expectPose(actual: RestPose, expected: RestPose) {
  expect(actual.position.distanceTo(expected.position)).toBeLessThan(1e-9);
  expect(actual.quaternion.angleTo(expected.quaternion)).toBeLessThan(1e-9);
  expect(actual.scale.distanceTo(expected.scale)).toBeLessThan(1e-9);
}

describe('stripChannelDeltas', () => {
  it('위치·회전(두 축)·크기가 섞인 Δ 를 벗기면 rest 로 정확히 돌아온다', () => {
    const node = restNode();
    const rest = capturePose(node);
    const deltas: ChannelDelta[] = [
      { channel: 'position', axis: 'z', delta: 3 },
      { channel: 'rotation', axis: 'y', delta: 40 },
      { channel: 'scale', axis: 'x', delta: 0.5 },
      { channel: 'rotation', axis: 'x', delta: -25 },
      { channel: 'position', axis: 'x', delta: -1.5 },
    ];
    const pose = applied(node, rest, deltas);
    const out = stripChannelDeltas(pose, deltas, 1);
    expect(out).toBe(pose);
    expectPose(pose, rest);
  });

  it('회전은 역순으로 벗겨야 한다 — 같은 축이 아닌 두 회전은 순서를 바꾸면 rest 가 안 나온다', () => {
    const node = restNode();
    const rest = capturePose(node);
    const deltas: ChannelDelta[] = [
      { channel: 'rotation', axis: 'x', delta: 30 },
      { channel: 'rotation', axis: 'y', delta: 60 },
    ];
    const pose = applied(node, rest, deltas);
    const wrong = stripChannelDeltas(
      capturePose(node),
      [...deltas].reverse(),
      1,
    );
    expect(wrong.quaternion.angleTo(rest.quaternion)).toBeGreaterThan(1e-3);
    expectPose(stripChannelDeltas(pose, deltas, 1), rest);
  });

  it('부모 scale 체인이 있으면 위치 Δ 를 같은 비율로 나눠 뺀다', () => {
    const parent = new Group();
    parent.scale.setScalar(0.1);
    const node = restNode();
    parent.add(node);
    const rest = capturePose(node);
    const deltas: ChannelDelta[] = [
      { channel: 'position', axis: 'y', delta: 2 },
    ];
    const pose = applied(node, rest, deltas);
    expect(pose.position.y).toBeCloseTo(2 + 20, 9);
    expectPose(
      stripChannelDeltas(pose, deltas, accumulatedParentScale(node)),
      rest,
    );
  });

  it('빈 목록·0·NaN Δ 는 자세를 바꾸지 않는다', () => {
    const node = restNode();
    const rest = capturePose(node);
    const pose = capturePose(node);
    stripChannelDeltas(pose, [], 1);
    stripChannelDeltas(
      pose,
      [
        { channel: 'position', axis: 'x', delta: 0 },
        { channel: 'rotation', axis: 'z', delta: Number.NaN },
        { channel: 'scale', axis: 'y', delta: Number.POSITIVE_INFINITY },
      ],
      1,
    );
    expectPose(pose, rest);
  });

  it('parentScale 이 0 이하면 위치 Δ 를 나누지 않고 그대로 뺀다(적용 쪽과 같은 규칙)', () => {
    const pose: RestPose = {
      position: new Vector3(0, 0, 5),
      quaternion: new Quaternion(),
      scale: new Vector3(1, 1, 1),
    };
    stripChannelDeltas(pose, [{ channel: 'position', axis: 'z', delta: 2 }], 0);
    expect(pose.position.z).toBe(3);
  });
});
