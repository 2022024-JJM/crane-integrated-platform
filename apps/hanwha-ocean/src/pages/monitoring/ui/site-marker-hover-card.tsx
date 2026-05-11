import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import type { Site } from '@crane/domain/region';
import { getStatusPalette } from '../model/region-map-types';

interface SiteMarkerHoverCardProps {
  site: Site;
  status: StatusLevel;
  visible: boolean;
}

// 핀 박스(38x52) 기준 위쪽에 띄우는 hover summary.
// AdvancedMarker anchor 계산이 박스 크기에만 의존하도록 absolute로 박스 바깥에 배치한다.
// pointer-events-none 유지: 마커 onMouseLeave가 카드 영역에서 끊기지 않도록.
export function SiteMarkerHoverCard({
  site,
  status,
  visible,
}: SiteMarkerHoverCardProps) {
  const { t } = useTranslation();
  const palette = getStatusPalette(status);
  const displayName = t(site.displayNameKey);
  const country = t(site.countryKey, { defaultValue: '' });
  const statusLabel = t(`common:status.${status}`, { defaultValue: status });

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute left-1/2 bottom-full mb-3 -translate-x-1/2',
        'z-40 w-60 origin-bottom',
        'transition-all duration-200 ease-out',
        visible
          ? 'translate-y-0 scale-100 opacity-100'
          : 'translate-y-2 scale-95 opacity-0',
      )}
    >
      {/* 상태 컬러 외광 — 카드 뒤에 깔리는 soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl blur-2xl"
        style={{
          backgroundImage: `radial-gradient(closest-side, ${palette.fillColor}33, transparent 70%)`,
        }}
      />

      {/* 메인 카드: gradient border 트릭 = 외곽 gradient + 안쪽 패딩 박스 */}
      <div
        className="relative rounded-2xl p-px shadow-2xl"
        style={{
          backgroundImage: `linear-gradient(180deg, ${palette.fillColor}66 0%, var(--border) 35%, var(--border) 100%)`,
        }}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-[15px]',
            'bg-popover/90 text-popover-foreground backdrop-blur-xl',
          )}
        >
          {/* 상단 status 컬러 stripe */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-0.5"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent 0%, ${palette.fillColor} 25%, ${palette.fillColorTo} 75%, transparent 100%)`,
            }}
          />

          {/* 안쪽 hairline highlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-px h-px bg-foreground/10"
          />

          <div className="px-4 pt-3.5 pb-3">
            {/* Header: 사이트명 + glow dot */}
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="relative mt-1.5 flex size-2 shrink-0 items-center justify-center"
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: palette.fillColor,
                    boxShadow: `0 0 8px 2px ${palette.fillColor}aa`,
                  }}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-popover-foreground truncate text-[13px] font-semibold tracking-tight">
                  {displayName}
                </p>
                {country ? (
                  <p className="text-muted-foreground mt-0.5 truncate text-[11px] font-medium">
                    {country}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Status row: uppercase label + glow chip */}
            <div className="border-border/60 mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                Status
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                style={{
                  color: palette.fillColor,
                  backgroundColor: `${palette.fillColor}1a`,
                  boxShadow: `inset 0 0 0 1px ${palette.fillColor}33`,
                }}
              >
                <span
                  aria-hidden
                  className="size-1 rounded-full"
                  style={{
                    backgroundColor: palette.fillColor,
                    boxShadow: `0 0 4px ${palette.fillColor}`,
                  }}
                />
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 꼬리 — 카드 톤과 일치하는 다이아몬드 + status 컬러 살짝 */}
      <span
        aria-hidden
        className="border-border bg-popover/90 absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b"
        style={{
          boxShadow: `0 6px 12px -4px ${palette.fillColor}33`,
        }}
      />
    </div>
  );
}
