import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { OpenRisk } from '@crane/features/risk';
import { toCsv, type CsvColumn } from '../../../shared/lib/export-csv';
import { computeSpend } from '../../../shared/lib/spend';

/**
 * 매뉴얼 5p "Asset Reports" 4종 — Open risks / Service history / Material history / Service spend.
 * 라벨은 호출부(i18n)에서 주입받아 이 모듈이 번역에 의존하지 않게 한다.
 */
export type AssetReportKey = 'openRisks' | 'serviceHistory' | 'materialHistory' | 'serviceSpend';

export const ASSET_REPORT_KEYS: AssetReportKey[] = [
  'openRisks',
  'serviceHistory',
  'materialHistory',
  'serviceSpend',
];

export interface AssetReportInput {
  risks: OpenRisk[];
  inspections: InspectionWO[];
  repairs: RepairWO[];
  year: number;
}

export interface AssetReport<T = unknown> {
  rows: T[];
  columns: CsvColumn<T>[];
}

export interface OpenRiskRow {
  assetName: string;
  riskType: string;
  severity: string;
  title: string;
  source: string;
  woNumber: string;
  date: string;
}

export interface ServiceHistoryRow {
  woNumber: string;
  kind: string;
  assetName: string;
  product: string;
  status: string;
  scheduledDate: string;
  actualDate: string;
  assignedTo: string;
  cost: number | null;
}

export interface MaterialHistoryRow {
  woNumber: string;
  assetName: string;
  partName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  date: string;
}

export interface ServiceSpendRow {
  assetName: string;
  ipm: number;
  planned: number;
  oncall: number;
  parts: number;
  total: number;
}

/** 날짜 문자열에서 YYYY-MM-DD 부분만 취한다 (T 이후 시각 절삭) */
function dayOf(d: string | null | undefined): string {
  if (!d) return '';
  return d.slice(0, 10);
}

function yearOf(d: string): number {
  return new Date(d).getFullYear();
}

export function buildOpenRisksReport(input: AssetReportInput): AssetReport<OpenRiskRow> {
  const rows: OpenRiskRow[] = input.risks.map((r) => ({
    assetName: r.assetName ?? '',
    riskType: r.riskType,
    severity: r.severity,
    title: r.title,
    source: r.source,
    woNumber: r.woNumber ?? '',
    date: dayOf(r.date),
  }));
  return {
    rows,
    columns: [
      { header: 'Asset', value: (r) => r.assetName },
      { header: 'Risk Type', value: (r) => r.riskType },
      { header: 'Severity', value: (r) => r.severity },
      { header: 'Finding', value: (r) => r.title },
      { header: 'Source', value: (r) => r.source },
      { header: 'WO Number', value: (r) => r.woNumber },
      { header: 'Date', value: (r) => r.date },
    ],
  };
}

export function buildServiceHistoryReport(input: AssetReportInput): AssetReport<ServiceHistoryRow> {
  const { year } = input;
  const rows: ServiceHistoryRow[] = [
    ...input.inspections
      .filter((w) => yearOf(w.actualDate ?? w.scheduledDate) === year)
      .map((w) => ({
        woNumber: w.woNumber,
        kind: 'Inspection',
        assetName: w.craneName,
        product: w.woType,
        status: w.status,
        scheduledDate: dayOf(w.scheduledDate),
        actualDate: dayOf(w.actualDate),
        assignedTo: w.assignedTo,
        cost: w.cost ?? null,
      })),
    ...input.repairs
      .filter((w) => yearOf(w.actualStart ?? w.scheduledStart) === year)
      .map((w) => ({
        woNumber: w.woNumber,
        kind: 'Repair',
        assetName: w.craneName,
        product: w.sourceType === 'breakdown' ? 'On-Call Repair' : 'Planned Repair',
        status: w.status,
        scheduledDate: dayOf(w.scheduledStart),
        actualDate: dayOf(w.actualEnd),
        assignedTo: w.assignedTo,
        cost: w.totalCost ?? null,
      })),
  ].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));

  return {
    rows,
    columns: [
      { header: 'WO Number', value: (r) => r.woNumber },
      { header: 'Type', value: (r) => r.kind },
      { header: 'Asset', value: (r) => r.assetName },
      { header: 'Service Product', value: (r) => r.product },
      { header: 'Status', value: (r) => r.status },
      { header: 'Scheduled', value: (r) => r.scheduledDate },
      { header: 'Completed', value: (r) => r.actualDate },
      { header: 'Technician', value: (r) => r.assignedTo },
      { header: 'Cost (USD)', value: (r) => r.cost },
    ],
  };
}

