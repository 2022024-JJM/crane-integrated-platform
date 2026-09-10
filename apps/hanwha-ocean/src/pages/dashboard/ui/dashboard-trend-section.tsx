import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  SeverityLegend,
  StatsRow,
} from './dashboard-parts';

interface DashboardTrendSectionProps extends DashboardSectionSharedProps {
  locale: string;
  weekFormatter: Intl.DateTimeFormat;
  barChartTooltipCursor: {
    fill: string;
    stroke: string;
  };
  /** critical, high, medium, info 순 — 페이지가 테마별로 고른 값. */
  severityFills: readonly string[];
}

const COLLISION_FILL = '#ef4444';
/** 오늘이 아닌 날의 막대 투명도 — 오늘을 선택적으로 강조한다(단일 색상). */
const PAST_DAY_OPACITY = 0.45;

/**
 * 최근 7일 journal 실 데이터 추이 — 충돌 건수·알람(심각도 스택). 합성
 * 오프셋 파생 곡선은 제거됐다. 기록이 없으면 차트 대신 안내 문구를 보인다.
 *
 * 심각도 색은 카테고리 4색이 아니라 **빨강 명도 램프(진할수록 위험) + info
 * 파랑**이다 — 빨강·주황·호박 연속 배치는 어떤 조합도 인접 분리(ΔE)가 안
 * 나와 서열 척도인 심각도를 명도로 구분한다(범례·툴팁·구간 갭이 보조 인코딩).
 */
export function DashboardTrendSection({
  summary,
  translate,
  locale,
  weekFormatter,
  barChartTooltipCursor,
  severityFills,
}: DashboardTrendSectionProps) {
  const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 } as const;
  const tickByWeekday = (value: string) => formatDateKey(value, weekFormatter);
  const todayKey =
    summary.collisionTrend[summary.collisionTrend.length - 1]?.dateKey;

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
                <BarChart data={summary.collisionTrend} maxBarSize={24}>
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
                    fill={COLLISION_FILL}
                    radius={[4, 4, 0, 0]}
                  >
                    {summary.collisionTrend.map((point) => (
                      <Cell
                        key={point.dateKey}
                        fillOpacity={
                          point.dateKey === todayKey ? 1 : PAST_DAY_OPACITY
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          ) : (
            <EmptyStateBox
              variant="positive"
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
                <BarChart data={summary.alarmTrend} maxBarSize={24}>
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
                  {/* 구간 사이 표면색 stroke = 스택 세그먼트 갭(보조 인코딩) */}
                  <Bar
                    dataKey="critical"
                    stackId="severity"
                    fill={severityFills[0]}
                    stroke="var(--background)"
                    strokeWidth={1}
                  />
                  <Bar
                    dataKey="high"
                    stackId="severity"
                    fill={severityFills[1]}
                    stroke="var(--background)"
                    strokeWidth={1}
                  />
                  <Bar
                    dataKey="medium"
                    stackId="severity"
                    fill={severityFills[2]}
                    stroke="var(--background)"
                    strokeWidth={1}
                  />
                  <Bar
                    dataKey="info"
                    stackId="severity"
                    fill={severityFills[3]}
                    stroke="var(--background)"
                    strokeWidth={1}
                    radius={[4, 4, 0, 0]}
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
          {summary.weekAlarmTotal > 0 ? (
            <SeverityLegend fills={severityFills} locale={locale} />
          ) : null}
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
