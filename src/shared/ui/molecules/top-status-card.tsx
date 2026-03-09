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
        'flex h-[56px] min-w-[156px] items-center gap-2 rounded-xl border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        isSuccess
          ? 'border-[rgba(55,214,122,0.18)] bg-[rgba(7,24,16,0.72)]'
          : 'border-[rgba(255,255,255,0.06)] bg-[rgba(9,14,28,0.82)]',
        className,
      )}
    >
      <div
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
          isSuccess
            ? 'bg-[rgba(55,214,122,0.12)] text-[#37d67a]'
            : 'bg-[rgba(255,166,0,0.1)] text-[#f7b443]',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'text-[10px] uppercase tracking-[0.12em]',
            isSuccess ? 'text-[#5d9271]' : 'text-[#66789f]',
          )}
        >
          {label}
        </div>
        <div
          className={cn(
            'truncate text-[12px] font-semibold',
            isSuccess ? 'text-[#5ff29a]' : 'text-[#dbe5fb]',
          )}
        >
          {value}
        </div>
        {subValue ? (
          <div className={cn('text-[11px]', isSuccess ? 'text-[#8fe3b3]' : 'text-[#8ea0c6]')}>
            {subValue}
          </div>
        ) : null}
      </div>
    </div>
  );
}
