import type { ComponentStatus, CraneComponent } from '@crane/domain/asset';
import { KC } from '../ui/kc';

/** 부품 상태 → 의미색 (3D 패널·상세 공용 단일 소스) */
export const COMPONENT_STATUS_COLOR: Record<ComponentStatus, string> = {
  normal: KC.ok,
  caution: KC.undetermined,
  warning: KC.production,
  critical: KC.safety,
  replace: KC.safety,
};

/** 수명 사용률 % — currentHours / expectedLifeHours */
export function usedPct(c: CraneComponent): number {
  if (c.expectedLifeHours <= 0) return 0;
  return Math.min(100, Math.round((c.currentHours / c.expectedLifeHours) * 100));
}

/** 잔여 수명 % (표기는 잔여율로 통일) */
export function remainingPct(c: CraneComponent): number {
  return Math.max(0, 100 - usedPct(c));
}

/** 사용률 → 수명 게이지 색 (90%+ 위험 / 70%+ 경고 / 그 외 양호) */
export function lifeColor(used: number): string {
  return used >= 90 ? KC.safety : used >= 70 ? KC.production : KC.ok;
}
