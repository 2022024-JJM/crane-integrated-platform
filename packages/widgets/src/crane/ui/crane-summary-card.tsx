import { useState } from 'react';
import { AppLink } from '@crane/ui/atoms/app-link';
import {
  getCmmsMockData,
  type CraneRegistryEntry,
} from '@crane/domain/crane';
import { ArrowRight, AlertTriangle, XCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface CraneSummaryCardProps {
  crane: CraneRegistryEntry;
}

const STATUS_CONFIG = {
  RUN:   { accent: '#10b981', accentMuted: 'rgba(16,185,129,0.12)', labelColor: 'text-emerald-400', label: 'RUN'   },
  FAULT: { accent: '#ef4444', accentMuted: 'rgba(239,68,68,0.12)',  labelColor: 'text-red-400',     label: 'FAULT' },
  STOP:  { accent: '#eab308', accentMuted: 'rgba(234,179,8,0.12)',  labelColor: 'text-yellow-400',  label: 'STOP'  },
};

export function CraneSummaryCard({ crane }: CraneSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const mockData = getCmmsMockData(crane.craneId);
  const machines = mockData.overview.machines;
  const hoist1 = machines[0];
  const status = hoist1.runFault as 'RUN' | 'FAULT' | 'STOP';
  const cfg = STATUS_CONFIG[status];

  const faultCount  = machines.filter((m) => m.runFault === 'FAULT').length;
  const runCount    = machines.filter((m) => m.runFault === 'RUN').length;
  const activeFaults = mockData.faultInfo.activeFaults.length;

  // 상태 아이템 목록
  const statusItems = [
    {
      label: 'Hoists',
      ok: runCount,
      total: machines.filter((m) => m.name.startsWith('HOIST')).length,
      hasFault: machines.filter((m) => m.name.startsWith('HOIST') && m.runFault === 'FAULT').length > 0,
    },
    {
      label: 'Trolleys',
      ok: machines.filter((m) => m.name.includes('TROLLEY') && m.runFault === 'RUN').length,
      total: machines.filter((m) => m.name.includes('TROLLEY')).length,
      hasFault: machines.filter((m) => m.name.includes('TROLLEY') && m.runFault === 'FAULT').length > 0,
    },
    {
      label: 'Gantry',
      ok: machines.filter((m) => m.name.startsWith('GANTRY') && m.runFault === 'RUN').length,
      total: machines.filter((m) => m.name.startsWith('GANTRY')).length,
      hasFault: machines.filter((m) => m.name.startsWith('GANTRY') && m.runFault === 'FAULT').length > 0,
    },
    {
      label: 'Active Faults',
      ok: 0,
      total: activeFaults,
      hasFault: activeFaults > 0,
      isCounter: true,
    },
  ];

  const totalAlarms = faultCount + activeFaults;

  return (
    <div
      className="rounded-lg border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 flex flex-col"
      style={{ borderColor: cfg.accent, borderWidth: '1.5px' }}
    >
      {/* ── 헤더 ── */}
      <div
        className="flex items-center justify-between px-3 py-2 gap-2"
        style={{ backgroundColor: cfg.accentMuted }}
      >
        {/* 크레인 번호 + 알람 뱃지 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-bold tracking-wide text-foreground truncate">
            {crane.craneNo}
          </span>
          {totalAlarms > 0 && (
            <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-pulse">
              {totalAlarms}
            </span>
          )}
        </div>

        {/* 현재 부하 + 링크 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-muted-foreground">Load</span>
            <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color: cfg.accent }}>
              {hoist1.load != null ? `${hoist1.load.toFixed(1)}t` : '—'}
            </span>
          </div>
          <AppLink
            to={`/crane-detail/${crane.craneId}/overview`}
            className="flex items-center justify-center size-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ color: cfg.accent }}
            onClick={(e) => e.stopPropagation()}
          >
            <ArrowRight className="size-3.5" />
          </AppLink>
        </div>
      </div>

      {/* ── 메인 수치 바 ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <MetricPill label="Spd"  value={`${hoist1.speed.toFixed(0)}%`}  />
          <MetricPill label="Pos"  value={`${hoist1.position.toFixed(1)}m`} />
          <MetricPill label="Joy"  value={hoist1.joystickStep} />
        </div>
        <span className={`text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded`}
          style={{ color: cfg.accent, backgroundColor: cfg.accentMuted }}>
          {cfg.label}
        </span>
      </div>

      {/* ── 상태 아이템 그리드 ── */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-3 py-2">
        {statusItems.map((item) => (
          <StatusItem key={item.label} {...item} />
        ))}
      </div>

      {/* ── 확장 영역 (기계별 상태) ── */}
      {expanded && (
        <div className="px-3 pb-2 border-t border-border/50">
          <div className="pt-2 grid grid-cols-1 gap-0.5">
            {machines.map((m) => {
              const s = m.runFault as 'RUN' | 'FAULT' | 'STOP';
              const mc = STATUS_CONFIG[s];
              return (
                <div key={m.name} className="flex items-center justify-between py-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium truncate">{m.name}</span>
                  <span className="text-[10px] font-bold font-mono shrink-0 ml-2" style={{ color: mc.accent }}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 토글 버튼 ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-center w-full py-1 border-t border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        aria-label={expanded ? '접기' : '펼치기'}
      >
        {expanded
          ? <ChevronUp  className="size-3" />
          : <ChevronDown className="size-3" />
        }
      </button>
    </div>
  );
}

/* ── 내부 컴포넌트 ── */

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-[11px] font-mono font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function StatusItem({
  label,
  ok,
  total,
  hasFault,
  isCounter,
}: {
  label: string;
  ok: number;
  total: number;
  hasFault: boolean;
  isCounter?: boolean;
}) {
  const allOk = !hasFault && (isCounter ? total === 0 : ok === total);

  const Icon = hasFault
    ? XCircle
    : isCounter && total > 0
      ? AlertTriangle
      : CheckCircle2;

  const iconColor = hasFault
    ? 'text-red-400'
    : isCounter && total > 0
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`size-3 shrink-0 ${iconColor}`} />
      <span className="text-[10px] text-muted-foreground truncate">{label}</span>
      <span className={`text-[10px] font-mono font-semibold ml-auto shrink-0 ${allOk ? 'text-emerald-400' : hasFault ? 'text-red-400' : 'text-amber-400'}`}>
        {isCounter ? total : `${ok}/${total}`}
      </span>
    </div>
  );
}
