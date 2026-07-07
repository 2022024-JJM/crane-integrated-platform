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
  Wrench,
} from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import type { AssetComponentStats, AssetHealthSnapshot } from '@crane/features/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';
import { useSectionCollapseGroup } from '@crane/core/lib/use-section-collapse-group';
import { NewAssetModal } from './new-asset-modal';
import { Crane3dViewer } from './crane-3d-viewer';

const FILTER_STATUSES: AssetStatus[] = ['operating', 'inspection', 'repair', 'idle', 'decommissioned'];

const STATUS_FILTER_CONFIG: Record<AssetStatus, {
  color: string;
  bg: string;
  activeBg: string;
  activeText: string;
}> = {
  operating:      { color: 'text-emerald-400', bg: 'bg-emerald-500/10', activeBg: 'bg-emerald-500', activeText: 'text-white' },
  inspection:     { color: 'text-amber-400',   bg: 'bg-amber-500/10',   activeBg: 'bg-amber-500',   activeText: 'text-black' },
  repair:         { color: 'text-red-400',     bg: 'bg-red-500/10',     activeBg: 'bg-red-500',     activeText: 'text-white' },
  idle:           { color: 'text-slate-400',   bg: 'bg-slate-500/10',   activeBg: 'bg-slate-500',   activeText: 'text-white' },
  decommissioned: { color: 'text-zinc-500',    bg: 'bg-zinc-600/10',    activeBg: 'bg-zinc-700',    activeText: 'text-white' },
};

