import type { InspectionWO } from '@crane/domain/inspection';
import type { PartsRequest } from '@crane/domain/inventory';
import type { RepairWO } from '@crane/domain/maintenance';
import type { TriageQueue } from '@crane/features/triage';

/**
 * 접수함 한 줄 — 세 종류(수리·점검·부품)를 같은 모양으로. 표시 순서는
 * 긴급한 것 먼저, 같으면 오래된 것 먼저(현장에서 기다린 시간).
 */
export type TriageKind = 'repair' | 'inspection' | 'parts';

export interface TriageRow {
  kind: TriageKind;
  id: string;
  number: string;
  craneId: string;
  craneName: string;
  /** 증상·소견·부품 목록. */
  title: string;
  /** 보조 정보 — 부위, 점검 종류 등. */
  subtitle: string;
  reportedBy: string;
  reportedAt: string;
  /** 종류 무관 긴급도 축: 2 = 긴급, 1 = 높음, 0 = 보통. */
  urgency: 0 | 1 | 2;
  /** 점검 결과에 이상이 있어 수리로 이어야 하는지. */
  needsRepair: boolean;
  /** 이미 완료된 점검(현장 체크리스트) — 배정이 아니라 확인만. */
  completed: boolean;
}

const REPAIR_URGENCY: Record<RepairWO['priority'], 0 | 1 | 2> = {
  emergency: 2,
  high: 1,
  normal: 0,
  low: 0,
};
const INSPECTION_URGENCY: Record<InspectionWO['priority'], 0 | 1 | 2> = {
  urgent: 2,
  high: 1,
  normal: 0,
  low: 0,
};
const PARTS_URGENCY: Record<PartsRequest['priority'], 0 | 1 | 2> = {
  urgent: 2,
  normal: 0,
  scheduled: 0,
};

export function buildTriageRows(queue: TriageQueue): TriageRow[] {
  const rows: TriageRow[] = [];
  for (const w of queue.repairs) {
    rows.push({
      kind: 'repair',
      id: w.id,
      number: w.woNumber,
      craneId: w.craneId,
      craneName: w.craneName,
      title: w.failureDescription,
      subtitle: w.componentName,
      reportedBy: w.fieldReport?.reportedBy ?? '',
      reportedAt: w.fieldReport?.reportedAt ?? '',
      urgency: REPAIR_URGENCY[w.priority],
      needsRepair: false,
      completed: false,
    });
  }
  for (const w of queue.inspections) {
    rows.push({
      kind: 'inspection',
      id: w.id,
      number: w.woNumber,
      craneId: w.craneId,
      craneName: w.craneName,
      title: w.findings ?? '',
      subtitle: w.woType,
      reportedBy: w.fieldReport?.reportedBy ?? '',
      reportedAt: w.fieldReport?.reportedAt ?? '',
      urgency: INSPECTION_URGENCY[w.priority],
      // 현장 점검은 이상이 있을 때만 high 로 올린다(field-new-ticket).
      needsRepair:
        w.result === 'fail' || w.priority === 'high' || w.priority === 'urgent',
      completed: w.status === 'completed',
    });
  }
  for (const r of queue.parts) {
    rows.push({
      kind: 'parts',
      id: r.id,
      number: r.requestNumber,
      craneId: r.craneId,
      craneName: r.craneName,
      title: r.items.map((it) => `${it.partName} ×${it.qty}`).join(', '),
      subtitle: r.note ?? '',
      reportedBy: r.fieldReport?.reportedBy ?? '',
      reportedAt: r.fieldReport?.reportedAt ?? '',
      urgency: PARTS_URGENCY[r.priority],
      needsRepair: false,
      completed: false,
    });
  }
  rows.sort(
    (a, b) =>
      b.urgency - a.urgency ||
      (a.reportedAt < b.reportedAt ? -1 : a.reportedAt > b.reportedAt ? 1 : 0),
  );
  return rows;
}

/** 접수 후 기다린 시간(분). 비유한이면 0. */
export function waitedMinutes(reportedAt: string, now: number): number {
  const t = Date.parse(reportedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60_000));
}
