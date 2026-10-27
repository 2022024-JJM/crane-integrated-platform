import type { FieldReport } from '@crane/domain/shared';
import { useCallback } from 'react';
import { addInspectionWO, getDefaultChecklist } from '@crane/domain/inspection';
import type { InspectionWO } from '@crane/domain/inspection';
import { newInspectionId, nextInspectionWoNumber } from '@crane/domain/shared';
import { logActivity } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export interface InspectionTicketDraft {
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  woType: InspectionWO['woType'];
  priority: InspectionWO['priority'];
  scheduledDate: string;
  performerType: InspectionWO['performerType'];
  assignedTo: string;
  findings?: string;
  /** 반복 주기 — 완료 시 다음 회차 WO 자동 생성 */
  recurrence?: InspectionWO['recurrence'];
  /** 현장에서 판정을 채워 보낸 체크리스트 — 없으면 종류별 기본 체크리스트(미판정). */
  checklistItems?: InspectionWO['checklistItems'];
  /** 현장(모바일) 보고 표식 — 접수함이 본다. */
  fieldReport?: FieldReport;
}

export function useCreateInspectionTicket() {
  const publish = useDomainEventStore((s) => s.publish);

  return useCallback(
    (draft: InspectionTicketDraft): InspectionWO => {
      const wo: InspectionWO = {
        ...draft,
        id: newInspectionId(),
        woNumber: nextInspectionWoNumber(),
        status: 'scheduled',
        actualDate: null,
        result: null,
        checklistItems:
          draft.checklistItems ?? getDefaultChecklist(draft.woType),
      };

      addInspectionWO(wo);
      logActivity({
        kind: 'inspection',
        refId: wo.id,
        type: 'reported',
        by: draft.fieldReport?.reportedBy ?? 'office',
      });
      publish('inspection', wo.id);
      return wo;
    },
    [publish],
  );
}
