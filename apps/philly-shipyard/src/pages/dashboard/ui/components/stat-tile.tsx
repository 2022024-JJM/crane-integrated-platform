import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT, TONE_SURFACE, type Tone } from '../../../../shared/ui/tone';
import { FOCUS_RING } from '../../../../shared/ui/controls';

/**
 * 톤 틴트 스탯 타일 — 값이 0이면 뉴트럴로 가라앉는다.
 * 색이 곧 "주의가 필요하다"는 신호가 되도록, 의미 없는 0에는 색을 쓰지 않는다.
 */
export function StatTile({
  value,
  label,
  tone,
  to,
}: {
  value: number;
  label: string;
  tone: Tone;
  to?: string;
}) {
  const effective: Tone = value > 0 ? tone : 'neutral';
  const surface = cn(
    'flex min-h-[74px] flex-col justify-between rounded-lg border p-3',
    TONE_SURFACE[effective],
  );

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xl font-bold leading-none tabular-nums text-foreground">{value}</p>
        {to && (
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none" />
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[effective])} />
        <span className="truncate">{label}</span>
      </p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn(surface, FOCUS_RING, 'group transition-shadow hover:shadow-sm')}>
        {inner}
      </Link>
    );
  }
  return <div className={surface}>{inner}</div>;
}
