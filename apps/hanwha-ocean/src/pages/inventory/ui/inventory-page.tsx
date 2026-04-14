import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInventoryList } from '@crane/features/inventory';
import type { InventoryItem, InventoryStatus, PartCriticality } from '@crane/domain/inventory';
import { Badge } from '@crane/ui/atoms/badge';

const STATUS_VARIANT: Record<InventoryStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  normal: 'success',
  low: 'warning',
  out_of_stock: 'destructive',
  excess: 'secondary',
  expiry_soon: 'warning',
};

const CRITICALITY_VARIANT: Record<PartCriticality, 'destructive' | 'warning' | 'secondary'> = {
  critical: 'destructive',
  essential: 'warning',
  standard: 'secondary',
};

type FilterStatus = 'all' | 'low' | 'out_of_stock';
type FilterCriticality = 'all' | PartCriticality;

function formatRelativeDate(dateStr: string): { label: string; isOverdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { label: 'D-Day', isOverdue: false };
  if (diff > 0) return { label: `D-${diff}`, isOverdue: false };
  return { label: `D+${Math.abs(diff)}`, isOverdue: true };
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const { t } = useTranslation('inventory');
  const stockPct = item.minStockQty > 0
    ? Math.min(100, Math.round((item.currentQty / item.minStockQty) * 100))
    : 100;
  const barColor = stockPct <= 0 ? 'bg-red-500' : stockPct < 100 ? 'bg-amber-500' : 'bg-emerald-400';

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3.5 rounded-xl border border-border/90 bg-card/70 text-sm">
      <div className="min-w-0">
        <p className="font-medium truncate">{item.partName}</p>
        <p className="text-xs text-muted-foreground">{t(`category.${item.category}`)} · {item.partNumber}</p>
      </div>
      <Badge variant={CRITICALITY_VARIANT[item.criticality]} className="shrink-0">
        {t(`criticality.${item.criticality}`)}
      </Badge>
      <div className="text-right shrink-0">
        <p className="tabular-nums font-medium">{item.currentQty}</p>
        <p className="text-xs text-muted-foreground">min {item.minStockQty}</p>
      </div>
      <div className="w-20 shrink-0 space-y-1">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stockPct}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">{stockPct}%</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-medium tabular-nums">${item.unitPrice.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">{t('table.unitPriceSuffix', { defaultValue: '/ 개' })}</p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{item.leadTimeDays}{t('units.days')} {t('table.leadTimeSuffix')}</span>
      <Badge variant={STATUS_VARIANT[item.status]} className="shrink-0">
        {t(`status.${item.status}`)}
      </Badge>
    </div>
  );
}

export function InventoryPage() {
  const { items, purchaseOrders, summary } = useInventoryList();
  const { t } = useTranslation('inventory');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCriticality, setFilterCriticality] = useState<FilterCriticality>('all');

  const filtered = items.filter((item) => {
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'low' && ['low', 'out_of_stock'].includes(item.status)) ||
      item.status === filterStatus;
    const matchCrit = filterCriticality === 'all' || item.criticality === filterCriticality;
    return matchStatus && matchCrit;
  });

  const alertItems = items.filter((i) => ['low', 'out_of_stock'].includes(i.status));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
      </div>

      {/* 메트릭 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('metrics.totalParts'), value: summary.totalParts, color: 'text-foreground', card: '' },
          { label: t('metrics.belowSafetyStock'), value: summary.lowStock, color: 'text-red-500', card: summary.lowStock > 0 ? 'border-red-500/30 bg-red-500/5' : '' },
          { label: t('metrics.reorderNeeded'), value: summary.reorderNeeded, color: 'text-amber-500', card: summary.reorderNeeded > 0 ? 'border-amber-500/35 bg-amber-500/5' : '' },
          { label: t('metrics.pendingPOs'), value: summary.activePOs, color: 'text-blue-500', card: '' },
        ].map(({ label, value, color, card }) => (
          <div key={label} className={`rounded-2xl border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 재고 부족 알림 배너 */}
      {alertItems.length > 0 && (
        <div className="rounded-[1.75rem] border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-500">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t('alert.lowStock', { count: alertItems.length })}
          </p>
          {alertItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <Badge variant={STATUS_VARIANT[item.status]} className="shrink-0">
                {t(`status.${item.status}`)}
              </Badge>
              <span className="truncate flex-1">{item.partName}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {item.currentQty} / {item.minStockQty} (min)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 진행 중 PO */}
      {purchaseOrders.length > 0 && (
        <div className="rounded-[1.75rem] border border-border/90 bg-card/60 p-4 shadow-sm backdrop-blur-sm space-y-3">
          <h2 className="text-sm font-bold">{t('po.title')}</h2>
          <div className="space-y-2">
            {purchaseOrders.map((po) => {
              const { label: etaLabel, isOverdue: etaPast } = formatRelativeDate(po.expectedDelivery);
              return (
                <div key={po.id} className="flex items-center gap-4 text-sm">
                  <span className="font-medium shrink-0">{po.poNumber}</span>
                  <span className="text-muted-foreground truncate flex-1">{po.vendor}</span>
                  <span className="shrink-0">
                    <span className={`text-xs font-semibold tabular-nums ${etaPast ? 'text-red-500' : 'text-foreground'}`}>
                      {etaLabel}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">{po.expectedDelivery}</span>
                  </span>
                  <Badge
                    variant={po.status === 'in_transit' ? 'warning' : 'secondary'}
                    className="shrink-0"
                  >
                    {t(`po.status.${po.status}`)}
                  </Badge>
                  <span className="font-medium tabular-nums shrink-0">${po.totalAmount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'low', 'out_of_stock'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? t('filter.all') : s === 'low' ? t('filter.low') : t('status.out_of_stock')}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'critical', 'essential', 'standard'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilterCriticality(c)}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterCriticality === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {c === 'all' ? t('criticality.all') : t(`criticality.${c}`)}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>{t('table.partName')}</span>
        <span>{t('table.criticality')}</span>
        <span>{t('table.currentStock')}</span>
        <span>{t('table.stockLevel')}</span>
        <span>{t('table.unitPrice', { defaultValue: '단가' })}</span>
        <span>{t('table.leadTime')}</span>
        <span>{t('table.status')}</span>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          filtered.map((item) => <InventoryRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
