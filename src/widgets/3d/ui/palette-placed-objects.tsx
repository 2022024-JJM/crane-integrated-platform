import { Boxes, Layers3, Search, Trash2, Type } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type SavedModelInfo, type SavedTextInfo } from '@/entities/3d';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';

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
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/8 bg-black/18">
      <div className="flex items-center justify-between border-b border-white/8 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Layers3 className="size-3 text-white/60" />
          <p className="text-[10px] font-semibold tracking-[0.12em] text-white/75 uppercase">
            {t('monitoring:editor.placedObjects')}
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-sm border-white/8 bg-white/4 px-1.5 py-0 text-[9px] text-white/75"
        >
          {placedModels.length + placedTexts.length}
        </Badge>
      </div>
      <div className="border-b border-white/8 px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-white/28" />
          <Input
            value={objectSearch}
            onChange={(event) => {
              setObjectSearch(event.target.value);
            }}
            placeholder="Search objects"
            className="h-6 rounded-sm border-white/8 bg-white/4 pl-7 text-[11px] text-white placeholder:text-white/30"
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
                      ? 'border-[#5f83c5]/60 bg-[#34558c] text-white'
                      : 'text-white/80 hover:border-white/6 hover:bg-white/5',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px]',
                      isSelected
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-white/8 bg-white/4 text-white/50',
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
                    <p className="mt-0.5 truncate text-[9px] leading-none text-white/38">
                      {item.subtitle}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 cursor-pointer rounded-sm text-white/38 hover:bg-white/10 hover:text-red-300"
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
            <div className="px-3 py-4 text-center text-[11px] text-white/40">
              {t('monitoring:editor.noPlacedObjects')}
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
