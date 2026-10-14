import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import {
  computeCollisionViewPose,
  copyMatrix,
  displacementBound,
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

describe('displacementBound — 강체 이동으로 점이 움직일 수 있는 거리의 상한', () => {
  const snapshot = (m: Matrix4) => Float64Array.from(m.elements);
  it('첫 관측(prev NaN)은 Infinity, 변화 없으면 0', () => {
    const m = new Matrix4();
    expect(displacementBound(new Float64Array(16).fill(Number.NaN), m, 1)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(displacementBound(snapshot(m), m, 5)).toBe(0);
  });
  it('평행이동은 그 길이, 회전은 ‖ΔR‖_F·reach 이고 실제 점 이동보다 작지 않다', () => {
    const prev = new Matrix4();
    const moved = new Matrix4().makeTranslation(3, 4, 0);
    expect(displacementBound(snapshot(prev), moved, 10)).toBeCloseTo(5, 9);
    const rotated = new Matrix4().makeRotationY(Math.PI / 2);
    const reach = 2;
    const bound = displacementBound(snapshot(prev), rotated, reach);
    // 반지름 2 의 점이 90° 돌면 2√2 이동 — 상한은 그 이상.
    expect(bound).toBeGreaterThanOrEqual(2 * Math.SQRT2 - 1e-9);
    const scaled = new Matrix4().makeScale(2, 2, 2);
    expect(displacementBound(snapshot(prev), scaled, 1)).toBeGreaterThanOrEqual(
      Math.sqrt(3) - 1e-9,
    );
  });
});
