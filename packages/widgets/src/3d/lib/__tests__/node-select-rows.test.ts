import { describe, expect, it } from 'vitest';
import type { ModelNodeTreeItem } from '../model-node-tree';
import { buildNodeSelectRows } from '../node-select-rows';

function node(
  path: string,
  name: string,
  depth: number,
  kind: 'mesh' | 'group',
  children: ModelNodeTreeItem[] = [],
): ModelNodeTreeItem {
  return { path, name, depth, kind, children };
}

// Goliath ─ Girder ─ Girder_Mesh ▪ / Trolley ─ Hoist ─ Rope ▪
const tree: ModelNodeTreeItem[] = [
  node('[0]Goliath', 'Goliath', 0, 'group', [
    node('[0]Goliath/[0]Girder', 'Girder', 1, 'group', [
      node('[0]Goliath/[0]Girder/[0]Girder_Mesh', 'Girder_Mesh', 2, 'mesh'),
    ]),
    node('[0]Goliath/[1]Trolley', 'Trolley', 1, 'group', [
      node('[0]Goliath/[1]Trolley/[0]Hoist', 'Hoist', 2, 'group', [
        node('[0]Goliath/[1]Trolley/[0]Hoist/[0]Rope', 'Rope', 3, 'mesh'),
      ]),
    ]),
  ]),
  node('[1]Cabin', 'Cabin', 0, 'mesh'),
];

const NONE: ReadonlySet<string> = new Set();

describe('buildNodeSelectRows', () => {
  it('빈 트리 — 루트 라벨이 없으면 빈 목록, 있으면 루트 행 하나', () => {
    expect(buildNodeSelectRows([], { query: '', expanded: NONE })).toEqual([]);
    const rows = buildNodeSelectRows([], {
      rootLabel: '(모델 루트)',
      query: '',
      expanded: NONE,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      value: '',
      path: '',
      depth: 0,
      kind: 'root',
      hasChildren: false,
    });
  });

  it('접힌 상태 — 최상위만 보이고 자식 있는 행은 hasChildren', () => {
    const rows = buildNodeSelectRows(tree, { query: '', expanded: NONE });
    expect(rows.map((r) => r.value)).toEqual(['[0]Goliath', '[1]Cabin']);
    expect(rows[0]).toMatchObject({
      hasChildren: true,
      expanded: false,
      kind: 'group',
      depth: 0,
    });
    expect(rows[1]).toMatchObject({ hasChildren: false, kind: 'mesh' });
  });

  it('펼친 노드의 자식만 더 보인다 — 손자는 그 부모를 펼쳐야 보인다', () => {
    const rows = buildNodeSelectRows(tree, {
      query: '',
      expanded: new Set(['[0]Goliath']),
    });
    expect(rows.map((r) => r.label)).toEqual([
      'Goliath',
      'Girder',
      'Trolley',
      'Cabin',
    ]);
    expect(rows[0].expanded).toBe(true);
    expect(rows[1]).toMatchObject({ expanded: false, hasChildren: true });

    const deeper = buildNodeSelectRows(tree, {
      query: '',
      expanded: new Set(['[0]Goliath', '[0]Goliath/[1]Trolley']),
    });
    expect(deeper.map((r) => r.label)).toEqual([
      'Goliath',
      'Girder',
      'Trolley',
      'Hoist',
      'Cabin',
    ]);
  });

  it('루트 라벨이 있으면 루트가 깊이 0, 노드는 깊이 +1', () => {
    const rows = buildNodeSelectRows(tree, {
      rootLabel: '(모델 루트)',
      query: '',
      expanded: new Set(['[0]Goliath']),
    });
    expect(rows.map((r) => [r.label, r.depth])).toEqual([
      ['(모델 루트)', 0],
      ['Goliath', 1],
      ['Girder', 2],
      ['Trolley', 2],
      ['Cabin', 1],
    ]);
  });

  it('자식 없는 노드가 펼침 집합에 있어도 expanded 는 false', () => {
    const rows = buildNodeSelectRows(tree, {
      query: '',
      expanded: new Set(['[1]Cabin']),
    });
    expect(rows[1]).toMatchObject({ label: 'Cabin', expanded: false });
  });

  it('검색어가 있으면 접힘과 무관하게 전체가 평면으로, 화살표 없이', () => {
    const rows = buildNodeSelectRows(tree, {
      rootLabel: '(모델 루트)',
      query: 'ro',
      expanded: NONE,
    });
    expect(rows.map((r) => r.label)).toEqual([
      '(모델 루트)',
      'Goliath',
      'Girder',
      'Girder_Mesh',
      'Trolley',
      'Hoist',
      'Rope',
      'Cabin',
    ]);
    expect(rows.every((r) => !r.hasChildren && !r.expanded)).toBe(true);
    expect(rows.find((r) => r.label === 'Rope')?.depth).toBe(4);
  });

  it('공백뿐인 검색어는 검색이 아니다', () => {
    const rows = buildNodeSelectRows(tree, { query: '   ', expanded: NONE });
    expect(rows.map((r) => r.label)).toEqual(['Goliath', 'Cabin']);
  });
});
