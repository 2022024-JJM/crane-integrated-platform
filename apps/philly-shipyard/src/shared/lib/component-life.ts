import { lifeSeverity, type LifeSeverity } from '@crane/domain/asset';
import type { Tone } from '../ui/tone';

// 수명 수치 계산은 도메인 단일 소스를 재사용 — 색/톤 매핑만 앱별로 유지한다.
export { usedLifePercent, remainingLifePercent } from '@crane/domain/asset';

const SEVERITY_TONE: Record<LifeSeverity, Tone> = {
  critical: 'critical',
  warning: 'warning',
  ok: 'positive',
};

/** 사용률 → 톤 (90%+ critical, 70%+ warning, 그 외 positive) */
export function lifeTone(usedPct: number): Tone {
  return SEVERITY_TONE[lifeSeverity(usedPct)];
}
