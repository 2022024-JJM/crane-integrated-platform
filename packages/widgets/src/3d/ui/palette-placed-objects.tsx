import {
  Boxes,
  Camera,
  Lock,
  LockOpen,
  Map,
  Radar,
  Trash2,
  Type,
} from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SavedMapInfo,
  SavedModelInfo,
  SavedSensorInfo,
  SavedTextInfo,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { getPlacedObjectItems } from './placed-object-items';

interface PalettePlacedObjectsProps {
  placedModels: SavedModelInfo[];
  placedTexts?: SavedTextInfo[];
  placedSensors?: SavedSensorInfo[];
  placedMaps?: SavedMapInfo[];
  objectSearch: string;
  selectedIds: Set<string>;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSelectPlacedText?: (id: string) => void;
  onDeletePlacedText?: (id: string) => void;
  onTogglePlacedModel?: (id: string) => void;
  onTogglePlacedText?: (id: string) => void;
  onSelectPlacedSensor?: (id: string) => void;
  onDeletePlacedSensor?: (id: string) => void;
  onSelectPlacedMap?: (id: string) => void;
  onToggleMapLock?: (id: string, locked: boolean) => void;
}

export function PalettePlacedObjects({
  placedModels,
  placedTexts = [],
  placedSensors = [],
  placedMaps = [],
  objectSearch = '',
  selectedIds,
  onSelectPlacedModel,
  onDeletePlacedModel,
  onSelectPlacedText,
  onDeletePlacedText,
  onTogglePlacedModel,
  onTogglePlacedText,
  onSelectPlacedSensor,
  onDeletePlacedSensor,
  onSelectPlacedMap,
  onToggleMapLock,
}: PalettePlacedObjectsProps) {
  const { t } = useTranslation();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const allItems = useMemo(() => {
    return getPlacedObjectItems({
      placedModels,
      placedTexts,
      placedSensors,
      placedMaps,
      objectSearch,
      textObjectLabel: t('monitoring:editor.textObject'),
      mapObjectLabel: t('monitoring:editor.map'),
    });
  }, [objectSearch, placedMaps, placedModels, placedSensors, placedTexts, t]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col px-0.5 pb-0.5">
          {allItems.length > 0 ? (
            allItems.map((item, index) => {
              const isSelected = selectedIds.has(item.id);

              // 잠긴 지도는 목록에서도 선택되지 않는다 — 캔버스와 같은
              // 규칙이라야 자물쇠가 "편집 대상에서 제외"라는 하나의 의미로
              // 읽힌다. 잠금 해제는 옆 자물쇠 버튼으로 한다.
              const isLockedMap = item.type === 'map' && item.locked;

              const selectItem = (targetItem: typeof item) => {
                if (targetItem.type === 'map') {
                  if (!targetItem.locked) onSelectPlacedMap?.(targetItem.id);
                } else if (targetItem.type === 'text') {
                  onSelectPlacedText?.(targetItem.id);
                } else if (targetItem.type === 'sensor') {
                  onSelectPlacedSensor?.(targetItem.id);
                } else {
                  onSelectPlacedModel(targetItem.id);
                }
              };

              const handleSelect = (ctrlKey: boolean) => {
                // 지도는 다중 선택에 참여하지 않는다(항상 단독 선택).
                if (item.type === 'map') {
                  selectItem(item);
                  return;
                }
                if (ctrlKey) {
                  if (item.type === 'text') {
                    onTogglePlacedText?.(item.id);
                  } else if (item.type === 'sensor') {
                    onSelectPlacedSensor?.(item.id);
                  } else {
                    onTogglePlacedModel?.(item.id);
                  }
                  return;
                }
                selectItem(item);
              };

              return (
                <div
                  key={item.id}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  role="button"
                  tabIndex={0}
                  aria-label={item.displayName}
                  onClick={(event) => {
                    handleSelect(event.ctrlKey || event.metaKey);
                  }}
                  onKeyDown={(event) => {
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
                  }}
                  className={cn(
                    'mx-0.5 flex items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-1 text-left transition',
                    isLockedMap ? 'cursor-default' : 'cursor-pointer',
                    isSelected
                      ? 'border-primary/50 bg-primary/15 text-foreground'
                      : isLockedMap
                        ? 'text-foreground/50'
                        : 'text-foreground/80 hover:border-border hover:bg-muted/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px]',
                      isSelected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {item.type === 'map' ? (
                      <Map className="size-2.5" />
                    ) : item.type === 'text' ? (
                      <Type className="size-2.5" />
                    ) : item.type === 'sensor' ? (
                      item.subtitle === 'LiDAR' ? (
                        <Radar className="size-2.5" />
                      ) : (
                        <Camera className="size-2.5" />
                      )
                    ) : (
                      <Boxes className="size-2.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] leading-none font-medium">
                      {item.displayName}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-[9px] leading-none">
                      {item.subtitle}
                    </p>
                  </div>
                  {/* 지도는 삭제 대신 잠금 토글을 둔다 — 지도 삭제는 씬을
                      통째로 비우는 행위라 목록의 한 줄짜리 휴지통 버튼으로
                      실수하기 쉽다. 삭제는 하단 Project 패널 Map 섹션에 남겨
                      두고, 여기서는 일상 작업인 잠금/해제만 노출한다. */}
                  {item.type === 'map' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={item.locked}
                      className={cn(
                        'size-5 cursor-pointer rounded-sm',
                        item.locked
                          ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          : 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-400',
                      )}
                      aria-label={
                        item.locked
                          ? t('monitoring:editor.unlockMap')
                          : t('monitoring:editor.lockMap')
                      }
                      title={
                        item.locked
                          ? t('monitoring:editor.unlockMap')
                          : t('monitoring:editor.lockMap')
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleMapLock?.(item.id, !item.locked);
                      }}
                    >
                      {item.locked ? (
                        <Lock className="size-3.5" />
                      ) : (
                        <LockOpen className="size-3.5" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-muted size-5 cursor-pointer rounded-sm hover:text-red-300"
                      aria-label={t('monitoring:editor.deleteObject')}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (item.type === 'text') {
                          onDeletePlacedText?.(item.id);
                        } else if (item.type === 'sensor') {
                          onDeletePlacedSensor?.(item.id);
                        } else {
                          onDeletePlacedModel(item.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
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
