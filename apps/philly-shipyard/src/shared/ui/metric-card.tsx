import { cn } from '@crane/core/lib/utils';

/**
 * KPI 메트릭 카드 — 점검/정비/규제 페이지 상단 4카드 공용.
 * dot에는 TONE_DOT 토큰을 넘긴다 (빈 문자열이면 미표시).
 */
export function MetricCard({
  label,
  value,
  dot,
}: {
  label: string;
  value: string | number;
  dot?: string;
}) {
  return (
    <div className="rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dot ? <span className={cn('size-1.5 rounded-full', dot)} /> : null}
        {label}
      </p>
      <p className="text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 text-foreground">
        {value}
      </p>
    </div>
  );
}
