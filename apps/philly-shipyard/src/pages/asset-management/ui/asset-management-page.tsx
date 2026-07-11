import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Box,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import type { AssetComponentStats, AssetHealthSnapshot } from '@crane/features/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { Pagination } from '@crane/ui/molecules/pagination';
import { cn } from '@crane/core/lib/utils';
import { useSectionCollapseGroup } from '@crane/core/lib/use-section-collapse-group';
import {
  PILL_INACTIVE,
  TONE_DOT,
  TONE_PILL_ACTIVE,
  TONE_SURFACE,
  TONE_TEXT,
  type Tone,
} from '../../../shared/ui/tone';
import { getSiteInfo, SITES } from '../../../shared/config/sites';
import { NewAssetModal } from './new-asset-modal';

const FILTER_STATUSES: AssetStatus[] = ['operating', 'inspection', 'repair', 'idle', 'decommissioned'];

const STATUS_FILTER_TONE: Record<AssetStatus, Tone> = {
  operating: 'positive',
  inspection: 'warning',
  repair: 'critical',
  idle: 'neutral',
  decommissioned: 'neutral',
};

const STATUS_TONE: Record<AssetStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  operating: 'success',
  inspection: 'warning',
  repair: 'destructive',
  idle: 'secondary',
  decommissioned: 'secondary',
};

const STATUS_DOT: Record<AssetStatus, 'normal' | 'warning' | 'critical'> = {
  operating: 'normal',
  inspection: 'warning',
  repair: 'critical',
  idle: 'warning',
  decommissioned: 'critical',
};

// 섹션별 페이지 크기 (100대 확장 대비 — 카드 그리드 유지 + 페이징)
const SECTION_PAGE_SIZE = 10;

const STATUS_PRIORITY: Record<AssetStatus, number> = {
  repair: 0,
  inspection: 1,
  operating: 2,
  idle: 3,
  decommissioned: 4,
};

// 비정상 구성품 상태 → 톤 (심각도 높은 순으로 표시)
const ISSUE_TONES: { key: keyof AssetComponentStats; tone: Tone }[] = [
  { key: 'replace', tone: 'critical' },
  { key: 'critical', tone: 'critical' },
  { key: 'warning', tone: 'warning' },
  { key: 'caution', tone: 'warning' },
];

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function daysBetween(target: Date, from: Date): number {
  return Math.ceil((target.getTime() - from.getTime()) / 86_400_000);
}

