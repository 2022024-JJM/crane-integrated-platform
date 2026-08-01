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
        tone: inspectionTone(w.status),
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
