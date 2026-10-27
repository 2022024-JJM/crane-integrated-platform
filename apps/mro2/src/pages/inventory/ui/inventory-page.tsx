import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useInventoryList } from '@crane/features/inventory';
import type {
  InventoryItem,
  InventoryStatus,
  PartCriticality,
} from '@crane/domain/inventory';
import { KC, usd } from '../../../shared/ui/kc';
import {
  KcButton,
  KcEmpty,
  KcFilterChip,
  KcFilterGroup,
  KcFilterRail,
  KcSectionHeading,
} from '../../../shared/ui/kc-ui';
import {
  downloadCsv,
  toCsv,
  type CsvColumn,
} from '../../../shared/lib/export-csv';
import { fmtDate } from '../../../shared/lib/service-status';
import {
  EMPTY_FILTER,
  badgeEmphasis,
  countBy,
  filterInventory,
  isLowOrOut,
  sortByRisk,
  stockPct,
  type CraneFilter,
  type InventoryFilter,
} from '../lib/inventory-rows';
import { PartDetailPanel } from './part-detail-panel';

const STATUS_COLOR: Record<InventoryStatus, string> = {
  normal: KC.ok,
  low: KC.production,
  out_of_stock: KC.safety,
  excess: KC.planned,
  expiry_soon: KC.undetermined,
};
const STATUS_ON: Record<InventoryStatus, string> = {
  normal: KC.onOk,
  low: KC.onProduction,
  out_of_stock: KC.onSafety,
  excess: KC.onPlanned,
  expiry_soon: KC.onUndetermined,
};
const STATUS_KEY: Record<InventoryStatus, string> = {
  normal: 'statusNormal',
  low: 'statusLow',
  out_of_stock: 'statusOut',
  excess: 'statusExcess',
  expiry_soon: 'statusExpiry',
};
const STATUSES = Object.keys(STATUS_KEY) as InventoryStatus[];
const CRITICALITIES: PartCriticality[] = ['critical', 'essential', 'standard'];
const CRIT_COLOR: Record<PartCriticality, string> = {
  critical: KC.safety,
  essential: KC.production,
  standard: KC.planned,
};
const CRANES: { key: Exclude<CraneFilter, 'all'>; label: string }[] = [
  { key: 'crane-660t', label: '660T' },
  { key: 'crane-50t', label: '50T' },
  { key: 'common', label: '' },
];

const CSV_COLUMNS: CsvColumn<InventoryItem>[] = [
  { header: 'Part', value: (i) => i.partName },
  { header: 'Part Number', value: (i) => i.partNumber },
  { header: 'Criticality', value: (i) => i.criticality },
  { header: 'Qty', value: (i) => i.currentQty },
  { header: 'Reserved', value: (i) => i.reservedQty },
  { header: 'Available', value: (i) => i.availableQty },
  { header: 'Min Stock', value: (i) => i.minStockQty },
  { header: 'Reorder Point', value: (i) => i.reorderPoint },
  { header: 'Unit Price (USD)', value: (i) => i.unitPrice },
  { header: 'Lead Time (days)', value: (i) => i.leadTimeDays },
  { header: 'Bin', value: (i) => i.locationBin },
  { header: 'Manufacturer', value: (i) => i.manufacturer },
  { header: 'Status', value: (i) => i.status },
];

function craneTag(craneIds: string[], common: string): string {
  const a = craneIds.includes('crane-660t');
  const b = craneIds.includes('crane-50t');
  return a && b ? common : a ? '660T' : b ? '50T' : '';
}

/**
 * 재고·부품 — 상태·중요도·크레인 칩에 건수(0건 숨김), 부족 스트립(클릭=필터+스크롤),
 * 진행 중 발주 접이식, 재고 수준 바. 빨강은 품절+위험 부품에만 채운다.
 */
