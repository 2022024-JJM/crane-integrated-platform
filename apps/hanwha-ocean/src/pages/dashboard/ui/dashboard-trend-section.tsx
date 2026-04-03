import { useState } from 'react';
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

import { Badge } from '@crane/ui/atoms/badge';
import { Separator } from '@crane/ui/atoms/separator';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import { DashboardChartSkeleton } from './dashboard-skeletons';
import {
  formatMonth,
  formatMonthLabel,
  formatWeekday,
  formatWeekdayLabel,
  type DashboardSectionSharedProps,
} from './dashboard-helpers';
import { ChartArea, ChartTooltip, StatsRow } from './dashboard-parts';

interface DashboardTrendSectionProps extends DashboardSectionSharedProps {
  locale: string;
  monthFormatter: Intl.DateTimeFormat;
  weekFormatter: Intl.DateTimeFormat;
  barChartTooltipCursor: {
    fill: string;
    stroke: string;
  };
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
