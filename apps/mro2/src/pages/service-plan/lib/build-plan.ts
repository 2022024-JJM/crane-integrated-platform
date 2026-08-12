import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { ServiceTone } from '../../../shared/ui/kc';
import { inspectionTone, repairTone, yearOf } from '../../../shared/lib/service-status';

/**
 * 자산×월 서비스 플랜 매트릭스 집계 (매뉴얼 6p "Assets and Service Plan").
 * 셀 색은 그 달 활동 중 "가장 나쁜" 상태를 따른다 (지연 > 진행중 > 예정 > 완료).
 */

const TONE_RANK: Record<ServiceTone, number> = {
  completed: 0,
  open: 1,
  inProgress: 2,
  delayed: 3,
};

export function worstTone(a: ServiceTone, b: ServiceTone): ServiceTone {
  return TONE_RANK[a] >= TONE_RANK[b] ? a : b;
}

export interface PlanCell {
  count: number;
  tone: ServiceTone;
}

export interface PlanRow {
  key: string;
  label: string;
  /** 길이 12 — 활동 없는 달은 null */
  cells: (PlanCell | null)[];
}

export interface AssetPlan {
  craneId: string;
  craneName: string;
  total: PlanRow;
  products: PlanRow[];
}

export interface PlanSummary {
  total: number;
  completed: number;
  open: number;
  inProgress: number;
  delayed: number;
}

/** 상태 요약에 표시되는 4개 항목 — 퍼센티지 합이 100이 되어야 하는 단위 */
export const PLAN_STATUS_KEYS = ['completed', 'open', 'inProgress', 'delayed'] as const;

export type PlanStatusKey = (typeof PLAN_STATUS_KEYS)[number];

/**
 * 상태별 퍼센티지 — 각 값을 따로 반올림하면 합이 100을 벗어난다.
 * (예: 32건의 12.5%/37.5%가 각각 올림되어 13+38 → 합계 101)
 *
 * 내림으로 배분한 뒤 남는 몫을 소수부가 큰 항목부터 1씩 나눠주는
 * 최대 잔여(largest remainder) 방식으로 합을 정확히 100에 맞춘다.
 */
export function planStatusPercents(summary: PlanSummary): Record<PlanStatusKey, number> {
  const result = { completed: 0, open: 0, inProgress: 0, delayed: 0 };
  if (summary.total <= 0) return result;

  const exact = PLAN_STATUS_KEYS.map((key) => {
    const value = (summary[key] / summary.total) * 100;
    return { key, floor: Math.floor(value), frac: value - Math.floor(value) };
  });

  for (const e of exact) result[e.key] = e.floor;

  // 내림으로 잃은 몫을 소수부가 큰 항목부터 되돌려준다.
  // 소수부가 같으면 원래 건수가 많은 쪽을 우선해 순서를 안정적으로 만든다.
  let remainder = 100 - exact.reduce((s, e) => s + e.floor, 0);
  const order = [...exact].sort(
    (a, b) => b.frac - a.frac || summary[b.key] - summary[a.key],
  );
  for (const e of order) {
    if (remainder <= 0) break;
    result[e.key] += 1;
    remainder -= 1;
  }

  return result;
}

interface PlanEvent {
  craneId: string;
  craneName: string;
  month: number;
  tone: ServiceTone;
  product: string;
}

function emptyCells(): (PlanCell | null)[] {
  return Array.from({ length: 12 }, () => null);
}

function addToRow(row: PlanRow, ev: PlanEvent): void {
  const cell = row.cells[ev.month];
  row.cells[ev.month] = cell
    ? { count: cell.count + 1, tone: worstTone(cell.tone, ev.tone) }
    : { count: 1, tone: ev.tone };
}

export function buildServicePlan(
  inspections: InspectionWO[],
  repairs: RepairWO[],
  year: number,
  labels: {
    inspectionProduct: (woType: InspectionWO['woType']) => string;
    repairProduct: (sourceType: RepairWO['sourceType']) => string;
  },
): { assets: AssetPlan[]; summary: PlanSummary; products: string[] } {
  const events: PlanEvent[] = [
    ...inspections
      .filter((w) => yearOf(w.scheduledDate) === year)
      .map((w) => ({
        craneId: w.craneId,
        craneName: w.craneName,
        month: new Date(w.actualDate ?? w.scheduledDate).getMonth(),
        tone: inspectionTone(w.status, w.scheduledDate),
        product: labels.inspectionProduct(w.woType),
      })),
    ...repairs
      .filter((w) => yearOf(w.scheduledStart) === year)
      .map((w) => ({
        craneId: w.craneId,
        craneName: w.craneName,
        month: new Date(w.actualStart ?? w.scheduledStart).getMonth(),
        tone: repairTone(w.status, w.scheduledEnd),
        product: labels.repairProduct(w.sourceType),
      })),
  ];

  const byAsset = new Map<string, AssetPlan>();
  const productSet = new Set<string>();
  const summary: PlanSummary = { total: 0, completed: 0, open: 0, inProgress: 0, delayed: 0 };

  for (const ev of events) {
    summary.total += 1;
    summary[ev.tone] += 1;
    productSet.add(ev.product);

    let asset = byAsset.get(ev.craneId);
    if (!asset) {
      asset = {
        craneId: ev.craneId,
        craneName: ev.craneName,
        total: { key: 'total', label: ev.craneName, cells: emptyCells() },
        products: [],
      };
      byAsset.set(ev.craneId, asset);
    }
    addToRow(asset.total, ev);

    let productRow = asset.products.find((r) => r.key === ev.product);
    if (!productRow) {
      productRow = { key: ev.product, label: ev.product, cells: emptyCells() };
      asset.products.push(productRow);
    }
    addToRow(productRow, ev);
  }

  const assets = [...byAsset.values()].sort((a, b) => a.craneName.localeCompare(b.craneName));
  for (const a of assets) a.products.sort((x, y) => x.label.localeCompare(y.label));

  return { assets, summary, products: [...productSet].sort() };
}
