import { describe, expect, it } from 'vitest';
import type { RepairWO } from '@crane/domain/maintenance';
import type { InspectionWO } from '@crane/domain/inspection';
import {
  aggregateInspectionPassFail,
  aggregateMonthlyServiceMetrics,
} from '../aggregations';

// 집계가 읽는 필드만 채운 최소 목 (status/actualEnd/actualDate/craneId/checklistItems/result)
function repair(partial: Partial<RepairWO>): RepairWO {
  return { status: 'completed', craneId: 'crane-660t', ...partial } as RepairWO;
}

function inspection(partial: Partial<InspectionWO>): InspectionWO {
  return {
    status: 'completed',
    craneId: 'crane-660t',
    checklistItems: [],
    ...partial,
  } as unknown as InspectionWO;
}

const NOW = new Date(2026, 6, 15); // 2026-07-15 로컬

describe('aggregateMonthlyServiceMetrics', () => {
  it('당월 완료 수리+점검 건수와 distinct 자산 수를 집계한다', () => {
    const repairs = [
      repair({ actualEnd: '2026-07-03T14:00:00', craneId: 'crane-660t' }),
      repair({ actualEnd: '2026-06-28T10:00:00', craneId: 'crane-50t' }), // 전월 — 제외
      repair({ status: 'in_progress', actualEnd: '2026-07-05T10:00:00' }), // 미완료 — 제외
    ];
    const inspections = [
      inspection({
        actualDate: '2026-07-10',
        craneId: 'crane-660t',
        checklistItems: [{ judgment: 'fail' }, { judgment: 'pass' }] as InspectionWO['checklistItems'],
      }),
    ];

    const m = aggregateMonthlyServiceMetrics(repairs, inspections, NOW);
    expect(m.visits).toBe(2); // 수리 1 + 점검 1
    expect(m.assets).toBe(1); // 둘 다 crane-660t
    expect(m.findings).toBe(1); // fail 1건
  });

  it('월 초일(1일) 날짜전용 문자열이 당월로 귀속된다 (UTC 파싱 회귀)', () => {
    // 미 동부에서 new Date('2026-07-01')은 6/30 20:00 → 6월로 오귀속되던 버그
    const inspections = [inspection({ actualDate: '2026-07-01' })];
    const m = aggregateMonthlyServiceMetrics([], inspections, NOW);
    expect(m.visits).toBe(1);
  });

  it('actualEnd/actualDate가 없으면 제외한다', () => {
    const m = aggregateMonthlyServiceMetrics(
      [repair({ actualEnd: undefined })],
      [inspection({ actualDate: undefined })],
      NOW,
    );
    expect(m.visits).toBe(0);
  });
});

describe('aggregateInspectionPassFail', () => {
  it('기간 내 완료 점검의 pass/fail만 센다', () => {
    const inspections = [
      inspection({ actualDate: '2026-07-14', result: 'pass' }),
      inspection({ actualDate: '2026-07-12', result: 'fail' }),
      inspection({ actualDate: '2026-07-01', result: 'pass' }), // 7일 밖 — 제외
      inspection({ status: 'scheduled', actualDate: '2026-07-14', result: 'pass' }), // 미완료 — 제외
    ];
    const r = aggregateInspectionPassFail(inspections, NOW, 7);
    expect(r).toEqual({ passed: 1, failed: 1, total: 2 });
  });

  it('경계일(당일)의 날짜전용 문자열도 포함된다', () => {
    // NOW는 7/15 자정 — '2026-07-15'가 UTC 파싱되면 미래(7/15 20:00 전일 기준)로 밀리지 않고 포함되어야 함
    const r = aggregateInspectionPassFail(
      [inspection({ actualDate: '2026-07-15', result: 'pass' })],
      NOW,
      1,
    );
    expect(r.passed).toBe(1);
  });
});
