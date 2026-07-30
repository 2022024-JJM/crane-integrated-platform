import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllRepairWOs,
  getMaintenanceSummary,
  getRepairWOById,
} from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { useEntityTick } from '../shared/use-domain-event-store';

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

export function useMaintenanceList() {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  const tick = useEntityTick('repair');

  // localize는 새 객체를 만들므로 tick 단위로 memoize (참조 안정화)
  const repairs = useMemo(
    () => getAllRepairWOs().map((r) => localizeRepair(r, isKo)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isKo, tick],
  );
  const summary = getMaintenanceSummary();

  return { repairs, summary };
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
