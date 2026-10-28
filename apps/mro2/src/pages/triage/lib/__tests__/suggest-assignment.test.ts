import { describe, expect, it } from 'vitest';
import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { Technician } from '@crane/domain/shared';
import {
  dailyLoad,
  lastAssigneeFor,
  suggestAssignment,
  type SuggestionTarget,
} from '../suggest-assignment';

const techs: Technician[] = [
  { id: 't1', name: '김내부', performerType: 'internal' },
  { id: 't2', name: '박내부', performerType: 'internal' },
  { id: 't3', name: 'Vendor', performerType: 'third_party' },
];
const repair = (o: Partial<RepairWO>): RepairWO =>
  ({
    id: 'r',
    craneId: 'c1',
    assignedTo: '김내부',
    status: 'received',
    scheduledStart: '2026-10-20',
    scheduledEnd: '2026-10-20',
    ...o,
  }) as RepairWO;
const insp = (o: Partial<InspectionWO>): InspectionWO =>
  ({
    id: 'i',
    craneId: 'c1',
    assignedTo: '박내부',
    status: 'scheduled',
    scheduledDate: '2026-10-21',
    ...o,
  }) as InspectionWO;
// 2026-10-28 은 수요일
const today = '2026-10-28';
const target = (o: Partial<SuggestionTarget> = {}): SuggestionTarget => ({
  kind: 'repair',
  id: 'new',
  craneId: 'c1',
  reportedBy: '현장인',
  urgency: 0,
  ...o,
});

describe('lastAssigneeFor', () => {
  it('가장 최근 날짜의 담당자, 기술자 목록에 없는 이름은 무시', () => {
    const ctx = {
      repairs: [repair({ id: 'a', scheduledStart: '2026-10-01' })],
      inspections: [
        insp({ id: 'b', scheduledDate: '2026-10-21' }),
        insp({ id: 'c', scheduledDate: '2026-10-25', assignedTo: '외부인' }),
      ],
      technicians: techs,
    };
    expect(lastAssigneeFor(ctx, 'c1')?.name).toBe('박내부');
    expect(lastAssigneeFor(ctx, 'c9')).toBeNull();
  });
  it('접수 안 된 현장 보고와 자기 자신은 제외', () => {
    const ctx = {
      repairs: [
        repair({
          id: 'self',
          scheduledStart: '2026-10-27',
          assignedTo: '박내부',
        }),
        repair({
          id: 'f',
          scheduledStart: '2026-10-26',
          assignedTo: '박내부',
          fieldReport: { reportedBy: 'x', reportedAt: '2026-10-26T00:00:00Z' },
        }),
        repair({ id: 'ok', scheduledStart: '2026-10-01' }),
      ],
      inspections: [],
      technicians: techs,
    };
    expect(lastAssigneeFor(ctx, 'c1', 'self')?.name).toBe('김내부');
  });
});

describe('dailyLoad', () => {
  it('열린 수리(시작일)·점검(예정일)만 센다', () => {
    const ctx = {
      repairs: [
        repair({ id: '1', scheduledStart: today }),
        repair({ id: '2', scheduledStart: today, status: 'completed' }),
      ],
      inspections: [
        insp({ id: '3', assignedTo: '김내부', scheduledDate: today }),
        insp({
          id: '4',
          assignedTo: '김내부',
          scheduledDate: today,
          status: 'cancelled',
        }),
      ],
    };
    expect(dailyLoad(ctx, '김내부', today)).toBe(2);
    expect(dailyLoad(ctx, '김내부', today, '1')).toBe(1);
    expect(dailyLoad(ctx, '박내부', today)).toBe(0);
  });
});

describe('suggestAssignment', () => {
  it('긴급은 최근 담당자에게 오늘', () => {
    const s = suggestAssignment(target({ urgency: 2 }), {
      repairs: [repair({})],
      inspections: [],
      technicians: techs,
      today,
    });
    expect(s).toMatchObject({
      assignedTo: '김내부',
      performerType: 'internal',
      scheduledDate: today,
      reason: 'lastAssignee',
      dateReason: 'today',
    });
  });
  it('보통은 내일부터 빈 평일, 상한이 차면 다음 날로', () => {
    // 김내부 는 목(29)·금(30) 이 꽉 차 있다 → 월(11-02)
    const full = ['2026-10-29', '2026-10-30'].flatMap((d, i) => [
      repair({ id: `a${i}`, scheduledStart: d }),
      repair({ id: `b${i}`, scheduledStart: d }),
    ]);
    const s = suggestAssignment(target(), {
      repairs: full,
      inspections: [],
      technicians: techs,
      today,
    });
    expect(s?.assignedTo).toBe('김내부');
    expect(s?.scheduledDate).toBe('2026-11-02');
    expect(s?.dateReason).toBe('nextFree');
  });
  it('높음은 오늘부터 본다', () => {
    const s = suggestAssignment(target({ urgency: 1 }), {
      repairs: [repair({ scheduledStart: '2026-10-01' })],
      inspections: [],
      technicians: techs,
      today,
    });
    expect(s?.scheduledDate).toBe(today);
  });
  it('이력이 없으면 보고자(기술자) › 기본 자체 인력', () => {
    const base = { repairs: [], inspections: [], technicians: techs, today };
    expect(
      suggestAssignment(target({ reportedBy: '박내부' }), base),
    ).toMatchObject({
      assignedTo: '박내부',
      reason: 'reporter',
    });
    expect(suggestAssignment(target(), base)).toMatchObject({
      assignedTo: '김내부',
      reason: 'default',
    });
    expect(
      suggestAssignment(target(), { ...base, technicians: [techs[2]!] }),
    ).toMatchObject({ assignedTo: 'Vendor', performerType: 'third_party' });
  });
  it('기술자가 없으면 null', () => {
    expect(
      suggestAssignment(target(), {
        repairs: [],
        inspections: [],
        technicians: [],
        today,
      }),
    ).toBeNull();
  });
  it('상한을 넘기지 않는 capPerDay 와 평일 건너뛰기', () => {
    // 금요일 기준 보통 → 다음 평일은 월요일
    const s = suggestAssignment(target(), {
      repairs: [],
      inspections: [],
      technicians: techs,
      today: '2026-10-30',
      capPerDay: 1,
    });
    expect(s?.scheduledDate).toBe('2026-11-02');
  });
});
