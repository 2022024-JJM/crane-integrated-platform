import { cn } from '@crane/core/lib/utils';
import { sparklinePoints, type TagSample } from '../lib/tag-history';

const WIDTH = 240;
const HEIGHT = 48;

/**
 * 미리보기의 작은 꺾은선 — 최근 표본을 가로(시각)·세로(값 범위)로 편다.
 * 숫자 계산은 lib/tag-history.ts 의 `sparklinePoints`. 표본이 없으면 빈 상자.
 */
export function TagSparkline({
  samples,
  className,
}: {
  samples: readonly TagSample[];
  className?: string;
}) {
  const points = sparklinePoints(samples, WIDTH, HEIGHT);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('bg-muted/50 h-12 w-full rounded-sm', className)}
      aria-hidden
    >
      {points ? (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-primary"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
