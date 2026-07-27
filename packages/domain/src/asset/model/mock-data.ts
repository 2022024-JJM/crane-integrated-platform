import { bomCatalog } from '../../shared/bom-catalog';
import type {
  AssetSummary,
  ComponentStatus,
  ComponentType,
  CraneAsset,
  CraneComponent,
} from './types';

// 실제 크레인 2기 (HPSI BOM 기준):
// - HPSI 660T Goliath Crane (BOM 256개 품목, 2026-05-08 기준)
// - HPSI 50T East Luffing Crane (BOM 237개 품목, 2026-05-26 기준)
// 정격 외 상세 치수/일자 일부는 임시값(placeholder)이다.
const allCraneAssets: CraneAsset[] = [
  {
    id: 'crane-660t',
    name: '660T Goliath Crane',
    craneType: 'goliath',
    manufacturer: 'HPSI',
    model: 'HPSI 660T Goliath',
    capacityTon: 660,
    spanM: 105,
    liftHeightM: 76,
    serialNumber: 'HPSI-660T-GC-001',
    manufactureDate: '2023-11-20',
    installationDate: '2024-08-15',
    warrantyStart: '2024-08-15',
    warrantyEnd: '2029-08-15',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    locationZone: 'Dock No.4 Goliath Rail',
    indoorOutdoor: 'outdoor',
    status: 'operating',
    oshaClassification: 'Overhead and Gantry',
  },
  {
    id: 'crane-50t',
    name: '50T East Luffing Crane',
    craneType: 'luffing',
    manufacturer: 'HPSI',
    model: 'HPSI 50T East Luffing',
    capacityTon: 50,
    liftHeightM: 55,
    serialNumber: 'HPSI-50T-LC-001',
    manufactureDate: '2024-09-10',
    installationDate: '2025-05-20',
    warrantyStart: '2025-05-20',
    warrantyEnd: '2030-05-20',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    locationZone: 'East Quay',
    indoorOutdoor: 'outdoor',
    status: 'repair',
    oshaClassification: 'Overhead and Gantry',
  },
];

// BOM 21개 클러스터를 크레인 컴포넌트(1차 계층)로 사용한다.
// mech-drive(기계 구동계)는 660T BOM에만 존재한다 — 50T는 기계부 별도 BOM 관리 추정.
interface BomClusterSpec {
  key: string;
  name: string;
  type: ComponentType;
  manufacturer: string;
  lifeHours: number;
}

const BOM_CLUSTERS: BomClusterSpec[] = [
  { key: 'power-dist', name: 'Power Distribution & Protection (CB/Isolator)', type: 'electrical', manufacturer: 'EATON / ABB / SCHNEIDER', lifeHours: 80000 },
  { key: 'motor-starter', name: 'Motor Starter / Contactor', type: 'electrical', manufacturer: 'SCHNEIDER / EATON / ABB', lifeHours: 50000 },
  { key: 'pilot-device', name: 'Pushbutton / Pilot Device (Panel)', type: 'control', manufacturer: 'SCHNEIDER / KOINO / Q-LIGHT', lifeHours: 60000 },
  { key: 'network', name: 'Network & Communication', type: 'control', manufacturer: 'MOXA / SIEMENS / LAPP', lifeHours: 70000 },
  { key: 'fuse', name: 'Fuse Protection', type: 'electrical', manufacturer: 'BUSSMANN', lifeHours: 40000 },
  { key: 'plc', name: 'PLC / Controller Hardware (S7-1500)', type: 'control', manufacturer: 'SIEMENS', lifeHours: 100000 },
  { key: 'sensing', name: 'Position / Load Sensing', type: 'safety', manufacturer: 'SICK / POSITAL / IGUS', lifeHours: 60000 },
  { key: 'dcm-drive', name: 'Motor Drive (SINAMICS DCM)', type: 'electrical', manufacturer: 'SIEMENS', lifeHours: 80000 },
  { key: 'wiring', name: 'Wiring Accessories', type: 'electrical', manufacturer: 'WAGO / MURR / MOLEX', lifeHours: 100000 },
  { key: 'power-supply', name: 'Power Supply / UPS', type: 'electrical', manufacturer: 'PHOENIX CONTACT / WAGO / EATON', lifeHours: 40000 },
  { key: 'instrument', name: 'Instrumentation / Relay', type: 'electrical', manufacturer: 'AUTONICS / BAUMER / FINDER', lifeHours: 60000 },
  { key: 'computing', name: 'Computing / Display', type: 'control', manufacturer: 'BENECOM / HANWHA VISION / DELL', lifeHours: 50000 },
  { key: 'mech-drive', name: 'Mechanical Drive Train', type: 'travel', manufacturer: 'SICME / JEIL EPS / SIBRE', lifeHours: 40000 },
  { key: 'enclosure', name: 'Enclosure Climate / Panel', type: 'structure', manufacturer: 'RITTAL / HOFFMAN / RUN ELECTRIC', lifeHours: 30000 },
  { key: 'operator', name: 'Operator Control (HMI/Joystick)', type: 'control', manufacturer: 'SPOHN & BURKHARDT / EASYVIEW / ADVANTECH', lifeHours: 40000 },
  { key: 'transformer', name: 'Transformer', type: 'electrical', manufacturer: 'WOONYOUNG / SCHNEIDER', lifeHours: 120000 },
  { key: 'current-sensing', name: 'Current Sensing (CT)', type: 'electrical', manufacturer: 'WAGO / SCHNEIDER', lifeHours: 80000 },
  { key: 'resistor', name: 'Resistor (Drive Circuit)', type: 'electrical', manufacturer: 'HANMI TECHWIN / RARA ELECTRIC', lifeHours: 60000 },
  { key: 'warning', name: 'Safety / Warning Device', type: 'safety', manufacturer: 'FEDERAL SIGNAL / KEM', lifeHours: 50000 },
  { key: 'cctv', name: 'CCTV / Vision', type: 'safety', manufacturer: 'HANWHA VISION', lifeHours: 45000 },
  { key: 'surge', name: 'Surge Protection (SPD)', type: 'electrical', manufacturer: 'WEIDMULLER', lifeHours: 40000 },
];

