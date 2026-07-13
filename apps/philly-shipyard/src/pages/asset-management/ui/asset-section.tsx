import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AssetComponentStats, AssetHealthSnapshot } from '@crane/features/asset';
import type { CraneAsset } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { Pagination } from '@crane/ui/molecules/pagination';
import { getSiteInfo } from '../../../shared/config/sites';
import { AssetSummaryCard } from './asset-summary-card';

// 섹션별 페이지 크기 (100대 확장 대비 — 카드 그리드 유지 + 페이징)
const SECTION_PAGE_SIZE = 10;

export function AssetSection({
  siteId,
  siteAssets,
  totalSiteAssets,
  today,
  craneInspectionMap,
  craneRepairMap,
  craneHealthMap,
  craneComponentStatsMap,
  craneLastActivityMap,
  craneNextInspectionMap,
  collapsed,
  onToggle,
}: {
  siteId: string;
  /** 필터/정렬이 적용된 해당 사이트 자산 (부모에서 그룹핑) */
  siteAssets: CraneAsset[];
  /** 필터 미적용 해당 사이트 전체 자산 (부모에서 그룹핑) */
  totalSiteAssets: CraneAsset[];
  today: Date;
  craneInspectionMap: Record<string, { overdueCount: number }>;
  craneRepairMap: Record<string, { activeCount: number }>;
  craneHealthMap: Record<string, AssetHealthSnapshot>;
  craneComponentStatsMap: Record<string, AssetComponentStats>;
  craneLastActivityMap: Record<string, string>;
  craneNextInspectionMap: Record<string, string>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('asset-management');

  // 필터/검색 결과 변경 시 1페이지로 리셋 (render-time 상태 조정 패턴)
  const [page, setPage] = useState(1);
  const listKey = useMemo(() => siteAssets.map((a) => a.id).join(','), [siteAssets]);
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (listKey !== prevListKey) {
    setPrevListKey(listKey);
    setPage(1);
  }

  if (totalSiteAssets.length === 0) return null;

  const isFiltered = siteAssets.length !== totalSiteAssets.length;

  // 사이트 카탈로그 미등록 사이트는 자산의 siteName으로 폴백 표기
  const siteInfo = getSiteInfo(siteId);
  const fallbackName =
    siteInfo?.fallbackName ?? totalSiteAssets[0]?.siteName ?? siteId;
  const title = siteInfo
    ? t(`sections.${siteInfo.i18nKey}.title`, { defaultValue: fallbackName })
    : fallbackName;
  const subtitle = siteInfo
    ? t(`sections.${siteInfo.i18nKey}.subtitle`, { defaultValue: '' })
    : '';

  const pageStart = (page - 1) * SECTION_PAGE_SIZE;
  const paginated = siteAssets.slice(pageStart, pageStart + SECTION_PAGE_SIZE);

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="group mb-4 flex w-full cursor-pointer items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="h-5 w-1 shrink-0 rounded-full bg-primary" />
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <div className="h-px flex-1 bg-border/70" />
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {isFiltered
            ? `${siteAssets.length} / ${totalSiteAssets.length} ${t('units.units')}`
            : `${siteAssets.length} ${t('units.units')}`}
        </Badge>
        <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
          {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </div>
      </button>

      {!collapsed &&
        (siteAssets.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 pb-2 xl:grid-cols-2">
              {paginated.map((asset) => (
                <AssetSummaryCard
                  key={asset.id}
                  asset={asset}
                  today={today}
                  overdueInspections={craneInspectionMap[asset.id]?.overdueCount ?? 0}
                  activeRepairs={craneRepairMap[asset.id]?.activeCount ?? 0}
                  health={craneHealthMap[asset.id]}
                  componentStats={craneComponentStatsMap[asset.id]}
                  lastActivity={craneLastActivityMap[asset.id]}
                  nextInspection={craneNextInspectionMap[asset.id]}
                />
              ))}
            </div>
            {siteAssets.length > SECTION_PAGE_SIZE && (
              <Pagination
                page={page}
                pageSize={SECTION_PAGE_SIZE}
                total={siteAssets.length}
                onPageChange={setPage}
                labels={{
                  rowsPerPage: t('pagination.rowsPerPage', { defaultValue: 'Rows per page' }),
                  of: t('pagination.of', { defaultValue: 'of' }),
                }}
              />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-8 pb-4 text-xs text-muted-foreground">
            {t('filter.empty', { defaultValue: 'No assets match the filter.' })}
          </div>
        ))}
    </section>
  );
}
