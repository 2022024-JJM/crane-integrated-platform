import type { StatusLevel } from '@crane/core/types/status';
import { statusLevelDotClassName } from '@crane/core/lib/status-colors';
import { cn } from '@crane/core/lib/utils';

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
      className={cn(
        'inline-block size-3 rounded-full',
        statusLevelDotClassName[status],
        className,
      )}
      title={title}
    />
  );
}
