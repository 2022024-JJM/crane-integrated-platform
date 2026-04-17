import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInventoryList } from '@crane/features/inventory';
import type { InventoryItem, InventoryStatus, PartCriticality } from '@crane/domain/inventory';
import { Badge } from '@crane/ui/atoms/badge';
import { Pagination } from '@crane/ui/molecules/pagination';
import { cn } from '@crane/core/lib/utils';

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

const STATUS_PILL: Record<InventoryStatus, { color: string; bg: string; activeBg: string; activeText: string }> = {
  normal:       { color: 'text-emerald-400', bg: 'bg-emerald-500/10', activeBg: 'bg-emerald-500', activeText: 'text-white' },
  low:          { color: 'text-amber-400',   bg: 'bg-amber-500/10',   activeBg: 'bg-amber-500',   activeText: 'text-black' },
  out_of_stock: { color: 'text-red-400',     bg: 'bg-red-500/10',     activeBg: 'bg-red-500',     activeText: 'text-white' },
  excess:       { color: 'text-slate-400',   bg: 'bg-slate-500/10',   activeBg: 'bg-slate-500',   activeText: 'text-white' },
  expiry_soon:  { color: 'text-orange-400',  bg: 'bg-orange-500/10',  activeBg: 'bg-orange-500',  activeText: 'text-white' },
};

const CRITICALITY_PILL: Record<PartCriticality, { color: string; bg: string; activeBg: string; activeText: string }> = {
  critical:  { color: 'text-red-400',    bg: 'bg-red-500/10',    activeBg: 'bg-red-500',    activeText: 'text-white' },
  essential: { color: 'text-amber-400',  bg: 'bg-amber-500/10',  activeBg: 'bg-amber-500',  activeText: 'text-black' },
  standard:  { color: 'text-slate-400',  bg: 'bg-slate-500/10',  activeBg: 'bg-slate-500',  activeText: 'text-white' },
};

const FILTER_STATUSES: InventoryStatus[] = ['normal', 'low', 'out_of_stock', 'excess', 'expiry_soon'];
const FILTER_CRITICALITIES: PartCriticality[] = ['critical', 'essential', 'standard'];

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

// 컬럼 폭: 부품명(가변, 최소) · 중요도 · 현재재고 · 재고수준(progress) · 단가 · 리드타임 · 상태
const GRID_TEMPLATE = 'minmax(240px,2.4fr) 90px 100px minmax(140px,1fr) 100px 90px 110px';

