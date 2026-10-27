import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useInventoryList, useIssuePart } from '@crane/features/inventory';
import { KC } from '../../../shared/ui/kc';
import { KcButton, KcModal } from '../../../shared/ui/kc-ui';

const inputBase =
  'h-9 w-full rounded-[4px] border px-2.5 text-[13px] outline-none';
const fieldStyle = {
  borderColor: KC.border,
  color: KC.ink,
  background: KC.bg,
} as const;
const SHOWN = 40;

/**
 * 수리에 부품 사용 기록 — 재고 차감 + partsUsed 추가가 useIssuePart 한 경로로 처리된다.
 * 검색창으로 좁히고 select 로 고른다(재고 306종을 한 select 에 다 넣지 않는다).
 */
export function RepairPartModal({
  repairId,
  woNumber,
  defaultBy,
  onClose,
}: {
  repairId: string;
  woNumber: string;
  defaultBy: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('mro2');
  const issue = useIssuePart();
  const { items } = useInventoryList();
  const [q, setQ] = useState('');
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState(1);
  const [by, setBy] = useState(defaultBy);
  const [note, setNote] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? items.filter((i) =>
          `${i.partName} ${i.partId} ${i.partName_ko ?? ''}`
            .toLowerCase()
            .includes(needle),
        )
      : items;
    return list.slice(0, SHOWN);
  }, [items, q]);
  const selected = items.find((i) => i.partId === partId);
  const exceeds = selected != null && qty > selected.availableQty;
  const canSubmit = !!selected && qty >= 1 && by.trim().length > 0 && !exceeds;

  const submit = () => {
    if (!canSubmit || !selected) return;
    const outcome = issue({
      partId,
      qty,
      by: by.trim(),
      repairWoId: repairId,
      note: note.trim() || undefined,
    });
    if (outcome.success) {
      toast.success(
        t('sr.work.partIssued', {
          part: selected.partName,
          n: qty,
          number: woNumber,
        }),
      );
      onClose();
      return;
    }
    toast.error(
      outcome.reason === 'insufficient_stock'
        ? t('sr.work.insufficient')
        : outcome.reason === 'wo_closed'
          ? t('sr.work.locked')
          : t('sr.work.partFailed'),
    );
  };

  return (
    <KcModal onClose={onClose} maxWidth={420}>
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: KC.hairline }}
      >
        <div>
          <h2 className="text-[15px] font-bold" style={{ color: KC.ink }}>
            {t('sr.work.addPart')}
          </h2>
          <div className="font-mono text-[12px]" style={{ color: KC.muted }}>
            {woNumber}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('ticket.cancel')}
          className="cursor-pointer p-1"
        >
          <X size={16} style={{ color: KC.ink }} />
        </button>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <label
          className="flex flex-col gap-1 text-[12px] font-bold"
          style={{ color: KC.ink }}
        >
          {t('sr.work.searchPart')}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.searchParts')}
            className={inputBase}
            style={fieldStyle}
            autoFocus
          />
        </label>
        <label
          className="flex flex-col gap-1 text-[12px] font-bold"
          style={{ color: KC.ink }}
        >
          {t('ticket.parts')}
          <select
            value={partId}
            onChange={(e) => setPartId(e.target.value)}
            className={`${inputBase} h-auto py-1`}
            style={fieldStyle}
            size={6}
          >
            {filtered.map((i) => (
              <option key={i.partId} value={i.partId}>
                {i.partName} · {i.partId} ·{' '}
                {t('sr.work.avail', { n: i.availableQty })}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label
            className="flex flex-col gap-1 text-[12px] font-bold"
            style={{ color: KC.ink }}
          >
            {t('sr.qty')}
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className={inputBase}
              style={{
                ...fieldStyle,
                borderColor: exceeds ? KC.safety : KC.border,
              }}
            />
            {exceeds ? (
              <span
                className="text-[11px] font-normal"
                style={{ color: KC.safety }}
              >
                {t('sr.work.insufficient')}
              </span>
            ) : null}
          </label>
          <label
            className="flex flex-col gap-1 text-[12px] font-bold"
            style={{ color: KC.ink }}
          >
            {t('sr.work.by')}
            <input
              value={by}
              onChange={(e) => setBy(e.target.value)}
              className={inputBase}
              style={fieldStyle}
            />
          </label>
        </div>
        <label
          className="flex flex-col gap-1 text-[12px] font-bold"
          style={{ color: KC.ink }}
        >
          {t('ticket.note')}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputBase}
            style={fieldStyle}
          />
        </label>
      </div>
      <div
        className="flex justify-end gap-2 border-t px-4 py-3"
        style={{ borderColor: KC.hairline }}
      >
        <KcButton variant="ghost" onClick={onClose}>
          {t('ticket.cancel')}
        </KcButton>
        <KcButton variant="teal" disabled={!canSubmit} onClick={submit}>
          {t('sr.work.issue')}
        </KcButton>
      </div>
    </KcModal>
  );
}
