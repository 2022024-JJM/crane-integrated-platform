import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '@crane/core/config/i18n';
import {
  formatBytes,
  formatCount,
  formatDimensions,
  getCurrentAssetVersion,
  resolveVersionSizeBytes,
  resolveVersionStats,
  toMeterSize,
  type AssetAttentionKind,
  type AssetRecord,
  type AssetStatsTable,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Checkbox } from '@crane/ui/atoms/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import { formatAssetDate } from '../lib/asset-presentation';
import { AssetAttentionIcon } from './asset-attention';
import { AssetKindIcon, AssetStatusBadge } from './asset-badges';
import { AssetThumbnail } from './asset-thumbnail';

interface AssetTableProps {
  assets: readonly AssetRecord[];
  statsTable: AssetStatsTable;
  selectedIds: ReadonlySet<string>;
  placements: ReadonlyMap<string, number>;
  /** 자산 id → 손이 가야 하는 이유(급한 순). */
  attention: ReadonlyMap<string, readonly AssetAttentionKind[]>;
  previewId: string | null;
  /**
   * 종류별 열. `geometry` 는 3D 자산의 값(삼각형·치수·배치), `document` 는
   * 도면·CAD 의 값(도면 번호·리비전)이다. 둘 다 없는 종류(배경)는 `basic` —
   * 공통 열만 둔다. 섞인 목록은 `geometry` 로 본다.
   */
  columns: 'geometry' | 'document' | 'basic';
  /** 종류 열을 보일지 — 한 종류만 보는 위치에서는 뺀다. */
  showKind: boolean;
  hrefFor: (assetId: string) => string;
  /** 줄을 한 번 누름 — 옆 미리보기에 올린다. */
  onPreview: (assetId: string, toggle: boolean) => void;
  /** 줄을 두 번 누름 — 상세로 간다. */
  onOpen: (assetId: string) => void;
  /** `range` 는 Shift 를 누른 채 고른 것. */
  onToggleSelect: (assetId: string, range: boolean) => void;
  onToggleSelectAll: () => void;
}

