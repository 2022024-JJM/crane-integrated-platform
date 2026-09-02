import type { ReactNode } from 'react';
import { RIG_AXES, type RigAxis } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { InputNumber } from '@crane/ui/atoms/input-number';
import type { ModelNodeOption } from '../lib/model-node-tree';
import {
  FIELD_LABEL,
  FIELD_SELECT,
  NUMBER_INPUT,
  NUMBER_WRAPPER,
} from './inspector-field-classes';

export type InspectorT = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/** 라벨 + 컨트롤 한 줄. 라벨 폭은 고정(w-14)이라 여러 행이 정렬된다. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </div>
  );
}

/**
 * GLB 노드 경로 선택. 값이 목록에 없으면(GLB 교체 등) amber 로 표시하고
 * sentinel option 으로 값을 보존한다 — 사용자가 다시 고르기 전엔 지우지 않는다.
 * `rootLabel` 을 주면 '' (모델 루트) 항목을 맨 앞에 둔다.
 */
export function NodeSelect({
  value,
  options,
  onChange,
  rootLabel,
  t,
}: {
  value: string;
  options: ModelNodeOption[];
  onChange: (path: string) => void;
  rootLabel?: string;
  t: InspectorT;
}) {
  const known =
    (rootLabel !== undefined && value === '') ||
    options.some((o) => o.path === value);
  return (
    <select
      className={cn(FIELD_SELECT, !known && 'border-amber-500 text-amber-500')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      title={value}
    >
      {!known ? (
        <option value={value}>
          {t('monitoring:inspector.rigging.unresolvedNode')}: {value || '—'}
        </option>
      ) : null}
      {rootLabel !== undefined ? <option value="">{rootLabel}</option> : null}
      {options.map((o) => (
        <option key={o.path} value={o.path}>
          {o.label.replace(/ /g, ' ')}
          {o.kind === 'mesh' ? ' ▪' : ''}
        </option>
      ))}
    </select>
  );
}

/** x/y/z 세그먼트 — 리깅 관절 축 선택과 같은 모양. */
export function AxisSegment({
  value,
  onChange,
  label,
}: {
  value: RigAxis;
  onChange: (axis: RigAxis) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 gap-0.5" role="group" aria-label={label}>
      {RIG_AXES.map((axis) => (
        <button
          key={axis}
          type="button"
          aria-pressed={value === axis}
          className={cn(
            'h-6 w-6 cursor-pointer rounded-sm border font-mono text-[11px] uppercase',
            value === axis
              ? 'border-primary/50 bg-primary/15 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
          onClick={() => onChange(axis)}
        >
          {axis}
        </button>
      ))}
    </div>
  );
}

/** 네이티브 number 입력 대신 테마 스테퍼가 있는 InputNumber. 비우면 undefined. */
export function NumberField({
  value,
  placeholder,
  onChange,
  step = 0.1,
  className,
  disabled,
}: {
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  step?: number;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <InputNumber
      value={value ?? null}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(NUMBER_WRAPPER, className)}
      inputClassName={NUMBER_INPUT}
      onChange={(next) => onChange(next)}
      onEmpty={() => onChange(undefined)}
    />
  );
}

/** 소제목(uppercase tracking) + 우측 액션 슬롯. */
export function SubHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </p>
      {action}
    </div>
  );
}
