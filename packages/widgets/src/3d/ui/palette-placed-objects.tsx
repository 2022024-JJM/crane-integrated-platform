import { Box, Lock, LockOpen, Map, Trash2, Type } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SavedMapInfo,
  SavedModelInfo,
  SavedTextInfo,
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
}: PalettePlacedObjectsProps) {
  const { t } = useTranslation();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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
                    const prev = (index - 1 + allItems.length) % allItems.length;
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

              const rowChildren = (
                <>
                  {isMap ? (
                    <Map className={iconClassName} />
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

              if (!canRename) {
                return (
                  <div key={item.id} {...rowProps}>
                    {rowChildren}
                  </div>
                );
              }

              return (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger render={<div {...rowProps} />}>
                    {rowChildren}
                  </ContextMenuTrigger>
                  <ContextMenuPopup>
                    <ContextMenuItem onClick={() => startEdit(item)}>
                      {t('monitoring:editor.renameObject')}
                    </ContextMenuItem>
                  </ContextMenuPopup>
                </ContextMenu>
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
