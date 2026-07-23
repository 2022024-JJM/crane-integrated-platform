import { seedSequence } from '../../shared/id-generator';
import type { ChecklistItem, InspectionSummary, InspectionWO } from './types';

const frequentChecklist = [
  { id: 'fi-01', category: 'Fluid & Equipment', category_ko: '유체 및 설비', itemName: 'Oil Leak Check', itemName_ko: '오일 누유 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-02', category: 'Fluid & Equipment', category_ko: '유체 및 설비', itemName: 'Sensor Condition', itemName_ko: '센서 상태 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-03', category: 'Fluid & Equipment', category_ko: '유체 및 설비', itemName: 'Piping Condition', itemName_ko: '배관 상태 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-04', category: 'Key Components', category_ko: '주요 구성품', itemName: 'Shaft & Chain Condition', itemName_ko: '샤프트 및 체인 상태', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-05', category: 'Key Components', category_ko: '주요 구성품', itemName: 'Wire Rope Condition', itemName_ko: '와이어 로프 상태', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-06', category: 'Safety Devices', category_ko: '안전 장치', itemName: 'Brake Operation', itemName_ko: '브레이크 작동 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-07', category: 'Safety Devices', category_ko: '안전 장치', itemName: 'Limit Switch Operation', itemName_ko: '리밋 스위치 작동 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-08', category: 'Safety Devices', category_ko: '안전 장치', itemName: 'E-Stop Function', itemName_ko: '비상 정지 기능 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-09', category: 'Electrical', category_ko: '전기', itemName: 'Controller Check', itemName_ko: '제어기 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-10', category: 'Electrical', category_ko: '전기', itemName: 'Panel Inspection', itemName_ko: '패널 점검', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-11', category: 'Dynamic Check', category_ko: '동적 점검', itemName: 'No-Load Test Run', itemName_ko: '무부하 시운전', judgment: null, actionRequired: 'none' as const },
  { id: 'fi-12', category: 'Dynamic Check', category_ko: '동적 점검', itemName: 'Loaded Test Run', itemName_ko: '부하 시운전', judgment: null, actionRequired: 'none' as const },
];

const baseInspectionWOs: InspectionWO[] = [
  {
    id: 'insp-001',
    woNumber: 'INS-2026-0001',
    woType: 'frequent',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-07-01',
    actualDate: '2026-07-01',
    assignedTo: '조범희',
    performerType: 'internal',
    status: 'completed',
    priority: 'normal',
    result: 'pass',
    findings:
      'All items checked. Abnormal noise from hoist SINAMICS DCM cooling fan — repair WO issued.',
    findings_ko:
      '전 항목 점검 완료. 권상용 SINAMICS DCM 냉각팬 이상음 확인 — 수리 작업지시서 발행.',
    totalHours: 3.0,
    cost: 380,
    checklistItems: frequentChecklist.map((item, i) => ({
      ...item,
      judgment: i === 8 ? 'fail' : 'pass',
      severity: i === 8 ? 'minor' : 'normal',
      comment:
        i === 8
          ? 'SINAMICS DCM (hoist) cooling fan abnormal noise — replacement recommended'
          : undefined,
      actionRequired: i === 8 ? 'repair_needed' : 'none',
    })),
  },
  {
    id: 'insp-002',
    woNumber: 'INS-2026-0002',
    woType: 'frequent',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-07-03',
    actualDate: null,
    assignedTo: '정종민',
    performerType: 'internal',
    status: 'in_progress',
    priority: 'normal',
    result: null,
    checklistItems: frequentChecklist.map((item, i) => ({
      ...item,
      judgment: i < 6 ? 'pass' : null,
    })),
  },
  {
    id: 'insp-003',
    woNumber: 'INS-2026-0003',
    woType: 'periodic',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-06-20',
    actualDate: null,
    assignedTo: 'M&S Corp.',
    performerType: 'third_party',
    status: 'overdue',
    priority: 'high',
    result: null,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: null })),
  },
  {
    id: 'insp-004',
    woNumber: 'INS-2026-0004',
    woType: 'frequent',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-06-25',
    actualDate: '2026-06-25',
    assignedTo: '박순영',
    performerType: 'internal',
    status: 'completed',
    priority: 'normal',
    result: 'pass',
    findings: 'Normal condition. All safety devices operational.',
    findings_ko: '정상 상태. 모든 안전 장치 정상 작동.',
    totalHours: 2.0,
    cost: 260,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: 'pass' })),
  },
  {
    id: 'insp-005',
    woNumber: 'INS-2026-0005',
    woType: 'frequent',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-05-28',
    actualDate: '2026-05-28',
    assignedTo: '이태훈',
    performerType: 'internal',
    status: 'completed',
    priority: 'normal',
    result: 'pass',
    findings: 'Normal condition. Panel filter contamination noted — monitor.',
    findings_ko: '정상 상태. 판넬 필터 오염 확인 — 관찰 필요.',
    totalHours: 2.5,
    cost: 320,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: 'pass' })),
  },
  {
    id: 'insp-006',
    woNumber: 'INS-2026-0006',
    woType: 'periodic',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-07-15',
    actualDate: null,
    assignedTo: 'M&S Corp.',
    performerType: 'third_party',
    status: 'scheduled',
    priority: 'normal',
    result: null,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: null })),
  },
  {
    id: 'insp-007',
    woNumber: 'INS-2026-0007',
    woType: 'frequent',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    scheduledDate: '2026-07-10',
    actualDate: null,
    assignedTo: '조범희',
    performerType: 'internal',
    status: 'scheduled',
    priority: 'normal',
    result: null,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: null })),
  },
];

