import { describe, expect, it } from 'vitest';
import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import {
  SR_ALERT_CAP,
  type SrRow,
  applyAlertCap,
  buildSrRows,
  countBuckets,
  countMutedDelayed,
  sortForAdmin,
  srBucket,
} from '../sr-rows';

const NOW = new Date('2026-06-30T00:00:00Z').getTime();
const labels = {
  inspectionProduct: (t: string) => `insp:${t}`,
  onCallRepair: 'oncall',
  plannedRepair: 'planned',
  partsRequest: 'parts',
  partsTitle: (f: string, q: number, m: number) => `${f}x${q}+${m}`,
};
const insp = (o: Partial<InspectionWO>): InspectionWO =>
  ({
    id: 'i1',
    woNumber: 'INS-1',
    woType: 'frequent',
    status: 'scheduled',
    scheduledDate: '2026-06-01',
    craneId: 'c',
    craneName: 'C',
    siteName: 'S',
    ...o,
  }) as InspectionWO;
const rep = (o: Partial<RepairWO>): RepairWO =>
  ({
    id: 'r1',
    woNumber: 'RPR-1',
    status: 'received',
    sourceType: 'breakdown',
    scheduledStart: '2026-06-01',
    scheduledEnd: '2026-06-02',
    failureDescription: '소음',
    craneId: 'c',
    craneName: 'C',
    siteName: 'S',
    ...o,
  }) as RepairWO;

describe('buildSrRows', () => {
  it('제목은 내용(소견·증상), 없으면 상품명. 보고자 > 담당자. 연도 밖은 제외', () => {
    const rows = buildSrRows(
      [
        insp({ findings: ' 와이어 마모 ', assignedTo: '정비' }),
        insp({ id: 'i2', findings: '', scheduledDate: '2025-06-01' }),
      ],
      [
        rep({
          fieldReport: {
            reportedBy: '김현장',
            reportedAt: '2026-06-01T00:00:00Z',
          },
          assignedTo: '정비',
        }),
        rep({
          id: 'r2',
          failureDescription: '',
          sourceType: 'planned',
          assignedTo: '정비',
        }),
      ],
      [],
      2026,
      labels,
      NOW,
    );
    expect(rows.map((r) => r.title)).toEqual([
      '와이어 마모',
      '소음',
      'planned',
    ]);
    // 현장 보고가 접수 전이면 담당 없음(미배정), 보고자는 따로
    expect(rows.map((r) => r.assignee)).toEqual(['정비', '', '정비']);
    expect(rows.map((r) => r.reporter)).toEqual([
      undefined,
      '김현장',
      undefined,
    ]);
    expect(rows.map((r) => r.untriaged)).toEqual([false, true, false]);
    expect(rows.map((r) => r.fromField)).toEqual([false, true, false]);
  });
  it('year 가 null 이면 전 연도', () => {
    const rows = buildSrRows(
      [insp({ scheduledDate: '2025-06-01' })],
      [],
      [],
      null,
      labels,
      NOW,
    );
    expect(rows).toHaveLength(1);
  });
  it('기준일 내림차순 정렬, 잘못된 날짜는 0 취급', () => {
    const rows = buildSrRows(
      [
        insp({ scheduledDate: '2026-03-01' }),
        insp({ id: 'i2', scheduledDate: 'bad', actualDate: 'bad' }),
      ],
      [rep({ scheduledStart: '2026-05-01', actualEnd: '2026-05-03' })],
      [],
      2026,
      labels,
      NOW,
    );
    expect(rows.map((r) => r.key)).toEqual(['r-r1', 'i-i1']);
  });
});

describe('parts rows', () => {
  it('부품 요청 — 상태 매핑, cancelled 제외, 제목 요약, 비용 합계, 상세 경로 없음', () => {
    const parts = [
      {
        id: 'p1',
        requestNumber: 'PRQ-1',
        requestDate: '2026-06-02',
        status: 'pending',
        requester: '김',
        craneId: 'c',
        craneName: 'C',
        siteName: 'S',
        items: [
          { partName: 'FUSE', qty: 2, unitPrice: 10 },
          { partName: 'X', qty: 1, unitPrice: 5 },
        ],
      },
      {
        id: 'p2',
        requestNumber: 'PRQ-2',
        requestDate: '2026-06-01',
        status: 'cancelled',
        requester: '김',
        craneId: 'c',
        craneName: 'C',
        siteName: 'S',
        items: [],
      },
      {
        id: 'p3',
        requestNumber: 'PRQ-3',
        requestDate: '2026-06-03',
        status: 'ordered',
        requester: '김',
        craneId: 'c',
        craneName: 'C',
        siteName: 'S',
        items: [],
      },
    ] as unknown as import('@crane/domain/inventory').PartsRequest[];
    const rows = buildSrRows([], [], parts, 2026, labels, NOW);
    expect(rows.map((r) => [r.woNumber, r.tone, r.title, r.cost])).toEqual([
      ['PRQ-3', 'completed', 'parts', 0],
      ['PRQ-1', 'open', 'FUSEx2+1', 25],
    ]);
    expect(rows[1]!.path).toBe('');
  });
});

