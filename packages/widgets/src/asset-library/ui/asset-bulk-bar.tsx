import {
  ArrowRightCircle,
  FolderInput,
  FolderTree,
  MapPin,
  Tag,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_CATEGORY_MAX,
  ASSET_SITES,
  ASSET_TAG_MAX,
  type AssetCollection,
  type AssetSiteId,
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
  /** 고른 자산들이 가진 태그(많은 순). 빼기 메뉴에 쓴다. */
  tags: readonly string[];
  /** 같은 종류에 이미 있는 분류 — 분류 지정의 추천. */
  categories: readonly string[];
  transitions: readonly BulkTransition[];
  /** 고른 것 중 지울 수 있는(이 화면에서 등록한) 자산 수. */
  removableCount: number;
  onAssignSites: (sites: AssetSiteId[]) => void;
  onAssignCategory: (category: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddToCollection: (collectionId: string) => void;
  onTransition: (to: AssetVersionStatus) => void;
  onRemove: () => void;
  onClear: () => void;
}

const MENU_ITEM =
  'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-xs outline-none';
const CATEGORY_LIST_ID = 'asset-bulk-category-options';

/**
 * 여러 자산을 고른 뒤의 일괄 작업 — 상태 전환·조선소·분류·태그·컬렉션·삭제.
 * 메뉴는 고른 자산에 실제로 걸리는 것만 낸다(걸리는 수를 옆에 적는다).
 */
export function AssetBulkBar({
  count,
  collections,
  tags,
  categories,
  transitions,
  removableCount,
  onAssignSites,
  onAssignCategory,
  onAddTag,
  onRemoveTag,
  onAddToCollection,
  onTransition,
  onRemove,
  onClear,
}: AssetBulkBarProps) {
  const { t } = useTranslation();
  const [tagDraft, setTagDraft] = useState('');
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
              <MapPin />
              {t('asset-library:bulk.assignSite')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="w-44">
          {ASSET_SITES.map((site) => (
            <PopoverClose
              key={site}
              className={MENU_ITEM}
              onClick={() => onAssignSites([site])}
            >
              {t(`asset-library:site.${site}`)}
            </PopoverClose>
          ))}
          <PopoverClose
            className={MENU_ITEM}
            onClick={() => onAssignSites([...ASSET_SITES])}
          >
            {t('asset-library:bulk.bothSites')}
          </PopoverClose>
          <PopoverClose className={MENU_ITEM} onClick={() => onAssignSites([])}>
            {t('asset-library:site.common')}
          </PopoverClose>
        </PopoverPopup>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm">
              <FolderTree />
              {t('asset-library:bulk.assignCategory')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="w-60 p-2">
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              onAssignCategory(categoryDraft.trim());
              setCategoryDraft('');
            }}
          >
            <Input
              autoFocus
              value={categoryDraft}
              maxLength={ASSET_CATEGORY_MAX}
              list={CATEGORY_LIST_ID}
              aria-label={t('asset-library:field.category')}
              placeholder={t('asset-library:bulk.categoryPlaceholder')}
              className="h-7 text-xs"
              onChange={(event) => setCategoryDraft(event.target.value)}
            />
            <datalist id={CATEGORY_LIST_ID}>
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <Button type="submit" size="sm">
              {t('asset-library:action.apply')}
            </Button>
          </form>
        </PopoverPopup>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm">
              <Tag />
              {t('asset-library:bulk.addTag')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="w-56 p-2">
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              const tag = tagDraft.trim();
              if (!tag) return;
              onAddTag(tag);
              setTagDraft('');
            }}
          >
            <Input
              autoFocus
              value={tagDraft}
              maxLength={ASSET_TAG_MAX}
              placeholder={t('asset-library:form.tagPlaceholder')}
              className="h-7 text-xs"
              onChange={(event) => setTagDraft(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={!tagDraft.trim()}>
              {t('asset-library:action.add')}
            </Button>
          </form>
        </PopoverPopup>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm" disabled={tags.length === 0}>
              <Tags />
              {t('asset-library:bulk.removeTag')}
            </Button>
          }
        />
        <PopoverPopup align="start" className="max-h-64 w-48 overflow-y-auto">
          {tags.map((tag) => (
            <PopoverClose
              key={tag}
              className={MENU_ITEM}
              onClick={() => onRemoveTag(tag)}
            >
              <span className="truncate">{tag}</span>
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

      {removableCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 />
          {t('asset-library:bulk.remove', { count: removableCount })}
        </Button>
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
