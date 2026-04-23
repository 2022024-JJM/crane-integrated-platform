import { useCallback } from 'react';
import {
  submitInspectionResult,
  updateChecklistItems,
} from '@crane/domain/inspection';
import type { ChecklistItemPatch } from '@crane/domain/inspection';
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
    (inspectionId: string, patches: ChecklistItemPatch[]): boolean => {
      // Persist any pending edits before finalizing
      updateChecklistItems(inspectionId, patches);
      const ok = submitInspectionResult(inspectionId);
      if (ok) publish('inspection', inspectionId);
      return ok;
    },
    [publish],
  );
}
