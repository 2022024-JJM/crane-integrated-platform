import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { cn } from '@crane/core/lib/utils';

const SIZE_MAP = {
  sm: { px: 84, inner: 30, outer: 42, number: 'text-base', label: 'text-[9px]' },
  md: { px: 116, inner: 42, outer: 56, number: 'text-xl', label: 'text-[10px]' },
  lg: { px: 148, inner: 56, outer: 72, number: 'text-3xl', label: 'text-[11px]' },
} as const;

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
}

interface MetricDonutProps {
  segments: DonutSegment[];
  centerNumber: number | string;
  centerLabel?: string;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export function MetricDonut({
  segments,
  centerNumber,
  centerLabel,
  size = 'md',
  className,
}: MetricDonutProps) {
  const config = SIZE_MAP[size];
  const data =
    segments.length === 0 || segments.every((s) => s.value === 0)
      ? [{ key: '__empty', value: 1, color: 'var(--muted)' }]
      : segments;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: config.px, height: config.px }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            cx="50%"
            cy="50%"
            innerRadius={config.inner}
            outerRadius={config.outer}
            stroke="var(--background)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-semibold tabular-nums leading-none', config.number)}>
          {centerNumber}
        </span>
        {centerLabel && (
          <span
            className={cn(
              'mt-1 text-muted-foreground uppercase tracking-wider',
              config.label,
            )}
          >
            {centerLabel}
          </span>
        )}
      </div>
    </div>
  );
}
