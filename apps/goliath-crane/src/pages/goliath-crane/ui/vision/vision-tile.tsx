import { Camera, Maximize2, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import type { CameraChannel } from './types';

interface VisionTileProps {
  channel: CameraChannel;
  isActive: boolean;
  onExpand: () => void;
}

export function VisionTile({ channel, isActive, onExpand }: VisionTileProps) {
  const { t } = useTranslation('goliath-crane');
  return (
    <div
      className={cn(
        'group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border transition-all',
        isActive
          ? 'border-orange-500/60 ring-1 ring-orange-500/30'
          : 'border-border/40 hover:border-border/70',
        !channel.connected && 'opacity-70',
      )}
      onClick={onExpand}
    >
      <div className="relative flex-1 bg-zinc-800">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,1) 3px,rgba(0,0,0,1) 4px)',
          }}
        />
        {(
          [
            'top-1.5 left-1.5 border-t border-l',
            'top-1.5 right-1.5 border-t border-r',
            'bottom-1.5 left-1.5 border-b border-l',
            'bottom-1.5 right-1.5 border-b border-r',
          ] as const
        ).map((cls, i) => (
          <div
            key={i}
            className={cn('absolute size-3 border-orange-500/50', cls)}
          />
        ))}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          {channel.connected ? (
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
            </span>
          ) : (
            <WifiOff className="size-3 text-red-400/70" />
          )}
        </div>
        <button
          type="button"
          className="absolute top-1.5 right-1.5 z-10 hidden rounded p-1 text-white/60 group-hover:flex hover:bg-white/10 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          aria-label="Expand"
        >
          <Maximize2 className="size-3" />
        </button>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          {channel.connected ? (
            <>
              <div className="relative">
                <Camera className="size-6 text-white/80" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-0.5 w-full rotate-45 bg-white/80" />
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-white">
                {t('vision.noImage')}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="size-6 text-white/80" />
              <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-white">
                {t('vision.noSignal')}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="bg-background/90 flex items-center justify-between px-2 py-1">
        <span
          className={cn(
            'text-[11px] font-bold tracking-wider',
            isActive ? 'text-orange-500' : 'text-muted-foreground',
          )}
        >
          {channel.label}
        </span>
        <span className="text-muted-foreground/60 text-[10px]">
          {t(channel.descriptionKey)}
        </span>
      </div>
    </div>
  );
}
