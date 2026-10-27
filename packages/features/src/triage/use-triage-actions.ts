import { useCallback } from 'react';
import {
  acknowledgeInspectionReport,
  triageInspectionWO,
  type InspectionTriageInput,
} from '@crane/domain/inspection';
import {
  fulfillPartsRequest,
  triagePartsRequest,
  type FulfillOutcome,
} from '@crane/domain/inventory';
import {
  triageRepairWO,
  type RepairTriageInput,
} from '@crane/domain/maintenance';
import { logActivity } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

/** 접수 처리 — 도메인 갱신 + tick. `triagedBy` 는 처리한 관리자 이름(로그인 id). */
export function useTriageActions(triagedBy: string) {
  const publish = useDomainEventStore((s) => s.publish);
  const triageRepair = useCallback(
    (id: string, input: RepairTriageInput) => {
      const ok = triageRepairWO(id, input, triagedBy);
      if (ok) {
        logActivity({
          kind: 'repair',
          refId: id,
          type: 'triaged',
          by: triagedBy,
          detail: input.assignedTo,
        });
        publish('repair', id);
      }
      return ok;
    },
    [publish, triagedBy],
  );
  const triageInspection = useCallback(
    (id: string, input: InspectionTriageInput) => {
      const ok = triageInspectionWO(id, input, triagedBy);
      if (ok) {
        logActivity({
          kind: 'inspection',
          refId: id,
          type: 'triaged',
          by: triagedBy,
          detail: input.assignedTo,
        });
        publish('inspection', id);
      }
      return ok;
    },
    [publish, triagedBy],
  );
  const triageParts = useCallback(
    (
      id: string,
      status: 'approved' | 'cancelled',
    ): { ok: boolean; fulfillment?: FulfillOutcome | null } => {
      const ok = triagePartsRequest(id, status, triagedBy);
      if (!ok) return { ok };
      // 승인은 끝이 아니라 시작 — 재고에서 바로 출고하고, 없는 것은 발주 초안으로
      const fulfillment =
        status === 'approved' ? fulfillPartsRequest(id, triagedBy) : null;
      logActivity({
        kind: 'parts',
        refId: id,
        type: status === 'approved' ? 'approved' : 'rejected',
        by: triagedBy,
      });
      if (fulfillment)
        logActivity({
          kind: 'parts',
          refId: id,
          type: 'fulfilled',
          by: triagedBy,
          detail: fulfillment.poNumber
            ? `${fulfillment.issued.length}/${fulfillment.poNumber}`
            : String(fulfillment.issued.length),
        });
      publish('parts', id);
      if (fulfillment && fulfillment.issued.length > 0) publish('parts');
      return { ok, fulfillment };
    },
    [publish, triagedBy],
  );
  const acknowledgeInspection = useCallback(
    (id: string) => {
      const ok = acknowledgeInspectionReport(id, triagedBy);
      if (ok) {
        logActivity({
          kind: 'inspection',
          refId: id,
          type: 'acknowledged',
          by: triagedBy,
        });
        publish('inspection', id);
      }
      return ok;
    },
    [publish, triagedBy],
  );
  return { triageRepair, triageInspection, triageParts, acknowledgeInspection };
}
