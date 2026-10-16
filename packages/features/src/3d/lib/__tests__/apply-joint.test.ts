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

describe('applyJoint — hinge pivot', () => {
  /** 피벗 점의 부모 좌표 — rest 원점 + 오프셋. */
  const pivotPoint = (rest: Vector3, p: [number, number, number]) =>
    rest.clone().add(new Vector3(...p));
  /** 노드 로컬 점을 부모 좌표로(scale 포함). */
  const toParent = (node: Object3D, local: Vector3) =>
    local
      .clone()
      .multiply(node.scale)
      .applyQuaternion(node.quaternion)
      .add(node.position);

  it('피벗 점은 제자리, 원점은 피벗 둘레로 돈다', () => {
    const node = new Object3D();
    node.position.set(15.81, 34.52, 0.73);
    seedRestPose(node);
    const pivot: [number, number, number] = [-15.51, 0, -0.73];
    const fixed = pivotPoint(node.position, pivot);
    applyJoint(node, hinge({ axis: 'y', pivot }), 90);
    // 원점은 마스트 축에서 같은 거리를 유지한 채 90° 돈다.
    const r = Math.hypot(pivot[0], pivot[2]);
    expect(node.position.distanceTo(fixed)).toBeCloseTo(r, 9);
    expect(node.position.y).toBeCloseTo(34.52, 9);
    expect(
      node.position.distanceTo(new Vector3(15.81, 34.52, 0.73)),
    ).toBeGreaterThan(1);
    // 피벗 점을 로컬로 되돌려 다시 부모로 보내면 제자리다.
    const local = fixed
      .clone()
      .sub(node.position)
      .applyQuaternion(node.quaternion.clone().invert())
      .divide(node.scale);
    expect(toParent(node, local).distanceTo(fixed)).toBeLessThan(1e-9);
  });

  it('노드 scale 이 커도(meshopt 양자화 36×) 피벗은 m 그대로다', () => {
    const node = new Object3D();
    node.position.set(15.81, 34.52, 0.73);
    node.scale.setScalar(36.3);
    seedRestPose(node);
    const pivot: [number, number, number] = [-15.51, 0, -0.73];
    const fixed = pivotPoint(node.position, pivot);
    applyJoint(node, hinge({ axis: 'y', pivot }), 180);
    // 180° 면 원점은 피벗 반대편(2r 이동)이고 축 거리 r 는 그대로.
    const r = Math.hypot(pivot[0], pivot[2]);
    expect(node.position.distanceTo(fixed)).toBeCloseTo(r, 9);
    expect(
      node.position.distanceTo(new Vector3(15.81, 34.52, 0.73)),
    ).toBeCloseTo(2 * r, 9);
  });

  it('rest 회전이 있어도 피벗 점(부모 프레임)은 제자리다', () => {
    const node = new Object3D();
    node.position.set(1, 2, 3);
    node.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.7);
    node.scale.setScalar(2);
    seedRestPose(node);
    const pivot: [number, number, number] = [4, 0, -2];
    const fixed = pivotPoint(node.position, pivot);
    // 피벗 점의 로컬 좌표(rest 기준)를 잡아 두고, 회전 뒤 같은 로컬 점이
    // 같은 부모 좌표에 있는지 본다.
    const local = fixed
      .clone()
      .sub(node.position)
      .applyQuaternion(node.quaternion.clone().invert())
      .divide(node.scale);
    applyJoint(node, hinge({ axis: 'y', pivot }), 123);
    expect(toParent(node, local).distanceTo(fixed)).toBeLessThan(1e-9);
  });

  it('피벗이 없으면 원점 회전 — 위치가 그대로다', () => {
    const node = new Object3D();
    node.position.set(3, 4, 5);
    seedRestPose(node);
    applyJoint(node, hinge({ axis: 'y' }), 90);
    expect(node.position.toArray()).toEqual([3, 4, 5]);
  });

  it('slide 는 피벗을 무시한다', () => {
    const node = new Object3D();
    seedRestPose(node);
    applyJoint(node, slide({ axis: 'x', pivot: [9, 9, 9] }), 2);
    expect(node.position.toArray()).toEqual([2, 0, 0]);
  });

  it('값 0 은 피벗이 있어도 rest 그대로(no-op)', () => {
    const node = new Object3D();
    node.position.set(1, 1, 1);
    seedRestPose(node);
    applyJoint(node, hinge({ axis: 'y', pivot: [5, 0, 5] }), 0);
    expect(node.position.toArray()).toEqual([1, 1, 1]);
  });
});
