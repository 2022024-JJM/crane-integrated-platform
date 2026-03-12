import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

type TopStatusCardTone = 'default' | 'success';

interface TopStatusCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subValue?: ReactNode;
  tone?: TopStatusCardTone;
  className?: string;
}

export function TopStatusCard({
  icon,
  label,
  value,
  subValue,
  tone = 'default',
  className,
}: TopStatusCardProps) {
  const isSuccess = tone === 'success';

  return (
    <div
      className={cn(
        'flex h-[56px] min-w-[156px] items-center gap-2 rounded-xl border px-3 py-2 shadow-[var(--top-status-card-shadow)]',
        isSuccess
          ? '[--top-status-card-current-bg:var(--top-status-card-success-bg)] [--top-status-card-current-border:var(--top-status-card-success-border)] [--top-status-card-current-icon-bg:var(--top-status-card-success-icon-bg)] [--top-status-card-current-icon:var(--top-status-card-success-icon)] [--top-status-card-current-label:var(--top-status-card-success-label)] [--top-status-card-current-subvalue:var(--top-status-card-success-subvalue)] [--top-status-card-current-value:var(--top-status-card-success-value)]'
          : '[--top-status-card-current-bg:var(--top-status-card-bg)] [--top-status-card-current-border:var(--top-status-card-border)] [--top-status-card-current-icon-bg:var(--top-status-card-icon-bg)] [--top-status-card-current-icon:var(--top-status-card-icon)] [--top-status-card-current-label:var(--top-status-card-label)] [--top-status-card-current-subvalue:var(--top-status-card-subvalue)] [--top-status-card-current-value:var(--top-status-card-value)]',
        'border-[var(--top-status-card-current-border)] bg-[var(--top-status-card-current-bg)]',
        className,
      )}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--top-status-card-current-icon-bg)] text-[var(--top-status-card-current-icon)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] tracking-[0.12em] text-[var(--top-status-card-current-label)] uppercase">
          {label}
        </div>
        <div className="truncate text-[12px] font-semibold text-[var(--top-status-card-current-value)]">
          {value}
        </div>
        {subValue ? (
          <div className="text-[11px] text-[var(--top-status-card-current-subvalue)]">
            {subValue}
          </div>
        ) : null}
      </div>
    </div>
  );
}
