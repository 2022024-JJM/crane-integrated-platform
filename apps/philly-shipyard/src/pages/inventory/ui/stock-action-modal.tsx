import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIssuePart, useReceivePart } from '@crane/features/inventory';
import { useMaintenanceList } from '@crane/features/maintenance';
import { cn } from '@crane/core/lib/utils';
import { TONE_TEXT } from '../../../shared/ui/tone';

export type ActionMode = 'issue' | 'receipt';

const inputCls =
  'h-9 w-full rounded border border-border bg-card/60 px-3 text-sm outline-none transition-colors focus:border-primary/50';

export function StockActionModal({
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

  const dialogRef = useRef<HTMLDivElement>(null);

  // 접근성: 열릴 때 첫 입력으로 포커스 이동 + ESC 닫기 + Tab/Shift+Tab 포커스 트랩
  // (ESC는 최상위 레이어만 닫는다 — 패널 핸들러는 actionMode 가드로 위임)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // 첫 진입 시 첫 번째 입력 필드로 포커스 이동
    dialogRef.current
      ?.querySelector<HTMLElement>('input, select, textarea')
      ?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const items = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // 트리거가 unmount된 경우 focus가 body로 빠지지 않도록 가드.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
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

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-action-modal-title"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 id="stock-action-modal-title" className="text-sm font-bold">
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
                  exceeds ? cn('font-semibold', TONE_TEXT.critical) : 'text-muted-foreground',
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
              className={cn(inputCls, exceeds && 'border-destructive/60')}
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
              {t('actions.by')} <span className="text-destructive">*</span>
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
    </div>,
    document.body,
  );
}
