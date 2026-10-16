import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import {
  PlanOverlapScanner,
  buildPlanHiddenIndex,
  hasPlanOverlapChanged,
} from '../plan-overlap-scan';

function model(
  size: [number, number, number],
  position: [number, number, number],
): Group {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(...size), new MeshStandardMaterial());
  mesh.position.set(...position);
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

describe('PlanOverlapScanner', () => {
  it('레지스트리의 루트로 메쉬 박스를 채워 겹침을 낸다 — 없는 id 는 건너뛴다', () => {
    const tower = model([4, 30, 4], [0, 15, 0]);
    const jib = model([60, 2, 2], [0, 41, 0]);
    const roots = new Map<string, Object3D>([
      ['tower', tower],
      ['jib', jib],
    ]);
    const scanner = new PlanOverlapScanner();
    const out = scanner.scan(['tower', 'jib', 'ghost'], (id) => roots.get(id));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ upperId: 'jib', lowerId: 'tower', gap: 10 });
  });

  it('루트가 움직이면 다음 스캔에 반영된다(메쉬 재수집 없이 월드 박스 갱신)', () => {
    const a = model([2, 2, 2], [0, 1, 0]);
    const b = model([2, 2, 2], [0, 11, 0]);
    const roots = new Map<string, Object3D>([
      ['a', a],
      ['b', b],
    ]);
    const scanner = new PlanOverlapScanner();
    expect(scanner.scan(['a', 'b'], (id) => roots.get(id))).toHaveLength(1);
    b.position.x = 10;
    b.updateMatrixWorld(true);
    expect(scanner.scan(['a', 'b'], (id) => roots.get(id))).toHaveLength(0);
  });

  it('루트 참조가 바뀌면 메쉬를 다시 모은다', () => {
    const roots = new Map<string, Object3D>([
      ['a', model([2, 2, 2], [0, 1, 0])],
      ['b', model([2, 2, 2], [0, 11, 0])],
    ]);
    const scanner = new PlanOverlapScanner();
    expect(scanner.scan(['a', 'b'], (id) => roots.get(id))).toHaveLength(1);
    // b 를 멀리 있는 새 루트로 교체.
    roots.set('b', model([2, 2, 2], [50, 11, 0]));
    expect(scanner.scan(['a', 'b'], (id) => roots.get(id))).toHaveLength(0);
  });

  it('결과 배열은 재사용하고 항목은 스캔마다 새 객체다', () => {
    const roots = new Map<string, Object3D>([
      ['a', model([2, 2, 2], [0, 1, 0])],
      ['b', model([2, 2, 2], [0, 11, 0])],
    ]);
    const scanner = new PlanOverlapScanner();
    const first = scanner.scan(['a', 'b'], (id) => roots.get(id));
    const firstItem = first[0];
    const second = scanner.scan(['a', 'b'], (id) => roots.get(id));
    expect(second).toBe(first);
    expect(second[0]).not.toBe(firstItem);
    expect(second[0]).toEqual(firstItem);
  });
});

describe('hasPlanOverlapChanged / buildPlanHiddenIndex', () => {
  const overlap = { key: 'a|b', upperId: 'a', lowerId: 'b', gap: 3 };

  it('여유 값만 달라진 것은 변화가 아니다 — 쌍·위아래가 바뀌어야 변화다', () => {
    expect(hasPlanOverlapChanged([overlap], [{ ...overlap, gap: 3.02 }])).toBe(
      false,
    );
    expect(hasPlanOverlapChanged([overlap], [{ ...overlap, gap: -1 }])).toBe(
      false,
    );
    expect(
      hasPlanOverlapChanged(
        [overlap],
        [{ ...overlap, upperId: 'b', lowerId: 'a' }],
      ),
    ).toBe(true);
    expect(hasPlanOverlapChanged([overlap], [])).toBe(true);
    expect(hasPlanOverlapChanged([], [])).toBe(false);
  });

  it('숨은선 인덱스는 가려지는 쪽에 0부터', () => {
    const map = buildPlanHiddenIndex([
      overlap,
      { ...overlap, key: 'c|d', upperId: 'c', lowerId: 'd' },
    ]);
    expect(map.get('b')).toBe(0);
    expect(map.get('d')).toBe(1);
    expect(map.has('a')).toBe(false);
  });

  it('빈 목록의 인덱스는 비어 있다', () => {
    expect(buildPlanHiddenIndex([]).size).toBe(0);
  });
});
