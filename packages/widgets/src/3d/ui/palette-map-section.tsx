import { Ban, Check, Lock, Map } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  sceneMapCatalog,
  type SavedMapInfo,
  type SceneMapCatalogItem,
} from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';

interface PaletteMapSectionProps {
  /** 씬의 현재 지도(maps[0]). 없으면 null. */
  currentMap: SavedMapInfo | null;
  /** 카탈로그 항목 선택(교체) 또는 null(지도 없음). */
  onSelectMap: (catalogItem: SceneMapCatalogItem | null) => void;
}

/**
 * 지도 선택 — Project 패널의 Map 카테고리. 배경(PaletteEnvironmentSection)과
 * 같은 클릭 단일 선택이다: 카탈로그(sceneMapCatalog)에서 하나를 고르면 씬의
 * 지도가 교체되고, "지도 없음"을 고르면 제거된다. 씬에는 지도가 최대 1장
 * 이라는 전제(드롭 raycast 바닥면 등)를 이 UI가 보장한다.
 *
 * 현재 지도가 잠겨 있으면 전체를 비활성화한다 — 잠금은 선택·변형·삭제를
 * 모두 막는 규칙이고 교체는 삭제를 포함한다. 잠금 해제는 좌측 계층 목록의
 * 자물쇠 버튼으로 한다(같은 조작을 두 곳에 두지 않는다).
 */
export const PaletteMapSection = memo(function PaletteMapSection({
  currentMap,
  onSelectMap,
}: PaletteMapSectionProps) {
  const { t } = useTranslation();
  const isLocked = currentMap != null && currentMap.locked !== false;

  return (
    <div className="flex flex-col gap-2">
      {isLocked ? (
        <p className="text-muted-foreground border-border bg-muted/40 flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] leading-snug">
          <Lock className="size-3 shrink-0" />
          {t('monitoring:editor.objectLocked')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <MapTile
          label={t('monitoring:editor.mapNone')}
          isSelected={currentMap === null}
          disabled={isLocked}
          onSelect={() => onSelectMap(null)}
          icon={<Ban className="text-muted-foreground size-5" />}
        />
        {sceneMapCatalog.map((item) => (
          <MapTile
            key={item.id}
            label={item.label}
            isSelected={currentMap?.path === item.path}
            disabled={isLocked}
            onSelect={() => onSelectMap(item)}
            icon={<Map className="text-muted-foreground size-5" />}
          />
        ))}
      </div>
    </div>
  );
});

function MapTile({
  label,
  isSelected,
  disabled,
  onSelect,
  icon,
}: {
  label: string;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 transition',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
        isSelected
          ? 'border-primary/50 bg-primary/10'
          : cn(
              'border-border bg-card',
              !disabled && 'hover:border-border hover:bg-muted/60',
            ),
      )}
    >
      {isSelected ? (
        <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full">
          <Check className="size-2.5" />
        </span>
      ) : null}
      {icon}
      <span
        className={cn(
          'w-full truncate text-center text-[11px] font-medium',
          isSelected ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </button>
  );
}
