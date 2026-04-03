import { Map, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type SavedMapInfo } from '@crane/domain/3d';
import { Button } from '@crane/ui/atoms/button';

interface PaletteMapSectionProps {
  map: SavedMapInfo;
  onDeleteMap: () => void;
}

export function PaletteMapSection({
  map,
  onDeleteMap,
}: PaletteMapSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="border-border bg-card flex shrink-0 flex-col rounded-lg border">
      <div className="border-border flex items-center justify-between px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Map className="text-muted-foreground size-3" />
          <p className="text-foreground/75 text-[10px] font-semibold tracking-[0.12em] uppercase">
            {t('monitoring:editor.map')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-muted size-5 cursor-pointer rounded-sm hover:text-red-300"
          aria-label={t('monitoring:editor.deleteMap')}
          onClick={onDeleteMap}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="text-foreground/80 mx-0.5 mb-1 flex items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-1">
        <div className="border-border bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px]">
          <Map className="size-2.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] leading-none font-medium">
            {humanizeModelPath(map.path)}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-[9px] leading-none">
            {map.id}
          </p>
        </div>
      </div>
    </section>
  );
}
