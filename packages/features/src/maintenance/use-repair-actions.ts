import { useCallback } from 'react';
import {
  getRepairWOById,
  restoreRepairStatus,
  updateRepairDetails,
  updateRepairStatus,
} from '@crane/domain/maintenance';
import type { RepairDetailsUpdate, RepairStatus } from '@crane/domain/maintenance';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export type RepairActionOutcome =
  | { success: true; undo?: () => void }
  | { success: false; reason: 'not_found' | 'wo_closed' | 're_inspection_required' };

/** 임의 단계로 점프 — completed 진입 시 reInspectionResult 필수(경량 가드).
 *  성공 시 undo 클로저 반환 — 상태와 자동 스탬프된 실적 타임스탬프를 원복한다. */
export function useSetRepairStatus() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (id: string, status: RepairStatus): RepairActionOutcome => {
      const wo = getRepairWOById(id);
      if (!wo) return { success: false, reason: 'not_found' };
      if (status === 'completed' && wo.reInspectionResult == null)
        return { success: false, reason: 're_inspection_required' };
      const snapshot = {
        status: wo.status,
        actualStart: wo.actualStart,
        actualEnd: wo.actualEnd,
      };
      updateRepairStatus(id, status);
      publish('repair', id);
      return {
        success: true,
        undo: () => {
          restoreRepairStatus(id, snapshot);
          publish('repair', id);
        },
      };
    },
    [publish],
  );
}

/** 수리 결과(RCA·공수·재검사) 기록 — 완료된 WO는 잠금 */
export function useUpdateRepairDetails() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (id: string, update: RepairDetailsUpdate): RepairActionOutcome => {
      const wo = getRepairWOById(id);
      if (!wo) return { success: false, reason: 'not_found' };
      if (wo.status === 'completed') return { success: false, reason: 'wo_closed' };
      updateRepairDetails(id, update);
      publish('repair', id);
      return { success: true };
    },
    [publish],
  );
}
