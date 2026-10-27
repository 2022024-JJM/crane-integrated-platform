import { useCallback } from 'react';
import {
  createReorderDraft,
  removePurchaseOrder,
  type PurchaseOrder,
} from '@crane/domain/inventory';
import { useDomainEventStore } from '../shared/use-domain-event-store';

/** 재주문 필요 부품 전부를 발주 초안 하나로 — 성공 시 PO 와 되돌리기 */
export function useCreateReorderDraft(): (
  by: string,
) => { po: PurchaseOrder; undo: () => void } | null {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (by: string) => {
      const po = createReorderDraft(by);
      if (!po) return null;
      publish('parts', po.id);
      return {
        po,
        undo: () => {
          removePurchaseOrder(po.id);
          publish('parts');
        },
      };
    },
    [publish],
  );
}
