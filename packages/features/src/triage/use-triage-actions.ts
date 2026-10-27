import { useCallback } from 'react';
import {
  acknowledgeInspectionReport,
  triageInspectionWO,
  type InspectionTriageInput,
} from '@crane/domain/inspection';
import { triagePartsRequest } from '@crane/domain/inventory';
import {
  triageRepairWO,
  type RepairTriageInput,
} from '@crane/domain/maintenance';
import { useDomainEventStore } from '../shared/use-domain-event-store';

/** 접수 처리 — 도메인 갱신 + tick. `triagedBy` 는 처리한 관리자 이름(로그인 id). */
export function useTriageActions(triagedBy: string) {
  const publish = useDomainEventStore((s) => s.publish);
  const triageRepair = useCallback(
    (id: string, input: RepairTriageInput) => {
      const ok = triageRepairWO(id, input, triagedBy);
      if (ok) publish('repair', id);
      return ok;
    },
    [publish, triagedBy],
  );
  const triageInspection = useCallback(
    (id: string, input: InspectionTriageInput) => {
      const ok = triageInspectionWO(id, input, triagedBy);
      if (ok) publish('inspection', id);
      return ok;
    },
    [publish, triagedBy],
  );
  const triageParts = useCallback(
    (id: string, status: 'approved' | 'cancelled') => {
      const ok = triagePartsRequest(id, status, triagedBy);
      if (ok) publish('parts', id);
      return ok;
    },
    [publish, triagedBy],
  );
  const acknowledgeInspection = useCallback(
    (id: string) => {
      const ok = acknowledgeInspectionReport(id, triagedBy);
      if (ok) publish('inspection', id);
      return ok;
    },
    [publish, triagedBy],
  );
  return { triageRepair, triageInspection, triageParts, acknowledgeInspection };
}
