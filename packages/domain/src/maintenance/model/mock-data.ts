import { seedSequence } from '../../shared/id-generator';
import type { MaintenanceSummary, RepairWO } from './types';

// 실제 크레인 2기(660T Goliath / 50T East Luffing) 기준 수리 WO.
// 부품명은 HPSI BOM 실품목(SINAMICS DCM, S7-1500, SICME 모터 등)을 참조한다.
const allRepairWOs: RepairWO[] = [
  {
    id: 'repair-001',
    woNumber: 'RPR-2026-0001',
    sourceType: 'inspection',
    sourceWoNumber: 'INS-2026-0001',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    componentName: 'SINAMICS DCM Drive (Hoist)',
    componentName_ko: '권상용 SINAMICS DCM 드라이브',
    failureType: 'electrical',
    failureDescription:
      'Abnormal noise from DCM cabinet cooling fan detected during frequent inspection. Fan bearing wear suspected.',
    failureDescription_ko:
      '수시 점검 중 DCM 판넬 냉각팬 이상음 확인. 팬 베어링 마모 추정.',
    repairLevel: 'minor',
    performerType: 'internal',
    assignedTo: '조범희',
    status: 'in_progress',
    priority: 'normal',
    scheduledStart: '2026-07-02T08:00:00',
    scheduledEnd: '2026-07-02T12:00:00',
    actualStart: '2026-07-02T08:30:00',
    actualEnd: null,
    downtimeHours: null,
    partsUsed: [
      { partId: 'hf1016414', partName: 'FAN / FILTER UNIT, AC 115VAC', qty: 1, unitCost: 350 },
    ],
    laborHours: null,
    laborCost: null,
    partsCost: 350,
    totalCost: null,
    rootCause: 'Cooling fan bearing wear after continuous operation',
    rootCause_ko: '연속 운전에 따른 냉각팬 베어링 마모',
    correctiveAction: 'Replace DCM cabinet fan/filter unit',
    correctiveAction_ko: 'DCM 판넬 팬/필터 유닛 교체',
    preventiveAction: 'Add fan noise/vibration check to frequent inspection checklist',
    preventiveAction_ko: '수시 점검 체크리스트에 팬 소음/진동 항목 추가',
  },
  {
    id: 'repair-002',
    woNumber: 'RPR-2026-0002',
    sourceType: 'breakdown',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    componentName: 'Travelling DC Motor (SICME NP225)',
    componentName_ko: '주행 DC 모터 (SICME NP225)',
    failureType: 'electrical',
    failureDescription:
      'Travelling motor overheating alarm triggered. Motor temperature reached 92°C. Crane stopped automatically.',
    failureDescription_ko:
      '주행 모터 과열 알람 발생. 모터 온도 92°C 도달. 크레인 자동 정지.',
    repairLevel: 'major',
    performerType: 'third_party',
    assignedTo: 'SICME Service',
    status: 'waiting_parts',
    priority: 'high',
    scheduledStart: '2026-07-05T08:00:00',
    scheduledEnd: '2026-07-08T17:00:00',
    actualStart: null,
    actualEnd: null,
    downtimeHours: 40,
    partsUsed: [],
    laborHours: null,
    laborCost: null,
    partsCost: null,
    totalCost: null,
    rootCause: 'Motor winding insulation degradation due to prolonged high-temperature operation',
    rootCause_ko: '장시간 고온 운전으로 인한 모터 권선 절연 열화',
    correctiveAction: 'Rewind motor winding / Full motor overhaul',
    correctiveAction_ko: '모터 권선 재권선 / 전체 모터 오버홀',
    preventiveAction: 'Trend motor temperature via DCM feedback, improve ventilation',
    preventiveAction_ko: 'DCM 피드백 기반 모터 온도 추이 관리, 환기 개선',
  },
  {
    id: 'repair-003',
    woNumber: 'RPR-2026-0003',
    sourceType: 'breakdown',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    componentName: 'Joystick Controller (VNSO 44)',
    componentName_ko: '조이스틱 컨트롤러 (VNSO 44)',
    failureType: 'control',
    failureDescription:
      'Operator reported joystick neutral-position drift on luffing axis. Intermittent creep command observed.',
    failureDescription_ko:
      '기복 축 조이스틱 중립 위치 드리프트 발생. 간헐적 미세 지령 확인.',
    repairLevel: 'minor',
    performerType: 'internal',
    assignedTo: '정종민',
    status: 'in_progress',
    priority: 'normal',
    scheduledStart: '2026-06-30T09:00:00',
    scheduledEnd: '2026-07-04T15:00:00',
    actualStart: '2026-06-30T09:15:00',
    actualEnd: null,
    downtimeHours: null,
    partsUsed: [
      {
        partId: 'vnso-44-earipz',
        partName: 'Joystick Controller VNSO 44 EARIPZ',
        qty: 1,
        unitCost: 2400,
      },
    ],
    laborHours: null,
    laborCost: null,
    partsCost: 2400,
    totalCost: null,
  },
  {
    id: 'repair-004',
    woNumber: 'RPR-2026-0004',
    sourceType: 'breakdown',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    componentName: 'PLC CPU Module (S7-1500)',
    componentName_ko: 'PLC CPU 모듈 (S7-1500)',
    failureType: 'control',
    failureDescription:
      'PLC communication error (CPU 1516-3 PN/DP). Crane non-operational. Emergency stop cannot be reset.',
    failureDescription_ko:
      'PLC 통신 오류 (CPU 1516-3 PN/DP). 크레인 운전 불가. 비상 정지 해제 불가.',
    repairLevel: 'major',
    performerType: 'third_party',
    assignedTo: 'Siemens Service',
    status: 're_inspection',
    priority: 'emergency',
    scheduledStart: '2026-06-27T06:00:00',
    scheduledEnd: '2026-06-28T18:00:00',
    actualStart: '2026-06-27T07:00:00',
    actualEnd: '2026-06-28T15:00:00',
    downtimeHours: 32,
    partsUsed: [
      {
        partId: '6es7516-3ap03-0ab0',
        partName: 'PLC CPU 1516-3 PN/DP (6ES7516-3AP03-0AB0)',
        qty: 1,
        unitCost: 3200,
      },
      {
        partId: '2170484',
        partName: 'PROFINET Cable CAT.6A (LAPP 2170484)',
        qty: 2,
        unitCost: 90,
      },
    ],
    laborHours: 12,
    laborCost: 2400,
    partsCost: 3380,
    totalCost: 5780,
    rootCause: 'PLC CPU module failure due to power surge',
    rootCause_ko: '전원 서지로 인한 PLC CPU 모듈 고장',
    correctiveAction: 'Replaced PLC CPU module and PROFINET cables',
    correctiveAction_ko: 'PLC CPU 모듈 및 PROFINET 케이블 교체',
    preventiveAction: 'Verify SPD (VPU AC II) wiring, schedule annual PLC diagnostics',
    preventiveAction_ko: '서지 보호기(VPU AC II) 결선 점검, 연간 PLC 진단 일정 수립',
    reInspectionResult: null,
  },
  {
    id: 'repair-005',
    woNumber: 'RPR-2026-0005',
    sourceType: 'preventive',
    craneId: 'crane-660t',
    craneName: '660T Goliath Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    componentName: 'UPS Battery (24VDC)',
    componentName_ko: 'UPS 배터리 (24VDC)',
    failureType: 'electrical',
    failureDescription:
      'UPS battery reached scheduled replacement interval. Preventive replacement of VRLA battery modules.',
    failureDescription_ko:
      'UPS 배터리 교체 주기 도달. VRLA 배터리 모듈 예방 교체 실시.',
    repairLevel: 'minor',
    performerType: 'internal',
    assignedTo: '박순영',
    status: 'completed',
    priority: 'normal',
    scheduledStart: '2026-06-18T08:00:00',
    scheduledEnd: '2026-06-18T12:00:00',
    actualStart: '2026-06-18T08:00:00',
    actualEnd: '2026-06-18T11:30:00',
    downtimeHours: 0,
    partsUsed: [
      {
        partId: 'ups-bat-vrla-24dc-3-4ah',
        partName: 'UPS Battery Module (UPS-BAT/VRLA/24DC/3.4AH)',
        qty: 2,
        unitCost: 425,
      },
    ],
    laborHours: 3.5,
    laborCost: 455,
    partsCost: 850,
    totalCost: 1305,
    rootCause: 'Scheduled preventive replacement',
    rootCause_ko: '계획된 예방 교체',
    correctiveAction: 'Replaced UPS battery modules per PM schedule',
    correctiveAction_ko: 'PM 일정에 따라 UPS 배터리 모듈 교체',
    preventiveAction: 'Next replacement scheduled in 4 years',
    preventiveAction_ko: '다음 교체: 4년 후',
    reInspectionResult: 'pass',
  },
  {
    id: 'repair-006',
    woNumber: 'RPR-2026-0006',
    sourceType: 'breakdown',
    craneId: 'crane-50t',
    craneName: '50T East Luffing Crane',
    siteId: 'dock-4',
    siteName: 'Dock No.4',
    componentName: 'SINAMICS DCM Drive (Luffing)',
    componentName_ko: '기복용 SINAMICS DCM 드라이브',
    failureType: 'electrical',
    failureDescription:
      'DCM drive fault alarm (6RA8082). Luffing function inoperative. Fault code: F60105.',
    failureDescription_ko:
      'DCM 드라이브 고장 알람 (6RA8082). 기복 기능 불가. 고장 코드: F60105.',
    repairLevel: 'major',
    performerType: 'third_party',
    assignedTo: 'Siemens Service',
    status: 'received',
    priority: 'high',
    scheduledStart: '2026-07-05T08:00:00',
    scheduledEnd: '2026-07-06T17:00:00',
    actualStart: null,
    actualEnd: null,
    downtimeHours: null,
    partsUsed: [],
    laborHours: null,
    laborCost: null,
    partsCost: null,
    totalCost: null,
  },
];

