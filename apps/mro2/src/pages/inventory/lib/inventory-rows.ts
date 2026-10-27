import type {
  InventoryItem,
  InventoryStatus,
  PartCriticality,
} from '@crane/domain/inventory';

export type CraneFilter = 'all' | 'crane-660t' | 'crane-50t' | 'common';

export interface InventoryFilter {
  status: ReadonlySet<InventoryStatus>;
  criticality: ReadonlySet<PartCriticality>;
  crane: CraneFilter;
  query: string;
  /** "재주문 필요" 지표 클릭 — availableQty <= reorderPoint (상태 축과 별개) */
  reorderOnly: boolean;
}

export const EMPTY_FILTER: InventoryFilter = {
  status: new Set(),
  criticality: new Set(),
  crane: 'all',
  query: '',
  reorderOnly: false,
};

export function matchCrane(item: InventoryItem, crane: CraneFilter): boolean {
  if (crane === 'all') return true;
  if (crane === 'common') return item.craneIds.length > 1;
  return item.craneIds.includes(crane);
}

export function filterInventory(
  items: readonly InventoryItem[],
  f: InventoryFilter,
): InventoryItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (f.status.size === 0 || f.status.has(i.status)) &&
      (f.criticality.size === 0 || f.criticality.has(i.criticality)) &&
      matchCrane(i, f.crane) &&
      (!f.reorderOnly || i.availableQty <= i.reorderPoint) &&
      (q === '' ||
        i.partName.toLowerCase().includes(q) ||
        i.partNumber.toLowerCase().includes(q) ||
        i.manufacturer.toLowerCase().includes(q)),
  );
}

const STATUS_RANK: Record<InventoryStatus, number> = {
  out_of_stock: 0,
  low: 1,
  expiry_soon: 2,
  excess: 3,
  normal: 4,
};
const CRIT_RANK: Record<PartCriticality, number> = {
  critical: 0,
  essential: 1,
  standard: 2,
};

/** 위험 우선 — 상태 › 중요도 › 이름. */
export function sortByRisk(items: readonly InventoryItem[]): InventoryItem[] {
  return [...items].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      CRIT_RANK[a.criticality] - CRIT_RANK[b.criticality] ||
      a.partName.localeCompare(b.partName),
  );
}

export function countBy<K extends string>(
  items: readonly InventoryItem[],
  key: (i: InventoryItem) => K,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1;
  return out;
}

/** 최소 재고 대비 가용 비율(%) — 최소가 0이면 가용>0 을 100 으로 본다. */
export function stockPct(item: InventoryItem): number {
  if (item.minStockQty <= 0) return item.availableQty > 0 ? 100 : 0;
  return Math.max(
    0,
    Math.min(100, Math.round((item.availableQty / item.minStockQty) * 100)),
  );
}

/**
 * 빨강 상한 — 품절이라도 중요도 '위험' 부품만 채운 빨강 배지. 그 외 품절·저재고는
 * 테두리 배지. 전 행이 빨갛게 되면 어느 부품도 급해 보이지 않는다.
 */
export type BadgeEmphasis = 'filled' | 'outline';
export function badgeEmphasis(item: InventoryItem): BadgeEmphasis {
  return item.status === 'out_of_stock' && item.criticality === 'critical'
    ? 'filled'
    : 'outline';
}

export function isLowOrOut(item: InventoryItem): boolean {
  return item.status === 'low' || item.status === 'out_of_stock';
}
