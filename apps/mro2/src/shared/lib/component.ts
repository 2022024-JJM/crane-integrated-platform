import type { ComponentStatus, CraneComponent } from '@crane/domain/asset';
import {
  lifeSeverity,
  remainingLifePercent,
  usedLifePercent,
  type LifeSeverity,
} from '@crane/domain/asset';
import { KC } from '../ui/kc';

/** 부품 상태 → 의미색 (3D 패널·상세 공용 단일 소스) */
export const COMPONENT_STATUS_COLOR: Record<ComponentStatus, string> = {
  normal: KC.ok,
  caution: KC.undetermined,
  warning: KC.production,
  critical: KC.safety,
  replace: KC.safety,
};

/** 수명 사용률 % (도메인 계산 재사용) */
export function usedPct(c: CraneComponent): number {
  return usedLifePercent(c);
}

/** 잔여 수명 % (도메인 계산 재사용) */
export function remainingPct(c: CraneComponent): number {
  return remainingLifePercent(c);
}

const LIFE_SEVERITY_COLOR: Record<LifeSeverity, string> = {
  critical: KC.safety,
  warning: KC.production,
  ok: KC.ok,
};

/** 사용률 → 수명 게이지 KC 색 (도메인 심각도 → 앱 색 매핑) */
export function lifeColor(used: number): string {
  return LIFE_SEVERITY_COLOR[lifeSeverity(used)];
}
