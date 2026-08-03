import { describe, expect, it } from 'vitest';
import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { OpenRisk } from '@crane/features/risk';
import {
  assetReportToCsv,
  buildAssetReport,
  buildMaterialHistoryReport,
  buildOpenRisksReport,
  buildServiceHistoryReport,
  buildServiceSpendReport,
  type AssetReportInput,
} from './build-asset-report';

const inspection = {
  woNumber: 'INS-2026-0001',
  woType: 'frequent',
  craneId: 'crane-660t',
  craneName: '660T Goliath Crane',
  scheduledDate: '2026-07-01',
  actualDate: '2026-07-01',
  assignedTo: '조범희',
  status: 'completed',
  cost: 380,
} as InspectionWO;

const oldInspection = {
  ...inspection,
  woNumber: 'INS-2025-0001',
  scheduledDate: '2025-03-02',
  actualDate: '2025-03-02',
  cost: 300,
} as InspectionWO;

const repair = {
  woNumber: 'RPR-2026-0002',
  sourceType: 'breakdown',
  craneId: 'crane-660t',
  craneName: '660T Goliath Crane',
  assignedTo: '박순영',
  status: 'completed',
  scheduledStart: '2026-05-10T08:00:00',
  actualStart: '2026-05-10T08:00:00',
  actualEnd: '2026-05-10T15:00:00',
  partsUsed: [{ partId: 'p1', partName: 'FAN / FILTER UNIT', qty: 2, unitCost: 350 }],
  laborCost: 600,
  partsCost: 700,
  totalCost: 1300,
} as RepairWO;

const risk: OpenRisk = {
  id: 'r1',
  riskType: 'safety',
  source: 'inspection_finding',
  title: 'Brake wear beyond limit',
  assetName: '660T Goliath Crane',
  craneId: 'crane-660t',
  severity: 'critical',
  date: '2026-07-01',
  detailPath: '/mro2/x',
  woNumber: 'INS-2026-0001',
};

const input: AssetReportInput = {
  risks: [risk],
  inspections: [inspection, oldInspection],
  repairs: [repair],
  year: 2026,
};

describe('buildOpenRisksReport', () => {
  it('리스크를 행으로 옮기고 날짜를 YYYY-MM-DD로 자른다', () => {
    const { rows } = buildOpenRisksReport(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assetName: '660T Goliath Crane',
      riskType: 'safety',
      severity: 'critical',
      woNumber: 'INS-2026-0001',
      date: '2026-07-01',
    });
  });
});

describe('buildServiceHistoryReport', () => {
  it('대상 연도의 점검과 수리만 포함한다', () => {
    const { rows } = buildServiceHistoryReport(input);
    const numbers = rows.map((r) => r.woNumber);
    expect(numbers).toContain('INS-2026-0001');
    expect(numbers).toContain('RPR-2026-0002');
    expect(numbers).not.toContain('INS-2025-0001');
  });

  it('돌발 수리는 On-Call로 분류한다', () => {
    const { rows } = buildServiceHistoryReport(input);
    expect(rows.find((r) => r.woNumber === 'RPR-2026-0002')?.product).toBe('On-Call Repair');
  });

  it('연도를 바꾸면 과거 WO가 잡힌다', () => {
    const { rows } = buildServiceHistoryReport({ ...input, year: 2025 });
    expect(rows.map((r) => r.woNumber)).toEqual(['INS-2025-0001']);
  });
});

describe('buildMaterialHistoryReport', () => {
  it('사용 부품을 펼치고 합계를 계산한다', () => {
    const { rows } = buildMaterialHistoryReport(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ partName: 'FAN / FILTER UNIT', qty: 2, totalCost: 700 });
  });

  it('부품이 없는 연도는 빈 목록', () => {
    expect(buildMaterialHistoryReport({ ...input, year: 2025 }).rows).toHaveLength(0);
  });
});

describe('buildServiceSpendReport', () => {
  it('자산별로 타입 금액과 총액을 집계한다', () => {
    const { rows } = buildServiceSpendReport(input);
    expect(rows).toHaveLength(1);
    // 점검 380(ipm) + 돌발 인건비 600(oncall) + 부품 700(parts)
    expect(rows[0]).toMatchObject({ ipm: 380, oncall: 600, parts: 700, total: 1680 });
  });
});

describe('buildAssetReport + assetReportToCsv', () => {
  it('4종 모두 헤더가 있는 CSV로 직렬화된다', () => {
    for (const key of ['openRisks', 'serviceHistory', 'materialHistory', 'serviceSpend'] as const) {
      const csv = assetReportToCsv(buildAssetReport(key, input));
      expect(csv.split('\r\n')[0].length).toBeGreaterThan(0);
    }
  });

  it('행이 없어도 헤더 한 줄은 남는다', () => {
    const empty: AssetReportInput = { risks: [], inspections: [], repairs: [], year: 2026 };
    expect(assetReportToCsv(buildAssetReport('openRisks', empty))).toBe(
      'Asset,Risk Type,Severity,Finding,Source,WO Number,Date',
    );
  });
});
