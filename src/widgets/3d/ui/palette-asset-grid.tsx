import { Boxes, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type SceneModelCatalogItem } from '@/entities/3d';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/atoms/badge';
import { Input } from '@/shared/ui/atoms/input';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { SceneModelPreview } from './scene-model-preview';

const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';
const PALETTE_VISIBLE_ROWS_HEIGHT_CLASS = 'h-[15.5rem]';

interface PaletteAssetGridProps {
  items: SceneModelCatalogItem[];
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
}

export function PaletteAssetGrid({
  items,
  draggingItemId,
  onDragStart,
  onDragEnd,
}: PaletteAssetGridProps) {
  const { t } = useTranslation();
  const [assetSearch, setAssetSearch] = useState('');

  const normalizedAssetSearch = assetSearch.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedAssetSearch) {
      return items;
    }

    return items.filter((item) => {
      const modelType = humanizeModelPath(item.path);

      return (
        item.label.toLowerCase().includes(normalizedAssetSearch) ||
        modelType.toLowerCase().includes(normalizedAssetSearch)
      );
    });
  }, [items, normalizedAssetSearch]);

  return (
    <section className="flex shrink-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Boxes className="size-3 text-muted-foreground" />
          <p className="text-[10px] font-semibold tracking-[0.12em] text-foreground/75 uppercase">
            {t('monitoring:palette.title')}
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-sm border-border bg-muted px-1.5 py-0 text-[9px] text-muted-foreground"
        >
          {items.length}
        </Badge>
      </div>
      <div className="border-b border-border px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={assetSearch}
            onChange={(event) => {
              setAssetSearch(event.target.value);
            }}
            placeholder="Search models"
            className="h-6 rounded-sm border-border bg-muted pl-7 text-[11px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <ScrollArea className={cn('min-h-0', PALETTE_VISIBLE_ROWS_HEIGHT_CLASS)}>
        <div className="grid grid-cols-2 gap-2 p-2">
          {filteredItems.map((item) => {
            const isDragging = draggingItemId === item.id;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={item.label}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData(SCENE_MODEL_DRAG_TYPE, item.id);
                  event.dataTransfer.setData('text/plain', item.id);
                  onDragStart(item);
                }}
                onDragEnd={onDragEnd}
                className={cn(
                  'group cursor-pointer rounded-lg border border-border bg-muted/50 p-1.5 text-left transition',
                  isDragging
                    ? 'scale-[0.98] border-primary/40 bg-primary/12'
                    : 'hover:border-border/80 hover:bg-muted',
                )}
              >
                <SceneModelPreview
                  path={item.path}
                  label={item.label}
                  preview={item.preview}
                  overlayLabel={item.label}
                  overlayHint={t('monitoring:palette.dragToPlace')}
                  showOverlay={isDragging}
                  className={cn(
                    'h-20 rounded-[0.8rem]',
                    isDragging && 'border-primary/40',
                  )}
                />
                <div className="mt-1.5 min-w-0 px-0.5">
                  <p className="truncate text-[11px] font-semibold leading-none text-foreground">
                    {item.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}
