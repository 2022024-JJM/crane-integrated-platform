import { Boxes, Layers3, Search, Trash2, Type } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type SavedModelInfo, type SavedTextInfo } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';

interface PlacedObjectItem {
  id: string;
  displayName: string;
  subtitle: string;
  type: 'model' | 'text';
}

interface PalettePlacedObjectsProps {
  placedModels: SavedModelInfo[];
  placedTexts?: SavedTextInfo[];
  selectedModelId: string | null;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSelectPlacedText?: (id: string) => void;
  onDeletePlacedText?: (id: string) => void;
}

export function PalettePlacedObjects({
  placedModels,
  placedTexts = [],
  selectedModelId,
  onSelectPlacedModel,
  onDeletePlacedModel,
  onSelectPlacedText,
  onDeletePlacedText,
}: PalettePlacedObjectsProps) {
  const { t } = useTranslation();
  const [objectSearch, setObjectSearch] = useState('');

  const normalizedObjectSearch = objectSearch.trim().toLowerCase();

  const allItems = useMemo(() => {
    const modelItems: PlacedObjectItem[] = placedModels.map((model) => ({
      id: model.id,
      displayName: model.equipName.trim() || model.id,
      subtitle: humanizeModelPath(model.path),
      type: 'model' as const,
    }));

    const textItems: PlacedObjectItem[] = placedTexts.map((text) => ({
      id: text.id,
      displayName: text.content.trim() || 'Text',
      subtitle: t('monitoring:editor.textObject'),
      type: 'text' as const,
    }));

    const items = [...modelItems, ...textItems];

    if (!normalizedObjectSearch) {
      return items;
    }

    return items.filter(
      (item) =>
        item.displayName.toLowerCase().includes(normalizedObjectSearch) ||
        item.subtitle.toLowerCase().includes(normalizedObjectSearch),
    );
  }, [normalizedObjectSearch, placedModels, placedTexts, t]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Layers3 className="size-3 text-muted-foreground" />
          <p className="text-[10px] font-semibold tracking-[0.12em] text-foreground/75 uppercase">
            {t('monitoring:editor.placedObjects')}
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-sm border-border bg-muted px-1.5 py-0 text-[9px] text-muted-foreground"
        >
          {placedModels.length + placedTexts.length}
        </Badge>
      </div>
      <div className="border-b border-border px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={objectSearch}
            onChange={(event) => {
              setObjectSearch(event.target.value);
            }}
            placeholder="Search objects"
            className="h-6 rounded-sm border-border bg-muted pl-7 text-[11px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col py-0.5">
          {allItems.length > 0 ? (
            allItems.map((item) => {
              const isSelected = selectedModelId === item.id;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={item.displayName}
                  onClick={() => {
                    if (item.type === 'text') {
                      onSelectPlacedText?.(item.id);
                    } else {
                      onSelectPlacedModel(item.id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (item.type === 'text') {
                        onSelectPlacedText?.(item.id);
                      } else {
                        onSelectPlacedModel(item.id);
                      }
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
                    ) : (
                      <Boxes className="size-2.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-none">
                      {item.displayName}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] leading-none text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 cursor-pointer rounded-sm text-muted-foreground hover:bg-muted hover:text-red-300"
                    aria-label={t('monitoring:editor.deleteObject')}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (item.type === 'text') {
                        onDeletePlacedText?.(item.id);
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
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
              {t('monitoring:editor.noPlacedObjects')}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
