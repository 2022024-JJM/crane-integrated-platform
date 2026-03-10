import { ChevronRight, MapPinned, MapPin, RadioTower } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { MonitoringRegion } from '@/entities/monitoring-region';
import { cn } from '@/shared/lib/utils';

const TEXT = {
  viewHint: '지도에서 지역 선택',
  cranesLabel: '대형 크레인',
} as const;

interface MarkerPosition {
  top: string;
  left: string;
}

const MAP_MARKER_POSITIONS: MarkerPosition[] = [
  { top: '22%', left: '17%' },
  { top: '53%', left: '38%' },
  { top: '30%', left: '68%' },
  { top: '68%', left: '58%' },
];

interface MainRegionOverviewMapProps {
  regions: MonitoringRegion[];
}

function getMarkerStatusClassName(status: MonitoringRegion['status']) {
  if (status === 'warning') {
    return 'bg-[rgba(245,166,35,0.18)] border-[rgba(245,166,35,0.6)] text-[var(--main-page-warn)]';
  }

  if (status === 'error') {
    return 'bg-[rgba(240,71,71,0.16)] border-[rgba(240,71,71,0.6)] text-[var(--main-page-error)]';
  }

  return 'bg-[rgba(61,214,140,0.16)] border-[rgba(61,214,140,0.6)] text-[var(--main-page-ok)]';
}

function getMarkerRingClassName(status: MonitoringRegion['status']) {
  if (status === 'warning') {
    return 'bg-[var(--main-page-warn)]';
  }

  if (status === 'error') {
    return 'bg-[var(--main-page-error)]';
  }

  return 'bg-[var(--main-page-ok)]';
}

function getMarkerPosition(index: number): MarkerPosition {
  const fallbackIndex = index % 4;
  if (index < MAP_MARKER_POSITIONS.length) {
    return MAP_MARKER_POSITIONS[fallbackIndex];
  }

  return {
    top: `${20 + ((index * 17) % 60)}%`,
    left: `${16 + ((index * 23) % 68)}%`,
  };
}

export function MainRegionOverviewMap({ regions }: MainRegionOverviewMapProps) {
  return (
    <section className="relative flex-1 px-[clamp(20px,4vw,40px)] pb-8 animate-[main-page-fade-up_0.5s_0.16s_ease_both]">
      <div className="relative min-h-[320px] overflow-hidden rounded-[12px] border border-(--main-page-border) bg-[linear-gradient(135deg,rgba(245,166,35,0.08)_0%,rgba(255,255,255,0)_55%),radial-gradient(circle_at_12%_18%,rgba(245,166,35,0.18),transparent_22%),radial-gradient(circle_at_82%_72%,rgba(61,214,140,0.16),transparent_30%)] px-5 py-5">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:34px_34px] opacity-40" />
        <div className="relative z-10 h-full min-h-[290px]">
          <div className="mb-3 flex items-center justify-between text-[12px] text-[var(--main-page-text-dim)]">
            <span>{TEXT.viewHint}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px]">
              <MapPinned className="size-3.5" />
              <span>위치 아이콘을 눌러 상세화면으로 이동</span>
            </span>
          </div>
          {regions.map((region, index) => {
            const position = getMarkerPosition(index);

            return (
              <Link
                key={region.id}
                to={region.route}
                state={{ regionId: region.id, regionName: region.name }}
                className={cn(
                  'group/main-page-map absolute w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-[var(--main-page-card)] px-3 py-2 shadow-[0_18px_46px_rgba(0,0,0,0.35)] transition-[transform,border-color] duration-220 hover:-translate-y-1 hover:border-(--main-page-accent)',
                  getMarkerStatusClassName(region.status),
                )}
                style={{ top: position.top, left: position.left }}
              >
                <div
                  className={cn(
                    'mb-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-(--main-page-border)',
                    getMarkerRingClassName(region.status),
                  )}
                >
                  <RadioTower className="size-3.5 text-white" />
                </div>
                <div className="text-[12px] text-(--main-page-text-dim) uppercase tracking-[0.12em]">
                  {region.name}
                </div>
                <div className="text-[15px] leading-snug tracking-[0.02em] font-semibold text-(--main-page-text)">
                  {region.siteName}
                </div>
                <div className="mt-1 text-[11px] text-(--main-page-text-dim)">
                  {region.craneCount} {TEXT.cranesLabel}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-(--main-page-text-dim)">
                  <span>{region.statusLabel}</span>
                  <ChevronRight
                    className="size-3 shrink-0 opacity-60 group-hover/main-page-map:opacity-100"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-end text-[11px] uppercase tracking-[0.12em] text-[var(--main-page-text-dim)]">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3" />
          포트에 따라 지역 상태 반영
        </span>
      </div>
    </section>
  );
}
