import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInventoryList } from '@crane/features/inventory';
import type {
  InventoryItem,
  InventoryStatus,
  PartCategory,
  PartCriticality,
} from '@crane/domain/inventory';
import { Badge } from '@crane/ui/atoms/badge';
import { Pagination } from '@crane/ui/molecules/pagination';
import { cn } from '@crane/core/lib/utils';
import {
  PILL_INACTIVE,
  TONE_DOT,
  TONE_PILL_ACTIVE,
  TONE_SURFACE,
  TONE_TEXT,
  type Tone,
} from '../../../shared/ui/tone';
import { PartDetailPanel } from './part-detail-panel';

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

const STATUS_TONE: Record<InventoryStatus, Tone> = {
  normal: 'positive',
  low: 'warning',
  out_of_stock: 'critical',
  excess: 'neutral',
  expiry_soon: 'warning',
};

const CRITICALITY_TONE: Record<PartCriticality, Tone> = {
  critical: 'critical',
  essential: 'warning',
  standard: 'neutral',
};

const FILTER_STATUSES: InventoryStatus[] = ['normal', 'low', 'out_of_stock', 'excess', 'expiry_soon'];
const FILTER_CRITICALITIES: PartCriticality[] = ['critical', 'essential', 'standard'];

type CraneFilter = 'all' | 'crane-660t' | 'crane-50t' | 'common';

const CRANE_FILTERS: { key: Exclude<CraneFilter, 'all'>; label: string }[] = [
  { key: 'crane-660t', label: '660T' },
  { key: 'crane-50t', label: '50T' },
  { key: 'common', label: 'common' },
];

// 크레인 적용 칩은 식별용 텍스트 라벨 — 색으로 구분하지 않는다.
function craneBadgeOf(craneIds: string[]): { label: string; cls: string; isCommon: boolean } {
  const has660 = craneIds.includes('crane-660t');
  const has50 = craneIds.includes('crane-50t');
  const cls = 'bg-muted text-muted-foreground';
  if (has660 && has50) return { label: '', cls, isCommon: true };
  if (has660) return { label: '660T', cls, isCommon: false };
  return { label: '50T', cls, isCommon: false };
}

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

// 컬럼 폭: 부품명(가변, 최소) · 중요도 · 현재재고 · 예약 · 가용 · 단위 · 재고수준(progress) · 단가 · 리드타임 · 상태
const GRID_TEMPLATE =
  'minmax(220px,2.2fr) 90px 85px 70px 80px 50px minmax(100px,1fr) 90px 80px 105px';

