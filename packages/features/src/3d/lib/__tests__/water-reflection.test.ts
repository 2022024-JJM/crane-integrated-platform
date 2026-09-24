import type { SavedMapInfo } from '@crane/domain/3d';
import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import {
  hideForReflection,
  resolveReflectionExcludedMapIds,
  restoreAfterReflection,
} from '../water-reflection';

function map(id: string, path: string): SavedMapInfo {
  return { id, path };
}

describe('resolveReflectionExcludedMapIds', () => {
  it('카탈로그 kind 가 context 인 지도의 id 만 고른다', () => {
    const maps = [
      map('a', '/maps/okpo.glb'),
      map('b', '/maps/okpo-terrain.glb'),
      map('c', '/maps/okpo-tree.glb'),
      map('d', '/maps/philly-area-1.glb'),
      map('e', '/maps/philly-terrain.glb'),
    ];
    expect(resolveReflectionExcludedMapIds(maps)).toEqual(['b', 'c', 'e']);
  });

  it('ground·미등록 경로·빈 경로는 제외한다', () => {
    const maps = [
      map('ground', '/maps/plane.glb'),
      map('unknown', '/maps/not-in-catalog.glb'),
      map('empty', ''),
    ];
    expect(resolveReflectionExcludedMapIds(maps)).toEqual([]);
  });

  it('undefined·빈 배열 → 빈 배열', () => {
    expect(resolveReflectionExcludedMapIds(undefined)).toEqual([]);
    expect(resolveReflectionExcludedMapIds([])).toEqual([]);
  });

  it('배열 순서를 보존하고 같은 경로가 두 번이면 두 id 모두 남긴다', () => {
    const maps = [
      map('z', '/maps/philly-terrain.glb'),
      map('y', '/maps/okpo.glb'),
      map('x', '/maps/okpo-terrain.glb'),
      map('w', '/maps/philly-terrain.glb'),
    ];
    expect(resolveReflectionExcludedMapIds(maps)).toEqual(['z', 'x', 'w']);
  });

  it('입력 배열을 바꾸지 않고 매번 새 배열을 돌려준다', () => {
    const maps = [map('b', '/maps/okpo-terrain.glb')];
    const first = resolveReflectionExcludedMapIds(maps);
    const second = resolveReflectionExcludedMapIds(maps);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(maps).toHaveLength(1);
  });
});

describe('hideForReflection', () => {
  it('visible 인 것만 끄고 스크래치에 적재, 원래 invisible 은 그대로 두고 적재하지 않는다', () => {
    const a = new Object3D();
    const b = new Object3D();
    b.visible = false;
    const hidden: Object3D[] = [];
    hideForReflection([a, b], hidden);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);
    expect(hidden).toEqual([a]);
  });

  it('null·undefined 항목은 건너뛴다', () => {
    const a = new Object3D();
    const hidden: Object3D[] = [];
    expect(() =>
      hideForReflection([null, undefined, a, undefined], hidden),
    ).not.toThrow();
    expect(hidden).toEqual([a]);
    expect(a.visible).toBe(false);
  });

  it('빈 iterable 은 no-op', () => {
    const hidden: Object3D[] = [];
    hideForReflection([], hidden);
    expect(hidden).toEqual([]);
  });

  it('제너레이터·Set 같은 다른 iterable 도 받는다', () => {
    const a = new Object3D();
    const b = new Object3D();
    const hidden: Object3D[] = [];
    hideForReflection(new Set([a, b]), hidden);
    expect(hidden).toEqual([a, b]);
  });

  it('같은 객체가 두 번 나와도 한 번만 적재된다(두 번째는 이미 invisible)', () => {
    const a = new Object3D();
    const hidden: Object3D[] = [];
    hideForReflection([a, a], hidden);
    expect(hidden).toEqual([a]);
  });

  it('스크래치의 기존 항목은 지우지 않고 뒤에 덧붙인다', () => {
    const prev = new Object3D();
    const a = new Object3D();
    const hidden: Object3D[] = [prev];
    hideForReflection([a], hidden);
    expect(hidden).toEqual([prev, a]);
  });
});

describe('restoreAfterReflection', () => {
  it('숨긴 객체를 다시 켜고 스크래치를 비운다(같은 배열 참조 유지)', () => {
    const a = new Object3D();
    const b = new Object3D();
    const hidden: Object3D[] = [];
    hideForReflection([a, b], hidden);
    restoreAfterReflection(hidden);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);
    expect(hidden).toEqual([]);
    expect(hidden).toHaveLength(0);
  });

  it('원래 invisible 이던 객체는 hide 가 적재하지 않았으므로 켜지지 않는다', () => {
    const a = new Object3D();
    const b = new Object3D();
    b.visible = false;
    const hidden: Object3D[] = [];
    hideForReflection([a, b], hidden);
    restoreAfterReflection(hidden);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
  });

  it('빈 스크래치는 no-op', () => {
    const hidden: Object3D[] = [];
    expect(() => restoreAfterReflection(hidden)).not.toThrow();
    expect(hidden).toEqual([]);
  });

  it('숨김→복원을 반복해도 스크래치가 자라지 않는다', () => {
    const a = new Object3D();
    const hidden: Object3D[] = [];
    for (let i = 0; i < 3; i += 1) {
      hideForReflection([a], hidden);
      expect(hidden).toHaveLength(1);
      restoreAfterReflection(hidden);
      expect(hidden).toHaveLength(0);
      expect(a.visible).toBe(true);
    }
  });
});
