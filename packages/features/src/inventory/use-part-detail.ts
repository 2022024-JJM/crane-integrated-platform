import { useTranslation } from 'react-i18next';
import {
  getInventoryItemByPartId,
  getOpenPoLinesByPartId,
  getTransactionsByPartId,
} from '@crane/domain/inventory';
import type {
  InventoryItem,
  InventoryTransaction,
  OpenPoLine,
} from '@crane/domain/inventory';
import { getAllRepairWOs } from '@crane/domain/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { useEntityTicks } from '../shared/use-domain-event-store';

export interface PartRepairUsage {
  repair: RepairWO;
  qty: number;
}

function localizeTx(tx: InventoryTransaction, isKo: boolean): InventoryTransaction {
  if (!isKo) return tx;
  return { ...tx, note: tx.note_ko ?? tx.note };
}

export function usePartDetail(partId: string): {
  item: InventoryItem | undefined;
  transactions: InventoryTransaction[];
  repairUsages: PartRepairUsage[];
  /** 발주중(미입고) PO 라인 — ETA 오름차순 */
  openPoLines: OpenPoLine[];
  onOrderQty: number;
} {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  useEntityTicks(['parts', 'repair']);

  const item = getInventoryItemByPartId(partId);
  const transactions = getTransactionsByPartId(partId).map((tx) =>
    localizeTx(tx, isKo),
  );
  const openPoLines = getOpenPoLinesByPartId(partId).map((line) =>
    isKo ? { ...line, note: line.note_ko ?? line.note } : line,
  );
  const onOrderQty = openPoLines.reduce((sum, line) => sum + line.qty, 0);
  const repairUsages: PartRepairUsage[] = getAllRepairWOs()
    .filter((wo) => wo.partsUsed.some((p) => p.partId === partId))
    .map((wo) => ({
      repair: isKo
        ? {
            ...wo,
            componentName: wo.componentName_ko ?? wo.componentName,
            failureDescription: wo.failureDescription_ko ?? wo.failureDescription,
          }
        : wo,
      qty: wo.partsUsed
        .filter((p) => p.partId === partId)
        .reduce((sum, p) => sum + p.qty, 0),
    }));

  return { item, transactions, repairUsages, openPoLines, onOrderQty };
}