const CRANE_POOL: Array<{ craneId: string; craneName: string; siteId: string; siteName: string }> = [
  { craneId: 'crane-660t', craneName: '660T Goliath Crane', siteId: 'dock-4', siteName: 'Dock No.4' },
  { craneId: 'crane-50t', craneName: '50T East Luffing Crane', siteId: 'dock-4', siteName: 'Dock No.4' },
];

const INSPECTOR_POOL = ['조범희', '박순영', '정종민', 'John Smith', 'Maria Garcia', 'David Chen', '이준호', 'Priya Sharma'];
const WO_TYPES: InspectionWO['woType'][] = ['frequent', 'frequent', 'frequent', 'periodic', 'periodic', 'emergency', 'special'];
const STATUS_POOL: InspectionWO['status'][] = ['scheduled', 'scheduled', 'in_progress', 'completed', 'completed', 'completed', 'overdue'];
const PRIORITY_POOL: InspectionWO['priority'][] = ['normal', 'normal', 'normal', 'high', 'urgent', 'low'];
const PERFORMER_POOL: InspectionWO['performerType'][] = ['internal', 'internal', 'third_party', 'local'];

function seededRandom(seed: number) {
  let v = seed;
  return () => {
    v = (v * 1664525 + 1013904223) % 4294967296;
    return v / 4294967296;
  };
}

const ispRand = seededRandom(2026);
const pick = <T,>(arr: T[]): T => arr[Math.floor(ispRand() * arr.length)];