const STATUS_CARD_BORDER: Record<AssetStatus, string> = {
  operating:      'border-emerald-500/40 hover:border-emerald-500/70',
  inspection:     'border-amber-500/40 hover:border-amber-500/70',
  repair:         'border-red-500/50 hover:border-red-500/80',
  idle:           'border-slate-500/40 hover:border-slate-500/70',
  decommissioned: 'border-zinc-600/40 hover:border-zinc-600/70',
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

const SECTIONS: { siteId: string; sectionKey: 'dock1' | 'dock2' | 'blockShop' }[] = [
  { siteId: 'dock-1', sectionKey: 'dock1' },
  { siteId: 'dock-2', sectionKey: 'dock2' },
  { siteId: 'dock-in', sectionKey: 'blockShop' },
];

const STATUS_PRIORITY: Record<AssetStatus, number> = {
  repair: 0,
  inspection: 1,
  operating: 2,
  idle: 3,
  decommissioned: 4,
};

// 비정상 구성품 상태 → 색상 (심각도 높은 순으로 표시)
const ISSUE_TONES: { key: keyof AssetComponentStats; color: string; dot: string }[] = [
  { key: 'replace', color: 'text-red-500', dot: 'bg-red-500' },
  { key: 'critical', color: 'text-red-500', dot: 'bg-red-500' },
  { key: 'warning', color: 'text-amber-500', dot: 'bg-amber-500' },
  { key: 'caution', color: 'text-amber-400', dot: 'bg-amber-400' },
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
  const [show3d, setShow3d] = useState(false);

  const daysLeft = daysBetween(new Date(asset.warrantyEnd), today);
  const warrantyExpired = daysLeft < 0;
  const warrantySoon = daysLeft >= 0 && daysLeft <= 180;

  const openWo = overdueInspections + activeRepairs;
  const issues = componentStats?.issues ?? 0;
  const healthPct = health?.remainingPct ?? 100;
  const healthBar =
    healthPct <= 20 ? 'bg-red-500' : healthPct <= 50 ? 'bg-amber-500' : 'bg-emerald-500';
  const healthText =
    healthPct <= 20 ? 'text-red-500' : healthPct <= 50 ? 'text-amber-500' : 'text-emerald-500';

  const nextInspDays = nextInspection ? daysBetween(new Date(nextInspection), today) : null;
  const nextInspOverdue = nextInspDays !== null && nextInspDays < 0;

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col gap-4 rounded-lg border bg-card/70 p-5 shadow-sm transition-all hover:shadow-md',
        STATUS_CARD_BORDER[asset.status],
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
          <button
            type="button"
            onClick={() => setShow3d((v) => !v)}
            aria-label={t(show3d ? 'card.hide3d' : 'card.view3d', {
              defaultValue: show3d ? 'Hide 3D' : 'View 3D',
            })}
            aria-pressed={show3d}
            title={t(show3d ? 'card.hide3d' : 'card.view3d', {
              defaultValue: show3d ? 'Hide 3D' : 'View 3D',
            })}
            className={cn(
              'pointer-events-auto z-[2] inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
              show3d
                ? 'border-primary/60 bg-primary/10 text-foreground'
                : 'border-border bg-card/80 text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <Box className="size-3.5" />
            3D
          </button>
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
              <div className={cn('h-full rounded-full', healthBar)} style={{ width: `${healthPct}%` }} />
            </div>
            <span className={cn('shrink-0 text-sm font-semibold tabular-nums', healthText)}>
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
                {ISSUE_TONES.map(({ key, color, dot }) => {
                  const n = (componentStats?.[key] ?? 0) as number;
                  if (n === 0) return null;
                  return (
                    <span key={key} className={cn('flex items-center gap-1', color)}>
                      <span className={cn('size-1.5 rounded-full', dot)} />
                      {t(`detail.componentHealth.${key}`)} {n}
                    </span>
                  );
                })}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold tabular-nums text-emerald-500">
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
              openWo > 0 ? 'text-amber-500' : 'text-foreground',
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
                  nextInspOverdue ? 'text-red-500' : 'text-foreground',
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

      {show3d && (
        <div className="pointer-events-auto relative z-[5]">
          <Crane3dViewer craneType={asset.craneType} />
        </div>
      )}
    </div>
  );
}

function AssetSection({
  siteId,
  sectionKey,
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
  sectionKey: 'dock1' | 'dock2' | 'blockShop';
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
  const totalSiteAssets = allAssets.filter((a) => a.siteId === siteId).length;

  if (totalSiteAssets === 0) return null;

  const isFiltered = siteAssets.length !== totalSiteAssets;

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="group mb-4 flex w-full cursor-pointer items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="h-5 w-1 shrink-0 rounded-full bg-primary" />
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-base font-bold text-foreground">{t(`sections.${sectionKey}.title`)}</h2>
          <span className="text-xs text-muted-foreground">{t(`sections.${sectionKey}.subtitle`)}</span>
        </div>
        <div className="h-px flex-1 bg-border/70" />
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {isFiltered
            ? `${siteAssets.length} / ${totalSiteAssets} ${t('units.units')}`
            : `${siteAssets.length} ${t('units.units')}`}
        </Badge>
        <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
          {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </div>
      </button>

      {!collapsed &&
        (siteAssets.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 pb-2 xl:grid-cols-2">
            {siteAssets.map((asset) => (
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
  const [modalOpen, setModalOpen] = useState(false);
  const sectionSiteIds = useMemo(() => SECTIONS.map((s) => s.siteId), []);
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

  const filteredAssets = useMemo(
    () =>
      statusFilters.size === 0
        ? assets
        : assets.filter((a) => statusFilters.has(a.status)),
    [assets, statusFilters],
  );

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
        <div className="flex items-center gap-3 rounded border border-red-500/40 bg-red-500/5 px-5 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
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
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('filter.status', { defaultValue: 'Status' })}
        </span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {FILTER_STATUSES.map((s) => {
            const cfg = STATUS_FILTER_CONFIG[s];
            const isActive = statusFilters.has(s);
            const count = assets.filter((a) => a.status === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleFilter(s)}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-[11px] font-bold tracking-wider transition-all',
                  isActive
                    ? `${cfg.activeBg} ${cfg.activeText} shadow-sm`
                    : `${cfg.bg} ${cfg.color} hover:brightness-110`,
                )}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
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
        {SECTIONS.filter((section) =>
          assets.some((a) => a.siteId === section.siteId),
        ).map((section) => (
          <AssetSection
            key={section.siteId}
            {...section}
            assets={sortedAssets}
            allAssets={assets}
            today={today}
            craneInspectionMap={craneInspectionMap}
            craneRepairMap={craneRepairMap}
            craneHealthMap={craneHealthMap}
            craneComponentStatsMap={craneComponentStatsMap}
            craneLastActivityMap={craneLastActivityMap}
            craneNextInspectionMap={craneNextInspectionMap}
            collapsed={collapseGroup.isCollapsed(section.siteId)}
            onToggle={() => collapseGroup.toggle(section.siteId)}
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

const TONE_TEXT: Record<'success' | 'warning' | 'critical' | 'neutral', string> = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
  neutral: 'text-foreground',
};

const TONE_CARD: Record<'success' | 'warning' | 'critical' | 'neutral', string> = {
  success: '',
  warning: 'border-amber-500/35 bg-amber-500/5',
  critical: 'border-red-500/40 bg-red-500/5',
  neutral: '',
};

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
  return (
    <div
      className={cn(
        'flex min-h-24 flex-col justify-between rounded border border-border/90 bg-card/80 p-4 shadow-sm',
        TONE_CARD[tone],
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1">
        <p
          className={cn(
            'text-[1.8rem] font-semibold leading-none tracking-tight tabular-nums',
            TONE_TEXT[tone],
          )}
        >
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
