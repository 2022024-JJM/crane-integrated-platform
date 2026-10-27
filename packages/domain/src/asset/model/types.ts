export type CraneType =
  | 'goliath'
  | 'overhead'
  | 'jib'
  | 'gantry'
  | 'llc'
  | 'ttc'
  | 'luffing';

export type AssetStatus =
  | 'operating'
  | 'inspection'
  | 'repair'
  | 'idle'
  | 'decommissioned';

export type ComponentType =
  | 'travel'
  | 'hoist'
  | 'traverse'
  | 'structure'
  | 'electrical'
  | 'safety'
  | 'control';

export type ComponentStatus =
  | 'normal'
  | 'caution'
  | 'warning'
  | 'critical'
  | 'replace';

export interface CraneAsset {
  id: string;
  name: string;
  craneType: CraneType;
  manufacturer: string;
  model: string;
  capacityTon: number;
  spanM?: number;
  liftHeightM?: number;
  serialNumber: string;
  manufactureDate: string;
  installationDate: string;
  warrantyStart: string;
  warrantyEnd: string;
  siteId: string;
  siteName: string;
  locationZone: string;
  indoorOutdoor: 'indoor' | 'outdoor';
  status: AssetStatus;
  oshaClassification: string;
  /** 정기 점검 주기 — 비어 있으면 정기 점검을 자동으로 잡지 않는다 */
  inspectionInterval?: InspectionInterval | null;
}

/** 점검 슬라이스의 RecurrenceInterval 과 같은 값 — 레이어 규칙상 여기서 따로 둔다 */
export type InspectionInterval =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly';

export interface CraneComponent {
  id: string;
  parentId: string | null;
  craneId: string;
  componentName: string;
  componentType: ComponentType;
  partNumber?: string;
  manufacturer?: string;
  installDate: string;
  expectedLifeHours: number;
  currentHours: number;
  status: ComponentStatus;
  lastInspectionDate: string;
  nextInspectionDate: string;
}

export interface AssetSummary {
  total: number;
  operating: number;
  inspection: number;
  repair: number;
  idle: number;
}
