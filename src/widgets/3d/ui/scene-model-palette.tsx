import { Download, GripHorizontal, Loader2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SceneModelCatalogItem } from '@/entities/3d';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/atoms/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/shared/ui/molecules/card';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { SceneModelPreview } from './scene-model-preview';

const PALETTE_HORIZONTAL_SPACING = 'px-3';
const PALETTE_CARD_INSET = 'p-3';

interface SceneModelPaletteProps {
  items: SceneModelCatalogItem[];
  draggingItemId: string | null;
  onDragStart: (item: SceneModelCatalogItem) => void;
  onDragEnd: () => void;
  onSave: () => void;
  onExport: () => void;
  saveDisabled?: boolean;
  exportDisabled?: boolean;
  isSaving?: boolean;
}

export function SceneModelPalette({
  items,
  draggingItemId,
  onDragStart,
  onDragEnd,
  onSave,
  onExport,
  saveDisabled = false,
  exportDisabled = false,
  isSaving = false,
}: SceneModelPaletteProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 py-0">
      <CardHeader className={cn('border-b py-4', PALETTE_HORIZONTAL_SPACING)}>
        <div className="flex justify-end gap-2">
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
      </CardHeader>

      <CardContent
        className={cn(
          'min-h-0 flex-1 pt-4 pb-4',
          PALETTE_HORIZONTAL_SPACING,
        )}
      >
        <ScrollArea className="h-full">
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const isDragging = draggingItemId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/plain', item.id);
                    onDragStart(item);
                  }}
                  onDragEnd={onDragEnd}
                  className={cn(
                    'group border-border/70 bg-background/70 hover:border-primary/35 hover:bg-muted/60 relative w-full cursor-grab rounded-[1.15rem] border text-left transition duration-200 active:cursor-grabbing',
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
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
