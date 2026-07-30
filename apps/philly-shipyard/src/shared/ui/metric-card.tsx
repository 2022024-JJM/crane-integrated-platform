import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_PANEL } from './surface';
import { TONE_DOT, type Tone } from './tone';
import { FOCUS_RING } from './controls';

/**
 * KPI 메트릭 카드 — 전 페이지 상단 4카드 공용. 숫자는 항상 뉴트럴 잉크.
 * 주의가 필요한 상태(critical/warning)만 라벨 옆 도트로 표시한다.
 * `to`를 주면 카드 전체가 해당 필터/페이지로 가는 링크가 된다 — 숫자를 보여주면 행동을 붙인다.
 */
export function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
  to,
}: {
  label: string;
  value: string | number;
  /** 값 아래 보조 설명 (자산 관리 KPI 등) */
  sub?: string;
  tone?: Tone;
  /** 클릭 시 이동할 경로 (필터가 걸린 목록 등) */
  to?: string;
}) {
  const showDot = tone === 'critical' || tone === 'warning';
  const inner = (
    <>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {showDot && <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />}
        <span className="flex-1">{label}</span>
        {to && (
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none" />
        )}
      </p>
      <div className="mt-2 space-y-1">
        <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </>
  );

  const surface = cn(SURFACE_PANEL, 'flex min-h-24 flex-col justify-between p-4 shadow-sm');

  if (to) {
    return (
      <Link
        to={to}
        className={cn(surface, FOCUS_RING, 'group cursor-pointer transition-shadow hover:shadow-md')}
      >
        {inner}
      </Link>
    );
  }
  return <div className={surface}>{inner}</div>;
}
