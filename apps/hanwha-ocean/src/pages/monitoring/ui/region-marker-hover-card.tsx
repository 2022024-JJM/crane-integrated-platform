import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import { getStatusPalette } from '../model/region-map-types';

interface RegionMarkerHoverCardProps {
  visible: boolean;
  statusLevel: StatusLevel;
  label: string;
  subtitle: string;
  statusLabel: string;
  craneCount: number;
  craneCountLabel: string;
}

// Region 칩(36x36, anchor=CENTER) 위쪽에 띄우는 hover summary.
// pointer-events-none 유지: 칩 onMouseLeave가 카드 영역에서 끊기지 않도록.
// selected 상태일 때는 RegionInfoCard가 따로 뜨므로 부모에서 visible=false 처리.
export function RegionMarkerHoverCard({
  visible,
  statusLevel,
  label,
  subtitle,
  statusLabel,
  craneCount,
  craneCountLabel,
}: RegionMarkerHoverCardProps) {
  const palette = getStatusPalette(statusLevel);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        // 칩 중심에서 위로. 칩 절반(18px) + 여백.
        'pointer-events-none absolute left-1/2 z-40 -translate-x-1/2',
        'bottom-full mb-5 w-60 origin-bottom',
        'transition-all duration-200 ease-out',
        visible
          ? 'translate-y-0 scale-100 opacity-100'
          : 'translate-y-2 scale-95 opacity-0',
      )}
    >
      {/* 상태 컬러 외광 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-3xl blur-2xl"
        style={{
          backgroundImage: `radial-gradient(closest-side, ${palette.fillColor}33, transparent 70%)`,
        }}
      />

      {/* gradient border wrapper */}
      <div
        className="relative rounded-2xl p-px shadow-2xl shadow-black/60"
        style={{
          backgroundImage: `linear-gradient(180deg, ${palette.fillColor}66 0%, rgb(255 255 255 / 0.08) 35%, rgb(255 255 255 / 0.04) 100%)`,
        }}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-[15px]',
            'bg-zinc-950/85 backdrop-blur-xl',
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
            className="pointer-events-none absolute inset-x-3 top-px h-px bg-white/15"
          />

          <div className="px-4 pt-3.5 pb-3">
            {/* Header: 펄스 dot + 라벨/서브타이틀 */}
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
                <span
                  className="absolute inset-0 rounded-full opacity-60"
                  style={{
                    backgroundColor: palette.fillColor,
                    animation: 'region-map-ripple 1.8s ease-out infinite',
                  }}
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold tracking-tight text-white">
                  {label}
                </p>
                {subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug font-medium text-zinc-400">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Metrics row: crane count + status chip */}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-2.5">
              <div className="min-w-0">
                <div className="text-[15px] leading-none font-bold tabular-nums text-white">
                  {craneCount}
                </div>
                <div className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                  {craneCountLabel}
                </div>
              </div>

              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
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

      {/* 꼬리 */}
      <span
        aria-hidden
        className="absolute left-1/2 bottom-0 size-2.5 -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b border-white/10 bg-zinc-950/85"
        style={{
          boxShadow: `0 6px 12px -4px ${palette.fillColor}33`,
        }}
      />
    </div>
  );
}
