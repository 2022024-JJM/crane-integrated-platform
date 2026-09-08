import { describe, expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { orbitAroundPivot, scaleAboutPivot } from '../pivot-transform';

const yaw = (deg: number) =>
  new Quaternion().setFromEuler(new Euler(0, (deg * Math.PI) / 180, 0));

const near = (v: Vector3Tuple, expected: Vector3Tuple) => {
  expect(v[0]).toBeCloseTo(expected[0], 9);
  expect(v[1]).toBeCloseTo(expected[1], 9);
  expect(v[2]).toBeCloseTo(expected[2], 9);
};

describe('orbitAroundPivot', () => {
  it('항등 회전이면 시작 위치 그대로', () => {
    near(orbitAroundPivot([3, 1, -2], [0, 0, 0], new Quaternion()), [3, 1, -2]);
  });

  it('원점 피벗 yaw +90° 는 +X 를 −Z 로 보낸다 (three 의 Y 축 회전 부호)', () => {
    near(orbitAroundPivot([1, 0, 0], [0, 0, 0], yaw(90)), [0, 0, -1]);
  });

  it('피벗이 원점이 아니면 피벗 기준 오프셋만 돈다', () => {
    near(orbitAroundPivot([6, 2, 0], [5, 0, 0], yaw(90)), [5, 2, -1]);
  });

  it('시작 위치가 피벗과 같으면 어떤 회전에도 그대로', () => {
    near(orbitAroundPivot([5, 3, 5], [5, 3, 5], yaw(123.4)), [5, 3, 5]);
  });

  it('입력 튜플을 바꾸지 않는다', () => {
    const start: Vector3Tuple = [1, 2, 3];
    const pivot: Vector3Tuple = [4, 5, 6];
    orbitAroundPivot(start, pivot, yaw(45));
    expect(start).toEqual([1, 2, 3]);
    expect(pivot).toEqual([4, 5, 6]);
  });
});

describe('scaleAboutPivot', () => {
  it('비율 1 이면 시작 위치 그대로', () => {
    near(scaleAboutPivot([3, 1, -2], [1, 1, 1], [1, 1, 1]), [3, 1, -2]);
  });

  it('성분별 비율만큼 피벗 기준 오프셋을 벌린다', () => {
    near(scaleAboutPivot([6, 2, -3], [5, 0, 1], [2, 1, 0.5]), [7, 2, -1]);
  });

  it('시작 위치가 피벗과 같으면 어떤 비율에도 그대로', () => {
    near(scaleAboutPivot([5, 3, 5], [5, 3, 5], [3, 0.1, 7]), [5, 3, 5]);
  });

  it('입력 튜플을 바꾸지 않는다', () => {
    const start: Vector3Tuple = [1, 2, 3];
    const pivot: Vector3Tuple = [4, 5, 6];
    const ratio: Vector3Tuple = [2, 2, 2];
    scaleAboutPivot(start, pivot, ratio);
    expect(start).toEqual([1, 2, 3]);
    expect(pivot).toEqual([4, 5, 6]);
    expect(ratio).toEqual([2, 2, 2]);
  });
});
