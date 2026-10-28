import type { ChecklistItem, InspectionWO } from '@crane/domain/inspection';
import type { RepairTicketDraft } from '@crane/features/ticket';
import type { AssignmentSuggestion } from './suggest-assignment';

/**
 * 점검 불량 → 수리 요청 초안. 불량 항목·소견·장비를 그대로 옮기고, 배정
 * 추천으로 담당·일정을 채워 접수까지 끝낸 상태(triagedAt)로 만든다 — 관리자는
 * [수리로 전환] 한 번이면 된다. 보고자는 점검을 수행한 현장 작업자.
 */
export function failedChecklistItems(wo: InspectionWO): ChecklistItem[] {
  return wo.checklistItems.filter((i) => i.judgment === 'fail');
}

export function buildRepairFromInspection(
  wo: InspectionWO,
  suggestion: AssignmentSuggestion,
  options: {
    /** ISO 시각 — 보고·접수 시각. */
    now: string;
    /** 접수 처리자(관리자). */
    triagedBy: string;
    /** 한글 화면이면 `_ko` 라벨 우선. */
    ko: boolean;
  },
): RepairTicketDraft {
  const failed = failedChecklistItems(wo);
  const label = (i: ChecklistItem) =>
    (options.ko && i.itemName_ko) || i.itemName;
  const category = (i: ChecklistItem) =>
    (options.ko && i.category_ko) || i.category;
  const first = failed[0];
  const parts = [
    failed.map(label).join(', '),
    (options.ko && wo.findings_ko) || wo.findings || '',
  ].filter((s) => s.trim().length > 0);
  return {
    craneId: wo.craneId,
    craneName: wo.craneName,
    siteId: wo.siteId,
    siteName: wo.siteName,
    componentName: first ? category(first) : 'General',
    failureType: 'other',
    sourceType: 'inspection',
    sourceWoNumber: wo.woNumber,
    priority: 'high',
    repairLevel: 'minor',
    failureDescription: parts.join(' · ') || wo.woNumber,
    performerType: suggestion.performerType,
    assignedTo: suggestion.assignedTo,
    scheduledStart: suggestion.scheduledDate,
    scheduledEnd: suggestion.scheduledDate,
    fieldReport: {
      reportedBy: wo.fieldReport?.reportedBy ?? wo.assignedTo,
      reportedAt: options.now,
      triagedAt: options.now,
      triagedBy: options.triagedBy,
    },
  };
}
