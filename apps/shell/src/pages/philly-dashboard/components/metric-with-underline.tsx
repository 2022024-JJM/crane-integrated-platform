import { cn } from '@crane/core/lib/utils';
import { KCC_TEXT, KCC_UNDERLINE, type KccAccent } from '../constants/konecranes-colors';

interface MetricWithUnderlineProps {
  value: number | string;
  label: string;
  accent: KccAccent;
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
}

const VALUE_SIZE = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
} as const;

export function MetricWithUnderline({
  value,
  label,
  accent,
  align = 'center',
  size = 'md',
}: MetricWithUnderlineProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5',
        align === 'center' ? 'items-center' : 'items-start',
      )}
    >
      <span
        className={cn(
          'font-semibold tabular-nums leading-none text-foreground',
          VALUE_SIZE[size],
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          'relative pb-1.5 text-xs font-medium',
          'after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-6 after:rounded-full',
          align === 'center' &&
            'text-center after:left-1/2 after:-translate-x-1/2',
          KCC_UNDERLINE[accent],
          KCC_TEXT[accent],
        )}
      >
        {label}
      </span>
    </div>
  );
}
