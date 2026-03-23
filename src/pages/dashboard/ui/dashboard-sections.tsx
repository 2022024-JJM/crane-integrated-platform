import { Activity, ArrowRight } from 'lucide-react';
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

import { AppLink } from '@/shared/ui/atoms/app-link';
import { Badge } from '@/shared/ui/atoms/badge';
import { Separator } from '@/shared/ui/atoms/separator';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/molecules/card';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import type { DashboardSummary } from '../model';
import {
  DashboardChartSkeleton,
  DashboardRegionStatusSkeleton,
  DashboardRiskCranesSkeleton,
} from './dashboard-skeletons';
import {
  formatMonth,
  formatMonthLabel,
  formatWeekday,
  formatWeekdayLabel,
  formatYearMonth,
  getRiskColor,
  type DashboardTranslate,
} from './dashboard-helpers';
import {
  BarSegment,
  ChartArea,
  ChartTooltip,
  LegendPill,
  RecentAlarmRow,
  RiskCraneRow,
  StatsRow,
  StatusCount,
} from './dashboard-parts';

interface DashboardSectionSharedProps {
  summary: DashboardSummary;
  isLoading: boolean;
  translate: DashboardTranslate;
}

interface DashboardTrendSectionProps extends DashboardSectionSharedProps {
  locale: string;
  monthFormatter: Intl.DateTimeFormat;
  weekFormatter: Intl.DateTimeFormat;
  barChartTooltipCursor: {
    fill: string;
    stroke: string;
  };
}

interface DashboardRecentAlarmsSectionProps
  extends DashboardSectionSharedProps {
  formatTimestamp: (value: string) => string;
}

