import { cn } from '@/shared/lib/utils';

export type MonitoringStatusDotTone = 'danger' | 'idle' | 'ok';

interface MonitoringStatusDotProps {
  tone: MonitoringStatusDotTone;
}

export function MonitoringStatusDot({ tone }: MonitoringStatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full bg-[var(--outdoor-page-dot-idle)]',
        tone === 'ok' &&
          'bg-[var(--outdoor-page-dot-ok)] shadow-[var(--outdoor-page-dot-ok-shadow)]',
        tone === 'danger' &&
          'bg-[var(--outdoor-page-dot-danger)] shadow-[var(--outdoor-page-dot-danger-shadow)]',
      )}
    />
  );
}
