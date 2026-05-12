import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';
import type { StatusLevel } from '@crane/core/types/status';
import { getStatusPalette } from '../model/region-map-types';

interface MarkerHoverCardShellProps {
  visible: boolean;
  statusLevel: StatusLevel;
  kicker: string; // SITE / REGION 등 카테고리 라벨
  title: string;
  subtitle?: string;
  statusLabel: string;
  /** 메인 KPI 블록 (대형 숫자 그리드 등) */
  children?: ReactNode;
  /** 카드 위쪽 여백 — region/site 마커 박스 크기에 따라 조절 */
  marginBottomClass?: string;
}

/**
 * 페이지 OpsBrief 패널과 동일한 HUD 언어로 통일된 hover 카드.
 * - corner brackets
 * - sharp rounded-sm + backdrop-blur-xl
 * - tracking-wide uppercase 라벨
 * - status 색상 → palette.fillColor 그대로 사용
 */
export function MarkerHoverCardShell({
  visible,
  statusLevel,
  kicker,
  title,
  subtitle,
  statusLabel,
  children,
  marginBottomClass = 'mb-3',
}: MarkerHoverCardShellProps) {
  const palette = getStatusPalette(statusLevel);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2',
        marginBottomClass,
        'z-40 w-64 origin-bottom',
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
          backgroundImage: `radial-gradient(closest-side, ${palette.fillColor}40, transparent 70%)`,
        }}
      />

      {/* HUD corner brackets */}
      <CornerBracket position="tl" color={palette.fillColor} />
      <CornerBracket position="tr" color={palette.fillColor} />
      <CornerBracket position="bl" color={palette.fillColor} />
      <CornerBracket position="br" color={palette.fillColor} />

      <div
        className={cn(
          'border-border/70 bg-background/95 relative overflow-hidden rounded-sm border backdrop-blur-xl',
          'shadow-[0_18px_60px_-18px_rgba(0,0,0,0.75),inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent)]',
        )}
      >
        {/* 상단 status stripe */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent 0%, ${palette.fillColor} 25%, ${palette.fillColorTo} 75%, transparent 100%)`,
          }}
        />

        {/* Header */}
        <div className="border-border/40 flex items-start gap-2.5 border-b px-4 pt-3 pb-2.5">
          <span
            aria-hidden
            className="relative mt-1 flex size-2 shrink-0 items-center justify-center"
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
            <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.18em] uppercase">
              {kicker}
            </p>
            <p className="text-foreground mt-0.5 truncate text-sm font-semibold tracking-tight">
              {title}
            </p>
            {subtitle ? (
              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-[11px] font-medium">
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Status pill */}
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase"
            style={{
              color: palette.fillColor,
              backgroundColor: `${palette.fillColor}1a`,
              boxShadow: `inset 0 0 0 1px ${palette.fillColor}44`,
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

        {/* Body */}
        {children ? <div className="px-4 py-3">{children}</div> : null}
      </div>

      {/* 꼬리 */}
      <span
        aria-hidden
        className="border-border/70 bg-background/95 absolute bottom-0 left-1/2 size-2.5 -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b backdrop-blur-xl"
        style={{
          boxShadow: `0 6px 12px -4px ${palette.fillColor}33`,
        }}
      />
    </div>
  );
}

function CornerBracket({
  position,
  color,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}) {
  const map: Record<typeof position, string> = {
    tl: '-top-1 -left-1 border-t border-l',
    tr: '-top-1 -right-1 border-t border-r',
    bl: '-bottom-1 -left-1 border-b border-l',
    br: '-bottom-1 -right-1 border-b border-r',
  };
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute size-2.5', map[position])}
      style={{ borderColor: color, opacity: 0.85 }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * KPI 블록: hover summary 내 metric grid
 * ────────────────────────────────────────────────────────────────────────── */

export function HoverKpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">{children}</div>
  );
}

export function HoverKpiCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'warning' | 'critical';
}) {
  const active = tone !== 'neutral' && value > 0;
  const valueColor =
    tone === 'critical'
      ? active
        ? 'text-red-300'
        : 'text-muted-foreground/70'
      : tone === 'warning'
      ? active
        ? 'text-amber-300'
        : 'text-muted-foreground/70'
      : 'text-foreground';
  const barColor =
    tone === 'critical'
      ? active
        ? 'bg-red-400 shadow-[0_0_8px_rgb(248_113_113/0.7)]'
        : 'bg-muted-foreground/25'
      : tone === 'warning'
      ? active
        ? 'bg-amber-400 shadow-[0_0_8px_rgb(251_191_36/0.7)]'
        : 'bg-muted-foreground/25'
      : 'bg-foreground/40';

  return (
    <div className="border-border/40 bg-foreground/5 relative flex flex-col items-start gap-1 rounded-sm border px-2.5 py-2">
      <span
        aria-hidden
        className={cn('absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full', barColor)}
      />
      <span className="text-muted-foreground/90 text-[9px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </span>
      <span className={cn('text-lg leading-none font-bold tabular-nums', valueColor)}>
        {value.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
