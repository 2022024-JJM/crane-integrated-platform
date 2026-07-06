import { bomCatalog, getBomCraneIds } from '../../shared/bom-catalog';
import type { BomClusterKey } from '../../shared/bom-catalog';
import { seedSequence } from '../../shared/id-generator';
import type {
  InventoryItem,
  InventoryStatus,
  InventorySummary,
  InventoryTransaction,
  OpenPoLine,
  PartCriticality,
  PartsRequest,
  PoStatus,
  PurchaseOrder,
  StockMovementInput,
  StockMovementResult,
} from './types';

// 재고 마스터는 HPSI BOM 카탈로그(shared/bom-catalog.ts) 전 품목에서 생성한다.
// 수량/단가/리드타임/중요도는 원본 BOM에 없어 클러스터별 규칙으로 채운 mock이다 —
// 실데이터 확보 시 CLUSTER_RULES와 STORY_QTY_OVERRIDES만 교체하면 된다.

interface ClusterRule {
  criticality: PartCriticality;
  leadTimeDays: number;
  priceRange: [number, number];
  minStockRange: [number, number];
}

const CLUSTER_RULES: Record<BomClusterKey, ClusterRule> = {
  'power-dist': { criticality: 'essential', leadTimeDays: 21, priceRange: [40, 2500], minStockRange: [1, 3] },
  'motor-starter': { criticality: 'essential', leadTimeDays: 21, priceRange: [30, 900], minStockRange: [1, 3] },
  'pilot-device': { criticality: 'standard', leadTimeDays: 14, priceRange: [12, 90], minStockRange: [3, 8] },
  network: { criticality: 'essential', leadTimeDays: 30, priceRange: [120, 1800], minStockRange: [1, 2] },
  fuse: { criticality: 'standard', leadTimeDays: 14, priceRange: [15, 420], minStockRange: [3, 8] },
  plc: { criticality: 'critical', leadTimeDays: 45, priceRange: [180, 3400], minStockRange: [1, 2] },
  sensing: { criticality: 'critical', leadTimeDays: 35, priceRange: [150, 2800], minStockRange: [1, 2] },
  'dcm-drive': { criticality: 'critical', leadTimeDays: 60, priceRange: [900, 24000], minStockRange: [1, 1] },
  wiring: { criticality: 'standard', leadTimeDays: 10, priceRange: [8, 120], minStockRange: [3, 8] },
  'power-supply': { criticality: 'essential', leadTimeDays: 25, priceRange: [90, 1600], minStockRange: [1, 2] },
  instrument: { criticality: 'standard', leadTimeDays: 21, priceRange: [60, 400], minStockRange: [1, 3] },
  computing: { criticality: 'essential', leadTimeDays: 30, priceRange: [150, 2200], minStockRange: [1, 2] },
  'mech-drive': { criticality: 'critical', leadTimeDays: 90, priceRange: [3500, 28000], minStockRange: [1, 1] },
  enclosure: { criticality: 'standard', leadTimeDays: 28, priceRange: [80, 1200], minStockRange: [1, 3] },
  operator: { criticality: 'essential', leadTimeDays: 40, priceRange: [400, 3200], minStockRange: [1, 2] },
  transformer: { criticality: 'essential', leadTimeDays: 35, priceRange: [250, 2400], minStockRange: [1, 2] },
  'current-sensing': { criticality: 'essential', leadTimeDays: 21, priceRange: [90, 380], minStockRange: [1, 3] },
  resistor: { criticality: 'standard', leadTimeDays: 28, priceRange: [60, 320], minStockRange: [1, 3] },
  warning: { criticality: 'standard', leadTimeDays: 21, priceRange: [80, 350], minStockRange: [1, 3] },
  cctv: { criticality: 'essential', leadTimeDays: 30, priceRange: [400, 1600], minStockRange: [1, 2] },
  surge: { criticality: 'essential', leadTimeDays: 21, priceRange: [180, 520], minStockRange: [1, 2] },
};

// 수리 WO 스토리와 연동되는 재고 연출 (partId → 현재 수량 강제)
const STORY_QTY_OVERRIDES: Record<string, number> = {
  // RPR-2026-0002: 660T 주행 모터 재권선 대기 — 스페어 없음
  'np225-kl5-cnv-b3': 0,
  // RPR-2026-0006: 50T 기복 DCM 고장 접수 — 스페어 없음 (리드타임 60일 리스크)
  '6ra8082-6fv62-0aa0-z': 0,
  // RPR-2026-0005: UPS 배터리 예방 교체 직후 — 재고 부족
  'ups-bat-vrla-24dc-3-4ah': 1,
  // RPR-2026-0004: PLC CPU 교체 사용 — 잔여 1개
  '6es7516-3ap03-0ab0': 1,
  // PO-2026-0017(System 자동 재발주) 서사: DC 링크 퓨즈 재주문점 미달
  '170m8636': 2,
};

