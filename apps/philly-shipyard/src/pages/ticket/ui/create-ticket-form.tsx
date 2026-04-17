import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, UserCog, Boxes } from 'lucide-react';
import {
  useCreateRepairTicket,
  useCreateInspectionTicket,
  useCreatePartsTicket,
} from '@crane/features/ticket';
import type {
  RepairTicketDraft,
  InspectionTicketDraft,
  PartsTicketDraft,
} from '@crane/features/ticket';
import { getAllInventoryItems } from '@crane/domain/inventory';
import type { PartsRequestItem } from '@crane/domain/inventory';
import { Button } from '@crane/ui/atoms/button';
import {
  FormSection,
  FormField,
  ToggleGroup,
  selectClass,
  inputClass,
  textareaClass,
  type AccentColor,
} from './form-helpers';
import { useCraneOptions } from './use-crane-options';
import { TicketPreview } from './ticket-preview';

type TicketType = 'repair' | 'inspection' | 'parts';
type AnyPriority = 'emergency' | 'urgent' | 'high' | 'normal' | 'low' | 'scheduled';

interface UnifiedForm {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  priority: AnyPriority;
  performerType: 'internal' | 'third_party' | 'local';
  assignedTo: string;
  componentName: string;
  sourceType: RepairTicketDraft['sourceType'];
  failureType: RepairTicketDraft['failureType'];
  repairLevel: RepairTicketDraft['repairLevel'];
  failureDescription: string;
  scheduledStart: string;
  scheduledEnd: string;
  woType: InspectionTicketDraft['woType'];
  scheduledDate: string;
  findings: string;
  requester: string;
  note: string;
  items: PartsRequestItem[];
}

type UnifiedErrors = Partial<Record<keyof UnifiedForm | 'items', string>>;

const ACCENT_BY_TYPE: Record<TicketType, AccentColor> = {
  repair: 'amber',
  inspection: 'emerald',
  parts: 'blue',
};

function makeInitial(): UnifiedForm {
  const d = new Date().toISOString().slice(0, 10);
  return {
    craneId: '', craneName: '', siteId: '', siteName: '',
    priority: 'normal', performerType: 'internal', assignedTo: '',
    componentName: '', sourceType: 'breakdown', failureType: 'mechanical',
    repairLevel: 'minor', failureDescription: '',
    scheduledStart: d, scheduledEnd: d,
    woType: 'frequent', scheduledDate: d, findings: '',
    requester: '', note: '', items: [],
  };
}

interface CreateTicketFormProps {
  type: TicketType;
  onSuccess: (id?: string) => void;
}

