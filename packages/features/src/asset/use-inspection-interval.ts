import { useCallback } from 'react';
import {
  getCraneAssetById,
  setAssetInspectionInterval,
  type InspectionInterval,
} from '@crane/domain/asset';
import {
  addInspectionWO,
  getAllInspectionWOs,
  getDefaultChecklist,
  updateInspectionRecurrence,
  type InspectionWO,
} from '@crane/domain/inspection';
import { newInspectionId, nextInspectionWoNumber } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

const DAYS: Record<InspectionInterval, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
};

/**
 * 자산의 정기 점검 주기 — 정하면 다음 회차 정기 점검이 바로 잡히고, 그 뒤로는
 * 완료할 때마다 다음 회차가 따라 생긴다(submitInspectionResult 의 recurrence).
 * 비우면 이미 잡힌 회차는 두되 더 이어지지 않는다.
 */
export function useSetInspectionInterval(): (
  craneId: string,
  interval: InspectionInterval | null,
) => InspectionWO | null {
  const publish = useDomainEventStore((s) => s.publish);
  return useCallback(
    (craneId, interval) => {
      const asset = getCraneAssetById(craneId);
      if (!asset || !setAssetInspectionInterval(craneId, interval)) return null;
      publish('asset', craneId);
      const open = getAllInspectionWOs().find(
        (w) =>
          w.craneId === craneId &&
          w.woType === 'periodic' &&
          w.status !== 'completed' &&
          w.status !== 'cancelled',
      );
      if (open) {
        updateInspectionRecurrence(open.id, interval);
        publish('inspection', open.id);
        return null;
      }
      if (!interval) return null;
      const scheduledDate = new Date(Date.now() + DAYS[interval] * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const wo: InspectionWO = {
        id: newInspectionId(),
        woNumber: nextInspectionWoNumber(),
        craneId,
        craneName: asset.name,
        siteId: asset.siteId,
        siteName: asset.siteName,
        woType: 'periodic',
        priority: 'normal',
        scheduledDate,
        performerType: 'internal',
        assignedTo: '',
        status: 'scheduled',
        actualDate: null,
        result: null,
        recurrence: interval,
        checklistItems: getDefaultChecklist('periodic'),
      };
      addInspectionWO(wo);
      publish('inspection', wo.id);
      return wo;
    },
    [publish],
  );
}
