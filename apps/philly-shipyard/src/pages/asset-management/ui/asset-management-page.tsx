import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Plus, Search } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import type { AssetStatus, CraneAsset } from '@crane/domain/asset';
import { cn } from '@crane/core/lib/utils';
import { TABLE_EMPTY, PAGE_TITLE, PAGE_SUBTITLE, PAGE_CONTAINER } from '../../../shared/ui/page';
import { buttonVariants } from '@crane/ui/atoms/button';
import { useSectionCollapseGroup } from '@crane/core/lib/use-section-collapse-group';
import {
  PILL_INACTIVE,
  TONE_DOT,
  TONE_PILL_ACTIVE,
  TONE_SURFACE,
  TONE_TEXT,
} from '../../../shared/ui/tone';
import { FOCUS_RING, searchInputClass } from '../../../shared/ui/controls';
import { SITES } from '../../../shared/config/sites';
import { ASSET_STATUS_TONE as STATUS_FILTER_TONE } from '../../../shared/ui/status-variants';
import { daysBetween, parseLocalDate, startOfToday } from '../../../shared/lib/relative-date';
import { NewAssetModal } from './new-asset-modal';
import { AssetSection } from './asset-section';
import { MetricCard } from '../../../shared/ui/metric-card';

const FILTER_STATUSES: AssetStatus[] = ['operating', 'inspection', 'repair', 'idle', 'decommissioned'];

const STATUS_PRIORITY: Record<AssetStatus, number> = {
  repair: 0,
  inspection: 1,
  operating: 2,
  idle: 3,
  decommissioned: 4,
};

// 사이트 그룹핑에서 빠진 siteId용 안정 참조 빈 배열 (렌더마다 새 배열 생성 방지)
const EMPTY_ASSETS: CraneAsset[] = [];

/** siteId → 자산 배열 그룹핑 */
function groupBySite(list: CraneAsset[]): Record<string, CraneAsset[]> {
  const map: Record<string, CraneAsset[]> = {};
  for (const a of list) (map[a.siteId] ??= []).push(a);
  return map;
}

