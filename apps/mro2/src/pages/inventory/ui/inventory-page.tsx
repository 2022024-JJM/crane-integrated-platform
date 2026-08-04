import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import { useInventoryList } from '@crane/features/inventory';
import type { InventoryItem, InventoryStatus } from '@crane/domain/inventory';
import { KC, KC_FONT_MONO, usd } from '../../../shared/ui/kc';
import {
  KcButton,
  KcEmpty,
  KcFilterChip,
  KcFilterGroup,
  KcFilterRail,
  KcSectionHeading,
} from '../../../shared/ui/kc-ui';
import { downloadCsv, toCsv, type CsvColumn } from '../../../shared/lib/export-csv';
import { PartDetailPanel } from './part-detail-panel';

const STATUS_COLOR: Record<InventoryStatus, string> = {
  normal: KC.ok,
  low: KC.production,
  out_of_stock: KC.safety,
  excess: KC.planned,
  expiry_soon: KC.undetermined,
};

/** 재고 목록 CSV 컬럼 — 화면 테이블과 같은 순서 */
const CSV_COLUMNS: CsvColumn<InventoryItem>[] = [
  { header: 'Part', value: (i) => i.partName },
  { header: 'Part Number', value: (i) => i.partNumber },
  { header: 'Bin', value: (i) => i.locationBin },
  { header: 'Qty', value: (i) => i.currentQty },
  { header: 'Min Stock', value: (i) => i.minStockQty },
  { header: 'Reorder Point', value: (i) => i.reorderPoint },
  { header: 'Unit Price (USD)', value: (i) => i.unitPrice },
  { header: 'Manufacturer', value: (i) => i.manufacturer },
  { header: 'Status', value: (i) => i.status },
];

const STATUS_KEY: Record<InventoryStatus, string> = {
  normal: 'statusNormal',
  low: 'statusLow',
  out_of_stock: 'statusOut',
  excess: 'statusExcess',
  expiry_soon: 'statusExpiry',
};

