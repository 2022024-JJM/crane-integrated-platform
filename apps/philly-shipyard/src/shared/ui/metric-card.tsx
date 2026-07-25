import { cn } from '@crane/core/lib/utils';
import { SURFACE_PANEL } from './surface';
import { TONE_DOT, type Tone } from './tone';

/**
 * KPI 메트릭 카드 — 전 페이지 상단 4카드 공용. 숫자는 항상 뉴트럴 잉크.
 * 주의가 필요한 상태(critical/warning)만 라벨 옆 도트로 표시한다.
 */
export function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  /** 값 아래 보조 설명 (자산 관리 KPI 등) */
  sub?: string;
  tone?: Tone;
}) {
  const showDot = tone === 'critical' || tone === 'warning';
  return (
    <div className={cn(SURFACE_PANEL, 'flex min-h-24 flex-col justify-between p-4 shadow-sm')}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {showDot && <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />}
        {label}
      </p>
      <div className="mt-2 space-y-1">
        <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
