import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllRepairWOs,
  getMaintenanceSummary,
  getRepairWOById,
  updateRepairStatus,
} from '@crane/domain/maintenance';
import type { RepairStatus, RepairWO } from '@crane/domain/maintenance';
import { useTicketCreateStore } from '../ticket/use-ticket-create-store';

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
  // 상태 변경 후 강제 리렌더
  const [, setTick] = useState(0);
  // 새 티켓 생성 시 강제 리렌더
  void useTicketCreateStore((s) => s._tick);

  const repairs = getAllRepairWOs().map((r) => localizeRepair(r, isKo));
  const summary = getMaintenanceSummary();

  const moveStatus = useCallback((id: string, direction: 'next' | 'prev') => {
    const wo = getAllRepairWOs().find((w) => w.id === id);
    if (!wo) return;
    const nextStatus = direction === 'next' ? PIPELINE_NEXT[wo.status] : PIPELINE_PREV[wo.status];
    if (!nextStatus) return;
    updateRepairStatus(id, nextStatus);
    setTick((t) => t + 1);
  }, []);

  return { repairs, summary, moveStatus };
}

export function useMaintenanceDetail(id: string) {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const raw = getRepairWOById(id);
  const repair = raw ? localizeRepair(raw, isKo) : undefined;
  return { repair };
}

export { PIPELINE_NEXT, PIPELINE_PREV };
