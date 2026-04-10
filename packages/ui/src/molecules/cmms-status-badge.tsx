import type { OnOff, OkNg, RunFaultStatus, OpenClose } from '@crane/core/types/status';
import {
  onOffBadgeClassName,
  okNgBadgeClassName,
  runFaultBadgeClassName,
} from '@crane/core/lib/status-colors';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '../atoms/badge';

// ─── ON / OFF 배지 ────────────────────────────────────────────────
interface OnOffBadgeProps {
  value: OnOff;
  label?: string;
  className?: string;
}
export function OnOffBadge({ value, label, className }: OnOffBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded w-8 h-5 px-0 py-0 text-[10px] font-bold tracking-wide inline-flex items-center justify-center shrink-0',
        onOffBadgeClassName[value],
        className,
      )}
    >
      {label ?? value}
    </Badge>
  );
}

// ─── OK / NG 배지 ─────────────────────────────────────────────────
interface OkNgBadgeProps {
  value: OkNg;
  className?: string;
}
export function OkNgBadge({ value, className }: OkNgBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded w-8 h-5 px-0 py-0 text-[10px] font-bold tracking-wide inline-flex items-center justify-center shrink-0',
        okNgBadgeClassName[value],
        className,
      )}
    >
      {value}
    </Badge>
  );
}

// ─── RUN / FAULT / STOP 배지 ──────────────────────────────────────
interface RunFaultBadgeProps {
  value: RunFaultStatus;
  className?: string;
}
export function RunFaultBadge({ value, className }: RunFaultBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded px-2 py-0.5 text-[11px] font-bold h-auto',
        runFaultBadgeClassName[value],
        className,
      )}
    >
      {value}
    </Badge>
  );
}

// ─── 열림 / 닫힘 배지 ─────────────────────────────────────────────
interface OpenCloseBadgeProps {
  value: OpenClose;
  className?: string;
}
export function OpenCloseBadge({ value, className }: OpenCloseBadgeProps) {
  const isOpen = value === '열림';
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide h-auto',
        isOpen
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-zinc-600 bg-zinc-600 text-zinc-300',
        className,
      )}
    >
      {value}
    </Badge>
  );
}
