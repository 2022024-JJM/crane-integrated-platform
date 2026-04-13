import { Search } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  humanizeModelPath,
  type SceneModelCatalogItem,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Input } from '@crane/ui/atoms/input';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { SceneModelPreview } from './scene-model-preview';

const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';

interface PaletteAssetGridProps {
  items: SceneModelCatalogItem[];
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
}

export const PaletteAssetGrid = memo(function PaletteAssetGrid({
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2" />
          <Input
            value={assetSearch}
            onChange={(event) => {
              setAssetSearch(event.target.value);
            }}
            placeholder={t('monitoring:editor.searchModels')}
            className="border-border bg-muted text-foreground placeholder:text-muted-foreground h-6 rounded-sm pl-7 text-[11px]"
          />
        </div>
        <Badge
          variant="outline"
          className="border-border bg-muted text-muted-foreground inline-flex h-6 items-center rounded-sm px-1.5 py-0 text-[9px]"
        >
          {filteredItems.length}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5 px-0.5 pb-0.5">
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
                  'group border-border bg-muted/50 cursor-pointer rounded-md border p-1 text-left transition',
                  isDragging
                    ? 'border-primary/40 bg-primary/12 scale-[0.98]'
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
                    'h-12 rounded-md',
                    isDragging && 'border-primary/40',
                  )}
                />
                <div className="mt-1 min-w-0 px-0.5">
                  <p className="text-foreground truncate text-[10px] leading-none font-medium">
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
});
