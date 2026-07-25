import { useCallback } from 'react';
import { addInspectionWO, getDefaultChecklist } from '@crane/domain/inspection';
import type { InspectionWO } from '@crane/domain/inspection';
import { newInspectionId, nextInspectionWoNumber } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export interface InspectionTicketDraft {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  woType: InspectionWO['woType'];
  priority: InspectionWO['priority'];
  scheduledDate: string;
  performerType: InspectionWO['performerType'];
  assignedTo: string;
  findings?: string;
  /** 반복 주기 — 완료 시 다음 회차 WO 자동 생성 */
  recurrence?: InspectionWO['recurrence'];
}

export function useCreateInspectionTicket() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (draft: InspectionTicketDraft): InspectionWO => {
      const wo: InspectionWO = {
        ...draft,
        id: newInspectionId(),
        woNumber: nextInspectionWoNumber(),
        status: 'scheduled',
        actualDate: null,
        result: null,
        checklistItems: getDefaultChecklist(draft.woType),
      };

      addInspectionWO(wo);
      publish('inspection', wo.id);
      return wo;
    },
    [publish],
  );
}
