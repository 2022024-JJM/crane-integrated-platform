import { useTranslation } from 'react-i18next';
import { FileText, UserCog } from 'lucide-react';
import { DatePicker } from '@crane/ui/molecules/date-picker';
import type { InspectionTicketDraft } from '@crane/features/ticket';
import {
  FormSection,
  FormField,
  ToggleGroup,
  inputClass,
  textareaClass,
  type AccentColor,
} from './form-helpers';

export interface InspectionFieldsState {
  woType: InspectionTicketDraft['woType'];
  scheduledDate: string;
  performerType: InspectionTicketDraft['performerType'];
  assignedTo: string;
  findings: string;
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

  return (
    <>
      <FormSection title={t('sections.basicInfo')} icon={FileText} accent={accent} step={1}>
        {craneSelectSlot}
        {prioritySlot}

        <FormField label={t('fields.inspectionType')}>
          <ToggleGroup value={state.woType} options={woTypeOptions} onChange={(v) => onChange('woType', v)} />
        </FormField>

        <FormField label={t('fields.scheduledDate')} required error={errors.scheduledDate}>
          <DatePicker
            value={state.scheduledDate}
            onChange={(v) => onChange('scheduledDate', v)}
            error={Boolean(errors.scheduledDate)}
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

        <FormField label={t('fields.assignedTo')} required error={errors.assignedTo}>
          <input
            className={inputClass}
            placeholder={t('placeholders.assignedTo')}
            value={state.assignedTo}
            onChange={(e) => onChange('assignedTo', e.target.value)}
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
