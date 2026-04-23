import { seedSequence } from '../../shared/id-generator';
import type { InventoryItem, InventoryStatus, InventorySummary, PartCategory, PartCriticality, PartsRequest, PurchaseOrder } from './types';

const baseInventoryItems: InventoryItem[] = [
  {
    id: 'inv-001',
    partId: 'part-br-001',
    partNumber: 'KC-BP-900T-2018',
    partName: 'Brake Pad Set (Hoist) — Konecranes 900T',
    partName_ko: '브레이크 패드 세트 (호이스트) — Konecranes 900T',
    category: 'brake',
    criticality: 'critical',
    manufacturer: 'Konecranes',
    unitPrice: 480,
    currentQty: 4,
    reservedQty: 1,
    availableQty: 3,
    minStockQty: 4,
    reorderPoint: 5,
    status: 'low',
    lastReceiptDate: '2026-01-15',
    lastIssueDate: '2026-04-14',
    locationBin: 'A-01-03',
    leadTimeDays: 21,
  },
  {
    id: 'inv-002',
    partId: 'part-wr-001',
    partNumber: 'WR-36MM-6X37-BRIDON',
    partName: 'Wire Rope 36mm 6x37 (200m) — Main Hoist',
    partName_ko: '와이어 로프 36mm 6x37 (200m) — 주 호이스트',
    category: 'wire_rope',
    criticality: 'critical',
    manufacturer: 'Bridon',
    unitPrice: 2200,
    currentQty: 3,
    reservedQty: 0,
    availableQty: 3,
    minStockQty: 2,
    reorderPoint: 3,
    status: 'normal',
    lastReceiptDate: '2025-11-20',
    lastIssueDate: '2026-03-10',
    locationBin: 'B-02-01',
    leadTimeDays: 35,
  },
  {
    id: 'inv-003',
    partId: 'part-wr-002',
    partNumber: 'WR-28MM-6X37-BRIDON',
    partName: 'Wire Rope 28mm 6x37 (200m) — Aux Hoist',
    partName_ko: '와이어 로프 28mm 6x37 (200m) — 보조 호이스트',
    category: 'wire_rope',
    criticality: 'critical',
    manufacturer: 'Bridon',
    unitPrice: 1850,
    currentQty: 1,
    reservedQty: 0,
    availableQty: 1,
    minStockQty: 2,
    reorderPoint: 3,
    status: 'low',
    lastReceiptDate: '2025-09-05',
    lastIssueDate: '2026-04-10',
    locationBin: 'B-02-02',
    leadTimeDays: 35,
  },
  {
    id: 'inv-004',
    partId: 'part-plc-001',
    partNumber: 'SIEMENS-S7-1500-CPU',
    partName: 'PLC CPU Module (Siemens S7-1500)',
    partName_ko: 'PLC CPU 모듈 (Siemens S7-1500)',
    category: 'electrical',
    criticality: 'critical',
    manufacturer: 'Siemens',
    unitPrice: 3200,
    currentQty: 2,
    reservedQty: 0,
    availableQty: 2,
    minStockQty: 1,
    reorderPoint: 2,
    status: 'normal',
    lastReceiptDate: '2025-12-01',
    lastIssueDate: '2026-04-13',
    locationBin: 'C-01-05',
    leadTimeDays: 45,
  },
  {
    id: 'inv-005',
    partId: 'part-seal-001',
    partNumber: 'SEAL-OSK-75MM',
    partName: 'Output Shaft Oil Seal 75mm',
    partName_ko: '출력축 오일씰 75mm',
    category: 'seal_gasket',
    criticality: 'essential',
    manufacturer: 'SKF',
    unitPrice: 45,
    currentQty: 12,
    reservedQty: 2,
    availableQty: 10,
    minStockQty: 6,
    reorderPoint: 8,
    status: 'normal',
    lastReceiptDate: '2026-02-10',
    lastIssueDate: '2026-04-14',
    locationBin: 'A-03-07',
    leadTimeDays: 14,
  },
  {
    id: 'inv-006',
    partId: 'part-oil-001',
    partNumber: 'MOBIL-GLYGOYLE-460-20L',
    partName: 'Gear Oil Mobil Glygoyle 460 (20L)',
    partName_ko: '기어 오일 Mobil Glygoyle 460 (20L)',
    category: 'lubricant',
    criticality: 'standard',
    manufacturer: 'Mobil',
    unitPrice: 120,
    currentQty: 8,
    reservedQty: 1,
    availableQty: 7,
    minStockQty: 5,
    reorderPoint: 6,
    status: 'normal',
    lastReceiptDate: '2026-03-01',
    lastIssueDate: '2026-04-14',
    locationBin: 'D-01-02',
    leadTimeDays: 7,
  },
  {
    id: 'inv-007',
    partId: 'part-inv-001',
    partNumber: 'KC-INV-160KW-2019',
    partName: 'Hoist Inverter 160kW — Konecranes',
    partName_ko: '호이스트 인버터 160kW — Konecranes',
    category: 'electrical',
    criticality: 'critical',
    manufacturer: 'Konecranes',
    unitPrice: 8500,
    currentQty: 0,
    reservedQty: 0,
    availableQty: 0,
    minStockQty: 1,
    reorderPoint: 1,
    status: 'out_of_stock',
    lastReceiptDate: '2025-06-20',
    lastIssueDate: '2025-10-15',
    locationBin: 'C-02-01',
    leadTimeDays: 60,
  },
  {
    id: 'inv-008',
    partId: 'part-bearing-001',
    partNumber: 'SKF-22340-CCK-W33',
    partName: 'Spherical Roller Bearing SKF 22340',
    partName_ko: '구면 롤러 베어링 SKF 22340',
    category: 'gear_bearing',
    criticality: 'essential',
    manufacturer: 'SKF',
    unitPrice: 680,
    currentQty: 6,
    reservedQty: 0,
    availableQty: 6,
    minStockQty: 4,
    reorderPoint: 5,
    status: 'normal',
    lastReceiptDate: '2026-01-08',
    lastIssueDate: '2026-02-20',
    locationBin: 'A-02-04',
    leadTimeDays: 28,
  },
  {
    id: 'inv-009',
    partId: 'part-cable-001',
    partNumber: 'CAB-COMM-SET-LH',
    partName: 'Communication Cable Set — Liebherr EOT',
    partName_ko: '통신 케이블 세트 — Liebherr EOT',
    category: 'electrical',
    criticality: 'essential',
    manufacturer: 'Liebherr',
    unitPrice: 180,
    currentQty: 3,
    reservedQty: 0,
    availableQty: 3,
    minStockQty: 2,
    reorderPoint: 3,
    status: 'normal',
    lastReceiptDate: '2025-10-14',
    lastIssueDate: '2026-04-13',
    locationBin: 'C-01-08',
    leadTimeDays: 30,
  },
  {
    id: 'inv-010',
    partId: 'part-ls-001',
    partNumber: 'LS-HOIST-UPPER-KC',
    partName: 'Hoist Upper Limit Switch — Konecranes',
    partName_ko: '호이스트 상부 리밋 스위치 — Konecranes',
    category: 'sensor',
    criticality: 'critical',
    manufacturer: 'Konecranes',
    unitPrice: 220,
    currentQty: 2,
    reservedQty: 0,
    availableQty: 2,
    minStockQty: 3,
    reorderPoint: 4,
    status: 'low',
    lastReceiptDate: '2025-08-30',
    lastIssueDate: '2026-01-15',
    locationBin: 'C-03-02',
    leadTimeDays: 21,
  },
];

