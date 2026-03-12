import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  MonitoringRegion,
  MonitoringRegionStatus,
} from '@/entities/monitoring-region/model/monitoring-region';
import { cn } from '@/shared/lib/utils';

const TEXT = {
  craneLabel: '크레인',
  craneUnit: '기',
  normalLabel: '정상',
  warningLabel: '경고',
  errorLabel: '이상',
} as const;

type SummaryTone = 'ok' | 'warning' | 'error';

function getCardStripeClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    // return 'bg-[var(--main-page-accent)]';
  }

  if (status === 'error') {
    // return 'bg-[var(--main-page-error)]';
  }

  return 'bg-[var(--main-page-border)]';
}

function getCardStatusDotClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'bg-[var(--main-page-warn)] shadow-[0_0_6px_rgb(var(--main-page-warn-rgb)_/_0.6)] [--main-page-blink-shadow:var(--main-page-warn-rgb)] animate-[main-page-blink_2s_ease-in-out_infinite]';
  }

  if (status === 'error') {
    return 'bg-[var(--main-page-error)] shadow-[0_0_6px_rgb(var(--main-page-error-rgb)_/_0.6)] [--main-page-blink-shadow:var(--main-page-error-rgb)] animate-[main-page-blink_1s_ease-in-out_infinite]';
  }

  return 'bg-[var(--main-page-ok)] shadow-[0_0_6px_rgb(var(--main-page-ok-rgb)_/_0.6)]';
}

function getCardFooterSummaryClassName(tone: SummaryTone) {
  if (tone === 'warning') {
    return 'text-[var(--main-page-warn)]';
  }

  if (tone === 'error') {
    return 'text-[var(--main-page-error)]';
  }

  return 'text-[var(--main-page-ok)]';
}

function getRegionStatusSummary(region: MonitoringRegion) {
  return [
    {
      label: TEXT.normalLabel,
      count: region.status === 'normal' ? region.craneCount : 0,
      tone: 'ok' as const,
    },
    {
      label: TEXT.warningLabel,
      count: region.status === 'warning' ? region.craneCount : 0,
      tone: 'warning' as const,
    },
    {
      label: TEXT.errorLabel,
      count: region.status === 'error' ? region.craneCount : 0,
      tone: 'error' as const,
    },
  ];
}

function RegionCraneIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={cn(className)}
      width="80"
      height="70"
      viewBox="0 0 80 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="35"
        y="5"
        width="5"
        height="55"
        fill="var(--main-page-accent)"
        rx="1"
      />
      <rect
        x="25"
        y="5"
        width="45"
        height="3"
        fill="var(--main-page-accent)"
        rx="1"
      />
      <rect
        x="15"
        y="5"
        width="21"
        height="2"
        fill="var(--main-page-accent-strong)"
        rx="1"
      />
      <line
        x1="58"
        y1="8"
        x2="58"
        y2="38"
        stroke="var(--main-page-illustration-line)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect
        x="53"
        y="38"
        width="10"
        height="7"
        rx="1"
        fill="var(--main-page-illustration-body)"
      />
      <rect
        x="27"
        y="58"
        width="18"
        height="8"
        rx="2"
        fill="var(--main-page-border)"
      />
      <rect
        x="22"
        y="64"
        width="28"
        height="5"
        rx="1"
        fill="var(--main-page-illustration-base)"
      />
    </svg>
  );
}

interface MonitoringRegionCardProps {
  region: MonitoringRegion;
  animationDelay: number;
}

export function MonitoringRegionCard({
  region,
  animationDelay,
}: MonitoringRegionCardProps) {
  return (
    <Link
      className="group/main-page-card flex animate-[main-page-fade-up_0.45s_ease_both] flex-col overflow-hidden rounded-[10px] border border-[var(--main-page-border)] bg-[var(--main-page-card)] text-inherit no-underline shadow-[var(--main-page-card-shadow)] transition-[transform,border-color,box-shadow] duration-220 hover:-translate-y-[3px] hover:border-[var(--main-page-accent)] hover:shadow-[var(--main-page-card-hover-shadow)]"
      to={region.route}
      state={{ regionId: region.id, regionName: region.name }}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div
        className={cn(
          'h-0.75 transition-colors duration-220 group-hover/main-page-card:bg-[var(--main-page-accent)]',
          getCardStripeClassName(region.status),
        )}
      />
      <div className="relative flex h-[108px] items-center justify-center overflow-hidden border-b border-[var(--main-page-border)] bg-[linear-gradient(160deg,var(--main-page-card-hero-glow),_transparent_60%)] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[var(--main-page-accent)] after:to-transparent after:opacity-0 after:transition-opacity after:duration-220 after:content-[''] group-hover/main-page-card:after:opacity-[0.55]">
        <RegionCraneIllustration className="opacity-[0.28] transition-opacity duration-220 group-hover/main-page-card:opacity-[0.58]" />
        <div
          className={cn(
            'absolute top-[10px] right-3 size-2 rounded-full',
            getCardStatusDotClassName(region.status),
          )}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="font-['Bebas_Neue',sans-serif] text-[22px] leading-none tracking-[0.06em] text-[var(--main-page-title)]">
          {region.name}
        </div>
        <div className="text-[12px] text-(--main-page-text-dim)">
          {region.siteName} {TEXT.craneLabel} {region.craneCount}{' '}
          {TEXT.craneUnit}
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {region.screens.map((screen) => (
            <div
              key={screen}
              className="inline-flex w-full items-center gap-1.5 rounded-[6px] border border-(--main-page-border) bg-[var(--main-page-chip-bg)] px-2 py-1.5 text-[11px] text-(--main-page-text-dim) transition-[color,border-color,background-color] duration-180 hover:border-[var(--main-page-chip-hover-border)] hover:bg-[var(--main-page-chip-hover-bg)] hover:text-[var(--main-page-text)]"
            >
              <ChevronRight className="size-3.5 shrink-0 stroke-[2.5] text-[var(--main-page-accent)]" />
              {screen}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-(--main-page-border) px-4 py-3 text-[12px] tracking-[0.14em] text-(--main-page-text-dim) uppercase">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {getRegionStatusSummary(region).map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1">
              <span>{item.label}</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  getCardFooterSummaryClassName(item.tone),
                )}
              >
                {item.count}
              </span>
            </span>
          ))}
        </div>
        <ArrowRight
          size={14}
          className="-translate-x-1 text-[var(--main-page-accent)] opacity-0 transition-all duration-220 group-hover/main-page-card:translate-x-0 group-hover/main-page-card:opacity-100"
        />
      </div>
    </Link>
  );
}
