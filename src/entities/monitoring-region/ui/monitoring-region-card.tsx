import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  MonitoringRegion,
  MonitoringRegionStatus,
} from '@/entities/monitoring-region/model/monitoring-region';
import { cn } from '@/shared/lib/utils';

const TEXT = {
  craneLabel: '\ud06c\ub808\uc778',
  craneUnit: '\uae30',
} as const;

function getCardStripeClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'bg-[var(--main-page-accent)]';
  }

  if (status === 'error') {
    return 'bg-[var(--main-page-error)]';
  }

  return 'bg-[var(--main-page-border)]';
}

function getCardStatusDotClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'bg-[var(--main-page-warn)] shadow-[0_0_6px_rgb(245_166_35_/_0.6)] animate-[main-page-blink_2s_ease-in-out_infinite]';
  }

  if (status === 'error') {
    return 'bg-[var(--main-page-error)] shadow-[0_0_6px_rgb(240_71_71_/_0.6)] animate-[main-page-blink_1s_ease-in-out_infinite]';
  }

  return 'bg-[var(--main-page-ok)] shadow-[0_0_6px_rgb(61_214_140_/_0.6)]';
}

function getCardFooterStatusClassName(status: MonitoringRegionStatus) {
  if (status === 'warning') {
    return 'text-[var(--main-page-warn)]';
  }

  if (status === 'error') {
    return 'text-[var(--main-page-error)]';
  }

  return 'text-[var(--main-page-text-dim)]';
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
      <rect x="35" y="5" width="5" height="55" fill="#f5a623" rx="1" />
      <rect x="25" y="5" width="45" height="3" fill="#f5a623" rx="1" />
      <rect x="15" y="5" width="21" height="2" fill="#c77a1f" rx="1" />
      <line
        x1="58"
        y1="8"
        x2="58"
        y2="38"
        stroke="#8a96a3"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect x="53" y="38" width="10" height="7" rx="1" fill="#4a525a" />
      <rect x="27" y="58" width="18" height="8" rx="2" fill="#2a2c32" />
      <rect x="22" y="64" width="28" height="5" rx="1" fill="#3a3d45" />
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
      className="group/main-page-card flex flex-col overflow-hidden text-inherit no-underline border border-[var(--main-page-border)] rounded-[10px] bg-[var(--main-page-card)] shadow-[0_22px_60px_rgb(0_0_0_/_0.18)] transition-[transform,border-color,box-shadow] duration-220 hover:-translate-y-[3px] hover:border-[var(--main-page-accent)] hover:shadow-[0_16px_36px_rgb(0_0_0_/_0.42),_0_0_0_1px_rgb(245_166_35_/_0.15)] animate-[main-page-fade-up_0.45s_ease_both]"
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
      <div className="relative h-[108px] flex items-center justify-center overflow-hidden border-b border-[var(--main-page-border)] bg-[linear-gradient(160deg,_rgb(245_166_35_/_0.05),_transparent_60%)] after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-px after:transition-opacity after:duration-220 after:opacity-0 after:bg-gradient-to-r after:from-transparent after:via-[var(--main-page-accent)] after:to-transparent group-hover/main-page-card:after:opacity-[0.55]">
        <RegionCraneIllustration className="group-hover/main-page-card:opacity-[0.58] opacity-[0.28] transition-opacity duration-220" />
        <div
          className={cn(
            'absolute top-[10px] right-3 size-2 rounded-full',
            getCardStatusDotClassName(region.status),
          )}
        />
      </div>
      <div className="flex-1 flex flex-col gap-1.5 p-4">
        <div className="text-[#fff] text-[22px] leading-none tracking-[0.06em] font-['Bebas_Neue',sans-serif]">
          {region.name}
        </div>
        <div className="text-[11px] text-[var(--main-page-text-dim)] font-light">
          {region.siteName} {TEXT.craneLabel} {region.craneCount}
          {TEXT.craneUnit}
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {region.screens.map((screen) => (
            <div
              key={screen}
              className="inline-flex items-center gap-1.5 w-full px-2 py-1.5 border border-[var(--main-page-border)] rounded-[6px] bg-[rgb(255_255_255_/_0.03)] text-[var(--main-page-steel)] text-[11px] transition-[color,border-color,background-color] duration-180 hover:text-[var(--main-page-text)] hover:border-[rgb(245_166_35_/_0.2)] hover:bg-[rgb(245_166_35_/_0.04)]"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-[var(--main-page-text-dim)]" />
              {screen}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--main-page-border)] text-[10px] font-mono text-[var(--main-page-text-dim)] uppercase tracking-[0.14em]">
        <span className={getCardFooterStatusClassName(region.status)}>
          {region.statusLabel}
        </span>
        <ArrowRight
          size={14}
          className="text-[var(--main-page-accent)] opacity-0 -translate-x-1 transition-all duration-220 group-hover/main-page-card:opacity-100 group-hover/main-page-card:translate-x-0"
        />
      </div>
    </Link>
  );
}
