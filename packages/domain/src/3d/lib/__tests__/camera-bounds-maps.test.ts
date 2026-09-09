import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import {
  collectCameraBoundsBox,
  resolveCameraBoundsMaps,
  unionObjectBounds,
} from '../camera-bounds-maps';
import type { SavedMapInfo } from '../../model/types';

const map = (id: string, extra: Partial<SavedMapInfo> = {}): SavedMapInfo => ({
  id,
  path: `/maps/${id}.glb`,
  ...extra,
});

/** 한 변 size 의 정육면체를 (x, y, z) 에 놓는다. */
function cube(size: number, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(size, size, size),
    new MeshBasicMaterial(),
  );
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld(true);
  return mesh;
}

describe('resolveCameraBoundsMaps', () => {
  it('undefined·null·빈 배열이면 빈 배열', () => {
    expect(resolveCameraBoundsMaps(undefined)).toEqual([]);
    expect(resolveCameraBoundsMaps(null)).toEqual([]);
    expect(resolveCameraBoundsMaps([])).toEqual([]);
  });

  it('체크된 지도만 같은 참조로 돌려준다', () => {
    const a = map('a', { cameraBounds: true });
    const b = map('b');
    const result = resolveCameraBoundsMaps([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });

  it('여러 장 체크는 배열 순서를 유지한다', () => {
    const a = map('a', { cameraBounds: true });
    const b = map('b');
    const c = map('c', { cameraBounds: true });
    expect(resolveCameraBoundsMaps([a, b, c])).toEqual([a, c]);
  });

  it('체크가 없으면 입력 배열 자체를 돌려준다(전부 기준)', () => {
    const maps = [map('a'), map('b')];
    expect(resolveCameraBoundsMaps(maps)).toBe(maps);
  });

  it('false·문자열은 미체크 취급 — 전부 미체크면 전부 폴백', () => {
    const maps = [
      map('a', { cameraBounds: false }),
      map('b', { cameraBounds: 'yes' as unknown as boolean }),
    ];
    expect(resolveCameraBoundsMaps(maps)).toBe(maps);
  });
});

describe('unionObjectBounds', () => {
  it('두 정육면체의 합집합', () => {
    const box = unionObjectBounds([cube(2, 0, 0, 0), cube(2, 10, 0, 0)])!;
    expect(box.min.toArray()).toEqual([-1, -1, -1]);
    expect(box.max.toArray()).toEqual([11, 1, 1]);
  });

  it('undefined(미등록)는 건너뛰고 나머지로 합집합', () => {
    const box = unionObjectBounds([undefined, cube(2, 5, 0, 0), undefined])!;
    expect(box.min.toArray()).toEqual([4, -1, -1]);
    expect(box.max.toArray()).toEqual([6, 1, 1]);
  });

  it('전부 undefined 이거나 빈 배열이면 null', () => {
    expect(unionObjectBounds([])).toBeNull();
    expect(unionObjectBounds([undefined, undefined])).toBeNull();
  });

  it('지오메트리 없는 객체만 있으면 null — 점으로 기여하지 않는다', () => {
    const empty = new Object3D();
    empty.position.set(3, 3, 3);
    empty.updateMatrixWorld(true);
    expect(unionObjectBounds([empty])).toBeNull();
  });

  it('빈 객체는 합집합에도 점을 보태지 않는다', () => {
    const empty = new Object3D();
    empty.position.set(100, 100, 100);
    empty.updateMatrixWorld(true);
    const box = unionObjectBounds([cube(2), empty])!;
    expect(box.max.toArray()).toEqual([1, 1, 1]);
  });

  it('부모 변환을 반영한다', () => {
    const parent = new Group();
    parent.position.set(0, 0, 20);
    const child = cube(2);
    parent.add(child);
    parent.updateMatrixWorld(true);
    const box = unionObjectBounds([child])!;
    expect(box.min.toArray()).toEqual([-1, -1, 19]);
    expect(box.max.toArray()).toEqual([1, 1, 21]);
  });
});

describe('collectCameraBoundsBox', () => {
  const registry = new Map<string, Object3D>([
    ['a', cube(2, 0, 0, 0)],
    ['b', cube(2, 10, 0, 0)],
    ['c', cube(2, 0, 0, 10)],
  ]);
  const get = (id: string) => registry.get(id);

  it('체크된 지도만 합친다', () => {
    const maps = [map('a', { cameraBounds: true }), map('b'), map('c')];
    const box = collectCameraBoundsBox(maps, get)!;
    expect(box.max.toArray()).toEqual([1, 1, 1]);
  });

  it('체크가 없으면 모든 지도 합집합', () => {
    const maps = [map('a'), map('b'), map('c')];
    const box = collectCameraBoundsBox(maps, get)!;
    expect(box.min.toArray()).toEqual([-1, -1, -1]);
    expect(box.max.toArray()).toEqual([11, 1, 11]);
  });

  it('체크된 지도가 전부 미등록이면 null — 전체로 넘어가지 않는다', () => {
    const maps = [map('missing', { cameraBounds: true }), map('a')];
    expect(collectCameraBoundsBox(maps, get)).toBeNull();
  });

  it('체크된 지도 일부만 로드됐으면 그것만으로 합집합', () => {
    const maps = [
      map('missing', { cameraBounds: true }),
      map('b', { cameraBounds: true }),
    ];
    const box = collectCameraBoundsBox(maps, get)!;
    expect(box.min.toArray()).toEqual([9, -1, -1]);
  });

  it('지도가 없으면 null', () => {
    expect(collectCameraBoundsBox(undefined, get)).toBeNull();
    expect(collectCameraBoundsBox([], get)).toBeNull();
  });
});
