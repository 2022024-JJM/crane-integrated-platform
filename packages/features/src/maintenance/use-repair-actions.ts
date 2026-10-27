import { useCallback } from 'react';
import {
  getRepairWOById,
  restoreRepairStatus,
  updateRepairDetails,
  updateRepairStatus,
} from '@crane/domain/maintenance';
import type {
  RepairDetailsUpdate,
  RepairStatus,
} from '@crane/domain/maintenance';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export type RepairActionOutcome =
  | { success: true; undo?: () => void }
  | {
      success: false;
      reason: 'not_found' | 'wo_closed' | 're_inspection_required';
    };

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

/**
 * 현장 작업 진행 — [작업 시작] → 진행 중, [작업 완료] + 조치 내용 → 완료.
 * 사무실 재검사 게이트는 거치지 않는다: 현장 완료 보고가 곧 완료다.
 */
export function useRepairWorkProgress() {
  const publish = useDomainEventStore((s) => s.publish);
  const start = useCallback(
    (id: string): boolean => {
      const wo = getRepairWOById(id);
      if (!wo || wo.status === 'completed' || wo.status === 'in_progress')
        return false;
      updateRepairStatus(id, 'in_progress');
      publish('repair', id);
      return true;
    },
    [publish],
  );
  const complete = useCallback(
    (id: string, correctiveAction: string): boolean => {
      const wo = getRepairWOById(id);
      if (!wo || wo.status === 'completed') return false;
      if (correctiveAction.trim())
        updateRepairDetails(id, { correctiveAction: correctiveAction.trim() });
      updateRepairStatus(id, 'completed');
      publish('repair', id);
      return true;
    },
    [publish],
  );
  return { start, complete };
}

/** 수리 결과(RCA·공수·재검사) 기록 — 완료된 WO는 잠금 */
export function useUpdateRepairDetails() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (id: string, update: RepairDetailsUpdate): RepairActionOutcome => {
      const wo = getRepairWOById(id);
      if (!wo) return { success: false, reason: 'not_found' };
      if (wo.status === 'completed')
        return { success: false, reason: 'wo_closed' };
      updateRepairDetails(id, update);
      publish('repair', id);
      return { success: true };
    },
    [publish],
  );
}
