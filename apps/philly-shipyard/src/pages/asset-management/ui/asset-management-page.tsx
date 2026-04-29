import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
} from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import type { AssetHealthSnapshot } from '@crane/features/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { Switch } from '@crane/ui/atoms/switch';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { cn } from '@crane/core/lib/utils';
import { useSectionCollapseGroup } from '@crane/core/lib/use-section-collapse-group';
import { NewAssetModal } from './new-asset-modal';
import { PartHealthBar } from './part-health-bar';

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
  operating:      'border-emerald-500/40 bg-emerald-500/[0.03] hover:border-emerald-500/70',
  inspection:     'border-amber-500/40 bg-amber-500/[0.03] hover:border-amber-500/70',
  repair:         'border-red-500/40 bg-red-500/[0.03] hover:border-red-500/70',
  idle:           'border-slate-500/40 bg-slate-500/[0.03] hover:border-slate-500/70',
  decommissioned: 'border-zinc-600/40 bg-zinc-600/[0.03] hover:border-zinc-600/70',
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

type SortKey = 'priority' | 'name' | 'warranty' | 'lastActivity';

const STATUS_PRIORITY: Record<AssetStatus, number> = {
  repair: 0,
  inspection: 1,
  operating: 2,
  idle: 3,
  decommissioned: 4,
};

const TODAY = new Date('2026-04-14');

