import type { AlarmSeverity, CraneStatus } from '@crane/core/types/status';
import { severityBadgeClassName, craneStatusBadgeClassName } from '@crane/core/lib/status-colors';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '../atoms/badge';

export function SeverityBadge({
  severity,
  label,
  className,
}: {
  severity: AlarmSeverity;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('border', severityBadgeClassName[severity], className)}
    >
      {label}
    </Badge>
  );
}

export function CraneStatusBadge({
  status,
  label,
  className,
}: {
  status: CraneStatus;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('border', craneStatusBadgeClassName[status], className)}
    >
      {label}
    </Badge>
  );
}
