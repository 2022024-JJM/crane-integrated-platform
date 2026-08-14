import { Lock, Map, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  humanizeModelPath,
  isMapLocked,
  type SavedMapInfo,
} from '@crane/domain/3d';
import { Button } from '@crane/ui/atoms/button';

interface PaletteMapSectionProps {
  map: SavedMapInfo;
  onDeleteMap: () => void;
}

/**
 * 하단 Project 패널의 지도 섹션 — 에셋으로서의 지도(무엇이 올라와 있고,
 * 지울 수 있다)만 보여준다.
 *
 * 선택과 편집 잠금은 좌측 계층 목록(PalettePlacedObjects)이 담당한다.
 * 같은 조작을 두 곳에 두면 어느 쪽이 정본인지 모호해지므로, 여기서는
 * 잠금 상태를 읽기 전용 배지로만 비춘다.
 */
export const PaletteMapSection = memo(function PaletteMapSection({
  map,
  onDeleteMap,
}: PaletteMapSectionProps) {
  const { t } = useTranslation();
  const locked = isMapLocked(map);

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
        {locked ? (
          <Lock
            aria-label={t('monitoring:editor.mapLocked')}
            className="text-muted-foreground/70 size-3 shrink-0"
          />
        ) : null}
      </div>
    </section>
  );
});
