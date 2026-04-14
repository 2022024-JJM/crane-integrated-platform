import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import type { AssetStatus, CraneAsset, CraneType } from '@crane/domain/asset';
import { Badge } from '@crane/ui/atoms/badge';
import { StatusDot } from '@crane/ui/atoms/status-dot';

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
      className="cursor-pointer group flex flex-col gap-2.5 rounded-[1.75rem] border border-border/90 bg-card/70 p-4 shadow-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
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

function AssetSection({
  siteId,
  sectionKey,
  assets,
  craneInspectionMap,
  craneRepairMap,
}: {
  siteId: string;
  sectionKey: 'dock1' | 'dock2' | 'blockShop';
  assets: CraneAsset[];
  craneInspectionMap: Record<string, { overdueCount: number }>;
  craneRepairMap: Record<string, { activeCount: number }>;
}) {
  const { t } = useTranslation('asset-management');
  const siteAssets = assets.filter((a) => a.siteId === siteId);
  if (siteAssets.length === 0) return null;

  return (
    <section className="pb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-primary shrink-0" />
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base font-bold text-foreground">{t(`sections.${sectionKey}.title`)}</h2>
          <span className="text-xs text-muted-foreground">{t(`sections.${sectionKey}.subtitle`)}</span>
        </div>
        <div className="flex-1 h-px bg-border/70" />
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {siteAssets.length} {t('units.units')}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 py-1">
        {siteAssets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            overdueInspections={craneInspectionMap[asset.id]?.overdueCount ?? 0}
            activeRepairs={craneRepairMap[asset.id]?.activeCount ?? 0}
          />
        ))}
      </div>
    </section>
  );
}

export function AssetManagementPage() {
  const { assets, summary, craneInspectionMap, craneRepairMap } = useAssetList();
  const { t } = useTranslation('asset-management');

  const overdueAssetCount = Object.keys(craneInspectionMap).length;
  const repairAssetCount = Object.keys(craneRepairMap).length;
  const criticalCount = overdueAssetCount + repairAssetCount;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
      </div>

      {/* 위험도 롤업 배너 */}
      {criticalCount > 0 && (
        <div className="rounded-[1.75rem] border border-red-500/40 bg-red-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {t('criticalAlert', {
              overdueCount: overdueAssetCount,
              repairCount: repairAssetCount,
              defaultValue: `점검 지연 ${overdueAssetCount}대 · 수리 진행 ${repairAssetCount}대 — 즉각적인 조치 필요`,
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
          <div key={label} className={`rounded-2xl border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 섹션별 크레인 카드 */}
      <div className="flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <AssetSection
            key={section.siteId}
            {...section}
            assets={assets}
            craneInspectionMap={craneInspectionMap}
            craneRepairMap={craneRepairMap}
          />
        ))}
      </div>
    </div>
  );
}
