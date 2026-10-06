import { Ellipsis, Star } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '@crane/core/config/i18n';
import {
  formatBytes,
  getCurrentAssetVersion,
  resolveVersionSizeBytes,
  type AssetAttentionKind,
  type AssetRecord,
  type AssetStatsTable,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from '@crane/ui/molecules/context-menu';
import {
  ASSET_CARD_GRID,
  ASSET_STATUS_TONE,
  formatRelativeTime,
} from '../lib/asset-presentation';
import { AssetAttentionPill } from './asset-attention';
import { AssetKindIcon } from './asset-badges';
import { AssetThumbnail } from './asset-thumbnail';

/** 카드가 페이지에 알리는 행동. 전부 자산 id 로 부른다. */
export interface AssetCardActions {
  /**
   * 미리보기에 올린다. `toggle` 은 키보드(Space)로 누른 것 — 이미 올라와
   * 있으면 내린다. 마우스는 내리지 않는다(두 번 누름의 첫 클릭과 겹친다).
   */
  onPreview: (assetId: string, toggle: boolean) => void;
  /** 두 번 누름 — 상세로 간다. */
  onOpen: (assetId: string) => void;
  /** `range` 는 Shift 를 누른 채 고른 것(직전 선택부터 여기까지). */
  onToggleSelect: (assetId: string, range: boolean) => void;
  onToggleFavorite: (assetId: string) => void;
  onCopyLink: (assetId: string) => void;
  /**
   * 지우기를 연다. 파일을 다룰 수 있는 환경(dev)에서만 넘어온다 — 없으면
   * 메뉴에 내지 않는다.
   */
  onDelete?: (assetId: string) => void;
}

interface AssetGridProps extends AssetCardActions {
  assets: readonly AssetRecord[];
  statsTable: AssetStatsTable;
  selectedIds: ReadonlySet<string>;
  favorites: ReadonlySet<string>;
  /** 자산 id → 손이 가야 하는 이유(급한 순). */
  attention: ReadonlyMap<string, readonly AssetAttentionKind[]>;
  previewId: string | null;
  /** "얼마 전" 표기의 기준 시각(ms). */
  now: number;
  hrefFor: (assetId: string) => string;
}

interface AssetCardProps extends AssetCardActions {
  asset: AssetRecord;
  statsTable: AssetStatsTable;
  selected: boolean;
  favorite: boolean;
  previewed: boolean;
  /** 가장 급한 이유 하나. 없으면 표식을 그리지 않는다. */
  topAttention: AssetAttentionKind | null;
  now: number;
  href: string;
}

/**
 * 자산 카드. Unity Asset Manager 의 카드 구성을 따른다 — 그림 판 아래에 종류
 * 아이콘·이름·상태 점 한 줄, 그 아래 형식·크기와 "얼마 전" 한 줄. 카드는
 * 무엇인지 알아보는 데까지만 말하고, 수치는 옆 미리보기와 목록 보기가 맡는다.
 *
 * 한 번 누르면 옆 미리보기에 올라가고, 두 번 누르거나 이름을 누르면 상세로
 * 간다. 손이 가야 하는 자산만 그림 위에 표식이 붙는다.
 */
const AssetCard = memo(function AssetCard({
  asset,
  statsTable,
  selected,
  favorite,
  previewed,
  topAttention,
  now,
  href,
  onPreview,
  onOpen,
  onToggleSelect,
  onToggleFavorite,
  onCopyLink,
  onDelete,
}: AssetCardProps) {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const current = getCurrentAssetVersion(asset);
  const sizeBytes = resolveVersionSizeBytes(current, statsTable);
  const status = t(`asset-library:status.${current.status}`);
  const fileFacts = [current.file.format.toUpperCase(), formatBytes(sizeBytes)];
  const overlayVisible =
    'opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100';

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <article
            data-asset-id={asset.id}
            className={cn(
              'group/card relative flex scroll-m-10 flex-col rounded-xl border p-1.5 transition-colors duration-150 select-none',
              previewed
                ? 'border-foreground bg-foreground/10'
                : selected
                  ? 'border-(--hanwha-orange-100) bg-(--hanwha-orange-100)/10'
                  : 'border-border bg-foreground/[0.035] hover:border-foreground/30 hover:bg-foreground/[0.06]',
            )}
          />
        }
      >
        <div className="relative overflow-hidden rounded-lg">
          <AssetThumbnail asset={asset} className="aspect-[4/3] w-full" />
          {topAttention ? (
            <div className="absolute bottom-2 left-2">
              <AssetAttentionPill kind={topAttention} />
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 px-1.5 pt-2.5 pb-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <AssetKindIcon
              kind={asset.kind}
              className="text-muted-foreground size-4"
            />
            <h3 className="text-foreground font-condensed min-w-0 flex-1 truncate text-[15px] leading-tight font-semibold">
              {/* 이름은 상세로 가는 진짜 링크다(새 탭으로도 열린다). 덮개 버튼
                  보다 위에 있어, 이름을 누르면 미리보기가 아니라 상세다. */}
              <AppLink
                to={href}
                className="focus-visible:ring-ring/60 relative z-10 rounded-sm outline-none hover:underline focus-visible:ring-2"
              >
                {asset.name}
              </AppLink>
            </h3>
            {/* 게시된 자산은 아무 표시도 없다 — 그것이 보통이다. 게시 전·철회
                같은 예외만 점과 글자로 알린다. */}
            {current.status === 'published' ? null : (
              <span className="text-muted-foreground relative z-10 flex shrink-0 items-center gap-1.5 text-[11px] leading-none">
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full',
                    ASSET_STATUS_TONE[current.status].dot,
                  )}
                />
                {status}
              </span>
            )}
          </div>
          <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
            <span className="min-w-0 truncate">
              v{current.version} · {fileFacts.join(' · ')}
            </span>
            <span className="shrink-0">
              {formatRelativeTime(asset.updatedAt, now, locale)}
            </span>
          </div>
        </div>

        {/* 카드 전체를 덮는 미리보기 버튼. */}
        <button
          type="button"
          aria-pressed={previewed}
          aria-label={t('asset-library:browser.previewAsset', {
            name: asset.name,
          })}
          onClick={(event) => onPreview(asset.id, event.detail === 0)}
          onDoubleClick={() => onOpen(asset.id)}
          onKeyDown={(event) => {
            // Enter 는 열기, Space 는 미리보기(버튼의 기본 동작).
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onOpen(asset.id);
          }}
          className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-(--hanwha-orange-100)"
        />

        {/* 카드 위 조작 — 덮개보다 위(z-10)에 있다. 왼쪽 위는 선택, 오른쪽
            위는 더 보기와 즐겨찾기. */}
        <div
          className={cn(
            'absolute top-3.5 left-3.5 z-10 transition-opacity',
            selected ? 'opacity-100' : overlayVisible,
          )}
        >
          <Checkbox
            checked={selected}
            aria-label={t('asset-library:browser.selectAsset', {
              name: asset.name,
            })}
            // Shift 를 누른 채 누르면 브라우저가 그 사이 글자를 선택한다.
            onMouseDown={(event) => {
              if (event.shiftKey) event.preventDefault();
            }}
            onClick={(event) => onToggleSelect(asset.id, event.shiftKey)}
            className="bg-background/90"
          />
        </div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          <button
            type="button"
            aria-haspopup="menu"
            aria-label={t('asset-library:menu.more', { name: asset.name })}
            // 우클릭 메뉴를 같은 자리에서 연다 — 메뉴가 있다는 것이 보인다.
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              event.currentTarget.closest('article')?.dispatchEvent(
                new MouseEvent('contextmenu', {
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left,
                  clientY: rect.bottom + 4,
                }),
              );
            }}
            className={cn(
              'bg-background/85 text-muted-foreground hover:text-foreground focus-visible:ring-ring/60 flex size-7 cursor-pointer items-center justify-center rounded-full backdrop-blur-sm transition-opacity outline-none focus-visible:ring-2',
              overlayVisible,
            )}
          >
            <Ellipsis className="size-4" />
          </button>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={t(
              favorite
                ? 'asset-library:browser.unfavorite'
                : 'asset-library:browser.favorite',
              { name: asset.name },
            )}
            onClick={() => onToggleFavorite(asset.id)}
            className={cn(
              'bg-background/85 focus-visible:ring-ring/60 flex size-7 cursor-pointer items-center justify-center rounded-full backdrop-blur-sm transition-opacity outline-none focus-visible:ring-2',
              favorite
                ? 'text-(--hanwha-orange-100) opacity-100'
                : cn(
                    'text-muted-foreground hover:text-foreground',
                    overlayVisible,
                  ),
            )}
          >
            <Star className={cn('size-3.5', favorite && 'fill-current')} />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuPopup className="min-w-44">
        <ContextMenuItem onClick={() => onPreview(asset.id, false)}>
          {t('asset-library:menu.preview')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpen(asset.id)}>
          {t('asset-library:menu.open')}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onToggleSelect(asset.id, false)}>
          {t(
            selected
              ? 'asset-library:menu.deselect'
              : 'asset-library:menu.select',
          )}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onToggleFavorite(asset.id)}>
          {t(
            favorite
              ? 'asset-library:menu.unfavorite'
              : 'asset-library:menu.favorite',
          )}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopyLink(asset.id)}>
          {t('asset-library:menu.copyLink')}
        </ContextMenuItem>
        {onDelete ? (
          // 되돌릴 수 없는 일은 맨 아래에, 다른 항목과 떨어뜨려 둔다.
          <ContextMenuItem
            className="border-border text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive mt-1 rounded-t-none border-t pt-2"
            onClick={() => onDelete(asset.id)}
          >
            {t('asset-library:menu.delete')}
          </ContextMenuItem>
        ) : null}
      </ContextMenuPopup>
    </ContextMenu>
  );
});

export function AssetGrid({
  assets,
  statsTable,
  selectedIds,
  favorites,
  attention,
  previewId,
  now,
  hrefFor,
  onPreview,
  onOpen,
  onToggleSelect,
  onToggleFavorite,
  onCopyLink,
  onDelete,
}: AssetGridProps) {
  return (
    <div className={ASSET_CARD_GRID}>
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          statsTable={statsTable}
          selected={selectedIds.has(asset.id)}
          favorite={favorites.has(asset.id)}
          previewed={previewId === asset.id}
          topAttention={attention.get(asset.id)?.[0] ?? null}
          now={now}
          href={hrefFor(asset.id)}
          onPreview={onPreview}
          onOpen={onOpen}
          onToggleSelect={onToggleSelect}
          onToggleFavorite={onToggleFavorite}
          onCopyLink={onCopyLink}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
