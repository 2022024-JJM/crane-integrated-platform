import { AppLink } from '@crane/ui/atoms/app-link';
import type { CraneRegistryEntry } from '@crane/domain/crane';
import { getCmmsMockData } from '../model/mock-data';

interface CraneSummaryCardProps {
  crane: CraneRegistryEntry;
}

const STATUS_CONFIG = {
  RUN:   { accent: '#10b981', labelColor: 'text-emerald-400', label: 'RUN'   },
  FAULT: { accent: '#ef4444', labelColor: 'text-red-400',     label: 'FAULT' },
  STOP:  { accent: '#eab308', labelColor: 'text-yellow-400',  label: 'STOP'  },
};

export function CraneSummaryCard({ crane }: CraneSummaryCardProps) {
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
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
    >
      <div
        className="rounded-lg border bg-card overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg"
        style={{
          borderColor: hasFault ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)',
          borderTopColor: cfg.accent,
          borderTopWidth: '2px',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
          <span className="text-sm font-bold tracking-wide text-foreground truncate transition-colors duration-200 group-hover:text-primary">
            {crane.craneNo}
          </span>
          <span className={`text-[11px] font-bold tracking-wider shrink-0 ${cfg.labelColor}`}>
            {hasAlarm && (
              <span className="inline-block size-1.5 rounded-full bg-red-500 animate-pulse mr-1 align-middle" />
            )}
            {cfg.label}
          </span>
        </div>

        {/* 구분선 */}
        <div className="h-px bg-border mx-3" />

        {/* 수치: 4컬럼 가로 배치 */}
        <div className="grid grid-cols-4 px-3 py-2">
          <StatItem label="Spd"  value={`${hoist1.speed.toFixed(0)}%`} />
          <StatItem label="Load" value={hoist1.load != null ? `${hoist1.load.toFixed(1)}t` : '—'} />
          <StatItem label="Pos"  value={`${hoist1.position.toFixed(1)}m`} />
          <StatItem label="Joy"  value={hoist1.joystickStep} />
        </div>
      </div>
    </AppLink>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-[11px] font-mono font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
