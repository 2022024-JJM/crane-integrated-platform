import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type {
  GoliathSensorTimeSeries,
  TimeRange,
} from '@crane/domain/goliath-crane';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@crane/ui/molecules/card';
import { ToggleGroup, ToggleGroupItem } from '@crane/ui/molecules/toggle-group';

const TIME_RANGES: TimeRange[] = ['1h', '6h', '12h', '24h'];

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const time = label
    ? new Date(label).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <div className="border-border bg-popover/95 min-w-[160px] rounded-xl border p-3 text-xs shadow-lg backdrop-blur-sm">
      <p className="text-popover-foreground font-medium">{time}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="text-muted-foreground flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
            </div>
            <span className="text-foreground font-medium tabular-nums">
              {typeof entry.value === 'number'
                ? entry.value.toFixed(1)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SensorChartsPanel({
  data,
  timeRange,
  onTimeRangeChange,
}: {
  data: GoliathSensorTimeSeries[];
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}) {
  const { t } = useTranslation('goliath-crane');

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [data],
  );

  return (
    <Card className="border-border/90 bg-card/60 border shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{t('charts.title')}</CardTitle>
        <CardAction>
          <ToggleGroup
            value={[timeRange]}
            onValueChange={(val) => {
              const next = val[0] as TimeRange | undefined;
              if (next) onTimeRangeChange(next);
            }}
          >
            {TIME_RANGES.map((r) => (
              <ToggleGroupItem
                key={r}
                value={r}
                className="px-2.5 py-1 text-xs"
              >
                {t(`timeRange.${r}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={<ChartTooltipContent />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              />
              <Line
                type="monotone"
                dataKey="load"
                name={t('charts.loadSeries')}
                stroke="var(--hanwha-orange-100)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="windSpeed"
                name={t('charts.windSeries')}
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="hoistHeight"
                name={t('charts.heightSeries')}
                stroke="var(--chart-4)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
