import { describe, expect, it } from 'vitest';
import { BoxGeometry, Matrix4, Mesh, MeshBasicMaterial, Object3D } from 'three';
import {
  collisionViewRadius,
  computeCollisionViewPose,
  copyMatrix,
  matrixChanged,
  pairKey,
} from '../scene-collision-pairs';

describe('pairKey', () => {
  it('순서와 무관하게 같은 키를 만든다', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
    expect(pairKey('a', 'b')).toBe('a|b');
  });

  it('같은 id 끼리도 키가 나온다(호출자가 자기 쌍을 걸러야 한다)', () => {
    expect(pairKey('x', 'x')).toBe('x|x');
  });
});

describe('matrixChanged / copyMatrix', () => {
  it('복사 직후엔 불변, 원소 하나가 바뀌면 변경', () => {
    const m = new Matrix4().makeTranslation(1, 2, 3);
    const snap = copyMatrix(m, new Float64Array(16));
    expect(matrixChanged(snap, m)).toBe(false);
    m.elements[12] = 1.0001;
    expect(matrixChanged(snap, m)).toBe(true);
  });

  it('copyMatrix 는 out 참조를 그대로 돌려준다', () => {
    const out = new Float64Array(16);
    expect(copyMatrix(new Matrix4(), out)).toBe(out);
    expect(out[0]).toBe(1);
    expect(out[15]).toBe(1);
  });

  it('NaN 원소는 매번 변경으로 본다(NaN !== NaN) — 무한 재검사를 유발하므로 상류에서 막는다', () => {
    const m = new Matrix4();
    m.elements[0] = Number.NaN;
    const snap = copyMatrix(m, new Float64Array(16));
    expect(matrixChanged(snap, m)).toBe(true);
  });
});

describe('collisionViewRadius', () => {
  it('노드들의 월드 박스 합집합 바운딩 구 반지름', () => {
    const a = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    const b = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial());
    b.position.set(2, 0, 0);
    a.updateMatrixWorld(true);
    b.updateMatrixWorld(true);
    // 합집합 x ∈ [-1, 3], y,z ∈ [-1, 1] → 대각선 √(16+4+4)=√24 → 반지름 √6
    expect(collisionViewRadius([a, b])).toBeCloseTo(Math.sqrt(6));
  });

  it('빈 배열·지오메트리 없는 노드는 0', () => {
    expect(collisionViewRadius([])).toBe(0);
    expect(collisionViewRadius([new Object3D()])).toBe(0);
  });
});

describe('computeCollisionViewPose', () => {
  it('현재 카메라 방향을 유지한 채 접촉점에서 물러난다', () => {
    const pose = computeCollisionViewPose([10, 0, 0], 4, {
      position: [0, 0, 20],
      target: [0, 0, 0],
    });
    expect(pose.target).toEqual([10, 0, 0]);
    // 방향 +z, 거리 4×2.5=10
    expect(pose.position[0]).toBeCloseTo(10);
    expect(pose.position[2]).toBeCloseTo(10);
  });

  it('현재 포즈가 없거나 퇴화(위치=타깃)면 기본 방향', () => {
    const fallback = computeCollisionViewPose([0, 0, 0], 4, null);
    const degenerate = computeCollisionViewPose([0, 0, 0], 4, {
      position: [1, 1, 1],
      target: [1, 1, 1],
    });
    expect(degenerate.position).toEqual(fallback.position);
    expect(fallback.position[1]).toBeGreaterThan(0);
  });

  it('반지름이 작거나 NaN 이면 최소 거리 6 을 쓴다', () => {
    const small = computeCollisionViewPose([0, 0, 0], 0.5, {
      position: [0, 0, 1],
      target: [0, 0, 0],
    });
    expect(small.position[2]).toBeCloseTo(6);
    const nan = computeCollisionViewPose([0, 0, 0], Number.NaN, {
      position: [0, 0, 1],
      target: [0, 0, 0],
    });
    expect(nan.position[2]).toBeCloseTo(6);
  });

  it('반환 튜플은 입력 배열과 다른 참조다', () => {
    const contact: [number, number, number] = [1, 2, 3];
    const pose = computeCollisionViewPose(contact, 1, null);
    expect(pose.target).not.toBe(contact);
    expect(pose.target).toEqual(contact);
  });
});
