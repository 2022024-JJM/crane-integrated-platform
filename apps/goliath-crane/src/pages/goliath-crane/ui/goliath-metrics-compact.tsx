import {
  Weight,
  Wind,
  ArrowUpFromLine,
  ArrowDownFromLine,
  MoveHorizontal,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Anchor,
  Thermometer,
  Zap,
  Cable,
  CircleCheck,
  CircleAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GoliathCraneDetail } from '@crane/domain/goliath-crane';
import { cn } from '@crane/core/lib/utils';
import { craneStatusBadgeClassName } from '@crane/core/lib/status-colors';
import { Badge } from '@crane/ui/atoms/badge';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import type { LucideIcon } from 'lucide-react';

function getBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getStrokeColor(percent: number): string {
  if (percent >= 90) return 'stroke-red-500';
  if (percent >= 70) return 'stroke-amber-500';
  return 'stroke-emerald-500';
}

function getValueColor(percent: number): string {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 70) return 'text-amber-500';
  return 'text-foreground';
}

// Circular gauge for the two hero metrics (load, wind)
function CircularGauge({
  value,
  max,
  unit,
  label,
  icon: Icon,
  decimals,
}: {
  value: number;
  max: number;
  unit: string;
  label: string;
  icon: LucideIcon;
  decimals: number;
}) {
  const percent = Math.min((value / max) * 100, 100);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="relative">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            className="stroke-muted/30"
            strokeWidth="5"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            className={cn(
              'transition-all duration-700',
              getStrokeColor(percent),
            )}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'text-sm leading-none font-bold tabular-nums',
              getValueColor(percent),
            )}
          >
            {value.toFixed(decimals)}
          </span>
          <span className="text-muted-foreground text-[8px]">{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Icon className="text-muted-foreground size-2.5" />
        <span className="text-muted-foreground text-[9px] font-medium">
          {label}
        </span>
      </div>
    </div>
  );
}

interface MetricRowDef {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  getValue: (c: GoliathCraneDetail) => number;
  getMax: (c: GoliathCraneDetail) => number;
  unit: string;
  decimals: number;
}

const DETAIL_METRICS: MetricRowDef[] = [
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
];

