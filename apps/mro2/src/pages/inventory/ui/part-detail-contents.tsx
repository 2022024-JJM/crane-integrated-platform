import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  PackagePlus,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PartRepairUsage } from '@crane/features/inventory';
import type {
  InventoryItem,
  InventoryTransaction,
  OpenPoLine,
} from '@crane/domain/inventory';
import { KC, KC_FONT_MONO, usd } from '../../../shared/ui/kc';
import { KcButton } from '../../../shared/ui/kc-ui';
import { fmtDate } from '../../../shared/lib/service-status';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import type { ActionMode } from './stock-action-modal';

/** 입출고 유형별 색 바/부호 — 목록 패널의 트랜잭션 색 규칙과 동일 */
const TX_STYLE: Record<
  InventoryTransaction['type'],
  { icon: typeof ArrowDownToLine; tone: string; sign: string }
> = {
  receipt: { icon: ArrowDownToLine, tone: KC.ok, sign: '+' },
  issue: { icon: ArrowUpFromLine, tone: KC.production, sign: '−' },
  adjust: { icon: SlidersHorizontal, tone: KC.planned, sign: '±' },
};

function craneLabel(craneIds: string[], commonLabel: string): string {
  const has660 = craneIds.includes('crane-660t');
  const has50 = craneIds.includes('crane-50t');
  if (has660 && has50) return commonLabel;
  return has660 ? '660T' : '50T';
}

/* ── 패널/확장 뷰가 공유하는 콘텐츠 블록 (KC 스타일) ──────────────── */

