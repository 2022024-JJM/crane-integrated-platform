import {
  CheckCircle2,
  Download,
  GripHorizontal,
  Layers3,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SavedModelInfo, SceneModelCatalogItem } from '@/entities/3d';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@/shared/ui/atoms/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/shared/ui/molecules/card';
import { Separator } from '@/shared/ui/atoms/separator';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { SceneModelPreview } from './scene-model-preview';

const PALETTE_HORIZONTAL_SPACING = 'px-3';
const PALETTE_CARD_INSET = 'p-3';
const SCENE_MODEL_DRAG_TYPE = 'application/x-scene-model-id';

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

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardHeader className={cn('border-b py-4', PALETTE_HORIZONTAL_SPACING)}>
        <div className="flex items-center justify-between gap-2">
          {!saveDisabled ? (
            <Badge
              variant="outline"
              className={cn('h-7 rounded-full px-3', saveStatusClassName)}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
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
              onClick={onSave}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={onExport}
            >
              <Download />
              {t('monitoring:editor.exportJson')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          'min-h-0 flex-1 pt-4 pb-4',
          PALETTE_HORIZONTAL_SPACING,
        )}
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <section className="flex min-h-0 basis-[52%] flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                {t('monitoring:palette.title')}
              </p>
              <Badge variant="outline" className="rounded-full px-2.5">
                {items.length}
              </Badge>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="grid grid-cols-2 gap-3 pr-3">
                {items.map((item) => {
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
                        'group border-border/70 bg-background/70 hover:border-primary/35 hover:bg-muted/60 relative w-full cursor-pointer rounded-[1.15rem] border text-left transition duration-200 active:cursor-grabbing',
                        PALETTE_CARD_INSET,
                        isDragging &&
                          'border-primary/45 bg-primary/6 scale-[0.985] shadow-[0_18px_40px_rgba(15,23,42,0.18)]',
                      )}
                    >
                      <SceneModelPreview
                        path={item.path}
                        label={item.label}
                        preview={item.preview}
                        overlayLabel={item.label}
                        overlayHint={
                          isDragging
                            ? t('monitoring:palette.dragging')
                            : t('monitoring:palette.dragToPlace')
                        }
                        showOverlay={isDragging}
                        className={cn(
                          'transition duration-200',
                          isDragging && 'scale-[0.98] opacity-80',
                          !isDragging && 'group-hover:scale-[0.99]',
                        )}
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-[1.15rem] ring-1 ring-transparent transition group-hover:ring-white/8" />
                      <div className="pointer-events-none absolute right-3 bottom-3 left-3 rounded-xl bg-slate-950/82 px-2.5 py-2 text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                        <p className="truncate text-[11px] font-semibold leading-tight">
                          {item.label}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] leading-tight text-white/65">
                          {t('monitoring:palette.dragToPlace')}
                        </p>
                      </div>
                      <div className="text-muted-foreground absolute top-3 right-3 flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-slate-950/48 px-1.5 py-1 text-[10px] backdrop-blur-sm">
                        <GripHorizontal className="size-2.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </section>

          <Separator />

          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers3 className="text-muted-foreground size-4" />
                <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
                  {t('monitoring:editor.placedObjects')}
                </p>
              </div>
              <Badge variant="outline" className="rounded-full px-2.5">
                {placedModels.length}
              </Badge>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-2 pr-3">
                {placedModels.length > 0 ? (
                  placedModels.map((model) => {
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
                          'border-border/70 bg-background/70 hover:border-primary/35 hover:bg-muted/60 flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                          isSelected && 'border-primary/45 bg-primary/6 ring-1 ring-primary/20',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {displayName}
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                            {humanizeModelPath(model.path)}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive size-8 rounded-lg"
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
                  <div className="text-muted-foreground flex min-h-24 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm">
                    {t('monitoring:editor.noPlacedObjects')}
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
