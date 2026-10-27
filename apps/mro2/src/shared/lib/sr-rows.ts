import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { PartsRequest } from '@crane/domain/inventory';
import type { ServiceTone } from '../ui/kc';
import { isUntriagedFieldReport } from '@crane/domain/shared';
import { inspectionTone, repairTone, yearOf } from './service-status';

/**
 * 서비스 요청 목록의 한 줄. 제목은 상태가 아니라 내용(증상·소견)이다 — 상태는
 * 칩 하나로 충분하고, 관리자가 훑는 것은 "무슨 일인지" 다.
 */
export interface SrRow {
  key: string;
  kind: 'inspection' | 'repair' | 'parts';
  path: string;
  /** 비용(USD) — 수리 총액·점검 비용·부품 요청 합계. 모르면 null */
  cost: number | null;
  /** 정렬·표시 기준일 (실시일 > 예정일) */
  date: string;
  /** 지연 판단의 기준일 — 지연 상한 정렬에 쓴다 */
  due: string;
  tone: ServiceTone;
  /** 지연 중에서도 빨강으로 칠하는 상위 N 건인가 (applyAlertCap) */
  alert: boolean;
  woNumber: string;
  title: string;
  product: string;
  /** 서비스 상품 필터 키 — 점검=woType, 수리=planned|oncall */
  productKey: string;
  craneId: string;
  craneName: string;
  siteName: string;
  /** 담당자(수리·점검) 또는 요청자(부품). 비어 있으면 미배정 */
  assignee: string;
  /** 현장 보고자 — 현장 모드에서 올라온 건만 */
  reporter?: string;
  fromField: boolean;
  /** 현장 보고가 아직 접수함에서 처리되지 않음 → 배정이 없다 */
  untriaged: boolean;
  /** 0 보통 · 1 높음 · 2 긴급 */
  urgency: 0 | 1 | 2;
  /** 지연이면 기준일에서 지난 일수, 아니면 0 */
  overdueDays: number;
}

/** 관리자 탭 — 미완료(지연·접수·진행 중·예정) › 각 상태 › 완료 › 전체 */
export type SrBucket =
  | 'delayed'
  | 'received'
  | 'inProgress'
  | 'open'
  | 'completed';
export const SR_BUCKETS: readonly SrBucket[] = [
  'delayed',
  'received',
  'inProgress',
  'open',
  'completed',
];

export function srBucket(r: SrRow): SrBucket {
  if (r.tone === 'completed') return 'completed';
  if (r.tone === 'delayed') return 'delayed';
  if (r.untriaged) return 'received';
  return r.tone === 'inProgress' ? 'inProgress' : 'open';
}

export function countBuckets(rows: readonly SrRow[]): Record<SrBucket, number> {
  const out: Record<SrBucket, number> = {
    delayed: 0,
    received: 0,
    inProgress: 0,
    open: 0,
    completed: 0,
  };
  for (const r of rows) out[srBucket(r)] += 1;
  return out;
}

const BUCKET_RANK: Record<SrBucket, number> = {
  delayed: 0,
  received: 1,
  inProgress: 2,
  open: 3,
  completed: 4,
};

/**
 * 관리 순서 — 지연(오래 지난 순, 빨강 상한과 같은 순서) › 접수(오래 기다린 순) ›
 * 진행 중 › 예정(가까운 순) › 완료(최근 순). 지연 이외 묶음에서는 긴급이 먼저.
 */
export function sortForAdmin(rows: readonly SrRow[]): SrRow[] {
  return [...rows].sort((a, b) => {
    const ba = srBucket(a),
      bb = srBucket(b);
    if (ba !== bb) return BUCKET_RANK[ba] - BUCKET_RANK[bb];
    if (ba === 'delayed' && a.overdueDays !== b.overdueDays)
      return b.overdueDays - a.overdueDays;
    if (a.urgency !== b.urgency) return b.urgency - a.urgency;
    switch (ba) {
      case 'delayed':
        return 0;
      case 'received':
        return cmpDesc(b.date, a.date);
      case 'open':
        return cmpDesc(b.due, a.due);
      default:
        return cmpDesc(a.date, b.date);
    }
  });
}

export interface SrLabels {
  inspectionProduct: (woType: InspectionWO['woType']) => string;
  onCallRepair: string;
  plannedRepair: string;
  partsRequest: string;
  /** "FUSE ×2 외 1" 식 요약 */
  partsTitle: (first: string, qty: number, more: number) => string;
}

/** 지연 빨강 상한 — 24시간 화면 원칙: 경보는 가장 급한 몇 건만 색으로 */
export const SR_ALERT_CAP = 5;

const PARTS_TONE: Record<PartsRequest['status'], ServiceTone | null> = {
  pending: 'open',
  approved: 'inProgress',
  ordered: 'completed',
  cancelled: null,
};

const URGENCY: Record<string, 0 | 1 | 2> = { emergency: 2, urgent: 2, high: 1 };
const DAY_MS = 86_400_000;
function overdue(due: string, tone: ServiceTone, now: number): number {
  if (tone !== 'delayed') return 0;
  const t = new Date(due).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / DAY_MS));
}

