import { useMemo } from 'react';
import {
  getAllInspectionWOs,
  type InspectionWO,
} from '@crane/domain/inspection';
import {
  getAllPartsRequests,
  type PartsRequest,
} from '@crane/domain/inventory';
import { getAllRepairWOs, type RepairWO } from '@crane/domain/maintenance';
import { isUntriagedFieldReport } from '@crane/domain/shared';
import { useEntityTicks } from '../shared/use-domain-event-store';

/**
 * 접수함 — 현장 보고 표식이 있고 아직 처리되지 않은 티켓(오래된 것부터).
 * `completedRepairs` 는 현장이 완료 보고했고 사무실이 아직 확인하지 않은 수리.
 */
export interface TriageQueue {
  repairs: RepairWO[];
  inspections: InspectionWO[];
  parts: PartsRequest[];
  completedRepairs: RepairWO[];
  total: number;
}

function reportedAt(x: { fieldReport?: { reportedAt: string } }): string {
  return x.fieldReport?.reportedAt ?? '';
}

export function collectTriageQueue(
  repairs: readonly RepairWO[],
  inspections: readonly InspectionWO[],
  parts: readonly PartsRequest[],
): TriageQueue {
  const byOldest = <T extends { fieldReport?: { reportedAt: string } }>(
    a: T,
    b: T,
  ) =>
    reportedAt(a) < reportedAt(b) ? -1 : reportedAt(a) > reportedAt(b) ? 1 : 0;
  const r = repairs
    .filter((w) => isUntriagedFieldReport(w.fieldReport))
    .sort(byOldest);
  const i = inspections
    .filter((w) => isUntriagedFieldReport(w.fieldReport))
    .sort(byOldest);
  const p = parts
    .filter((w) => isUntriagedFieldReport(w.fieldReport))
    .sort(byOldest);
  const c = repairs
    .filter((w) => isUntriagedFieldReport(w.fieldCompletion))
    .sort((a, b) => {
      const x = a.fieldCompletion?.reportedAt ?? '';
      const y = b.fieldCompletion?.reportedAt ?? '';
      return x < y ? -1 : x > y ? 1 : 0;
    });
  return {
    repairs: r,
    inspections: i,
    parts: p,
    completedRepairs: c,
    total: r.length + i.length + p.length + c.length,
  };
}

export function useTriageQueue(): TriageQueue {
  const tick = useEntityTicks(['repair', 'inspection', 'parts']);
  return useMemo(
    () =>
      collectTriageQueue(
        getAllRepairWOs(),
        getAllInspectionWOs(),
        getAllPartsRequests(),
      ),
    // tick 은 세 배열이 바뀐 프레임을 잡는 구독값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
}
