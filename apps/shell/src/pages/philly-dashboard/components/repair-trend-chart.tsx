import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import type { WeeklyTrendRow } from '../aggregations';
import {
  ChartArea,
  ChartLegend,
  DashboardTooltip,
  TREND_COLORS,
} from './chart-primitives';

interface Props {
  data: WeeklyTrendRow[];
}

export function RepairTrendChart({ data }: Props) {
  const { t } = useTranslation('philly-dashboard');

  const completedLabel = t('charts.repairTrend.legend.completed', { defaultValue: 'Completed' });
  const emergencyLabel = t('charts.repairTrend.legend.emergency', { defaultValue: 'Emergency' });

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10">
            <TrendingUp className="size-4 text-violet-500" />
          </div>
          <div>
            <CardTitle className="text-sm">{t('charts.repairTrend.title')}</CardTitle>
            <CardDescription className="text-xs">
              {t('charts.repairTrend.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartArea height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="weekKey"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={(props) => (
                  <DashboardTooltip
                    active={props.active}
                    title={String(props.label ?? '')}
                    entries={(props.payload ?? []).map((p) => ({
                      label: p.dataKey === 'emergency' ? emergencyLabel : completedLabel,
                      value: Number(p.value),
                      color: String(p.color ?? 'var(--chart-2)'),
                    }))}
                  />
                )}
              />
              <Line
                type="monotone"
                dataKey="completed"
                stroke={TREND_COLORS.completed}
                strokeWidth={2}
                dot={{ r: 3, fill: TREND_COLORS.completed }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="emergency"
                stroke={TREND_COLORS.emergency}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: TREND_COLORS.emergency }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartArea>
        <ChartLegend
          className="mt-3 justify-center"
          items={[
            { label: completedLabel, color: TREND_COLORS.completed },
            { label: emergencyLabel, color: TREND_COLORS.emergency },
          ]}
        />
      </CardContent>
    </Card>
  );
}
