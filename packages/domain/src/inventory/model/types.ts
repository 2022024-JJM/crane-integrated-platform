export type PartCategory =
  | 'shaft_chain'
  | 'wire_rope'
  | 'drum'
  | 'gear_bearing'
  | 'brake'
  | 'sensor'
  | 'electrical'
  | 'seal_gasket'
  | 'lubricant'
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

export interface InventoryItem {
  id: string;
  partId: string;
  partNumber: string;
  partName: string;
  partName_ko?: string;
  category: PartCategory;
  criticality: PartCriticality;
  manufacturer: string;
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
  requester: string;
}

export interface InventorySummary {
  totalParts: number;
  lowStock: number;
  reorderNeeded: number;
  activePOs: number;
  totalValue: number;
}
