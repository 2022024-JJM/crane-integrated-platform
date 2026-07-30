import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { SURFACE_MODAL } from '../../../../shared/ui/surface';
import { FOCUS_RING } from '../../../../shared/ui/controls';

/** 일괄 발행 확인 — 되돌리기 없는 다건 생성이므로 kind별 집계를 보여주고 확정받는다 */
export function RiskBatchConfirmModal({
  repairCount,
  partsCount,
  excludedCount,
  onConfirm,
  onClose,
}: {
  repairCount: number;
  partsCount: number;
  /** 목록에서 일괄 대상이 아니어서 제외된 리스크 수 (이미 발행/품목 미정/기존 WO) */
  excludedCount: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('philly-dashboard');
  const dialogRef = useRef<HTMLDivElement>(null);

  // 접근성: 열릴 때 확인 버튼으로 포커스 이동 + ESC 닫기 + Tab/Shift+Tab 포커스 트랩
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button[data-confirm]')?.focus();

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
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

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
        aria-labelledby="risk-batch-confirm-title"
        className={cn(SURFACE_MODAL, 'w-full max-w-sm p-5')}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="risk-batch-confirm-title" className="text-sm font-bold">
            {t('openItems.batchConfirm.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('openItems.batchConfirm.cancel')}
            className={cn(
              'cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-1.5 text-xs">
          {repairCount > 0 && (
            <li>{t('openItems.batchConfirm.repairCount', { count: repairCount })}</li>
          )}
          {partsCount > 0 && (
            <li>{t('openItems.batchConfirm.partsCount', { count: partsCount })}</li>
          )}
        </ul>
        {excludedCount > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t('openItems.batchConfirm.excluded', { count: excludedCount })}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('openItems.batchConfirm.cancel')}
          </Button>
          <Button type="button" data-confirm onClick={onConfirm}>
            {t('openItems.batchConfirm.confirm')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
