import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { toLocalDateString } from '../../../shared/lib/relative-date';

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
  /** 점검에서 넘어온 경우 원천 점검 WO 번호 (비노출, 생성 시 기록) */
  sourceWoNumber?: string;
}

interface TicketPrefill {
  craneId?: string;
  componentName?: string;
  sourceWoNumber?: string;
  /** 캘린더 빈 슬롯 클릭 등에서 넘어온 예정일 ('YYYY-MM-DD') */
  date?: string;
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

function makeInitial(prefill: TicketPrefill = {}): UnifiedForm {
  const d = prefill.date ?? toLocalDateString();
  return {
    craneId: prefill.craneId ?? '', craneName: '', siteId: '', siteName: '',
    priority: 'normal', performerType: 'internal', assignedTo: '',
    componentName: prefill.componentName ?? '',
    // 점검(sourceWo)에서 넘어왔으면 원천을 inspection으로 설정
    sourceType: prefill.sourceWoNumber ? 'inspection' : 'breakdown',
    sourceWoNumber: prefill.sourceWoNumber,
    failureType: 'mechanical',
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

  // 프리필 — craneId/component/sourceWo는 점검 상세→수리 접수, date는 캘린더 클릭-생성
  const [params] = useSearchParams();
  const [form, setForm] = useState<UnifiedForm>(() => {
    const dateParam = params.get('date');
    const date =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
    return makeInitial(
      type === 'repair'
        ? {
            craneId: params.get('craneId') ?? undefined,
            componentName: params.get('component') ?? undefined,
            sourceWoNumber: params.get('sourceWo') ?? undefined,
            date,
          }
        : { date },
    );
  });
  const [errors, setErrors] = useState<UnifiedErrors>({});
  // 부품 행의 안정적 React key — index key는 중간 삭제 시 포커스/상태가 어긋난다
  const [itemKeys, setItemKeys] = useState<string[]>([]);
  const nextItemKey = useRef(0);

  // 프리필된 craneId로 크레인명/사이트 정보를 채운다 (cranes 로드 후 1회)
  useEffect(() => {
    if (form.craneId && !form.craneName) {
      const crane = cranes.find((c) => c.id === form.craneId);
      if (crane) {
        setForm((f) => ({
          ...f,
          craneName: crane.name,
          siteId: crane.siteId,
          siteName: crane.siteName,
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cranes]);

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
    setItemKeys((keys) => [...keys, `row-${nextItemKey.current++}`]);
    setErrors((e) => ({ ...e, items: undefined }));
  }

  function removeItem(idx: number) {
    set('items', form.items.filter((_, i) => i !== idx));
    setItemKeys((keys) => keys.filter((_, i) => i !== idx));
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
    // 빈 입력(Number('') = NaN) 방어 — NaN이 draft로 흘러가지 않게 1로 보정
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.round(qty)) : 1;
    set(
      'items',
      form.items.map((item, i) => (i === idx ? { ...item, qty: safeQty } : item)),
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
      // 'YYYY-MM-DD'는 사전순 비교 = 날짜 비교
      if (form.scheduledStart && form.scheduledEnd && form.scheduledEnd < form.scheduledStart) {
        e.scheduledEnd = t('validation.endBeforeStart', {
          defaultValue: 'Scheduled End must be on or after Scheduled Start.',
        });
      }
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
      toast.error(t('validation.formInvalid', { defaultValue: 'Please fix the highlighted fields.' }));
      return;
    }

    if (type === 'repair') {
      const draft: RepairTicketDraft = {
        craneId: form.craneId, craneName: form.craneName,
        siteId: form.siteId, siteName: form.siteName,
        componentName: form.componentName,
        sourceType: form.sourceType,
        sourceWoNumber: form.sourceWoNumber || undefined,
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
        {/* 사이트 그룹은 크레인 데이터에서 파생 — 사이트 추가 시 코드 수정 불필요 */}
        {[...new Set(cranes.map((c) => c.siteId))].map((siteId) => {
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
            itemKeys={itemKeys}
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
