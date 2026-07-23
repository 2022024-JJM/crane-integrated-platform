import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllRepairWOs,
  getMaintenanceSummary,
  getRepairWOById,
  updateRepairStatus,
} from '@crane/domain/maintenance';
import type { RepairStatus, RepairWO } from '@crane/domain/maintenance';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { useDomainEventStore, useEntityTick } from '../shared/use-domain-event-store';

function localizeRepair(repair: RepairWO, isKo: boolean): RepairWO {
  if (!isKo) return repair;
  return {
    ...repair,
    componentName: repair.componentName_ko ?? repair.componentName,
    failureDescription: repair.failureDescription_ko ?? repair.failureDescription,
    rootCause: repair.rootCause_ko ?? repair.rootCause,
    correctiveAction: repair.correctiveAction_ko ?? repair.correctiveAction,
    preventiveAction: repair.preventiveAction_ko ?? repair.preventiveAction,
  };
}

const PIPELINE_NEXT: Record<RepairStatus, RepairStatus | null> = {
  received: 'waiting_parts',
  waiting_parts: 'in_progress',
  in_progress: 're_inspection',
  're_inspection': 'completed',
  completed: null,
  on_hold: null,
};

const PIPELINE_PREV: Record<RepairStatus, RepairStatus | null> = {
  received: null,
  waiting_parts: 'received',
  in_progress: 'waiting_parts',
  're_inspection': 'in_progress',
  completed: 're_inspection',
  on_hold: null,
};

export function useMaintenanceList() {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const tick = useEntityTick('repair');
  const publish = useDomainEventStore((s) => s.publish);

  // localize는 새 객체를 만들므로 tick 단위로 memoize (참조 안정화)
  const repairs = useMemo(
    () => getAllRepairWOs().map((r) => localizeRepair(r, isKo)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isKo, tick],
  );
  const summary = getMaintenanceSummary();

  // 이동에 성공하면 전이된 상태를, 이동 불가면 null을 반환한다(호출측 토스트 판단용).
  const moveStatus = useCallback(
    (id: string, direction: 'next' | 'prev'): RepairStatus | null => {
      const wo = getAllRepairWOs().find((w) => w.id === id);
      if (!wo) return null;
      const nextStatus = direction === 'next' ? PIPELINE_NEXT[wo.status] : PIPELINE_PREV[wo.status];
      if (!nextStatus) return null;
      updateRepairStatus(id, nextStatus);
      publish('repair', id);
      return nextStatus;
    },
    [publish],
  );

  return { repairs, summary, moveStatus };
}

export function useMaintenanceDetail(id: string) {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const tick = useEntityTick('repair');
  // 참조 안정화 — 소비측 useMemo/useEffect 재실행 방지
  const repair = useMemo(
    () => {
      const raw = getRepairWOById(id);
      return raw ? localizeRepair(raw, isKo) : undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, isKo, tick],
  );

  // 원천 WO(sourceType==='inspection')의 점검 상세로 링크하기 위한 id 해석
  const sourceInspectionId =
    repair?.sourceType === 'inspection' && repair.sourceWoNumber
      ? getAllInspectionWOs().find((w) => w.woNumber === repair.sourceWoNumber)?.id
      : undefined;

  return { repair, sourceInspectionId };
}

export { PIPELINE_NEXT, PIPELINE_PREV };