const GENERATED_PART_TEMPLATES: Array<{
  name: string; name_ko: string; category: PartCategory; manufacturer: string; price: number; criticality: PartCriticality; lead: number;
}> = [
  { name: 'Motor Brush Set — 180kW', name_ko: '모터 브러시 세트 — 180kW', category: 'electrical', manufacturer: 'ABB', price: 320, criticality: 'essential', lead: 18 },
  { name: 'Trolley Travel Wheel — Ø400mm', name_ko: '트롤리 주행 휠 — Ø400mm', category: 'gear_bearing', manufacturer: 'Konecranes', price: 1250, criticality: 'critical', lead: 42 },
  { name: 'Festoon Cable 4G70 (per m)', name_ko: '페스툰 케이블 4G70 (m당)', category: 'electrical', manufacturer: 'Helukabel', price: 42, criticality: 'standard', lead: 10 },
  { name: 'Proximity Sensor M18 PNP', name_ko: '근접 센서 M18 PNP', category: 'sensor', manufacturer: 'Pepperl+Fuchs', price: 85, criticality: 'essential', lead: 12 },
  { name: 'Encoder Disc 1024ppr', name_ko: '엔코더 디스크 1024ppr', category: 'sensor', manufacturer: 'Heidenhain', price: 540, criticality: 'critical', lead: 25 },
  { name: 'Coupling Element — FLEX 180', name_ko: '커플링 엘리먼트 — FLEX 180', category: 'shaft_chain', manufacturer: 'Flender', price: 410, criticality: 'essential', lead: 21 },
  { name: 'Hook Block 80t', name_ko: '후크 블록 80t', category: 'other', manufacturer: 'Crosby', price: 4200, criticality: 'critical', lead: 56 },
  { name: 'Anti-Collision Laser Sensor', name_ko: '충돌방지 레이저 센서', category: 'sensor', manufacturer: 'SICK', price: 1850, criticality: 'critical', lead: 30 },
  { name: 'Slew Bearing — Ø1200', name_ko: '슬루잉 베어링 — Ø1200', category: 'gear_bearing', manufacturer: 'Rothe Erde', price: 18500, criticality: 'critical', lead: 90 },
  { name: 'Oil Filter Cartridge 10μm', name_ko: '오일 필터 카트리지 10μm', category: 'other', manufacturer: 'Mahle', price: 38, criticality: 'standard', lead: 5 },
  { name: 'Drum Rope Guide Set', name_ko: '드럼 로프 가이드 세트', category: 'drum', manufacturer: 'LeBus', price: 2600, criticality: 'essential', lead: 35 },
  { name: 'Radio Remote Transmitter', name_ko: '무선 리모컨 송신기', category: 'electrical', manufacturer: 'HBC-Radiomatic', price: 1200, criticality: 'essential', lead: 20 },
  { name: 'Load Cell 50t', name_ko: '로드셀 50t', category: 'sensor', manufacturer: 'HBM', price: 2850, criticality: 'critical', lead: 28 },
  { name: 'Drive Chain 2½" Pitch', name_ko: '구동 체인 2½" 피치', category: 'shaft_chain', manufacturer: 'Tsubaki', price: 780, criticality: 'essential', lead: 18 },
  { name: 'Brake Coil 24VDC', name_ko: '브레이크 코일 24VDC', category: 'brake', manufacturer: 'Stearns', price: 310, criticality: 'essential', lead: 14 },
  { name: 'Gearbox Breather Valve', name_ko: '기어박스 브리더 밸브', category: 'other', manufacturer: 'Flender', price: 95, criticality: 'standard', lead: 8 },
  { name: 'O-Ring Set NBR Ø100', name_ko: 'O-링 세트 NBR Ø100', category: 'seal_gasket', manufacturer: 'Freudenberg', price: 22, criticality: 'standard', lead: 5 },
  { name: 'Contactor 400A AC3', name_ko: '컨택터 400A AC3', category: 'electrical', manufacturer: 'Siemens', price: 680, criticality: 'essential', lead: 15 },
  { name: 'PLC I/O Module DI-32', name_ko: 'PLC I/O 모듈 DI-32', category: 'electrical', manufacturer: 'Siemens', price: 450, criticality: 'essential', lead: 20 },
  { name: 'Limit Switch Lever Type', name_ko: '리밋 스위치 레버형', category: 'sensor', manufacturer: 'Schneider', price: 95, criticality: 'essential', lead: 10 },
  { name: 'Wire Rope 32mm 6x36 (250m)', name_ko: '와이어 로프 32mm 6x36 (250m)', category: 'wire_rope', manufacturer: 'Bridon', price: 2050, criticality: 'critical', lead: 35 },
  { name: 'Hydraulic Cylinder Ø80×500', name_ko: '유압 실린더 Ø80×500', category: 'other', manufacturer: 'Parker', price: 1480, criticality: 'essential', lead: 25 },
  { name: 'EMI Filter 3-Phase 125A', name_ko: 'EMI 필터 3상 125A', category: 'electrical', manufacturer: 'Schaffner', price: 520, criticality: 'standard', lead: 14 },
  { name: 'Cable Drum Assembly 50m', name_ko: '케이블 드럼 어셈블리 50m', category: 'electrical', manufacturer: 'Conductix', price: 3600, criticality: 'essential', lead: 40 },
  { name: 'Grease Cartridge Mobilith SHC 220', name_ko: '그리스 카트리지 Mobilith SHC 220', category: 'lubricant', manufacturer: 'Mobil', price: 28, criticality: 'standard', lead: 5 },
  { name: 'Cable Gland PG29', name_ko: '케이블 글랜드 PG29', category: 'electrical', manufacturer: 'Hummel', price: 8, criticality: 'standard', lead: 3 },
  { name: 'Overhead Trolley Rail 10m', name_ko: '오버헤드 트롤리 레일 10m', category: 'other', manufacturer: 'Demag', price: 4850, criticality: 'critical', lead: 55 },
  { name: 'Vibration Sensor IEPE', name_ko: '진동 센서 IEPE', category: 'sensor', manufacturer: 'IFM', price: 420, criticality: 'essential', lead: 16 },
  { name: 'Servo Motor 15kW', name_ko: '서보 모터 15kW', category: 'electrical', manufacturer: 'Yaskawa', price: 3200, criticality: 'critical', lead: 30 },
  { name: 'Brake Disc — Ø450', name_ko: '브레이크 디스크 — Ø450', category: 'brake', manufacturer: 'Pintsch Bubenzer', price: 950, criticality: 'critical', lead: 28 },
  { name: 'Planetary Gearbox Stage-2', name_ko: '유성 감속기 2단', category: 'gear_bearing', manufacturer: 'Flender', price: 8200, criticality: 'critical', lead: 75 },
  { name: 'Emergency Stop Pushbutton', name_ko: '비상정지 푸시버튼', category: 'electrical', manufacturer: 'Pilz', price: 120, criticality: 'critical', lead: 7 },
  { name: 'Thermocouple Type-K Ø6', name_ko: '열전대 K형 Ø6', category: 'sensor', manufacturer: 'Omega', price: 65, criticality: 'standard', lead: 10 },
  { name: 'Carbon Brush Holder', name_ko: '카본 브러시 홀더', category: 'electrical', manufacturer: 'Morgan', price: 180, criticality: 'essential', lead: 18 },
  { name: 'Sprocket 24T — ANSI 100', name_ko: '스프로킷 24T — ANSI 100', category: 'shaft_chain', manufacturer: 'Tsubaki', price: 340, criticality: 'essential', lead: 14 },
  { name: 'Pressure Sensor 0-400bar', name_ko: '압력 센서 0-400bar', category: 'sensor', manufacturer: 'Hydac', price: 290, criticality: 'essential', lead: 12 },
  { name: 'Hydraulic Hose DN25×2m', name_ko: '유압 호스 DN25×2m', category: 'other', manufacturer: 'Parker', price: 85, criticality: 'standard', lead: 7 },
  { name: 'Drum Grooving Insert', name_ko: '드럼 그루빙 인서트', category: 'drum', manufacturer: 'LeBus', price: 520, criticality: 'essential', lead: 30 },
  { name: 'Anti-Sway Controller', name_ko: '스웨이 방지 컨트롤러', category: 'electrical', manufacturer: 'ABB', price: 4200, criticality: 'essential', lead: 45 },
  { name: 'Grease Nipple M10', name_ko: '그리스 니플 M10', category: 'other', manufacturer: 'SKF', price: 4, criticality: 'standard', lead: 3 },
  { name: 'Motor Cooling Fan 230V', name_ko: '모터 냉각팬 230V', category: 'electrical', manufacturer: 'Ebm-papst', price: 185, criticality: 'essential', lead: 12 },
  { name: 'Wire Rope Clamp Ø36', name_ko: '와이어 로프 클램프 Ø36', category: 'wire_rope', manufacturer: 'Crosby', price: 28, criticality: 'standard', lead: 5 },
  { name: 'Insulation Sleeve 11kV', name_ko: '절연 슬리브 11kV', category: 'electrical', manufacturer: '3M', price: 42, criticality: 'essential', lead: 8 },
  { name: 'Hoist Motor 90kW', name_ko: '호이스트 모터 90kW', category: 'electrical', manufacturer: 'ABB', price: 12500, criticality: 'critical', lead: 60 },
  { name: 'Drum Shaft — 900T Class', name_ko: '드럼 샤프트 — 900T급', category: 'shaft_chain', manufacturer: 'Konecranes', price: 6800, criticality: 'critical', lead: 80 },
  { name: 'Gear Oil ISO VG 220 (208L)', name_ko: '기어 오일 ISO VG 220 (208L)', category: 'lubricant', manufacturer: 'Shell', price: 850, criticality: 'standard', lead: 10 },
  { name: 'Cable Tray 200×60 (2m)', name_ko: '케이블 트레이 200×60 (2m)', category: 'other', manufacturer: 'Legrand', price: 95, criticality: 'standard', lead: 6 },
  { name: 'Brake Caliper Assembly', name_ko: '브레이크 캘리퍼 어셈블리', category: 'brake', manufacturer: 'Sibre', price: 2400, criticality: 'critical', lead: 35 },
  { name: 'Crane Runway Endstop', name_ko: '크레인 주행로 엔드스톱', category: 'other', manufacturer: 'Vulkollan', price: 280, criticality: 'essential', lead: 15 },
  { name: 'Fiber Optic Converter', name_ko: '광 컨버터', category: 'electrical', manufacturer: 'Moxa', price: 350, criticality: 'standard', lead: 10 },
];