const maxRepairSeq = allRepairWOs.reduce((max, wo) => {
  const m = wo.woNumber.match(/-(\d{4})$/);
  return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 0);
seedSequence('repair', maxRepairSeq);

export function getAllRepairWOs(): RepairWO[] {
  return allRepairWOs;
}

export function getRepairWOById(id: string): RepairWO | undefined {
  return allRepairWOs.find((w) => w.id === id);
}

function localNow(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:00`;
}

export function updateRepairStatus(id: string, status: RepairWO['status']): boolean {
  const idx = allRepairWOs.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  const wo = allRepairWOs[idx];
  // 실적 타임스탬프 자동 기록 — 착수/완료 시점을 사용자가 따로 입력하지 않는다.
  const stamps: Partial<RepairWO> = {};
  if (status === 'in_progress' && !wo.actualStart) stamps.actualStart = localNow();
  if (status === 'completed') {
    stamps.actualEnd = localNow();
    if (!wo.actualStart) stamps.actualStart = wo.scheduledStart;
  }
  allRepairWOs[idx] = { ...wo, status, ...stamps };
  return true;
}

export function addRepairWO(wo: RepairWO): void {
  allRepairWOs.unshift(wo);
}

/** 수리 예정 기간 변경 (캘린더 드래그 재조정). 완료된 WO는 변경 불가. */
export function updateRepairSchedule(
  id: string,
  scheduledStart: string,
  scheduledEnd: string,
): boolean {
  const idx = allRepairWOs.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  if (allRepairWOs[idx].status === 'completed') return false;
  allRepairWOs[idx] = { ...allRepairWOs[idx], scheduledStart, scheduledEnd };
  return true;
}

/** 수리 WO에 사용 부품 추가 — partsCost/totalCost 재계산. 완료된 WO에는 추가 불가. */
export function addPartUsedToRepair(
  repairId: string,
  part: RepairWO['partsUsed'][number],
): boolean {
  const idx = allRepairWOs.findIndex((w) => w.id === repairId);
  if (idx === -1) return false;
  const wo = allRepairWOs[idx];
  if (wo.status === 'completed') return false;

  const partsUsed = [...wo.partsUsed, part];
  const partsCost = partsUsed.reduce((sum, p) => sum + p.qty * p.unitCost, 0);
  allRepairWOs[idx] = {
    ...wo,
    partsUsed,
    partsCost,
    totalCost: wo.laborCost != null ? wo.laborCost + partsCost : wo.totalCost,
  };
  return true;
}

export interface RepairDetailsUpdate {
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  laborHours?: number | null;
  downtimeHours?: number | null;
  reInspectionResult?: 'pass' | 'fail' | null;
}

/** 수리 결과 기록 — 완료된 WO는 변경 불가. 텍스트는 localizeRepair의 _ko 우선 규칙 때문에 base/_ko 동시 기록. */
export function updateRepairDetails(id: string, update: RepairDetailsUpdate): boolean {
  const idx = allRepairWOs.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  const wo = allRepairWOs[idx];
  if (wo.status === 'completed') return false;

  const patch: Partial<RepairWO> = {};
  if (update.rootCause !== undefined) {
    patch.rootCause = update.rootCause;
    patch.rootCause_ko = update.rootCause;
  }
  if (update.correctiveAction !== undefined) {
    patch.correctiveAction = update.correctiveAction;
    patch.correctiveAction_ko = update.correctiveAction;
  }
  if (update.preventiveAction !== undefined) {
    patch.preventiveAction = update.preventiveAction;
    patch.preventiveAction_ko = update.preventiveAction;
  }
  if (update.laborHours !== undefined) patch.laborHours = update.laborHours;
  if (update.downtimeHours !== undefined) patch.downtimeHours = update.downtimeHours;
  if (update.reInspectionResult !== undefined) patch.reInspectionResult = update.reInspectionResult;

  const next = { ...wo, ...patch };
  if (next.laborCost != null || next.partsCost != null) {
    next.totalCost = (next.laborCost ?? 0) + (next.partsCost ?? 0);
  }
  allRepairWOs[idx] = next;
  return true;
}

export function getMaintenanceSummary(): MaintenanceSummary {
  return {
    inProgress: allRepairWOs.filter((w) =>
      ['in_progress', 're_inspection'].includes(w.status),
    ).length,
    waitingParts: allRepairWOs.filter((w) => w.status === 'waiting_parts').length,
    emergency: allRepairWOs.filter((w) => w.priority === 'emergency').length,
    avgMttrHours: 8.4,
    avgMtbfDays: 42,
  };
}