export function buildSrRows(
  inspections: readonly InspectionWO[],
  repairs: readonly RepairWO[],
  parts: readonly PartsRequest[],
  /** null 이면 전 연도 */
  year: number | null,
  labels: SrLabels,
  now: number = Date.now(),
): SrRow[] {
  const rows: SrRow[] = [];
  for (const r of parts) {
    if (year !== null && yearOf(r.requestDate) !== year) continue;
    const tone = PARTS_TONE[r.status];
    if (!tone) continue;
    const first = r.items[0];
    rows.push({
      key: `p-${r.id}`,
      kind: 'parts',
      path: '',
      date: r.requestDate,
      due: r.requestDate,
      tone,
      alert: false,
      woNumber: r.requestNumber,
      title: first
        ? labels.partsTitle(first.partName, first.qty, r.items.length - 1)
        : labels.partsRequest,
      product: labels.partsRequest,
      productKey: 'parts',
      craneId: r.craneId,
      craneName: r.craneName,
      siteName: r.siteName,
      assignee: r.requester,
      reporter: r.fieldReport?.reportedBy,
      fromField: Boolean(r.fieldReport),
      untriaged: isUntriagedFieldReport(r.fieldReport),
      urgency: URGENCY[r.priority] ?? 0,
      overdueDays: 0,
      cost: r.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0),
    });
  }
  for (const w of inspections) {
    if (year !== null && yearOf(w.scheduledDate) !== year) continue;
    const product = labels.inspectionProduct(w.woType);
    rows.push({
      key: `i-${w.id}`,
      kind: 'inspection',
      path: `/mro2/service-requests/inspection/${w.id}`,
      date: w.actualDate ?? w.scheduledDate,
      due: w.scheduledDate,
      tone: inspectionTone(w.status, w.scheduledDate, now),
      alert: false,
      woNumber: w.woNumber,
      title: w.findings?.trim() || product,
      product,
      productKey: w.woType as string,
      craneId: w.craneId,
      craneName: w.craneName,
      siteName: w.siteName,
      assignee: isUntriagedFieldReport(w.fieldReport)
        ? ''
        : (w.assignedTo ?? ''),
      reporter: w.fieldReport?.reportedBy,
      fromField: Boolean(w.fieldReport),
      untriaged: isUntriagedFieldReport(w.fieldReport),
      urgency: URGENCY[w.priority] ?? 0,
      overdueDays: overdue(
        w.scheduledDate,
        inspectionTone(w.status, w.scheduledDate, now),
        now,
      ),
      cost: w.cost ?? null,
    });
  }
  for (const w of repairs) {
    if (year !== null && yearOf(w.scheduledStart) !== year) continue;
    const onCall = w.sourceType === 'breakdown';
    const product = onCall ? labels.onCallRepair : labels.plannedRepair;
    rows.push({
      key: `r-${w.id}`,
      kind: 'repair',
      path: `/mro2/service-requests/repair/${w.id}`,
      date: w.actualEnd ?? w.scheduledStart,
      due: w.scheduledEnd,
      tone: repairTone(w.status, w.scheduledEnd, now),
      alert: false,
      woNumber: w.woNumber,
      title: w.failureDescription?.trim() || product,
      product,
      productKey: onCall ? 'oncall' : 'planned',
      craneId: w.craneId,
      craneName: w.craneName,
      siteName: w.siteName,
      assignee: isUntriagedFieldReport(w.fieldReport)
        ? ''
        : (w.assignedTo ?? ''),
      reporter: w.fieldReport?.reportedBy,
      fromField: Boolean(w.fieldReport),
      untriaged: isUntriagedFieldReport(w.fieldReport),
      urgency: URGENCY[w.priority] ?? 0,
      overdueDays: overdue(
        w.scheduledEnd,
        repairTone(w.status, w.scheduledEnd, now),
        now,
      ),
      cost:
        w.totalCost ??
        (w.laborCost != null || w.partsCost != null
          ? (w.laborCost ?? 0) + (w.partsCost ?? 0)
          : null),
    });
  }
  return rows.sort((a, b) => cmpDesc(a.date, b.date));
}

/**
 * 지연 건 중 기준일이 가장 오래된 `cap` 건만 `alert` 로 표시한다. 나머지 지연은
 * 라벨은 "지연" 그대로지만 회색 — 화면 전체가 빨갛게 되면 어느 것도 급해
 * 보이지 않는다. 입력 순서는 유지한다.
 */
export function applyAlertCap(
  rows: readonly SrRow[],
  cap: number = SR_ALERT_CAP,
): SrRow[] {
  const delayed = rows
    .filter((r) => r.tone === 'delayed')
    .sort((a, b) => cmpDesc(b.due, a.due)); // 오래된 순
  const alertKeys = new Set(
    delayed.slice(0, Math.max(0, cap)).map((r) => r.key),
  );
  return rows.map((r) =>
    r.alert === alertKeys.has(r.key)
      ? r
      : { ...r, alert: alertKeys.has(r.key) },
  );
}

/** 빨강에서 제외된 지연 건 수 (상한 안내용) */
export function countMutedDelayed(rows: readonly SrRow[]): number {
  return rows.filter((r) => r.tone === 'delayed' && !r.alert).length;
}

function cmpDesc(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
}
