import { FolderInput, MapPin, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_SITES,
  ASSET_TAG_MAX,
  type AssetCollection,
  type AssetSiteId,
} from '@crane/domain/asset-library';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  Popover,
  PopoverClose,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';

interface AssetBulkBarProps {
  count: number;
  collections: readonly AssetCollection[];
  onAssignSites: (sites: AssetSiteId[]) => void;
  onAddTag: (tag: string) => void;
  onAddToCollection: (collectionId: string) => void;
  onClear: () => void;
}

const MENU_ITEM =
  'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-xs outline-none';

/** 여러 자산을 고른 뒤의 일괄 작업 — 조선소 지정·태그 추가·컬렉션에 담기. */
export function AssetBulkBar({
  count,
  collections,
  onAssignSites,
  onAddTag,
  onAddToCollection,
  onClear,
}: AssetBulkBarProps) {
  const { t } = useTranslation();
  const [tagDraft, setTagDraft] = useState('');

  return (
    <div
      role="toolbar"
      aria-label={t('asset-library:bulk.label')}
      className="border-border bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5"
    >
      <span className="text-foreground text-xs font-medium tabular-nums">
        {t('asset-library:bulk.selected', { count })}
      </span>
      <span aria-hidden className="bg-border h-4 w-px" />

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
