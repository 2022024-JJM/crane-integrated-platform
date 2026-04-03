import type { ReactNode } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import {
  getAlarmSeverityLabel,
  getAlarmSeverityVisual,
  getAlarmMessageTranslation,
  type Alarm,
  type AlarmSeverity,
  type AlarmStatistics,
} from '@crane/domain/alarm';
import { cn } from '@crane/core/lib/utils';
import {
  severityBadgeClassName,
  craneStatusBadgeClassName,
} from '@crane/core/lib/status-colors';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Badge } from '@crane/ui/atoms/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import {
  type DashboardMetricCard,
  type DashboardRiskCraneDatum,
} from '../model';
import {
  formatMetric,
  formatTooltipValue,
  getRiskColor,
  type DashboardStatItem,
  type DashboardTooltipPayloadEntry,
  type DashboardTranslate,
} from './dashboard-helpers';
import { DashboardMetricSkeleton } from './dashboard-skeletons';

const metricIconMap = {
  regionCount: Building2,
  craneCount: RadioTower,
  operatingRate: ShieldCheck,
  urgentRegion: ShieldAlert,
} as const;

const tooltipLabelKey = {
  operationalRate: 'dashboard:legend.operatingRate',
  alarmCount: 'dashboard:legend.alarmCount',
  warningCount: 'dashboard:legend.warningCount',
  score: 'dashboard:legend.riskScore',
} as const;

