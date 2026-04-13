import { Boxes, Camera, Radar, Trash2, Type } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type {
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
}

export function PalettePlacedObjects({
  placedModels,
  placedTexts = [],
  placedSensors = [],
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
}: PalettePlacedObjectsProps) {
  const { t } = useTranslation();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const allItems = useMemo(() => {
    return getPlacedObjectItems({
      placedModels,
      placedTexts,
      placedSensors,
      objectSearch,
      textObjectLabel: t('monitoring:editor.textObject'),
    });
  }, [objectSearch, placedModels, placedSensors, placedTexts, t]);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col px-0.5 pb-0.5">
          {allItems.length > 0 ? (
            allItems.map((item, index) => {
              const isSelected = selectedIds.has(item.id);

              const handleSelect = (ctrlKey: boolean) => {
                if (ctrlKey) {
                  if (item.type === 'text') {
                    onTogglePlacedText?.(item.id);
                  } else if (item.type === 'sensor') {
                    onSelectPlacedSensor?.(item.id);
                  } else {
                    onTogglePlacedModel?.(item.id);
                  }
                } else {
                  if (item.type === 'text') {
                    onSelectPlacedText?.(item.id);
                  } else if (item.type === 'sensor') {
                    onSelectPlacedSensor?.(item.id);
                  } else {
                    onSelectPlacedModel(item.id);
                  }
                }
              };

              const selectItem = (targetItem: typeof item) => {
                if (targetItem.type === 'text') {
                  onSelectPlacedText?.(targetItem.id);
                } else if (targetItem.type === 'sensor') {
                  onSelectPlacedSensor?.(targetItem.id);
                } else {
                  onSelectPlacedModel(targetItem.id);
                }
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
                    'mx-0.5 flex cursor-pointer items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-1 text-left transition',
                    isSelected
                      ? 'border-primary/50 bg-primary/15 text-foreground'
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
                    {item.type === 'text' ? (
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
