import type { CraneComponent } from '@crane/domain/asset';
import type { Tone } from '../ui/tone';

/** 수명 사용률 % — currentHours / expectedLifeHours (0h 정의 시 0) */
export function usedLifePercent(component: CraneComponent): number {
  if (component.expectedLifeHours === 0) return 0;
  return Math.min(
    100,
    Math.round((component.currentHours / component.expectedLifeHours) * 100),
  );
}

/** 잔여 수명 % — 화면 표기는 잔여율로 통일한다 (사용률은 내부 계산·임계값 판정용) */
export function remainingLifePercent(component: CraneComponent): number {
  return 100 - usedLifePercent(component);
}

/** 사용률 → 톤 (90%+ critical, 70%+ warning, 그 외 positive) */
export function lifeTone(usedPct: number): Tone {
  return usedPct >= 90 ? 'critical' : usedPct >= 70 ? 'warning' : 'positive';
}
