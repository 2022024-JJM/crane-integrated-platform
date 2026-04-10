import { useState } from 'react';
import { AppLink } from '@crane/ui/atoms/app-link';
import type { CraneRegistryEntry } from '@crane/domain/crane';
import { getCmmsMockData } from '../model/mock-data';

interface CraneSummaryCardProps {
  crane: CraneRegistryEntry;
}

const STATUS_CONFIG = {
  RUN:   { bar: 'bg-emerald-500', dot: 'bg-emerald-400',           label: 'RUN',   labelColor: 'text-emerald-400' },
  FAULT: { bar: 'bg-red-500',     dot: 'bg-red-400 animate-pulse', label: 'FAULT', labelColor: 'text-red-400' },
  STOP:  { bar: 'bg-zinc-600',    dot: 'bg-zinc-500',              label: 'STOP',  labelColor: 'text-zinc-400' },
};

export function CraneSummaryCard({ crane }: CraneSummaryCardProps) {
  const [hovered, setHovered] = useState(false);

  const mockData = getCmmsMockData(crane.craneId);
  const machines = mockData.overview.machines;
  const hoist1 = machines[0];
  const status = hoist1.runFault as 'RUN' | 'FAULT' | 'STOP';
  const cfg = STATUS_CONFIG[status];

  const hasFault = machines.some((m) => m.runFault === 'FAULT');
  const hasAlarm = mockData.faultInfo.activeFaults.length > 0 || hasFault;

  return (
    <AppLink
      to={`/crane-detail/${crane.craneId}/overview`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.45)' : 'none',
          transition: 'transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out, background-color 200ms ease-out',
          borderColor: hovered
            ? (hasFault ? 'rgb(248 113 113)' : 'rgb(113 113 122)')
            : (hasFault ? 'rgba(239 68 68 / 0.5)' : 'rgba(255 255 255 / 0.12)'),
        }}
        className="relative flex rounded-lg border overflow-hidden bg-card"
      >
        {/* 왼쪽 상태 바 */}
        <div
          style={{
            width: hovered ? '6px' : '4px',
            transition: 'width 200ms ease-out',
            flexShrink: 0,
          }}
          className={cfg.bar}
        />

        {/* 콘텐츠 */}
        <div
          style={{
            backgroundColor: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
            transition: 'background-color 200ms ease-out',
          }}
          className="flex-1 px-4 py-3 min-w-0"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <span
              style={{
                color: hovered ? 'var(--color-primary)' : undefined,
                transition: 'color 200ms ease-out',
              }}
              className="text-base font-bold tracking-wide text-foreground truncate"
            >
              {crane.craneNo}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasAlarm && (
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <span className={`flex items-center gap-1 text-sm font-semibold ${cfg.labelColor}`}>
                <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* 수치 목록 */}
          <div className="flex flex-col gap-1.5">
            <StatItem label="Speed" value={`${hoist1.speed.toFixed(0)}%`} />
            <StatItem label="Load"  value={hoist1.load != null ? `${hoist1.load.toFixed(1)}t` : '—'} />
            <StatItem label="Pos"   value={`${hoist1.position.toFixed(1)}m`} />
            <StatItem label="Joy"   value={hoist1.joystickStep} />
          </div>
        </div>
      </div>
    </AppLink>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-mono text-foreground tabular-nums">{value}</span>
    </div>
  );
}