export function Mro2InventoryPage() {
  const { t } = useTranslation('mro2');
  const [searchParams, setSearchParams] = useSearchParams();
  const { items, summary } = useInventoryList();
  const [statusFilters, setStatusFilters] = useState<Set<InventoryStatus>>(new Set());
  const [query, setQuery] = useState('');

  const selectedPartId = searchParams.get('part');

  const filtered = items.filter((i) => {
    if (statusFilters.size > 0 && !statusFilters.has(i.status)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!i.partName.toLowerCase().includes(q) && !i.partNumber.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // 위험(품절/저재고) 우선 정렬 — Slings의 "다음 점검 임박 순" 원칙의 재고 버전
  const STATUS_RANK: Record<InventoryStatus, number> = {
    out_of_stock: 0,
    low: 1,
    expiry_soon: 2,
    excess: 3,
    normal: 4,
  };
  const sorted = [...filtered].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.partName.localeCompare(b.partName),
  );

  const toggleStatus = (s: InventoryStatus) =>
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const openPart = (partId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('part', partId);
    setSearchParams(next);
  };
  const closePart = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('part');
    next.delete('ptab'); // 패널 탭 상태도 함께 정리
    setSearchParams(next);
  };

  return (
    <div className="flex gap-6 pt-2">
      {/* 필터 레일 */}
      <div className="hidden lg:block">
        <div className="mb-2">
          <Link to="/mro2" className="flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
            <ChevronLeft size={14} /> {t('common.back')}
          </Link>
        </div>
        <KcFilterRail
          selectedCount={statusFilters.size}
          onClear={() => {
            setStatusFilters(new Set());
            setQuery('');
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchParts')}
            className="w-full border px-2 py-1 text-[11px]"
            style={{ borderColor: KC.border, color: KC.ink }}
          />
          <KcFilterGroup title={t('common.selectedLocations')}>
            <div className="w-full px-2 py-1.5 text-[10.5px]" style={{ background: KC.inverseBg, color: KC.inverseText }}>
              {t('common.customerName')}
              <div style={{ color: KC.inverseMuted }}>{t('common.warehouse')}</div>
            </div>
          </KcFilterGroup>
          <KcFilterGroup title={t('inventory.statusTitle')}>
            {(Object.keys(STATUS_KEY) as InventoryStatus[]).map((s) => (
              <KcFilterChip
                key={s}
                label={t(`inventory.${STATUS_KEY[s]}`)}
                tone={STATUS_COLOR[s]}
                active={statusFilters.has(s)}
                onClick={() => toggleStatus(s)}
              />
            ))}
          </KcFilterGroup>
        </KcFilterRail>
      </div>

      {/* 본문 테이블 — 넓은 화면에서는 패널이 가리지 않도록 우측 여백 확보 */}
      <div className={`min-w-0 flex-1 ${selectedPartId ? 'xl:pr-[calc(380px+1rem)]' : ''}`}>
        <KcSectionHeading
          right={
            <KcButton
              variant="teal"
              onClick={() => downloadCsv('inventory.csv', toCsv(sorted, CSV_COLUMNS))}
            >
              <FileText size={12} /> {t('common.generateReport')}
            </KcButton>
          }
        >
          {t('inventory.title')}
        </KcSectionHeading>
        <div className="mb-3 text-[11px]" style={{ color: KC.muted }}>
          {t('inventory.subtitle', { customer: t('common.customerName'), count: sorted.length, value: usd(summary.totalValue) })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[11px]">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: KC.border, color: KC.muted }}>
                <th className="py-1.5 pr-2 font-normal">{t('inventory.colPart')}</th>
                <th className="py-1.5 pr-2 font-normal">{t('inventory.colSpecification')}</th>
                <th className="py-1.5 pr-2 font-normal">{t('inventory.colBin')}</th>
                <th className="py-1.5 pr-2 text-right font-normal">{t('inventory.colQty')}</th>
                <th className="py-1.5 pr-2 text-right font-normal">{t('inventory.colMin')}</th>
                <th className="py-1.5 pr-2 text-right font-normal">{t('inventory.colReorder')}</th>
                <th className="py-1.5 pr-2 text-right font-normal">{t('inventory.colUnitPrice')}</th>
                <th className="py-1.5 font-normal">{t('inventory.colManufacturer')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
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
                  <td className="max-w-[220px] py-1.5 pr-2">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3.5 w-[4px] shrink-0" style={{ background: STATUS_COLOR[i.status] }} />
                      <span className="truncate" style={{ color: KC.link }}>
                        {i.partName}
                      </span>
                    </span>
                  </td>
                  <td className="max-w-[140px] truncate py-1.5 pr-2 text-[10.5px]" style={{ color: KC.text, fontFamily: KC_FONT_MONO }}>
                    {i.partNumber}
                  </td>
                  <td className="py-1.5 pr-2" style={{ color: KC.text }}>
                    {i.locationBin}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-bold" style={{ color: KC.ink }}>
                    {i.currentQty}
                  </td>
                  <td className="py-1.5 pr-2 text-right" style={{ color: KC.text }}>
                    {i.minStockQty}
                  </td>
                  <td className="py-1.5 pr-2 text-right" style={{ color: KC.text }}>
                    {i.reorderPoint}
                  </td>
                  <td className="py-1.5 pr-2 text-right" style={{ color: KC.text }}>
                    {usd(i.unitPrice)}
                  </td>
                  <td className="max-w-[110px] truncate py-1.5" style={{ color: KC.text }}>
                    {i.manufacturer}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 ? <KcEmpty>{t('inventory.noParts')}</KcEmpty> : null}
        </div>
      </div>

      {/* 부품 상세 패널 (?part= URL 단일 소스) — 탭 + 전체화면 확장 + 출고/입고 액션 */}
      <PartDetailPanel partId={selectedPartId} onClose={closePart} />
    </div>
  );
}
