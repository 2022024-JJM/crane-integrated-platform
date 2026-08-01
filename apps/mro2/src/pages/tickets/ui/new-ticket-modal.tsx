import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronDown, Plus, Trash2, Wrench, ClipboardCheck, Package, X } from 'lucide-react';
import {
  useCreateInspectionTicket,
  useCreatePartsTicket,
  useCreateRepairTicket,
} from '@crane/features/ticket';
import { getAllCraneAssets, getComponentsByCraneId } from '@crane/domain/asset';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { getTechnicians } from '@crane/domain/shared';
import { KC, KC_FONT_DISPLAY } from '../../../shared/ui/kc';
import { KcButton } from '../../../shared/ui/kc-ui';
import { useNewTicket, type TicketKind } from '../../../shared/lib/use-new-ticket';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── 공용 폼 요소 (KC 스타일) ──────────────────────────────────────── */

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

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-[4px] border px-2 py-2 text-[12px] font-semibold transition-colors"
            style={{
              background: active ? KC.accent : KC.bg,
              color: active ? '#fff' : KC.text,
              borderColor: active ? KC.accent : KC.border,
            }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── 모달 셸 (fade/scale 애니메이션 + 백드롭) ──────────────────────── */

function ModalShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: 'rgba(0,0,0,0.45)', opacity: show ? 1 : 0, transition: 'opacity 180ms ease-out' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[440px] overflow-hidden rounded-[6px] shadow-2xl"
        style={{
          background: KC.bg,
          border: `1px solid ${KC.border}`,
          opacity: show ? 1 : 0,
          transform: show ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── 본체 ──────────────────────────────────────────────────────────── */

function TicketForm({ initialKind, initialCraneId, onClose }: {
  initialKind: TicketKind;
  initialCraneId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(['mro2', 'calendar']);
  const createRepair = useCreateRepairTicket();
  const createInspection = useCreateInspectionTicket();
  const createParts = useCreatePartsTicket();

  const cranes = useMemo(() => getAllCraneAssets(), []);
  const technicians = useMemo(() => getTechnicians(), []);
  const inventory = useMemo(() => getAllInventoryItems(), []);

  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [craneId, setCraneId] = useState(initialCraneId ?? cranes[0]?.id ?? '');
  const crane = cranes.find((c) => c.id === craneId) ?? cranes[0];

  const components = useMemo(() => (craneId ? getComponentsByCraneId(craneId) : []), [craneId]);

  // repair
  const [component, setComponent] = useState('');
  const [failure, setFailure] = useState('');
  const [failureType, setFailureType] = useState<'mechanical' | 'electrical' | 'structural' | 'control' | 'other'>('mechanical');
  const [repairPriority, setRepairPriority] = useState<'emergency' | 'high' | 'normal' | 'low'>('normal');
  const [schedStart, setSchedStart] = useState(today());
  const [schedEnd, setSchedEnd] = useState(today());

  // inspection
  const [woType, setWoType] = useState<'frequent' | 'periodic' | 'emergency' | 'special'>('frequent');
  const [inspDate, setInspDate] = useState(today());

  // parts
  const [partRows, setPartRows] = useState<{ partId: string; qty: number }[]>([{ partId: '', qty: 1 }]);

  // shared advanced
  const [performerType, setPerformerType] = useState<'internal' | 'third_party' | 'local'>('internal');
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    firstRender.current = false;
  }, []);

  const assigneeOptions = technicians.filter((x) => x.performerType === performerType);
  const resolvedAssignee =
    assignee.trim() || assigneeOptions[0]?.name || technicians[0]?.name || '';

  const canSubmit =
    !!crane &&
    (kind === 'repair'
      ? failure.trim().length > 0
      : kind === 'inspection'
        ? inspDate.length > 0
        : partRows.some((r) => r.partId));

  const submit = () => {
    if (!crane || !canSubmit) return;
    const base = { craneId: crane.id, craneName: crane.name, siteId: crane.siteId, siteName: crane.siteName };
    let woNumber = '';

    if (kind === 'repair') {
      const wo = createRepair({
        ...base,
        componentName: component.trim() || 'General',
        failureType,
        sourceType: 'breakdown',
        priority: repairPriority,
        repairLevel: 'minor',
        failureDescription: failure.trim(),
        performerType,
        assignedTo: resolvedAssignee,
        scheduledStart: schedStart,
        scheduledEnd: schedEnd,
      });
      woNumber = wo.woNumber;
    } else if (kind === 'inspection') {
      const wo = createInspection({
        ...base,
        woType,
        priority: 'normal',
        scheduledDate: inspDate,
        performerType,
        assignedTo: resolvedAssignee,
      });
      woNumber = wo.woNumber;
    } else {
      const items = partRows
        .filter((r) => r.partId)
        .map((r) => {
          const inv = inventory.find((i) => i.partId === r.partId);
          return {
            partId: r.partId,
            partName: inv?.partName ?? r.partId,
            qty: r.qty,
            unitPrice: inv?.unitPrice ?? 0,
          };
        });
      const req = createParts({
        ...base,
        priority: 'normal',
        requester: resolvedAssignee,
        items,
        note: note.trim() || undefined,
      });
      woNumber = req.requestNumber;
    }

    toast.success(t('mro2:ticket.created', { number: woNumber }));
    onClose();
  };

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: KC.hairline }}>
        <h2 className="text-[15px] font-semibold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
          {t('mro2:ticket.title')}
        </h2>
        <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer">
          <X size={16} style={{ color: KC.ink }} />
        </button>
      </div>

      <div className="flex max-h-[70vh] flex-col gap-3.5 overflow-y-auto px-4 py-4">
        {/* 타입 세그먼트 */}
        <Segmented<TicketKind>
          value={kind}
          onChange={setKind}
          options={[
            { key: 'repair', label: t('mro2:ticket.typeRepair'), icon: <Wrench size={14} /> },
            { key: 'inspection', label: t('mro2:ticket.typeInspection'), icon: <ClipboardCheck size={14} /> },
            { key: 'parts', label: t('mro2:ticket.typeParts'), icon: <Package size={14} /> },
          ]}
        />

        {/* 자산 (공통 필수) */}
        <Field label={t('mro2:ticket.asset')} required>
          <select
            value={craneId}
            onChange={(e) => setCraneId(e.target.value)}
            className={inputBase}
            style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
          >
            {cranes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.model}
              </option>
            ))}
          </select>
        </Field>

        {/* ── 수리 ── */}
        {kind === 'repair' && (
          <>
            <Field label={t('mro2:ticket.failure')} required>
              <textarea
                value={failure}
                onChange={(e) => setFailure(e.target.value)}
                rows={2}
                placeholder={t('mro2:ticket.failurePlaceholder')}
                className={inputBase}
                style={{ borderColor: KC.border, color: KC.ink, background: KC.bg, resize: 'vertical' }}
                autoFocus
              />
            </Field>
            <Field label={t('mro2:ticket.component')}>
              <input
                list="mro2-components"
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                placeholder={t('mro2:ticket.componentPlaceholder')}
                className={inputBase}
                style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
              />
              <datalist id="mro2-components">
                {components
                  .filter((c) => c.parentId === null)
                  .map((c) => (
                    <option key={c.id} value={c.componentName} />
                  ))}
              </datalist>
            </Field>
            <Field label={t('mro2:ticket.priority')}>
              <Segmented
                value={repairPriority}
                onChange={setRepairPriority}
                options={[
                  { key: 'emergency', label: t('mro2:ticket.prioEmergency') },
                  { key: 'high', label: t('mro2:ticket.prioHigh') },
                  { key: 'normal', label: t('mro2:ticket.prioNormal') },
                  { key: 'low', label: t('mro2:ticket.prioLow') },
                ]}
              />
            </Field>
          </>
        )}

        {/* ── 점검 ── */}
        {kind === 'inspection' && (
          <>
            <Field label={t('mro2:ticket.inspectionType')}>
              <Segmented
                value={woType}
                onChange={setWoType}
                options={(['frequent', 'periodic', 'emergency', 'special'] as const).map((k) => ({
                  key: k,
                  label: t(`calendar:type.${k}`),
                }))}
              />
            </Field>
            <Field label={t('mro2:ticket.scheduledDate')} required>
              <input
                type="date"
                value={inspDate}
                onChange={(e) => setInspDate(e.target.value)}
                className={inputBase}
                style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
              />
            </Field>
          </>
        )}

        {/* ── 부품 ── */}
        {kind === 'parts' && (
          <Field label={t('mro2:ticket.parts')} required>
            <div className="flex flex-col gap-1.5">
              {partRows.map((row, i) => (
                <div key={i} className="flex gap-1.5">
                  <select
                    value={row.partId}
                    onChange={(e) =>
                      setPartRows((rows) => rows.map((r, j) => (j === i ? { ...r, partId: e.target.value } : r)))
                    }
                    className={`${inputBase} min-w-0 flex-1`}
                    style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                  >
                    <option value="">{t('mro2:ticket.selectPart')}</option>
                    {inventory.map((inv) => (
                      <option key={inv.partId} value={inv.partId}>
                        {inv.partName} ({inv.partNumber})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.qty}
                    onChange={(e) =>
                      setPartRows((rows) =>
                        rows.map((r, j) => (j === i ? { ...r, qty: Math.max(1, Number(e.target.value) || 1) } : r)),
                      )
                    }
                    className={`${inputBase} w-16 shrink-0`}
                    style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                  />
                  {partRows.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() => setPartRows((rows) => rows.filter((_, j) => j !== i))}
                      className="shrink-0 cursor-pointer px-1"
                      style={{ color: KC.muted }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPartRows((rows) => [...rows, { partId: '', qty: 1 }])}
                className="flex w-fit cursor-pointer items-center gap-1 text-[11px]"
                style={{ color: KC.link }}
              >
                <Plus size={12} /> {t('mro2:ticket.addPart')}
              </button>
            </div>
          </Field>
        )}

        {/* 더 보기 (선택 항목) */}
        <div className="border-t pt-2" style={{ borderColor: KC.hairline }}>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-[11.5px] font-semibold"
            style={{ color: KC.muted }}
          >
            <ChevronDown
              size={13}
              style={{ transform: showAdvanced ? undefined : 'rotate(-90deg)', transition: 'transform 150ms' }}
            />
            {t('mro2:ticket.moreOptions')}
          </button>
          {showAdvanced && (
            <div className="mt-2.5 flex flex-col gap-3">
              <Field label={t('mro2:ticket.performer')}>
                <Segmented
                  value={performerType}
                  onChange={(v) => {
                    setPerformerType(v);
                    setAssignee('');
                  }}
                  options={[
                    { key: 'internal', label: t('mro2:ticket.internal') },
                    { key: 'third_party', label: t('mro2:ticket.thirdParty') },
                    { key: 'local', label: t('mro2:ticket.local') },
                  ]}
                />
              </Field>
              <Field label={kind === 'parts' ? t('mro2:ticket.requester') : t('mro2:ticket.assignee')}>
                <select
                  value={assignee || resolvedAssignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className={inputBase}
                  style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                >
                  {assigneeOptions.map((tech) => (
                    <option key={tech.id} value={tech.name}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </Field>
              {kind === 'repair' && (
                <>
                  <Field label={t('mro2:ticket.failureType')}>
                    <select
                      value={failureType}
                      onChange={(e) => setFailureType(e.target.value as typeof failureType)}
                      className={inputBase}
                      style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                    >
                      {(['mechanical', 'electrical', 'structural', 'control', 'other'] as const).map((k) => (
                        <option key={k} value={k}>
                          {t(`mro2:ticket.ft_${k}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t('mro2:sr.scheduledRange')}>
                      <input
                        type="date"
                        value={schedStart}
                        onChange={(e) => setSchedStart(e.target.value)}
                        className={inputBase}
                        style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                      />
                    </Field>
                    <Field label={t('mro2:ticket.scheduledEnd')}>
                      <input
                        type="date"
                        value={schedEnd}
                        onChange={(e) => setSchedEnd(e.target.value)}
                        className={inputBase}
                        style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                      />
                    </Field>
                  </div>
                </>
              )}
              {kind === 'parts' && (
                <Field label={t('mro2:ticket.note')}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className={inputBase}
                    style={{ borderColor: KC.border, color: KC.ink, background: KC.bg, resize: 'vertical' }}
                  />
                </Field>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: KC.hairline }}>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-[4px] px-3 py-1.5 text-[12px] font-semibold"
          style={{ color: KC.muted }}
        >
          {t('mro2:ticket.cancel')}
        </button>
        <KcButton variant="teal" onClick={submit} style={{ opacity: canSubmit ? 1 : 0.5 }}>
          <Plus size={13} /> {t('mro2:ticket.create')}
        </KcButton>
      </div>
    </>
  );
}

/** 레이아웃에 마운트되는 WO 생성 모달 — URL(?new=)로 열림 */
export function NewTicketModal() {
  const { isOpen, kind, craneId, closeTicket } = useNewTicket();
  if (!isOpen) return null;
  return (
    <ModalShell onClose={closeTicket}>
      {/* key로 열 때마다 폼 상태 초기화 */}
      <TicketForm key={`${kind}-${craneId ?? ''}`} initialKind={kind} initialCraneId={craneId} onClose={closeTicket} />
    </ModalShell>
  );
}
