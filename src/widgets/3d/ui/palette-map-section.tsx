import { Map, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { humanizeModelPath, type SavedMapInfo } from '@/entities/3d';
import { Button } from '@/shared/ui/atoms/button';

interface PaletteMapSectionProps {
  map: SavedMapInfo;
  onDeleteMap: () => void;
}

export function PaletteMapSection({ map, onDeleteMap }: PaletteMapSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="flex shrink-0 flex-col rounded-lg border border-white/8 bg-black/18">
      <div className="flex items-center justify-between border-white/8 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Map className="size-3 text-white/60" />
          <p className="text-[10px] font-semibold tracking-[0.12em] text-white/75 uppercase">
            {t('monitoring:editor.map')}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-5 cursor-pointer rounded-sm text-white/38 hover:bg-white/10 hover:text-red-300"
          aria-label={t('monitoring:editor.deleteMap')}
          onClick={onDeleteMap}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <div className="mx-0.5 mb-1 flex items-center gap-1.5 rounded-sm border border-transparent px-1.5 py-1 text-white/80">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-white/8 bg-white/4 text-[10px] text-white/50">
          <Map className="size-2.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-none">
            {humanizeModelPath(map.path)}
          </p>
          <p className="mt-0.5 truncate text-[9px] leading-none text-white/38">
            {map.id}
          </p>
        </div>
      </div>
    </section>
  );
}
