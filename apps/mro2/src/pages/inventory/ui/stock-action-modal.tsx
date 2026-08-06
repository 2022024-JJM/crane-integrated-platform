import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIssuePart, useReceivePart } from '@crane/features/inventory';
import { useMaintenanceList } from '@crane/features/maintenance';
import type { OpenPoLine } from '@crane/domain/inventory';
import { KC, KC_FONT_DISPLAY } from '../../../shared/ui/kc';
import { KcButton, KcModal } from '../../../shared/ui/kc-ui';

export type ActionMode = 'issue' | 'receipt';

const PO_CUSTOM = '__custom__';

/** 마지막 처리자 로컬 보존 — 연속 처리 시 재입력을 덜어준다 */
const ACTOR_KEY = 'mro2.stock.lastActor';

function loadLastActor(): string {
  try {
    return window.localStorage.getItem(ACTOR_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveLastActor(name: string): void {
  try {
    window.localStorage.setItem(ACTOR_KEY, name.trim());
  } catch {
    /* storage 불가 환경 — 보존만 포기 */
  }
}

const inputBase =
  'w-full rounded-[4px] border px-2.5 py-1.5 text-[12.5px] outline-none focus:ring-2';

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold" style={{ color: KC.ink }}>
        {label}
        {required ? <span style={{ color: KC.safety }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function StockActionModal({
  mode,
  partId,
  partName,
  availableQty,
  openPoLines = [],
  onClose,
}: {
  mode: ActionMode;
  partId: string;
  partName: string;
  availableQty: number;
  /** 이 부품의 발주중(미입고) PO 라인 — 입고 시 손입력 대신 골라 잡는다 */
  openPoLines?: OpenPoLine[];
  onClose: () => void;
}) {
  const { t } = useTranslation('mro2');
  const issue = useIssuePart();
  const receive = useReceivePart();
  const { repairs } = useMaintenanceList();
  const activeRepairs = repairs.filter((r) => r.status !== 'completed');

  const [qty, setQty] = useState(1);
  const [by, setBy] = useState(loadLastActor);
  const [repairWoId, setRepairWoId] = useState('');
  const [poRef, setPoRef] = useState('');
  // 미결 PO가 있어도 목록에 없는 번호를 적어야 할 때가 있다 — 직접 입력 폴백
  const [poCustom, setPoCustom] = useState(false);
  const [note, setNote] = useState('');

  // 출고는 예약분을 제외한 가용 재고까지만 허용
  const exceeds = mode === 'issue' && qty > availableQty;
  const canSubmit = qty >= 1 && by.trim().length > 0 && !exceeds;

  const fieldStyle = { borderColor: KC.border, color: KC.ink, background: KC.bg };

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
      saveLastActor(by);
      toast.success(
        t(mode === 'issue' ? 'inventory.actions.toastIssued' : 'inventory.actions.toastReceived', {
          part: partName,
          n: qty,
        }),
      );
      onClose();
      return;
    }
    const reasonKey =
      outcome.reason === 'insufficient_stock'
        ? 'inventory.actions.toastInsufficient'
        : outcome.reason === 'wo_closed'
          ? 'inventory.actions.toastWoClosed'
          : 'inventory.actions.toastFailed';
    toast.error(t(reasonKey));
  };

  return (
    <KcModal onClose={onClose} maxWidth={400}>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: KC.hairline }}>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {t(mode === 'issue' ? 'inventory.actions.issueTitle' : 'inventory.actions.receiptTitle')}
          </h2>
          <div className="truncate text-[11px]" style={{ color: KC.muted }}>
            {partName}
          </div>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer">
          <X size={16} style={{ color: KC.ink }} />
        </button>
      </div>

      <div className="flex flex-col gap-3.5 px-4 py-4">
        <Field label={t('inventory.actions.qty')} required>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className={inputBase}
            style={{ ...fieldStyle, borderColor: exceeds ? KC.safety : KC.border }}
            autoFocus
          />
          {exceeds ? (
            <span className="text-[10.5px]" style={{ color: KC.safety }}>
              {t('inventory.actions.exceedsStock', { n: availableQty })}
            </span>
          ) : mode === 'issue' ? (
            <span className="text-[10.5px]" style={{ color: KC.muted }}>
              {t('inventory.actions.availableBadge', { n: availableQty })}
            </span>
          ) : null}
        </Field>

        {mode === 'issue' && (
          <Field label={t('inventory.actions.linkedWo')}>
            <select
              value={repairWoId}
              onChange={(e) => setRepairWoId(e.target.value)}
              className={inputBase}
              style={fieldStyle}
            >
              <option value="">{t('inventory.actions.noWo')}</option>
              {activeRepairs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.woNumber} — {r.craneName}
                </option>
              ))}
            </select>
          </Field>
        )}

        {mode === 'receipt' && (
          <Field label={t('inventory.actions.poRef')}>
            {openPoLines.length > 0 && !poCustom ? (
              <select
                value={poRef}
                onChange={(e) => {
                  if (e.target.value === PO_CUSTOM) {
                    setPoCustom(true);
                    setPoRef('');
                    return;
                  }
                  setPoRef(e.target.value);
                  // PO 라인을 고르면 발주 수량을 입고 수량 기본값으로 — 대부분 전량 입고
                  const line = openPoLines.find((l) => l.poNumber === e.target.value);
                  if (line) setQty(line.qty);
                }}
                className={inputBase}
                style={fieldStyle}
              >
                <option value="">{t('inventory.actions.poNone')}</option>
                {openPoLines.map((l) => (
                  <option key={l.poId} value={l.poNumber}>
                    {l.poNumber} — {l.vendor} · {t('inventory.actions.poLineQty', { n: l.qty })}
                  </option>
                ))}
                <option value={PO_CUSTOM}>{t('inventory.actions.poCustom')}</option>
              </select>
            ) : (
              <input
                value={poRef}
                onChange={(e) => setPoRef(e.target.value)}
                placeholder="PO-2026-XXXX"
                className={inputBase}
                style={fieldStyle}
              />
            )}
          </Field>
        )}

        <Field label={t('inventory.actions.by')} required>
          <input value={by} onChange={(e) => setBy(e.target.value)} className={inputBase} style={fieldStyle} />
        </Field>

        <Field label={t('inventory.actions.note')}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputBase}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </Field>
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: KC.hairline }}>
        <KcButton variant="ghost" onClick={onClose}>
          {t('inventory.actions.cancel')}
        </KcButton>
        <KcButton variant="teal" onClick={handleSubmit} disabled={!canSubmit}>
          {t(mode === 'issue' ? 'inventory.actions.submitIssue' : 'inventory.actions.submitReceipt')}
        </KcButton>
      </div>
    </KcModal>
  );
}
