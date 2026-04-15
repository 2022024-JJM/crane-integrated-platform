import {
  Weight,
  Wind,
  ArrowUpFromLine,
  ArrowDownFromLine,
  MoveHorizontal,
  RotateCcw,
  Clock,
  Repeat2,
  ShieldCheck,
  ShieldAlert,
  Anchor,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useGoliathCraneData,
  GoliathCraneSvgDiagram,
} from '@crane/features/goliath-crane';
import type { GoliathCraneDetail } from '@crane/domain/goliath-crane';
import { cn } from '@crane/core/lib/utils';
import { craneStatusBadgeClassName } from '@crane/core/lib/status-colors';
import { Badge } from '@crane/ui/atoms/badge';
import type { LucideIcon } from 'lucide-react';

interface MetricDef {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  getValue: (c: GoliathCraneDetail) => number;
  getMax: (c: GoliathCraneDetail) => number;
  unit: string;
  decimals: number;
}

const METRICS_ROW1: MetricDef[] = [
  {
    id: 'load',
    labelKey: 'metrics.load',
    icon: Weight,
    getValue: (c) => c.load,
    getMax: (c) => c.maxLoad,
    unit: 'ton',
    decimals: 1,
  },
  {
    id: 'wind',
    labelKey: 'metrics.windSpeed',
    icon: Wind,
    getValue: (c) => c.windSpeed,
    getMax: (c) => c.windSpeedThreshold,
    unit: 'm/s',
    decimals: 1,
  },
];

const METRICS_ROW2: MetricDef[] = [
  {
    id: 'mainHoist',
    labelKey: 'metrics.mainHoistHeight',
    icon: ArrowUpFromLine,
    getValue: (c) => c.hoistHeight,
    getMax: () => 50,
    unit: 'm',
    decimals: 1,
  },
  {
    id: 'auxHoist',
    labelKey: 'metrics.auxHoistHeight',
    icon: ArrowDownFromLine,
    getValue: (c) => c.auxHoistHeight,
    getMax: () => 50,
    unit: 'm',
    decimals: 1,
  },
];

const METRICS_ROW3: MetricDef[] = [
  {
    id: 'trolley',
    labelKey: 'metrics.trolleyPosition',
    icon: MoveHorizontal,
    getValue: (c) => c.trolleyPosition,
    getMax: (c) => c.girderLength,
    unit: 'm',
    decimals: 1,
  },
  {
    id: 'slew',
    labelKey: 'metrics.slewAngle',
    icon: RotateCcw,
    getValue: (c) => c.slewAngle,
    getMax: () => 360,
    unit: '°',
    decimals: 0,
  },
  {
    id: 'hours',
    labelKey: 'metrics.operatingHours',
    icon: Clock,
    getValue: (c) => c.operatingHoursToday,
    getMax: () => 24,
    unit: 'h',
    decimals: 1,
  },
  {
    id: 'cycles',
    labelKey: 'metrics.cycleCount',
    icon: Repeat2,
    getValue: (c) => c.cycleCountToday,
    getMax: () => 300,
    unit: '',
    decimals: 0,
  },
];

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getValueColor(percent: number): string {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 70) return 'text-amber-500';
  return 'text-foreground';
}

function LivePulse() {
  return (
    <span className="relative flex size-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function MetricTile({
  def,
  crane,
}: {
  def: MetricDef;
  crane: GoliathCraneDetail;
}) {
  const { t } = useTranslation('goliath-crane');
  const value = def.getValue(crane);
  const max = def.getMax(crane);
  const percent = Math.min((value / max) * 100, 100);
  const Icon = def.icon;

  return (
    <div className="bg-muted/30 space-y-1.5 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="text-muted-foreground size-3 shrink-0" />
        <span className="text-muted-foreground text-[10px] font-medium">
          {t(def.labelKey)}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'text-lg leading-none font-bold tabular-nums',
            getValueColor(percent),
          )}
        >
          {value.toFixed(def.decimals)}
        </span>
        <span className="text-muted-foreground text-[10px]">{def.unit}</span>
        <span className="text-muted-foreground ml-auto text-[9px] tabular-nums">
          / {max}
          {def.unit}
        </span>
      </div>
      <div className="bg-muted/40 h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            getBarColor(percent),
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ProtectionBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-2',
        active ? 'bg-emerald-500/10' : 'bg-red-500/10',
      )}
    >
      {active ? (
        <ShieldCheck className="size-3.5 text-emerald-500" />
      ) : (
        <ShieldAlert className="size-3.5 text-red-500" />
      )}
      <span className="text-[11px] font-medium">{label}</span>
      <span
        className={cn(
          'ml-auto text-[11px] font-bold',
          active ? 'text-emerald-500' : 'text-red-500',
        )}
      >
        {active ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

export function DashboardGoliathCraneStatus() {
  const { t } = useTranslation('goliath-crane');
  const { crane } = useGoliathCraneData();

  return (
    <section className="border-border/90 bg-card/60 rounded border p-4 shadow-sm backdrop-blur-sm md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded bg-(--hanwha-orange-100)/10">
            <Anchor className="size-5 text-(--hanwha-orange-100)" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {crane.craneNo} {t('dashboard.liveStatus')}
            </h2>
            <p className="text-muted-foreground text-xs">{crane.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <LivePulse />
            <span className="text-xs font-medium text-emerald-500">LIVE</span>
          </div>
          <Badge
            variant="outline"
            className={cn('border', craneStatusBadgeClassName[crane.status])}
          >
            {t(`status.${crane.status}`)}
          </Badge>
        </div>
      </div>

      {/* Left: Metrics + Protection | Right: 2D Diagram */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {METRICS_ROW1.map((def) => (
              <MetricTile key={def.id} def={def} crane={crane} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METRICS_ROW2.map((def) => (
              <MetricTile key={def.id} def={def} crane={crane} />
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {METRICS_ROW3.map((def) => (
              <MetricTile key={def.id} def={def} crane={crane} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ProtectionBadge
              active={crane.antiCollisionActive}
              label={t('safety.antiCollision')}
            />
            <ProtectionBadge
              active={crane.overloadProtectionActive}
              label={t('safety.overloadProtection')}
            />
          </div>
        </div>

        <div className="border-border/50 bg-card/80 relative overflow-hidden rounded border">
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
              2D LIVE
            </span>
          </div>
          <GoliathCraneSvgDiagram crane={crane} />
        </div>
      </div>
    </section>
  );
}
