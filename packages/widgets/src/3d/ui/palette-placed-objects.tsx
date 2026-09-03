import {
  Bone,
  Box,
  ChevronRight,
  Lock,
  LockOpen,
  Map as MapIcon,
  Shapes,
  Trash2,
  Type,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  makeMeshId,
  modelObjectRegistry,
  parseMeshId,
  type SavedMapInfo,
  type SavedModelInfo,
  type SavedTextInfo,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from '@crane/ui/molecules/context-menu';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { TreeRow } from '@crane/ui/molecules/tree';
import {
  buildModelNodeTree,
  flattenModelNodeTree,
  getSingleSelectedNodeId,
  getSingleSelectedObjectId,
  listNodeAncestorPaths,
  type ModelNodeTreeItem,
} from '../lib/model-node-tree';
import {
  getPlacedObjectItems,
  type PlacedObjectItem,
} from './placed-object-items';

interface PalettePlacedObjectsProps {
  placedModels: SavedModelInfo[];
  placedTexts?: SavedTextInfo[];
  placedMaps?: SavedMapInfo[];
  objectSearch: string;
  selectedIds: Set<string>;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSelectPlacedText?: (id: string) => void;
  onDeletePlacedText?: (id: string) => void;
  onTogglePlacedModel?: (id: string) => void;
  onTogglePlacedText?: (id: string) => void;
  onTogglePlacedMap?: (id: string) => void;
  onSelectPlacedMap?: (id: string) => void;
  onDeletePlacedMap?: (id: string) => void;
  onToggleLock?: (id: string, locked: boolean) => void;
  onRenameObject?: (id: string, name: string) => void;
  /**
   * 모델 행을 펼치면 GLB 노드 트리(Group/Mesh)가 나오고, 노드 행을 클릭하면
   * 캔버스 더블클릭 drill-in 과 같은 서브노드 선택이 된다. 없으면 펼침 토글
   * 자체를 그리지 않는다.
   */
  onSelectNode?: (modelId: string, nodePath: string) => void;
  /** 모델별 관절·구속조건이 가리키는 노드 경로 — 행에 뼈 배지를 단다. */
  jointNodePathsByModel?: Map<string, Set<string>>;
}

export function PalettePlacedObjects({
  placedModels,
  placedTexts = [],
  placedMaps = [],
  objectSearch = '',
  selectedIds,
  onSelectPlacedModel,
  onDeletePlacedModel,
  onSelectPlacedText,
  onDeletePlacedText,
  onTogglePlacedModel,
  onTogglePlacedText,
  onTogglePlacedMap,
  onSelectPlacedMap,
  onDeletePlacedMap,
  onToggleLock,
  onRenameObject,
  onSelectNode,
  jointNodePathsByModel,
}: PalettePlacedObjectsProps) {
  const { t } = useTranslation();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 객체 하나가 선택되면(캔버스 클릭 포함) 그 행까지 스크롤한다. index 배열은
  // 방향키 이동용이라 id 로 찾는 map 을 따로 둔다 — 의존성이 id 문자열이라
  // 기즈모 드래그로 placedModels 가 매 프레임 바뀌어도 스크롤이 튀지 않는다.
  const itemRefsById = useRef<Map<string, HTMLDivElement>>(new Map());
  const selectedObjectId = getSingleSelectedObjectId(selectedIds);
  useEffect(() => {
    const row = selectedObjectId
      ? itemRefsById.current.get(selectedObjectId)
      : undefined;
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedObjectId]);

  // 펼침 상태는 세션 상태다. 노드 트리는 펼치는 순간 registry 의 clone root
  // 에서 만든다 — 모델이 아직 마운트 전이면 빈 트리(다시 펼치면 재시도).
  const [expandedModels, setExpandedModels] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(),
  );
  const [nodeTrees, setNodeTrees] = useState<Map<string, ModelNodeTreeItem[]>>(
    () => new Map(),
  );

  const toggleModelExpanded = (modelId: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
        const root = modelObjectRegistry.get(modelId);
        setNodeTrees((trees) => {
          const nextTrees = new Map(trees);
          nextTrees.set(modelId, root ? buildModelNodeTree(root) : []);
          return nextTrees;
        });
      }
      return next;
    });
  };

  const toggleNodeExpanded = (key: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 캔버스 더블클릭 drill-in 으로 노드가 선택되면 모델 행과 조상 노드를 펼쳐
  // 목록에서 보이게 한다. 선택이 바뀔 때 한 번만 적용하므로 이후 사용자가
  // 접는 건 그대로 둔다. effect 안 setState(react-hooks/set-state-in-effect)
  // 대신 렌더 중 이전 값과 비교해 조정하는 패턴을 쓴다.
  const selectedNodeId = getSingleSelectedNodeId(selectedIds);
  const [revealedNodeId, setRevealedNodeId] = useState<string | null>(null);
  if (selectedNodeId !== revealedNodeId) {
    setRevealedNodeId(selectedNodeId);
    const parsed = selectedNodeId ? parseMeshId(selectedNodeId) : null;
    if (parsed) {
      const { modelId, meshPath } = parsed;
      setExpandedModels((prev) =>
        prev.has(modelId) ? prev : new Set(prev).add(modelId),
      );
      setNodeTrees((prev) => {
        if ((prev.get(modelId)?.length ?? 0) > 0) return prev;
        const root = modelObjectRegistry.get(modelId);
        if (!root) return prev;
        return new Map(prev).set(modelId, buildModelNodeTree(root));
      });
      const keys = listNodeAncestorPaths(meshPath).map(
        (path) => `${modelId}::${path}`,
      );
      setExpandedNodes((prev) =>
        keys.every((key) => prev.has(key)) ? prev : new Set([...prev, ...keys]),
      );
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // Enter 커밋 직후 unmount로 blur가 한 번 더 들어와도 rename이
  // 중복 커밋되지 않게 막는다. Escape 취소도 같은 가드를 쓴다.
  const editDoneRef = useRef(false);

  const allItems = useMemo(() => {
    return getPlacedObjectItems({
      placedModels,
      placedTexts,
      placedMaps,
      objectSearch,
    });
  }, [objectSearch, placedMaps, placedModels, placedTexts]);

  // 편집 중이던 객체가 삭제·필터링으로 목록에서 사라지면 편집을 접는다.
  useEffect(() => {
    if (editingId && !allItems.some((item) => item.id === editingId)) {
      setEditingId(null);
    }
  }, [allItems, editingId]);

  const startEdit = (item: PlacedObjectItem) => {
    editDoneRef.current = false;
    setDraft(item.displayName);
    setEditingId(item.id);
  };

  const commitEdit = (item: PlacedObjectItem) => {
    if (editDoneRef.current) {
      return;
    }
    editDoneRef.current = true;
    const next = draft.trim();
    if (next && next !== item.displayName) {
      onRenameObject?.(item.id, next);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    editDoneRef.current = true;
    setEditingId(null);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col px-0.5 pb-0.5">
          {allItems.length > 0 ? (
            allItems.map((item, index) => {
              const isSelected = selectedIds.has(item.id);

              // 잠긴 객체는 목록에서도 선택되지 않는다 — 캔버스와 같은
              // 규칙이라야 자물쇠가 "편집 대상에서 제외"라는 하나의 의미로
              // 읽힌다. 잠금 해제는 옆 자물쇠 버튼으로 한다.
              const isMap = item.type === 'map';
              const isLocked = item.locked === true;
              const isEditing = editingId === item.id;
              // 잠금 해제된 행은 지도까지 포함해 전부 이름 변경 가능.
              const canRename = !isLocked;

              const selectItem = (targetItem: typeof item) => {
                if (targetItem.locked === true) {
                  return;
                }
                if (targetItem.type === 'map') {
                  onSelectPlacedMap?.(targetItem.id);
                } else if (targetItem.type === 'text') {
                  onSelectPlacedText?.(targetItem.id);
                } else {
                  onSelectPlacedModel(targetItem.id);
                }
              };

              const handleSelect = (ctrlKey: boolean) => {
                if (ctrlKey) {
                  if (isLocked) {
                    return;
                  }
                  if (item.type === 'map') {
                    onTogglePlacedMap?.(item.id);
                  } else if (item.type === 'text') {
                    onTogglePlacedText?.(item.id);
                  } else {
                    onTogglePlacedModel?.(item.id);
                  }
                  return;
                }
                selectItem(item);
              };

              const rowProps = {
                ref: (el: HTMLDivElement | null) => {
                  itemRefs.current[index] = el;
                  if (el) itemRefsById.current.set(item.id, el);
                  else itemRefsById.current.delete(item.id);
                },
                role: 'button',
                tabIndex: 0,
                'aria-label': item.displayName,
                onClick: (event: React.MouseEvent) => {
                  handleSelect(event.ctrlKey || event.metaKey);
                },
                onKeyDown: (event: React.KeyboardEvent) => {
                  // 방향키는 포커스만 옮기고 선택도 함께 바꾼다. 잠긴
                  // 객체는 selectItem이 무시하므로 이전 선택이 그대로
                  // 남는데, 그 편이 "선택이 사라졌다"보다 덜 놀랍다.
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    const next = (index + 1) % allItems.length;
                    selectItem(allItems[next]);
                    itemRefs.current[next]?.focus();
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    const prev =
                      (index - 1 + allItems.length) % allItems.length;
                    selectItem(allItems[prev]);
                    itemRefs.current[prev]?.focus();
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelect(event.ctrlKey || event.metaKey);
                  }
                },
                className: cn(
                  'mx-0.5 flex items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-1 text-left transition',
                  isLocked ? 'cursor-default' : 'cursor-pointer',
                  isSelected
                    ? 'border-primary/50 bg-primary/15 text-foreground'
                    : isLocked
                      ? 'text-foreground/50'
                      : 'text-foreground/80 hover:border-border hover:bg-muted/50',
                ),
              };

              const iconClassName = cn(
                'size-3.5 shrink-0',
                isSelected
                  ? 'text-primary'
                  : isLocked
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground',
              );

              const canExpand = item.type === 'model' && Boolean(onSelectNode);
              const isExpanded = canExpand && expandedModels.has(item.id);

              const rowChildren = (
                <>
                  {canExpand ? (
                    <button
                      type="button"
                      aria-label={
                        isExpanded
                          ? t('monitoring:editor.collapseNodes')
                          : t('monitoring:editor.expandNodes')
                      }
                      aria-expanded={isExpanded}
                      className="text-muted-foreground hover:text-foreground -ml-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleModelExpanded(item.id);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <ChevronRight
                        className={cn(
                          'size-3 transition-transform',
                          isExpanded ? 'rotate-90' : 'rotate-0',
                        )}
                      />
                    </button>
                  ) : null}
                  {isMap ? (
                    <MapIcon className={iconClassName} />
                  ) : item.type === 'text' ? (
                    <Type className={iconClassName} />
                  ) : (
                    <Box className={iconClassName} />
                  )}
                  {isEditing ? (
                    <Input
                      ref={(el) => {
                        // 컨텍스트 메뉴가 닫히며 base-ui가 트리거(행)로
                        // 포커스를 되돌리므로 다음 프레임에 가져온다.
                        if (el && document.activeElement !== el) {
                          requestAnimationFrame(() => {
                            el.focus();
                            el.select();
                          });
                        }
                      }}
                      value={draft}
                      aria-label={t('monitoring:editor.renameObject')}
                      className="h-5 min-w-0 flex-1 rounded-sm px-1 text-[12px]"
                      onChange={(event) => setDraft(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        // 행의 방향키 이동·전역 단축키(Delete 등)로 새지
                        // 않게 편집 중 키 입력은 여기서 끊는다.
                        event.stopPropagation();
                        if (event.key === 'Enter') {
                          commitEdit(item);
                        } else if (event.key === 'Escape') {
                          cancelEdit();
                        }
                      }}
                      onBlur={() => commitEdit(item)}
                    />
                  ) : (
                    <p className="min-w-0 flex-1 truncate text-[12px] leading-none font-medium">
                      {item.displayName}
                    </p>
                  )}
                  {/* 모든 행에 잠금 토글과 삭제 버튼을 두되 잠기면 삭제를
                      숨긴다 — 잠금은 선택·변형·삭제를 전부 막는 규칙이다.
                      지도는 Map 탭 카탈로그 해제로도 제거할 수 있다.
                      편집 중에는 입력창 공간 확보를 위해 둘 다 숨긴다. */}
                  {!isLocked && !isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-muted size-5 cursor-pointer rounded-sm hover:text-red-300"
                      aria-label={t('monitoring:editor.deleteObject')}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (item.type === 'map') {
                          onDeletePlacedMap?.(item.id);
                        } else if (item.type === 'text') {
                          onDeletePlacedText?.(item.id);
                        } else {
                          onDeletePlacedModel(item.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                  {!isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={isLocked}
                      className={cn(
                        'size-5 cursor-pointer rounded-sm',
                        isLocked
                          ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          : 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-400',
                      )}
                      aria-label={
                        isLocked
                          ? t('monitoring:editor.unlockObject')
                          : t('monitoring:editor.lockObject')
                      }
                      title={
                        isLocked
                          ? t('monitoring:editor.unlockObject')
                          : t('monitoring:editor.lockObject')
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleLock?.(item.id, !isLocked);
                      }}
                    >
                      {isLocked ? (
                        <Lock className="size-3.5" />
                      ) : (
                        <LockOpen className="size-3.5" />
                      )}
                    </Button>
                  ) : null}
                </>
              );

              const nodeRows =
                isExpanded && onSelectNode ? (
                  <ModelNodeRows
                    modelId={item.id}
                    tree={nodeTrees.get(item.id) ?? []}
                    expandedNodes={expandedNodes}
                    selectedIds={selectedIds}
                    jointNodePaths={jointNodePathsByModel?.get(item.id)}
                    onToggleNode={toggleNodeExpanded}
                    onSelectNode={onSelectNode}
                    t={t}
                  />
                ) : null;

              if (!canRename) {
                return (
                  <Fragment key={item.id}>
                    <div {...rowProps}>{rowChildren}</div>
                    {nodeRows}
                  </Fragment>
                );
              }

              return (
                <Fragment key={item.id}>
                  <ContextMenu>
                    <ContextMenuTrigger render={<div {...rowProps} />}>
                      {rowChildren}
                    </ContextMenuTrigger>
                    <ContextMenuPopup>
                      <ContextMenuItem onClick={() => startEdit(item)}>
                        {t('monitoring:editor.renameObject')}
                      </ContextMenuItem>
                    </ContextMenuPopup>
                  </ContextMenu>
                  {nodeRows}
                </Fragment>
              );
            })
          ) : (
            <div className="text-muted-foreground px-3 py-4 text-center text-[11px]">
              {t('monitoring:editor.noPlacedObjects')}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}

/**
 * 펼친 모델 아래의 GLB 노드 행들. 모델 행(깊이 0) 아래 깊이 1부터 들여쓴다.
 * 선택 id 는 캔버스 drill-in 과 같은 `${modelId}::${path}` 형식이라 두 경로의
 * 선택 하이라이트가 일치한다.
 */
function ModelNodeRows({
  modelId,
  tree,
  expandedNodes,
  selectedIds,
  jointNodePaths,
  onToggleNode,
  onSelectNode,
  t,
}: {
  modelId: string;
  tree: ModelNodeTreeItem[];
  expandedNodes: Set<string>;
  selectedIds: Set<string>;
  jointNodePaths: Set<string> | undefined;
  onToggleNode: (key: string) => void;
  onSelectNode: (modelId: string, nodePath: string) => void;
  t: (key: string) => string;
}) {
  // 펼침 키는 모델별로 구분한다 — 다른 모델의 같은 경로가 함께 펼쳐지면 안 된다.
  const expandedPaths = useMemo(() => {
    const prefix = `${modelId}::`;
    const out = new Set<string>();
    for (const key of expandedNodes) {
      if (key.startsWith(prefix)) out.add(key.slice(prefix.length));
    }
    return out;
  }, [expandedNodes, modelId]);

  const rows = useMemo(
    () => flattenModelNodeTree(tree, expandedPaths),
    [tree, expandedPaths],
  );

  // 캔버스 drill-in 으로 고른 노드가 목록 밖에 있으면 행까지 스크롤한다.
  // 의존성은 Set 참조가 아니라 id 문자열이라 다른 선택 변화엔 튀지 않는다.
  const selectedNodeId = getSingleSelectedNodeId(selectedIds);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const row = selectedRowRef.current;
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedNodeId]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-1 pl-8 text-[10px]">
        {t('monitoring:inspector.rigging.nodesUnavailable')}
      </p>
    );
  }

  return (
    <>
      {rows.map((node) => {
        const nodeId = makeMeshId(modelId, node.path);
        const isSelected = selectedIds.has(nodeId);
        const isJoint = jointNodePaths?.has(node.path) === true;
        const key = `${modelId}::${node.path}`;
        return (
          <TreeRow
            key={nodeId}
            ref={isSelected ? selectedRowRef : undefined}
            depth={node.depth + 1}
            hasChildren={node.children.length > 0}
            expanded={expandedPaths.has(node.path)}
            onToggle={() => onToggleNode(key)}
            selected={isSelected}
            toggleLabel={
              expandedPaths.has(node.path)
                ? t('monitoring:editor.collapseNodes')
                : t('monitoring:editor.expandNodes')
            }
            role="button"
            tabIndex={0}
            aria-label={node.name}
            title={node.path}
            className={cn(
              'mx-0.5 cursor-pointer',
              isSelected
                ? 'border-primary/50 bg-primary/15 text-foreground'
                : 'text-foreground/70 hover:border-border hover:bg-muted/50',
            )}
            onClick={() => onSelectNode(modelId, node.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectNode(modelId, node.path);
              }
            }}
          >
            {node.kind === 'mesh' ? (
              <Shapes
                className={cn(
                  'size-3 shrink-0',
                  isSelected ? 'text-primary' : 'text-muted-foreground/70',
                )}
              />
            ) : (
              <Box
                className={cn(
                  'size-3 shrink-0',
                  isSelected ? 'text-primary' : 'text-muted-foreground/70',
                )}
              />
            )}
            <p className="min-w-0 flex-1 truncate text-[11px] leading-none">
              {node.name}
            </p>
            {isJoint ? (
              <Bone
                className="size-3 shrink-0 text-amber-500"
                aria-label={t('monitoring:editor.jointNode')}
              />
            ) : null}
          </TreeRow>
        );
      })}
    </>
  );
}