function InventoryRow({ item }: { item: InventoryItem }) {
  const { t } = useTranslation('inventory');
  const stockPct = item.minStockQty > 0
    ? Math.min(100, Math.round((item.currentQty / item.minStockQty) * 100))
    : 100;
  const barColor = stockPct <= 0 ? 'bg-red-500' : stockPct < 100 ? 'bg-amber-500' : 'bg-emerald-400';

  return (
    <div
      className="grid items-center gap-3 border-b border-border/40 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      {/* 부품명 / P/N */}
      <div className="min-w-0">
        <p className="truncate font-medium">{item.partName}</p>
        <p className="truncate text-xs text-muted-foreground">{t(`category.${item.category}`)} · {item.partNumber}</p>
      </div>

      {/* 중요도 */}
      <div>
        <Badge variant={CRITICALITY_VARIANT[item.criticality]}>
          {t(`criticality.${item.criticality}`)}
        </Badge>
      </div>

      {/* 현재 재고 */}
      <div className="text-right">
        <span className="font-semibold tabular-nums">{item.currentQty}</span>
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">/ {item.minStockQty}</span>
      </div>

      {/* 재고 수준 progress */}
      <div className="min-w-0">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stockPct}%` }} />
        </div>
        <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">{stockPct}%</p>
      </div>

      {/* 단가 */}
      <div className="text-right tabular-nums">
        ${item.unitPrice.toLocaleString()}
      </div>

      {/* 리드타임 */}
      <div className="text-right tabular-nums text-muted-foreground">
        {item.leadTimeDays}{t('units.days')}
      </div>

      {/* 상태 */}
      <div className="flex justify-end">
        <Badge variant={STATUS_VARIANT[item.status]}>
          {t(`status.${item.status}`)}
        </Badge>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const { items, purchaseOrders, summary } = useInventoryList();
  const { t } = useTranslation('inventory');
  const [statusFilters, setStatusFilters] = useState<Set<InventoryStatus>>(new Set());
  const [critFilters, setCritFilters] = useState<Set<PartCriticality>>(new Set());

  const toggleStatus = (s: InventoryStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };
  const toggleCrit = (c: PartCriticality) => {
    setCritFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const filtered = useMemo(() => items.filter((item) => {
    const matchStatus = statusFilters.size === 0 || statusFilters.has(item.status);
    const matchCrit = critFilters.size === 0 || critFilters.has(item.criticality);
    return matchStatus && matchCrit;
  }), [items, statusFilters, critFilters]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [statusFilters, critFilters, pageSize]);
  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const alertItems = items.filter((i) => ['low', 'out_of_stock'].includes(i.status));
  const [alertOpen, setAlertOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
        <Link
          to="/ticket/create?type=parts"
          className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* 메트릭 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('metrics.totalParts'), value: summary.totalParts, color: 'text-foreground', card: '' },
          { label: t('metrics.belowSafetyStock'), value: summary.lowStock, color: 'text-red-500', card: summary.lowStock > 0 ? 'border-red-500/30 bg-red-500/5' : '' },
          { label: t('metrics.reorderNeeded'), value: summary.reorderNeeded, color: 'text-amber-500', card: summary.reorderNeeded > 0 ? 'border-amber-500/35 bg-amber-500/5' : '' },
          { label: t('metrics.pendingPOs'), value: summary.activePOs, color: 'text-blue-500', card: '' },
        ].map(({ label, value, color, card }) => (
          <div key={label} className={`rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 재고 부족 알림 배너 (접이식) */}
      {alertItems.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5">
          <button
            type="button"
            onClick={() => setAlertOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold text-amber-500 transition-colors hover:bg-amber-500/10"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">
              {t('alert.lowStock', { count: alertItems.length })}
            </span>
            {alertOpen
              ? <ChevronUp className="h-4 w-4 shrink-0" />
              : <ChevronDown className="h-4 w-4 shrink-0" />
            }
          </button>
          {alertOpen && (
            <div className="space-y-2 border-t border-amber-500/30 p-4">
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
        </div>
      )}

      {/* 진행 중 PO (접이식) */}
      {purchaseOrders.length > 0 && (
        <div className="rounded border border-border/90 bg-card/60 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setPoOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold transition-colors hover:bg-muted/30"
          >
            <span className="flex-1 text-left">
              {t('po.title')}
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {purchaseOrders.length}
              </span>
            </span>
            {poOpen
              ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            }
          </button>
          {poOpen && (
            <div className="space-y-2 border-t border-border/70 p-4">
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
          )}
        </div>
      )}

      {/* 필터 (CMMS 멀티셀렉트 pill) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('table.status')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_STATUSES.map((s) => {
              const cfg = STATUS_PILL[s];
              const isActive = statusFilters.has(s);
              const count = items.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
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
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('table.criticality')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CRITICALITIES.map((c) => {
              const cfg = CRITICALITY_PILL[c];
              const isActive = critFilters.has(c);
              const count = items.filter((i) => i.criticality === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCrit(c)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider transition-all cursor-pointer',
                    isActive
                      ? `${cfg.activeBg} ${cfg.activeText} shadow-sm`
                      : `${cfg.bg} ${cfg.color} hover:brightness-110`,
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                  {t(`criticality.${c}`)}
                  <span className={cn('tabular-nums font-mono', isActive ? 'opacity-80' : 'opacity-60')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 부품 테이블 */}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card/50">
        {/* 헤더 */}
        <div
          className="grid items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <span>{t('table.partName')}</span>
          <span>{t('table.criticality')}</span>
          <span className="text-right">{t('table.currentStock')}</span>
          <span>{t('table.stockLevel')}</span>
          <span className="text-right">{t('table.unitPrice', { defaultValue: '단가' })}</span>
          <span className="text-right">{t('table.leadTime')}</span>
          <span className="text-right">{t('table.status')}</span>
        </div>

        {/* 바디 */}
        <div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            paginated.map((item) => <InventoryRow key={item.id} item={item} />)
          )}
        </div>

        {/* 페이지네이션 */}
        {filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: t('pagination.rowsPerPage', { defaultValue: '페이지당' }),
              of: t('pagination.of', { defaultValue: '/' }),
            }}
          />
        )}
      </div>
    </div>
  );
}
