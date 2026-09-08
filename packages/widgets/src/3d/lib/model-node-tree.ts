import { Mesh, type Object3D } from 'three';
import { getMeshPath, isMeshId } from '@crane/domain/3d';

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

/**
 * 노드 경로의 조상 경로들 — 자기 자신은 빼고 얕은 것부터.
 * `[0]A/[1]B/[2]C` → `['[0]A', '[0]A/[1]B']`. 최상위·빈 경로는 `[]`.
 * 구분자는 mesh-path.ts 와 같은 `/` 단순 split 이다.
 */
export function listNodeAncestorPaths(path: string): string[] {
  if (path === '') return [];
  const segments = path.split('/');
  const out: string[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    out.push(segments.slice(0, i).join('/'));
  }
  return out;
}

/**
 * 선택 집합이 "모델 내부 노드 하나" 일 때만 그 id 를 돌려준다. 노드 선택은
 * 항상 단일 선택이라 size 가 1 이 아니면 노드 선택이 아니다.
 */
export function getSingleSelectedNodeId(
  selectedIds: ReadonlySet<string>,
): string | null {
  if (selectedIds.size !== 1) return null;
  const [only] = selectedIds;
  return isMeshId(only) ? only : null;
}

/** 선택 집합이 "최상위 객체(모델·텍스트·지도) 하나" 일 때만 그 id 를 돌려준다. */
export function getSingleSelectedObjectId(
  selectedIds: ReadonlySet<string>,
): string | null {
  if (selectedIds.size !== 1) return null;
  const [only] = selectedIds;
  return isMeshId(only) ? null : only;
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
