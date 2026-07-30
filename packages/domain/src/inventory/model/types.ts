// BOM 21개 클러스터 기준 카테고리 (shared/bom-catalog.ts의 BomClusterKey와 동일 키)
export type PartCategory =
  | 'power-dist'
  | 'motor-starter'
  | 'pilot-device'
  | 'network'
  | 'fuse'
  | 'plc'
  | 'sensing'
  | 'dcm-drive'
  | 'wiring'
  | 'power-supply'
  | 'instrument'
  | 'computing'
  | 'mech-drive'
  | 'enclosure'
  | 'operator'
  | 'transformer'
  | 'current-sensing'
  | 'resistor'
  | 'warning'
  | 'cctv'
  | 'surge'
  | 'other';

export type PartCriticality = 'critical' | 'essential' | 'standard';

export type InventoryStatus = 'normal' | 'low' | 'out_of_stock' | 'excess' | 'expiry_soon';

export type PoStatus =
  | 'requested'
  | 'approved'
  | 'ordered'
  | 'in_transit'
  | 'received'
  | 'cancelled';

export interface Part {
  id: string;
  partNumber: string;
  partName: string;
  category: PartCategory;
  manufacturer: string;
  unitPrice: number;
  leadTimeDays: number;
  criticality: PartCriticality;
  minStockQty: number;
  reorderPoint: number;
  reorderQty: number;
  isConsumable: boolean;
  shelfLifeMonths?: number;
}

/** 관리 단위 — 벌크 케이블은 M(미터), 그 외 EA */
export type Uom = 'EA' | 'M';

export interface InventoryItem {
  id: string;
  partId: string;
  partNumber: string;
  partName: string;
  partName_ko?: string;
  category: PartCategory;
  criticality: PartCriticality;
  manufacturer: string;
  uom: Uom;
  unitPrice: number;
  currentQty: number;
  reservedQty: number;
  availableQty: number;
  minStockQty: number;
  reorderPoint: number;
  status: InventoryStatus;
  lastReceiptDate: string;
  lastIssueDate: string;
  locationBin: string;
  leadTimeDays: number;
  /** 이 부품이 적용되는 크레인 (둘 다 포함 시 공통 부품) */
  craneIds: string[];
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  orderDate: string;
  expectedDelivery: string;
  actualDelivery?: string;
  items: { partId: string; partName: string; qty: number; unitPrice: number; total: number }[];
  totalAmount: number;
  status: PoStatus;
  urgency: 'urgent' | 'normal' | 'scheduled';
  /** 'System' = 재주문점 미달 자동 재발주 */
  requester: string;
  note?: string;
  note_ko?: string;
}

/** 부품 기준 발주중(미입고) PO 라인 뷰 */
export interface OpenPoLine {
  poId: string;
  poNumber: string;
  vendor: string;
  qty: number;
  expectedDelivery: string;
  status: PoStatus;
  requester: string;
  note?: string;
  note_ko?: string;
}

export type PartsRequestStatus = 'pending' | 'approved' | 'ordered' | 'cancelled';
export type PartsRequestPriority = 'urgent' | 'normal' | 'scheduled';

export interface PartsRequestItem {
  partId: string;
  partName: string;
  qty: number;
  unitPrice: number;
}

export interface PartsRequest {
  id: string;
  requestNumber: string;
  requestDate: string;
  requester: string;
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  priority: PartsRequestPriority;
  status: PartsRequestStatus;
  items: PartsRequestItem[];
  /** 부품 대기 수리 WO에서 발행된 경우 원천 수리 WO 번호 */
  sourceWoNumber?: string;
  note?: string;
}

export interface InventorySummary {
  totalParts: number;
  lowStock: number;
  reorderNeeded: number;
  activePOs: number;
  totalValue: number;
}

// ── 재고 트랜잭션 (입고/출고 원장) ──
export type InventoryTransactionType = 'receipt' | 'issue' | 'adjust';

export type InventoryTransactionRefType =
  | 'po'
  | 'repair_wo'
  | 'parts_request'
  | 'manual';

export interface InventoryTransaction {
  id: string;
  partId: string;
  type: InventoryTransactionType;
  /** 항상 양수 — 방향은 type이 결정 (receipt=＋, issue=－) */
  qty: number;
  date: string;
  ref?: string;
  refType?: InventoryTransactionRefType;
  by: string;
  note?: string;
  note_ko?: string;
}

export interface StockMovementInput {
  partId: string;
  qty: number;
  by: string;
  date?: string;
  ref?: string;
  refType?: InventoryTransactionRefType;
  note?: string;
  note_ko?: string;
}

export type StockMovementResult =
  | { success: true }
  | { success: false; reason: 'not_found' | 'insufficient_stock' | 'invalid_qty' };
