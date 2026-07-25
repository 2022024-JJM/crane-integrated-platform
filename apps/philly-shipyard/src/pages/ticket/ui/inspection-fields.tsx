import { useTranslation } from 'react-i18next';
import { FileText, UserCog } from 'lucide-react';
import { DatePicker } from '@crane/ui/molecules/date-picker';
import type { InspectionTicketDraft } from '@crane/features/ticket';
import type { RecurrenceInterval } from '@crane/domain/inspection';
import {
  FormSection,
  FormField,
  ToggleGroup,
  textareaClass,
  type AccentColor,
} from './form-helpers';
import { AssigneeField } from './assignee-field';

export type RecurrenceChoice = RecurrenceInterval | 'none';

export interface InspectionFieldsState {
  woType: InspectionTicketDraft['woType'];
  scheduledDate: string;
  performerType: InspectionTicketDraft['performerType'];
  assignedTo: string;
  findings: string;
  recurrence: RecurrenceChoice;
}

export type InspectionFieldsErrors = Partial<Record<keyof InspectionFieldsState, string>>;

interface InspectionFieldsProps {
  accent: AccentColor;
  state: InspectionFieldsState;
  errors: InspectionFieldsErrors;
  onChange: <K extends keyof InspectionFieldsState>(key: K, value: InspectionFieldsState[K]) => void;
  craneSelectSlot: React.ReactNode;
  prioritySlot: React.ReactNode;
}

export function InspectionFields({
  accent,
  state,
  errors,
  onChange,
  craneSelectSlot,
  prioritySlot,
}: InspectionFieldsProps) {
  const { t } = useTranslation('ticket');

  const woTypeOptions = [
    { value: 'frequent' as const, label: t('inspectionType.frequent') },
    { value: 'periodic' as const, label: t('inspectionType.periodic') },
    { value: 'emergency' as const, label: t('inspectionType.emergency') },
    { value: 'special' as const, label: t('inspectionType.special') },
  ];

  const performerOptions = [
    { value: 'internal' as const, label: t('performerType.internal') },
    { value: 'third_party' as const, label: t('performerType.third_party') },
    { value: 'local' as const, label: t('performerType.local') },
  ];

  const recurrenceOptions: { value: RecurrenceChoice; label: string }[] = [
    { value: 'none', label: t('recurrence.none') },
    { value: 'weekly', label: t('recurrence.weekly') },
    { value: 'biweekly', label: t('recurrence.biweekly') },
    { value: 'monthly', label: t('recurrence.monthly') },
    { value: 'quarterly', label: t('recurrence.quarterly') },
  ];

  function handleWoTypeChange(woType: InspectionFieldsState['woType']) {
    onChange('woType', woType);
    // 정기점검을 고르면 반복주기 매월을 기본 제안 — 사용자가 바꿀 수 있다
    if (woType === 'periodic' && state.recurrence === 'none') {
      onChange('recurrence', 'monthly');
    }
  }

  return (
    <>
      <FormSection title={t('sections.basicInfo')} icon={FileText} accent={accent} step={1}>
        {craneSelectSlot}
        {prioritySlot}

        <FormField label={t('fields.inspectionType')}>
          <ToggleGroup value={state.woType} options={woTypeOptions} onChange={handleWoTypeChange} />
        </FormField>

        <FormField label={t('fields.scheduledDate')} required error={errors.scheduledDate}>
          <DatePicker
            value={state.scheduledDate}
            onChange={(v) => onChange('scheduledDate', v)}
            error={Boolean(errors.scheduledDate)}
          />
        </FormField>

        <FormField
          label={t('fields.recurrence')}
          hint={t('hints.recurrence')}
          colSpan={2}
        >
          <ToggleGroup
            value={state.recurrence}
            options={recurrenceOptions}
            onChange={(v) => onChange('recurrence', v)}
          />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.assignment')} icon={UserCog} accent={accent} step={2}>
        <FormField label={t('fields.performerType')}>
          <ToggleGroup
            value={state.performerType}
            options={performerOptions}
            onChange={(v) => onChange('performerType', v)}
          />
        </FormField>

        <FormField
          label={t('fields.assignedTo')}
          error={errors.assignedTo}
          hint={t('hints.optionalAuto')}
        >
          <AssigneeField
            performerType={state.performerType}
            value={state.assignedTo}
            onValueChange={(v) => onChange('assignedTo', v)}
          />
        </FormField>

        <FormField label={t('fields.findings')} colSpan={2}>
          <textarea
            className={textareaClass}
            rows={3}
            placeholder={t('placeholders.findings')}
            value={state.findings}
            onChange={(e) => onChange('findings', e.target.value)}
          />
        </FormField>
      </FormSection>
    </>
  );
}