function formatRelativeDays(
  iso: string | undefined,
  today: Date,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  if (!iso) return t('card.noActivity', { defaultValue: 'No activity' });
  const days = daysBetween(today, new Date(iso));
  if (days <= 0) return t('card.today', { defaultValue: 'Today' });
  if (days === 1) return t('card.yesterday', { defaultValue: 'Yesterday' });
  if (days < 30) return t('card.daysAgo', { count: days, defaultValue: `${days}d ago` });
  const months = Math.floor(days / 30);
  return t('card.monthsAgo', { count: months, defaultValue: `${months}mo ago` });
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function AssetSummaryCard({
  asset,
  today,
  overdueInspections = 0,
  activeRepairs = 0,
  health,
  componentStats,
  lastActivity,
  nextInspection,
}: {
  asset: CraneAsset;
  today: Date;
  overdueInspections?: number;
  activeRepairs?: number;
  health?: AssetHealthSnapshot;
  componentStats?: AssetComponentStats;
  lastActivity?: string;
  nextInspection?: string;
}) {
  const { t } = useTranslation('asset-management');

  const daysLeft = daysBetween(new Date(asset.warrantyEnd), today);
  const warrantyExpired = daysLeft < 0;
  const warrantySoon = daysLeft >= 0 && daysLeft <= 180;

  const openWo = overdueInspections + activeRepairs;
  const issues = componentStats?.issues ?? 0;
  const healthPct = health?.remainingPct ?? 100;
  const healthTone: Tone =
    healthPct <= 20 ? 'critical' : healthPct <= 50 ? 'warning' : 'positive';

  const nextInspDays = nextInspection ? daysBetween(new Date(nextInspection), today) : null;
  const nextInspOverdue = nextInspDays !== null && nextInspDays < 0;

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-4 rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm transition-all hover:border-border hover:shadow-md',
      )}
    >
      {/* 카드 전체를 덮는 상세 이동 링크 (stretched link) */}
      <Link
        to={`/asset-management/${asset.id}`}
        aria-label={asset.name}
        className="absolute inset-0 z-0 rounded-lg"
      />

      {/* 상단: 아이덴티티 + 보증/이동 (링크 위, 클릭은 링크로 통과) */}
      <div className="pointer-events-none relative z-[1] flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot status={STATUS_DOT[asset.status]} />
            <h3 className="truncate text-base font-bold">{asset.name}</h3>
            <Badge variant={STATUS_TONE[asset.status]} className="shrink-0">
              {t(`status.${asset.status}`)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`craneType.${asset.craneType as CraneType}`)} · {asset.capacityTon}
            {t('units.ton')} · {asset.manufacturer}
            <span className="mx-1.5 text-border">|</span>
            {asset.locationZone}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={`/asset-management/${asset.id}?tab=3d`}
            aria-label={t('card.view3d', { defaultValue: 'View 3D' })}
            title={t('card.view3d', { defaultValue: 'View 3D' })}
            className="pointer-events-auto z-[2] inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-card/80 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Box className="size-3.5" />
            3D
          </Link>
          <Badge
            variant={warrantyExpired ? 'destructive' : warrantySoon ? 'warning' : 'secondary'}
          >
            {warrantyExpired
              ? t('card.warrantyExpired')
              : t('card.warrantyUntil', { date: asset.warrantyEnd })}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
      </div>

      {/* 하단: 운영 지표 타일 */}
      <div className="pointer-events-none relative z-[1] grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {/* 구성품 건강도 */}
        <StatTile label={t('card.health', { defaultValue: 'Component Health' })}>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', TONE_DOT[healthTone])} style={{ width: `${healthPct}%` }} />
            </div>
            <span className={cn('shrink-0 text-sm font-semibold tabular-nums', TONE_TEXT[healthTone])}>
              {healthPct}%
            </span>
          </div>
          <span className="truncate text-[11px] text-muted-foreground">
            {health
              ? `${t('card.worst', { defaultValue: 'Worst' })}: ${health.componentName}`
              : t('card.noData', { defaultValue: 'No data' })}
          </span>
        </StatTile>

        {/* 구성품 상태 카운트 */}
        <StatTile label={t('card.components', { defaultValue: 'Components' })}>
          {issues > 0 ? (
            <>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {t('card.issueCount', { count: issues, defaultValue: `${issues} issues` })}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                {ISSUE_TONES.map(({ key, tone }) => {
                  const n = (componentStats?.[key] ?? 0) as number;
                  if (n === 0) return null;
                  return (
                    <span key={key} className={cn('flex items-center gap-1', TONE_TEXT[tone])}>
                      <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
                      {t(`detail.componentHealth.${key}`)} {n}
                    </span>
                  );
                })}
              </span>
            </>
          ) : (
            <>
              <span className={cn('text-sm font-semibold tabular-nums', TONE_TEXT.positive)}>
                {t('card.allNormal', { defaultValue: 'All Normal' })}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {t('card.totalParts', { count: componentStats?.total ?? 0, defaultValue: `${componentStats?.total ?? 0} parts` })}
              </span>
            </>
          )}
        </StatTile>

        {/* 미결 WO */}
        <StatTile label={t('card.openWo', { defaultValue: 'Open WO' })}>
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm font-semibold tabular-nums',
              openWo > 0 ? TONE_TEXT.warning : 'text-foreground',
            )}
          >
            <Wrench className="size-3.5" />
            {openWo}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {openWo > 0
              ? t('card.woBreakdown', {
                  overdue: overdueInspections,
                  repair: activeRepairs,
                  defaultValue: `${overdueInspections} insp · ${activeRepairs} repair`,
                })
              : t('card.noOpenWo', { defaultValue: 'None open' })}
          </span>
        </StatTile>

        {/* 다음 점검 */}
        <StatTile label={t('card.nextInspection', { defaultValue: 'Next Inspection' })}>
          {nextInspection ? (
            <>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-sm font-semibold tabular-nums',
                  nextInspOverdue ? TONE_TEXT.critical : 'text-foreground',
                )}
              >
                <CalendarClock className="size-3.5" />
                {nextInspOverdue
                  ? `D+${Math.abs(nextInspDays!)}`
                  : nextInspDays === 0
                    ? 'D-Day'
                    : `D-${nextInspDays}`}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {nextInspection}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-muted-foreground">—</span>
              <span className="text-[11px] text-muted-foreground">
                {t('card.lastActivity', { defaultValue: 'Last' })}:{' '}
                {formatRelativeDays(lastActivity, today, t)}
              </span>
            </>
          )}
        </StatTile>
      </div>
    </div>
  );
}