function randDate(startMonth: number, endMonth: number): string {
  const month = startMonth + Math.floor(ispRand() * (endMonth - startMonth + 1));
  const day = Math.floor(ispRand() * 28) + 1;
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const generatedInspectionWOs: InspectionWO[] = Array.from({ length: 19 }, (_, i) => {
  const n = i + 8;
  const crane = pick(CRANE_POOL);
  const woType = pick(WO_TYPES);
  const status = pick(STATUS_POOL);
  const priority = pick(PRIORITY_POOL);
  // 완료/기한초과는 과거(4~6월), 예정은 미래(7~8월), 진행 중은 최근(6~7월)으로 앵커링
  const scheduledDate =
    status === 'overdue' || status === 'completed'
      ? randDate(4, 6)
      : status === 'in_progress'
        ? randDate(6, 7)
        : randDate(7, 8);
  const actualDate = status === 'completed' ? scheduledDate : null;
  let result: InspectionWO['result'] = null;
  if (status === 'completed') {
    const r = ispRand();
    result = r < 0.7 ? 'pass' : r < 0.9 ? 'conditional' : 'fail';
  }
  const checklistItems = frequentChecklist.map((item, idx) => {
    if (status === 'completed') {
      const judgment = result === 'fail' && idx % 4 === 0
        ? 'fail'
        : result === 'conditional' && idx === 5
          ? 'fail'
          : 'pass';
      return {
        ...item,
        judgment: judgment as 'pass' | 'fail',
        severity: (judgment === 'fail' ? 'minor' : 'normal') as 'minor' | 'normal',
        actionRequired: (judgment === 'fail' ? 'repair_needed' : 'none') as 'repair_needed' | 'none',
      };
    }
    if (status === 'in_progress') {
      return { ...item, judgment: idx < 4 ? ('pass' as const) : null };
    }
    return { ...item, judgment: null };
  });

  return {
    id: `insp-${String(n).padStart(3, '0')}`,
    woNumber: `INS-2026-${String(n).padStart(4, '0')}`,
    woType,
    craneId: crane.craneId,
    craneName: crane.craneName,
    siteId: crane.siteId,
    siteName: crane.siteName,
    scheduledDate,
    actualDate,
    assignedTo: pick(INSPECTOR_POOL),
    performerType: pick(PERFORMER_POOL),
    status,
    priority,
    result,
    findings: result === 'fail' ? 'Critical issue detected during inspection.' : undefined,
    findings_ko: result === 'fail' ? '점검 중 주요 이슈 발견.' : undefined,
    totalHours: status === 'completed' ? Math.round(ispRand() * 40 + 10) / 10 : undefined,
    cost: status === 'completed' ? Math.floor(ispRand() * 500) + 200 : undefined,
    checklistItems,
  };
});

const allInspectionWOs: InspectionWO[] = [...baseInspectionWOs, ...generatedInspectionWOs];

const maxInspectionSeq = allInspectionWOs.reduce((max, wo) => {
  const m = wo.woNumber.match(/-(\d{4})$/);
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);
seedSequence('inspection', maxInspectionSeq);

export function getAllInspectionWOs(): InspectionWO[] {
  return allInspectionWOs;
}

export function addInspectionWO(wo: InspectionWO): void {
  allInspectionWOs.unshift(wo);
}

export interface ChecklistItemPatch {
  id: string;
  judgment: ChecklistItem['judgment'];
  comment?: string;
  actionRequired: ChecklistItem['actionRequired'];
}

export function updateChecklistItems(
  inspectionId: string,
  patches: ChecklistItemPatch[],
): boolean {
  const idx = allInspectionWOs.findIndex((w) => w.id === inspectionId);
  if (idx === -1) return false;
  const wo = allInspectionWOs[idx];
  const byId = new Map(patches.map((p) => [p.id, p]));
  allInspectionWOs[idx] = {
    ...wo,
    checklistItems: wo.checklistItems.map((item) => {
      const patch = byId.get(item.id);
      if (!patch) return item;
      return {
        ...item,
        judgment: patch.judgment,
        comment: patch.comment,
        actionRequired: patch.actionRequired,
      };
    }),
  };
  return true;
}

export function submitInspectionResult(inspectionId: string): boolean {
  const idx = allInspectionWOs.findIndex((w) => w.id === inspectionId);
  if (idx === -1) return false;
  const wo = allInspectionWOs[idx];
  const judgments = wo.checklistItems.map((i) => i.judgment);
  const anyFail = judgments.includes('fail');
  const anyPending = judgments.includes(null);
  const result: InspectionWO['result'] = anyPending
    ? 'conditional'
    : anyFail
      ? 'fail'
      : 'pass';
  allInspectionWOs[idx] = {
    ...wo,
    status: 'completed',
    result,
    actualDate: new Date().toISOString().slice(0, 10),
  };
  return true;
}

/**
 * 점검 예정일 변경 (캘린더 드래그 재조정).
 * 완료/취소 WO는 변경 불가. scheduled↔overdue는 새 날짜 기준으로 재계산한다.
 */
export function updateInspectionSchedule(id: string, scheduledDate: string): boolean {
  const idx = allInspectionWOs.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  const wo = allInspectionWOs[idx];
  if (wo.status === 'completed' || wo.status === 'cancelled') return false;

  let status = wo.status;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (status === 'overdue' && scheduledDate >= today) status = 'scheduled';
  else if (status === 'scheduled' && scheduledDate < today) status = 'overdue';

  allInspectionWOs[idx] = { ...wo, scheduledDate, status };
  return true;
}

export function getDefaultChecklist(woType: 'frequent' | 'periodic' | 'emergency' | 'special') {
  void woType;
  return frequentChecklist.map((item) => ({ ...item, judgment: null as null }));
}

export function getInspectionWOById(id: string): InspectionWO | undefined {
  return allInspectionWOs.find((w) => w.id === id);
}

export function getInspectionSummary(): InspectionSummary {
  const total = allInspectionWOs.length;
  const completed = allInspectionWOs.filter((w) => w.status === 'completed').length;
  const overdue = allInspectionWOs.filter((w) => w.status === 'overdue').length;
  const failed = allInspectionWOs.filter((w) => w.result === 'fail').length;
  return {
    totalScheduled: total,
    completed,
    overdue,
    failed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
