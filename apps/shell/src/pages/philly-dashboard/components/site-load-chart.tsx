import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { SiteLoadRow } from '../aggregations';
import {
  ASSET_STATUS_COLORS,
  ChartArea,
  ChartLegend,
  DashboardTooltip,
} from './chart-primitives';

interface Props {
  data: SiteLoadRow[];
}

const STACK_KEYS = ['operating', 'inspection', 'repair', 'idle'] as const;

export function SiteLoadChart({ data }: Props) {
  const { t } = useTranslation('philly-dashboard');

  const chartData = data.map((row) => ({
    ...row,
    siteLabel: t(`sites.${row.siteKey}`, { defaultValue: row.siteId }),
  }));

  const legendItems = STACK_KEYS.map((k) => ({
    label: t(`charts.siteLoad.legend.${k}`, { defaultValue: k }),
    color: ASSET_STATUS_COLORS[k],
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10">
            <Building2 className="size-4 text-emerald-500" />
          </div>
          <div>
            <CardTitle className="text-sm">{t('charts.siteLoad.title')}</CardTitle>
            <CardDescription className="text-xs">
              {t('charts.siteLoad.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartArea height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={11}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="siteLabel"
                stroke="var(--muted-foreground)"
                fontSize={11}
                width={92}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                content={(props) => (
                  <DashboardTooltip
                    active={props.active}
                    title={String(props.label ?? '')}
                    entries={(props.payload ?? []).map((p) => ({
                      label: t(`charts.siteLoad.legend.${p.dataKey}`, {
                        defaultValue: String(p.dataKey),
                      }),
                      value: Number(p.value),
                      color: String(p.color ?? 'var(--chart-1)'),
                    }))}
                  />
                )}
              />
              {STACK_KEYS.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="site"
                  fill={ASSET_STATUS_COLORS[key]}
                  radius={key === 'idle' ? [0, 4, 4, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartArea>
        <ChartLegend className="mt-3 justify-center" items={legendItems} />
      </CardContent>
    </Card>
  );
}
