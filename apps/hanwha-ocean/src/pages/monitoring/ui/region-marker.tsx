import { useId } from 'react';
import type { StatusLevel } from '@crane/core/types/status';
import { cn } from '@crane/core/lib/utils';
import { getStatusPalette } from '../model/region-map-types';

interface RegionMarkerProps {
  active: boolean;
  selected: boolean;
  label: string;
  shortCode: string;
  statusLevel: StatusLevel;
  onActivate: () => void;
}

// SiteMarker와 동일한 핀 viewBox: 38x52. 꼬리 끝 = (19, 51).
const PIN_WIDTH = 38;
const PIN_HEIGHT = 52;

export function RegionMarker({
  active,
  selected,
  label,
  shortCode,
  statusLevel,
  onActivate,
}: RegionMarkerProps) {
  const palette = getStatusPalette(statusLevel);
  const isCritical = statusLevel === 'critical';

  const uid = useId().replace(/:/g, '');
  const gradientId = `region-pin-grad-${uid}`;
  const shadowId = `region-pin-shadow-${uid}`;

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
        'group/region-marker relative cursor-pointer outline-none',
        'transition-transform duration-200 ease-out',
        active && 'scale-110',
      )}
      style={{
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
      }}
    >
      {/* critical일 때만 핀 헤드 주변에 옅은 ripple */}
      {isCritical ? (
        <span
          aria-hidden
          className="absolute top-[18px] left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor: palette.rippleColor,
            animation: 'region-map-ripple 1.8s ease-out infinite',
          }}
        />
      ) : null}

      {/* selected 시 status 컬러 ring (핀 헤드 바깥) */}
      {selected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-[19px] left-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            boxShadow: `0 0 0 2px ${palette.fillColor}, 0 0 12px 2px ${palette.fillColor}66`,
          }}
        />
      ) : null}

      <svg
        viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
        width={PIN_WIDTH}
        height={PIN_HEIGHT}
        className={cn(
          'relative drop-shadow-lg transition-[filter] duration-200',
          'group-focus-visible/region-marker:filter-[drop-shadow(0_0_6px_var(--ring))]',
        )}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fillColor} />
            <stop offset="100%" stopColor={palette.fillColorTo} />
          </linearGradient>
          <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              floodColor="rgb(0 0 0)"
              floodOpacity="0.45"
            />
          </filter>
        </defs>
        <path
          d="M19 1 C28.94 1 37 9.06 37 19 C37 28 30 36 19 51 C8 36 1 28 1 19 C1 9.06 9.06 1 19 1 Z"
          fill={`url(#${gradientId})`}
          stroke="var(--card)"
          strokeWidth="2"
          filter={`url(#${shadowId})`}
        />
      </svg>

      {/* shortCode: 헤드 중심(19, 19) */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[19px] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold tracking-tight text-white drop-shadow-sm"
      >
        {shortCode}
      </span>

      {/* 풀 라벨 캡슐: 핀 박스 아래 absolute */}
      <span
        className={cn(
          'pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2',
          'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap',
          'border-border bg-popover text-popover-foreground border px-2.5 py-1 text-[11px] font-semibold',
          'tracking-wide shadow-md transition-all duration-200',
          'translate-y-1 opacity-0',
          'group-hover/region-marker:translate-y-0 group-hover/region-marker:opacity-100',
          'group-focus-visible/region-marker:translate-y-0 group-focus-visible/region-marker:opacity-100',
          active && 'translate-y-0 opacity-100',
          selected && 'bg-accent text-accent-foreground',
        )}
      >
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: palette.fillColor }}
        />
        <span>{label}</span>
      </span>
    </div>
  );
}
