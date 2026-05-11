import { Maximize2, ScanLine } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { SoslabPointCloud } from '../soslab-point-cloud';
import type { LidarSensorKey } from './types';

interface LidarTileProps {
  sensor: LidarSensorKey;
  label: string;
  isActive: boolean;
  onExpand?: () => void;
  fullView?: boolean;
}

const BADGE_TEXT: Record<LidarSensorKey, string> = {
  soslab1: 'SOSLAB',
  soslab2: 'SOSLAB',
  fusion: 'FUSION',
};

export function LidarTile({
  sensor,
  label,
  isActive,
  onExpand,
  fullView = false,
}: LidarTileProps) {
  const interactive = typeof onExpand === 'function';
  return (
    <div
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-lg border transition-all',
        interactive && 'cursor-pointer',
        isActive
          ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
          : cn('border-border/40', interactive && 'hover:border-border/70'),
      )}
      onClick={interactive ? onExpand : undefined}
    >
      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        <div
          className={cn('absolute inset-0', !fullView && 'pointer-events-none')}
        >
          <SoslabPointCloud mode={sensor} compact={!fullView} />
        </div>
        {interactive && <div className="absolute inset-0" />}
        {interactive && (
          <button
            type="button"
            className="absolute top-1.5 right-1.5 z-10 hidden rounded p-1 text-white/60 group-hover:flex hover:bg-white/10 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onExpand?.();
            }}
            aria-label="Expand LiDAR"
          >
            <Maximize2 className="size-3" />
          </button>
        )}
      </div>
      <div className="bg-background/90 flex items-center justify-between px-2 py-1">
        <span
          className={cn(
            'flex items-center gap-1 text-[11px] font-bold tracking-wider',
            isActive ? 'text-cyan-500' : 'text-muted-foreground',
          )}
        >
          <ScanLine className="size-3" />
          {label}
        </span>
        <Badge
          variant="outline"
          className="border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0 text-[9px] text-cyan-600 dark:text-cyan-400"
        >
          {BADGE_TEXT[sensor]}
        </Badge>
      </div>
    </div>
  );
}