const STATUSES: InventoryItem['status'][] = ['normal', 'normal', 'normal', 'normal', 'low', 'out_of_stock', 'excess'];
const CATEGORY_PREFIX: Record<PartCategory, string> = {
  brake: 'BRK', wire_rope: 'WR', drum: 'DRM', gear_bearing: 'GB', shaft_chain: 'SC',
  electrical: 'ELE', sensor: 'SNS', seal_gasket: 'SG', lubricant: 'LUB', other: 'OTH',
};

function pseudoRandom(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) % 4294967296;
    return v / 4294967296;
  };
}

const rand = pseudoRandom(42);

const generatedInventoryItems: InventoryItem[] = GENERATED_PART_TEMPLATES.map((tpl, idx) => {
  const n = idx + 11;
  const id = `inv-${String(n).padStart(3, '0')}`;
  const status = STATUSES[Math.floor(rand() * STATUSES.length)];
  const minStockQty = Math.max(1, Math.floor(rand() * 10) + 2);
  const reorderPoint = minStockQty + Math.floor(rand() * 3);
  let currentQty: number;
  if (status === 'out_of_stock') currentQty = 0;
  else if (status === 'low') currentQty = Math.max(1, Math.floor(minStockQty * 0.6));
  else if (status === 'excess') currentQty = Math.floor(minStockQty * 3) + 5;
  else currentQty = minStockQty + Math.floor(rand() * minStockQty);
  const reservedQty = currentQty > 0 ? Math.floor(rand() * Math.min(3, currentQty)) : 0;
  const prefix = CATEGORY_PREFIX[tpl.category];
  return {
    id,
    partId: `part-gen-${String(n).padStart(3, '0')}`,
    partNumber: `${prefix}-${tpl.manufacturer.slice(0, 3).toUpperCase()}-${String(2000 + n)}`,
    partName: tpl.name,
    partName_ko: tpl.name_ko,
    category: tpl.category,
    criticality: tpl.criticality,
    manufacturer: tpl.manufacturer,
    unitPrice: tpl.price,
    currentQty,
    reservedQty,
    availableQty: currentQty - reservedQty,
    minStockQty,
    reorderPoint,
    status,
    lastReceiptDate: `2025-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`,
    lastIssueDate: `2026-0${Math.floor(rand() * 4) + 1}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`,
    locationBin: `${String.fromCharCode(65 + (n % 5))}-0${(n % 3) + 1}-0${(n % 9) + 1}`,
    leadTimeDays: tpl.lead,
  };
});

