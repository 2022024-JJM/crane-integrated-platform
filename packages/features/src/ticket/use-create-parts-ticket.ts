import { useCallback } from 'react';
import { addPartsRequest } from '@crane/domain/inventory';
import type { PartsRequest, PartsRequestItem } from '@crane/domain/inventory';
import { useTicketCreateStore } from './use-ticket-create-store';

export interface PartsTicketDraft {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  priority: PartsRequest['priority'];
  requester: string;
  items: PartsRequestItem[];
  note?: string;
}

export function useCreatePartsTicket() {
  const { setLastCreated, bumpTick } = useTicketCreateStore();

  return useCallback(
    (draft: PartsTicketDraft): PartsRequest => {
      const now = Date.now();
      const seq = String(now).slice(-4);
      const year = new Date().getFullYear();
      const id = `parts-req-${now}`;
      const requestNumber = `PRQ-${year}-${seq}`;

      const req: PartsRequest = {
        ...draft,
        id,
        requestNumber,
        requestDate: new Date().toISOString().slice(0, 10),
        status: 'pending',
      };

      addPartsRequest(req);
      setLastCreated(id, 'parts');
      bumpTick();
      return req;
    },
    [setLastCreated, bumpTick],
  );
}
