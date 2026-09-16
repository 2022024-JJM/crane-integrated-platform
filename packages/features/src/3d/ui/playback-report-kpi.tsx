import { cn } from '@crane/core/lib/utils';
import { markerPercent, sparklinePath } from '../lib/playback-format';
import type { SeriesPoint } from '../lib/playback-stats';

const SPARK_H = 28;

/**
 * KPI 카드 — 큰 숫자 + 씬 시간 축 누적 스파크라인(스텝) + 보조 문구. 곡선은
 * 창 끝(현재 위치)에서 멈추고 세로선이 현재 위치를 표시한다. 수치→경로 변환은
 * lib/playback-format(sparklinePath).
 */
export function PlaybackKpiCard({
  label,
  value,
  hint,
  tone,
  series,
  axisMs,
  windowEndMs,
  maxV,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  series: readonly SeriesPoint[];
  axisMs: number;
  windowEndMs: number;
  /** 세로축 상한. 생략하면 시리즈 최대값. */
  maxV?: number;
}) {
  const top = maxV ?? series.reduce((m, p) => Math.max(m, p.v), 0);
  const path = sparklinePath(series, axisMs, top, SPARK_H);
  const cursor = markerPercent(windowEndMs, axisMs);
  const stroke =
    tone === 'bad'
      ? 'stroke-red-500'
      : tone === 'warn'
        ? 'stroke-amber-500'
        : tone === 'good'
          ? 'stroke-emerald-500'
          : 'stroke-sky-500';
  const fill =
    tone === 'bad'
      ? 'fill-red-500/15'
      : tone === 'warn'
        ? 'fill-amber-500/15'
        : tone === 'good'
          ? 'fill-emerald-500/15'
          : 'fill-sky-500/15';

  return (
    <div className="bg-muted/40 relative overflow-hidden rounded-md border px-2 pt-1.5 pb-1">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p
        className={cn(
          'font-mono text-xl leading-6 font-bold tabular-nums',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-300',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground truncate text-[10px]" title={hint}>
          {hint}
        </p>
      ) : null}
      <svg
        aria-hidden
        viewBox={`0 0 100 ${SPARK_H}`}
        preserveAspectRatio="none"
        className="mt-1 h-7 w-full"
      >
        {path ? (
          <>
            <path
              d={`${path} V${SPARK_H} H0 Z`}
              className={fill}
              stroke="none"
            />
            <path
              d={path}
              fill="none"
              className={stroke}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
        <line
          x1={cursor}
          x2={cursor}
          y1={0}
          y2={SPARK_H}
          className="stroke-foreground/40"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="2 2"
        />
      </svg>
    </div>
  );
}