function daysFromToday(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.ceil((TODAY.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function formatRelativeDays(iso: string | undefined, t: (k: string, opts?: Record<string, unknown>) => string): string {
  if (!iso) return t('card.noActivity', { defaultValue: 'No activity' });
  const days = daysFromToday(iso);
  if (days <= 0) return t('card.today', { defaultValue: 'Today' });
  if (days === 1) return t('card.yesterday', { defaultValue: 'Yesterday' });
  if (days < 30) return t('card.daysAgo', { count: days, defaultValue: `${days}d ago` });
  const months = Math.floor(days / 30);
  return t('card.monthsAgo', { count: months, defaultValue: `${months}mo ago` });
}

function AssetCard({
  asset,
  overdueInspections = 0,
  activeRepairs = 0,
  health,
  lastActivity,
}: {
  asset: CraneAsset;
  overdueInspections?: number;
  activeRepairs?: number;
  health?: AssetHealthSnapshot;
  lastActivity?: string;
}) {
  const { t } = useTranslation('asset-management');

  const warrantyEnd = new Date(asset.warrantyEnd);
  const daysLeft = Math.ceil((warrantyEnd.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24));
  const warrantyExpired = daysLeft < 0;
  const warrantySoon = daysLeft >= 0 && daysLeft <= 180;

  return (
    <Link
      to={`/asset-management/${asset.id}`}
      className={cn(
        'cursor-pointer group flex flex-col gap-2.5 rounded border p-4 shadow-sm transition-all hover:shadow-md',
        STATUS_CARD_BORDER[asset.status],
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusDot status={STATUS_DOT[asset.status]} />
          <span className="text-sm font-bold truncate">{asset.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={STATUS_TONE[asset.status]}>
            {t(`status.${asset.status}`)}
          </Badge>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground truncate">
          {t(`craneType.${asset.craneType as CraneType}`)} · {asset.capacityTon}T
        </p>
        <p className="text-xs text-muted-foreground truncate">{asset.locationZone}</p>
        <p className="text-xs text-muted-foreground truncate">{asset.manufacturer}</p>
      </div>

      {/* Last activity */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarClock className="size-3" />
        <span>
          {t('card.lastActivity', { defaultValue: 'Last' })}:{' '}
          {formatRelativeDays(lastActivity, t)}
        </span>
      </div>

      {/* Component health bar */}
      {health && (
        <div className="rounded border border-border/60 bg-muted/40 p-2">
          <PartHealthBar
            remainingPct={health.remainingPct}
            componentName={health.componentName}
            componentStatus={health.componentStatus}
          />
        </div>
      )}

      <Badge
        variant={warrantyExpired ? 'destructive' : warrantySoon ? 'warning' : 'secondary'}
        className="w-fit"
      >
        {warrantyExpired
          ? t('card.warrantyExpired')
          : t('card.warrantyUntil', { date: asset.warrantyEnd })}
      </Badge>

      {(overdueInspections > 0 || activeRepairs > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5 border-t border-border/50">
          {overdueInspections > 0 && (
            <Badge variant="destructive" className="font-normal">
              {t('card.overdueInspection', { count: overdueInspections })}
            </Badge>
          )}
          {activeRepairs > 0 && (
            <Badge variant="warning" className="font-normal">
              {t('card.activeRepair')}
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}

function AssetSection({
  siteId,
  sectionKey,
  assets,
  allAssets,
  craneInspectionMap,
  craneRepairMap,
  craneHealthMap,
  craneLastActivityMap,
  collapsed,
  onToggle,
}: {
  siteId: string;
  sectionKey: 'dock1' | 'dock2' | 'blockShop';
  assets: CraneAsset[];
  allAssets: CraneAsset[];
  craneInspectionMap: Record<string, { overdueCount: number }>;
  craneRepairMap: Record<string, { activeCount: number }>;
  craneHealthMap: Record<string, AssetHealthSnapshot>;
  craneLastActivityMap: Record<string, string>;
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
        className="group flex w-full items-center gap-3 mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
      >
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base font-bold text-foreground">{t(`sections.${sectionKey}.title`)}</h2>
          <span className="text-xs text-muted-foreground">{t(`sections.${sectionKey}.subtitle`)}</span>
        </div>
        <div className="flex-1 h-px bg-border/70" />
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {isFiltered
            ? `${siteAssets.length} / ${totalSiteAssets} ${t('units.units')}`
            : `${siteAssets.length} ${t('units.units')}`}
        </Badge>
        <div className="flex items-center justify-center size-6 rounded border border-border bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground shrink-0">
          {collapsed
            ? <ChevronDown className="size-3.5" />
            : <ChevronUp className="size-3.5" />
          }
        </div>
      </button>

      {!collapsed && (
        siteAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 pb-4">
            {siteAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                overdueInspections={craneInspectionMap[asset.id]?.overdueCount ?? 0}
                activeRepairs={craneRepairMap[asset.id]?.activeCount ?? 0}
                health={craneHealthMap[asset.id]}
                lastActivity={craneLastActivityMap[asset.id]}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 pb-4 text-xs text-muted-foreground">
            {t('filter.empty', { defaultValue: 'No assets match the filter.' })}
          </div>
        )
      )}
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
    craneLastActivityMap,
  } = useAssetList();
  const { t } = useTranslation('asset-management');

  const [statusFilters, setStatusFilters] = useState<Set<AssetStatus>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const sectionSiteIds = useMemo(() => SECTIONS.map((s) => s.siteId), []);
  const collapseGroup = useSectionCollapseGroup({
    storagePrefix: 'asset-section-collapsed',
    keys: sectionSiteIds,
  });
  const allCollapsed = collapseGroup.allCollapsed;

  const toggleFilter = (s: AssetStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const filteredAssets = useMemo(
    () => (statusFilters.size === 0
      ? assets
      : assets.filter((a) => statusFilters.has(a.status))),
    [assets, statusFilters],
  );

  const sortedAssets = useMemo(() => {
    const arr = [...filteredAssets];
    switch (sortKey) {
      case 'name':
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case 'warranty':
        return arr.sort(
          (a, b) =>
            new Date(a.warrantyEnd).getTime() - new Date(b.warrantyEnd).getTime(),
        );
      case 'lastActivity':
        return arr.sort((a, b) => {
          const aD = craneLastActivityMap[a.id]
            ? new Date(craneLastActivityMap[a.id]).getTime()
            : 0;
          const bD = craneLastActivityMap[b.id]
            ? new Date(craneLastActivityMap[b.id]).getTime()
            : 0;
          return bD - aD;
        });
      case 'priority':
      default:
        return arr.sort((a, b) => {
          const sevDiff =
            STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
          if (sevDiff !== 0) return sevDiff;
          const aIssues =
            (craneInspectionMap[a.id]?.overdueCount ?? 0) +
            (craneRepairMap[a.id]?.activeCount ?? 0);
          const bIssues =
            (craneInspectionMap[b.id]?.overdueCount ?? 0) +
            (craneRepairMap[b.id]?.activeCount ?? 0);
          return bIssues - aIssues;
        });
    }
  }, [filteredAssets, sortKey, craneInspectionMap, craneRepairMap, craneLastActivityMap]);

  const overdueAssetCount = Object.keys(craneInspectionMap).length;
  const repairAssetCount = Object.keys(craneRepairMap).length;
  const criticalCount = overdueAssetCount + repairAssetCount;

  // ── Top metrics 재정의 ───────────────────────────────────
  const fleetUptimePct =
    summary.total > 0
      ? Math.round((summary.operating / summary.total) * 100)
      : 0;
  const warrantyExpiringSoon = assets.filter((a) => {
    const days = Math.ceil(
      (new Date(a.warrantyEnd).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24),
    );
    return days >= 0 && days <= 180;
  }).length;
  const warrantyExpired = assets.filter(
    (a) => new Date(a.warrantyEnd).getTime() < TODAY.getTime(),
  ).length;
  const criticalHealthCount = Object.values(craneHealthMap).filter(
    (h) => h.componentStatus === 'critical' || h.componentStatus === 'replace',
  ).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          {t('newAsset', { defaultValue: 'New Asset' })}
        </button>
      </div>

      {criticalCount > 0 && (
        <div className="rounded border border-red-500/40 bg-red-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {t('criticalAlert', {
              overdueCount: overdueAssetCount,
              repairCount: repairAssetCount,
              defaultValue: `${overdueAssetCount} overdue inspections · ${repairAssetCount} in repair — immediate action required`,
            })}
          </p>
        </div>
      )}

      {/* Top metrics — 재정의 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label={t('metrics.fleetUptime', { defaultValue: 'Fleet Uptime' })}
          value={`${fleetUptimePct}%`}
          sub={t('metrics.fleetUptimeSub', {
            operating: summary.operating,
            total: summary.total,
            defaultValue: `${summary.operating}/${summary.total} operating`,
          })}
          tone={
            fleetUptimePct >= 80
              ? 'success'
              : fleetUptimePct >= 60
                ? 'warning'
                : 'critical'
          }
        />
        <MetricCard
          label={t('metrics.criticalHealth', { defaultValue: 'Critical Components' })}
          value={criticalHealthCount}
          sub={t('metrics.criticalHealthSub', {
            defaultValue: 'Cranes with critical parts',
          })}
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
          tone={
            warrantyExpired > 0
              ? 'critical'
              : warrantyExpiringSoon > 0
                ? 'warning'
                : 'neutral'
          }
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

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('filter.status', { defaultValue: 'Status' })}
        </span>
        <div className="flex flex-wrap gap-1.5 flex-1">
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
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider transition-all cursor-pointer',
                  isActive
                    ? `${cfg.activeBg} ${cfg.activeText} shadow-sm`
                    : `${cfg.bg} ${cfg.color} hover:brightness-110`,
                )}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                {t(`status.${s}`)}
                <span className={cn('tabular-nums font-mono', isActive ? 'opacity-80' : 'opacity-60')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('sort.label', { defaultValue: 'Sort by' })}
          </span>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger label={t(`sort.${sortKey}`, { defaultValue: sortKey })} />
            <SelectPopup>
              <SelectItem value="priority">
                {t('sort.priority', { defaultValue: 'Priority' })}
              </SelectItem>
              <SelectItem value="name">
                {t('sort.name', { defaultValue: 'Name' })}
              </SelectItem>
              <SelectItem value="warranty">
                {t('sort.warranty', { defaultValue: 'Warranty (oldest)' })}
              </SelectItem>
              <SelectItem value="lastActivity">
                {t('sort.lastActivity', { defaultValue: 'Last activity' })}
              </SelectItem>
            </SelectPopup>
          </Select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allCollapsed
            ? <ChevronsDownUp className="size-3.5 text-muted-foreground" />
            : <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          }
          <span className="text-[11px] text-muted-foreground">
            {allCollapsed
              ? t('collapse.allCollapsed', { defaultValue: 'All collapsed' })
              : t('collapse.allExpanded', { defaultValue: 'All expanded' })}
          </span>
          <Switch
            checked={allCollapsed}
            onCheckedChange={(checked) => collapseGroup.setAll(checked)}
            aria-label={t('collapse.toggle', { defaultValue: 'Collapse / expand all' })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <AssetSection
            key={section.siteId}
            {...section}
            assets={sortedAssets}
            allAssets={assets}
            craneInspectionMap={craneInspectionMap}
            craneRepairMap={craneRepairMap}
            craneHealthMap={craneHealthMap}
            craneLastActivityMap={craneLastActivityMap}
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
        'rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between',
        TONE_CARD[tone],
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1">
        <p
          className={cn(
            'text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums',
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
