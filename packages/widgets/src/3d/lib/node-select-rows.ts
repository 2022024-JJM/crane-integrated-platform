import type { ComboboxOption } from '@crane/ui/molecules/combobox';
import {
  flattenModelNodeTree,
  type ModelNodeTreeItem,
} from './model-node-tree';

/**
 * 인스펙터 노드 선택기(NodeSelect)의 행 — 계층 목록과 같은 트리 모양으로
 * 그리기 위한 깊이·펼침 정보를 콤보박스 옵션에 얹은 것.
 */
export interface NodeSelectRow extends ComboboxOption {
  /** 노드 경로 — 루트 행은 ''. */
  path: string;
  depth: number;
  kind: 'root' | 'mesh' | 'group';
  hasChildren: boolean;
  expanded: boolean;
}

export interface NodeSelectRowOptions {
  /** 주면 '' 루트 행을 맨 위 깊이 0 에 두고 노드는 깊이 1 부터 들여쓴다. */
  rootLabel?: string;
  /** 검색어. 비어 있지 않으면 접힘과 무관하게 전체 노드를 평면으로 낸다. */
  query: string;
  /** 펼친 노드 경로. */
  expanded: ReadonlySet<string>;
}

/**
 * 보이는 행 목록. 검색어가 없으면 펼친 노드의 자식만 보이고(계층 목록과
 * 같다), 검색어가 있으면 전체 노드가 들여쓰기만 유지한 채 평면으로 나온다 —
 * 걸러내는 것은 콤보박스(이름 기준)가 한다. 검색 중엔 화살표가 없다.
 */
export function buildNodeSelectRows(
  tree: ModelNodeTreeItem[],
  { rootLabel, query, expanded }: NodeSelectRowOptions,
): NodeSelectRow[] {
  const rows: NodeSelectRow[] = [];
  const offset = rootLabel === undefined ? 0 : 1;
  if (rootLabel !== undefined) {
    rows.push({
      value: '',
      label: rootLabel,
      path: '',
      depth: 0,
      kind: 'root',
      hasChildren: false,
      expanded: false,
    });
  }

  if (query.trim() !== '') {
    const walk = (list: ModelNodeTreeItem[]) => {
      for (const item of list) {
        rows.push({
          value: item.path,
          label: item.name,
          path: item.path,
          depth: item.depth + offset,
          kind: item.kind,
          hasChildren: false,
          expanded: false,
        });
        walk(item.children);
      }
    };
    walk(tree);
    return rows;
  }

  for (const item of flattenModelNodeTree(tree, expanded)) {
    const hasChildren = item.children.length > 0;
    rows.push({
      value: item.path,
      label: item.name,
      path: item.path,
      depth: item.depth + offset,
      kind: item.kind,
      hasChildren,
      expanded: hasChildren && expanded.has(item.path),
    });
  }
  return rows;
}
