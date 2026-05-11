import type { StatusLevel } from '@crane/core/types/status';
import { cn } from '@crane/core/lib/utils';
import { StatusDot } from '@crane/ui';
import { getStatusPalette } from '../model/region-map-types';

interface RegionMarkerProps {
  active: boolean;
  label: string;
  shortCode: string;
  statusLevel: StatusLevel;
  onActivate: () => void;
}

export function RegionMarker({
  active,
  label,
  shortCode,
  statusLevel,
  onActivate,
}: RegionMarkerProps) {
  const palette = getStatusPalette(statusLevel);
  const isCritical = statusLevel === 'critical';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        'group/region-marker relative flex cursor-pointer flex-col items-center outline-none',
        'transition-transform duration-200 ease-out',
        active && 'scale-110',
      )}
    >
      <div className="relative">
        {/* critical 상태에만 옅은 ripple 1개 */}
        {isCritical ? (
          <span
            aria-hidden
            className="absolute inset-0 -z-10 rounded-xl"
            style={{
              backgroundColor: palette.rippleColor,
              animation: 'region-map-ripple 1.6s ease-out infinite',
            }}
          />
        ) : null}

        {/* 본체 칩 */}
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-xl border-2 border-card',
            'shadow-md transition-shadow duration-200',
            'group-hover/region-marker:shadow-lg',
            'group-focus-visible/region-marker:ring-2 group-focus-visible/region-marker:ring-ring',
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, ${palette.fillColor}, ${palette.fillColorTo})`,
          }}
        >
          <span className="text-[11px] font-bold tracking-tight text-white drop-shadow-sm">
            {shortCode}
          </span>
        </div>

        {/* 상태 도트: 우상단 */}
        <StatusDot
          status={statusLevel}
          className="absolute -right-1 -top-1 size-2.5 ring-2 ring-card"
        />
      </div>

      {/* 풀 라벨 캡슐: 호버/포커스 시 노출 */}
      <span
        className={cn(
          'pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2',
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full',
          'border border-border bg-popover px-2 py-0.5 text-[10px] font-semibold text-popover-foreground',
          'shadow-md',
          'opacity-0 translate-y-1 transition-all duration-200',
          'group-hover/region-marker:opacity-100 group-hover/region-marker:translate-y-0',
          'group-focus-visible/region-marker:opacity-100 group-focus-visible/region-marker:translate-y-0',
          active && 'opacity-100 translate-y-0',
        )}
      >
        {label}
      </span>
    </div>
  );
}
