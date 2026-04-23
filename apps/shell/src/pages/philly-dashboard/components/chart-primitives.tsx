import type { ReactNode } from 'react';
import type { RepairStatus, FailureType } from '@crane/domain/maintenance';
import type { AssetStatus } from '@crane/domain/asset';
import { cn } from '@crane/core/lib/utils';

export function ChartArea({
  children,
  className,
  height = 240,
}: {
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      {children}
    </div>
  );
}

// ── Color tokens (light/dark 공통, global.css의 --chart-N) ────

export const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  received: 'var(--chart-4)',
  waiting_parts: 'var(--chart-1)',
  in_progress: 'var(--chart-20)',
  re_inspection: 'var(--chart-9)',
  completed: 'var(--chart-2)',
  on_hold: 'var(--chart-8)',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  operating: 'var(--chart-2)',
  inspection: 'var(--chart-1)',
  repair: 'var(--chart-5)',
  idle: 'var(--chart-8)',
  decommissioned: 'var(--chart-7)',
};

export const FAILURE_TYPE_COLORS: Record<FailureType, string> = {
  mechanical: 'var(--chart-16)',
  electrical: 'var(--chart-20)',
  structural: 'var(--chart-8)',
  control: 'var(--chart-9)',
  other: 'var(--chart-7)',
};

export const TREND_COLORS = {
  completed: 'var(--chart-2)',
  emergency: 'var(--chart-5)',
};

// ── Tooltip ─────────────────────────────────────────────────────

export interface TooltipEntry {
  label: string;
  value: string | number;
  color: string;
}

export function DashboardTooltip({
  active,
  title,
  entries,
}: {
  active?: boolean;
  title?: string;
  entries: TooltipEntry[];
}) {
  if (!active || entries.length === 0) return null;
  return (
    <div className="border-border bg-popover/95 min-w-[160px] rounded-xl border p-3 text-xs shadow-lg backdrop-blur-sm">
      {title && <p className="text-popover-foreground font-medium">{title}</p>}
      <div className={cn('space-y-1.5', title && 'mt-2')}>
        {entries.map((e) => (
          <div
            key={e.label}
            className="text-muted-foreground flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: e.color }} />
              <span>{e.label}</span>
            </div>
            <span className="text-foreground font-medium tabular-nums">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Legend ──────────────────────────────────────────────────────

export function ChartLegend({
  items,
  className,
}: {
  items: Array<{ label: string; color: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
