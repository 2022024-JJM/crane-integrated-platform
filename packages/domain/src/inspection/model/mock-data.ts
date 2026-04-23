import { seedSequence } from '../../shared/id-generator';
import type { InspectionSummary, InspectionWO } from './types';

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
    craneId: 'crane-101',
    craneName: 'GC-101',
    siteId: 'dock-1',
    siteName: 'Dock No.1',
    scheduledDate: '2026-04-14',
    actualDate: '2026-04-14',
    assignedTo: '조범희',
    performerType: 'internal',
    status: 'completed',
    priority: 'normal',
    result: 'pass',
    findings: 'All items checked. Minor wear on hoist brake observed.',
    findings_ko: '전 항목 점검 완료. 호이스트 브레이크 경미한 마모 확인.',
    totalHours: 2.5,
    cost: 320,
    checklistItems: frequentChecklist.map((item, i) => ({
      ...item,
      judgment: i === 5 ? 'fail' : 'pass',
      severity: i === 5 ? 'minor' : 'normal',
      comment: i === 5 ? 'Brake pad worn to 60% — schedule replacement within 30 days' : undefined,
      actionRequired: i === 5 ? 'repair_needed' : 'none',
    })),
  },
  {
    id: 'insp-002',
    woNumber: 'INS-2026-0002',
    woType: 'frequent',
    craneId: 'crane-102',
    craneName: 'GC-102',
    siteId: 'dock-1',
    siteName: 'Dock No.1',
    scheduledDate: '2026-04-14',
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
    craneId: 'crane-103',
    craneName: 'GC-103',
    siteId: 'dock-1',
    siteName: 'Dock No.1',
    scheduledDate: '2026-04-10',
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
    craneId: 'crane-201',
    craneName: 'QC-201',
    siteId: 'dock-2',
    siteName: 'Dock No.2',
    scheduledDate: '2026-04-13',
    actualDate: '2026-04-13',
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
    craneId: 'crane-205',
    craneName: 'QC-205',
    siteId: 'dock-2',
    siteName: 'Dock No.2',
    scheduledDate: '2026-04-15',
    actualDate: null,
    assignedTo: '이태훈',
    performerType: 'internal',
    status: 'scheduled',
    priority: 'normal',
    result: null,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: null })),
  },
  {
    id: 'insp-006',
    woNumber: 'INS-2026-0006',
    woType: 'frequent',
    craneId: 'crane-301',
    craneName: 'BC-301',
    siteId: 'dock-in',
    siteName: 'Block Shop',
    scheduledDate: '2026-04-12',
    actualDate: '2026-04-12',
    assignedTo: '조범희',
    performerType: 'internal',
    status: 'completed',
    priority: 'normal',
    result: 'conditional',
    findings: 'Minor oil leak detected near reducer. Travel motor shows slight vibration increase.',
    findings_ko: '감속기 근처 경미한 오일 누유 발견. 주행 모터 진동 소폭 증가.',
    totalHours: 3.0,
    cost: 380,
    checklistItems: frequentChecklist.map((item, i) => ({
      ...item,
      judgment: i === 0 || i === 3 ? 'fail' : 'pass',
      severity: i === 0 ? 'minor' : i === 3 ? 'major' : 'normal',
      comment: i === 0 ? 'Oil leak at reducer seal' : i === 3 ? 'Vibration level above threshold' : undefined,
      actionRequired: i === 0 ? 'repair_needed' : i === 3 ? 'monitor' : 'none',
    })),
  },
  {
    id: 'insp-007',
    woNumber: 'INS-2026-0007',
    woType: 'frequent',
    craneId: 'crane-104',
    craneName: 'GC-104',
    siteId: 'dock-1',
    siteName: 'Dock No.1',
    scheduledDate: '2026-04-08',
    actualDate: null,
    assignedTo: '조범희',
    performerType: 'internal',
    status: 'overdue',
    priority: 'urgent',
    result: null,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: null })),
  },
  {
    id: 'insp-008',
    woNumber: 'INS-2026-0008',
    woType: 'frequent',
    craneId: 'crane-202',
    craneName: 'QC-202',
    siteId: 'dock-2',
    siteName: 'Dock No.2',
    scheduledDate: '2026-04-16',
    actualDate: null,
    assignedTo: '박순영',
    performerType: 'internal',
    status: 'scheduled',
    priority: 'normal',
    result: null,
    checklistItems: frequentChecklist.map((item) => ({ ...item, judgment: null })),
  },
];

const CRANE_POOL: Array<{ craneId: string; craneName: string; siteId: string; siteName: string }> = [
  { craneId: 'crane-101', craneName: 'GC-101', siteId: 'dock-1', siteName: 'Dock No.1' },
  { craneId: 'crane-102', craneName: 'GC-102', siteId: 'dock-1', siteName: 'Dock No.1' },
  { craneId: 'crane-103', craneName: 'GC-103', siteId: 'dock-1', siteName: 'Dock No.1' },
  { craneId: 'crane-104', craneName: 'GC-104', siteId: 'dock-1', siteName: 'Dock No.1' },
  { craneId: 'crane-201', craneName: 'QC-201', siteId: 'dock-2', siteName: 'Dock No.2' },
  { craneId: 'crane-202', craneName: 'QC-202', siteId: 'dock-2', siteName: 'Dock No.2' },
  { craneId: 'crane-203', craneName: 'QC-203', siteId: 'dock-2', siteName: 'Dock No.2' },
  { craneId: 'crane-204', craneName: 'QC-204', siteId: 'dock-2', siteName: 'Dock No.2' },
  { craneId: 'crane-205', craneName: 'QC-205', siteId: 'dock-2', siteName: 'Dock No.2' },
  { craneId: 'crane-301', craneName: 'BC-301', siteId: 'dock-in', siteName: 'Block Shop' },
  { craneId: 'crane-302', craneName: 'BC-302', siteId: 'dock-in', siteName: 'Block Shop' },
  { craneId: 'crane-303', craneName: 'BC-303', siteId: 'dock-in', siteName: 'Block Shop' },
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

const generatedInspectionWOs: InspectionWO[] = Array.from({ length: 60 }, (_, i) => {
  const n = i + 9;
  const crane = pick(CRANE_POOL);
  const woType = pick(WO_TYPES);
  const status = pick(STATUS_POOL);
  const priority = pick(PRIORITY_POOL);
  const scheduledDate = status === 'overdue' ? randDate(1, 3) : randDate(3, 6);
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
