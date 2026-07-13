import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
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
import { cn } from '@crane/core/lib/utils';
import { TONE_CHIP, TONE_SURFACE, TONE_TEXT } from '../../../shared/ui/tone';
import { formatRelativeDate } from '../../../shared/lib/relative-date';
import type { ActionMode } from './stock-action-modal';

const TX_STYLE: Record<
  InventoryTransaction['type'],
  { icon: typeof ArrowDownToLine; cls: string; sign: string; qtyCls: string }
> = {
  receipt: {
    icon: ArrowDownToLine,
    cls: TONE_CHIP.positive,
    sign: '+',
    qtyCls: TONE_TEXT.positive,
  },
  issue: {
    icon: ArrowUpFromLine,
    cls: TONE_CHIP.info,
    sign: '−',
    qtyCls: TONE_TEXT.info,
  },
  adjust: {
    icon: SlidersHorizontal,
    cls: TONE_CHIP.neutral,
    sign: '±',
    qtyCls: 'text-muted-foreground',
  },
};

function craneLabel(craneIds: string[], commonLabel: string): string {
  const has660 = craneIds.includes('crane-660t');
  const has50 = craneIds.includes('crane-50t');
  if (has660 && has50) return commonLabel;
  return has660 ? '660T' : '50T';
}

// ── 패널/확장 뷰가 공유하는 콘텐츠 블록 ──

export function StockChips({
  item,
  onOrderQty,
  className,
}: {
  item: InventoryItem;
  onOrderQty: number;
  className?: string;
}) {
  const { t } = useTranslation('inventory');
  const chips = [
    { label: t('detail.stock.current'), value: item.currentQty, cls: 'text-foreground' },
    { label: t('detail.stock.reserved'), value: item.reservedQty, cls: item.reservedQty > 0 ? TONE_TEXT.warning : 'text-foreground' },
    { label: t('detail.stock.available'), value: item.availableQty, cls: item.availableQty > 0 ? 'text-foreground' : TONE_TEXT.critical },
    { label: t('detail.stock.onOrder'), value: onOrderQty, cls: onOrderQty > 0 ? TONE_TEXT.info : 'text-foreground' },
    { label: t('detail.stock.reorderPt'), value: item.reorderPoint, cls: 'text-muted-foreground' },
  ];
  return (
    <div className={cn('grid grid-cols-5 gap-1.5', className)}>
      {chips.map(({ label, value, cls }) => (
        <div key={label} className="rounded bg-muted/40 px-2 py-2 text-center">
          <p className={cn('text-lg font-semibold leading-none tabular-nums', cls)}>{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

export function OnOrderList({ lines }: { lines: OpenPoLine[] }) {
  const { t } = useTranslation('inventory');
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => {
        const eta = formatRelativeDate(line.expectedDelivery);
        return (
          <div
            key={line.poId}
            className={cn('rounded border px-3 py-2.5', TONE_SURFACE.info)}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <ShoppingCart className={cn('h-3 w-3 shrink-0', TONE_TEXT.info)} />
              <span className={cn('font-mono text-xs font-medium', TONE_TEXT.info)}>{line.poNumber}</span>
              <span className="text-xs font-semibold tabular-nums">×{line.qty}</span>
              {line.requester === 'System' && (
                <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', TONE_CHIP.info)}>
                  {t('detail.onOrder.auto')}
                </span>
              )}
              <span className="ml-auto shrink-0">
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    eta.overdue ? TONE_TEXT.critical : 'text-foreground',
                  )}
                >
                  {eta.label}
                </span>
                <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                  {line.expectedDelivery}
                </span>
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {line.vendor} · {t(`po.status.${line.status}`)}
            </p>
            {line.note && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{line.note}</p>
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
  const { t } = useTranslation('inventory');
  const infoRows: { label: string; value: string }[] = [
    { label: t('table.category'), value: t(`category.${item.category}`) },
    { label: t('detail.fields.manufacturer'), value: item.manufacturer },
    { label: t('table.unitPrice', { defaultValue: 'Unit Price' }), value: `$${item.unitPrice.toLocaleString()}` },
    { label: t('table.uom'), value: item.uom },
    { label: t('table.leadTime'), value: `${item.leadTimeDays}${t('units.days')}` },
    { label: t('detail.fields.locationBin'), value: item.locationBin },
    { label: t('detail.stock.min'), value: String(item.minStockQty) },
    { label: t('detail.fields.reorderPoint'), value: String(item.reorderPoint) },
    { label: t('detail.fields.lastReceipt'), value: item.lastReceiptDate },
    { label: t('detail.fields.lastIssue'), value: item.lastIssueDate },
    { label: t('detail.fields.cranes'), value: craneLabel(item.craneIds, t('crane.common')) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2">
        {infoRows.map(({ label, value }) => (
          <div key={label} className="rounded bg-muted/40 px-3 py-2">
            <dt className="text-[10px] text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 truncate text-xs font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {openPoLines.length > 0 && (
        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('detail.onOrder.title')}
          </h4>
          <OnOrderList lines={openPoLines} />
        </section>
      )}
    </div>
  );
}

export function HistoryContent({ transactions }: { transactions: InventoryTransaction[] }) {
  const { t } = useTranslation('inventory');
  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t('detail.empty.history')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {transactions.map((tx) => {
        const style = TX_STYLE[tx.type];
        const Icon = style.icon;
        return (
          <div
            key={tx.id}
            className="flex gap-2.5 rounded border border-border/70 bg-muted/30 px-3 py-2.5"
          >
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                style.cls,
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold">
                  {t(`detail.tx.${tx.type}`)}
                </span>
                <span className={cn('text-xs font-semibold tabular-nums', style.qtyCls)}>
                  {style.sign}
                  {tx.qty}
                </span>
                {tx.ref && (
                  <span className="font-mono text-[10px] text-muted-foreground">{tx.ref}</span>
                )}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {tx.date}
                </span>
              </div>
              {tx.note && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {tx.note}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-muted-foreground/80">{tx.by}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UsageContent({ repairUsages }: { repairUsages: PartRepairUsage[] }) {
  const { t } = useTranslation('inventory');
  if (repairUsages.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t('detail.empty.usage')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {repairUsages.map(({ repair, qty }) => (
        <Link
          key={repair.id}
          to={`/maintenance/${repair.id}`}
          className="group flex cursor-pointer flex-col gap-1 rounded border border-border/70 bg-muted/30 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-foreground">
              {repair.woNumber}
            </span>
            <span className="text-[10px] text-muted-foreground">{repair.craneName}</span>
            <span className="ml-auto text-xs font-semibold tabular-nums">
              {t('detail.usageQty', { n: qty })}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {repair.componentName}
          </p>
        </Link>
      ))}
    </div>
  );
}

export function ActionButtons({
  onAction,
  className,
}: {
  onAction: (mode: ActionMode) => void;
  className?: string;
}) {
  const { t } = useTranslation('inventory');
  return (
    <div className={cn('flex gap-2', className)}>
      <button
        type="button"
        onClick={() => onAction('issue')}
        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <ArrowUpFromLine className="h-3.5 w-3.5" />
        {t('actions.issue')}
      </button>
      <button
        type="button"
        onClick={() => onAction('receipt')}
        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        {t('actions.receipt')}
      </button>
    </div>
  );
}
