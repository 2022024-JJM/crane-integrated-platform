import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Workflow, ArrowRight } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from '@crane/ui/molecules/card';
import { Badge } from '@crane/ui/atoms/badge';
import type { RepairPipelineSlice } from '../aggregations';
import {
  ChartArea,
  ChartLegend,
  DashboardTooltip,
  REPAIR_STATUS_COLORS,
} from './chart-primitives';

interface Props {
  data: RepairPipelineSlice[];
  total: number;
}

export function RepairPipelineChart({ data, total }: Props) {
  const { t } = useTranslation('philly-dashboard');

  const chartData = data.map((d) => ({
    name: d.status,
    value: d.count,
    color: REPAIR_STATUS_COLORS[d.status],
    label: t(`repairStatus.${d.status}`, { defaultValue: d.status }),
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10">
            <Workflow className="size-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm">{t('charts.repairPipeline.title')}</CardTitle>
            <CardDescription className="text-xs">
              {t('charts.repairPipeline.subtitle')}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Link to="/maintenance">
            <Badge className="cursor-pointer hover:bg-accent">
              {t('charts.viewAll', { defaultValue: 'View all' })}
              <ArrowRight className="ml-1 size-3" />
            </Badge>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyState message={t('charts.empty', { defaultValue: 'No active work' })} />
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
                      innerRadius={55}
                      outerRadius={85}
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
                            value: Number(p.value),
                            color: String((p.payload as { color?: string })?.color ?? 'var(--chart-1)'),
                          }))}
                        />
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartArea>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold tabular-nums">{total}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('charts.repairPipeline.center')}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
