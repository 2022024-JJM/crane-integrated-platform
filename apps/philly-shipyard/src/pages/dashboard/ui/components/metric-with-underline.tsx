import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { FOCUS_RING } from '../../../../shared/ui/controls';
import { KCC_UNDERLINE, type KccAccent } from '../constants/konecranes-colors';

interface MetricWithUnderlineProps {
  value: number | string;
  label: string;
  accent: KccAccent;
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
  /** 클릭 시 이동할 경로 — 수치가 필터된 목록과 1:1일 때만 건다 (MetricCard와 같은 hover 화살표 어포던스) */
  to?: string;
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
  to,
}: MetricWithUnderlineProps) {
  const inner = (
    <>
      <span
        className={cn(
          'flex items-center gap-1 font-semibold tabular-nums leading-none text-foreground',
          VALUE_SIZE[size],
        )}
      >
        {value}
        {to && (
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none" />
        )}
      </span>
      <span
        className={cn(
          'relative pb-1.5 text-xs font-medium text-muted-foreground',
          'after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-6 after:rounded-full',
          align === 'center' &&
            'text-center after:left-1/2 after:-translate-x-1/2',
          KCC_UNDERLINE[accent],
        )}
      >
        {label}
      </span>
    </>
  );

  const wrapper = cn(
    'flex flex-col gap-1.5',
    align === 'center' ? 'items-center' : 'items-start',
  );

  if (to) {
    return (
      <Link to={to} className={cn(wrapper, FOCUS_RING, 'group cursor-pointer rounded')}>
        {inner}
      </Link>
    );
  }
  return <div className={wrapper}>{inner}</div>;
}
