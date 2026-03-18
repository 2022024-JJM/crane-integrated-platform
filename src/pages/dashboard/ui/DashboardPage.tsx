import { type ReactNode, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  getAlarmMessageTranslation,
  type Alarm,
  type AlarmSeverity,
} from '@/entities/alarm';
import { Badge } from '@/shared/ui/atoms/badge';
import { Separator } from '@/shared/ui/atoms/separator';
import { cn } from '@/shared/lib/utils';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/molecules/card';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import {
  buildDashboardSummary,
  type DashboardMetricCard,
  type DashboardRiskCraneDatum,
} from '../model';

const severityBadgeClassName: Record<AlarmSeverity, string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
  warning:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300',
};

const statusBadgeClassName = {
  operating:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  idle: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300',
  maintenance:
    'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300',
  warning:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  stopped: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
} as const;

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

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const summary = useMemo(() => buildDashboardSummary(), []);
  const locale = i18n.language === 'ko' ? 'ko-KR' : 'en-US';
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short' }),
    [locale],
  );
  const weekFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {summary.metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            translate={t}
            locale={locale}
          />
        ))}
      </section>

      <section className="border-border/70 bg-card/60 rounded-[1.75rem] border p-4 shadow-sm backdrop-blur-sm md:p-6">
        <div className="border-border/70 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                <Activity className="size-4 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {t('dashboard:sections.trend.title')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t('dashboard:sections.trend.description')}
                </p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="w-fit px-3 py-1 text-xs">
            {t('dashboard:sections.trend.range', {
              from: formatMonth(
                summary.monthlyTrend[0]?.dateKey,
                monthFormatter,
              ),
              to: formatMonth(
                summary.monthlyTrend[summary.monthlyTrend.length - 1]?.dateKey,
                monthFormatter,
              ),
            })}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border/70 bg-background/60 border shadow-none">
              <CardHeader>
                <div>
                  <CardTitle>
                    {t('dashboard:charts.monthlyOperating.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('dashboard:charts.monthlyOperating.description')}
                  </CardDescription>
                </div>
                <CardAction>
                  <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    {t('dashboard:badges.sixMonths')}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChartArea>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={summary.monthlyTrend}>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        axisLine={false}
                        dataKey="dateKey"
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        tickFormatter={(value) =>
                          formatMonth(value, monthFormatter)
                        }
                      />
                      <YAxis
                        axisLine={false}
                        domain={[40, 100]}
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        width={32}
                      />
                      <Tooltip
                        content={
                          <ChartTooltip
                            translate={t}
                            labelFormatter={(value) =>
                              formatMonthLabel(value, monthFormatter)
                            }
                            locale={locale}
                          />
                        }
                      />
                      <Line
                        dataKey="operationalRate"
                        dot={{ fill: 'var(--chart-1)', r: 3 }}
                        stroke="var(--chart-1)"
                        strokeWidth={3}
                        type="monotone"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartArea>
                <Separator />
                <StatsRow
                  items={[
                    {
                      label: t('dashboard:charts.monthlyOperating.average'),
                      value: `${summary.averageOperatingRate}%`,
                      tone: 'text-emerald-500',
                    },
                    {
                      label: t('dashboard:charts.monthlyOperating.bestMonth'),
                      value: formatMonth(
                        summary.bestOperatingMonth,
                        monthFormatter,
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/60 border shadow-none">
              <CardHeader>
                <div>
                  <CardTitle>
                    {t('dashboard:charts.monthlyAlarms.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('dashboard:charts.monthlyAlarms.description')}
                  </CardDescription>
                </div>
                <CardAction>
                  <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    {t('dashboard:badges.sixMonths')}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChartArea>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.monthlyTrend}>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        axisLine={false}
                        dataKey="dateKey"
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        tickFormatter={(value) =>
                          formatMonth(value, monthFormatter)
                        }
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        width={32}
                      />
                      <Tooltip
                        content={
                          <ChartTooltip
                            translate={t}
                            labelFormatter={(value) =>
                              formatMonthLabel(value, monthFormatter)
                            }
                            locale={locale}
                          />
                        }
                      />
                      <Bar
                        dataKey="alarmCount"
                        fill="var(--chart-4)"
                        radius={[8, 8, 0, 0]}
                      >
                        {summary.monthlyTrend.map((point) => (
                          <Cell
                            key={point.dateKey}
                            fill={
                              point.dateKey === summary.topAlarmMonth
                                ? 'var(--chart-5)'
                                : 'var(--chart-4)'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartArea>
                <Separator />
                <StatsRow
                  items={[
                    {
                      label: t('dashboard:charts.monthlyAlarms.total'),
                      value: `${summary.monthlyAlarmTotal}${t('dashboard:units.count')}`,
                      tone: 'text-amber-500',
                    },
                    {
                      label: t('dashboard:charts.monthlyAlarms.peakMonth'),
                      value: formatMonth(summary.topAlarmMonth, monthFormatter),
                    },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/60 border shadow-none lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>
                    {t('dashboard:charts.weeklyTrend.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('dashboard:charts.weeklyTrend.description')}
                  </CardDescription>
                </div>
                <CardAction>
                  <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                    <LegendPill
                      colorClassName="bg-amber-500"
                      label={t('dashboard:legend.alarmCount')}
                    />
                    <LegendPill
                      colorClassName="bg-yellow-400"
                      label={t('dashboard:legend.warningCount')}
                    />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <ChartArea className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.weeklyTrend} barGap={8}>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        axisLine={false}
                        dataKey="dateKey"
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        tickFormatter={(value) =>
                          formatWeekday(value, weekFormatter)
                        }
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        width={32}
                      />
                      <Tooltip
                        content={
                          <ChartTooltip
                            translate={t}
                            labelFormatter={(value) =>
                              formatWeekdayLabel(value, weekFormatter)
                            }
                            locale={locale}
                          />
                        }
                      />
                      <Bar
                        dataKey="alarmCount"
                        fill="var(--chart-5)"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="warningCount"
                        fill="var(--chart-4)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartArea>
                <Separator />
                <StatsRow
                  items={[
                    {
                      label: t('dashboard:charts.weeklyTrend.totalAlarms'),
                      value: `${summary.weeklyAlarmTotal}${t('dashboard:units.count')}`,
                      tone: 'text-amber-500',
                    },
                    {
                      label: t('dashboard:charts.weeklyTrend.totalWarnings'),
                      value: `${summary.weeklyWarningTotal}${t('dashboard:units.count')}`,
                    },
                    {
                      label: t('dashboard:charts.weeklyTrend.average'),
                      value: `${summary.averageWeeklyAlarms}${t('dashboard:units.count')}`,
                    },
                    {
                      label: t('dashboard:charts.weeklyTrend.peakDay'),
                      value: formatWeekday(
                        summary.peakWeeklyDay,
                        weekFormatter,
                      ),
                    },
                  ]}
                  columnsClassName="md:grid-cols-4"
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-background/60 border shadow-none xl:h-full">
            <CardHeader>
              <div>
                <CardTitle>
                  {t('dashboard:charts.regionStatus.title')}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:charts.regionStatus.description')}
                </CardDescription>
              </div>
              <CardAction>
                <Badge className="border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                  {t('dashboard:badges.now')}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4 xl:flex-1">
              <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                <LegendPill
                  colorClassName="bg-emerald-500"
                  label={t('dashboard:legend.healthy')}
                />
                <LegendPill
                  colorClassName="bg-amber-500"
                  label={t('dashboard:legend.warning')}
                />
                <LegendPill
                  colorClassName="bg-slate-500"
                  label={t('dashboard:legend.offline')}
                />
              </div>
              <div className="space-y-3">
                {summary.regionStatuses.map((regionStatus) => (
                  <Link
                    key={regionStatus.regionId}
                    to={regionStatus.navigateTo}
                    className="group border-border/70 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block rounded-2xl border p-3 transition"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {t(regionStatus.titleKey)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {t('dashboard:charts.regionStatus.totalCranes', {
                            count: regionStatus.total,
                          })}
                        </p>
                      </div>
                      <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 transition" />
                    </div>
                    <div className="bg-muted mt-3 flex h-3 overflow-hidden rounded-full">
                      <BarSegment
                        colorClassName="bg-emerald-500"
                        total={regionStatus.total}
                        value={regionStatus.operating}
                      />
                      <BarSegment
                        colorClassName="bg-amber-500"
                        total={regionStatus.total}
                        value={regionStatus.warning}
                      />
                      <BarSegment
                        colorClassName="bg-slate-500"
                        total={regionStatus.total}
                        value={regionStatus.offline}
                      />
                    </div>
                    <div className="text-muted-foreground mt-3 grid grid-cols-3 gap-2 text-xs">
                      <StatusCount
                        label={t('dashboard:legend.healthy')}
                        tone="text-emerald-500"
                        value={regionStatus.operating}
                      />
                      <StatusCount
                        label={t('dashboard:legend.warning')}
                        tone="text-amber-500"
                        value={regionStatus.warning}
                      />
                      <StatusCount
                        label={t('dashboard:legend.offline')}
                        tone="text-slate-500"
                        value={regionStatus.offline}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="border-border/70 bg-background/60 border shadow-none xl:h-full">
            <CardHeader>
              <div>
                <CardTitle>{t('dashboard:charts.riskCranes.title')}</CardTitle>
                <CardDescription>
                  {t('dashboard:charts.riskCranes.description')}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">
                  {t('dashboard:charts.riskCranes.title')}
                </h3>
                <Badge variant="outline">
                  {t('dashboard:badges.priority')}
                </Badge>
              </div>
              <ChartArea className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.riskCranes} layout="vertical">
                    <CartesianGrid
                      horizontal={false}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis hide type="number" />
                    <YAxis
                      axisLine={false}
                      dataKey="craneName"
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      type="category"
                      width={56}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          translate={t}
                          labelFormatter={(value) => `${value}`}
                          locale={locale}
                        />
                      }
                    />
                    <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                      {summary.riskCranes.map((crane) => (
                        <Cell
                          key={crane.craneId}
                          fill={getRiskColor(crane.score)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartArea>
              <Separator />
              <ScrollArea className="h-[320px] pr-3">
                <div className="space-y-2">
                  {summary.riskCranes.map((crane) => (
                    <RiskCraneRow
                      key={crane.craneId}
                      crane={crane}
                      locale={locale}
                      translate={t}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/60 border shadow-none xl:h-full">
            <CardHeader>
              <div>
                <CardTitle>
                  {t('dashboard:sections.recentAlarms.title')}
                </CardTitle>
                <CardDescription>
                  {t('dashboard:sections.recentAlarms.description')}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">
                    {t('dashboard:sections.recentAlarms.title')}
                  </h3>
                  <Badge variant="outline">
                    {summary.recentAlarms.length}
                    {t('dashboard:units.count')}
                  </Badge>
                </div>
                {summary.recentAlarms.length > 0 ? (
                  <ScrollArea className="h-[560px] pr-3">
                    <div className="space-y-2 pr-3">
                      {summary.recentAlarms.map((alarm) => (
                        <RecentAlarmRow
                          key={alarm.id}
                          alarm={alarm}
                          formatTimestamp={(value) =>
                            dateTimeFormatter.format(new Date(value))
                          }
                          translate={t}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="border-border/70 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
                    {t('dashboard:sections.recentAlarms.empty')}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  metric,
  translate,
  locale,
}: {
  metric: DashboardMetricCard;
  translate: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
}) {
  const Icon = metricIconMap[metric.id];
  const content = (
    <Card
      className={cn(
        'border-border/70 bg-card/80 h-full border shadow-sm transition',
        metric.tone === 'warning' &&
          'border-amber-500/35 bg-amber-500/5 shadow-amber-500/5',
      )}
    >
      <CardHeader>
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2">
            <Icon className="size-4" />
            <CardTitle className="text-sm">
              {translate(metric.titleKey)}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {translate(metric.descriptionKey)}
          </CardDescription>
        </div>
        {metric.href ? (
          <CardAction>
            <ArrowRight className="text-muted-foreground size-4" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <p
          className={cn(
            'text-3xl font-semibold tracking-tight',
            metric.tone === 'success' && 'text-emerald-500',
            metric.tone === 'warning' && 'text-amber-500',
          )}
        >
          {formatMetric(metric, translate, locale)}
        </p>
        <p className="text-muted-foreground text-sm">
          {metric.metaKey
            ? translate(metric.metaKey, metric.metaValues)
            : '\u00A0'}
        </p>
      </CardContent>
    </Card>
  );

  if (!metric.href) {
    return content;
  }

  return (
    <Link to={metric.href} className="block h-full">
      {content}
    </Link>
  );
}

function ChartArea({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('h-[240px] w-full', className)}>{children}</div>;
}

function ChartTooltip({
  active,
  payload,
  label,
  translate,
  labelFormatter,
  locale,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string;
    name?: string;
    value?: number;
    payload?: Record<string, number | string>;
  }>;
  label?: string;
  translate: (key: string, values?: Record<string, string | number>) => string;
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

function StatsRow({
  items,
  columnsClassName,
}: {
  items: Array<{ label: string; value: string; tone?: string }>;
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

function LegendPill({
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

function BarSegment({
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

function StatusCount({
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

function RiskCraneRow({
  crane,
  translate,
  locale,
}: {
  crane: DashboardRiskCraneDatum;
  translate: (key: string) => string;
  locale: string;
}) {
  return (
    <div className="border-border/70 bg-card/70 rounded-2xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{crane.craneName}</p>
          <p className="text-muted-foreground text-xs">
            {translate(crane.regionTitleKey)}
          </p>
        </div>
        <Badge className={cn('border', statusBadgeClassName[crane.status])}>
          {translate(`common:craneStatus.${crane.status}`)}
        </Badge>
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

function RecentAlarmRow({
  alarm,
  translate,
  formatTimestamp,
}: {
  alarm: Alarm;
  translate: (key: string, values?: Record<string, string | number>) => string;
  formatTimestamp: (value: string) => string;
}) {
  const message = getAlarmMessageTranslation(alarm);

  return (
    <div className="border-border/70 bg-card/70 rounded-2xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                'size-4',
                alarm.severity === 'critical' && 'text-red-500',
                alarm.severity === 'warning' && 'text-amber-500',
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
          {translate(`common:alarms.${alarm.severity}`)}
        </Badge>
      </div>
      <div className="text-muted-foreground mt-3 text-xs">
        {formatTimestamp(alarm.timestamp)}
      </div>
    </div>
  );
}

function formatMetric(
  metric: DashboardMetricCard,
  translate: (key: string) => string,
  locale: string,
) {
  if (metric.format === 'translation') {
    return translate(String(metric.value));
  }

  if (metric.format === 'percent') {
    return `${metric.value}%`;
  }

  if (typeof metric.value === 'number') {
    return new Intl.NumberFormat(locale).format(metric.value);
  }

  return String(metric.value);
}

function formatTooltipValue(
  value: number | undefined,
  dataKey: string | undefined,
  locale: string,
) {
  if (typeof value !== 'number') {
    return '-';
  }

  if (dataKey === 'operationalRate') {
    return `${value}%`;
  }

  return new Intl.NumberFormat(locale).format(value);
}

function getRiskColor(score: number) {
  if (score >= 95) {
    return 'var(--destructive)';
  }

  if (score >= 80) {
    return 'var(--chart-5)';
  }

  return 'var(--chart-4)';
}

function formatMonth(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-';
  }

  return formatter.format(new Date(value));
}

function formatMonthLabel(value: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(value));
}

function formatWeekday(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) {
    return '-';
  }

  return formatter.format(new Date(value));
}

function formatWeekdayLabel(value: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(value));
}