export function AssetManagementPage() {
  const {
    assets,
    summary,
    craneInspectionMap,
    craneRepairMap,
    craneHealthMap,
    craneComponentStatsMap,
    craneLastActivityMap,
    craneNextInspectionMap,
  } = useAssetList();
  const { t } = useTranslation('asset-management');
  const today = useMemo(() => startOfToday(), []);

  const [statusFilters, setStatusFilters] = useState<Set<AssetStatus>>(new Set());
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // 섹션은 하드코딩 대신 사이트 카탈로그 + 실제 자산 siteId에서 파생
  // (카탈로그 순서 우선, 미등록 사이트는 뒤에 추가 — 사이트 확장 = 데이터 변경만)
  const sectionSiteIds = useMemo(() => {
    const present = [...new Set(assets.map((a) => a.siteId))];
    const known = SITES.map((s) => s.id).filter((id) => present.includes(id));
    const unknown = present.filter((id) => !known.includes(id));
    return [...known, ...unknown];
  }, [assets]);

  const collapseGroup = useSectionCollapseGroup({
    storagePrefix: 'asset-section-collapsed',
    keys: sectionSiteIds,
  });

  const toggleFilter = (s: AssetStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((a) => {
      const matchStatus = statusFilters.size === 0 || statusFilters.has(a.status);
      const matchSearch =
        query === '' ||
        a.name.toLowerCase().includes(query) ||
        a.serialNumber.toLowerCase().includes(query) ||
        a.model.toLowerCase().includes(query) ||
        a.manufacturer.toLowerCase().includes(query) ||
        a.locationZone.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [assets, statusFilters, search]);

  // 우선순위(상태 심각도 → 미결 이슈 수) 고정 정렬
  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      const sevDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (sevDiff !== 0) return sevDiff;
      const aIssues =
        (craneInspectionMap[a.id]?.overdueCount ?? 0) +
        (craneRepairMap[a.id]?.activeCount ?? 0);
      const bIssues =
        (craneInspectionMap[b.id]?.overdueCount ?? 0) +
        (craneRepairMap[b.id]?.activeCount ?? 0);
      return bIssues - aIssues;
    });
  }, [filteredAssets, craneInspectionMap, craneRepairMap]);

  // 섹션별 그룹핑 — AssetSection 내부의 렌더마다 filter 재계산 제거
  const { assetsBySite, allBySite } = useMemo(
    () => ({ assetsBySite: groupBySite(sortedAssets), allBySite: groupBySite(assets) }),
    [sortedAssets, assets],
  );

  // KPI/알림 파생값 — 자산 배열 순회는 한 번씩만 (렌더마다 재계산 방지)
  const {
    overdueAssetCount,
    repairAssetCount,
    criticalCount,
    fleetUptimePct,
    warrantyExpiringSoon,
    warrantyExpired,
    criticalHealthCount,
  } = useMemo(() => {
    const overdue = Object.keys(craneInspectionMap).length;
    const repair = Object.keys(craneRepairMap).length;
    let soon = 0;
    let expired = 0;
    for (const a of assets) {
      const days = daysBetween(parseLocalDate(a.warrantyEnd), today);
      if (days < 0) expired += 1;
      else if (days <= 180) soon += 1;
    }
    return {
      overdueAssetCount: overdue,
      repairAssetCount: repair,
      criticalCount: overdue + repair,
      fleetUptimePct:
        summary.total > 0 ? Math.round((summary.operating / summary.total) * 100) : 0,
      warrantyExpiringSoon: soon,
      warrantyExpired: expired,
      criticalHealthCount: Object.values(craneHealthMap).filter(
        (h) => h.componentStatus === 'critical' || h.componentStatus === 'replace',
      ).length,
    };
  }, [assets, summary, craneInspectionMap, craneRepairMap, craneHealthMap, today]);

  // 상태별 자산 수 — 필터 pill 카운트용 (한 번의 순회로 집계)
  const statusCounts = useMemo(() => {
    const counts = {
      operating: 0,
      inspection: 0,
      repair: 0,
      idle: 0,
      decommissioned: 0,
    } satisfies Record<AssetStatus, number>;
    for (const a of assets) counts[a.status] += 1;
    return counts;
  }, [assets]);

  return (
    <div className={PAGE_CONTAINER}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={PAGE_TITLE}>{t('title')}</h1>
          <p className={cn(PAGE_SUBTITLE, 'mt-0.5')}>{t('description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(buttonVariants({ size: 'lg' }), 'hover:bg-primary/80')}
        >
          <Plus className="size-4" />
          {t('newAsset', { defaultValue: 'New Asset' })}
        </button>
      </div>

      {criticalCount > 0 && (
        <div className={cn('flex items-center gap-3 rounded border px-5 py-3', TONE_SURFACE.critical)}>
          <AlertCircle className={cn('h-4 w-4 shrink-0', TONE_TEXT.critical)} />
          <p className={cn('text-sm font-medium', TONE_TEXT.critical)}>
            {t('criticalAlert', {
              overdueCount: overdueAssetCount,
              repairCount: repairAssetCount,
              defaultValue: `${overdueAssetCount} overdue inspections · ${repairAssetCount} in repair — immediate action required`,
            })}
          </p>
        </div>
      )}

      {/* Top metrics */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label={t('metrics.fleetUptime', { defaultValue: 'Fleet Uptime' })}
          value={`${fleetUptimePct}%`}
          sub={t('metrics.fleetUptimeSub', {
            operating: summary.operating,
            total: summary.total,
            defaultValue: `${summary.operating}/${summary.total} operating`,
          })}
          tone={fleetUptimePct >= 80 ? 'positive' : fleetUptimePct >= 60 ? 'warning' : 'critical'}
        />
        <MetricCard
          label={t('metrics.criticalHealth', { defaultValue: 'Critical Components' })}
          value={criticalHealthCount}
          sub={t('metrics.criticalHealthSub', { defaultValue: 'Cranes with critical parts' })}
          tone={criticalHealthCount > 0 ? 'critical' : 'positive'}
        />
        <MetricCard
          label={t('metrics.warrantyAlert', { defaultValue: 'Warranty Alert' })}
          value={warrantyExpired + warrantyExpiringSoon}
          sub={t('metrics.warrantyAlertSub', {
            expired: warrantyExpired,
            soon: warrantyExpiringSoon,
            defaultValue: `${warrantyExpired} expired · ${warrantyExpiringSoon} soon`,
          })}
          tone={warrantyExpired > 0 ? 'critical' : warrantyExpiringSoon > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label={t('metrics.openWorkOrders', { defaultValue: 'Open Work Orders' })}
          value={overdueAssetCount + repairAssetCount}
          sub={t('metrics.openWorkOrdersSub', {
            overdue: overdueAssetCount,
            repair: repairAssetCount,
            defaultValue: `${overdueAssetCount} overdue · ${repairAssetCount} repair`,
          })}
          tone={overdueAssetCount + repairAssetCount > 0 ? 'warning' : 'positive'}
        />
      </section>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filter.search', { defaultValue: 'Search name / S/N / model' })}
            className={cn(searchInputClass, 'w-64 pl-8 pr-3')}
          />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('filter.status', { defaultValue: 'Status' })}
        </span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {FILTER_STATUSES.map((s) => {
            const tone = STATUS_FILTER_TONE[s];
            const isActive = statusFilters.has(s);
            const count = statusCounts[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleFilter(s)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-[11px] font-medium tracking-wider transition-all',
                  FOCUS_RING,
                  isActive ? TONE_PILL_ACTIVE[tone] : PILL_INACTIVE,
                )}
              >
                <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
                {t(`status.${s}`)}
                <span className={cn('font-mono tabular-nums', isActive ? 'opacity-80' : 'opacity-60')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {sectionSiteIds.map((siteId) => (
          <AssetSection
            key={siteId}
            siteId={siteId}
            siteAssets={assetsBySite[siteId] ?? EMPTY_ASSETS}
            totalSiteAssets={allBySite[siteId] ?? EMPTY_ASSETS}
            today={today}
            craneInspectionMap={craneInspectionMap}
            craneRepairMap={craneRepairMap}
            craneHealthMap={craneHealthMap}
            craneComponentStatsMap={craneComponentStatsMap}
            craneLastActivityMap={craneLastActivityMap}
            craneNextInspectionMap={craneNextInspectionMap}
            collapsed={collapseGroup.isCollapsed(siteId)}
            onToggle={() => collapseGroup.toggle(siteId)}
          />
        ))}
        {sortedAssets.length === 0 && (
          <div className={cn(TABLE_EMPTY, 'rounded-lg border border-dashed border-border/70')}>
            {t('filter.empty', { defaultValue: 'No assets match the filter.' })}
          </div>
        )}
      </div>

      <NewAssetModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
