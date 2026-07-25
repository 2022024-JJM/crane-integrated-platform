import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTechnicians } from '@crane/domain/shared';
import type { PerformerType } from '@crane/domain/inspection';
import { inputClass, selectClass } from './form-helpers';

const CUSTOM_VALUE = '__custom__';

interface AssigneeFieldProps {
  performerType: PerformerType;
  value: string;
  onValueChange: (v: string) => void;
  // FormField cloneElement 주입 props
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  required?: boolean;
}

/**
 * 담당자 선택 — 인력 마스터에서 고르는 것이 기본, "직접 입력"으로 자유 텍스트 폴백.
 * 수행 주체(performerType)에 맞는 인력을 우선 정렬한다.
 */
export function AssigneeField({
  performerType,
  value,
  onValueChange,
  ...fieldProps
}: AssigneeFieldProps) {
  const { t } = useTranslation('ticket');
  const technicians = useMemo(() => {
    const all = getTechnicians();
    // 수행 주체와 일치하는 인력을 앞으로 — 목록에서 숨기지는 않는다 (교차 배정 허용)
    return [...all.filter((p) => p.performerType === performerType), ...all.filter((p) => p.performerType !== performerType)];
  }, [performerType]);

  const isKnown = value === '' || technicians.some((p) => p.name === value);
  const [customMode, setCustomMode] = useState(!isKnown);

  if (customMode) {
    return (
      <input
        {...fieldProps}
        className={inputClass}
        placeholder={t('placeholders.assignedTo')}
        value={value}
        autoFocus
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setCustomMode(false);
        }}
      />
    );
  }

  return (
    <select
      {...fieldProps}
      className={selectClass}
      value={value}
      onChange={(e) => {
        if (e.target.value === CUSTOM_VALUE) {
          onValueChange('');
          setCustomMode(true);
          return;
        }
        onValueChange(e.target.value);
      }}
    >
      <option value="">{t('placeholders.assigneeSelect')}</option>
      {technicians.map((p) => (
        <option key={p.id} value={p.name}>
          {p.name} · {t(`performerType.${p.performerType}`)}
        </option>
      ))}
      <option value={CUSTOM_VALUE}>{t('fields.assigneeCustom')}</option>
    </select>
  );
}