function buildBomClusterComponents(options: {
  craneId: string;
  installDate: string;
  currentHours: number;
  lastInspectionDate: string;
  nextInspectionDate: string;
  exclude?: string[];
  statusOverrides?: Partial<Record<string, ComponentStatus>>;
  /** 클러스터별 사용 수명 % 오버라이드 — currentHours를 lifeHours 비율로 재산출 (Condition 뷰 편차용) */
  usedPctOverrides?: Partial<Record<string, number>>;
}): CraneComponent[] {
  const {
    craneId,
    installDate,
    currentHours,
    lastInspectionDate,
    nextInspectionDate,
    exclude = [],
    statusOverrides = {},
    usedPctOverrides = {},
  } = options;
  return BOM_CLUSTERS.filter((cluster) => !exclude.includes(cluster.key)).map(
    (cluster) => {
      const usedPct = usedPctOverrides[cluster.key];
      return {
        id: `comp-${craneId}-${cluster.key}`,
        parentId: null,
        craneId,
        componentName: cluster.name,
        componentType: cluster.type,
        manufacturer: cluster.manufacturer,
        installDate,
        expectedLifeHours: cluster.lifeHours,
        currentHours:
          usedPct != null ? Math.round((cluster.lifeHours * usedPct) / 100) : currentHours,
        status: statusOverrides[cluster.key] ?? 'normal',
        lastInspectionDate,
        nextInspectionDate,
      };
    },
  );
}

const CLUSTER_SPEC_BY_KEY = new Map(BOM_CLUSTERS.map((c) => [c.key, c]));

// BOM 카탈로그의 개별 품목을 클러스터 컴포넌트의 자식으로 생성한다.
function buildBomPartComponents(options: {
  craneId: string;
  flagKey: 'in660T' | 'in50T';
  installDate: string;
  currentHours: number;
  lastInspectionDate: string;
  nextInspectionDate: string;
  statusOverrides?: Partial<Record<string, ComponentStatus>>;
}): CraneComponent[] {
  const {
    craneId,
    flagKey,
    installDate,
    currentHours,
    lastInspectionDate,
    nextInspectionDate,
    statusOverrides = {},
  } = options;
  return bomCatalog
    .filter((item) => item[flagKey])
    .map((item) => {
      const cluster = CLUSTER_SPEC_BY_KEY.get(item.clusterKey);
      return {
        id: `comp-${craneId}-part-${item.partId}`,
        parentId: `comp-${craneId}-${item.clusterKey}`,
        craneId,
        componentName: item.description,
        componentType: cluster?.type ?? 'electrical',
        partNumber: item.partNumber,
        manufacturer: item.manufacturer,
        installDate,
        expectedLifeHours: cluster?.lifeHours ?? 60000,
        currentHours,
        status: statusOverrides[item.partId] ?? 'normal',
        lastInspectionDate,
        nextInspectionDate,
      };
    });
}

