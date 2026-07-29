import { useMemo, useRef, useState } from 'react';
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
import { PAGE_CONTAINER, PAGE_SUBTITLE, PAGE_TITLE, TABLE_EMPTY } from '../../../shared/ui/page';
import { SURFACE_CARD, SURFACE_PANEL } from '../../../shared/ui/surface';
import { buttonVariants } from '@crane/ui/atoms/button';
import { FOCUS_RING, searchInputClass } from '../../../shared/ui/controls';
import {
  PILL_INACTIVE,
  TONE_DOT,
  TONE_HOVER_TINT,
  TONE_PILL_ACTIVE,
  TONE_SURFACE,
  TONE_TEXT,
} from '../../../shared/ui/tone';
import {
  CRITICALITY_TONE,
  CRITICALITY_VARIANT,
  INVENTORY_STATUS_TONE as STATUS_TONE,
  INVENTORY_STATUS_VARIANT as STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { formatRelativeDate } from '../../../shared/lib/relative-date';
import { formatDateLabel } from '../../../shared/lib/format-date';
import { PartDetailPanel } from './part-detail-panel';

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
  const craneBadge = craneBadgeOf(item.craneIds);

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
          <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${craneBadge.cls}`}>
            {craneBadge.isCommon ? t('crane.common') : craneBadge.label}
          </span>
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

      {/* 재고 수준 progress — 수치는 '현재 재고' 열에 이미 있으므로 바 하나로만 (100% 도배 방지) */}
      <div className="min-w-0" title={`${item.currentQty} / ${item.minStockQty}`}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stockPct}%` }} />
        </div>
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
  const { t, i18n } = useTranslation('inventory');
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

  const alertItems = useMemo(
    () => items.filter((i) => i.status === 'low' || i.status === 'out_of_stock'),
    [items],
  );
  const [poOpen, setPoOpen] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  // 부족 스트립 클릭 → 부족·재고없음 필터를 걸고 표로 스크롤 (배너 안 목록 복제 대신)
  const showLowStock = () => {
    setStatusFilters(new Set(['low', 'out_of_stock']));
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 열린 패널의 부품은 ?part=<partId> URL 파라미터가 단일 소스 — 자산 BOM·수리 패널 딥링크와
  // 행 클릭이 같은 경로를 쓰고, 로컬 state 동기화가 없어 라우터 transition 렌더와 경쟁하지 않는다.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPartId = searchParams.get('part');

  const selectPart = (partId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (partId) next.set('part', partId);
    else next.delete('part');
    setSearchParams(next, { replace: true });
  };

  return (
    <div
      className={cn(
        PAGE_CONTAINER,
        'transition-[padding] duration-300 ease-out',
        // xl 이상에서만 상세 패널 폭(440px)만큼 본문을 민다 — 그 미만은 패널이 오버레이
        selectedPartId && 'xl:pr-[calc(440px+1.5rem)]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={PAGE_TITLE}>{t('title')}</h1>
          <p className={cn(PAGE_SUBTITLE, 'mt-0.5')}>{t('description')}</p>
        </div>
        <Link
          to="/ticket/create?type=parts"
          className={buttonVariants({ size: 'lg' })}
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* 재고 부족 스트립 — 목록을 배너 안에 복제하지 않고, 클릭하면 표에 필터를 건다 */}
      {alertItems.length > 0 && (
        <button
          type="button"
          onClick={showLowStock}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition-colors',
            TONE_SURFACE.warning,
            TONE_HOVER_TINT.warning,
            TONE_TEXT.warning,
            FOCUS_RING,
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">
            {t('alert.lowStock', { count: alertItems.length })}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium">
            {t('alert.filterHint', { defaultValue: 'Show in table' })}
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          </span>
        </button>
      )}

      {/* 진행 중 PO (접이식) */}
      {purchaseOrders.length > 0 && (
        <div className={SURFACE_CARD}>
          <button
            type="button"
            onClick={() => setPoOpen((v) => !v)}
            className={cn('flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-sm font-bold transition-colors hover:bg-muted/30', FOCUS_RING)}
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
                const { label: etaLabel, overdue: etaPast } = formatRelativeDate(po.expectedDelivery);
                return (
                  <div key={po.id} className="flex items-center gap-4 text-sm">
                    <span className="font-medium shrink-0">{po.poNumber}</span>
                    <span className="text-muted-foreground truncate flex-1">{po.vendor}</span>
                    <span className="shrink-0">
                      <span className={cn('text-xs font-semibold tabular-nums', etaPast ? TONE_TEXT.critical : 'text-foreground')}>
                        {etaLabel}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{formatDateLabel(po.expectedDelivery, i18n.language)}</span>
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
            className={cn(searchInputClass, 'w-72 pl-8 pr-3')}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as PartCategory | 'all')}
          className={cn(searchInputClass, 'cursor-pointer px-2')}
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
                className={cn(FOCUS_RING, 
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
              // 0건 상태는 필터할 것이 없다 — 활성 상태(해제 가능해야 함)만 예외로 남긴다
              if (count === 0 && !isActive) return null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={cn(FOCUS_RING, 
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
                  className={cn(FOCUS_RING, 
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

        {/* pill로 드러나지 않는 요약값만 인라인 — 별도 메트릭 카드 행을 대체 */}
        <div className="ml-auto flex items-center gap-4 self-center text-xs text-muted-foreground">
          <span>
            {t('metrics.totalParts')}{' '}
            <span className="font-semibold tabular-nums text-foreground">{summary.totalParts}</span>
          </span>
          <span>
            {t('metrics.reorderNeeded')}{' '}
            <span className={cn('font-semibold tabular-nums', summary.reorderNeeded > 0 ? TONE_TEXT.warning : 'text-foreground')}>
              {summary.reorderNeeded}
            </span>
          </span>
        </div>
      </div>

      {/* 부품 테이블 */}
      <div ref={tableRef} className={cn(SURFACE_PANEL, 'overflow-hidden scroll-mt-4')}>
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
          <div className={TABLE_EMPTY}>
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
