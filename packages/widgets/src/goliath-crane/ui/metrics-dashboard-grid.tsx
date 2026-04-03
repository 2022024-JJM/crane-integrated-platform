import {
  Weight,
  Wind,
  ArrowUpFromLine,
  ArrowDownFromLine,
  MoveHorizontal,
  RotateCcw,
  Clock,
  Repeat2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GoliathCraneDetail } from '@crane/domain/goliath-crane';
import { cn } from '@crane/core/lib/utils';
import { Card, CardContent } from '@crane/ui/molecules/card';
import type { LucideIcon } from 'lucide-react';

interface MetricDef {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  getValue: (c: GoliathCraneDetail) => number;
  getMax: (c: GoliathCraneDetail) => number;
  unit: string;
  decimals: number;
  showProgress: boolean;
}

const METRICS: MetricDef[] = [
  {
    id: 'load',
    labelKey: 'metrics.load',
    icon: Weight,
    getValue: (c) => c.load,
    getMax: (c) => c.maxLoad,
    unit: 'ton',
    decimals: 1,
    showProgress: true,
  },
  {
    id: 'wind',
    labelKey: 'metrics.windSpeed',
    icon: Wind,
    getValue: (c) => c.windSpeed,
    getMax: (c) => c.windSpeedThreshold,
    unit: 'm/s',
    decimals: 1,
    showProgress: true,
  },
  {
    id: 'mainHoist',
    labelKey: 'metrics.mainHoistHeight',
    icon: ArrowUpFromLine,
    getValue: (c) => c.hoistHeight,
    getMax: () => 50,
    unit: 'm',
    decimals: 1,
    showProgress: true,
  },
  {
    id: 'auxHoist',
    labelKey: 'metrics.auxHoistHeight',
    icon: ArrowDownFromLine,
    getValue: (c) => c.auxHoistHeight,
    getMax: () => 50,
    unit: 'm',
    decimals: 1,
    showProgress: true,
  },
  {
    id: 'trolley',
    labelKey: 'metrics.trolleyPosition',
    icon: MoveHorizontal,
    getValue: (c) => c.trolleyPosition,
    getMax: (c) => c.girderLength,
    unit: 'm',
    decimals: 1,
    showProgress: true,
  },
  {
    id: 'slew',
    labelKey: 'metrics.slewAngle',
    icon: RotateCcw,
    getValue: (c) => c.slewAngle,
    getMax: () => 360,
    unit: '°',
    decimals: 0,
    showProgress: false,
  },
  {
    id: 'hours',
    labelKey: 'metrics.operatingHours',
    icon: Clock,
    getValue: (c) => c.operatingHoursToday,
    getMax: () => 24,
    unit: 'h',
    decimals: 1,
    showProgress: true,
  },
  {
    id: 'cycles',
    labelKey: 'metrics.cycleCount',
    icon: Repeat2,
    getValue: (c) => c.cycleCountToday,
    getMax: () => 300,
    unit: '',
    decimals: 0,
    showProgress: false,
  },
];

function getProgressColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function MetricItem({
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
    <Card size="sm" className="border-border/90 bg-card/80 border shadow-sm">
      <CardContent className="space-y-2.5 pt-1">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground size-4 shrink-0" />
          <span className="text-muted-foreground text-xs font-medium">
            {t(def.labelKey)}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {value.toFixed(def.decimals)}
          </span>
          <span className="text-muted-foreground text-sm">{def.unit}</span>
          {def.showProgress && (
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">
              / {max}
              {def.unit}
            </span>
          )}
        </div>
        {def.showProgress && (
          <div className="bg-muted/40 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                getProgressColor(percent),
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsDashboardGrid({ crane }: { crane: GoliathCraneDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {METRICS.map((def) => (
        <MetricItem key={def.id} def={def} crane={crane} />
      ))}
    </div>
  );
}
