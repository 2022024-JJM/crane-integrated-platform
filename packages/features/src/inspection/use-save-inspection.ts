import { useCallback } from 'react';
import {
  attachInspectionFieldReport,
  submitInspectionResult,
  updateChecklistItems,
} from '@crane/domain/inspection';
import { logActivity, type FieldReport } from '@crane/domain/shared';
import type {
  ChecklistItemPatch,
  SubmitInspectionOutcome,
} from '@crane/domain/inspection';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export function useSaveInspectionChecklist() {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (inspectionId: string, patches: ChecklistItemPatch[]): boolean => {
      const ok = updateChecklistItems(inspectionId, patches);
      if (ok) publish('inspection', inspectionId);
      return ok;
    },
    [publish],
  );
}

/**
 * 현장이 배정된 점검을 수행해 제출 — 판정을 적고 현장 보고 표식을 붙인 뒤 완료한다.
 * 불량이 없으면 접수함에 올리지 않는다(표식을 처리됨으로).
 */
export function useSubmitAssignedInspection() {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (
      inspectionId: string,
      patches: ChecklistItemPatch[],
      reportedBy: string,
    ): SubmitInspectionOutcome => {
      updateChecklistItems(inspectionId, patches);
      const anyFail = patches.some((p) => p.judgment === 'fail');
      const reportedAt = new Date().toISOString();
      const report: FieldReport = anyFail
        ? { reportedBy, reportedAt }
        : { reportedBy, reportedAt, triagedAt: reportedAt, triagedBy: 'auto' };
      attachInspectionFieldReport(inspectionId, report);
      const outcome = submitInspectionResult(inspectionId);
      if (outcome.ok) {
        logActivity({
          kind: 'inspection',
          refId: inspectionId,
          type: 'completed',
          by: reportedBy,
          detail: anyFail ? 'fail' : 'pass',
        });
        publish('inspection', inspectionId);
        if (outcome.nextWo) publish('inspection', outcome.nextWo.id);
      }
      return outcome;
    },
    [publish],
  );
}

export function useSubmitInspection() {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (
      inspectionId: string,
      patches: ChecklistItemPatch[],
    ): SubmitInspectionOutcome => {
      // Persist any pending edits before finalizing
      updateChecklistItems(inspectionId, patches);
      const outcome = submitInspectionResult(inspectionId);
      if (outcome.ok) {
        logActivity({
          kind: 'inspection',
          refId: inspectionId,
          type: 'completed',
          by: 'office',
        });
        publish('inspection', inspectionId);
        // 반복 점검의 다음 회차가 생성됐으면 목록/캘린더도 갱신
        if (outcome.nextWo) publish('inspection', outcome.nextWo.id);
      }
      return outcome;
    },
    [publish],
  );
}
