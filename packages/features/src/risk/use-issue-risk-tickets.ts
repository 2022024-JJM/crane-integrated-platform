import { useCallback } from 'react';
import { useCreateRepairTicket, useCreatePartsTicket } from '../ticket';
import type { RiskTicketPlan } from './risk-ticket-plan';

/**
 * 리스크 티켓 계획들을 도메인 함수 직접 호출로 일괄 발행 — 폼 미경유.
 * 생성 훅의 publish tick으로 useOpenRisks가 재계산되어 발행 배지가 즉시 갱신된다.
 * repair/parts 외 kind(link/parts_form)는 발행 대상이 아니므로 건너뛴다.
 */
export function useIssueRiskTickets() {
  const createRepair = useCreateRepairTicket();
  const createParts = useCreatePartsTicket();

  return useCallback(
    (plans: RiskTicketPlan[]): { repairCount: number; partsCount: number } => {
      let repairCount = 0;
      let partsCount = 0;
      for (const plan of plans) {
        if (plan.kind === 'repair') {
          createRepair(plan.draft);
          repairCount += 1;
        } else if (plan.kind === 'parts') {
          createParts(plan.draft);
          partsCount += 1;
        }
      }
      return { repairCount, partsCount };
    },
    [createRepair, createParts],
  );
}
