import { useCallback } from 'react';
import {
  submitInspectionResult,
  updateChecklistItems,
} from '@crane/domain/inspection';
import type { ChecklistItemPatch, SubmitInspectionOutcome } from '@crane/domain/inspection';
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

export function useSubmitInspection() {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (inspectionId: string, patches: ChecklistItemPatch[]): SubmitInspectionOutcome => {
      // Persist any pending edits before finalizing
      updateChecklistItems(inspectionId, patches);
      const outcome = submitInspectionResult(inspectionId);
      if (outcome.ok) {
        publish('inspection', inspectionId);
        // 반복 점검의 다음 회차가 생성됐으면 목록/캘린더도 갱신
        if (outcome.nextWo) publish('inspection', outcome.nextWo.id);
      }
      return outcome;
    },
    [publish],
  );
}
