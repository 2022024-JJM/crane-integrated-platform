import { useCallback } from 'react';
import {
  getInventoryItemByPartId,
  issuePart,
  receivePart,
} from '@crane/domain/inventory';
import { addPartUsedToRepair, getRepairWOById } from '@crane/domain/maintenance';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export type StockActionOutcome =
  | { success: true }
  | {
      success: false;
      reason: 'not_found' | 'insufficient_stock' | 'invalid_qty' | 'wo_closed';
    };

export interface IssuePartInput {
  partId: string;
  qty: number;
  by: string;
  /** 연결할 수리 WO id — 지정 시 partsUsed에 추가되고 트랜잭션이 WO 번호를 참조한다 */
  repairWoId?: string;
  note?: string;
}

export interface ReceivePartInput {
  partId: string;
  qty: number;
  by: string;
  poRef?: string;
  note?: string;
}

/** 출고 — 재고 차감 + 트랜잭션 기록 + (선택) 수리 WO partsUsed 연동 */
export function useIssuePart() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (input: IssuePartInput): StockActionOutcome => {
      const item = getInventoryItemByPartId(input.partId);
      if (!item) return { success: false, reason: 'not_found' };

      const repair = input.repairWoId
        ? getRepairWOById(input.repairWoId)
        : undefined;
      if (input.repairWoId && !repair)
        return { success: false, reason: 'not_found' };
      if (repair && repair.status === 'completed')
        return { success: false, reason: 'wo_closed' };

      const result = issuePart({
        partId: input.partId,
        qty: input.qty,
        by: input.by,
        ref: repair?.woNumber,
        refType: repair ? 'repair_wo' : 'manual',
        note: input.note,
      });
      if (!result.success) return result;

      if (repair) {
        addPartUsedToRepair(repair.id, {
          partId: item.partId,
          partName: item.partName,
          qty: input.qty,
          unitCost: item.unitPrice,
        });
        publish('repair', repair.id);
      }
      publish('parts', input.partId);
      return { success: true };
    },
    [publish],
  );
}

/** 입고 — 재고 증가 + 트랜잭션 기록 */
export function useReceivePart() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (input: ReceivePartInput): StockActionOutcome => {
      const result = receivePart({
        partId: input.partId,
        qty: input.qty,
        by: input.by,
        ref: input.poRef,
        refType: input.poRef ? 'po' : 'manual',
        note: input.note,
      });
      if (!result.success) return result;
      publish('parts', input.partId);
      return { success: true };
    },
    [publish],
  );
}
