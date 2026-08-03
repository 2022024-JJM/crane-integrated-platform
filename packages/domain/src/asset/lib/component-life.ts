import type { CraneComponent } from '../model/types';

/**
 * 부품 수명 계산 — 앱 전반(MRO/MRO2)의 단일 소스.
 * 색/톤 매핑은 앱별로 다르므로 여기서는 순수 수치·심각도만 제공한다.
 */

/** 수명 사용률 % — currentHours / expectedLifeHours (0h 정의 시 0, 최대 100) */
export function usedLifePercent(component: CraneComponent): number {
  if (component.expectedLifeHours <= 0) return 0;
  return Math.min(
    100,
    Math.round((component.currentHours / component.expectedLifeHours) * 100),
  );
}

/** 잔여 수명 % (표기는 잔여율로 통일) */
export function remainingLifePercent(component: CraneComponent): number {
  return 100 - usedLifePercent(component);
}

export type LifeSeverity = 'critical' | 'warning' | 'ok';

/** 사용률 → 심각도 (90%+ critical, 70%+ warning, 그 외 ok) */
export function lifeSeverity(usedPct: number): LifeSeverity {
  return usedPct >= 90 ? 'critical' : usedPct >= 70 ? 'warning' : 'ok';
}
