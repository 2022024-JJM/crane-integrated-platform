import { cn } from '@crane/core/lib/utils';
import { markerPercent } from '../lib/play3d-format';
import { formatSimClock } from '../lib/sim-clock';

/**
 * 시간 눈금 행 — 리포트 타임라인과 재생바가 함께 쓴다. 첫 눈금은 왼쪽 정렬,
 * 축 끝과 같은 눈금은 오른쪽 정렬, 나머지는 가운데 정렬. 눈금 시각은 lib
 * (timelineViewTicks·transportTicks)가 정한다. `overflow-hidden` 은 끝 근처
 * 라벨이 스크롤 폭을 넓히지 않게 하려는 것이라 className 으로 덮지 않는다.
 */
export function Play3dTickRow({
  ticks,
  axisMs,
  className,
}: {
  ticks: readonly number[];
  axisMs: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'text-muted-foreground relative overflow-hidden font-mono text-[9px] tabular-nums',
        className,
      )}
    >
      {ticks.map((tick, i) => {
        const atStart = i === 0;
        const atEnd = tick >= axisMs;
        return (
          <span
            key={tick}
            className={cn(
              'absolute top-0',
              atStart && 'left-0',
              atEnd && 'right-0',
              !atStart && !atEnd && '-translate-x-1/2',
            )}
            style={
              !atStart && !atEnd
                ? { left: `${markerPercent(tick, axisMs)}%` }
                : undefined
            }
          >
            {formatSimClock(tick)}
          </span>
        );
      })}
    </div>
  );
}
