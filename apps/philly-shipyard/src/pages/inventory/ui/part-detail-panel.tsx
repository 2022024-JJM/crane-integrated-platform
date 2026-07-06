import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  Maximize2,
  Minimize2,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIssuePart, usePartDetail, useReceivePart } from '@crane/features/inventory';
import type { PartRepairUsage } from '@crane/features/inventory';
import { useMaintenanceList } from '@crane/features/maintenance';
import type {
  InventoryItem,
  InventoryStatus,
  InventoryTransaction,
  OpenPoLine,
  PartCriticality,
} from '@crane/domain/inventory';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { useSidebar } from '@crane/core/lib/sidebar-context';

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

const TX_STYLE: Record<
  InventoryTransaction['type'],
  { icon: typeof ArrowDownToLine; cls: string; sign: string; qtyCls: string }
> = {
  receipt: {
    icon: ArrowDownToLine,
    cls: 'bg-emerald-500/15 text-emerald-400',
    sign: '+',
    qtyCls: 'text-emerald-400',
  },
  issue: {
    icon: ArrowUpFromLine,
    cls: 'bg-sky-500/15 text-sky-400',
    sign: '−',
    qtyCls: 'text-sky-400',
  },
  adjust: {
    icon: SlidersHorizontal,
    cls: 'bg-slate-500/15 text-slate-400',
    sign: '±',
    qtyCls: 'text-slate-400',
  },
};

function craneLabel(craneIds: string[], commonLabel: string): string {
  const has660 = craneIds.includes('crane-660t');
  const has50 = craneIds.includes('crane-50t');
  if (has660 && has50) return commonLabel;
  return has660 ? '660T' : '50T';
}

function etaOf(dateStr: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { label: 'D-Day', overdue: false };
  if (diff > 0) return { label: `D-${diff}`, overdue: false };
  return { label: `D+${Math.abs(diff)}`, overdue: true };
}

const inputCls =
  'h-9 w-full rounded border border-border bg-card/60 px-3 text-sm outline-none transition-colors focus:border-primary/50';

type PanelTab = 'info' | 'history' | 'usage';
type ActionMode = 'issue' | 'receipt';

