import {
  Bar,
  BarChart,
  CartesianGrid,
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
import {
  formatDateKey,
  type DashboardSectionSharedProps,
} from './dashboard-helpers';
import {
  ChartArea,
  ChartTooltip,
  EmptyStateBox,
  StatsRow,
} from './dashboard-parts';

interface DashboardTrendSectionProps extends DashboardSectionSharedProps {
  locale: string;
  weekFormatter: Intl.DateTimeFormat;
  barChartTooltipCursor: {
    fill: string;
    stroke: string;
  };
}

/**
 * 최근 7일 journal 실 데이터 추이 — 충돌 건수·알람(심각도 스택). 합성
 * 오프셋 파생 곡선은 제거됐다. 기록이 없으면 차트 대신 안내 문구를 보인다.
 */
export function DashboardTrendSection({
  summary,
  translate,
  locale,
  weekFormatter,
  barChartTooltipCursor,
}: DashboardTrendSectionProps) {
  const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 } as const;
  const tickByWeekday = (value: string) => formatDateKey(value, weekFormatter);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-border/90 bg-background/60 border shadow-none">
        <CardHeader>
          <div>
            <CardTitle>
              {translate('dashboard:charts.dailyCollisions.title')}
            </CardTitle>
            <CardDescription>
              {translate('dashboard:charts.dailyCollisions.description')}
            </CardDescription>
          </div>
          <CardAction>
            <Badge className="border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300">
              {translate('dashboard:badges.sevenDays')}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.weekCollisionTotal > 0 ? (
            <ChartArea>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.collisionTrend} maxBarSize={30}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    dataKey="dateKey"
                    tickLine={false}
                    tick={axisTick}
                    tickFormatter={tickByWeekday}
                  />
                  <YAxis
                    axisLine={false}
                    allowDecimals={false}
                    tickLine={false}
                    tick={axisTick}
                    width={32}
                  />
                  <Tooltip
                    cursor={barChartTooltipCursor}
                    content={
                      <ChartTooltip
                        translate={translate}
                        labelFormatter={tickByWeekday}
                        locale={locale}
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--chart-5)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          ) : (
            <EmptyStateBox
              message={translate('dashboard:charts.dailyCollisions.empty')}
              className="h-[240px] py-0"
              action={
                summary.monitoringHref
                  ? {
                      label: translate('dashboard:emptyCta.openMonitoring'),
                      to: summary.monitoringHref,
                    }
                  : undefined
              }
            />
          )}
          <Separator />
          <StatsRow
            items={[
              {
                label: translate('dashboard:charts.dailyCollisions.today'),
                value: `${summary.todayCollisionCount}${translate('dashboard:units.count')}`,
                tone:
                  summary.todayCollisionCount > 0
                    ? 'text-red-500'
                    : 'text-emerald-500',
              },
              {
                label: translate('dashboard:charts.dailyCollisions.weekTotal'),
                value: `${summary.weekCollisionTotal}${translate('dashboard:units.count')}`,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="border-border/90 bg-background/60 border shadow-none">
        <CardHeader>
          <div>
            <CardTitle>
              {translate('dashboard:charts.dailyAlarms.title')}
            </CardTitle>
            <CardDescription>
              {translate('dashboard:charts.dailyAlarms.description')}
            </CardDescription>
          </div>
          <CardAction>
            <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300">
              {translate('dashboard:badges.sevenDays')}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.weekAlarmTotal > 0 ? (
            <ChartArea>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.alarmTrend} maxBarSize={30}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    dataKey="dateKey"
                    tickLine={false}
                    tick={axisTick}
                    tickFormatter={tickByWeekday}
                  />
                  <YAxis
                    axisLine={false}
                    allowDecimals={false}
                    tickLine={false}
                    tick={axisTick}
                    width={32}
                  />
                  <Tooltip
                    cursor={barChartTooltipCursor}
                    content={
                      <ChartTooltip
                        translate={translate}
                        labelFormatter={tickByWeekday}
                        locale={locale}
                      />
                    }
                  />
                  <Bar
                    dataKey="critical"
                    stackId="severity"
                    fill="var(--destructive)"
                  />
                  <Bar dataKey="high" stackId="severity" fill="var(--chart-5)" />
                  <Bar
                    dataKey="medium"
                    stackId="severity"
                    fill="var(--chart-4)"
                  />
                  <Bar
                    dataKey="info"
                    stackId="severity"
                    fill="var(--chart-1)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          ) : (
            <EmptyStateBox
              message={translate('dashboard:charts.dailyAlarms.empty')}
              className="h-[240px] py-0"
            />
          )}
          <Separator />
          <StatsRow
            items={[
              {
                label: translate('dashboard:charts.dailyAlarms.weekTotal'),
                value: `${summary.weekAlarmTotal}${translate('dashboard:units.count')}`,
                tone: 'text-amber-500',
              },
              {
                label: translate('dashboard:charts.dailyAlarms.weekCritical'),
                value: `${summary.weekCriticalTotal}${translate('dashboard:units.count')}`,
                tone:
                  summary.weekCriticalTotal > 0 ? 'text-red-500' : undefined,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
