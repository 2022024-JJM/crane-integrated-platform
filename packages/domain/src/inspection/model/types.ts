export type InspectionType = 'frequent' | 'periodic' | 'emergency' | 'special';

export type InspectionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export type InspectionResult = 'pass' | 'fail' | 'conditional' | null;

export type PerformerType = 'internal' | 'third_party' | 'local';

export type ChecklistJudgment = 'pass' | 'fail' | 'na';

/** 반복 점검 주기 — 완료 시 다음 회차 WO가 자동 생성된다. */
export type RecurrenceInterval = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export type ActionRequired =
  | 'none'
  | 'monitor'
  | 'repair_needed'
  | 'immediate_replace'
  | 'stop_operation';

export interface ChecklistItem {
  id: string;
  category: string;
  category_ko?: string;
  itemName: string;
  itemName_ko?: string;
  judgment: ChecklistJudgment | null;
  measurementValue?: number;
  measurementUnit?: string;
  severity?: 'normal' | 'minor' | 'major' | 'critical';
  comment?: string;
  photoUrl?: string;
  actionRequired: ActionRequired;
}

export interface InspectionWO {
  id: string;
  woNumber: string;
  woType: InspectionType;
  craneId: string;
  craneName: string;
  siteId: string;
  siteName: string;
  scheduledDate: string;
  actualDate: string | null;
  assignedTo: string;
  performerType: PerformerType;
  status: InspectionStatus;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  result: InspectionResult;
  findings?: string;
  findings_ko?: string;
  totalHours?: number;
  cost?: number;
  checklistItems: ChecklistItem[];
  /** 반복 주기 — 없으면 단발성 점검 */
  recurrence?: RecurrenceInterval | null;
}

export interface InspectionSummary {
  totalScheduled: number;
  completed: number;
  overdue: number;
  failed: number;
  completionRate: number;
}