const allComponents: CraneComponent[] = [
  // 660T Goliath — 21개 클러스터 전체 (기계 구동계 포함)
  ...buildBomClusterComponents({
    craneId: 'crane-660t',
    installDate: '2024-08-15',
    currentHours: 8200,
    lastInspectionDate: '2026-07-01',
    nextInspectionDate: '2026-08-01',
    statusOverrides: {
      'dcm-drive': 'warning', // 권상 DCM 냉각팬 이상음 (RPR-2026-0001 진행 중)
      fuse: 'caution',
      enclosure: 'caution', // 판넬 필터 오염
    },
    // statusOverrides 스토리와 정렬된 소모율 편차 — dcm-drive가 최악 유지
    usedPctOverrides: {
      'dcm-drive': 78,
      fuse: 71,
      enclosure: 74,
      'mech-drive': 52,
      'power-supply': 44,
    },
  }),
  // 50T East Luffing — 기계 구동계 제외 20개 클러스터
  ...buildBomClusterComponents({
    craneId: 'crane-50t',
    installDate: '2025-05-20',
    currentHours: 3600,
    lastInspectionDate: '2026-06-25',
    nextInspectionDate: '2026-07-25',
    exclude: ['mech-drive'],
    statusOverrides: {
      plc: 'caution', // PLC CPU 교체 후 재검사 대기 (RPR-2026-0004)
      operator: 'caution', // 조이스틱 드리프트 수리 중 (RPR-2026-0003)
    },
    usedPctOverrides: {
      plc: 72,
      operator: 70,
      'power-supply': 38,
    },
  }),
  // 660T Goliath — BOM 개별 품목 (256개)
  ...buildBomPartComponents({
    craneId: 'crane-660t',
    flagKey: 'in660T',
    installDate: '2024-08-15',
    currentHours: 8200,
    lastInspectionDate: '2026-07-01',
    nextInspectionDate: '2026-08-01',
    statusOverrides: {
      '6ra8091-6fv62-0aa0-z': 'warning', // 권상 DCM 냉각팬 이상음 (RPR-2026-0001)
      'np225-kl5-cnv-b3': 'critical', // 주행 모터 과열 (RPR-2026-0002)
      hf1016414: 'caution', // 판넬 팬/필터 오염
    },
  }),
  // 50T East Luffing — BOM 개별 품목 (237개)
  ...buildBomPartComponents({
    craneId: 'crane-50t',
    flagKey: 'in50T',
    installDate: '2025-05-20',
    currentHours: 3600,
    lastInspectionDate: '2026-06-25',
    nextInspectionDate: '2026-07-25',
    statusOverrides: {
      '6es7516-3ap03-0ab0': 'caution', // PLC CPU 교체 후 재검사 대기 (RPR-2026-0004)
      'vnso-44-earipz': 'caution', // 조이스틱 드리프트 (RPR-2026-0003)
      '6ra8082-6fv62-0aa0-z': 'warning', // 기복 DCM 고장 알람 (RPR-2026-0006)
    },
  }),
];

export function getAllCraneAssets(): CraneAsset[] {
  return allCraneAssets;
}

export function addCraneAsset(asset: CraneAsset): void {
  allCraneAssets.unshift(asset);
}

export function getCraneAssetsBySite(siteId: string): CraneAsset[] {
  return allCraneAssets.filter((c) => c.siteId === siteId);
}

export function getCraneAssetById(id: string): CraneAsset | undefined {
  return allCraneAssets.find((c) => c.id === id);
}

export function getComponentsByCraneId(craneId: string): CraneComponent[] {
  return allComponents.filter((c) => c.craneId === craneId);
}

export function getAssetSummary(): AssetSummary {
  return {
    total: allCraneAssets.length,
    operating: allCraneAssets.filter((c) => c.status === 'operating').length,
    inspection: allCraneAssets.filter((c) => c.status === 'inspection').length,
    repair: allCraneAssets.filter((c) => c.status === 'repair').length,
    idle: allCraneAssets.filter((c) => c.status === 'idle').length,
  };
}
