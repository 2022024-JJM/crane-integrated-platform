import { useCallback } from 'react';
import { addPartsRequest } from '@crane/domain/inventory';
import type { PartsRequest, PartsRequestItem } from '@crane/domain/inventory';
import { newPartsRequestId, nextPartsRequestNumber } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export interface PartsTicketDraft {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  priority: PartsRequest['priority'];
  requester: string;
  items: PartsRequestItem[];
  /** 부품 대기 수리 WO에서 발행된 경우 원천 수리 WO 번호 */
  sourceWoNumber?: string;
  note?: string;
}

export function useCreatePartsTicket() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (draft: PartsTicketDraft): PartsRequest => {
      const req: PartsRequest = {
        ...draft,
        id: newPartsRequestId(),
        requestNumber: nextPartsRequestNumber(),
        requestDate: new Date().toISOString().slice(0, 10),
        status: 'pending',
      };

      addPartsRequest(req);
      publish('parts', req.id);
      return req;
    },
    [publish],
  );
}