// LAPP 벌크 케이블은 미터 단위로 관리 (수량 스케일도 ×10)
const METER_UOM_PART_IDS = new Set(['2170484', '2170893', '2170820', '7038904']);

function pseudoRandom(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) % 4294967296;
    return v / 4294967296;
  };
}

const rand = pseudoRandom(42);

function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// monthIndex: 9 = 2025-09, 13 = 2026-01, 18 = 2026-06
function randDate(fromMonthIndex: number, toMonthIndex: number): string {
  const monthIndex = randInt(fromMonthIndex, toMonthIndex);
  const year = monthIndex > 12 ? 2026 : 2025;
  const month = monthIndex > 12 ? monthIndex - 12 : monthIndex;
  return `${year}-${String(month).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
}

function roundPrice(value: number): number {
  if (value >= 1000) return Math.round(value / 50) * 50;
  if (value >= 100) return Math.round(value / 10) * 10;
  return Math.round(value);
}

function computeStatus(
  item: Pick<InventoryItem, 'currentQty' | 'availableQty' | 'minStockQty'>,
): InventoryStatus {
  if (item.currentQty === 0) return 'out_of_stock';
  if (item.availableQty <= item.minStockQty) return 'low';
  if (item.currentQty > item.minStockQty * 3) return 'excess';
  return 'normal';
}

const allInventoryItems: InventoryItem[] = bomCatalog.map((bomItem, idx) => {
  const rule = CLUSTER_RULES[bomItem.clusterKey];
  const [priceMin, priceMax] = rule.priceRange;
  const unitPrice = roundPrice(priceMin + rand() * (priceMax - priceMin));
  const isMeterUom = METER_UOM_PART_IDS.has(bomItem.partId);
  const qtyScale = isMeterUom ? 10 : 1;
  const minStockQty = randInt(rule.minStockRange[0], rule.minStockRange[1]) * qtyScale;
  const reorderPoint = minStockQty + randInt(0, 2) * qtyScale;

  let currentQty: number;
  const override = STORY_QTY_OVERRIDES[bomItem.partId];
  if (override !== undefined) {
    currentQty = override;
  } else {
    // 대략 8%는 재고 소진, 15%는 부족 상태로 연출
    const roll = rand();
    if (roll < 0.08) currentQty = 0;
    else if (roll < 0.23) currentQty = Math.max(0, minStockQty - randInt(1, 2) * qtyScale);
    else currentQty = minStockQty + randInt(1, minStockQty / qtyScale + 3) * qtyScale;
  }
  const reservedQty = currentQty > 0 ? randInt(0, Math.min(2, currentQty / qtyScale)) * qtyScale : 0;
  const availableQty = currentQty - reservedQty;

  const item: InventoryItem = {
    id: `inv-${String(idx + 1).padStart(3, '0')}`,
    partId: bomItem.partId,
    partNumber: bomItem.partNumber,
    partName: bomItem.description,
    category: bomItem.clusterKey,
    criticality: rule.criticality,
    manufacturer: bomItem.manufacturer,
    uom: isMeterUom ? 'M' : 'EA',
    unitPrice,
    currentQty,
    reservedQty,
    availableQty,
    minStockQty,
    reorderPoint,
    status: 'normal',
    lastReceiptDate: randDate(9, 18),
    lastIssueDate: randDate(13, 18),
    locationBin: `${String.fromCharCode(65 + (idx % 4))}-${String(1 + (idx % 12)).padStart(2, '0')}-${String(1 + (idx % 6)).padStart(2, '0')}`,
    leadTimeDays: rule.leadTimeDays + randInt(-3, 5),
    craneIds: getBomCraneIds(bomItem),
  };
  item.status = computeStatus(item);
  return item;
});

function poItem(partId: string, qty: number): PurchaseOrder['items'][number] {
  const inv = allInventoryItems.find((i) => i.partId === partId);
  const unitPrice = inv?.unitPrice ?? 0;
  return {
    partId,
    partName: inv?.partName ?? partId,
    qty,
    unitPrice,
    total: qty * unitPrice,
  };
}

const sumTotal = (items: PurchaseOrder['items']) =>
  items.reduce((sum, it) => sum + it.total, 0);

const po1Items = [poItem('6ra8082-6fv62-0aa0-z', 1), poItem('6es7516-3ap03-0ab0', 1)];
const po2Items = [poItem('170m8636', 4), poItem('ktk-r-1', 10), poItem('fwp-30a14fi', 6)];
const po3Items = [
  poItem('787-2742', 2),
  poItem('855-1001-2500-1001', 3),
  poItem('ups-bat-vrla-24dc-3-4ah', 4),
];

const allPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    poNumber: 'PO-2026-0018',
    vendor: 'Siemens Korea',
    orderDate: '2026-06-29',
    expectedDelivery: '2026-08-25',
    items: po1Items,
    totalAmount: sumTotal(po1Items),
    status: 'ordered',
    urgency: 'urgent',
    requester: '조범희',
  },
  {
    id: 'po-002',
    poNumber: 'PO-2026-0017',
    vendor: 'Bussmann (Eaton)',
    orderDate: '2026-06-20',
    expectedDelivery: '2026-07-10',
    items: po2Items,
    totalAmount: sumTotal(po2Items),
    status: 'in_transit',
    urgency: 'normal',
    requester: 'System',
    note: 'Auto-reorder — stock fell below reorder point',
    note_ko: '자동 재발주 — 재주문점 미달 감지',
  },
  {
    id: 'po-003',
    poNumber: 'PO-2026-0016',
    vendor: 'WAGO Korea',
    orderDate: '2026-06-12',
    expectedDelivery: '2026-07-08',
    items: po3Items,
    totalAmount: sumTotal(po3Items),
    status: 'in_transit',
    urgency: 'normal',
    requester: '정종민',
  },
];

// ── 재고 트랜잭션 원장 ──
// 스토리 부품(수리 WO 연동) 중심으로 시드. 나머지 부품은 이력 없이 시작한다.
const allInventoryTransactions: InventoryTransaction[] = [
  {
    id: 'tx-015',
    partId: 'hf1016414',
    type: 'issue',
    qty: 1,
    date: '2026-07-02',
    ref: 'RPR-2026-0001',
    refType: 'repair_wo',
    by: '조범희',
    note: 'DCM cabinet fan/filter unit replacement — bearing noise',
    note_ko: 'DCM 판넬 팬/필터 유닛 교체 — 베어링 이상음',
  },
  {
    id: 'tx-014',
    partId: 'vnso-44-earipz',
    type: 'issue',
    qty: 1,
    date: '2026-06-30',
    ref: 'RPR-2026-0003',
    refType: 'repair_wo',
    by: '정종민',
    note: 'Joystick replacement — luffing axis neutral drift',
    note_ko: '조이스틱 교체 — 기복 축 중립 드리프트',
  },
  {
    id: 'tx-013',
    partId: '6es7516-3ap03-0ab0',
    type: 'issue',
    qty: 1,
    date: '2026-06-27',
    ref: 'RPR-2026-0004',
    refType: 'repair_wo',
    by: 'Siemens Service',
    note: 'PLC CPU replacement after power surge failure',
    note_ko: '전원 서지 고장에 따른 PLC CPU 교체',
  },
  {
    id: 'tx-012',
    partId: '2170484',
    type: 'issue',
    qty: 2,
    date: '2026-06-27',
    ref: 'RPR-2026-0004',
    refType: 'repair_wo',
    by: 'Siemens Service',
    note: 'PROFINET cable replacement with PLC CPU',
    note_ko: 'PLC CPU 교체 시 PROFINET 케이블 동반 교체',
  },
  {
    id: 'tx-016',
    partId: '170m8636',
    type: 'issue',
    qty: 2,
    date: '2026-06-19',
    refType: 'manual',
    by: '조범희',
    note: '660T DC link fuse preventive replacement — triggered auto-reorder',
    note_ko: '660T DC 링크 퓨즈 예방 교체 — 자동 재발주 트리거',
  },
  {
    id: 'tx-011',
    partId: 'ups-bat-vrla-24dc-3-4ah',
    type: 'issue',
    qty: 2,
    date: '2026-06-18',
    ref: 'RPR-2026-0005',
    refType: 'repair_wo',
    by: '박순영',
    note: 'Preventive UPS battery module replacement',
    note_ko: 'UPS 배터리 모듈 예방 교체',
  },
  {
    id: 'tx-010',
    partId: 'hf1016414',
    type: 'issue',
    qty: 1,
    date: '2026-06-10',
    refType: 'manual',
    by: '조범희',
    note: '660T panel fan/filter unit swap — contamination',
    note_ko: '660T 판넬 팬/필터 유닛 교체 — 오염',
  },
  {
    id: 'tx-009',
    partId: '170m8636',
    type: 'issue',
    qty: 2,
    date: '2026-05-06',
    refType: 'manual',
    by: '조범희',
    note: '660T DC link fuse replacement',
    note_ko: '660T DC 링크 퓨즈 교체',
  },
  {
    id: 'tx-008',
    partId: '6ra8082-6fv62-0aa0-z',
    type: 'issue',
    qty: 1,
    date: '2026-05-02',
    refType: 'manual',
    by: '박순영',
    note: 'Commissioning spare consumed — field failure swap. Restock via PO-2026-0018.',
    note_ko: '시운전 스페어 소진 — 현장 고장 교체 투입. PO-2026-0018로 재발주.',
  },
  {
    id: 'tx-007',
    partId: 'np225-kl5-cnv-b3',
    type: 'issue',
    qty: 1,
    date: '2026-04-22',
    refType: 'manual',
    by: '조범희',
    note: 'Spare motor consumed for prior traverse defect — restock pending',
    note_ko: '이전 횡행 결함 대응에 스페어 모터 투입 — 보충 미실시',
  },
  {
    id: 'tx-006',
    partId: 'ups-bat-vrla-24dc-3-4ah',
    type: 'issue',
    qty: 1,
    date: '2026-03-12',
    refType: 'manual',
    by: '박순영',
    note: 'Bench test unit for UPS commissioning check',
    note_ko: 'UPS 점검용 벤치 테스트 유닛 사용',
  },
  {
    id: 'tx-005',
    partId: '170m8636',
    type: 'receipt',
    qty: 6,
    date: '2026-01-15',
    ref: 'PO-2026-0004',
    refType: 'po',
    by: '정종민',
    note: 'Fuse spare stock replenishment',
    note_ko: '퓨즈 스페어 재고 보충',
  },
  {
    id: 'tx-004',
    partId: '6es7516-3ap03-0ab0',
    type: 'receipt',
    qty: 2,
    date: '2025-11-20',
    ref: 'PO-2025-0083',
    refType: 'po',
    by: '박순영',
    note: 'Initial PLC CPU spare stock',
    note_ko: 'PLC CPU 초기 스페어 입고',
  },
  {
    id: 'tx-003',
    partId: 'ups-bat-vrla-24dc-3-4ah',
    type: 'receipt',
    qty: 4,
    date: '2025-09-02',
    ref: 'PO-2025-0061',
    refType: 'po',
    by: '박순영',
    note: 'UPS battery module stock',
    note_ko: 'UPS 배터리 모듈 입고',
  },
  {
    id: 'tx-002',
    partId: '6ra8082-6fv62-0aa0-z',
    type: 'receipt',
    qty: 1,
    date: '2025-06-10',
    refType: 'manual',
    by: '박순영',
    note: '50T commissioning spare (luffing DCM)',
    note_ko: '50T 시운전 스페어 입고 (기복 DCM)',
  },
  {
    id: 'tx-001',
    partId: 'np225-kl5-cnv-b3',
    type: 'receipt',
    qty: 1,
    date: '2024-08-15',
    refType: 'manual',
    by: '조범희',
    note: '660T commissioning spare (travelling DC motor)',
    note_ko: '660T 시운전 스페어 입고 (주행 DC 모터)',
  },
];

let txSeq = 100; // 런타임 생성 트랜잭션 ID 시퀀스 (시드와 충돌 방지)

function nextTxId(): string {
  txSeq += 1;
  return `tx-${txSeq}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getTransactionsByPartId(partId: string): InventoryTransaction[] {
  return allInventoryTransactions
    .filter((tx) => tx.partId === partId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 출고 — 재고 차감 + 트랜잭션 기록 */
export function issuePart(input: StockMovementInput): StockMovementResult {
  const inv = allInventoryItems.find((i) => i.partId === input.partId);
  if (!inv) return { success: false, reason: 'not_found' };
  if (!Number.isFinite(input.qty) || input.qty <= 0)
    return { success: false, reason: 'invalid_qty' };
  // 예약분을 제외한 가용 재고 기준으로 출고를 막는다
  if (inv.availableQty < input.qty)
    return { success: false, reason: 'insufficient_stock' };

  const date = input.date ?? today();
  inv.currentQty -= input.qty;
  inv.availableQty = Math.max(0, inv.currentQty - inv.reservedQty);
  inv.lastIssueDate = date;
  inv.status = computeStatus(inv);
  allInventoryTransactions.unshift({
    id: nextTxId(),
    partId: input.partId,
    type: 'issue',
    qty: input.qty,
    date,
    ref: input.ref,
    refType: input.refType ?? 'manual',
    by: input.by,
    note: input.note,
    note_ko: input.note_ko,
  });
  return { success: true };
}

/** 입고 — 재고 증가 + 트랜잭션 기록 */
export function receivePart(input: StockMovementInput): StockMovementResult {
  const inv = allInventoryItems.find((i) => i.partId === input.partId);
  if (!inv) return { success: false, reason: 'not_found' };
  if (!Number.isFinite(input.qty) || input.qty <= 0)
    return { success: false, reason: 'invalid_qty' };

  const date = input.date ?? today();
  inv.currentQty += input.qty;
  inv.availableQty = Math.max(0, inv.currentQty - inv.reservedQty);
  inv.lastReceiptDate = date;
  inv.status = computeStatus(inv);
  allInventoryTransactions.unshift({
    id: nextTxId(),
    partId: input.partId,
    type: 'receipt',
    qty: input.qty,
    date,
    ref: input.ref,
    refType: input.refType ?? 'manual',
    by: input.by,
    note: input.note,
    note_ko: input.note_ko,
  });
  return { success: true };
}

export function getInventoryItemByPartId(
  partId: string,
): InventoryItem | undefined {
  return allInventoryItems.find((i) => i.partId === partId);
}

const OPEN_PO_STATUSES: PoStatus[] = ['requested', 'approved', 'ordered', 'in_transit'];

/** 부품 기준 발주중(미입고) PO 라인 — ETA 오름차순 */
export function getOpenPoLinesByPartId(partId: string): OpenPoLine[] {
  return allPurchaseOrders
    .filter((po) => OPEN_PO_STATUSES.includes(po.status))
    .flatMap((po) =>
      po.items
        .filter((it) => it.partId === partId)
        .map((it) => ({
          poId: po.id,
          poNumber: po.poNumber,
          vendor: po.vendor,
          qty: it.qty,
          expectedDelivery: po.expectedDelivery,
          status: po.status,
          requester: po.requester,
          note: po.note,
          note_ko: po.note_ko,
        })),
    )
    .sort((a, b) => a.expectedDelivery.localeCompare(b.expectedDelivery));
}

export function getOnOrderQtyByPartId(partId: string): number {
  return getOpenPoLinesByPartId(partId).reduce((sum, line) => sum + line.qty, 0);
}

const allPartsRequests: PartsRequest[] = [];

const maxPartsSeq = allPartsRequests.reduce((max, req) => {
  const m = req.requestNumber.match(/-(\d{4})$/);
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);
seedSequence('parts', maxPartsSeq);

export function getAllPartsRequests(): PartsRequest[] {
  return allPartsRequests;
}

export function addPartsRequest(req: PartsRequest): void {
  allPartsRequests.unshift(req);
  for (const line of req.items) {
    const inv = allInventoryItems.find((i) => i.partId === line.partId);
    if (!inv) continue;
    inv.reservedQty += line.qty;
    inv.availableQty = Math.max(0, inv.currentQty - inv.reservedQty);
    inv.status = computeStatus(inv);
  }
}

export function getAllInventoryItems(): InventoryItem[] {
  return allInventoryItems;
}

export function getAllPurchaseOrders(): PurchaseOrder[] {
  return allPurchaseOrders;
}

export function getInventorySummary(): InventorySummary {
  const totalValue = allInventoryItems.reduce(
    (sum, item) => sum + item.currentQty * item.unitPrice,
    0,
  );
  return {
    totalParts: allInventoryItems.length,
    lowStock: allInventoryItems.filter((i) =>
      ['low', 'out_of_stock'].includes(i.status),
    ).length,
    reorderNeeded: allInventoryItems.filter(
      (i) => i.availableQty <= i.reorderPoint,
    ).length,
    activePOs: allPurchaseOrders.filter((p) =>
      ['ordered', 'in_transit', 'approved'].includes(p.status),
    ).length,
    totalValue,
  };
}
