import { useTranslation } from 'react-i18next';
import {
  getAllInventoryItems,
  getAllPurchaseOrders,
  getInventorySummary,
} from '@crane/domain/inventory';
import type { InventoryItem } from '@crane/domain/inventory';
import { useEntityTick } from '../shared/use-domain-event-store';

function localizeItem(item: InventoryItem, isKo: boolean): InventoryItem {
  if (!isKo) return item;
  return {
    ...item,
    partName: item.partName_ko ?? item.partName,
  };
}

export function useInventoryList() {
  const { i18n } = useTranslation();
  const isKo = i18n.language === 'ko';
  useEntityTick('parts');
  const items = getAllInventoryItems().map((item) => localizeItem(item, isKo));
  const purchaseOrders = getAllPurchaseOrders();
  const summary = getInventorySummary();
  return { items, purchaseOrders, summary };
}
