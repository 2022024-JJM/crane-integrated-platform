import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { Switch } from '@crane/ui/atoms/switch';
import { cn } from '@crane/core/lib/utils';
import {
  getStorageItem,
  setStorageItem,
} from '@crane/core/lib/safe-storage';
import { NewAssetModal } from './new-asset-modal';

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

function AssetCard({
  asset,
  overdueInspections = 0,
  activeRepairs = 0,
}: {
  asset: CraneAsset;
  overdueInspections?: number;
  activeRepairs?: number;
}) {
  const { t } = useTranslation('asset-management');

  const warrantyEnd = new Date(asset.warrantyEnd);
  const today = new Date('2026-04-14');
  const daysLeft = Math.ceil((warrantyEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

function useLocalCollapsed(key: string, defaultValue = false) {
  const storageKey = `asset-section-collapsed:${key}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = getStorageItem(storageKey);
    return stored !== null ? stored === 'true' : defaultValue;
  });

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev;
      setStorageItem(storageKey, String(next));
      return next;
    });

  return [collapsed, toggle] as const;
}

function AssetSection({
  siteId,
  sectionKey,
  assets,
  allAssets,
  craneInspectionMap,
  craneRepairMap,
  globalCollapsed,
  onLocalToggle,
}: {
  siteId: string;
  sectionKey: 'dock1' | 'dock2' | 'blockShop';
  assets: CraneAsset[];
  allAssets: CraneAsset[];
  craneInspectionMap: Record<string, { overdueCount: number }>;
  craneRepairMap: Record<string, { activeCount: number }>;
  globalCollapsed: boolean | null;
  onLocalToggle: () => void;
}) {
  const { t } = useTranslation('asset-management');
  const siteAssets = assets.filter((a) => a.siteId === siteId);
  const totalSiteAssets = allAssets.filter((a) => a.siteId === siteId).length;

  const [localCollapsed, localToggle] = useLocalCollapsed(siteId);
  const collapsed = globalCollapsed !== null ? globalCollapsed : localCollapsed;

  const handleToggle = () => {
    onLocalToggle();
    localToggle();
  };

  if (totalSiteAssets === 0) return null;

  const isFiltered = siteAssets.length !== totalSiteAssets;

  return (
    <section>
      {/* 섹션 헤더 */}
      <button
        type="button"
        onClick={handleToggle}
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

      {/* 카드 그리드 */}
      {!collapsed && (
        siteAssets.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 pb-4">
            {siteAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                overdueInspections={craneInspectionMap[asset.id]?.overdueCount ?? 0}
                activeRepairs={craneRepairMap[asset.id]?.activeCount ?? 0}
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
  const { assets, summary, craneInspectionMap, craneRepairMap } = useAssetList();
  const { t } = useTranslation('asset-management');

  const [statusFilters, setStatusFilters] = useState<Set<AssetStatus>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [globalCollapsed, setGlobalCollapsed] = useState<boolean | null>(null);
  const allCollapsed = globalCollapsed === true;

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

  const overdueAssetCount = Object.keys(craneInspectionMap).length;
  const repairAssetCount = Object.keys(craneRepairMap).length;
  const criticalCount = overdueAssetCount + repairAssetCount;

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

      {/* 위험도 롤업 배너 */}
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

      {/* 메트릭 카드 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('metrics.totalAssets'), value: summary.total, color: 'text-foreground', card: '' },
          { label: t('metrics.operating'), value: summary.operating, color: 'text-emerald-500', card: '' },
          { label: t('metrics.inspectionRepair'), value: summary.inspection + summary.repair, color: 'text-amber-500', card: (summary.inspection + summary.repair) > 0 ? 'border-amber-500/35 bg-amber-500/5' : '' },
          { label: t('metrics.idle'), value: summary.idle, color: 'text-muted-foreground', card: '' },
        ].map(({ label, value, color, card }) => (
          <div key={label} className={`rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 상태 필터 (CMMS 스타일 멀티셀렉트 pill) + 전체 펼침/접힘 */}
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
            onCheckedChange={(checked) => setGlobalCollapsed(checked ? true : false)}
            aria-label={t('collapse.toggle', { defaultValue: 'Collapse / expand all' })}
          />
        </div>
      </div>

      {/* 섹션별 크레인 카드 */}
      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <AssetSection
            key={section.siteId}
            {...section}
            assets={filteredAssets}
            allAssets={assets}
            craneInspectionMap={craneInspectionMap}
            craneRepairMap={craneRepairMap}
            globalCollapsed={globalCollapsed}
            onLocalToggle={() => setGlobalCollapsed(null)}
          />
        ))}
        {filteredAssets.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
            {t('filter.empty', { defaultValue: 'No assets match the filter.' })}
          </div>
        )}
      </div>

      <NewAssetModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