export function MetricCard({
  metric,
  translate,
  locale,
  isLoading = false,
}: {
  metric: DashboardMetricCard;
  translate: DashboardTranslate;
  locale: string;
  isLoading?: boolean;
}) {
  const Icon = metricIconMap[metric.id];
  const content = (
    <Card
      size="sm"
      className={cn(
        'border-border/90 bg-card/80 h-full min-h-[132px] justify-between border shadow-sm transition',
        metric.tone === 'warning' &&
          'border-amber-500/35 bg-amber-500/5 shadow-amber-500/5',
      )}
    >
      <CardHeader className="gap-2 pb-1">
        <div className="space-y-1">
          <div className="text-primary flex items-center gap-2">
            <Icon className="size-5 shrink-0" />
            <CardTitle className="text-[15px] leading-tight md:text-sm">
              {translate(metric.titleKey)}
            </CardTitle>
          </div>
          <CardDescription className="text-[13px] leading-4 md:text-xs">
            {translate(metric.descriptionKey)}
          </CardDescription>
        </div>
        {metric.href ? (
          <CardAction>
            <ArrowRight className="text-primary size-3.5" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="mt-auto space-y-1.5 pt-0">
        {isLoading ? (
          <DashboardMetricSkeleton />
        ) : (
          <>
            <p
              className={cn(
                'ml-1 text-[1.8rem] leading-none font-semibold tracking-tight',
                metric.tone === 'success' && 'text-emerald-500',
                metric.tone === 'warning' && 'text-amber-500',
              )}
            >
              {formatMetric(metric, translate, locale)}
            </p>
            <p className="text-muted-foreground text-xs leading-4">
              {metric.metaKey
                ? translate(metric.metaKey, metric.metaValues)
                : '\u00A0'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (!metric.href) {
    return content;
  }

  return (
    <AppLink to={metric.href} className="block h-full">
      {content}
    </AppLink>
  );
}

export function ChartArea({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('h-[240px] w-full', className)}>{children}</div>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  translate,
  labelFormatter,
  locale,
}: {
  active?: boolean;
  payload?: DashboardTooltipPayloadEntry[];
  label?: string;
  translate: DashboardTranslate;
  labelFormatter: (label: string) => string;
  locale: string;
}) {
  if (!active || !payload || payload.length === 0 || !label) {
    return null;
  }

  return (
    <div className="border-border bg-popover/95 min-w-[160px] rounded-xl border p-3 text-xs shadow-lg backdrop-blur-sm">
      <p className="text-popover-foreground font-medium">
        {labelFormatter(label)}
      </p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => {
          const dataKey =
            typeof entry.dataKey === 'string' ? entry.dataKey : entry.name;
          const labelKey =
            dataKey && dataKey in tooltipLabelKey
              ? tooltipLabelKey[dataKey as keyof typeof tooltipLabelKey]
              : null;

          return (
            <div
              key={`${label}-${dataKey}`}
              className="text-muted-foreground flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: entry.color ?? 'var(--chart-1)' }}
                />
                <span>{labelKey ? translate(labelKey) : dataKey}</span>
              </div>
              <span className="text-foreground font-medium">
                {formatTooltipValue(entry.value, dataKey, locale)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatsRow({
  items,
  columnsClassName,
}: {
  items: DashboardStatItem[];
  columnsClassName?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-4 text-sm md:grid-cols-2',
        columnsClassName,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <p className="text-muted-foreground text-xs">{item.label}</p>
          <p className={cn('text-xl font-semibold', item.tone)}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function LegendPill({
  colorClassName,
  label,
}: {
  colorClassName: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('size-2 rounded-full', colorClassName)} />
      <span>{label}</span>
    </div>
  );
}

export function BarSegment({
  value,
  total,
  colorClassName,
}: {
  value: number;
  total: number;
  colorClassName: string;
}) {
  if (value <= 0 || total <= 0) {
    return null;
  }

  return (
    <div
      className={colorClassName}
      style={{ width: `${(value / total) * 100}%` }}
    />
  );
}

export function StatusCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="bg-muted/50 rounded-xl px-2.5 py-2">
      <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className={cn('mt-1 text-base font-semibold', tone)}>{value}</p>
    </div>
  );
}

export function RiskCraneRow({
  crane,
  translate,
  locale,
}: {
  crane: DashboardRiskCraneDatum;
  translate: DashboardTranslate;
  locale: string;
}) {
  return (
    <div className="border-border/90 bg-card/70 rounded-2xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{crane.craneName}</p>
          <p className="text-muted-foreground text-xs">
            {translate(crane.regionTitleKey)}
          </p>
        </div>
        <Badge
          className={cn('border', craneStatusBadgeClassName[crane.status])}
        >
          {translate(`common:craneStatus.${crane.status}`)}
        </Badge>
      </div>
      <div className="bg-muted/40 mt-2 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(crane.score, 100)}%`,
            backgroundColor: getRiskColor(crane.score),
          }}
        />
      </div>
      <div className="text-muted-foreground mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p>{translate('dashboard:charts.riskCranes.riskScore')}</p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            {new Intl.NumberFormat(locale).format(crane.score)}
          </p>
        </div>
        <div>
          <p>{translate('dashboard:charts.riskCranes.loadRatio')}</p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            {crane.loadRatio}%
          </p>
        </div>
        <div>
          <p>{translate('dashboard:charts.riskCranes.windSpeed')}</p>
          <p className="text-foreground mt-1 text-sm font-semibold">
            {crane.windSpeed}m/s
          </p>
        </div>
      </div>
    </div>
  );
}

export function DockAlarmStats({
  stats,
  locale,
}: {
  stats: AlarmStatistics;
  locale: string;
}) {
  const severities: AlarmSeverity[] = ['critical', 'high', 'medium', 'info'];

  return (
    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
      {severities.map((severity) => {
        const visual = getAlarmSeverityVisual(severity);
        const count = stats[severity];
        return (
          <div
            key={severity}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg px-2 py-2',
              visual.surfaceClassName,
            )}
          >
            <span className={cn('text-xs font-medium', visual.iconClassName)}>
              {getAlarmSeverityLabel(severity, locale)}
            </span>
            <span
              className={cn(
                'text-base font-bold tabular-nums',
                visual.valueClassName,
              )}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RecentAlarmRow({
  alarm,
  translate,
  formatTimestamp,
  locale,
}: {
  alarm: Alarm;
  translate: DashboardTranslate;
  formatTimestamp: (value: string) => string;
  locale: string;
}) {
  const message = getAlarmMessageTranslation(alarm);

  return (
    <div className="border-border/90 bg-card/70 rounded-2xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                'size-4',
                alarm.severity === 'critical' && 'text-red-500',
                alarm.severity === 'high' && 'text-orange-500',
                alarm.severity === 'medium' && 'text-amber-500',
                alarm.severity === 'info' && 'text-blue-500',
              )}
            />
            <p className="font-medium">{alarm.craneName}</p>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {translate(message.key, message.values)}
          </p>
        </div>
        <Badge className={cn('border', severityBadgeClassName[alarm.severity])}>
          {getAlarmSeverityLabel(alarm.severity, locale)}
        </Badge>
      </div>
      <div className="text-muted-foreground mt-3 text-xs">
        {formatTimestamp(alarm.timestamp)}
      </div>
    </div>
  );
}
