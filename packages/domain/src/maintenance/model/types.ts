export type RepairSource =
  | 'inspection'
  | 'breakdown'
  | 'predictive'
  | 'preventive';

export type FailureType =
  | 'mechanical'
  | 'electrical'
  | 'structural'
  | 'control'
  | 'other';

export type RepairLevel = 'minor' | 'major' | 'overhaul';

export type RepairStatus =
  | 'received'
  | 'waiting_parts'
  | 'in_progress'
  | 're_inspection'
  | 'completed'
  | 'on_hold';

export type RepairPriority = 'emergency' | 'high' | 'normal' | 'low';

export interface PartUsed {
  partId: string;
  partName: string;
  qty: number;
  unitCost: number;
}

export interface RepairWO {
  id: string;
  woNumber: string;
  sourceType: RepairSource;
  sourceWoNumber?: string;
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  componentName: string;
  componentName_ko?: string;
  failureType: FailureType;
  failureDescription: string;
  failureDescription_ko?: string;
  repairLevel: RepairLevel;
  performerType: 'internal' | 'third_party' | 'local';
  assignedTo: string;
  status: RepairStatus;
  priority: RepairPriority;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  downtimeHours: number | null;
  partsUsed: PartUsed[];
  laborHours: number | null;
  laborCost: number | null;
  partsCost: number | null;
  totalCost: number | null;
  rootCause?: string;
  rootCause_ko?: string;
  correctiveAction?: string;
  correctiveAction_ko?: string;
  preventiveAction?: string;
  preventiveAction_ko?: string;
  reInspectionResult?: 'pass' | 'fail' | null;
}

export interface MaintenanceSummary {
  inProgress: number;
  waitingParts: number;
  emergency: number;
  avgMttrHours: number;
  avgMtbfDays: number;
}
