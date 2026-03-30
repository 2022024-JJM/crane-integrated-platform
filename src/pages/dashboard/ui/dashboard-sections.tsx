import { Activity, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useRegionRealtimeAlarms } from '@/features/alarm';
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
  type DashboardTranslate,
} from './dashboard-helpers';
import {
  ChartArea,
  ChartTooltip,
  DockAlarmStats,
  RecentAlarmRow,
  RiskCraneRow,
  StatsRow,
} from './dashboard-parts';
import type { DashboardRegionStatusDatum } from '../model';

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

interface DashboardRecentAlarmsSectionProps extends DashboardSectionSharedProps {
  formatTimestamp: (value: string) => string;
  locale: string;
}

export function DashboardOverviewHeader({
  summary,
  translate,
}: Pick<DashboardSectionSharedProps, 'summary' | 'translate'>) {
  return (
    <div className="border-border/90 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
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
        <span className="text-foreground font-semibold tracking-tight tabular-nums">
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
  const [alarmView, setAlarmView] = useState<'monthly' | 'weekly'>('monthly');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-border/90 bg-background/60 border shadow-none">
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
                    label: translate(
                      'dashboard:charts.monthlyOperating.average',
                    ),
                    value: `${summary.averageOperatingRate}%`,
                    tone: 'text-emerald-500',
                  },
                  {
                    label: translate(
                      'dashboard:charts.monthlyOperating.bestMonth',
                    ),
                    value: formatMonth(
                      summary.bestOperatingMonth,
                      monthFormatter,
                    ),
                  },
                ]}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/90 bg-background/60 border shadow-none">
        <CardHeader>
          <div>
            <CardTitle>
              {alarmView === 'monthly'
                ? translate('dashboard:charts.monthlyAlarms.title')
                : translate('dashboard:charts.weeklyTrend.title')}
            </CardTitle>
            <CardDescription>
              {alarmView === 'monthly'
                ? translate('dashboard:charts.monthlyAlarms.description')
                : translate('dashboard:charts.weeklyTrend.description')}
            </CardDescription>
          </div>
          <CardAction>
            <div className="border-border flex overflow-hidden rounded-lg border text-xs">
              <button
                type="button"
                className={`cursor-pointer px-2.5 py-1 transition ${alarmView === 'monthly' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setAlarmView('monthly')}
              >
                {translate('dashboard:badges.sixMonths')}
              </button>
              <button
                type="button"
                className={`border-border cursor-pointer border-l px-2.5 py-1 transition ${alarmView === 'weekly' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setAlarmView('weekly')}
              >
                {translate('dashboard:badges.sevenDays')}
              </button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <DashboardChartSkeleton
              statsCount={alarmView === 'monthly' ? 2 : 4}
              columnsClassName={
                alarmView === 'weekly' ? 'md:grid-cols-4' : undefined
              }
              variant="bars"
            />
          ) : (
            <>
              <ChartArea>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      alarmView === 'monthly'
                        ? summary.monthlyTrend
                        : summary.weeklyTrend
                    }
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
                        alarmView === 'monthly'
                          ? formatMonth(value, monthFormatter)
                          : formatWeekday(value, weekFormatter)
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
                            alarmView === 'monthly'
                              ? formatMonthLabel(value, monthFormatter)
                              : formatWeekdayLabel(value, weekFormatter)
                          }
                          locale={locale}
                        />
                      }
                    />
                    <Bar
                      dataKey="alarmCount"
                      fill="var(--chart-5)"
                      radius={[6, 6, 0, 0]}
                    >
                      {alarmView === 'monthly' &&
                        summary.monthlyTrend.map((point) => (
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
                    {alarmView === 'weekly' && (
                      <Bar
                        dataKey="warningCount"
                        fill="var(--chart-4)"
                        radius={[6, 6, 0, 0]}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </ChartArea>
              <Separator />
              {alarmView === 'monthly' ? (
                <StatsRow
                  items={[
                    {
                      label: translate('dashboard:charts.monthlyAlarms.total'),
                      value: `${summary.monthlyAlarmTotal}${translate('dashboard:units.count')}`,
                      tone: 'text-amber-500',
                    },
                    {
                      label: translate(
                        'dashboard:charts.monthlyAlarms.peakMonth',
                      ),
                      value: formatMonth(summary.topAlarmMonth, monthFormatter),
                    },
                  ]}
                />
              ) : (
                <StatsRow
                  items={[
                    {
                      label: translate(
                        'dashboard:charts.weeklyTrend.totalAlarms',
                      ),
                      value: `${summary.weeklyAlarmTotal}${translate('dashboard:units.count')}`,
                      tone: 'text-amber-500',
                    },
                    {
                      label: translate(
                        'dashboard:charts.weeklyTrend.totalWarnings',
                      ),
                      value: `${summary.weeklyWarningTotal}${translate('dashboard:units.count')}`,
                    },
                    {
                      label: translate('dashboard:charts.weeklyTrend.average'),
                      value: `${summary.averageWeeklyAlarms}${translate('dashboard:units.count')}`,
                    },
                    {
                      label: translate('dashboard:charts.weeklyTrend.peakDay'),
                      value: formatWeekday(
                        summary.peakWeeklyDay,
                        weekFormatter,
                      ),
                    },
                  ]}
                  columnsClassName="md:grid-cols-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DockCard({
  regionStatus,
  translate,
  locale,
  onOpen,
}: {
  regionStatus: DashboardRegionStatusDatum;
  translate: DashboardTranslate;
  locale: string;
  onOpen: (regionStatus: DashboardRegionStatusDatum) => void;
}) {
  const { stats } = useRegionRealtimeAlarms(regionStatus.regionId);

  return (
    <button
      type="button"
      className="group border-border/90 bg-card/70 hover:border-primary/30 hover:bg-accent/20 block w-full cursor-pointer rounded-2xl border p-3 text-left transition"
      onClick={() => onOpen(regionStatus)}
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
      <DockAlarmStats stats={stats} locale={locale} />
    </button>
  );
}

export function DashboardRegionStatusSection({
  summary,
  isLoading,
  translate,
  locale,
  onRegionPreviewOpen,
}: DashboardSectionSharedProps & {
  locale: string;
  onRegionPreviewOpen: (regionStatus: DashboardRegionStatusDatum) => void;
}) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:charts.regionStatus.title')}
          </CardTitle>
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
            <div className="space-y-3">
              {summary.regionStatuses.map((regionStatus) => (
                <DockCard
                  key={regionStatus.regionId}
                  regionStatus={regionStatus}
                  translate={translate}
                  locale={locale}
                  onOpen={onRegionPreviewOpen}
                />
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
}: DashboardSectionSharedProps & {
  locale: string;
}) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:charts.riskCranes.title')}
          </CardTitle>
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
          <ScrollArea className="pr-3">
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
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardRecentAlarmsSection({
  summary,
  translate,
  formatTimestamp,
  locale,
}: DashboardRecentAlarmsSectionProps) {
  return (
    <Card className="border-border/90 bg-background/60 border shadow-none xl:h-full">
      <CardHeader>
        <div>
          <CardTitle>
            {translate('dashboard:sections.recentAlarms.title')}
          </CardTitle>
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
          <div className="space-y-2">
            {summary.recentAlarms.map((alarm) => (
              <RecentAlarmRow
                key={alarm.id}
                alarm={alarm}
                formatTimestamp={formatTimestamp}
                locale={locale}
                translate={translate}
              />
            ))}
          </div>
        ) : (
          <div className="border-border/90 text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
            {translate('dashboard:sections.recentAlarms.empty')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
