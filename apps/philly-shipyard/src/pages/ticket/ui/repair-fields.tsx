import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, Zap } from 'lucide-react';
import { DatePicker } from '@crane/ui/molecules/date-picker';
import type { RepairTicketDraft } from '@crane/features/ticket';
import {
  FormSection,
  FormField,
  ToggleGroup,
  selectClass,
  textareaClass,
  type AccentColor,
} from './form-helpers';
import { ComponentCombobox } from './component-combobox';
import { AssigneeField } from './assignee-field';

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
  /** 구성품 자동완성용 — 선택된 크레인 */
  craneId: string;
  /** 프리필 딥링크로 진입한 경우 상세 옵션을 미리 펼친다 */
  advancedDefaultOpen?: boolean;
}

export function RepairFields({
  accent,
  state,
  errors,
  onChange,
  craneSelectSlot,
  prioritySlot,
  craneId,
  advancedDefaultOpen = false,
}: RepairFieldsProps) {
  const { t } = useTranslation('ticket');

  const performerOptions = [
    { value: 'internal' as const, label: t('performerType.internal') },
    { value: 'third_party' as const, label: t('performerType.third_party') },
    { value: 'local' as const, label: t('performerType.local') },
  ];

  // 상세 옵션 안 필드에 검증 에러가 생기면 접힌 채로 숨겨지지 않게 강제로 펼친다
  const advancedHasError = Boolean(
    errors.assignedTo || errors.scheduledStart || errors.scheduledEnd,
  );

  return (
    <>
      <FormSection title={t('sections.quick')} icon={Zap} accent={accent} step={1}>
        {craneSelectSlot}
        {prioritySlot}

        <FormField
          label={t('fields.componentName')}
          error={errors.componentName}
          hint={t('hints.optionalAuto')}
        >
          <ComponentCombobox
            craneId={craneId}
            value={state.componentName}
            onValueChange={(v) => onChange('componentName', v)}
          />
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

      <FormSection
        title={t('sections.advanced')}
        icon={SlidersHorizontal}
        accent={accent}
        step={2}
        hint={t('hints.optionalDefaults')}
        collapsible
        defaultOpen={advancedDefaultOpen}
        forceOpen={advancedHasError}
      >
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

        <FormField label={t('fields.scheduledStart')} error={errors.scheduledStart}>
          <DatePicker
            value={state.scheduledStart}
            onChange={(v) => onChange('scheduledStart', v)}
            error={Boolean(errors.scheduledStart)}
          />
        </FormField>

        <FormField label={t('fields.scheduledEnd')} error={errors.scheduledEnd}>
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
