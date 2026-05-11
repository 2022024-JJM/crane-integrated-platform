import { useTranslation } from 'react-i18next';
import { Anchor, ChevronRight, X } from 'lucide-react';
import { Button } from '@crane/ui';
import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import {
  getStatusPalette,
  type MapMarkerStyle,
} from '../model/region-map-types';

interface RegionInfoCardProps {
  statusLevel: StatusLevel;
  craneCount: number;
  label: string;
  subtitle: string;
  statusLabel: string;
  selected: boolean;
  onClose: () => void;
  onNavigate: () => void;
}

export function RegionInfoCard({
  statusLevel,
  craneCount,
  label,
  subtitle,
  statusLabel,
  selected,
  onClose,
  onNavigate,
}: RegionInfoCardProps) {
  const { t } = useTranslation();
  const palette: MapMarkerStyle = getStatusPalette(statusLevel);

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-20 left-1/2 z-30 w-80 -translate-x-1/2',
        'rounded-2xl border border-white/10 bg-zinc-950/90 p-5 text-zinc-100 shadow-2xl shadow-black/60 backdrop-blur-xl',
        'transition duration-200 ease-out',
        selected
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-2 scale-95 opacity-0',
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('monitoring-overview:map.marker.close')}
        className="absolute top-4 right-4 rounded-full bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X />
      </Button>

      <div className="flex items-start gap-4 pr-8">
        <div
          className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-white shadow-lg"
          style={{
            backgroundImage: `linear-gradient(135deg, ${palette.fillColor}, ${palette.fillColorTo})`,
            boxShadow: `0 0 20px 2px ${palette.shadowColor}`,
          }}
        >
          <Anchor className="size-8" />
        </div>

        <div className="min-w-0 pt-1">
          <h2 className="truncate text-xl font-bold tracking-tight">{label}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-lg leading-none font-bold tabular-nums text-white">
              {craneCount}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              {t('monitoring-overview:map.marker.craneCount')}
            </div>
          </div>

          <div className="h-11 w-px bg-white/10" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: palette.fillColor }}
            />
            <span className="truncate text-sm font-medium text-zinc-200">
              {statusLabel}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('monitoring-overview:map.marker.openDetails')}
            className="shrink-0 rounded-full bg-white/10 text-zinc-100 hover:bg-white/20"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate();
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <span className="absolute bottom-0 left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b border-white/10 bg-zinc-950/90" />
    </div>
  );
}
