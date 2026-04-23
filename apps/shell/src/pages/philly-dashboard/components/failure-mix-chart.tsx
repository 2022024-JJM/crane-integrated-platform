import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import type { FailureMixSlice } from '../aggregations';
import {
  ChartArea,
  ChartLegend,
  DashboardTooltip,
  FAILURE_TYPE_COLORS,
} from './chart-primitives';

interface Props {
  data: FailureMixSlice[];
}

export function FailureMixChart({ data }: Props) {
  const { t } = useTranslation('philly-dashboard');

  const chartData = data.map((d) => ({
    name: d.type,
    value: d.count,
    color: FAILURE_TYPE_COLORS[d.type],
    label: t(`failureType.${d.type}`, { defaultValue: d.type }),
  }));

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10">
            <Activity className="size-4 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-sm">{t('charts.failureMix.title')}</CardTitle>
            <CardDescription className="text-xs">
              {t('charts.failureMix.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            {t('charts.empty', { defaultValue: 'No data' })}
          </div>
        ) : (
          <>
            <div className="relative">
              <ChartArea height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      stroke="var(--background)"
                      strokeWidth={2}
                    >
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      content={(props) => (
                        <DashboardTooltip
                          active={props.active}
                          entries={(props.payload ?? []).map((p) => ({
                            label: String((p.payload as { label?: string })?.label ?? p.name),
                            value: `${p.value} (${Math.round((Number(p.value) / total) * 100)}%)`,
                            color: String((p.payload as { color?: string })?.color ?? 'var(--chart-1)'),
                          }))}
                        />
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartArea>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">{total}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('charts.failureMix.center', { defaultValue: 'Repairs' })}
                </span>
              </div>
            </div>
            <ChartLegend
              className="mt-3 justify-center"
              items={chartData.map((d) => ({ label: d.label, color: d.color }))}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