const allInventoryItems: InventoryItem[] = [...baseInventoryItems, ...generatedInventoryItems];

const allPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-001',
    poNumber: 'PO-2026-0012',
    vendor: 'Konecranes Parts & Service',
    orderDate: '2026-04-14',
    expectedDelivery: '2026-05-05',
    items: [
      { partId: 'part-inv-001', partName: 'Hoist Inverter 160kW', qty: 1, unitPrice: 8500, total: 8500 },
      { partId: 'part-br-001', partName: 'Brake Pad Set (Hoist)', qty: 4, unitPrice: 480, total: 1920 },
    ],
    totalAmount: 10420,
    status: 'ordered',
    urgency: 'urgent',
    requester: '조범희',
  },
  {
    id: 'po-002',
    poNumber: 'PO-2026-0011',
    vendor: 'Bridon International',
    orderDate: '2026-04-10',
    expectedDelivery: '2026-05-15',
    items: [
      { partId: 'part-wr-002', partName: 'Wire Rope 28mm 6x37 (200m)', qty: 2, unitPrice: 1850, total: 3700 },
    ],
    totalAmount: 3700,
    status: 'in_transit',
    urgency: 'normal',
    requester: '박순영',
  },
  {
    id: 'po-003',
    poNumber: 'PO-2026-0010',
    vendor: 'SKF Korea',
    orderDate: '2026-04-05',
    expectedDelivery: '2026-04-19',
    items: [
      { partId: 'part-ls-001', partName: 'Hoist Upper Limit Switch', qty: 4, unitPrice: 220, total: 880 },
      { partId: 'part-seal-001', partName: 'Output Shaft Oil Seal 75mm', qty: 10, unitPrice: 45, total: 450 },
    ],
    totalAmount: 1330,
    status: 'in_transit',
    urgency: 'normal',
    requester: '정종민',
  },
];

const allPartsRequests: PartsRequest[] = [];

const maxPartsSeq = allPartsRequests.reduce((max, req) => {
  const m = req.requestNumber.match(/-(\d{4})$/);
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);
seedSequence('parts', maxPartsSeq);

function computeStatus(item: InventoryItem): InventoryStatus {
  if (item.currentQty === 0) return 'out_of_stock';
  if (item.availableQty <= item.minStockQty) return 'low';
  if (item.currentQty > item.minStockQty * 3) return 'excess';
  return 'normal';
}

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
