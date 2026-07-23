import { useCallback } from 'react';
import { addRepairWO } from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { newRepairId, nextRepairWoNumber } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export interface RepairTicketDraft {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  componentName: string;
  failureType: RepairWO['failureType'];
  sourceType: RepairWO['sourceType'];
  /** 점검에서 생성된 경우 원천 점검 WO 번호 */
  sourceWoNumber?: string;
  priority: RepairWO['priority'];
  repairLevel: RepairWO['repairLevel'];
  failureDescription: string;
  performerType: RepairWO['performerType'];
  assignedTo: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export function useCreateRepairTicket() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (draft: RepairTicketDraft): RepairWO => {
      const wo: RepairWO = {
        ...draft,
        id: newRepairId(),
        woNumber: nextRepairWoNumber(),
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
      publish('repair', wo.id);
      return wo;
    },
    [publish],
  );
}
