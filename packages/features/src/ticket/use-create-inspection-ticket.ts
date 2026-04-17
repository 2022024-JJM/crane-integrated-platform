import { useCallback } from 'react';
import { addInspectionWO, getDefaultChecklist } from '@crane/domain/inspection';
import type { InspectionWO } from '@crane/domain/inspection';
import { useTicketCreateStore } from './use-ticket-create-store';

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
}

export function useCreateInspectionTicket() {
  const { setLastCreated, bumpTick } = useTicketCreateStore();

  return useCallback(
    (draft: InspectionTicketDraft): InspectionWO => {
      const now = Date.now();
      const seq = String(now).slice(-4);
      const year = new Date().getFullYear();
      const id = `insp-new-${now}`;
      const woNumber = `INS-${year}-${seq}`;

      const wo: InspectionWO = {
        ...draft,
        id,
        woNumber,
        status: 'scheduled',
        actualDate: null,
        result: null,
        checklistItems: getDefaultChecklist(draft.woType),
      };

      addInspectionWO(wo);
      setLastCreated(id, 'inspection');
      bumpTick();
      return wo;
    },
    [setLastCreated, bumpTick],
  );
}
