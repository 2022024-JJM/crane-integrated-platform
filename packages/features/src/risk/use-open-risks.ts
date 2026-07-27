import { useMemo } from 'react';
import { getAllInspectionWOs } from '@crane/domain/inspection';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import { getAllInventoryItems } from '@crane/domain/inventory';
import { useEntityTicks } from '../shared/use-domain-event-store';
import { computeOpenRisks } from './compute-open-risks';

/** 오픈 리스크 레지스터 — inspection/repair/parts tick에 반응해 재계산 */
export function useOpenRisks() {
  const tick = useEntityTicks(['inspection', 'repair', 'parts']);

  return useMemo(
    () =>
      computeOpenRisks({
        inspections: getAllInspectionWOs(),
        repairs: getAllRepairWOs(),
        inventoryItems: getAllInventoryItems(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
}
