import {
  CheckCircle2,
  Download,
  Layers3,
  Loader2,
  Save,
  Search,
  Trash2,
  Boxes,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedModelInfo, SceneModelCatalogItem } from '@/entities/3d';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Card, CardContent, CardHeader } from '@/shared/ui/molecules/card';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { SceneModelPreview } from './scene-model-preview';

const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';
const PALETTE_VISIBLE_ROWS_HEIGHT_CLASS = 'h-[15.5rem]';

interface SceneModelPaletteProps {
  items: SceneModelCatalogItem[];
  placedModels: SavedModelInfo[];
  draggingItemId: string | null;
  selectedModelId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSelectPlacedModel: (id: string) => void;
  onDeletePlacedModel: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
  saveDisabled?: boolean;
  exportDisabled?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
}

function humanizeModelPath(path: string) {
  const fileName = path.split('/').pop() ?? path;
  const stem = fileName.replace(/\.glb$/i, '');

  return stem
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeModelLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function SceneModelPalette({
  items,
  placedModels,
  draggingItemId,
  selectedModelId,
  onDragStart,
  onDragEnd,
  onSelectPlacedModel,
  onDeletePlacedModel,
  onSave,
  onExport,
  saveDisabled = false,
  exportDisabled = false,
  isDirty = false,
  isSaving = false,
}: SceneModelPaletteProps) {
  const { t } = useTranslation();
  const [objectSearch, setObjectSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const saveStatusLabel = isSaving
    ? t('monitoring:editor.statusSaving')
    : isDirty
      ? t('monitoring:editor.statusUnsaved')
      : t('monitoring:editor.statusSaved');
  const saveStatusClassName = isSaving
    ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
    : isDirty
      ? 'border-orange-500/25 bg-orange-500/10 text-orange-100'
      : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100';

  const normalizedObjectSearch = objectSearch.trim().toLowerCase();
  const filteredPlacedModels = useMemo(() => {
    if (!normalizedObjectSearch) {
      return placedModels;
    }

    return placedModels.filter((model) => {
      const displayName = model.equipName.trim() || model.id;
      const modelType = humanizeModelPath(model.path);

      return (
        displayName.toLowerCase().includes(normalizedObjectSearch) ||
        modelType.toLowerCase().includes(normalizedObjectSearch)
      );
    });
  }, [normalizedObjectSearch, placedModels]);

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
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden border-white/8 bg-[#171717] py-0 text-white">
      <CardHeader className="border-b border-white/10 px-2.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {!saveDisabled ? (
            <Badge
              variant="outline"
              className={cn(
                'h-5 rounded-sm border px-1.5 text-[9px] font-medium tracking-[0.02em]',
                saveStatusClassName,
              )}
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              {saveStatusLabel}
            </Badge>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saveDisabled || isSaving}
              className="h-6 cursor-pointer rounded-sm border-white/8 bg-white/4 px-2 text-[11px] text-white hover:bg-white/10"
              onClick={onSave}
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              className="h-6 cursor-pointer rounded-sm border-white/8 bg-white/4 px-2 text-[11px] text-white hover:bg-white/10"
              onClick={onExport}
            >
              <Download className="size-3.5" />
              {t('monitoring:editor.exportJson')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 px-2 py-2">
        <section className="flex shrink-0 flex-col rounded-lg border border-white/8 bg-black/18">
          <div className="flex items-center justify-between border-b border-white/8 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Boxes className="size-3 text-white/60" />
              <p className="text-[10px] font-semibold tracking-[0.12em] text-white/75 uppercase">
                {t('monitoring:palette.title')}
              </p>
            </div>
            <Badge
              variant="outline"
              className="rounded-sm border-white/8 bg-white/4 px-1.5 py-0 text-[9px] text-white/75"
            >
              {items.length}
            </Badge>
          </div>
          <div className="border-b border-white/10 px-2 py-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-white/28" />
              <Input
                value={assetSearch}
                onChange={(event) => {
                  setAssetSearch(event.target.value);
                }}
                placeholder="Search models"
                className="h-6 rounded-sm border-white/8 bg-white/4 pl-7 text-[11px] text-white placeholder:text-white/30"
              />
            </div>
          </div>
          <ScrollArea
            className={cn('min-h-0', PALETTE_VISIBLE_ROWS_HEIGHT_CLASS)}
          >
            <div className="grid grid-cols-2 gap-2 p-2">
              {filteredItems.map((item) => {
                const isDragging = draggingItemId === item.id;
                const modelTypeLabel = humanizeModelPath(item.path);
                const showModelTypeLabel =
                  normalizeModelLabel(item.label) !==
                  normalizeModelLabel(modelTypeLabel);

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
                      'group cursor-pointer rounded-lg border border-white/8 bg-white/[0.03] p-1.5 text-left transition',
                      isDragging
                        ? 'scale-[0.98] border-primary/40 bg-primary/12'
                        : 'hover:border-white/12 hover:bg-white/[0.06]',
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
                      <p className="truncate text-[11px] font-semibold leading-none text-white">
                        {item.label}
                      </p>
                      {showModelTypeLabel ? (
                        <p className="mt-1 truncate text-[9px] leading-none text-white/38">
                          {modelTypeLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </section>

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
              {placedModels.length}
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
              {filteredPlacedModels.length > 0 ? (
                filteredPlacedModels.map((model) => {
                  const isSelected = selectedModelId === model.id;
                  const displayName = model.equipName.trim() || model.id;

                  return (
                    <div
                      key={model.id}
                      role="button"
                      tabIndex={0}
                      aria-label={displayName}
                      onClick={() => {
                        onSelectPlacedModel(model.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectPlacedModel(model.id);
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
                      <Boxes className="size-2.5" />
                    </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium leading-none">
                          {displayName}
                        </p>
                        <p className="mt-0.5 truncate text-[9px] leading-none text-white/38">
                          {humanizeModelPath(model.path)}
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
                          onDeletePlacedModel(model.id);
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
      </CardContent>
    </Card>
  );
}
