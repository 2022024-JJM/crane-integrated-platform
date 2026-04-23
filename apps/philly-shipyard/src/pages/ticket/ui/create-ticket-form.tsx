import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  FormField,
  ToggleGroup,
  selectClass,
  type AccentColor,
} from './form-helpers';
import { useCraneOptions } from './use-crane-options';
import { TicketPreview } from './ticket-preview';
import { RepairFields, type RepairFieldsState, type RepairFieldsErrors } from './repair-fields';
import {
  InspectionFields,
  type InspectionFieldsState,
  type InspectionFieldsErrors,
} from './inspection-fields';
import { PartsFields, type PartsFieldsState, type PartsFieldsErrors } from './parts-fields';

type TicketType = 'repair' | 'inspection' | 'parts';
type AnyPriority = 'emergency' | 'urgent' | 'high' | 'normal' | 'low' | 'scheduled';

interface CraneRef {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
}

interface UnifiedForm extends CraneRef, RepairFieldsState, InspectionFieldsState, PartsFieldsState {
  priority: AnyPriority;
}

type UnifiedErrors = RepairFieldsErrors &
  InspectionFieldsErrors &
  PartsFieldsErrors & {
    craneId?: string;
  };

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
    setForm((f) => ({
      ...f,
      craneId: crane.id,
      craneName: crane.name,
      siteId: crane.siteId,
      siteName: crane.siteName,
    }));
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
    set(
      'items',
      form.items.map((item, i) =>
        i === idx
          ? { partId: inv.partId, partName: inv.partName, qty: item.qty, unitPrice: inv.unitPrice }
          : item,
      ),
    );
  }

  function updateQty(idx: number, qty: number) {
    set(
      'items',
      form.items.map((item, i) => (i === idx ? { ...item, qty: Math.max(1, qty) } : item)),
    );
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
      if (form.items.length === 0 || form.items.some((i) => !i.partId)) {
        e.items = t('validation.partsRequired');
      }
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
      return;
    }

    if (type === 'inspection') {
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
      return;
    }

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

  const priorityField = (
    <FormField label={type === 'parts' ? t('fields.requestPriority') : t('fields.priority')}>
      <ToggleGroup
        value={form.priority}
        options={priorityOptions}
        onChange={(v) => set('priority', v)}
        variant="priority"
      />
    </FormField>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'repair' && (
          <RepairFields
            accent={accent}
            state={form}
            errors={errors}
            onChange={(k, v) => set(k as keyof UnifiedForm, v as UnifiedForm[keyof UnifiedForm])}
            craneSelectSlot={craneSelect}
            prioritySlot={priorityField}
          />
        )}
        {type === 'inspection' && (
          <InspectionFields
            accent={accent}
            state={form}
            errors={errors}
            onChange={(k, v) => set(k as keyof UnifiedForm, v as UnifiedForm[keyof UnifiedForm])}
            craneSelectSlot={craneSelect}
            prioritySlot={priorityField}
          />
        )}
        {type === 'parts' && (
          <PartsFields
            accent={accent}
            state={form}
            errors={errors}
            onRequesterChange={(v) => set('requester', v)}
            onNoteChange={(v) => set('note', v)}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
            onUpdateQty={updateQty}
            inventoryItems={inventoryItems}
            craneSelectSlot={craneSelect}
            prioritySlot={priorityField}
          />
        )}

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            {t('submit.cancel')}
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>

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

export type { PartsRequestItem };
