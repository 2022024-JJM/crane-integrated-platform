import { Check, Lock, LockOpen, Map } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedMapInfo, SceneMapCatalogItem } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Switch } from '@crane/ui/atoms/switch';
import {
  getMapPaletteTiles,
  type MapPaletteTile,
} from '../lib/map-palette-tiles';

interface PaletteMapSectionProps {
  /** 씬에 놓인 지도 전체. 배치·잠금 표시는 경로 매칭으로 한다. */
  maps: SavedMapInfo[];
  /** 카탈로그 항목을 씬에 append(addSceneMap). */
  onAddMap: (catalogItem: SceneMapCatalogItem) => void;
  /** 놓인 지도 제거 — 계층 목록의 삭제와 같은 액션(deletePlacedMap). */
  onRemoveMap: (id: string) => void;
  /** 잠금 토글 — 계층 목록의 자물쇠 버튼과 같은 액션(setObjectLocked). */
  onToggleLock: (id: string, locked: boolean) => void;
  /**
   * 바다 표시의 유효값(resolveSeaVisible) — 스위치가 보이는 상태. 씬이 바다를
   * 지정하지 않은(undefined) 경우 레거시 규칙(배경이 있으면 바다)의 결과다.
   */
  seaVisible: boolean;
  /** 씬에 `sea` 가 명시돼 있는지. false 면 레거시 규칙 안내 문구를 붙인다. */
  seaExplicit: boolean;
  /** 바다 스위치 토글 — 항상 명시 boolean 을 저장한다(setSeaVisible). */
  onSeaVisibleChange: (visible: boolean) => void;
}

/**
 * 지도 추가/제거 + 바다 표시 스위치 — Project 패널의 Map 카테고리.
 * 배경(PaletteEnvironmentSection)과 달리 단일 선택이 아니다: 씬에는 지도가
 * 여러 장 놓일 수 있고(조선소 + 주변 지형), 타일은 그 한 장의 토글이다 —
 * 안 놓인 타일 클릭 = 추가, 놓인(잠금 해제) 타일 클릭 = 제거. 배치·잠금
 * 상태 파생은 getMapPaletteTiles.
 *
 * 타일 아래 바다 절은 배경 탭의 조명 절과 같은 마크업이다. 스위치는 유효값을
 * 보이고 누르면 그 반대를 명시 boolean 으로 씬에 저장한다 — 미지정 씬은 첫
 * 토글부터 레거시 규칙 → 명시 상태로 바뀌는 편집이라 dirty 가 선다(유효값을
 * 그대로 명시로 굳히는 조작은 없다 — 두 번 누른다). 값은 씬 파일 단위라
 * 파일을 공유하는 region(okpo dock-1·dock-2)에 함께 적용된다.
 *
 * 잠긴 지도의 타일은 체크·자물쇠만 보이고 클릭을 무시한다 — 잠금은 선택·변형·
 * 삭제를 모두 막는 규칙이다. 타일마다 자물쇠 버튼을 두어(계층 목록과 같은
 * setObjectLocked) 지도를 바꾸려고 이 탭에 온 사용자가 우측 패널까지 오가지
 * 않아도 된다. 저장본을 다시 열면 lockMaps 가 전 지도를 잠그므로 새로 추가한
 * 지도도 재진입 후엔 잠겨 있다(의도된 동작).
 *
 * 타일과 자물쇠는 둘 다 button 이라 중첩하지 않고 형제로 둔다(자물쇠는 절대
 * 배치). button 안의 button 은 유효하지 않은 HTML 이고 React 가 경고한다.
 */
export const PaletteMapSection = memo(function PaletteMapSection({
  maps,
  onAddMap,
  onRemoveMap,
  onToggleLock,
  seaVisible,
  seaExplicit,
  onSeaVisibleChange,
}: PaletteMapSectionProps) {
  const { t } = useTranslation();
  const tiles = getMapPaletteTiles(maps);

  const handleTileClick = ({ item, placed, locked }: MapPaletteTile) => {
    if (!placed) {
      onAddMap(item);
      return;
    }
    if (locked) {
      return;
    }
    onRemoveMap(placed.id);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <MapTile
            key={tile.item.id}
            label={tile.item.label}
            placed={tile.placed !== null}
            locked={tile.locked}
            title={
              !tile.placed
                ? t('monitoring:editor.mapAdd')
                : tile.locked
                  ? t('monitoring:editor.mapLockedHint')
                  : t('monitoring:editor.mapRemove')
            }
            lockLabel={
              tile.locked
                ? t('monitoring:editor.unlockObject')
                : t('monitoring:editor.lockObject')
            }
            onClick={() => handleTileClick(tile)}
            onToggleLock={
              tile.placed
                ? () => onToggleLock(tile.placed!.id, !tile.locked)
                : undefined
            }
          />
        ))}
      </div>

      {/* 바다 — 씬 설정 스위치(배경 탭의 조명 절과 같은 마크업) */}
      <div className="border-border mt-1 flex flex-col gap-2 border-t pt-2">
        <span className="text-muted-foreground text-[11px] font-medium">
          {t('monitoring:editor.seaSection')}
        </span>

        {!seaExplicit ? (
          <p className="text-muted-foreground border-border bg-muted/40 rounded-md border px-2 py-1.5 text-[11px] leading-snug">
            {t('monitoring:editor.seaUnsetHint')}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="text-foreground text-[11px]">
            {t('monitoring:editor.seaVisible')}
          </span>
          <Switch
            checked={seaVisible}
            onCheckedChange={onSeaVisibleChange}
            aria-label={t('monitoring:editor.seaVisible')}
          />
        </div>
      </div>
    </div>
  );
});

function MapTile({
  label,
  placed,
  locked,
  title,
  lockLabel,
  onClick,
  onToggleLock,
}: {
  label: string;
  placed: boolean;
  locked: boolean;
  title: string;
  lockLabel: string;
  onClick: () => void;
  /** 놓인 지도에만 있다. 없으면 자물쇠 버튼을 그리지 않는다. */
  onToggleLock?: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={placed}
        aria-disabled={locked || undefined}
        title={title}
        onClick={onClick}
        className={cn(
          'group relative flex w-full flex-col items-center gap-1.5 rounded-md border px-2 py-3 transition',
          locked ? 'cursor-default' : 'cursor-pointer',
          placed
            ? 'border-primary/50 bg-primary/10'
            : 'border-border bg-card hover:border-border hover:bg-muted/60',
        )}
      >
        {placed ? (
          <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full">
            <Check className="size-2.5" />
          </span>
        ) : null}
        <Map className="text-muted-foreground size-5" />
        <span
          className={cn(
            'w-full truncate text-center text-[11px] font-medium',
            placed ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      </button>
      {onToggleLock ? (
        // 계층 목록의 자물쇠 버튼과 같은 규칙 — 아이콘·색은 현재 상태를,
        // aria-label은 누르면 일어날 동작을 나타낸다.
        <button
          type="button"
          aria-pressed={locked}
          aria-label={lockLabel}
          title={lockLabel}
          onClick={onToggleLock}
          className={cn(
            'absolute top-1.5 left-1.5 flex size-5 cursor-pointer items-center justify-center rounded-sm transition-colors',
            locked
              ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
              : 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-400',
          )}
        >
          {locked ? (
            <Lock className="size-3.5" />
          ) : (
            <LockOpen className="size-3.5" />
          )}
        </button>
      ) : null}
    </div>
  );
}
