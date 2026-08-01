import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import { KC } from '../ui/kc';

/**
 * Spend 집계 — 서비스 타입 4분류로 WO 데이터를 매핑한다. 이중 계상을 막기 위해 수리비는 labor / parts 로 분해:
 *  - Inspections & Preventive Maintenance: 점검 WO 비용
 *  - Planned Repairs: 비돌발(점검/예방/예지) 수리의 인건비
 *  - On-Call Service: 돌발(breakdown) 수리의 인건비
 *  - Spare Parts: 모든 수리의 부품비
 */
/** 라벨은 mro2:spendType.{key} 번역 키로 해석한다 */
export const SPEND_TYPES = [
  { key: 'ipm', color: KC.s1 },
  { key: 'planned', color: KC.s4 },
  { key: 'oncall', color: KC.safety },
  { key: 'parts', color: KC.s3 },
] as const;

export type SpendTypeKey = (typeof SPEND_TYPES)[number]['key'];

export interface SpendBucket {
  ipm: number;
  planned: number;
  oncall: number;
  parts: number;
}

export interface SpendAggregation {
  total: number;
  visits: number;
  byType: SpendBucket;
  /** 월별(0~11) 타입별 금액 */
  byMonth: SpendBucket[];
  /** craneId → 타입별 금액 */
  byAsset: Record<string, { name: string; bucket: SpendBucket; total: number }>;
  /** 연도별 총액 (트렌드 Yearly) */
  byYear: Record<number, SpendBucket>;
}

function emptyBucket(): SpendBucket {
  return { ipm: 0, planned: 0, oncall: 0, parts: 0 };
}

export function bucketTotal(b: SpendBucket): number {
  return b.ipm + b.planned + b.oncall + b.parts;
}

function add(
  agg: SpendAggregation,
  year: number,
  targetYear: number,
  month: number,
  craneId: string,
  craneName: string,
  key: SpendTypeKey,
  amount: number,
) {
  if (amount <= 0) return;
  (agg.byYear[year] ??= emptyBucket())[key] += amount;
  if (year !== targetYear) return;
  agg.byType[key] += amount;
  agg.total += amount;
  agg.byMonth[month][key] += amount;
  const entry = (agg.byAsset[craneId] ??= {
    name: craneName,
    bucket: emptyBucket(),
    total: 0,
  });
  entry.bucket[key] += amount;
  entry.total += amount;
}

export function computeSpend(
  inspections: InspectionWO[],
  repairs: RepairWO[],
  targetYear: number,
): SpendAggregation {
  const agg: SpendAggregation = {
    total: 0,
    visits: 0,
    byType: emptyBucket(),
    byMonth: Array.from({ length: 12 }, emptyBucket),
    byAsset: {},
    byYear: {},
  };

  for (const wo of inspections) {
    const d = new Date(wo.actualDate ?? wo.scheduledDate);
    if (d.getFullYear() === targetYear) agg.visits += 1;
    add(agg, d.getFullYear(), targetYear, d.getMonth(), wo.craneId, wo.craneName, 'ipm', wo.cost ?? 0);
  }

  for (const wo of repairs) {
    const d = new Date(wo.actualStart ?? wo.scheduledStart);
    if (d.getFullYear() === targetYear) agg.visits += 1;
    const laborKey: SpendTypeKey = wo.sourceType === 'breakdown' ? 'oncall' : 'planned';
    add(agg, d.getFullYear(), targetYear, d.getMonth(), wo.craneId, wo.craneName, laborKey, wo.laborCost ?? 0);
    add(agg, d.getFullYear(), targetYear, d.getMonth(), wo.craneId, wo.craneName, 'parts', wo.partsCost ?? 0);
  }

  return agg;
}
