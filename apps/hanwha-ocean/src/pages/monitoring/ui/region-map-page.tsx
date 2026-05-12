import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Radar, ShieldAlert } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { useAllSitesRealtimeSummary } from '../model/use-all-sites-realtime-summary';
import { RegionMap } from './region-map';

type OperationalStatus = 'nominal' | 'caution' | 'alert';

export function RegionMapPage() {
  const { t } = useTranslation();
  const summary = useAllSitesRealtimeSummary();
  const clock = useUtcClock();

  const status: OperationalStatus =
    summary.critical > 0 ? 'alert' : summary.warning > 0 ? 'caution' : 'nominal';

  return (
    <div className="relative flex h-full flex-col overflow-hidden p-6">
      <RegionMap />

      {/* ────── Top tape: mission identity + live UTC clock ────── */}
      <div
        className={cn(
          'pointer-events-none absolute top-6 left-1/2 z-30 -translate-x-1/2',
          'flex items-center gap-3 px-4 py-2',
          'border-border/60 bg-background/55 rounded-full border backdrop-blur-md',
          'font-sans text-xs font-semibold tracking-[0.16em] uppercase',
          'shadow-[0_0_0_1px_color-mix(in_oklab,var(--background)_55%,transparent)]',
        )}
        style={{ animation: 'ops-brief-reveal 600ms ease-out both' }}
      >
        <StatusDot status={status} />
        <span className="text-muted-foreground">Crane Ops</span>
        <span className="text-border">/</span>
        <span className="text-foreground">Global Fleet Map</span>
        <span className="text-border">·</span>
        <span className="text-foreground/90 tabular-nums">{clock}</span>
        <span className="text-muted-foreground/70">UTC</span>
      </div>

      {/* ────── Bottom-left: Operations Brief (KPI module) ────── */}
      <div
        className="pointer-events-none absolute bottom-7 left-28 z-40"
        style={{ animation: 'ops-brief-reveal 700ms ease-out 120ms both' }}
      >
        <OpsBriefPanel status={status}>
          <OpsMetric
            icon={<Radar className="size-4" strokeWidth={1.6} />}
            label={t('monitoring-overview:map.kpi.sites', {
              defaultValue: 'Sites',
            })}
            value={summary.sitesCount}
            tone="neutral"
          />
          <OpsDivider />
          <OpsMetric
            icon={<Activity className="size-4" strokeWidth={1.6} />}
            label={t('monitoring-overview:map.kpi.warning', {
              defaultValue: 'Warning',
            })}
            value={summary.warning}
            tone="warning"
          />
          <OpsDivider />
          <OpsMetric
            icon={<ShieldAlert className="size-4" strokeWidth={1.6} />}
            label={t('monitoring-overview:map.kpi.critical', {
              defaultValue: 'Critical',
            })}
            value={summary.critical}
            tone="critical"
          />
        </OpsBriefPanel>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Operations Brief: bracket-cornered HUD frame
 * ────────────────────────────────────────────────────────────────────────── */

function OpsBriefPanel({
  status,
  children,
}: {
  status: OperationalStatus;
  children: ReactNode;
}) {
  const cornerTone =
    status === 'alert'
      ? 'text-red-400'
      : status === 'caution'
      ? 'text-amber-300'
      : 'text-foreground/60';
  const cornerPulse = status !== 'nominal';

  return (
    <div className="pointer-events-auto relative">
      {/* HUD corner brackets */}
      <CornerBracket
        position="tl"
        className={cn(cornerTone, cornerPulse && 'animate-[ops-bracket-pulse_1.6s_ease-in-out_infinite]')}
      />
      <CornerBracket
        position="tr"
        className={cn(cornerTone, cornerPulse && 'animate-[ops-bracket-pulse_1.6s_ease-in-out_infinite]')}
      />
      <CornerBracket
        position="bl"
        className={cn(cornerTone, cornerPulse && 'animate-[ops-bracket-pulse_1.6s_ease-in-out_infinite]')}
      />
      <CornerBracket
        position="br"
        className={cn(cornerTone, cornerPulse && 'animate-[ops-bracket-pulse_1.6s_ease-in-out_infinite]')}
      />

      {/* Panel body */}
      <div
        className={cn(
          'relative flex items-stretch',
          'border-border/50 bg-background/55 rounded-sm border backdrop-blur-xl',
          'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent)]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

type CornerPosition = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_BRACKET_CLASS: Record<CornerPosition, string> = {
  tl: '-top-1 -left-1 border-t border-l',
  tr: '-top-1 -right-1 border-t border-r',
  bl: '-bottom-1 -left-1 border-b border-l',
  br: '-bottom-1 -right-1 border-b border-r',
};

function CornerBracket({
  position,
  className,
}: {
  position: CornerPosition;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute size-3 border-current opacity-90',
        CORNER_BRACKET_CLASS[position],
        className,
      )}
    />
  );
}

function OpsDivider() {
  return (
    <div
      aria-hidden
      className="border-border/40 my-2 w-px self-stretch border-l border-dashed"
    />
  );
}

function OpsMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'neutral' | 'warning' | 'critical';
}) {
  const active = tone !== 'neutral' && value > 0;

  const toneText =
    tone === 'warning'
      ? active
        ? 'text-amber-300'
        : 'text-muted-foreground'
      : tone === 'critical'
      ? active
        ? 'text-red-300'
        : 'text-muted-foreground'
      : 'text-foreground';

  const toneBar =
    tone === 'warning'
      ? active
        ? 'bg-amber-400 shadow-[0_0_10px_rgb(251_191_36/0.7)]'
        : 'bg-muted-foreground/30'
      : tone === 'critical'
      ? active
        ? 'bg-red-400 shadow-[0_0_10px_rgb(248_113_113/0.75)]'
        : 'bg-muted-foreground/30'
      : 'bg-foreground/40';

  return (
    <div className="relative flex items-center gap-3 px-4 py-2.5">
      {/* Left status bar */}
      <span
        aria-hidden
        className={cn('absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full', toneBar)}
      />

      <span className={cn('shrink-0 opacity-85', toneText)}>{icon}</span>

      <div className="flex flex-col items-start leading-tight">
        <span className="text-muted-foreground/90 font-sans text-[11px] font-semibold tracking-[0.16em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            'font-sans text-2xl font-bold tabular-nums',
            toneText,
          )}
        >
          {value.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Top tape pieces
 * ────────────────────────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: OperationalStatus }) {
  const tone =
    status === 'alert'
      ? 'bg-red-400 shadow-[0_0_10px_rgb(248_113_113/0.8)]'
      : status === 'caution'
      ? 'bg-amber-400 shadow-[0_0_10px_rgb(251_191_36/0.8)]'
      : 'bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.7)]';

  return (
    <span className="relative inline-flex items-center">
      <span className={cn('size-1.5 rounded-full', tone)} />
      {status !== 'nominal' ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full',
            tone,
            'animate-[ops-bracket-pulse_1.4s_ease-in-out_infinite]',
          )}
        />
      ) : null}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Live UTC clock — HH:MM:SS, 1 Hz tick
 * ────────────────────────────────────────────────────────────────────────── */

function useUtcClock() {
  const [now, setNow] = useState(() => formatUtc(new Date()));
  useEffect(() => {
    const id = setInterval(() => setNow(formatUtc(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatUtc(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
