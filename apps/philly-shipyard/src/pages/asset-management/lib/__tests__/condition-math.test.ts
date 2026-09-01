import { describe, expect, it } from 'vitest';
import type { CraneComponent } from '@crane/domain/asset';
import { computeClusterCondition, buildLifeTrend } from '../condition-math';

function component(partial: Partial<CraneComponent>): CraneComponent {
  return {
    id: 'comp-1',
    parentId: null,
    craneId: 'crane-660t',
    componentName: 'DCM Drive',
    componentType: 'electrical',
    installDate: '2024-08-15',
    expectedLifeHours: 50000,
    currentHours: 10000,
    status: 'normal',
    lastInspectionDate: '2026-07-01',
    nextInspectionDate: '2026-08-01',
    ...partial,
  } as CraneComponent;
}

const NOW = new Date(2026, 6, 25); // 2026-07-25 로컬

describe('computeClusterCondition', () => {
  it('사용률·잔여율·톤을 기존 usedLifePercent/lifeTone 규칙으로 계산한다', () => {
    const cond = computeClusterCondition(
      component({ expectedLifeHours: 10000, currentHours: 7800 }),
      NOW,
    );
    expect(cond.usedPct).toBe(78);
    expect(cond.remainingPct).toBe(22);
    expect(cond.tone).toBe('warning');
  });

  it('연평균 소모율과 EOL을 설치일 기반으로 외삽한다', () => {
    // 2024-08-15 설치, 2026-07-25 기준 약 1.94년 경과, 10000h 사용
    const cond = computeClusterCondition(component({}), NOW);
    // hoursPerYear ≈ 5150 → annualWear ≈ 10.3%/년, 총 수명 ≈ 9.7년 → EOL 2034년경
    expect(cond.annualWearPct).toBeGreaterThan(9);
    expect(cond.annualWearPct).toBeLessThan(12);
    expect(cond.estimatedEol).toMatch(/^203[3-5]-\d{2}$/);
  });

  it('가동 이력 0h이면 EOL은 null이고 NaN이 없다', () => {
    const cond = computeClusterCondition(component({ currentHours: 0 }), NOW);
    expect(cond.estimatedEol).toBeNull();
    expect(Number.isFinite(cond.annualWearPct)).toBe(true);
    expect(cond.annualWearPct).toBe(0);
  });

  it('신규 설치(경과 < 3개월)는 0.25년으로 클램프되어 Infinity가 없다', () => {
    const cond = computeClusterCondition(
      component({ installDate: '2026-07-01', currentHours: 500 }),
      NOW,
    );
    expect(Number.isFinite(cond.annualWearPct)).toBe(true);
    expect(cond.estimatedEol).not.toBeNull();
  });
});

describe('buildLifeTrend', () => {
  it('100%에서 시작해 EOL 부근에서 0으로 수렴한다', () => {
    const cond = computeClusterCondition(component({}), NOW);
    const trend = buildLifeTrend(cond);
    expect(trend[0]!.remaining).toBeGreaterThan(90);
    expect(trend[trend.length - 1]!.remaining).toBeLessThanOrEqual(cond.annualWearPct);
    expect(trend.length).toBeLessThanOrEqual(31);
  });

  it('마모율 0이어도 30년 캡으로 종료한다', () => {
    const cond = computeClusterCondition(component({ currentHours: 0 }), NOW);
    const trend = buildLifeTrend(cond);
    expect(trend.length).toBeLessThanOrEqual(31);
    expect(trend.every((p) => p.remaining === 100)).toBe(true);
  });
});