export function DashboardOverviewHeader({
  summary,
  translate,
}: Pick<DashboardSectionSharedProps, 'summary' | 'translate'>) {
  return (
    <div className="border-border/70 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <Activity className="size-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {translate('dashboard:sections.trend.title')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {translate('dashboard:sections.trend.description')}
            </p>
          </div>
        </div>
      </div>
      <div className="flex w-fit items-center gap-2 text-sm md:self-end">
        <span className="text-muted-foreground">
          {translate('dashboard:sections.trend.rangeLabel')}
        </span>
        <span className="text-foreground tabular-nums font-semibold tracking-tight">
          {translate('dashboard:sections.trend.range', {
            from: formatYearMonth(summary.monthlyTrend[0]?.dateKey),
            to: formatYearMonth(
              summary.monthlyTrend[summary.monthlyTrend.length - 1]?.dateKey,
            ),
          })}
        </span>
      </div>
    </div>
  );
}

export function DashboardTrendSection({
  summary,
  isLoading,
  translate,
  locale,
  monthFormatter,
  weekFormatter,
  barChartTooltipCursor,
}: DashboardTrendSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-border/70 bg-background/60 border shadow-none">
        <CardHeader>
          <div>
            <CardTitle>
              {translate('dashboard:charts.monthlyOperating.title')}
            </CardTitle>
            <CardDescription>
              {translate('dashboard:charts.monthlyOperating.description')}
            </CardDescription>
          </div>
          <CardAction>
            <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              {translate('dashboard:badges.sixMonths')}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <DashboardChartSkeleton statsCount={2} variant="line" />
          ) : (
            <>
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
                          translate={translate}
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
                    label: translate('dashboard:charts.monthlyOperating.average'),
                    value: `${summary.averageOperatingRate}%`,
                    tone: 'text-emerald-500',
                  },
                  {
                    label: translate('dashboard:charts.monthlyOperating.bestMonth'),
                    value: formatMonth(summary.bestOperatingMonth, monthFormatter),
                  },
                ]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/60 border shadow-none">
        <CardHeader>
          <div>
            <CardTitle>{translate('dashboard:charts.monthlyAlarms.title')}</CardTitle>
            <CardDescription>
              {translate('dashboard:charts.monthlyAlarms.description')}
            </CardDescription>
          </div>
          <CardAction>
            <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
              {translate('dashboard:badges.sixMonths')}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <DashboardChartSkeleton statsCount={2} variant="bars" />
          ) : (
            <>
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
                      cursor={barChartTooltipCursor}
                      content={
                        <ChartTooltip
                          translate={translate}
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
                      maxBarSize={30}
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
                    label: translate('dashboard:charts.monthlyAlarms.total'),
                    value: `${summary.monthlyAlarmTotal}${translate('dashboard:units.count')}`,
                    tone: 'text-amber-500',
                  },
                  {
                    label: translate('dashboard:charts.monthlyAlarms.peakMonth'),
                    value: formatMonth(summary.topAlarmMonth, monthFormatter),
                  },
                ]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/60 border shadow-none lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>{translate('dashboard:charts.weeklyTrend.title')}</CardTitle>
            <CardDescription>
              {translate('dashboard:charts.weeklyTrend.description')}
            </CardDescription>
          </div>
          <CardAction>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <LegendPill
                colorClassName="bg-amber-500"
                label={translate('dashboard:legend.alarmCount')}
              />
              <LegendPill
                colorClassName="bg-yellow-400"
                label={translate('dashboard:legend.warningCount')}
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <DashboardChartSkeleton
              chartClassName="h-[260px]"
              columnsClassName="md:grid-cols-4"
              statsCount={4}
              variant="bars"
            />
          ) : (
            <>
              <ChartArea className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.weeklyTrend}
                    maxBarSize={30}
                    barGap={8}
                  >
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
                      cursor={barChartTooltipCursor}
                      content={
                        <ChartTooltip
                          translate={translate}
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
                    label: translate('dashboard:charts.weeklyTrend.totalAlarms'),
                    value: `${summary.weeklyAlarmTotal}${translate('dashboard:units.count')}`,
                    tone: 'text-amber-500',
                  },
                  {
                    label: translate('dashboard:charts.weeklyTrend.totalWarnings'),
                    value: `${summary.weeklyWarningTotal}${translate('dashboard:units.count')}`,
                  },
                  {
                    label: translate('dashboard:charts.weeklyTrend.average'),
                    value: `${summary.averageWeeklyAlarms}${translate('dashboard:units.count')}`,
                  },
                  {
                    label: translate('dashboard:charts.weeklyTrend.peakDay'),
                    value: formatWeekday(summary.peakWeeklyDay, weekFormatter),
                  },
                ]}
                columnsClassName="md:grid-cols-4"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardRegionStatusSection({
  summary,
  isLoading,
  translate,
}: DashboardSectionSharedProps) {
  return (
    <Card className="border-border/70 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>{translate('dashboard:charts.regionStatus.title')}</CardTitle>
          <CardDescription>
            {translate('dashboard:charts.regionStatus.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300">
            {translate('dashboard:badges.now')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 xl:flex-1">
        {isLoading ? (
          <DashboardRegionStatusSkeleton />
        ) : (
          <>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <LegendPill
                colorClassName="bg-emerald-500"
                label={translate('dashboard:legend.healthy')}
              />
              <LegendPill
                colorClassName="bg-amber-500"
                label={translate('dashboard:legend.warning')}
              />
              <LegendPill
                colorClassName="bg-slate-500"
                label={translate('dashboard:legend.offline')}
              />
            </div>
            <div className="space-y-3">
              {summary.regionStatuses.map((regionStatus) => (
                <AppLink
                  key={regionStatus.regionId}
                  to={regionStatus.navigateTo}
                  className="group border-border/70 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block rounded-2xl border p-3 transition"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{translate(regionStatus.titleKey)}</p>
                      <p className="text-muted-foreground text-xs">
                        {translate('dashboard:charts.regionStatus.totalCranes', {
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
                      label={translate('dashboard:legend.healthy')}
                      tone="text-emerald-500"
                      value={regionStatus.operating}
                    />
                    <StatusCount
                      label={translate('dashboard:legend.warning')}
                      tone="text-amber-500"
                      value={regionStatus.warning}
                    />
                    <StatusCount
                      label={translate('dashboard:legend.offline')}
                      tone="text-slate-500"
                      value={regionStatus.offline}
                    />
                  </div>
                </AppLink>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardRiskCranesSection({
  summary,
  isLoading,
  translate,
  locale,
  barChartTooltipCursor,
}: DashboardSectionSharedProps & {
  locale: string;
  barChartTooltipCursor: {
    fill: string;
    stroke: string;
  };
}) {
  return (
    <Card className="border-border/70 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>{translate('dashboard:charts.riskCranes.title')}</CardTitle>
          <CardDescription>
            {translate('dashboard:charts.riskCranes.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            {translate('dashboard:badges.priority')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <DashboardRiskCranesSkeleton />
        ) : (
          <>
            <ChartArea className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.riskCranes}
                  maxBarSize={20}
                  layout="vertical"
                >
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
                    cursor={barChartTooltipCursor}
                    content={
                      <ChartTooltip
                        translate={translate}
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
                    translate={translate}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardRecentAlarmsSection({
  summary,
  translate,
  formatTimestamp,
}: DashboardRecentAlarmsSectionProps) {
  return (
    <Card className="border-border/70 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>{translate('dashboard:sections.recentAlarms.title')}</CardTitle>
          <CardDescription>
            {translate('dashboard:sections.recentAlarms.description')}
          </CardDescription>
        </div>
        <CardAction>
          <Badge className="border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300">
            {summary.recentAlarms.length}
            {translate('dashboard:units.count')}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {summary.recentAlarms.length > 0 ? (
          <ScrollArea className="h-[560px] pr-3">
            <div className="space-y-2 pr-3">
              {summary.recentAlarms.map((alarm) => (
                <RecentAlarmRow
                  key={alarm.id}
                  alarm={alarm}
                  formatTimestamp={formatTimestamp}
                  translate={translate}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="border-border/70 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
            {translate('dashboard:sections.recentAlarms.empty')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