function InventoryRow({
  item,
  selected,
  onSelect,
}: {
  item: InventoryItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('inventory');
  const stockPct = item.minStockQty > 0
    ? Math.min(100, Math.round((item.currentQty / item.minStockQty) * 100))
    : 100;
  const barColor = stockPct <= 0 ? TONE_DOT.critical : stockPct < 100 ? TONE_DOT.warning : TONE_DOT.positive;

  return (
    <div
      onClick={onSelect}
      className={cn(
        'grid cursor-pointer items-center gap-3 border-b border-border/40 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40',
        selected && 'border-l-2 border-l-primary bg-muted/50',
      )}
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      {/* 부품명 / P/N / 크레인 적용 */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate font-medium">{item.partName}</p>
          {(() => {
            const badge = craneBadgeOf(item.craneIds);
            return (
              <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${badge.cls}`}>
                {badge.isCommon ? t('crane.common') : badge.label}
              </span>
            );
          })()}
        </div>
        <p className="truncate text-xs text-muted-foreground">{t(`category.${item.category}`)} · {item.partNumber} · {item.manufacturer}</p>
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

      {/* 예약 */}
      <div
        className={cn(
          'text-right tabular-nums',
          item.reservedQty > 0 ? TONE_TEXT.warning : 'text-muted-foreground/60',
        )}
      >
        {item.reservedQty}
      </div>

      {/* 가용 (출고 판단 기준) */}
      <div
        className={cn(
          'text-right font-semibold tabular-nums',
          item.availableQty > 0 ? 'text-foreground' : TONE_TEXT.critical,
        )}
      >
        {item.availableQty}
      </div>

      {/* 단위 */}
      <div className="text-center text-xs text-muted-foreground">{item.uom}</div>

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
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>('all');
  const [craneFilter, setCraneFilter] = useState<CraneFilter>('all');

  const categories = useMemo(() => {
    const seen = new Set<PartCategory>();
    const result: PartCategory[] = [];
    for (const item of items) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        result.push(item.category);
      }
    }
    return result;
  }, [items]);

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatus = statusFilters.size === 0 || statusFilters.has(item.status);
      const matchCrit = critFilters.size === 0 || critFilters.has(item.criticality);
      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchCrane =
        craneFilter === 'all' ||
        (craneFilter === 'common'
          ? item.craneIds.length > 1
          : item.craneIds.includes(craneFilter));
      const matchSearch =
        query === '' ||
        item.partName.toLowerCase().includes(query) ||
        item.partNumber.toLowerCase().includes(query) ||
        item.manufacturer.toLowerCase().includes(query);
      return matchStatus && matchCrit && matchCategory && matchCrane && matchSearch;
    });
  }, [items, statusFilters, critFilters, categoryFilter, craneFilter, search]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 필터/검색/페이지 크기 변경 시 1페이지로 리셋 (render-time 상태 조정 패턴)
  const filterKey = [
    [...statusFilters].join(','),
    [...critFilters].join(','),
    categoryFilter,
    craneFilter,
    search,
    pageSize,
  ].join('|');
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const alertItems = items.filter((i) => ['low', 'out_of_stock'].includes(i.status));
  const [alertOpen, setAlertOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);

  // 자산 상세 등에서 ?part=<partId>로 진입 시 해당 부품 패널을 자동으로 연다
  const [searchParams, setSearchParams] = useSearchParams();
  const partParam = searchParams.get('part');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(partParam);
  const [prevPartParam, setPrevPartParam] = useState(partParam);
  if (partParam !== prevPartParam) {
    setPrevPartParam(partParam);
    setSelectedPartId(partParam);
  }

  const selectPart = (partId: string | null) => {
    setSelectedPartId(partId);
    // URL의 part 파라미터도 정리해 딥링크 상태를 남기지 않는다
    if (partParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('part');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-6 p-4 transition-[padding] duration-300 ease-out md:p-6',
        // xl 이상에서만 상세 패널 폭(440px)만큼 본문을 민다 — 그 미만은 패널이 오버레이
        selectedPartId && 'xl:pr-[calc(440px+1.5rem)]',
      )}
    >
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
          { label: t('metrics.totalParts'), value: summary.totalParts, dot: '' },
          { label: t('metrics.belowSafetyStock'), value: summary.lowStock, dot: summary.lowStock > 0 ? TONE_DOT.critical : '' },
          { label: t('metrics.reorderNeeded'), value: summary.reorderNeeded, dot: summary.reorderNeeded > 0 ? TONE_DOT.warning : '' },
          { label: t('metrics.pendingPOs'), value: summary.activePOs, dot: '' },
        ].map(({ label, value, dot }) => (
          <div key={label} className="rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {dot && <span className={cn('size-1.5 rounded-full', dot)} />}
              {label}
            </p>
            <p className="text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 text-foreground">{value}</p>
          </div>
        ))}
      </section>

      {/* 재고 부족 알림 배너 (접이식) */}
      {alertItems.length > 0 && (
        <div className={cn('rounded border', TONE_SURFACE.warning)}>
          <button
            type="button"
            onClick={() => setAlertOpen((v) => !v)}
            className={cn('flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold transition-colors hover:bg-amber-500/10', TONE_TEXT.warning)}
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
            <div className="space-y-2 border-t border-amber-500/25 p-4">
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
                      <span className={cn('text-xs font-semibold tabular-nums', etaPast ? TONE_TEXT.critical : 'text-foreground')}>
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

      {/* 검색 / 카테고리(클러스터) / 크레인 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder', { defaultValue: 'Search part / P/N / manufacturer' })}
            className="h-9 w-72 rounded border border-border bg-card/60 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as PartCategory | 'all')}
          className="h-9 cursor-pointer rounded border border-border bg-card/60 px-2 text-sm outline-none transition-colors focus:border-primary/50"
        >
          <option value="all">{t('categoryAll', { defaultValue: 'All categories' })}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          {CRANE_FILTERS.map(({ key, label }) => {
            const isActive = craneFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCraneFilter(isActive ? 'all' : key)}
                className={cn(
                  'inline-flex cursor-pointer items-center rounded px-3 py-1.5 text-[11px] font-bold tracking-wider transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground',
                )}
              >
                {label === 'common' ? t('crane.common') : label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 필터 (CMMS 멀티셀렉트 pill) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('table.status')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_STATUSES.map((s) => {
              const tone = STATUS_TONE[s];
              const isActive = statusFilters.has(s);
              const count = items.filter((i) => i.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium tracking-wider transition-all cursor-pointer',
                    isActive ? TONE_PILL_ACTIVE[tone] : PILL_INACTIVE,
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
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
              const tone = CRITICALITY_TONE[c];
              const isActive = critFilters.has(c);
              const count = items.filter((i) => i.criticality === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCrit(c)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium tracking-wider transition-all cursor-pointer',
                    isActive ? TONE_PILL_ACTIVE[tone] : PILL_INACTIVE,
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
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
        {/* 좁은 화면에서는 컬럼을 자르지 않고 가로 스크롤로 접근 */}
        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            {/* 헤더 */}
            <div
              className="grid items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span>{t('table.partName')}</span>
              <span>{t('table.criticality')}</span>
              <span className="text-right">{t('table.currentStock')}</span>
              <span className="text-right">{t('table.reserved')}</span>
              <span className="text-right">{t('table.available')}</span>
              <span className="text-center">{t('table.uom')}</span>
              <span>{t('table.stockLevel')}</span>
              <span className="text-right">{t('table.unitPrice', { defaultValue: 'Unit Price' })}</span>
              <span className="text-right">{t('table.leadTime')}</span>
              <span className="text-right">{t('table.status')}</span>
            </div>

            {/* 바디 */}
            {filtered.length > 0 && (
              <div>
                {paginated.map((item) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    selected={item.partId === selectedPartId}
                    onSelect={() =>
                      selectPart(selectedPartId === item.partId ? null : item.partId)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 빈 상태 — 스크롤 래퍼 밖에서 뷰포트 기준 중앙 정렬 */}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        )}

        {/* 페이지네이션 */}
        {filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: t('pagination.rowsPerPage', { defaultValue: 'Rows per page' }),
              of: t('pagination.of', { defaultValue: 'of' }),
            }}
          />
        )}
      </div>

      {selectedPartId && (
        <PartDetailPanel
          partId={selectedPartId}
          onClose={() => selectPart(null)}
        />
      )}
    </div>
  );
}