export function StockChips({
  item,
  onOrderQty,
  className,
}: {
  item: InventoryItem;
  onOrderQty: number;
  className?: string;
}) {
  const { t } = useTranslation('mro2');
  const chips = [
    { label: t('inventory.currentQty'), value: item.currentQty, tone: KC.ink },
    { label: t('inventory.reserved'), value: item.reservedQty, tone: item.reservedQty > 0 ? KC.production : KC.ink },
    { label: t('inventory.available'), value: item.availableQty, tone: item.availableQty > 0 ? KC.ink : KC.safety },
    { label: t('inventory.detail.stockOnOrder'), value: onOrderQty, tone: onOrderQty > 0 ? KC.link : KC.ink },
    { label: t('inventory.reorderPoint'), value: item.reorderPoint, tone: KC.muted },
  ];
  return (
    <div className={`grid grid-cols-5 gap-1.5 ${className ?? ''}`}>
      {chips.map(({ label, value, tone }) => (
        <div key={label} className="px-1 py-1.5 text-center" style={{ background: KC.bgRow }}>
          <div className="text-[15px] font-bold leading-none tabular-nums" style={{ color: tone }}>
            {value}
          </div>
          <div className="mt-1 text-[9.5px]" style={{ color: KC.muted }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OnOrderList({ lines }: { lines: OpenPoLine[] }) {
  const { t } = useTranslation('mro2');
  const now = Date.now();
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line) => {
        const overdue = new Date(line.expectedDelivery).getTime() < now;
        return (
          <div
            key={line.poId}
            className="border px-2.5 py-2"
            style={{ borderColor: KC.hairline, borderLeft: `4px solid ${KC.link}` }}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
              <ShoppingCart size={11} style={{ color: KC.link }} />
              <span className="font-medium" style={{ color: KC.link, fontFamily: KC_FONT_MONO }}>
                {line.poNumber}
              </span>
              <span className="font-bold tabular-nums" style={{ color: KC.ink }}>
                ×{line.qty}
              </span>
              {line.requester === 'System' && (
                <span className="px-1.5 py-px text-[9.5px]" style={{ background: KC.bgRow, color: KC.text }}>
                  {t('inventory.detail.onOrderAuto')}
                </span>
              )}
              <span
                className="ml-auto font-bold tabular-nums"
                style={{ color: overdue ? KC.safety : KC.ink }}
              >
                {fmtDate(line.expectedDelivery)}
              </span>
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: KC.muted }}>
              {line.vendor} · {t(`inventory.poStatus.${line.status}`)}
            </div>
            {line.note && (
              <div className="mt-0.5 text-[10px] leading-relaxed" style={{ color: KC.muted }}>
                {line.note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function InfoContent({
  item,
  openPoLines,
}: {
  item: InventoryItem;
  openPoLines: OpenPoLine[];
}) {
  const { t } = useTranslation('mro2');
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: t('inventory.partNumber'), value: item.partNumber, mono: true },
    { label: t('inventory.category'), value: item.category },
    { label: t('inventory.colManufacturer'), value: item.manufacturer },
    { label: t('inventory.criticality'), value: item.criticality },
    { label: t('inventory.uom'), value: item.uom },
    { label: t('inventory.unitPrice'), value: usd(item.unitPrice) },
    { label: t('inventory.leadTime'), value: t('inventory.leadTimeDays', { days: item.leadTimeDays }) },
    { label: t('inventory.colBin'), value: item.locationBin },
    { label: t('inventory.minStock'), value: String(item.minStockQty) },
    { label: t('inventory.reorderPoint'), value: String(item.reorderPoint) },
    { label: t('inventory.lastReceipt'), value: fmtDate(item.lastReceiptDate) },
    { label: t('inventory.lastIssue'), value: fmtDate(item.lastIssueDate) },
    { label: t('inventory.detail.cranes'), value: craneLabel(item.craneIds, t('inventory.detail.cranesCommon')) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        {rows.map(({ label, value, mono }) => (
          <div key={label} className="flex border-b py-1 text-[10.5px]" style={{ borderColor: KC.hairline }}>
            <span className="w-[110px] shrink-0 font-bold" style={{ color: KC.ink }}>
              {label}
            </span>
            <span style={{ color: KC.text, fontFamily: mono ? KC_FONT_MONO : undefined }}>{value}</span>
          </div>
        ))}
      </div>

      {openPoLines.length > 0 && (
        <section>
          <h4 className="mb-1.5 text-[11.5px] font-bold" style={{ color: KC.ink }}>
            {t('inventory.detail.onOrderTitle')}
          </h4>
          <OnOrderList lines={openPoLines} />
        </section>
      )}
    </div>
  );
}

export function HistoryContent({ transactions }: { transactions: InventoryTransaction[] }) {
  const { t } = useTranslation('mro2');
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-[11px]" style={{ color: KC.muted }}>
        {t('inventory.noTransactions')}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {transactions.map((tx) => {
        const style = TX_STYLE[tx.type];
        const Icon = style.icon;
        return (
          <div
            key={tx.id}
            className="border px-2.5 py-2"
            style={{ borderColor: KC.hairline, borderLeft: `4px solid ${style.tone}` }}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
              <Icon size={11} style={{ color: style.tone }} />
              <span className="font-bold" style={{ color: KC.ink }}>
                {t(`inventory.txn${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}`)}
              </span>
              <span className="font-bold tabular-nums" style={{ color: style.tone }}>
                {style.sign}
                {tx.qty}
              </span>
              {tx.ref && (
                <span className="text-[9.5px]" style={{ color: KC.muted, fontFamily: KC_FONT_MONO }}>
                  {tx.ref}
                </span>
              )}
              <span className="ml-auto text-[9.5px]" style={{ color: KC.faint }}>
                {fmtDate(tx.date)}
              </span>
            </div>
            {tx.note && (
              <div className="mt-0.5 text-[10px] leading-relaxed" style={{ color: KC.muted }}>
                {tx.note}
              </div>
            )}
            <div className="mt-0.5 text-[9.5px]" style={{ color: KC.faint }}>
              {tx.by}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UsageContent({ repairUsages }: { repairUsages: PartRepairUsage[] }) {
  const { t } = useTranslation('mro2');
  if (repairUsages.length === 0) {
    return (
      <div className="py-8 text-center text-[11px]" style={{ color: KC.muted }}>
        {t('inventory.detail.emptyUsage')}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {repairUsages.map(({ repair, qty }) => (
        <Link
          key={repair.id}
          to={`/mro2/service-requests/repair/${repair.id}`}
          className="kc-hover flex cursor-pointer flex-col gap-0.5 border px-2.5 py-2"
          style={{ borderColor: KC.hairline }}
        >
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="font-medium" style={{ color: KC.link, fontFamily: KC_FONT_MONO }}>
              {repair.woNumber}
            </span>
            <span className="text-[9.5px]" style={{ color: KC.muted }}>
              {repair.craneName}
            </span>
            <span className="ml-auto font-bold tabular-nums" style={{ color: KC.ink }}>
              {t('inventory.detail.usageQty', { n: qty })}
            </span>
            <ChevronRight size={11} style={{ color: KC.muted }} />
          </div>
          <div className="truncate text-[10px]" style={{ color: KC.muted }}>
            {repair.componentName}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ActionButtons({
  onAction,
  partId,
  craneIds,
  className,
}: {
  onAction: (mode: ActionMode) => void;
  /** 이 부품으로 부품 요청 티켓을 프리필해 연다 — 지표를 본 자리에서 바로 조치 */
  partId: string;
  craneIds: string[];
  className?: string;
}) {
  const { t } = useTranslation('mro2');
  const { openTicket } = useNewTicket();
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <KcButton
        variant="outline"
        className="w-full justify-center"
        // 사용처가 단일 크레인일 때만 크레인까지 프리필(다중이면 사용자가 선택)
        onClick={() => openTicket('parts', craneIds.length === 1 ? craneIds[0] : undefined, { partId })}
      >
        <PackagePlus size={13} /> {t('inventory.actions.requestPart')}
      </KcButton>
      <div className="flex gap-1.5">
        <KcButton variant="outline" className="flex-1 justify-center" onClick={() => onAction('issue')}>
          <ArrowUpFromLine size={13} /> {t('inventory.actions.issue')}
        </KcButton>
        <KcButton variant="teal" className="flex-1 justify-center" onClick={() => onAction('receipt')}>
          <ArrowDownToLine size={13} /> {t('inventory.actions.receipt')}
        </KcButton>
      </div>
    </div>
  );
}
