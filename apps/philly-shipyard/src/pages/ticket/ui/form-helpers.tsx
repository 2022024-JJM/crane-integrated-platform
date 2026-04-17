import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';

export type AccentColor = 'amber' | 'emerald' | 'blue' | 'sky';

const ACCENT_STYLES: Record<AccentColor, { bar: string; text: string; bg: string }> = {
  amber:   { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/5' },
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5' },
  blue:    { bar: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/5' },
  sky:     { bar: 'bg-sky-500',     text: 'text-sky-600 dark:text-sky-400',      bg: 'bg-sky-500/5' },
};

export function FormSection({
  title,
  children,
  icon: Icon,
  accent = 'sky',
  step,
}: {
  title: string;
  children: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: AccentColor;
  step?: number;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-stretch border-b border-border">
        <div className={cn('w-1 shrink-0', s.bar)} />
        <div className={cn('flex flex-1 items-center gap-2.5 px-4 py-2.5', s.bg)}>
          {step !== undefined && (
            <span className={cn('flex size-5 items-center justify-center rounded-full text-[10px] font-bold', s.bar, 'text-white')}>
              {step}
            </span>
          )}
          {Icon && <Icon className={cn('size-3.5', s.text)} />}
          <h3 className={cn('text-[11px] font-bold uppercase tracking-widest', s.text)}>{title}</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">{children}</div>
    </div>
  );
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
  return (
    <div className={cn(colSpan === 2 ? 'sm:col-span-2' : '')}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="block text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
        <span className="inline-block size-1 rounded-full bg-destructive" />
        {error}
      </p>}
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

type ToggleVariant = 'default' | 'priority';

const PRIORITY_COLORS: Record<string, string> = {
  emergency: 'border-red-500 bg-red-500 text-white',
  urgent:    'border-red-500 bg-red-500 text-white',
  high:      'border-orange-500 bg-orange-500 text-white',
  normal:    'border-primary bg-primary text-primary-foreground',
  low:       'border-slate-500 bg-slate-500 text-white',
  scheduled: 'border-blue-500 bg-blue-500 text-white',
};

const PRIORITY_INACTIVE: Record<string, string> = {
  emergency: 'hover:border-red-500/60 hover:text-red-600',
  urgent:    'hover:border-red-500/60 hover:text-red-600',
  high:      'hover:border-orange-500/60 hover:text-orange-600',
  normal:    'hover:border-primary/60 hover:text-primary',
  low:       'hover:border-slate-400 hover:text-slate-600',
  scheduled: 'hover:border-blue-500/60 hover:text-blue-600',
};

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
            ? PRIORITY_COLORS[opt.value] ?? 'border-primary bg-primary text-primary-foreground'
            : 'border-primary bg-primary text-primary-foreground';
        const inactiveClass =
          variant === 'priority'
            ? cn('border-border bg-background text-muted-foreground', PRIORITY_INACTIVE[opt.value])
            : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              isActive ? activeClass + ' shadow-sm' : inactiveClass,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
