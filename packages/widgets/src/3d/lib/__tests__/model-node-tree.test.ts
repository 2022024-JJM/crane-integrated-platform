import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, Object3D } from 'three';
import {
  buildModelNodeTree,
  flattenModelNodeTree,
  getSingleSelectedNodeId,
  getSingleSelectedObjectId,
  listModelNodeOptions,
  listNodeAncestorPaths,
} from '../model-node-tree';

function fixture() {
  const root = new Object3D();
  const base = new Object3D();
  base.name = 'Base';
  const link = new Object3D();
  link.name = 'Link_01';
  const mesh = new Mesh(new BoxGeometry());
  mesh.name = 'Link_01';
  const unnamed = new Object3D();
  root.add(base);
  base.add(link);
  base.add(mesh);
  link.add(unnamed);
  return { root, base, link, mesh, unnamed };
}

describe('buildModelNodeTree', () => {
  it('root 자신은 빼고 자손을 [index]name 경로로 나열한다', () => {
    const tree = buildModelNodeTree(fixture().root);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ path: '[0]Base', kind: 'group', depth: 0 });
    expect(tree[0].children.map((c) => c.path)).toEqual([
      '[0]Base/[0]Link_01',
      '[0]Base/[1]Link_01',
    ]);
  });

  it('Mesh 는 mesh, 그 외는 group 으로 구분하고 이름 중복은 index 로 갈린다', () => {
    const [base] = buildModelNodeTree(fixture().root);
    expect(base.children[0].kind).toBe('group');
    expect(base.children[1].kind).toBe('mesh');
    expect(base.children[0].name).toBe(base.children[1].name);
  });

  it('이름 없는 노드는 (unnamed) 로 표시하되 경로는 빈 이름을 유지한다', () => {
    const [base] = buildModelNodeTree(fixture().root);
    const unnamed = base.children[0].children[0];
    expect(unnamed.name).toBe('(unnamed)');
    expect(unnamed.path).toBe('[0]Base/[0]Link_01/[0]');
    expect(unnamed.depth).toBe(2);
  });

  it('자식이 없는 root 는 빈 배열', () => {
    expect(buildModelNodeTree(new Object3D())).toEqual([]);
  });
});

describe('flattenModelNodeTree', () => {
  it('펼치지 않으면 최상위만, 펼친 노드의 자식만 DFS 로 편다', () => {
    const tree = buildModelNodeTree(fixture().root);
    expect(flattenModelNodeTree(tree, new Set()).map((i) => i.path)).toEqual([
      '[0]Base',
    ]);
    expect(
      flattenModelNodeTree(tree, new Set(['[0]Base'])).map((i) => i.path),
    ).toEqual(['[0]Base', '[0]Base/[0]Link_01', '[0]Base/[1]Link_01']);
    expect(
      flattenModelNodeTree(
        tree,
        new Set(['[0]Base', '[0]Base/[0]Link_01']),
      ).map((i) => i.path),
    ).toEqual([
      '[0]Base',
      '[0]Base/[0]Link_01',
      '[0]Base/[0]Link_01/[0]',
      '[0]Base/[1]Link_01',
    ]);
  });

  it('부모가 접혀 있으면 자식이 펼침 집합에 있어도 보이지 않는다', () => {
    const tree = buildModelNodeTree(fixture().root);
    expect(
      flattenModelNodeTree(tree, new Set(['[0]Base/[0]Link_01'])).map(
        (i) => i.path,
      ),
    ).toEqual(['[0]Base']);
  });
});

describe('listModelNodeOptions', () => {
  it('전체 트리를 들여쓴 라벨로 편다', () => {
    const options = listModelNodeOptions(buildModelNodeTree(fixture().root));
    expect(options.map((o) => o.label)).toEqual([
      'Base',
      '  Link_01',
      '    (unnamed)',
      '  Link_01',
    ]);
    expect(options[3].kind).toBe('mesh');
  });
});

describe('listNodeAncestorPaths', () => {
  it('자기 자신은 빼고 얕은 조상부터 나열한다', () => {
    expect(listNodeAncestorPaths('[0]A/[1]B/[2]C')).toEqual([
      '[0]A',
      '[0]A/[1]B',
    ]);
  });

  it('최상위 경로와 빈 경로는 조상이 없다', () => {
    expect(listNodeAncestorPaths('[0]A')).toEqual([]);
    expect(listNodeAncestorPaths('')).toEqual([]);
  });

  it('이름 없는 세그먼트도 경로 그대로 유지한다', () => {
    expect(listNodeAncestorPaths('[0]Base/[0]Link_01/[0]')).toEqual([
      '[0]Base',
      '[0]Base/[0]Link_01',
    ]);
  });

  it('조상을 펼침 집합으로 넘기면 대상 행이 보인다', () => {
    const tree = buildModelNodeTree(fixture().root);
    const target = '[0]Base/[0]Link_01/[0]';
    const expanded = new Set(listNodeAncestorPaths(target));
    expect(flattenModelNodeTree(tree, expanded).map((i) => i.path)).toContain(
      target,
    );
    // 대상 자신은 펼치지 않는다.
    expect(expanded.has(target)).toBe(false);
  });
});

describe('getSingleSelectedNodeId', () => {
  it('노드 id 하나만 선택됐을 때 그 id 를 돌려준다', () => {
    expect(getSingleSelectedNodeId(new Set(['m1::[0]A/[1]B']))).toBe(
      'm1::[0]A/[1]B',
    );
  });

  it('빈 선택·모델 선택·복수 선택은 null', () => {
    expect(getSingleSelectedNodeId(new Set())).toBeNull();
    expect(getSingleSelectedNodeId(new Set(['m1']))).toBeNull();
    expect(
      getSingleSelectedNodeId(new Set(['m1::[0]A', 'm2::[0]A'])),
    ).toBeNull();
  });
});

describe('getSingleSelectedObjectId', () => {
  it('최상위 객체 하나만 선택됐을 때 그 id 를 돌려준다', () => {
    expect(getSingleSelectedObjectId(new Set(['m1']))).toBe('m1');
  });

  it('빈 선택·노드 선택·복수 선택은 null', () => {
    expect(getSingleSelectedObjectId(new Set())).toBeNull();
    expect(getSingleSelectedObjectId(new Set(['m1::[0]A']))).toBeNull();
    expect(getSingleSelectedObjectId(new Set(['m1', 'm2']))).toBeNull();
  });
});
