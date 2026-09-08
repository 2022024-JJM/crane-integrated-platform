import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import {
  getRestPose,
  hasRestPose,
  resetToRestPose,
  seedRestPose,
} from '../rest-pose-cache';

describe('rest-pose-cache', () => {
  it('seed 는 최초 1회만 잡고, 이미 있으면 덮어쓰지 않는다', () => {
    const node = new Object3D();
    node.position.set(1, 2, 3);
    seedRestPose(node);
    node.position.set(9, 9, 9);
    seedRestPose(node);
    expect(getRestPose(node).position.toArray()).toEqual([1, 2, 3]);
  });

  it('seed 없이 getRestPose 하면 최초 접근 시점의 자세가 rest 가 된다', () => {
    const node = new Object3D();
    expect(hasRestPose(node)).toBe(false);
    node.rotation.set(0, Math.PI / 2, 0);
    const rest = getRestPose(node);
    expect(hasRestPose(node)).toBe(true);
    node.rotation.set(0, 0, 0);
    expect(getRestPose(node)).toBe(rest);
    expect(rest.quaternion.y).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('rest 는 노드와 독립된 복사본이다 — 노드를 움직여도 변하지 않는다', () => {
    const node = new Object3D();
    node.position.set(1, 0, 0);
    const rest = getRestPose(node);
    node.position.x = 5;
    expect(rest.position.x).toBe(1);
  });

  it('resetToRestPose 는 위치·회전만 되돌리고 scale 은 건드리지 않는다', () => {
    const node = new Object3D();
    node.position.set(1, 1, 1);
    node.scale.set(2, 2, 2);
    seedRestPose(node);
    node.position.set(7, 7, 7);
    node.rotation.set(1, 0, 0);
    node.scale.set(3, 3, 3);
    resetToRestPose(node);
    expect(node.position.toArray()).toEqual([1, 1, 1]);
    expect(node.quaternion.x).toBe(0);
    expect(node.scale.x).toBe(3);
  });

  it('캐시가 없는 노드의 reset 은 no-op 이다', () => {
    const node = new Object3D();
    node.position.set(4, 4, 4);
    resetToRestPose(node);
    expect(node.position.toArray()).toEqual([4, 4, 4]);
    expect(hasRestPose(node)).toBe(false);
  });
});
