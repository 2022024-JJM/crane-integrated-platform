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

export type ComponentStatus = 'normal' | 'caution' | 'warning' | 'critical' | 'replace';

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
}

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
