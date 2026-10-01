import { FolderPlus, Star, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_ATTENTION_KINDS,
  ASSET_COLLECTION_NAME_MAX,
  getAssetScope,
  withAssetScope,
  type AssetAttentionKind,
  type AssetCollection,
  type AssetQuery,
  type AssetTreeSiteNode,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Input } from '@crane/ui/atoms/input';
import { AssetAttentionIcon } from './asset-attention';
import { AssetTree } from './asset-tree';

interface AssetFilterRailProps {
  query: AssetQuery;
  /** 탐색 계층(조선소 › 종류 › 분류). */
  tree: readonly AssetTreeSiteNode[];
  /** 이유별로 손이 가야 하는 자산 수. */
  attention: Record<AssetAttentionKind, number>;
  collections: readonly AssetCollection[];
  favoriteCount: number;
  onChange: (query: AssetQuery) => void;
  onCreateCollection: (name: string) => Promise<boolean>;
  onRemoveCollection: (collectionId: string) => void;
}

function RailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="px-3 py-4">
      <div className="mb-1.5 flex h-5 items-center justify-between px-2">
        <h2 className="text-muted-foreground text-xs font-medium">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RailRow({
  active,
  onClick,
  leading,
  label,
  count,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  leading?: ReactNode;
  label: string;
  count?: number;
  trailing?: ReactNode;
}) {
  return (
    <div className="group/row relative flex items-center">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          'focus-visible:ring-ring/50 flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors outline-none focus-visible:ring-2',
          active
            ? 'bg-foreground/8 text-foreground font-semibold'
            : 'text-foreground/75 hover:bg-muted hover:text-foreground',
        )}
      >
        {/* 선택 표시 — 레일 왼쪽 가장자리의 세로 막대. */}
        <span
          aria-hidden
          className={cn(
            'absolute top-2 bottom-2 left-0 w-[3px] rounded-full transition-colors',
            active ? 'bg-(--hanwha-orange-100)' : 'bg-transparent',
          )}
        />
        {leading}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined ? (
          <span
            className={cn(
              'shrink-0 text-xs tabular-nums',
              active ? 'text-foreground/70' : 'text-muted-foreground',
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
      {trailing}
    </div>
  );
}

export function AssetFilterRail({
  query,
  tree,
  attention,
  collections,
  favoriteCount,
  onChange,
  onCreateCollection,
  onRemoveCollection,
}: AssetFilterRailProps) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  // 해당 자산이 없는 이유는 줄을 세우지 않는다 — 0 이 늘어서면 정작 있는
  // 일이 묻힌다. 걸어 둔 필터는 0 이어도 남겨 풀 수 있게 한다.
  const visibleAttention = ASSET_ATTENTION_KINDS.filter(
    (kind) => attention[kind] > 0 || query.attention === kind,
  );

  const submitCollection = async () => {
    const name = draftName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    if (await onCreateCollection(name)) {
      setDraftName('');
      setCreating(false);
    }
  };

  return (
    <nav
      aria-label={t('asset-library:rail.label')}
      className="border-border divide-border flex w-60 shrink-0 flex-col divide-y overflow-y-auto border-r"
    >
      {visibleAttention.length > 0 ? (
        <RailSection title={t('asset-library:rail.attention')}>
          {visibleAttention.map((kind) => (
            <RailRow
              key={kind}
              active={query.attention === kind}
              onClick={() =>
                onChange({
                  ...query,
                  attention: query.attention === kind ? null : kind,
                })
              }
              leading={<AssetAttentionIcon kind={kind} />}
              label={t(`asset-library:attention.${kind}.label`)}
              count={attention[kind]}
            />
          ))}
        </RailSection>
      ) : null}

      <RailSection title={t('asset-library:rail.browse')}>
        <AssetTree
          tree={tree}
          scope={getAssetScope(query)}
          onSelect={(scope) => onChange(withAssetScope(query, scope))}
        />
      </RailSection>

      <RailSection
        title={t('asset-library:rail.collections')}
        action={
          <button
            type="button"
            aria-label={t('asset-library:rail.newCollection')}
            title={t('asset-library:rail.newCollection')}
            onClick={() => setCreating(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 flex size-5 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2"
          >
            <FolderPlus className="size-3.5" />
          </button>
        }
      >
        <RailRow
          active={query.favoritesOnly}
          onClick={() =>
            onChange({ ...query, favoritesOnly: !query.favoritesOnly })
          }
          leading={<Star className="size-3.5 shrink-0" />}
          label={t('asset-library:rail.favorites')}
          count={favoriteCount}
        />
        {collections.map((collection) => (
          <RailRow
            key={collection.id}
            active={query.collectionId === collection.id}
            onClick={() =>
              onChange({
                ...query,
                collectionId:
                  query.collectionId === collection.id ? null : collection.id,
              })
            }
            label={collection.name}
            count={collection.assetIds.length}
            trailing={
              <button
                type="button"
                aria-label={t('asset-library:rail.removeCollection', {
                  name: collection.name,
                })}
                onClick={() => onRemoveCollection(collection.id)}
                className="text-muted-foreground hover:text-destructive focus-visible:ring-ring/50 absolute right-1 hidden size-5 cursor-pointer items-center justify-center rounded outline-none group-hover/row:flex focus-visible:flex focus-visible:ring-2"
              >
                <Trash2 className="size-3" />
              </button>
            }
          />
        ))}
        {creating ? (
          <div className="mt-1 flex items-center gap-1 px-1">
            <Input
              autoFocus
              value={draftName}
              maxLength={ASSET_COLLECTION_NAME_MAX}
              placeholder={t('asset-library:rail.collectionName')}
              className="h-7 text-xs"
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void submitCollection()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitCollection();
                if (event.key === 'Escape') {
                  setDraftName('');
                  setCreating(false);
                }
              }}
            />
          </div>
        ) : null}
      </RailSection>
    </nav>
  );
}
