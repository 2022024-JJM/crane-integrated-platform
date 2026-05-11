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
        'pointer-events-auto absolute bottom-12 left-1/2 z-30 w-80 -translate-x-1/2',
        'border-border bg-popover/95 text-popover-foreground rounded-2xl border p-5 shadow-2xl backdrop-blur-xl',
        'transition duration-200 ease-out',
        selected
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-2 scale-95 opacity-0',
      )}
      style={{
        boxShadow: `0 24px 48px -16px ${palette.shadowColor}, 0 8px 24px -8px rgb(0 0 0 / 0.25)`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('monitoring-overview:map.marker.close')}
        className="text-muted-foreground hover:text-foreground bg-muted hover:bg-accent absolute top-4 right-4 rounded-full"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X />
      </Button>

      <div className="flex items-start gap-4 pr-8">
        <div
          className="border-card flex size-16 shrink-0 items-center justify-center rounded-full border-2 text-white shadow-lg"
          style={{
            backgroundImage: `linear-gradient(135deg, ${palette.fillColor}, ${palette.fillColorTo})`,
            boxShadow: `0 0 20px 2px ${palette.shadowColor}`,
          }}
        >
          <Anchor className="size-8" />
        </div>

        <div className="min-w-0 pt-1">
          <h2 className="text-foreground truncate text-xl font-bold tracking-tight">
            {label}
          </h2>
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="border-border mt-5 border-t pt-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-lg leading-none font-bold tabular-nums">
              {craneCount}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {t('monitoring-overview:map.marker.craneCount')}
            </div>
          </div>

          <div className="bg-border h-11 w-px" />

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: palette.fillColor }}
            />
            <span className="text-foreground truncate text-sm font-medium">
              {statusLabel}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label={t('monitoring-overview:map.marker.openDetails')}
            className="text-foreground bg-muted hover:bg-accent shrink-0 rounded-full"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate();
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <span className="border-border bg-popover/95 absolute bottom-0 left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b" />
    </div>
  );
}
