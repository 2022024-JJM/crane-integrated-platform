import { describe, expect, it } from 'vitest';
import { Object3D, Quaternion, Vector3 } from 'three';
import { seedRestPose, type RigJoint } from '@crane/domain/3d';
import {
  accumulatedParentScale,
  applyJoint,
  clampJointValue,
  resetJointNode,
} from '../apply-joint';

function hinge(overrides: Partial<RigJoint> = {}): RigJoint {
  return { id: 'j', node: '', type: 'hinge', axis: 'x', ...overrides };
}

function slide(overrides: Partial<RigJoint> = {}): RigJoint {
  return { id: 'j', node: '', type: 'slide', axis: 'x', ...overrides };
}

describe('clampJointValue', () => {
  it('NaN/Infinity 는 0', () => {
    expect(clampJointValue(hinge(), NaN)).toBe(0);
    expect(clampJointValue(hinge(), Infinity)).toBe(0);
    expect(clampJointValue(hinge(), -Infinity)).toBe(0);
  });

  it('한계 정확값은 통과, 밖은 잘린다', () => {
    const j = hinge({ min: -10, max: 20 });
    expect(clampJointValue(j, -10)).toBe(-10);
    expect(clampJointValue(j, 20)).toBe(20);
    expect(clampJointValue(j, -10.01)).toBe(-10);
    expect(clampJointValue(j, 20.01)).toBe(20);
  });

  it('한쪽 한계만 있으면 그쪽만 자른다', () => {
    expect(clampJointValue(hinge({ max: 5 }), -1000)).toBe(-1000);
    expect(clampJointValue(hinge({ min: 5 }), 1000)).toBe(1000);
  });
});

describe('applyJoint — hinge', () => {
  it('rest 가 항등이 아닐 때 절대 대입이 아니라 rest ∘ Δ 로 합성한다', () => {
    const node = new Object3D();
    // rest: X 축 +45.9° (러핑 붐과 같은 상황)
    node.quaternion.setFromAxisAngle(
      new Vector3(1, 0, 0),
      (45.9 * Math.PI) / 180,
    );
    seedRestPose(node);

    applyJoint(node, hinge({ axis: 'x' }), 10);
    const expected = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      (55.9 * Math.PI) / 180,
    );
    expect(node.quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('자기 로컬 축 기준 — rest 가 Y 로 돌아 있으면 X 회전축도 따라 돈다(post-multiply)', () => {
    const node = new Object3D();
    node.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    seedRestPose(node);
    applyJoint(node, hinge({ axis: 'x' }), 90);
    // rest(Y 90°) ∘ X 90°: 로컬 X 는 월드 -Z 이므로 결과는 (Y90)*(X90).
    const expected = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
      .multiply(
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2),
      );
    expect(node.quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('값 0 은 rest 를 정확히 재현한다 — 누적 오차 없음', () => {
    const node = new Object3D();
    node.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.4);
    seedRestPose(node);
    for (let i = 0; i < 1000; i++) applyJoint(node, hinge(), i % 2 ? 30 : 0);
    applyJoint(node, hinge(), 0);
    expect(
      node.quaternion.angleTo(
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.4),
      ),
    ).toBeLessThan(1e-9);
  });

  it('sign -1 은 회전 방향을 뒤집고, 한계는 sign 이전 값에 적용된다', () => {
    const node = new Object3D();
    seedRestPose(node);
    applyJoint(node, hinge({ sign: -1, max: 30 }), 90);
    const expected = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      (-30 * Math.PI) / 180,
    );
    expect(node.quaternion.angleTo(expected)).toBeLessThan(1e-6);
  });

  it('NaN 값은 rest 로 둔다', () => {
    const node = new Object3D();
    node.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 1);
    seedRestPose(node);
    applyJoint(node, hinge(), NaN);
    expect(
      node.quaternion.angleTo(
        new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1),
      ),
    ).toBeLessThan(1e-9);
  });
});

describe('applyJoint — slide', () => {
  it('부모 scale 체인을 나눠 월드 미터를 로컬 단위로 환산한다', () => {
    const root = new Object3D();
    root.scale.setScalar(20);
    const mid = new Object3D();
    mid.scale.setScalar(0.5);
    const node = new Object3D();
    node.position.set(1, 2, 3);
    root.add(mid);
    mid.add(node);
    seedRestPose(node);

    expect(accumulatedParentScale(node)).toBe(10);
    applyJoint(node, slide({ axis: 'z' }), 5);
    expect(node.position.toArray()).toEqual([1, 2, 3.5]);
  });

  it('부모가 없으면 scale 1 로 그대로 더한다', () => {
    const node = new Object3D();
    seedRestPose(node);
    applyJoint(node, slide({ axis: 'y', sign: -1 }), 2);
    expect(node.position.toArray()).toEqual([0, -2, 0]);
  });

  it('부모 축 기준이다 — 노드 자신의 회전은 이동 방향에 영향이 없다', () => {
    const node = new Object3D();
    node.rotation.set(0, Math.PI / 2, 0);
    seedRestPose(node);
    applyJoint(node, slide({ axis: 'x' }), 1);
    expect(node.position.toArray()).toEqual([1, 0, 0]);
  });

  it('반복 적용해도 rest 에서 다시 시작한다(누적되지 않음)', () => {
    const node = new Object3D();
    seedRestPose(node);
    applyJoint(node, slide(), 3);
    applyJoint(node, slide(), 3);
    expect(node.position.x).toBe(3);
  });
});

describe('resetJointNode', () => {
  it('구동된 노드를 rest 로 되돌린다', () => {
    const node = new Object3D();
    node.position.set(1, 1, 1);
    seedRestPose(node);
    applyJoint(node, slide(), 9);
    applyJoint(node, hinge(), 45);
    resetJointNode(node);
    expect(node.position.toArray()).toEqual([1, 1, 1]);
    expect(node.quaternion.w).toBe(1);
  });
});
