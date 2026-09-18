import { cn } from '@crane/core/lib/utils';

/**
 * KPI 카드 — 라벨 · 큰 숫자 · 보조 한 줄. 색은 문제(bad·warn)일 때만 값에
 * 입힌다. 추세는 바로 아래 타임라인이 맡으므로 스파크라인을 두지 않는다.
 */
export function Play3dKpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'bad' | 'warn' | 'neutral';
}) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-md border px-2 pt-1.5 pb-1.5">
      <p className="text-muted-foreground truncate text-[10px]" title={label}>
        {label}
      </p>
      <p
        className={cn(
          'text-xl leading-6 font-semibold',
          tone === 'warn' && 'text-amber-600 dark:text-amber-300',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground truncate text-[10px]" title={hint}>
        {hint ?? ' '}
      </p>
    </div>
  );
}
