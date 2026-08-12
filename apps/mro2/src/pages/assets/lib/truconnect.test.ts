import { describe, expect, it } from 'vitest';
import type { CraneComponent } from '@crane/domain/asset';
import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import {
  alertMonthlyTrend,
  alertPareto,
  buildLifeProjection,
  deriveAlerts,
  inRange,
  loadSpectrum,
  presetRange,
} from './truconnect';

const NOW = new Date(2026, 7, 4); // 2026-08-04

function component(over: Partial<CraneComponent>): CraneComponent {
  return {
    id: 'c1',
    parentId: null,
    craneId: 'crane-1',
    componentName: 'Hoist',
    componentType: 'hoist' as CraneComponent['componentType'],
    installDate: '2020-01-01',
    expectedLifeHours: 10000,
    currentHours: 3000,
    status: 'good' as CraneComponent['status'],
    lastInspectionDate: '2026-01-01',
    nextInspectionDate: '2027-01-01',
    ...over,
  };
}

function repair(over: Partial<RepairWO>): RepairWO {
  return {
    id: 'r1',
    woNumber: 'WO-R-1',
    sourceType: 'inspection',
    craneId: 'crane-1',
    craneName: 'Crane 1',
    siteId: 's1',
    siteName: 'Site',
    componentName: 'Brake',
    failureType: 'mechanical',
    failureDescription: 'worn',
    repairLevel: 'minor',
    performerType: 'internal',
    assignedTo: 'Tech',
    status: 'completed',
    priority: 'normal',
    scheduledStart: '2026-03-10T09:00:00',
    scheduledEnd: '2026-03-10T17:00:00',
    actualStart: '2026-03-10T09:00:00',
    actualEnd: '2026-03-10T15:00:00',
    downtimeHours: 2,
    partsUsed: [],
    laborHours: 4,
    laborCost: 400,
    partsCost: 0,
    totalCost: 400,
    ...over,
  } as RepairWO;
}

function inspection(items: Array<Partial<InspectionWO['checklistItems'][number]>>): InspectionWO {
  return {
    id: 'i1',
    woNumber: 'WO-I-1',
    woType: 'frequent',
    craneId: 'crane-1',
    craneName: 'Crane 1',
    siteId: 's1',
    siteName: 'Site',
    scheduledDate: '2026-05-02',
    actualDate: '2026-05-02',
    assignedTo: 'Insp',
    performerType: 'internal',
    status: 'completed',
    priority: 'normal',
    result: 'fail',
    checklistItems: items.map((o, i) => ({
      id: `chk-${i}`,
      category: 'Hoisting',
      itemName: `Item ${i}`,
      judgment: 'pass',
      actionRequired: 'none',
      ...o,
    })) as InspectionWO['checklistItems'],
  } as InspectionWO;
}

describe('presetRange / inRange', () => {
  it('last30 은 30일 전부터 지금까지', () => {
    const r = presetRange('last30', NOW);
    expect(r.end).toEqual(NOW);
    expect(Math.round((r.end.getTime() - r.start.getTime()) / 86400_000)).toBe(30);
  });

  it('year 는 1월 1일부터', () => {
    const r = presetRange('year', NOW);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
  });

  it('inRange 는 경계 포함', () => {
    const r = { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) };
    expect(inRange('2026-01-01', r)).toBe(true);
    expect(inRange('2025-12-31', r)).toBe(false);
  });
});

describe('buildLifeProjection', () => {
  it('마모율을 직선 연장해 종료년도를 추정한다', () => {
    // 6년 사용에 30% 소모 → 연 5% → 총 20년 → 2040년 종료
    const p = buildLifeProjection(component({}), NOW);
    expect(p.currentPct).toBe(70);
    expect(p.estimatedEndYear).toBe(2040);
    expect(p.points[0]).toEqual({ year: 2020, pct: 100 });
    // 차트는 +12년 상한
    expect(p.points[p.points.length - 1].year).toBe(2038);
  });

  it('사용량 0이면 종료 추정 없음', () => {
    const p = buildLifeProjection(component({ currentHours: 0 }), NOW);
    expect(p.estimatedEndYear).toBeNull();
    expect(p.currentPct).toBe(100);
  });

  it('수명 초과분은 0%로 클램프', () => {
    const p = buildLifeProjection(component({ currentHours: 12000 }), NOW);
    expect(p.currentPct).toBe(0);
  });
});

describe('deriveAlerts', () => {
  it('수리 → safety/production 분류 (emergency·breakdown 은 safety)', () => {
    const alerts = deriveAlerts(
      [],
      [
        repair({}),
        { ...repair({}), id: 'r2', priority: 'emergency' } as RepairWO,
        { ...repair({}), id: 'r3', sourceType: 'breakdown' } as RepairWO,
      ],
    );
    expect(alerts).toHaveLength(3);
    expect(alerts.filter((a) => a.kind === 'safety')).toHaveLength(2);
  });

  it('점검 카테고리 원문과 수리 고장유형 키가 같은 원인으로 합쳐진다', () => {
    const alerts = deriveAlerts(
      [inspection([{ judgment: 'fail', severity: 'minor', category: 'Electrical' }])],
      [{ ...repair({}), failureType: 'electrical' } as RepairWO],
    );
    expect(new Set(alerts.map((a) => a.cause))).toEqual(new Set(['electrical']));
  });

  it('점검 fail 항목만 알림이 되고 심각도로 분류된다', () => {
    const alerts = deriveAlerts(
      [
        inspection([
          { judgment: 'fail', severity: 'critical' },
          { judgment: 'fail', severity: 'minor' },
          { judgment: 'pass' },
        ]),
      ],
      [],
    );
    expect(alerts).toHaveLength(2);
    expect(alerts.filter((a) => a.kind === 'safety')).toHaveLength(1);
  });
});

describe('alertPareto', () => {
  it('건수 내림차순 + 누적 % 는 100 에서 끝난다', () => {
    const pareto = alertPareto([
      { date: '2026-01-01', cause: 'mechanical', kind: 'production' },
      { date: '2026-01-02', cause: 'mechanical', kind: 'production' },
      { date: '2026-01-03', cause: 'electrical', kind: 'safety' },
    ]);
    expect(pareto[0]).toEqual({ cause: 'mechanical', count: 2, cumPct: 67 });
    expect(pareto[1].cumPct).toBe(100);
  });
});

describe('alertMonthlyTrend', () => {
  it('빈 달을 포함해 연속 버킷을 만든다', () => {
    const range = { start: new Date(2026, 0, 15), end: new Date(2026, 3, 10) };
    const trend = alertMonthlyTrend(
      [
        { date: '2026-01-20', cause: 'x', kind: 'safety' },
        { date: '2026-03-05', cause: 'y', kind: 'production' },
      ],
      range,
    );
    expect(trend).toHaveLength(4); // Jan~Apr
    expect(trend[0].safety).toBe(1);
    expect(trend[1].safety + trend[1].production).toBe(0);
    expect(trend[2].production).toBe(1);
  });
});

describe('loadSpectrum', () => {
  it('11개 버킷, 합계 ~100%, 저부하 집중, 결정적', () => {
    const a = loadSpectrum('crane-1');
    const b = loadSpectrum('crane-1');
    expect(a).toEqual(b);
    expect(a).toHaveLength(11);
    expect(a[0].label).toBe('0-10');
    expect(a[0].pct).toBeGreaterThan(a[10].pct);
    const sum = a.reduce((s, x) => s + x.pct, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });
});
