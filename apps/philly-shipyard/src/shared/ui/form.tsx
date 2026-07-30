/**
 * MRO 공용 폼 프리미티브 — philly-shipyard 전 화면의 단일 폼 소스.
 * (pages/ticket/ui/form-helpers.tsx에서 승격 — 기존 경로는 re-export 심 유지)
 */
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { TONE_TOGGLE_ACTIVE } from './tone';
import { FOCUS_RING } from './controls';
import { PRIORITY_TONE, type TicketPriority } from './status-variants';

// 폼 섹션 accent 색상은 폐기 — 헤더는 뉴트럴 하나로 통일한다. (호환용 타입만 유지)
export type AccentColor = 'amber' | 'emerald' | 'blue' | 'sky';

export function FormSection({
  title,
  children,
  icon: Icon,
  step,
  hint,
  collapsible = false,
  defaultOpen = true,
  forceOpen = false,
}: {
  title: string;
  children: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: AccentColor;
  step?: number;
  /** 헤더 우측 보조 안내 텍스트 (접힘 상태에서 내용을 예고) */
  hint?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** true로 바뀌면 접혀 있어도 강제로 펼친다 (검증 에러/프리필 진입) */
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // forceOpen이 false→true로 바뀌는 순간 펼침 — 렌더 중 상태 조정 패턴 (effect 불필요)
  const [prevForceOpen, setPrevForceOpen] = useState(forceOpen);
  if (forceOpen !== prevForceOpen) {
    setPrevForceOpen(forceOpen);
    if (forceOpen && !open) setOpen(true);
  }
  const expanded = !collapsible || open;

  const header = (
    <>
      <div className="w-1 shrink-0 bg-primary/80" />
      <div className="flex flex-1 items-center gap-2.5 bg-muted/30 px-4 py-2.5">
        {step !== undefined && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {step}
          </span>
        )}
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">{title}</h3>
        {hint && (
          <span className="ml-auto hidden text-[10px] text-muted-foreground/70 sm:block">
            {hint}
          </span>
        )}
        {collapsible && (
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              hint ? '' : 'ml-auto',
              expanded && 'rotate-180',
            )}
          />
        )}
      </div>
    </>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={expanded}
          className={cn(
            'flex w-full cursor-pointer items-stretch text-left transition-colors hover:bg-muted/40',
            expanded && 'border-b border-border',
          )}
        >
          {header}
        </button>
      ) : (
        <div className="flex items-stretch border-b border-border">{header}</div>
      )}
      {expanded && <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">{children}</div>}
    </div>
  );
}

interface FormFieldChildProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  required?: boolean;
}

export function FormField({
  label,
  required,
  error,
  children,
  colSpan,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  colSpan?: 2;
  hint?: string;
}) {
  const reactId = useId();
  const inputId = `field-${reactId}`;
  const errorId = error ? `field-${reactId}-error` : undefined;
  const hintId = hint ? `field-${reactId}-hint` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(' ') || undefined;

  // 단일 자식이 input/select/textarea/button 등이라면 id, aria-* 속성을 주입한다.
  // 자식이 자체적으로 id/aria-*를 들고 있으면 자식의 값을 우선한다.
  let enhancedChildren: ReactNode = children;
  const onlyChild = Children.toArray(children).find(isValidElement);
  if (onlyChild) {
    const child = onlyChild as ReactElement<FormFieldChildProps>;
    enhancedChildren = cloneElement(child, {
      id: child.props.id ?? inputId,
      'aria-describedby': child.props['aria-describedby'] ?? describedBy,
      'aria-invalid': child.props['aria-invalid'] ?? Boolean(error),
      'aria-required': child.props['aria-required'] ?? required,
      required: child.props.required ?? required,
    });
  }

  return (
    <div className={cn(colSpan === 2 ? 'sm:col-span-2' : '')}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-muted-foreground"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </label>
        {hint && (
          <span
            id={hintId}
            className="text-[10px] text-muted-foreground/70"
          >
            {hint}
          </span>
        )}
      </div>
      {enhancedChildren}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 flex items-center gap-1 text-xs text-destructive"
        >
          <span
            aria-hidden="true"
            className="inline-block size-1 rounded-full bg-destructive"
          />
          {error}
        </p>
      )}
    </div>
  );
}

const selectClass =
  'w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all outline-none hover:border-primary/40 focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all outline-none hover:border-primary/40 focus:border-ring focus:ring-2 focus:ring-ring/25 disabled:opacity-50';
const textareaClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-all outline-none hover:border-primary/40 focus:border-ring focus:ring-2 focus:ring-ring/25 resize-none disabled:opacity-50';

export { selectClass, inputClass, textareaClass };

/** 토글/칩 버튼 공통 스타일 — ToggleGroup과 템플릿 피커가 공유하는 단일 소스 */
export const TOGGLE_BASE = `cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${FOCUS_RING}`;
export const TOGGLE_ACTIVE = 'border-primary bg-primary text-primary-foreground';
export const TOGGLE_INACTIVE =
  'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground';

type ToggleVariant = 'default' | 'priority';

// 우선순위 선택 시에만 톤 틴트로 표시 — tone.ts의 TONE_TOGGLE_ACTIVE 단일 소스.
// normal은 톤 없음(null) → 기본 primary 스타일로 폴백.
function priorityActiveClass(priority: string): string {
  const tone = PRIORITY_TONE[priority as TicketPriority];
  if (tone === undefined || tone === null) return TOGGLE_ACTIVE;
  return TONE_TOGGLE_ACTIVE[tone];
}

export function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  variant = 'default',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  variant?: ToggleVariant;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const activeClass =
          variant === 'priority'
            ? priorityActiveClass(opt.value)
            : TOGGLE_ACTIVE;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              TOGGLE_BASE,
              isActive ? activeClass + ' shadow-sm' : TOGGLE_INACTIVE,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
