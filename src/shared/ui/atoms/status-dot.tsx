import type { StatusLevel } from '@/shared/types/status';
import { statusLevelDotClassName } from '@/shared/lib/status-colors';
import { cn } from '@/shared/lib/utils';

export function StatusDot({
  status,
  title,
  className,
}: {
  status: StatusLevel;
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block size-3 rounded-full', statusLevelDotClassName[status], className)}
      title={title}
    />
  );
}