export function CreateTicketForm({ type, onSuccess }: CreateTicketFormProps) {
  const { t } = useTranslation('ticket');
  const cranes = useCraneOptions();
  const inventoryItems = getAllInventoryItems();
  const accent = ACCENT_BY_TYPE[type];

  const createRepair = useCreateRepairTicket();
  const createInspection = useCreateInspectionTicket();
  const createParts = useCreatePartsTicket();

  const [form, setForm] = useState<UnifiedForm>(makeInitial);
  const [errors, setErrors] = useState<UnifiedErrors>({});

  function set<K extends keyof UnifiedForm>(key: K, value: UnifiedForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleCraneChange(craneId: string) {
    const crane = cranes.find((c) => c.id === craneId);
    if (!crane) return;
    setForm((f) => ({ ...f, craneId: crane.id, craneName: crane.name, siteId: crane.siteId, siteName: crane.siteName }));
    setErrors((e) => ({ ...e, craneId: undefined }));
  }

  function addItem() {
    set('items', [...form.items, { partId: '', partName: '', qty: 1, unitPrice: 0 }]);
    setErrors((e) => ({ ...e, items: undefined }));
  }

  function removeItem(idx: number) {
    set('items', form.items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, partId: string) {
    const inv = inventoryItems.find((i) => i.partId === partId);
    if (!inv) return;
    set('items', form.items.map((item, i) =>
      i === idx ? { partId: inv.partId, partName: inv.partName, qty: item.qty, unitPrice: inv.unitPrice } : item,
    ));
  }

  function updateQty(idx: number, qty: number) {
    set('items', form.items.map((item, i) => (i === idx ? { ...item, qty: Math.max(1, qty) } : item)));
  }

  function validate(): boolean {
    const e: UnifiedErrors = {};
    if (!form.craneId) e.craneId = t('validation.craneRequired');
    if (type !== 'parts' && !form.assignedTo.trim()) e.assignedTo = t('validation.assignedToRequired');

    if (type === 'repair') {
      if (!form.componentName.trim()) e.componentName = t('validation.componentRequired');
      if (!form.failureDescription.trim()) e.failureDescription = t('validation.descriptionRequired');
      if (!form.scheduledStart) e.scheduledStart = t('validation.scheduledStartRequired');
      if (!form.scheduledEnd) e.scheduledEnd = t('validation.scheduledEndRequired');
    }
    if (type === 'inspection') {
      if (!form.scheduledDate) e.scheduledDate = t('validation.scheduledDateRequired');
    }
    if (type === 'parts') {
      if (!form.requester.trim()) e.requester = t('validation.requesterRequired');
      if (form.items.length === 0 || form.items.some((i) => !i.partId)) e.items = t('validation.partsRequired');
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error(t('validation.craneRequired'), { description: t('description') });
      return;
    }

    if (type === 'repair') {
      const draft: RepairTicketDraft = {
        craneId: form.craneId, craneName: form.craneName,
        siteId: form.siteId, siteName: form.siteName,
        componentName: form.componentName,
        sourceType: form.sourceType,
        failureType: form.failureType,
        priority: form.priority as RepairTicketDraft['priority'],
        repairLevel: form.repairLevel,
        failureDescription: form.failureDescription,
        performerType: form.performerType,
        assignedTo: form.assignedTo,
        scheduledStart: form.scheduledStart,
        scheduledEnd: form.scheduledEnd,
      };
      const wo = createRepair(draft);
      toast.success(t('toast.repairCreated', { woNumber: wo.woNumber }));
      onSuccess(wo.id);
    } else if (type === 'inspection') {
      const draft: InspectionTicketDraft = {
        craneId: form.craneId, craneName: form.craneName,
        siteId: form.siteId, siteName: form.siteName,
        woType: form.woType,
        priority: form.priority as InspectionTicketDraft['priority'],
        scheduledDate: form.scheduledDate,
        performerType: form.performerType,
        assignedTo: form.assignedTo,
        findings: form.findings || undefined,
      };
      const wo = createInspection(draft);
      toast.success(t('toast.inspectionCreated', { woNumber: wo.woNumber }));
      onSuccess(wo.id);
    } else {
      const draft: PartsTicketDraft = {
        craneId: form.craneId, craneName: form.craneName,
        siteId: form.siteId, siteName: form.siteName,
        priority: form.priority as PartsTicketDraft['priority'],
        requester: form.requester,
        items: form.items,
        note: form.note || undefined,
      };
      const req = createParts(draft);
      toast.success(t('toast.partsCreated', { requestNumber: req.requestNumber }));
      onSuccess();
    }
  }

  const performerOptions = [
    { value: 'internal' as const, label: t('performerType.internal') },
    { value: 'third_party' as const, label: t('performerType.third_party') },
    { value: 'local' as const, label: t('performerType.local') },
  ];

  const priorityOptions =
    type === 'repair'
      ? [
          { value: 'emergency' as const, label: t('priority.emergency') },
          { value: 'high' as const, label: t('priority.high') },
          { value: 'normal' as const, label: t('priority.normal') },
          { value: 'low' as const, label: t('priority.low') },
        ]
      : type === 'inspection'
        ? [
            { value: 'urgent' as const, label: t('priority.urgent') },
            { value: 'high' as const, label: t('priority.high') },
            { value: 'normal' as const, label: t('priority.normal') },
            { value: 'low' as const, label: t('priority.low') },
          ]
        : [
            { value: 'urgent' as const, label: t('requestPriority.urgent') },
            { value: 'normal' as const, label: t('requestPriority.normal') },
            { value: 'scheduled' as const, label: t('requestPriority.scheduled') },
          ];

  const woTypeOptions = [
    { value: 'frequent' as const, label: t('inspectionType.frequent') },
    { value: 'periodic' as const, label: t('inspectionType.periodic') },
    { value: 'emergency' as const, label: t('inspectionType.emergency') },
    { value: 'special' as const, label: t('inspectionType.special') },
  ];

  const submitLabel =
    type === 'repair' ? t('submit.repair') :
    type === 'inspection' ? t('submit.inspection') :
    t('submit.parts');

  const craneSelect = (
    <FormField label={t('fields.crane')} required error={errors.craneId}>
      <select
        className={selectClass}
        value={form.craneId}
        onChange={(e) => handleCraneChange(e.target.value)}
      >
        <option value="">{t('fields.cranePlaceholder')}</option>
        {['dock-1', 'dock-2', 'dock-in'].map((siteId) => {
          const site = cranes.filter((c) => c.siteId === siteId);
          if (!site.length) return null;
          return (
            <optgroup key={siteId} label={site[0].siteName}>
              {site.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </FormField>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      {/* ── 왼쪽: 폼 ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Basic Info */}
        <FormSection title={t('sections.basicInfo')} icon={FileText} accent={accent} step={1}>
          {craneSelect}

          <FormField label={type === 'parts' ? t('fields.requestPriority') : t('fields.priority')}>
            <ToggleGroup
              value={form.priority}
              options={priorityOptions}
              onChange={(v) => set('priority', v)}
              variant="priority"
            />
          </FormField>

          {type === 'repair' && (
            <>
              <FormField label={t('fields.componentName')} required error={errors.componentName}>
                <input
                  className={inputClass}
                  placeholder={t('placeholders.componentName')}
                  value={form.componentName}
                  onChange={(e) => set('componentName', e.target.value)}
                />
              </FormField>

              <FormField label={t('fields.sourceType')}>
                <select
                  className={selectClass}
                  value={form.sourceType}
                  onChange={(e) => set('sourceType', e.target.value as UnifiedForm['sourceType'])}
                >
                  <option value="breakdown">{t('sourceType.breakdown')}</option>
                  <option value="inspection">{t('sourceType.inspection')}</option>
                  <option value="preventive">{t('sourceType.preventive')}</option>
                  <option value="predictive">{t('sourceType.predictive')}</option>
                </select>
              </FormField>

              <FormField label={t('fields.failureType')}>
                <select
                  className={selectClass}
                  value={form.failureType}
                  onChange={(e) => set('failureType', e.target.value as UnifiedForm['failureType'])}
                >
                  <option value="mechanical">{t('failureType.mechanical')}</option>
                  <option value="electrical">{t('failureType.electrical')}</option>
                  <option value="structural">{t('failureType.structural')}</option>
                  <option value="control">{t('failureType.control')}</option>
                  <option value="other">{t('failureType.other')}</option>
                </select>
              </FormField>

              <FormField label={t('fields.repairLevel')}>
                <select
                  className={selectClass}
                  value={form.repairLevel}
                  onChange={(e) => set('repairLevel', e.target.value as UnifiedForm['repairLevel'])}
                >
                  <option value="minor">{t('repairLevel.minor')}</option>
                  <option value="major">{t('repairLevel.major')}</option>
                  <option value="overhaul">{t('repairLevel.overhaul')}</option>
                </select>
              </FormField>

              <FormField label={t('fields.failureDescription')} required error={errors.failureDescription} colSpan={2}>
                <textarea
                  className={textareaClass}
                  rows={3}
                  placeholder={t('placeholders.failureDescription')}
                  value={form.failureDescription}
                  onChange={(e) => set('failureDescription', e.target.value)}
                />
              </FormField>
            </>
          )}

          {type === 'inspection' && (
            <>
              <FormField label={t('fields.inspectionType')}>
                <ToggleGroup value={form.woType} options={woTypeOptions} onChange={(v) => set('woType', v)} />
              </FormField>

              <FormField label={t('fields.scheduledDate')} required error={errors.scheduledDate}>
                <input
                  type="date"
                  className={inputClass + ' cursor-pointer'}
                  value={form.scheduledDate}
                  onChange={(e) => set('scheduledDate', e.target.value)}
                />
              </FormField>
            </>
          )}

          {type === 'parts' && (
            <>
              <FormField label={t('fields.requester')} required error={errors.requester}>
                <input
                  className={inputClass}
                  placeholder={t('placeholders.assignedTo')}
                  value={form.requester}
                  onChange={(e) => set('requester', e.target.value)}
                />
              </FormField>

              <FormField label={t('fields.note')} colSpan={2}>
                <textarea
                  className={textareaClass}
                  rows={2}
                  placeholder={t('placeholders.note')}
                  value={form.note}
                  onChange={(e) => set('note', e.target.value)}
                />
              </FormField>
            </>
          )}
        </FormSection>

        {/* Section 2: Assignment (repair/inspection만) */}
        {type !== 'parts' && (
          <FormSection title={t('sections.assignment')} icon={UserCog} accent={accent} step={2}>
            <FormField label={t('fields.performerType')}>
              <ToggleGroup value={form.performerType} options={performerOptions} onChange={(v) => set('performerType', v)} />
            </FormField>

            <FormField label={t('fields.assignedTo')} required error={errors.assignedTo}>
              <input
                className={inputClass}
                placeholder={t('placeholders.assignedTo')}
                value={form.assignedTo}
                onChange={(e) => set('assignedTo', e.target.value)}
              />
            </FormField>

            {type === 'repair' && (
              <>
                <FormField label={t('fields.scheduledStart')} required error={errors.scheduledStart}>
                  <input
                    type="date"
                    className={inputClass + ' cursor-pointer'}
                    value={form.scheduledStart}
                    onChange={(e) => set('scheduledStart', e.target.value)}
                  />
                </FormField>

                <FormField label={t('fields.scheduledEnd')} required error={errors.scheduledEnd}>
                  <input
                    type="date"
                    className={inputClass + ' cursor-pointer'}
                    value={form.scheduledEnd}
                    onChange={(e) => set('scheduledEnd', e.target.value)}
                  />
                </FormField>
              </>
            )}

            {type === 'inspection' && (
              <FormField label={t('fields.findings')} colSpan={2}>
                <textarea
                  className={textareaClass}
                  rows={3}
                  placeholder={t('placeholders.findings')}
                  value={form.findings}
                  onChange={(e) => set('findings', e.target.value)}
                />
              </FormField>
            )}
          </FormSection>
        )}

        {/* Section: Parts (parts만) */}
        {type === 'parts' && (
          <FormSection title={t('sections.parts')} icon={Boxes} accent={accent} step={2}>
            <div className="sm:col-span-2 space-y-2">
              {form.items.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
                  <Boxes className="size-6 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">{t('fields.partName')}</p>
                </div>
              )}
              {form.items.map((item, idx) => (
                <div key={idx} className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary/40">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <select
                    className={selectClass + ' flex-1'}
                    value={item.partId}
                    onChange={(e) => updateItem(idx, e.target.value)}
                  >
                    <option value="">{t('fields.partName')}</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv.partId} value={inv.partId}>{inv.partName}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className={inputClass + ' w-20 text-center'}
                    value={item.qty}
                    onChange={(e) => updateQty(idx, Number(e.target.value))}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {errors.items && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <span className="inline-block size-1 rounded-full bg-destructive" />
                  {errors.items}
                </p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full border-dashed">
                <Plus className="size-4" />
                {t('fields.addPart')}
              </Button>
            </div>
          </FormSection>
        )}

        {/* Action Bar — sticky */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            {t('submit.cancel')}
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>

      {/* ── 오른쪽: 라이브 프리뷰 ── */}
      <div className="hidden lg:block">
        <TicketPreview
          type={type}
          craneName={form.craneName}
          siteName={form.siteName}
          priority={form.priority}
          assignedTo={form.assignedTo}
          requester={form.requester}
          scheduledStart={form.scheduledStart}
          scheduledEnd={form.scheduledEnd}
          scheduledDate={form.scheduledDate}
          componentName={form.componentName}
          itemsCount={form.items.length}
        />
      </div>
    </div>
  );
}
