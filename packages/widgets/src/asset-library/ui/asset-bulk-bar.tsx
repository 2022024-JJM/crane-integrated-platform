import {
  ArrowRightCircle,
  Blocks,
  FolderInput,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_CATEGORY_MAX,
  type AssetCollection,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  Popover,
  PopoverClose,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';

/** 고른 자산들에 지금 걸 수 있는 상태 전환과, 그것이 걸리는 자산 수. */
export interface BulkTransition {
  to: AssetVersionStatus;
  count: number;
}

interface AssetBulkBarProps {
  count: number;
  collections: readonly AssetCollection[];
  /** 고른 자산들이 가진 카테고리(많은 순). 빼기 메뉴에 쓴다. */
  categories: readonly string[];
  transitions: readonly BulkTransition[];
  /** 지우기를 낼 것인가 — 파일을 다룰 수 있는 환경(dev)에서만. */
  canRemove: boolean;
  /** 고른 것 중 지울 수 있는(어디에서도 쓰이지 않는) 자산 수. */
  removableCount: number;
  onAddCategory: (category: string) => void;
  onRemoveCategory: (category: string) => void;
  onAddToCollection: (collectionId: string) => void;
  onTransition: (to: AssetVersionStatus) => void;
  onRemove: () => void;
  onClear: () => void;
}

const MENU_ITEM =
  'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-xs outline-none';

/**
 * 여러 자산을 고른 뒤의 일괄 작업 — 상태 전환·카테고리·컬렉션·삭제.
 * 메뉴는 고른 자산에 실제로 걸리는 것만 낸다(걸리는 수를 옆에 적는다).
 */
export function AssetBulkBar({
  count,
  collections,
  categories,
  transitions,
  canRemove,
  removableCount,
  onAddCategory,
  onRemoveCategory,
  onAddToCollection,
  onTransition,
  onRemove,
  onClear,
}: AssetBulkBarProps) {
  const { t } = useTranslation();
  const [categoryDraft, setCategoryDraft] = useState('');

  return (
    <div
      role="toolbar"
      aria-label={t('asset-library:bulk.label')}
      className="border-border bg-muted/50 flex flex-wrap items-center gap-1 rounded-lg border px-3 py-1.5"
    >
      <span className="text-foreground mr-1 text-xs font-medium tabular-nums">
        {t('asset-library:bulk.selected', { count })}
      </span>
      <span aria-hidden className="bg-border mr-1 h-4 w-px" />

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm" disabled={transitions.length === 0}>
              <ArrowRightCircle />
              {t('asset-library:bulk.changeStatus')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="w-48">
          {transitions.map(({ to, count: applicable }) => (
            <PopoverClose
              key={to}
              className={MENU_ITEM}
              onClick={() => onTransition(to)}
            >
              {t(`asset-library:versions.transition.${to}`)}
              <span className="text-muted-foreground tabular-nums">
                {applicable}
              </span>
            </PopoverClose>
          ))}
        </PopoverPopup>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm">
              <Blocks />
              {t('asset-library:bulk.addCategory')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="w-56 p-2">
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const category = categoryDraft.trim();
              if (!category) return;
              onAddCategory(category);
              setCategoryDraft('');
            }}
          >
            <Input
              autoFocus
              value={categoryDraft}
              maxLength={ASSET_CATEGORY_MAX}
              placeholder={t('asset-library:form.categoryPlaceholder')}
              className="h-7 text-xs"
              onChange={(event) => setCategoryDraft(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={!categoryDraft.trim()}>
              {t('asset-library:action.add')}
            </Button>
          </form>
        </PopoverPopup>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm" disabled={categories.length === 0}>
              <Blocks />
              {t('asset-library:bulk.removeCategory')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="max-h-64 w-48 overflow-y-auto">
          {categories.map((category) => (
            <PopoverClose
              key={category}
              className={MENU_ITEM}
              onClick={() => onRemoveCategory(category)}
            >
              <span className="truncate">{category}</span>
            </PopoverClose>
          ))}
        </PopoverPopup>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={collections.length === 0}
            >
              <FolderInput />
              {t('asset-library:bulk.addToCollection')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="max-h-64 w-52 overflow-y-auto">
          {collections.map((collection) => (
            <PopoverClose
              key={collection.id}
              className={MENU_ITEM}
              onClick={() => onAddToCollection(collection.id)}
            >
              <span className="truncate">{collection.name}</span>
            </PopoverClose>
          ))}
        </PopoverPopup>
      </Popover>

      {canRemove ? (
        // 지울 수 있는 것이 없어도 버튼은 보인다 — 숨기면 지우는 기능이 없는
        // 것으로 읽힌다. 꺼 두고 왜 못 지우는지를 적는다.
        <span
          title={
            removableCount === 0
              ? t('asset-library:bulk.removeNone')
              : undefined
          }
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={removableCount === 0}
            onClick={onRemove}
          >
            <Trash2 />
            {t('asset-library:bulk.remove', { count: removableCount })}
          </Button>
        </span>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground ml-auto"
        onClick={onClear}
      >
        <X />
        {t('asset-library:bulk.clear')}
      </Button>
    </div>
  );
}