function StockActionModal({
  mode,
  partId,
  partName,
  availableQty,
  onClose,
}: {
  mode: ActionMode;
  partId: string;
  partName: string;
  availableQty: number;
  onClose: () => void;
}) {
  const { t } = useTranslation('inventory');
  const issue = useIssuePart();
  const receive = useReceivePart();
  const { repairs } = useMaintenanceList();
  const activeRepairs = repairs.filter((r) => r.status !== 'completed');

  const [qty, setQty] = useState(1);
  const [by, setBy] = useState('');
  const [repairWoId, setRepairWoId] = useState('');
  const [poRef, setPoRef] = useState('');
  const [note, setNote] = useState('');

  // 모달 자체 ESC 핸들러 — 최상위 레이어만 닫는다 (패널 핸들러는 actionMode 가드로 위임)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 출고는 예약분을 제외한 가용 재고까지만 허용
  const exceeds = mode === 'issue' && qty > availableQty;
  const canSubmit = qty >= 1 && by.trim().length > 0 && !exceeds;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const outcome =
      mode === 'issue'
        ? issue({
            partId,
            qty,
            by: by.trim(),
            repairWoId: repairWoId || undefined,
            note: note.trim() || undefined,
          })
        : receive({
            partId,
            qty,
            by: by.trim(),
            poRef: poRef.trim() || undefined,
            note: note.trim() || undefined,
          });

    if (outcome.success) {
      toast.success(
        t(mode === 'issue' ? 'actions.toast.issued' : 'actions.toast.received', {
          part: partName,
          n: qty,
        }),
      );
      onClose();
      return;
    }
    const reasonKey =
      outcome.reason === 'insufficient_stock'
        ? 'actions.toast.insufficient'
        : outcome.reason === 'wo_closed'
          ? 'actions.toast.woClosed'
          : 'actions.toast.failed';
    toast.error(t(reasonKey));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">
            {t(mode === 'issue' ? 'actions.issueTitle' : 'actions.receiptTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 truncate text-xs text-muted-foreground">{partName}</p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              {t('actions.qty')}
              <span
                className={cn(
                  'tabular-nums',
                  exceeds ? 'font-semibold text-red-500' : 'text-emerald-500',
                )}
              >
                {exceeds
                  ? t('actions.exceedsStock', { n: availableQty })
                  : mode === 'issue'
                    ? t('actions.availableBadge', { n: availableQty })
                    : ''}
              </span>
            </span>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className={cn(inputCls, exceeds && 'border-red-500/60')}
            />
          </label>

          {mode === 'issue' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('actions.linkedWo')}
              </span>
              <select
                value={repairWoId}
                onChange={(e) => setRepairWoId(e.target.value)}
                className={cn(inputCls, 'cursor-pointer')}
              >
                <option value="">{t('actions.noWo')}</option>
                {activeRepairs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.woNumber} — {r.craneName}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === 'receipt' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('actions.poRef')}
              </span>
              <input
                value={poRef}
                onChange={(e) => setPoRef(e.target.value)}
                placeholder="PO-2026-XXXX"
                className={inputCls}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('actions.by')} <span className="text-red-500">*</span>
            </span>
            <input
              value={by}
              onChange={(e) => setBy(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('actions.note')}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded border border-border bg-card/60 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t(mode === 'issue' ? 'actions.submitIssue' : 'actions.submitReceipt')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 패널/확장 뷰가 공유하는 콘텐츠 블록 ──

function StockChips({
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
    { label: t('detail.stock.reserved'), value: item.reservedQty, cls: 'text-amber-500' },
    { label: t('detail.stock.available'), value: item.availableQty, cls: 'text-emerald-500' },
    { label: t('detail.stock.onOrder'), value: onOrderQty, cls: 'text-sky-400' },
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

function OnOrderList({ lines }: { lines: OpenPoLine[] }) {
  const { t } = useTranslation('inventory');
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => {
        const eta = etaOf(line.expectedDelivery);
        return (
          <div
            key={line.poId}
            className="rounded border border-sky-500/25 bg-sky-500/5 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <ShoppingCart className="h-3 w-3 shrink-0 text-sky-400" />
              <span className="font-mono text-xs font-medium text-sky-400">{line.poNumber}</span>
              <span className="text-xs font-semibold tabular-nums">×{line.qty}</span>
              {line.requester === 'System' && (
                <span className="rounded-full bg-sky-500/15 px-1.5 py-px text-[10px] font-semibold text-sky-400">
                  {t('detail.onOrder.auto')}
                </span>
              )}
              <span className="ml-auto shrink-0">
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    eta.overdue ? 'text-red-500' : 'text-foreground',
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

function InfoContent({
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

function HistoryContent({ transactions }: { transactions: InventoryTransaction[] }) {
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
                  <span className="font-mono text-[10px] text-sky-400">{tx.ref}</span>
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

function UsageContent({ repairUsages }: { repairUsages: PartRepairUsage[] }) {
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
            <span className="font-mono text-xs font-medium text-sky-400">
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

function ActionButtons({
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

export function PartDetailPanel({
  partId,
  onClose,
}: {
  partId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('inventory');
  const { isOpen: sidebarOpen } = useSidebar();
  const { item, transactions, repairUsages, openPoLines, onOrderQty } = usePartDetail(partId);
  const [tab, setTab] = useState<PanelTab>('info');
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [expanded, setExpanded] = useState(false);
  // 슬라이드 애니메이션용: 마운트 직후 entered=true로 전환해 오른쪽에서 밀려들어온다
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // 닫기 요청 — 슬라이드 아웃 후 실제 onClose 호출 (확장 뷰는 즉시)
  const requestClose = useCallback(() => {
    if (expanded) {
      onClose();
      return;
    }
    setEntered(false);
    window.setTimeout(onClose, 300);
  }, [expanded, onClose]);

  // ESC: 모달 열림 → 모달이 처리(위임) / 확장 뷰 → 패널로 / 패널 → 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (actionMode) return; // 상단 레이어(모달)가 ESC를 우선 처리
      if (expanded) setExpanded(false);
      else requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionMode, expanded, requestClose]);

  if (!item) return null;

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={STATUS_VARIANT[item.status]}>{t(`status.${item.status}`)}</Badge>
      <Badge variant={CRITICALITY_VARIANT[item.criticality]}>
        {t(`criticality.${item.criticality}`)}
      </Badge>
    </div>
  );

  const modal = actionMode && (
    <StockActionModal
      mode={actionMode}
      partId={item.partId}
      partName={item.partName}
      availableQty={item.availableQty}
      onClose={() => setActionMode(null)}
    />
  );

  // ── 확장 전체 뷰: 탭이 병렬 컬럼으로 펼쳐진다 ──
  if (expanded) {
    return (
      <div
        className={cn(
          // 사이드바(w-64)를 덮지 않도록 좌측을 오프셋 — 접힌 상태면 left-0
          'fixed right-0 top-14 bottom-0 z-40 flex flex-col bg-background',
          sidebarOpen ? 'left-64' : 'left-0',
        )}
      >
        {/* 헤더 */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{item.partNumber}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold">{item.partName}</h2>
            <div className="mt-1.5">{badges}</div>
          </div>
          <div className="flex items-center gap-3">
            <StockChips item={item} onOrderQty={onOrderQty} className="w-[420px] max-w-full" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('detail.collapse')}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('detail.close', { defaultValue: 'Close' })}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 3열 본문 */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.1fr_1.2fr_1fr] lg:overflow-hidden">
          <section className="border-b border-border p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.tabs.info')}
            </h3>
            <InfoContent item={item} openPoLines={openPoLines} />
          </section>
          <section className="border-b border-border p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.tabs.history')}
              {transactions.length > 0 && (
                <span className="ml-1.5 tabular-nums">{transactions.length}</span>
              )}
            </h3>
            <HistoryContent transactions={transactions} />
          </section>
          <section className="p-5 lg:overflow-y-auto">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('detail.tabs.usage')}
              {repairUsages.length > 0 && (
                <span className="ml-1.5 tabular-nums">{repairUsages.length}</span>
              )}
            </h3>
            <UsageContent repairUsages={repairUsages} />
          </section>
        </div>

        {/* 푸터 액션 */}
        <div className="flex justify-end border-t border-border px-6 py-3">
          <ActionButtons onAction={setActionMode} className="w-72" />
        </div>

        {modal}
      </div>
    );
  }

  // ── 사이드 패널 뷰 ──
  return (
    <aside
      className={cn(
        'fixed right-0 top-14 bottom-0 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col border-l border-border bg-card shadow-2xl',
        'transition-transform duration-300 ease-out will-change-transform',
        entered ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* 헤더 */}
      <div className="flex flex-col gap-1.5 border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{item.partNumber}</p>
            <h2 className="mt-0.5 truncate text-sm font-bold">{item.partName}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('detail.expand')}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={requestClose}
              className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('detail.close', { defaultValue: 'Close' })}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {badges}
      </div>

      {/* 재고 요약 */}
      <div className="border-b border-border p-3">
        <StockChips item={item} onOrderQty={onOrderQty} />
      </div>

      {/* 탭 */}
      <div className="flex border-b border-border">
        {(['info', 'history', 'usage'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 cursor-pointer border-b-2 px-2 py-2.5 text-xs font-medium transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`detail.tabs.${key}`)}
            {key === 'history' && transactions.length > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                {transactions.length}
              </span>
            )}
            {key === 'usage' && repairUsages.length > 0 && (
              <span className="ml-1 tabular-nums text-muted-foreground">
                {repairUsages.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'info' && <InfoContent item={item} openPoLines={openPoLines} />}
        {tab === 'history' && <HistoryContent transactions={transactions} />}
        {tab === 'usage' && <UsageContent repairUsages={repairUsages} />}
      </div>

      {/* 푸터 액션 */}
      <ActionButtons onAction={setActionMode} className="border-t border-border p-3" />

      {modal}
    </aside>
  );
}
