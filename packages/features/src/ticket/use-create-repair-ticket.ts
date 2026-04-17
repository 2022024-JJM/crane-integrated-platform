import { useCallback } from 'react';
import { addRepairWO } from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { useTicketCreateStore } from './use-ticket-create-store';

export interface RepairTicketDraft {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  componentName: string;
  failureType: RepairWO['failureType'];
  sourceType: RepairWO['sourceType'];
  priority: RepairWO['priority'];
  repairLevel: RepairWO['repairLevel'];
  failureDescription: string;
  performerType: RepairWO['performerType'];
  assignedTo: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export function useCreateRepairTicket() {
  const { setLastCreated, bumpTick } = useTicketCreateStore();

  return useCallback(
    (draft: RepairTicketDraft): RepairWO => {
      const now = Date.now();
      const seq = String(now).slice(-4);
      const year = new Date().getFullYear();
      const id = `repair-new-${now}`;
      const woNumber = `RPR-${year}-${seq}`;

      const wo: RepairWO = {
        ...draft,
        id,
        woNumber,
        status: 'received',
        partsUsed: [],
        actualStart: null,
        actualEnd: null,
        downtimeHours: null,
        laborHours: null,
        laborCost: null,
        partsCost: null,
        totalCost: null,
      };

      addRepairWO(wo);
      setLastCreated(id, 'repair');
      bumpTick();
      return wo;
    },
    [setLastCreated, bumpTick],
  );
}
