import { afterEach, describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { makeMeshId, modelObjectRegistry } from '@crane/domain/3d';
import {
  FOCUS_PADDING,
  focusDistance,
  focusPose,
  resolvePreviewNode,
} from '../focus-camera';

describe('focusDistance', () => {
  it('세로 fov 기준 — 반지름 / sin(반각) × 여유', () => {
    // fov 90°, 정사각 화면 → 반각 45°
    expect(focusDistance(10, 90, 1, 0)).toBeCloseTo(
      (10 / Math.sin(Math.PI / 4)) * FOCUS_PADDING,
    );
  });

  it('가로가 더 좁으면(aspect < 1) 가로 반각으로 더 물러난다', () => {
    const square = focusDistance(10, 90, 1, 0);
    const narrow = focusDistance(10, 90, 0.5, 0);
    expect(narrow).toBeGreaterThan(square);
    const halfHorizontal = Math.atan(Math.tan(Math.PI / 4) * 0.5);
    expect(narrow).toBeCloseTo((10 / Math.sin(halfHorizontal)) * FOCUS_PADDING);
  });

  it('가로가 더 넓으면(aspect > 1) 세로 반각 그대로', () => {
    expect(focusDistance(10, 90, 2, 0)).toBeCloseTo(
      focusDistance(10, 90, 1, 0),
    );
  });

  it('fov 를 모르면 반각 45° 로 본다', () => {
    expect(focusDistance(10, null, null, 0)).toBeCloseTo(
      focusDistance(10, 90, 1, 0),
    );
  });

  it('최소 거리 하한 — 작은 노드·반지름 0 도 그 아래로 가지 않는다', () => {
    expect(focusDistance(0.01, 60, 1.5, 5)).toBe(5);
    expect(focusDistance(0, 60, 1.5, 5)).toBe(5);
    expect(focusDistance(100, 60, 1.5, 5)).toBeGreaterThan(5);
  });
});

describe('focusPose', () => {
  it('중심을 보며 방향으로 거리만큼 물러난다', () => {
    const pose = focusPose([1, 2, 3], [0, 0, 1], 10);
    expect(pose.target).toEqual([1, 2, 3]);
    expect(pose.position).toEqual([1, 2, 13]);
  });

  it('입력 튜플은 손대지 않는다', () => {
    const center: [number, number, number] = [1, 2, 3];
    const direction: [number, number, number] = [1, 0, 0];
    const pose = focusPose(center, direction, 2);
    expect(pose.target).not.toBe(center);
    expect(center).toEqual([1, 2, 3]);
    expect(direction).toEqual([1, 0, 0]);
  });
});

describe('resolvePreviewNode', () => {
  afterEach(() => {
    modelObjectRegistry.clear();
  });

  it('빈 경로는 모델 루트, 그 밖은 makeMeshId 로 등록된 노드', () => {
    const root = new Object3D();
    const node = new Object3D();
    modelObjectRegistry.register('m1', root);
    modelObjectRegistry.register(makeMeshId('m1', '[0]A'), node);
    expect(resolvePreviewNode('m1', '')).toBe(root);
    expect(resolvePreviewNode('m1', '[0]A')).toBe(node);
  });

  it('등록되지 않은 노드·모델은 undefined', () => {
    modelObjectRegistry.register('m1', new Object3D());
    expect(resolvePreviewNode('m1', '[9]Z')).toBeUndefined();
    expect(resolvePreviewNode('m2', '')).toBeUndefined();
  });
});
