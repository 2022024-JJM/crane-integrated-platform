import { Search } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type ScenePlaceableModel } from '@crane/domain/3d';
import type { ScenePaletteModel } from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Input } from '@crane/ui/atoms/input';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { toPaletteThumbnailUrl } from '../lib/palette-thumbnail';
import { SceneModelPreview } from './scene-model-preview';

const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';

interface PaletteAssetGridProps {
  /** 팔레트 항목 — 자산 라이브러리의 모델(놓을 수 없는 것 포함). */
  items: ScenePaletteModel[];
  draggingItemId: string | null;
  onDragStart: (item: ScenePlaceableModel) => void;
  onDragEnd: () => void;
  emptyMessage?: string;
  assetSearch?: string;
  onAssetSearchChange?: (value: string) => void;
  showToolbar?: boolean;
}

export const PaletteAssetGrid = memo(function PaletteAssetGrid({
  items,
  draggingItemId,
  onDragStart,
  onDragEnd,
  emptyMessage,
  assetSearch: controlledAssetSearch,
  onAssetSearchChange,
  showToolbar = true,
}: PaletteAssetGridProps) {
  const { t } = useTranslation();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [uncontrolledAssetSearch, setUncontrolledAssetSearch] = useState('');
  const controlClassName = 'h-6 rounded-sm';
  const assetSearch = controlledAssetSearch ?? uncontrolledAssetSearch;

  const normalizedAssetSearch = assetSearch.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedAssetSearch) {
      return items;
    }

    return items.filter(({ item }) => {
      const modelType = humanizeModelPath(item.path);

      return (
        item.label.toLowerCase().includes(normalizedAssetSearch) ||
        modelType.toLowerCase().includes(normalizedAssetSearch)
      );
    });
  }, [items, normalizedAssetSearch]);

  const handleAssetSearchChange = (value: string) => {
    if (onAssetSearchChange) {
      onAssetSearchChange(value);
      return;
    }

    setUncontrolledAssetSearch(value);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      {showToolbar ? (
        <div className="shrink-0 px-1 pt-1 pb-2">
          <div className="flex items-center gap-2">
            <div
              className={`border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 ${controlClassName} flex min-w-0 flex-1 items-center border px-2 transition-colors focus-within:ring-3`}
            >
              <Search className="text-muted-foreground/50 mr-2 size-3 shrink-0" />
              <Input
                value={assetSearch}
                onChange={(event) => {
                  handleAssetSearchChange(event.target.value);
                }}
                placeholder={t('monitoring:editor.searchModels')}
                className="placeholder:text-muted-foreground h-full flex-1 border-0 bg-transparent px-0 text-[11px] leading-none shadow-none focus:border-0 focus:ring-0"
              />
            </div>
            <div className="flex h-6 shrink-0 items-center">
              <Badge
                render={<div />}
                variant="outline"
                className={`border-border bg-muted text-muted-foreground ${controlClassName} flex min-w-6 items-center justify-center px-1.5 py-0 text-[9px] leading-none`}
              >
                {filteredItems.length}
              </Badge>
            </div>
          </div>
        </div>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        {filteredItems.length > 0 ? (
          <div
            ref={gridRef}
            className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5 pr-1 pb-1"
          >
            {filteredItems.map((model, index) => {
              const { item, blocked } = model;
              const isDragging = draggingItemId === item.id;
              const len = filteredItems.length;
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={item.label}
                  // 게시되지 않은 자산은 보이지만 놓을 수 없다 — 왜 없는지
                  // 찾게 두지 않고, 왜 못 놓는지 알린다.
                  aria-disabled={blocked !== null}
                  title={
                    blocked
                      ? t(`monitoring:palette.blockedHint.${blocked}`)
                      : undefined
                  }
                  draggable={blocked === null}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      itemRefs.current[(index + 1) % len]?.focus();
                    } else if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      itemRefs.current[(index - 1 + len) % len]?.focus();
                    } else if (
                      event.key === 'ArrowDown' ||
                      event.key === 'ArrowUp'
                    ) {
                      event.preventDefault();
                      const cols = Math.round(
                        (gridRef.current?.offsetWidth ?? 0) /
                          (itemRefs.current[0]?.offsetWidth ?? 1),
                      );
                      const delta = event.key === 'ArrowDown' ? cols : -cols;
                      const next = Math.min(
                        Math.max(index + delta, 0),
                        len - 1,
                      );
                      itemRefs.current[next]?.focus();
                    }
                  }}
                  onDragStart={(event) => {
                    if (blocked) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData(SCENE_MODEL_DRAG_TYPE, item.id);
                    event.dataTransfer.setData('text/plain', item.id);
                    onDragStart(item);
                  }}
                  onDragEnd={onDragEnd}
                  className={cn(
                    'group border-border bg-muted/50 rounded-md border p-1 text-left transition',
                    blocked
                      ? 'cursor-not-allowed'
                      : isDragging
                        ? 'border-primary/40 bg-primary/12 scale-[0.98] cursor-grab'
                        : 'hover:border-border/80 hover:bg-muted cursor-grab',
                  )}
                >
                  {/* 이 브라우저에만 있는 파일은 경로가 없다 — 미리보기를 그리려
                      들지 않는다(빈 경로를 불러오다 오류 타일이 된다). */}
                  {item.path === '' ? (
                    <div className="border-border bg-muted/40 h-12 rounded-md border opacity-45" />
                  ) : (
                    <SceneModelPreview
                      path={item.path}
                      label={item.label}
                      previewUrl={toPaletteThumbnailUrl(model.thumbnail)}
                      overlayLabel={item.label}
                      overlayHint={t('monitoring:palette.dragToPlace')}
                      showOverlay={isDragging}
                      className={cn(
                        'h-12 rounded-md',
                        isDragging && 'border-primary/40',
                        blocked && 'opacity-45',
                      )}
                    />
                  )}
                  <div className="mt-1 min-w-0 px-0.5">
                    <p
                      className={cn(
                        'truncate text-[10px] leading-none font-medium',
                        blocked ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {item.label}
                    </p>
                    {blocked ? (
                      <p className="text-muted-foreground/80 mt-1 truncate text-[9px] leading-none">
                        {blocked === 'unpublished' && model.status
                          ? t(`asset-library:status.${model.status}`)
                          : t(`monitoring:palette.blocked.${blocked}`)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-28 items-center justify-center px-3 pb-3 text-center">
            <p className="text-muted-foreground text-xs">
              {emptyMessage ?? t('monitoring:editor.noModelsMatch')}
            </p>
          </div>
        )}
      </ScrollArea>
    </section>
  );
});
