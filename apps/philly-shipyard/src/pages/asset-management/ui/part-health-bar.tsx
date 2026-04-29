import { cn } from '@crane/core/lib/utils';
import type { ComponentStatus } from '@crane/domain/asset';

interface PartHealthBarProps {
  remainingPct: number;
  componentName: string;
  componentStatus: ComponentStatus;
  className?: string;
}

const STATUS_BAR: Record<ComponentStatus, string> = {
  normal: 'bg-emerald-500',
  caution: 'bg-amber-500',
  warning: 'bg-orange-500',
  critical: 'bg-red-500',
  replace: 'bg-red-600',
};

const STATUS_TEXT: Record<ComponentStatus, string> = {
  normal: 'text-emerald-500',
  caution: 'text-amber-500',
  warning: 'text-orange-500',
  critical: 'text-red-500',
  replace: 'text-red-600',
};

export function PartHealthBar({
  remainingPct,
  componentName,
  componentStatus,
  className,
}: PartHealthBarProps) {
  const filled = Math.max(2, Math.min(100, remainingPct));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'shrink-0 text-xs font-bold tabular-nums',
          STATUS_TEXT[componentStatus],
        )}
      >
        {remainingPct}%
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[11px] text-muted-foreground">{componentName}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', STATUS_BAR[componentStatus])}
            style={{ width: `${filled}%` }}
          />
        </div>
      </div>
    </div>
  );
}
