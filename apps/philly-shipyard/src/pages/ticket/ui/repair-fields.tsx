import { useTranslation } from 'react-i18next';
import { FileText, UserCog } from 'lucide-react';
import { DatePicker } from '@crane/ui/molecules/date-picker';
import type { RepairTicketDraft } from '@crane/features/ticket';
import {
  FormSection,
  FormField,
  ToggleGroup,
  selectClass,
  inputClass,
  textareaClass,
  type AccentColor,
} from './form-helpers';

export interface RepairFieldsState {
  componentName: string;
  sourceType: RepairTicketDraft['sourceType'];
  failureType: RepairTicketDraft['failureType'];
  repairLevel: RepairTicketDraft['repairLevel'];
  failureDescription: string;
  performerType: RepairTicketDraft['performerType'];
  assignedTo: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export type RepairFieldsErrors = Partial<Record<keyof RepairFieldsState, string>>;

interface RepairFieldsProps {
  accent: AccentColor;
  state: RepairFieldsState;
  errors: RepairFieldsErrors;
  onChange: <K extends keyof RepairFieldsState>(key: K, value: RepairFieldsState[K]) => void;
  craneSelectSlot: React.ReactNode;
  prioritySlot: React.ReactNode;
}

export function RepairFields({
  accent,
  state,
  errors,
  onChange,
  craneSelectSlot,
  prioritySlot,
}: RepairFieldsProps) {
  const { t } = useTranslation('ticket');

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

        <FormField label={t('fields.componentName')} required error={errors.componentName}>
          <input
            className={inputClass}
            placeholder={t('placeholders.componentName')}
            value={state.componentName}
            onChange={(e) => onChange('componentName', e.target.value)}
          />
        </FormField>

        <FormField label={t('fields.sourceType')}>
          <select
            className={selectClass}
            value={state.sourceType}
            onChange={(e) => onChange('sourceType', e.target.value as RepairFieldsState['sourceType'])}
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
            value={state.failureType}
            onChange={(e) => onChange('failureType', e.target.value as RepairFieldsState['failureType'])}
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
            value={state.repairLevel}
            onChange={(e) => onChange('repairLevel', e.target.value as RepairFieldsState['repairLevel'])}
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
            value={state.failureDescription}
            onChange={(e) => onChange('failureDescription', e.target.value)}
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

        <FormField label={t('fields.scheduledStart')} required error={errors.scheduledStart}>
          <DatePicker
            value={state.scheduledStart}
            onChange={(v) => onChange('scheduledStart', v)}
            error={Boolean(errors.scheduledStart)}
          />
        </FormField>

        <FormField label={t('fields.scheduledEnd')} required error={errors.scheduledEnd}>
          <DatePicker
            value={state.scheduledEnd}
            onChange={(v) => onChange('scheduledEnd', v)}
            error={Boolean(errors.scheduledEnd)}
          />
        </FormField>
      </FormSection>
    </>
  );
}
