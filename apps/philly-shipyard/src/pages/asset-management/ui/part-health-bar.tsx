import { cn } from '@crane/core/lib/utils';
import type { ComponentStatus } from '@crane/domain/asset';
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';

interface PartHealthBarProps {
  remainingPct: number;
  componentName: string;
  componentStatus: ComponentStatus;
  className?: string;
}

const STATUS_TONE: Record<ComponentStatus, Tone> = {
  normal: 'positive',
  caution: 'warning',
  warning: 'warning',
  critical: 'critical',
  replace: 'critical',
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
          TONE_TEXT[STATUS_TONE[componentStatus]],
        )}
      >
        {remainingPct}%
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[11px] text-muted-foreground">{componentName}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full', TONE_DOT[STATUS_TONE[componentStatus]])}
            style={{ width: `${filled}%` }}
          />
        </div>
      </div>
    </div>
  );
}