export function AssetTable({
  assets,
  statsTable,
  selectedIds,
  placements,
  attention,
  previewId,
  columns,
  showKind,
  hrefFor,
  onPreview,
  onOpen,
  onToggleSelect,
  onToggleSelectAll,
}: AssetTableProps) {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const allSelected =
    assets.length > 0 && assets.every((asset) => selectedIds.has(asset.id));

  return (
    <Table className="w-full text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="w-9">
            <Checkbox
              checked={allSelected}
              aria-label={t('asset-library:browser.selectAll')}
              onCheckedChange={onToggleSelectAll}
            />
          </TableHead>
          <TableHead>{t('asset-library:field.name')}</TableHead>
          {showKind ? (
            <TableHead className="w-20">
              {t('asset-library:field.kind')}
            </TableHead>
          ) : null}
          <TableHead className="w-44">{t('asset-library:field.tags')}</TableHead>
          <TableHead className="w-40">
            {t('asset-library:field.status')}
          </TableHead>
          <TableHead className="w-16 text-right">
            {t('asset-library:field.version')}
          </TableHead>
          <TableHead className="w-16">
            {t('asset-library:field.format')}
          </TableHead>
          <TableHead className="w-24 text-right">
            {t('asset-library:field.size')}
          </TableHead>
          {columns === 'document' ? (
            <>
              <TableHead className="w-36">
                {t('asset-library:field.drawingNo')}
              </TableHead>
              <TableHead className="w-20">
                {t('asset-library:field.revision')}
              </TableHead>
            </>
          ) : columns === 'basic' ? null : (
            <>
              <TableHead className="w-20 text-right">
                {t('asset-library:field.triangles')}
              </TableHead>
              <TableHead className="hidden w-48 text-right 2xl:table-cell">
                {t('asset-library:titleBlock.size')}
              </TableHead>
              <TableHead className="w-14 text-right">
                {t('asset-library:browser.placed')}
              </TableHead>
            </>
          )}
          <TableHead className="w-28 text-right">
            {t('asset-library:field.updated')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => {
          const current = getCurrentAssetVersion(asset);
          const stats = resolveVersionStats(current, statsTable);
          const selected = selectedIds.has(asset.id);
          const previewed = previewId === asset.id;
          const reasons = attention.get(asset.id) ?? [];
          return (
            <TableRow
              key={asset.id}
              data-asset-id={asset.id}
              data-state={selected ? 'selected' : undefined}
              aria-selected={previewed}
              // 줄 어디를 눌러도 미리보기에 올린다. 체크박스·이름 링크는 자기
              // 일을 하고 여기까지 올라오지 않는다.
              // 줄에 초점을 줄 수 있다 — Space 는 미리보기, Enter 는 상세.
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === ' ') {
                  event.preventDefault();
                  onPreview(asset.id, true);
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  onOpen(asset.id);
                }
              }}
              onClick={() => onPreview(asset.id, false)}
              onDoubleClick={() => onOpen(asset.id)}
              className={cn(
                'focus-visible:ring-ring/60 scroll-m-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset',
                previewed &&
                  'bg-foreground/6 hover:bg-foreground/6 shadow-[inset_3px_0_0_var(--foreground)]',
              )}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={selected}
                  aria-label={t('asset-library:browser.selectAsset', {
                    name: asset.name,
                  })}
                  onMouseDown={(event) => {
                    if (event.shiftKey) event.preventDefault();
                  }}
                  onClick={(event) => onToggleSelect(asset.id, event.shiftKey)}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2.5">
                  <AssetThumbnail
                    asset={asset}
                    className="border-border size-9 shrink-0 rounded border"
                  />
                  <span className="min-w-0">
                    <AppLink
                      to={hrefFor(asset.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="text-foreground font-condensed focus-visible:ring-ring/60 block truncate rounded-sm text-sm leading-tight font-semibold outline-none hover:underline focus-visible:ring-2"
                    >
                      {asset.name}
                    </AppLink>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {current.file.fileName}
                    </span>
                  </span>
                </div>
              </TableCell>
              {showKind ? (
                <TableCell>
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <AssetKindIcon kind={asset.kind} />
                    {t(`asset-library:kind.${asset.kind}`)}
                  </span>
                </TableCell>
              ) : null}
              <TableCell
                className="text-muted-foreground max-w-44 truncate"
                title={asset.tags.join(', ')}
              >
                {asset.tags.join(', ') || '—'}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <AssetStatusBadge status={current.status} variant="inline" />
                  {reasons.length > 0 ? (
                    <span
                      className="flex items-center gap-1"
                      title={reasons
                        .map((kind) =>
                          t(`asset-library:attention.${kind}.label`),
                        )
                        .join(', ')}
                    >
                      {reasons.map((kind) => (
                        <AssetAttentionIcon key={kind} kind={kind} />
                      ))}
                      <span className="sr-only">
                        {reasons
                          .map((kind) =>
                            t(`asset-library:attention.${kind}.label`),
                          )
                          .join(', ')}
                      </span>
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                v{current.version}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {current.file.format.toUpperCase()}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBytes(resolveVersionSizeBytes(current, statsTable))}
              </TableCell>
              {columns === 'document' ? (
                <>
                  <TableCell className="max-w-36 truncate tabular-nums">
                    {asset.drawingNo || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {current.revision || '—'}
                  </TableCell>
                </>
              ) : columns === 'basic' ? null : (
                <>
                  <TableCell className="text-right tabular-nums">
                    {stats ? formatCount(stats.triangles) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-right tabular-nums 2xl:table-cell">
                    {stats?.size
                      ? formatDimensions(
                          toMeterSize(stats.size, asset.defaultScale),
                        )
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {placements.get(asset.id) ?? 0}
                  </TableCell>
                </>
              )}
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {formatAssetDate(asset.updatedAt, locale)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
