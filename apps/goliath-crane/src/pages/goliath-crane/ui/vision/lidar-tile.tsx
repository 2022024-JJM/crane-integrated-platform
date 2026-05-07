import { Maximize2, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { GoliathLidarPointCloud } from '../goliath-lidar-point-cloud';

interface LidarTileProps {
  isActive: boolean;
  onExpand: () => void;
}

export function LidarTile({ isActive, onExpand }: LidarTileProps) {
  const { t } = useTranslation('goliath-crane');
  return (
    <div
      className={cn(
        'group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border transition-all',
        isActive
          ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
          : 'border-border/40 hover:border-border/70',
      )}
      onClick={onExpand}
    >
      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        <div className="pointer-events-none absolute inset-0">
          <GoliathLidarPointCloud />
        </div>
        <div className="absolute inset-0" />
        <button
          type="button"
          className="absolute top-1.5 right-1.5 z-10 hidden rounded p-1 text-white/60 group-hover:flex hover:bg-white/10 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          aria-label="Expand LiDAR"
        >
          <Maximize2 className="size-3" />
        </button>
      </div>
      <div className="bg-background/90 flex items-center justify-between px-2 py-1">
        <span
          className={cn(
            'flex items-center gap-1 text-[11px] font-bold tracking-wider',
            isActive ? 'text-cyan-500' : 'text-muted-foreground',
          )}
        >
          <ScanLine className="size-3" />
          LiDAR
        </span>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[9px] text-amber-600 dark:text-amber-400"
        >
          {t('visionStrip.lidarReady')}
        </Badge>
      </div>
    </div>
  );
}