export function Mro2InventoryPage() {
  const { t } = useTranslation('mro2');
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, purchaseOrders, summary } = useInventoryList();
  const [filter, setFilter] = useState<InventoryFilter>(EMPTY_FILTER);
  const [poOpen, setPoOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const selectedPartId = searchParams.get('part');

  const statusCount = useMemo(() => countBy(items, (i) => i.status), [items]);
  const critCount = useMemo(
    () => countBy(items, (i) => i.criticality),
    [items],
  );
  const lowCount = useMemo(() => items.filter(isLowOrOut).length, [items]);
  const reorderCount = useMemo(
    () => items.filter((i) => i.availableQty <= i.reorderPoint).length,
    [items],
  );
  const sorted = useMemo(
    () => sortByRisk(filterInventory(items, filter)),
    [items, filter],
  );

  const toggleIn = <K extends 'status' | 'criticality'>(
    key: K,
    v: InventoryFilter[K] extends ReadonlySet<infer U> ? U : never,
  ) =>
    setFilter((f) => {
      const next = new Set(f[key] as ReadonlySet<unknown>);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return { ...f, [key]: next };
    });
  const showLowStock = () => {
    setFilter((f) => ({
      ...f,
      status: new Set<InventoryStatus>(['low', 'out_of_stock']),
    }));
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openPart = (partId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('part', partId);
    setSearchParams(next);
  };
  const closePart = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('part');
    next.delete('ptab');
    setSearchParams(next);
  };
  const selectedCount =
    filter.status.size +
    filter.criticality.size +
    (filter.crane === 'all' ? 0 : 1) +
    (filter.reorderOnly ? 1 : 0);
  const th = 'py-1.5 pr-2 font-normal whitespace-nowrap';

  return (
    <div className="flex gap-6 pt-2">
      <div className="hidden lg:block">
        <KcFilterRail
          selectedCount={selectedCount}
          onClear={() => setFilter(EMPTY_FILTER)}
        >
          <input
            value={filter.query}
            onChange={(e) =>
              setFilter((f) => ({ ...f, query: e.target.value }))
            }
            placeholder={t('common.searchParts')}
            className="w-full rounded-[4px] border px-2 py-1.5 text-[13px]"
            style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
          />
          <KcFilterGroup title={t('inventory.statusTitle')}>
            {STATUSES.filter(
              (s) => (statusCount[s] ?? 0) > 0 || filter.status.has(s),
            ).map((s) => (
              <KcFilterChip
                key={s}
                label={`${t(`inventory.${STATUS_KEY[s]}`)} ${statusCount[s] ?? 0}`}
                tone={STATUS_COLOR[s]}
                active={filter.status.has(s)}
                onClick={() => toggleIn('status', s)}
              />
            ))}
          </KcFilterGroup>
          <KcFilterGroup title={t('inventory.criticality')}>
            {CRITICALITIES.filter(
              (c) => (critCount[c] ?? 0) > 0 || filter.criticality.has(c),
            ).map((c) => (
              <KcFilterChip
                key={c}
                label={`${t(`inventory.crit.${c}`)} ${critCount[c] ?? 0}`}
                tone={CRIT_COLOR[c]}
                active={filter.criticality.has(c)}
                onClick={() => toggleIn('criticality', c)}
              />
            ))}
          </KcFilterGroup>
          <KcFilterGroup title={t('inventory.detail.cranes')}>
            {CRANES.map(({ key, label }) => (
              <KcFilterChip
                key={key}
                label={label || t('inventory.detail.cranesCommon')}
                active={filter.crane === key}
                onClick={() =>
                  setFilter((f) => ({
                    ...f,
                    crane: f.crane === key ? 'all' : key,
                  }))
                }
              />
            ))}
          </KcFilterGroup>
        </KcFilterRail>
      </div>

      <div
        className={`min-w-0 flex-1 ${selectedPartId ? 'xl:pr-[calc(380px+1rem)]' : ''}`}
      >
        <KcSectionHeading
          right={
            <KcButton
              variant="teal"
              onClick={() =>
                downloadCsv('inventory.csv', toCsv(sorted, CSV_COLUMNS))
              }
            >
              <Download size={12} /> {t('sr.exportCsv')}
            </KcButton>
          }
        >
          {t('inventory.title')}
        </KcSectionHeading>
        <div
          className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]"
          style={{ color: KC.muted }}
        >
          <span>
            {t('inventory.subtitle', {
              customer: t('common.customerName'),
              count: items.length,
              value: usd(summary.totalValue),
            })}
          </span>
          <button
            type="button"
            onClick={() =>
              setFilter((f) => ({ ...f, reorderOnly: !f.reorderOnly }))
            }
            className="cursor-pointer font-semibold underline-offset-2 hover:underline"
            style={{ color: filter.reorderOnly ? KC.teal : KC.ink }}
          >
            {t('inventory.reorderNeeded', { n: reorderCount })}
          </button>
        </div>

        {lowCount > 0 ? (
          <button
            type="button"
            onClick={showLowStock}
            className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-[4px] border px-3 py-2 text-left text-[13px] font-bold"
            style={{
              borderColor: KC.production,
              color: KC.ink,
              background: KC.bgSubtle,
            }}
          >
            <AlertTriangle size={14} style={{ color: KC.production }} />
            <span className="flex-1">
              {t('inventory.lowStockStrip', { n: lowCount })}
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: KC.link }}
            >
              {t('inventory.showInTable')}
            </span>
          </button>
        ) : null}

        {purchaseOrders.length > 0 ? (
          <div
            className="mb-3 rounded-[4px] border"
            style={{ borderColor: KC.border }}
          >
            <button
              type="button"
              onClick={() => setPoOpen((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-[13px] font-bold"
              style={{ color: KC.ink }}
            >
              <span>
                {t('inventory.poTitle')}{' '}
                <span
                  className="font-normal tabular-nums"
                  style={{ color: KC.muted }}
                >
                  {purchaseOrders.length}
                </span>
              </span>
              {poOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {poOpen ? (
              <ul
                className="border-t px-3 py-2"
                style={{ borderColor: KC.hairline }}
              >
                {purchaseOrders.map((po) => (
                  <li
                    key={po.id}
                    className="flex items-center gap-3 py-1.5 text-[13px]"
                    style={{ color: KC.text }}
                  >
                    <span
                      className="font-mono text-[12px] font-bold"
                      style={{ color: KC.ink }}
                    >
                      {po.poNumber}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{po.vendor}</span>
                    <span className="tabular-nums" style={{ color: KC.muted }}>
                      {fmtDate(po.expectedDelivery)}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                      style={{
                        border: `1px solid ${KC.border}`,
                        color: KC.ink,
                      }}
                    >
                      {t(`inventory.poStatus.${po.status}`)}
                    </span>
                    <span
                      className="w-20 text-right font-bold tabular-nums"
                      style={{ color: KC.ink }}
                    >
                      {usd(po.totalAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div ref={tableRef} className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: KC.border, color: KC.muted }}
              >
                <th className={th}>{t('inventory.colPart')}</th>
                <th className={th}>{t('inventory.criticality')}</th>
                <th className={`${th} text-right`}>
                  {t('inventory.colStockMin')}
                </th>
                <th className={`${th} text-right`}>
                  {t('inventory.available')}
                </th>
                <th className={`${th} w-[140px]`}>{t('inventory.colLevel')}</th>
                <th className={`${th} text-right`}>
                  {t('inventory.colUnitPrice')}
                </th>
                <th className={`${th} text-right`}>
                  {t('inventory.leadTime')}
                </th>
                <th className={`${th} text-right`}>
                  {t('inventory.statusTitle')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => {
                const pct = stockPct(i);
                const barColor =
                  i.status === 'out_of_stock'
                    ? KC.safety
                    : i.status === 'low'
                      ? KC.production
                      : KC.ok;
                const filled = badgeEmphasis(i) === 'filled';
                const tag = craneTag(
                  i.craneIds,
                  t('inventory.detail.cranesCommon'),
                );
                return (
                  <tr
                    key={i.id}
                    tabIndex={0}
                    className="kc-hover cursor-pointer border-b"
                    style={{ borderColor: KC.hairline }}
                    onClick={() => openPart(i.partId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openPart(i.partId);
                      }
                    }}
                  >
                    <td className="max-w-[280px] py-2 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="truncate font-bold"
                          style={{ color: KC.ink }}
                        >
                          {i.partName}
                        </span>
                        {tag ? (
                          <span
                            className="shrink-0 rounded px-1 text-[11px]"
                            style={{ background: KC.bgRow, color: KC.muted }}
                          >
                            {tag}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="truncate text-[12px]"
                        style={{ color: KC.muted }}
                      >
                        {i.partNumber} · {i.manufacturer}
                      </div>
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: KC.text }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background:
                              i.criticality === 'standard'
                                ? KC.border
                                : CRIT_COLOR[i.criticality],
                          }}
                        />
                        {t(`inventory.crit.${i.criticality}`)}
                      </span>
                    </td>
                    <td
                      className="py-2 pr-2 text-right whitespace-nowrap tabular-nums"
                      style={{ color: KC.ink }}
                    >
                      <span className="font-bold">{i.currentQty}</span>
                      <span style={{ color: KC.muted }}>
                        {' '}
                        / {i.minStockQty}
                      </span>
                    </td>
                    <td
                      className="py-2 pr-2 text-right font-bold tabular-nums"
                      style={{ color: i.availableQty > 0 ? KC.ink : KC.safety }}
                    >
                      {i.availableQty}
                    </td>
                    <td className="py-2 pr-2" title={`${pct}%`}>
                      <div
                        className="h-1.5 w-full rounded-full"
                        style={{ background: KC.track }}
                      >
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    </td>
                    <td
                      className="py-2 pr-2 text-right tabular-nums"
                      style={{ color: KC.text }}
                    >
                      {usd(i.unitPrice)}
                    </td>
                    <td
                      className="py-2 pr-2 text-right tabular-nums"
                      style={{ color: KC.text }}
                    >
                      {t('inventory.leadTimeDays', { days: i.leadTimeDays })}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className="inline-flex h-5 items-center rounded px-1.5 text-[11px] font-bold whitespace-nowrap"
                        style={
                          filled
                            ? {
                                background: STATUS_COLOR[i.status],
                                color: STATUS_ON[i.status],
                              }
                            : i.status === 'normal'
                              ? { color: KC.muted }
                              : {
                                  color: STATUS_COLOR[i.status],
                                  border: `1px solid ${STATUS_COLOR[i.status]}`,
                                }
                        }
                      >
                        {t(`inventory.${STATUS_KEY[i.status]}`)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 ? (
            <KcEmpty>{t('inventory.noParts')}</KcEmpty>
          ) : null}
        </div>
      </div>

      <PartDetailPanel partId={selectedPartId} onClose={closePart} />
    </div>
  );
}
