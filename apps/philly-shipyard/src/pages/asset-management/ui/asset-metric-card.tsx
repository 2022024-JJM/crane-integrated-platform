import { cn } from '@crane/core/lib/utils';
import { TONE_DOT, type Tone } from '../../../shared/ui/tone';

/**
 * 자산 관리 KPI 카드 — 숫자는 항상 뉴트럴 잉크. 주의가 필요한 상태(critical/warning)만
 * 라벨 옆 도트로 표시한다.
 * (공용 shared/ui/metric-card.tsx와 달리 sub 텍스트 + tone → 도트 매핑을 가진다)
 */
export function MetricCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'success' | 'warning' | 'critical' | 'neutral';
}) {
  const alertTone: Tone | null =
    tone === 'critical' ? 'critical' : tone === 'warning' ? 'warning' : null;
  return (
    <div className="flex min-h-24 flex-col justify-between rounded border border-border/90 bg-card/80 p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {alertTone && <span className={cn('size-1.5 rounded-full', TONE_DOT[alertTone])} />}
        {label}
      </p>
      <div className="mt-2 space-y-1">
        <p className="text-[1.8rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
