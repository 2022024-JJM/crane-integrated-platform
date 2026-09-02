import { Mesh, type Object3D } from 'three';
import { getMeshPath } from '@crane/domain/3d';

/**
 * 모델 clone root 아래 GLB 노드 트리 — 계층 목록·리깅 노드 선택기가 쓴다.
 * path 는 mesh-path.ts 형식(`[index]name/...`)이라 관절 정의에 그대로 들어간다.
 */
export interface ModelNodeTreeItem {
  path: string;
  name: string;
  kind: 'mesh' | 'group';
  depth: number;
  children: ModelNodeTreeItem[];
}

export function buildModelNodeTree(root: Object3D): ModelNodeTreeItem[] {
  const build = (node: Object3D, depth: number): ModelNodeTreeItem | null => {
    const path = getMeshPath(root, node);
    if (path === null || path === '') return null;
    const children: ModelNodeTreeItem[] = [];
    for (const child of node.children) {
      const item = build(child, depth + 1);
      if (item) children.push(item);
    }
    return {
      path,
      name: node.name || '(unnamed)',
      kind: node instanceof Mesh ? 'mesh' : 'group',
      depth,
      children,
    };
  };
  const out: ModelNodeTreeItem[] = [];
  for (const child of root.children) {
    const item = build(child, 0);
    if (item) out.push(item);
  }
  return out;
}

/** 펼침 상태에 따라 보이는 행만 DFS 순서로 편다. */
export function flattenModelNodeTree(
  items: ModelNodeTreeItem[],
  expanded: ReadonlySet<string>,
): ModelNodeTreeItem[] {
  const out: ModelNodeTreeItem[] = [];
  const walk = (list: ModelNodeTreeItem[]) => {
    for (const item of list) {
      out.push(item);
      if (item.children.length > 0 && expanded.has(item.path)) {
        walk(item.children);
      }
    }
  };
  walk(items);
  return out;
}

export interface ModelNodeOption {
  path: string;
  /** 깊이만큼 들여쓴 표시 이름 */
  label: string;
  kind: 'mesh' | 'group';
}

/** select 박스용 평면 목록 — 전체 트리, 들여쓰기 라벨. */
export function listModelNodeOptions(
  items: ModelNodeTreeItem[],
): ModelNodeOption[] {
  const out: ModelNodeOption[] = [];
  const walk = (list: ModelNodeTreeItem[]) => {
    for (const item of list) {
      out.push({
        path: item.path,
        label: `${'  '.repeat(item.depth)}${item.name}`,
        kind: item.kind,
      });
      walk(item.children);
    }
  };
  walk(items);
  return out;
}
