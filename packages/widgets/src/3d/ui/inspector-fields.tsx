import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { RIG_AXES, type RigAxis } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { InputNumber } from '@crane/ui/atoms/input-number';
import type { ModelNodeOption } from '../lib/model-node-tree';
import {
  FIELD_LABEL,
  FIELD_LABEL_COMPACT,
  FIELD_SELECT,
  NUMBER_INPUT,
  NUMBER_WRAPPER,
} from './inspector-field-classes';

export type InspectorT = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/**
 * 라벨 + 컨트롤 한 줄. 라벨 폭은 고정(w-14)이라 여러 행이 정렬된다. `compact`
 * 는 라벨이 짧은 카드용 좁은 라벨 열이다 — 라벨 없는 줄은
 * FIELD_INDENT_COMPACT 로 들여쓴다.
 */
export function Field({
  label,
  compact = false,
  children,
}: {
  label: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={compact ? FIELD_LABEL_COMPACT : FIELD_LABEL}>
        {label}
      </span>
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

/**
 * 네이티브 number 입력 대신 테마 스테퍼가 있는 InputNumber. 비우면 undefined.
 * 인스펙터 필드는 전부 좁아서 편집 중 미리보기 툴팁을 항상 켠다.
 */
export function NumberField({
  value,
  placeholder,
  onChange,
  step = 0.1,
  unit,
  className,
  disabled,
}: {
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  step?: number;
  /** 편집 중 미리보기에 붙일 단위 */
  unit?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <InputNumber
      value={value ?? null}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      editPreview
      unit={unit}
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

/**
 * 접고 펴는 소제목 구역 — SubHeader 와 같은 제목에 chevron 을 붙인 네이티브
 * details. 우측 액션은 summary 밖에 둔다(안에 두면 버튼 클릭이 접힘을
 * 토글한다). 열림 상태는 호출자가 가진다 — 액션이 접힌 구역을 펼 수 있게.
 * 내용은 열려 있을 때만 마운트한다 — 접으면 안쪽 세션 상태가 정리된다.
 */
export function CollapsibleSection({
  title,
  count,
  action,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** 제목 옆 개수(접혀 있어도 내용 유무가 보인다). */
  count?: number;
  action?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <details
        className="group"
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
      >
        <summary className="flex min-h-6 cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden
            className="text-muted-foreground size-3 shrink-0 -rotate-90 transition-transform group-open:rotate-0"
          />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
            {title}
          </span>
          {count !== undefined ? (
            <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
              {count}
            </span>
          ) : null}
        </summary>
        {open ? <div className="mt-1.5">{children}</div> : null}
      </details>
      {action ? <div className="absolute top-0 right-0">{action}</div> : null}
    </div>
  );
}

/** 선택지 몇 개 중 하나 — AxisSegment 와 같은 모양, 글자 폭에 맞춘다. */
export function ChoiceSegment<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 gap-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(
            'h-6 min-w-0 flex-1 cursor-pointer truncate rounded-sm border px-1 text-[10px]',
            value === option.value
              ? 'border-primary/50 bg-primary/15 text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
