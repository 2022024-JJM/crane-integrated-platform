import { Ban, Check, Lock, LockOpen, Map } from 'lucide-react';
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
  /** 잠금 토글 — 계층 목록의 자물쇠 버튼과 같은 액션(setObjectLocked). */
  onToggleLock: (id: string, locked: boolean) => void;
}

/**
 * 지도 선택 — Project 패널의 Map 카테고리. 배경(PaletteEnvironmentSection)과
 * 같은 클릭 단일 선택이다: 카탈로그(sceneMapCatalog)에서 하나를 고르면 씬의
 * 지도가 교체되고, "지도 없음"을 고르면 제거된다. 씬에는 지도가 최대 1장
 * 이라는 전제(드롭 raycast 바닥면 등)를 이 UI가 보장한다.
 *
 * 현재 지도가 잠겨 있으면 전체를 비활성화한다 — 잠금은 선택·변형·삭제를
 * 모두 막는 규칙이고 교체는 삭제를 포함한다. 잠금 상태 배너는 지도가 있는
 * 동안 항상 남는다 — 해제 시에만 보이면 다시 잠글 방법이 사라진다. 배너의
 * 자물쇠 버튼은 계층 목록의 자물쇠와 같은 액션(setObjectLocked)이다 —
 * 지도를 바꾸려고 이 탭에 온 사용자가 우측 패널까지 오가지 않아도 된다.
 */
export const PaletteMapSection = memo(function PaletteMapSection({
  currentMap,
  onSelectMap,
  onToggleLock,
}: PaletteMapSectionProps) {
  const { t } = useTranslation();
  const isLocked = currentMap != null && currentMap.locked !== false;

  return (
    <div className="flex flex-col gap-2">
      {currentMap ? (
        <div className="text-muted-foreground border-border bg-muted/40 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] leading-snug">
          <span className="min-w-0 flex-1 truncate">
            {isLocked
              ? t('monitoring:editor.objectLocked')
              : t('monitoring:editor.objectUnlocked')}
          </span>
          {/* 계층 목록의 자물쇠 버튼과 같은 규칙 — 아이콘·색은 현재 상태를,
              aria-label은 누르면 일어날 동작을 나타낸다. */}
          <button
            type="button"
            aria-pressed={isLocked}
            aria-label={
              isLocked
                ? t('monitoring:editor.unlockObject')
                : t('monitoring:editor.lockObject')
            }
            title={
              isLocked
                ? t('monitoring:editor.unlockObject')
                : t('monitoring:editor.lockObject')
            }
            onClick={() => onToggleLock(currentMap.id, !isLocked)}
            className={cn(
              'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors',
              isLocked
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : 'text-amber-500 hover:bg-amber-500/15 hover:text-amber-400',
            )}
          >
            {isLocked ? (
              <Lock className="size-3.5" />
            ) : (
              <LockOpen className="size-3.5" />
            )}
          </button>
        </div>
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
