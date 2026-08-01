import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInventoryList, useIssuePart } from '@crane/features/inventory';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_MODAL } from '../../../shared/ui/surface';
import { Button } from '@crane/ui/atoms/button';
import { FOCUS_RING } from '../../../shared/ui/controls';
import { PartCombobox } from '../../../shared/ui/part-combobox';
import { loadLastActor, saveLastActor } from '../../../shared/lib/actor-storage';
import {
  FormField,
  inputClass,
  textareaClass,
} from '../../../shared/ui/form';

/**
 * 수리 WO에 부품 사용 기록 — stock-action-modal의 역방향(WO 고정, 부품 선택).
 * useIssuePart 단일 경로로 재고 차감 + partsUsed 추가 + 트랜잭션이 함께 처리된다.
 */
export function RepairPartModal({
  repairId,
  woNumber,
  defaultBy,
  onClose,
}: {
  repairId: string;
  woNumber: string;
  /** WO 담당자 — 부품을 기록하는 사람일 확률이 가장 높아 기본값으로 쓴다 */
  defaultBy?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('maintenance');
  const issue = useIssuePart();
  const { items } = useInventoryList();

  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState(1);
  const [by, setBy] = useState(() => defaultBy || loadLastActor());
  const [note, setNote] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);

  // 접근성: 열릴 때 첫 입력으로 포커스 이동 + ESC 닫기 + Tab/Shift+Tab 포커스 트랩
  // (ESC는 최상위 레이어만 닫는다 — 패널 핸들러는 modalOpen 가드로 위임)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current
      ?.querySelector<HTMLElement>('input, select, textarea')
      ?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const items2 = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (items2.length === 0) return;
        const first = items2[0]!;
        const last = items2[items2.length - 1]!;
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
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  const selected = items.find((i) => i.partId === partId);
  const exceeds = selected != null && qty > selected.availableQty;
  const canSubmit = partId !== '' && qty >= 1 && by.trim().length > 0 && !exceeds;

  const handleSubmit = () => {
    if (!canSubmit || !selected) return;
    const outcome = issue({
      partId,
      qty,
      by: by.trim(),
      repairWoId: repairId,
      note: note.trim() || undefined,
    });

    if (outcome.success) {
      saveLastActor(by);
      toast.success(
        t('toast.partIssued', { part: selected.partName, n: qty, woNumber }),
      );
      onClose();
      return;
    }
    const reasonKey =
      outcome.reason === 'insufficient_stock'
        ? 'panel.part.insufficient'
        : outcome.reason === 'wo_closed'
          ? 'panel.completedLocked'
          : 'panel.part.failed';
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
        aria-labelledby="repair-part-modal-title"
        aria-describedby="repair-part-modal-desc"
        className={cn(SURFACE_MODAL, 'w-full max-w-sm p-5')}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 id="repair-part-modal-title" className="text-sm font-bold">
            {t('panel.part.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('panel.close')}
            className={cn('cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS_RING)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p id="repair-part-modal-desc" className="mb-4 truncate text-xs text-muted-foreground">
          {woNumber}
        </p>

        <div className="flex flex-col gap-4">
          <FormField label={t('panel.part.selectPart')} required>
            <PartCombobox
              items={items}
              value={partId}
              showAvailable
              onSelect={(id) => {
                setPartId(id);
                setQty(1);
              }}
            />
          </FormField>

          <FormField
            label={t('panel.part.qty')}
            required
            error={
              exceeds && selected
                ? t('panel.part.exceedsStock', { n: selected.availableQty })
                : undefined
            }
            hint={
              !exceeds && selected
                ? t('panel.part.available', { n: selected.availableQty })
                : undefined
            }
          >
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className={cn(inputClass, exceeds && 'border-destructive/60')}
            />
          </FormField>

          <FormField label={t('panel.part.by')} required>
            <input
              value={by}
              onChange={(e) => setBy(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label={t('panel.part.note')}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={textareaClass}
            />
          </FormField>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('panel.part.cancel')}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {t('panel.part.submit')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
