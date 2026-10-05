import { Blocks, ChevronRight, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  searchScenePaletteCategories,
  type ScenePaletteCategory,
} from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import { Input } from '@crane/ui/atoms/input';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';

const CHIP_CLASS =
  'flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition';
const CHIP_ACTIVE_CLASS = 'border-primary/30 bg-primary/12 text-foreground';
const CHIP_IDLE_CLASS =
  'border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground';

interface PaletteCategoryFilterProps {
  /** 팔레트의 모델 수 — 카테고리를 걸기 전의 수다. */
  total: number;
  /** 고른 카테고리. 칩은 고른 순서로 놓인다. */
  selected: readonly string[];
  /** 고를 수 있는 카테고리 전부(수·체크 포함) — `listScenePaletteCategories`. */
  categories: ScenePaletteCategory[];
  onToggle: (category: string) => void;
  onClear: () => void;
}

/**
 * 모델 탭의 카테고리 필터 — "전체" + 고른 카테고리 칩 + 카테고리 검색 버튼.
 *
 * 카테고리는 라이브러리에 등록된 것이라 많아질 수 있어 줄에 다 늘어놓지 않는다.
 * 버튼을 누르면 팔레트 오른쪽(캔버스 위)에 카테고리 목록이 뜨고, 거기서 고른
 * 것만 칩으로 올라온다. 여러 개를 고르면 모두 가진 모델만 남는다 — 목록의
 * 수는 "이 카테고리까지 걸면 남는 수" 이고 0 이면 고를 수 없다(라이브러리 화면의
 * 카테고리 체크박스와 같은 규칙).
 */
export function PaletteCategoryFilter({
  total,
  selected,
  categories,
  onToggle,
  onClear,
}: PaletteCategoryFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const visibleCategories = searchScenePaletteCategories(categories, keyword);
  const allActive = selected.length === 0;

  return (
    <div className="flex shrink-0 flex-wrap gap-1 pb-2">
      <button
        type="button"
        aria-pressed={allActive}
        onClick={onClear}
        className={cn(CHIP_CLASS, allActive ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS)}
      >
        {t('monitoring:editor.categoryFilter.all')}
        <span
          className={cn(
            'text-[10px] tabular-nums',
            allActive ? 'text-primary' : 'text-muted-foreground/70',
          )}
        >
          {total}
        </span>
      </button>
      {selected.map((category) => (
        // 칩 전체가 "이 카테고리 풀기" 다 — 좁은 패널에서 × 만 겨냥하게 하지 않는다.
        <button
          key={category.toLowerCase()}
          type="button"
          aria-label={t('monitoring:editor.categoryFilter.remove', { category })}
          title={t('monitoring:editor.categoryFilter.remove', { category })}
          onClick={() => onToggle(category)}
          className={cn(CHIP_CLASS, CHIP_ACTIVE_CLASS, 'min-w-0')}
        >
          <span className="truncate">{category}</span>
          <X className="text-muted-foreground size-3 shrink-0" />
        </button>
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // 닫으면 검색어를 비운다 — 다시 열었을 때 카테고리가 전부 보인다.
          if (!next) setKeyword('');
        }}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-pressed={open}
              className={cn(
                CHIP_CLASS,
                open ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS,
              )}
            />
          }
        >
          <Blocks className="size-3 shrink-0" />
          {t('monitoring:editor.categoryFilter.open')}
          <ChevronRight
            className={cn(
              'size-3 shrink-0 transition-transform',
              open && 'rotate-180',
            )}
          />
        </PopoverTrigger>
        <PopoverPopup side="right" align="start" className="w-56 p-2">
          <div className="border-border bg-muted text-foreground focus-within:border-ring focus-within:ring-ring/50 flex h-7 items-center rounded-sm border px-2 transition-colors focus-within:ring-3">
            <Search className="text-muted-foreground/50 mr-2 size-3 shrink-0" />
            <Input
              autoFocus
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('monitoring:editor.categoryFilter.searchPlaceholder')}
              aria-label={t('monitoring:editor.categoryFilter.searchPlaceholder')}
              className="placeholder:text-muted-foreground h-full flex-1 border-0 bg-transparent px-0 text-[11px] leading-none shadow-none focus:border-0 focus:ring-0"
            />
          </div>
          {visibleCategories.length > 0 ? (
            // 카테고리가 많아도 팝업이 화면 밖으로 자라지 않게 목록만 스크롤한다.
            <ul className="mt-1.5 flex max-h-72 flex-col overflow-y-auto">
              {visibleCategories.map((node) => (
                <li key={node.category.toLowerCase()}>
                  <CategoryRow node={node} onToggle={() => onToggle(node.category)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-1 py-4 text-center text-[11px]">
              {categories.length === 0
                ? t('monitoring:editor.categoryFilter.empty')
                : t('monitoring:editor.categoryFilter.noMatch')}
            </p>
          )}
        </PopoverPopup>
      </Popover>
    </div>
  );
}

/** 카테고리 한 줄 — 체크하면 그 카테고리를 가진 모델로 좁히고 칩으로 올라간다. */
function CategoryRow({
  node,
  onToggle,
}: {
  node: ScenePaletteCategory;
  onToggle: () => void;
}) {
  // 더 걸면 남는 모델이 없는 카테고리는 고를 수 없다. 이미 고른 것은 풀 수 있어야
  // 하므로 막지 않는다.
  const disabled = node.count === 0 && !node.checked;
  return (
    <label
      className={cn(
        'flex h-7 items-center gap-2 rounded-md px-1.5 text-xs transition-colors',
        disabled
          ? 'text-muted-foreground/50'
          : cn(
              'hover:bg-muted cursor-pointer',
              node.checked ? 'text-foreground font-medium' : 'text-foreground/80',
            ),
      )}
    >
      <Checkbox
        checked={node.checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        className="size-3.5 after:hidden"
      />
      <span className="min-w-0 flex-1 truncate">{node.category}</span>
      <span
        className={cn(
          'shrink-0 text-[11px] tabular-nums',
          disabled ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
      >
        {node.count}
      </span>
    </label>
  );
}
