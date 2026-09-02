import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, Object3D } from 'three';
import {
  buildModelNodeTree,
  flattenModelNodeTree,
  listModelNodeOptions,
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