describe('buckets & admin sort', () => {
  const row = (o: Partial<SrRow>): SrRow =>
    ({
      key: Math.random().toString(),
      tone: 'open',
      untriaged: false,
      urgency: 0,
      overdueDays: 0,
      date: '2026-06-01',
      due: '2026-06-01',
      alert: false,
      ...o,
    }) as SrRow;
  it('접수 = 미처리 현장 보고(완료·지연 아님), 탭 건수', () => {
    expect(srBucket(row({ untriaged: true }))).toBe('received');
    expect(srBucket(row({ untriaged: true, tone: 'delayed' }))).toBe('delayed');
    expect(srBucket(row({ tone: 'inProgress' }))).toBe('inProgress');
    expect(
      countBuckets([
        row({}),
        row({ tone: 'completed' }),
        row({ untriaged: true }),
      ]),
    ).toEqual({
      delayed: 0,
      received: 1,
      inProgress: 0,
      open: 1,
      completed: 1,
    });
  });
  it('지연(오래 지난 순) › 접수 › 진행 중 › 예정 › 완료, 지연 밖 묶음에선 긴급 먼저', () => {
    const rows = [
      row({ key: 'done', tone: 'completed' }),
      row({ key: 'open-later', due: '2026-07-10' }),
      row({ key: 'd-short', tone: 'delayed', overdueDays: 3 }),
      row({ key: 'recv', untriaged: true }),
      row({ key: 'd-long', tone: 'delayed', overdueDays: 40 }),
      row({ key: 'd-urgent', tone: 'delayed', overdueDays: 1, urgency: 2 }),
      row({ key: 'open-soon', due: '2026-07-01' }),
    ];
    expect(sortForAdmin(rows).map((r) => r.key)).toEqual([
      'd-long',
      'd-short',
      'd-urgent',
      'recv',
      'open-soon',
      'open-later',
      'done',
    ]);
    expect(rows[0]!.key).toBe('done'); // 입력 불변
  });
  it('overdueDays 는 지연 건만, 기준일에서 지난 일수', () => {
    const r = buildSrRows(
      [],
      [rep({ status: 'received', scheduledEnd: '2026-06-02' })],
      [],
      2026,
      labels,
      NOW,
    )[0]!;
    expect(r.tone).toBe('delayed');
    expect(r.overdueDays).toBe(28);
    expect(
      buildSrRows([], [rep({ status: 'completed' })], [], 2026, labels, NOW)[0]!
        .overdueDays,
    ).toBe(0);
  });
});

describe('applyAlertCap', () => {
  const row = (key: string, tone: SrRow['tone'], due: string): SrRow =>
    ({ key, tone, due, alert: false }) as SrRow;
  it('지연 중 가장 오래된 cap 건만 alert, 순서 유지, 변화 없으면 참조 유지', () => {
    const rows = [
      row('a', 'delayed', '2026-05-10'),
      row('b', 'open', '2026-05-01'),
      row('c', 'delayed', '2026-04-01'),
      row('d', 'delayed', '2026-05-20'),
    ];
    const out = applyAlertCap(rows, 2);
    expect(out.map((r) => [r.key, r.alert])).toEqual([
      ['a', true],
      ['b', false],
      ['c', true],
      ['d', false],
    ]);
    expect(out[1]).toBe(rows[1]);
    expect(countMutedDelayed(out)).toBe(1);
  });
  it('경계: cap 정확값 = 전부 빨강, cap 0·음수 = 없음, 빈 배열', () => {
    const rows = Array.from({ length: SR_ALERT_CAP }, (_, i) =>
      row(`k${i}`, 'delayed', `2026-01-0${i + 1}`),
    );
    expect(applyAlertCap(rows).every((r) => r.alert)).toBe(true);
    expect(
      applyAlertCap([...rows, row('x', 'delayed', '2026-02-01')]).filter(
        (r) => r.alert,
      ).length,
    ).toBe(SR_ALERT_CAP);
    expect(applyAlertCap(rows, 0).some((r) => r.alert)).toBe(false);
    expect(applyAlertCap(rows, -1).some((r) => r.alert)).toBe(false);
    expect(applyAlertCap([])).toEqual([]);
  });
});