export function buildMaterialHistoryReport(input: AssetReportInput): AssetReport<MaterialHistoryRow> {
  const { year } = input;
  const rows: MaterialHistoryRow[] = input.repairs
    .filter((w) => yearOf(w.actualStart ?? w.scheduledStart) === year)
    .flatMap((w) =>
      w.partsUsed.map((p) => ({
        woNumber: w.woNumber,
        assetName: w.craneName,
        partName: p.partName,
        qty: p.qty,
        unitCost: p.unitCost,
        totalCost: p.qty * p.unitCost,
        date: dayOf(w.actualStart ?? w.scheduledStart),
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    rows,
    columns: [
      { header: 'WO Number', value: (r) => r.woNumber },
      { header: 'Asset', value: (r) => r.assetName },
      { header: 'Part', value: (r) => r.partName },
      { header: 'Qty', value: (r) => r.qty },
      { header: 'Unit Cost (USD)', value: (r) => r.unitCost },
      { header: 'Total (USD)', value: (r) => r.totalCost },
      { header: 'Date', value: (r) => r.date },
    ],
  };
}

export function buildServiceSpendReport(input: AssetReportInput): AssetReport<ServiceSpendRow> {
  const spend = computeSpend(input.inspections, input.repairs, input.year);
  const rows: ServiceSpendRow[] = Object.values(spend.byAsset)
    .map((a) => ({
      assetName: a.name,
      ipm: a.bucket.ipm,
      planned: a.bucket.planned,
      oncall: a.bucket.oncall,
      parts: a.bucket.parts,
      total: a.total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    columns: [
      { header: 'Asset', value: (r) => r.assetName },
      { header: 'Inspections & Preventive Maintenance (USD)', value: (r) => r.ipm },
      { header: 'Planned Repairs (USD)', value: (r) => r.planned },
      { header: 'On-Call Service (USD)', value: (r) => r.oncall },
      { header: 'Spare Parts (USD)', value: (r) => r.parts },
      { header: 'Total (USD)', value: (r) => r.total },
    ],
  };
}

/**
 * 리포트 종류 → 빌더 디스패치. CSV 직렬화는 호출부에서 toCsv로 수행한다.
 * 행 타입은 종류마다 다르지만 rows와 columns가 서로 짝이라는 점만 보장하면 되므로
 * 존재 타입처럼 쓰기 위해 AnyAssetReport로 좁힌다.
 */
export type AnyAssetReport =
  | AssetReport<OpenRiskRow>
  | AssetReport<ServiceHistoryRow>
  | AssetReport<MaterialHistoryRow>
  | AssetReport<ServiceSpendRow>;

export function buildAssetReport(key: AssetReportKey, input: AssetReportInput): AnyAssetReport {
  switch (key) {
    case 'openRisks':
      return buildOpenRisksReport(input);
    case 'serviceHistory':
      return buildServiceHistoryReport(input);
    case 'materialHistory':
      return buildMaterialHistoryReport(input);
    case 'serviceSpend':
      return buildServiceSpendReport(input);
  }
}

/** 종류에 관계없이 리포트를 CSV 문자열로 직렬화한다 (rows/columns 짝 보장). */
export function assetReportToCsv(report: AnyAssetReport): string {
  const { rows, columns } = report as AssetReport<unknown>;
  return toCsv(rows, columns);
}
