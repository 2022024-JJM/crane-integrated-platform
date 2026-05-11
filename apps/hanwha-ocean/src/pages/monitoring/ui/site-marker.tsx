import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Anchor } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import type { Site } from '@crane/domain/region';
import { getStatusPalette } from '../model/region-map-types';

interface SiteMarkerProps {
  site: Site;
  status: StatusLevel;
  active: boolean;
  onActivate: () => void;
}

// 핀 viewBox 좌표계: 38x52. 꼬리 끝 = (19, 51).
// AdvancedMarker는 자식 박스 중심을 좌표로 두므로,
// 핀만 담은 박스 자체를 translateY(-50%)로 위로 끌어올려 꼬리 끝이 좌표에 닿게 한다.
const PIN_WIDTH = 38;
const PIN_HEIGHT = 52;

export function SiteMarker({
  site,
  status,
  active,
  onActivate,
}: SiteMarkerProps) {
  const { t } = useTranslation();
  const palette = getStatusPalette(status);
  const displayName = t(site.displayNameKey);
  const country = t(site.countryKey, { defaultValue: '' });

  const uid = useId().replace(/:/g, '');
  const gradientId = `site-pin-grad-${uid}`;
  const shadowId = `site-pin-shadow-${uid}`;

  const isCritical = status === 'critical';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={displayName}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        'group/site-marker relative cursor-pointer outline-none',
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
          className="absolute left-1/2 top-[18px] size-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor: palette.rippleColor,
            animation: 'region-map-ripple 1.8s ease-out infinite',
          }}
        />
      ) : null}

      <svg
        viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}
        width={PIN_WIDTH}
        height={PIN_HEIGHT}
        className={cn(
          'relative drop-shadow-lg transition-[filter] duration-200',
          'group-focus-visible/site-marker:filter-[drop-shadow(0_0_6px_var(--ring))]',
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
        {/* 머리(원) + 꼬리(테이퍼) 단일 path. 꼬리 끝 = (19, 51) */}
        <path
          d="M19 1 C28.94 1 37 9.06 37 19 C37 28 30 36 19 51 C8 36 1 28 1 19 C1 9.06 9.06 1 19 1 Z"
          fill={`url(#${gradientId})`}
          stroke="var(--card)"
          strokeWidth="2"
          filter={`url(#${shadowId})`}
        />
      </svg>

      {/* Anchor 아이콘: 헤드 중심(19, 19) */}
      <Anchor
        className="pointer-events-none absolute left-1/2 top-[19px] size-[18px] -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-sm"
        aria-hidden
      />

      {/* 라벨 캡슐: 박스 아래 absolute로 띄워 컨테이너 박스 크기가 핀(38x52)로 고정되도록.
          AdvancedMarker의 anchor 계산이 박스 크기에만 의존하므로 라벨 길이와 무관해진다.
          hover/focus/active 시에만 노출하여 world 레벨 노이즈 최소화. */}
      <span
        className={cn(
          'pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2',
          'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap',
          'border-border bg-popover text-popover-foreground border px-2.5 py-1 text-[11px] font-semibold',
          'tracking-wide shadow-md transition-all duration-200',
          'translate-y-1 opacity-0',
          'group-hover/site-marker:translate-y-0 group-hover/site-marker:opacity-100',
          'group-focus-visible/site-marker:translate-y-0 group-focus-visible/site-marker:opacity-100',
          active && 'bg-accent text-accent-foreground translate-y-0 opacity-100',
        )}
      >
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: palette.fillColor }}
        />
        <span>{displayName}</span>
        {country ? (
          <span className="text-muted-foreground font-normal">· {country}</span>
        ) : null}
      </span>
    </div>
  );
}