function MetricRow({
  def,
  crane,
}: {
  def: MetricRowDef;
  crane: GoliathCraneDetail;
}) {
  const { t } = useTranslation('goliath-crane');
  const value = def.getValue(crane);
  const max = def.getMax(crane);
  const percent = Math.min((value / max) * 100, 100);
  const Icon = def.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Icon className="text-muted-foreground size-3 shrink-0" />
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
        {t(def.labelKey)}
      </span>
      <span
        className={cn(
          'shrink-0 text-xs font-bold tabular-nums',
          getValueColor(percent),
        )}
      >
        {value.toFixed(def.decimals)}
      </span>
      <div className="bg-muted/40 h-1 w-12 shrink-0 overflow-hidden rounded-full">
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

export function GoliathMetricsCompact({
  crane,
}: {
  crane: GoliathCraneDetail;
}) {
  const { t } = useTranslation('goliath-crane');
  return (
    <div className="flex h-full flex-col">
      {/* Header with crane info */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Anchor className="size-3.5 text-(--hanwha-orange-100)" />
        <span className="text-xs font-semibold">{crane.craneNo}</span>
        <Badge
          variant="outline"
          className={cn(
            'ml-auto border text-[10px]',
            craneStatusBadgeClassName[crane.status],
          )}
        >
          {t(`status.${crane.status}`)}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        {/* Hero gauges: Load + Wind */}
        <div className="border-border/50 flex items-center justify-evenly border-b px-2">
          <CircularGauge
            value={crane.load}
            max={crane.maxLoad}
            unit="ton"
            label={t('metrics.load')}
            icon={Weight}
            decimals={1}
          />
          <div className="bg-border/50 h-10 w-px" />
          <CircularGauge
            value={crane.windSpeed}
            max={crane.windSpeedThreshold}
            unit="m/s"
            label={t('metrics.windSpeed')}
            icon={Wind}
            decimals={1}
          />
        </div>

        {/* Detail metrics */}
        <div className="divide-border/30 divide-y">
          {DETAIL_METRICS.map((def) => (
            <MetricRow key={def.id} def={def} crane={crane} />
          ))}
        </div>

        {/* Protection status */}
        <div className="border-t px-3 py-2">
          <div className="space-y-1">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1',
                crane.antiCollisionActive
                  ? 'bg-emerald-500/10'
                  : 'bg-red-500/10',
              )}
            >
              {crane.antiCollisionActive ? (
                <ShieldCheck className="size-3 text-emerald-500" />
              ) : (
                <ShieldAlert className="size-3 text-red-500" />
              )}
              <span className="text-[10px]">{t('safety.antiCollision')}</span>
              <span
                className={cn(
                  'ml-auto text-[10px] font-bold',
                  crane.antiCollisionActive
                    ? 'text-emerald-500'
                    : 'text-red-500',
                )}
              >
                {crane.antiCollisionActive ? 'ON' : 'OFF'}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1',
                crane.overloadProtectionActive
                  ? 'bg-emerald-500/10'
                  : 'bg-red-500/10',
              )}
            >
              {crane.overloadProtectionActive ? (
                <ShieldCheck className="size-3 text-emerald-500" />
              ) : (
                <ShieldAlert className="size-3 text-red-500" />
              )}
              <span className="text-[10px]">
                {t('safety.overloadProtection')}
              </span>
              <span
                className={cn(
                  'ml-auto text-[10px] font-bold',
                  crane.overloadProtectionActive
                    ? 'text-emerald-500'
                    : 'text-red-500',
                )}
              >
                {crane.overloadProtectionActive ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>

        {/* Equipment status */}
        <div className="border-t px-3 py-2">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase">
            {t('equipment.title')}
          </p>
          <div className="space-y-1.5">
            {/* Motors */}
            {[
              {
                labelKey: 'equipment.hoistMotor',
                temp: crane.hoistMotorTemp,
                current: crane.hoistMotorCurrent,
              },
              {
                labelKey: 'equipment.trolleyMotor',
                temp: crane.trolleyMotorTemp,
                current: crane.trolleyMotorCurrent,
              },
              {
                labelKey: 'equipment.travelMotor',
                temp: crane.travelMotorTemp,
                current: crane.travelMotorCurrent,
              },
            ].map((motor) => {
              const tempPercent = (motor.temp / 120) * 100;
              return (
                <div
                  key={motor.labelKey}
                  className="bg-muted/20 rounded-md px-2 py-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">
                      {t(motor.labelKey)}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] tabular-nums">
                      <span className="flex items-center gap-0.5">
                        <Thermometer
                          className={cn(
                            'size-2.5',
                            tempPercent >= 80
                              ? 'text-red-500'
                              : tempPercent >= 60
                                ? 'text-amber-500'
                                : 'text-muted-foreground',
                          )}
                        />
                        <span
                          className={cn(
                            'font-medium',
                            tempPercent >= 80
                              ? 'text-red-500'
                              : tempPercent >= 60
                                ? 'text-amber-500'
                                : 'text-foreground',
                          )}
                        >
                          {motor.temp.toFixed(0)}°C
                        </span>
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Zap className="text-muted-foreground size-2.5" />
                        <span>{motor.current.toFixed(0)}A</span>
                      </span>
                    </div>
                  </div>
                  <div className="bg-muted/40 mt-1 h-0.5 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        tempPercent >= 80
                          ? 'bg-red-500'
                          : tempPercent >= 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${tempPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {/* Wire rope */}
            <div className="bg-muted/20 rounded-md px-2 py-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <Cable className="size-2.5" />
                  {t('equipment.wireRope')}
                </span>
                <span className="text-[10px] tabular-nums">
                  <span
                    className={cn(
                      'font-medium',
                      crane.wireRopeUsageCount / crane.wireRopeMaxCount >= 0.8
                        ? 'text-amber-500'
                        : 'text-foreground',
                    )}
                  >
                    {(crane.wireRopeUsageCount / 1000).toFixed(1)}k
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    / {(crane.wireRopeMaxCount / 1000).toFixed(0)}k
                  </span>
                </span>
              </div>
              <div className="bg-muted/40 mt-1 h-0.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full',
                    crane.wireRopeUsageCount / crane.wireRopeMaxCount >= 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                  )}
                  style={{
                    width: `${(crane.wireRopeUsageCount / crane.wireRopeMaxCount) * 100}%`,
                  }}
                />
              </div>
            </div>
            {/* Brake */}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1',
                crane.brakeStatus === 'normal'
                  ? 'bg-emerald-500/10'
                  : crane.brakeStatus === 'warning'
                    ? 'bg-amber-500/10'
                    : 'bg-red-500/10',
              )}
            >
              {crane.brakeStatus === 'normal' ? (
                <CircleCheck className="size-3 text-emerald-500" />
              ) : (
                <CircleAlert
                  className={cn(
                    'size-3',
                    crane.brakeStatus === 'warning'
                      ? 'text-amber-500'
                      : 'text-red-500',
                  )}
                />
              )}
              <span className="text-[10px]">{t('equipment.brake')}</span>
              <span
                className={cn(
                  'ml-auto text-[10px] font-bold',
                  crane.brakeStatus === 'normal'
                    ? 'text-emerald-500'
                    : crane.brakeStatus === 'warning'
                      ? 'text-amber-500'
                      : 'text-red-500',
                )}
              >
                {t(`equipment.brakeStatus.${crane.brakeStatus}`)}
              </span>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
