import type { ReactNode } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Radar,
  RadioTower,
  ShieldAlert,
} from 'lucide-react';

import {
  getAlarmSeverityLabel,
  getAlarmSeverityVisual,
  type AlarmSeverity,
  type AlarmStatistics,
} from '@crane/domain/alarm';
import type { AlarmJournalEntry } from '@crane/domain/journal';
import { cn } from '@crane/core/lib/utils';
import { severityBadgeClassName } from '@crane/core/lib/status-colors';
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
  type DashboardCollisionRow,
  type DashboardMetricCard,
} from '../model';
import {
  formatMetric,
  formatTooltipValue,
  type DashboardStatItem,
  type DashboardTooltipPayloadEntry,
  type DashboardTranslate,
} from './dashboard-helpers';

const metricIconMap = {
  detection: Radar,
  todayCollisions: ShieldAlert,
  activeAlarms: BellRing,
  dataSource: RadioTower,
} as const;

const SEVERITY_KEYS: readonly AlarmSeverity[] = [
  'critical',
  'high',
  'medium',
  'info',
];

export function MetricCard({
  metric,
  translate,
  locale,
}: {
  metric: DashboardMetricCard;
  translate: DashboardTranslate;
  locale: string;
}) {
  const Icon = metricIconMap[metric.id];
  const content = (
    <Card
      size="sm"
      className={cn(
        'border-border/90 bg-card/80 h-full min-h-[132px] justify-between border shadow-sm transition',
        metric.tone === 'warning' &&
          'border-amber-500/35 bg-amber-500/5 shadow-amber-500/5',
        metric.tone === 'danger' &&
          'border-red-500/35 bg-red-500/5 shadow-red-500/5',
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
        <p
          className={cn(
            'ml-1 text-[1.8rem] leading-none font-semibold tracking-tight',
            metric.tone === 'success' && 'text-emerald-500',
            metric.tone === 'warning' && 'text-amber-500',
            metric.tone === 'danger' && 'text-red-500',
          )}
        >
          {formatMetric(metric, translate, locale)}
        </p>
        <p className="text-muted-foreground text-xs leading-4">
          {metric.metaKey
            ? translate(metric.metaKey, metric.metaValues)
            : ' '}
        </p>
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
          const seriesLabel =
            dataKey === 'count'
              ? translate('dashboard:legend.collisionCount')
              : dataKey && SEVERITY_KEYS.includes(dataKey as AlarmSeverity)
                ? getAlarmSeverityLabel(dataKey as AlarmSeverity, locale)
                : (dataKey ?? '');

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
                <span>{seriesLabel}</span>
              </div>
              <span className="text-foreground font-medium">
                {formatTooltipValue(entry.value, locale)}
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

/** journal·기록이 아직 없을 때의 정직한 빈 상태 — 가짜 숫자로 채우지 않는다. */
export function EmptyStateBox({
  message,
  className,
}: {
  message: string;
  /** 높이·정렬 조정용 — 차트 자리 등 나란한 카드끼리 라인을 맞출 때 쓴다. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border/90 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm',
        className,
      )}
    >
      {message}
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
  return (
    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
      {SEVERITY_KEYS.map((severity) => {
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

export function CollisionHistoryRow({
  row,
  translate,
  formatTime,
}: {
  row: DashboardCollisionRow;
  translate: DashboardTranslate;
  formatTime: (at: number) => string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-red-500" />
            <p className="font-medium">
              {row.equipA}
              <span className="text-muted-foreground mx-1.5">↔</span>
              {row.equipB}
            </p>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {row.regionTitleKey
              ? translate(row.regionTitleKey)
              : translate('dashboard:collisionHistory.unknownRegion')}
          </p>
        </div>
        {row.navigateTo ? (
          <ArrowRight className="text-muted-foreground size-4 shrink-0" />
        ) : null}
      </div>
      <div className="text-muted-foreground mt-2 text-xs">
        {formatTime(row.at)}
      </div>
    </>
  );

  const className =
    'border-border/90 bg-card/70 block rounded-2xl border p-3 text-left';

  if (!row.navigateTo) {
    return <div className={className}>{body}</div>;
  }

  return (
    <AppLink
      to={row.navigateTo}
      className={cn(
        className,
        'hover:border-primary/30 hover:bg-accent/20 w-full transition',
      )}
    >
      {body}
    </AppLink>
  );
}

export function AlarmJournalRow({
  entry,
  formatTimestamp,
  locale,
}: {
  entry: AlarmJournalEntry;
  formatTimestamp: (value: string) => string;
  locale: string;
}) {
  return (
    <div className="border-border/90 bg-card/70 rounded-2xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                'size-4',
                entry.severity === 'critical' && 'text-red-500',
                entry.severity === 'high' && 'text-orange-500',
                entry.severity === 'medium' && 'text-amber-500',
                entry.severity === 'info' && 'text-blue-500',
              )}
            />
            <p className="font-medium">{entry.craneId}</p>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {entry.alarmName ?? entry.alarmCode ?? '—'}
          </p>
        </div>
        <Badge className={cn('border', severityBadgeClassName[entry.severity])}>
          {getAlarmSeverityLabel(entry.severity, locale)}
        </Badge>
      </div>
      <div className="text-muted-foreground mt-3 text-xs">
        {formatTimestamp(entry.timestamp)}
      </div>
    </div>
  );
}