function AssetSection({
  siteId,
  assets,
  allAssets,
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
  assets: CraneAsset[];
  allAssets: CraneAsset[];
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
  const siteAssets = assets.filter((a) => a.siteId === siteId);
  const totalSiteAssets = allAssets.filter((a) => a.siteId === siteId);

  // 필터/검색 결과 변경 시 1페이지로 리셋 (render-time 상태 조정 패턴)
  const [page, setPage] = useState(1);
  const listKey = siteAssets.map((a) => a.id).join(',');
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

  const overdueAssetCount = Object.keys(craneInspectionMap).length;
  const repairAssetCount = Object.keys(craneRepairMap).length;
  const criticalCount = overdueAssetCount + repairAssetCount;

  const fleetUptimePct =
    summary.total > 0 ? Math.round((summary.operating / summary.total) * 100) : 0;
  const warrantyExpiringSoon = assets.filter((a) => {
    const days = daysBetween(new Date(a.warrantyEnd), today);
    return days >= 0 && days <= 180;
  }).length;
  const warrantyExpired = assets.filter(
    (a) => new Date(a.warrantyEnd).getTime() < today.getTime(),
  ).length;
  const criticalHealthCount = Object.values(craneHealthMap).filter(
    (h) => h.componentStatus === 'critical' || h.componentStatus === 'replace',
  ).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
          tone={fleetUptimePct >= 80 ? 'success' : fleetUptimePct >= 60 ? 'warning' : 'critical'}
        />
        <MetricCard
          label={t('metrics.criticalHealth', { defaultValue: 'Critical Components' })}
          value={criticalHealthCount}
          sub={t('metrics.criticalHealthSub', { defaultValue: 'Cranes with critical parts' })}
          tone={criticalHealthCount > 0 ? 'critical' : 'success'}
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
          tone={overdueAssetCount + repairAssetCount > 0 ? 'warning' : 'success'}
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
            className="h-9 w-64 rounded border border-border bg-card/60 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
          />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('filter.status', { defaultValue: 'Status' })}
        </span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {FILTER_STATUSES.map((s) => {
            const tone = STATUS_FILTER_TONE[s];
            const isActive = statusFilters.has(s);
            const count = assets.filter((a) => a.status === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleFilter(s)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-[11px] font-medium tracking-wider transition-all',
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
            assets={sortedAssets}
            allAssets={assets}
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
          <div className="rounded-lg border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
            {t('filter.empty', { defaultValue: 'No assets match the filter.' })}
          </div>
        )}
      </div>

      <NewAssetModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

/**
 * KPI 카드 — 숫자는 항상 뉴트럴 잉크. 주의가 필요한 상태(critical/warning)만
 * 라벨 옆 도트로 표시한다.
 */
function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'success' | 'warning' | 'critical' | 'neutral';
}) {
  const alertTone: Tone | null =
    tone === 'critical' ? 'critical' : tone === 'warning' ? 'warning' : null;
  return (
    <div className="flex min-h-24 flex-col justify-between rounded border border-border/90 bg-card/80 p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {alertTone && <span className={cn('size-1.5 rounded-full', TONE_DOT[alertTone])} />}
        {label}
      </p>
      <div className="mt-2 space-y-1">
        <p className="text-[1.8rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
