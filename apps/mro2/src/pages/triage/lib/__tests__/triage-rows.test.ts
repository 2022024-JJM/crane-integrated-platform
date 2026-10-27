import { describe, expect, it } from 'vitest';
import type { InspectionWO } from '@crane/domain/inspection';
import type { PartsRequest } from '@crane/domain/inventory';
import type { RepairWO } from '@crane/domain/maintenance';
import { buildTriageRows, waitedMinutes } from '../triage-rows';

const fr = (at: string) => ({ reportedBy: '김현장', reportedAt: at });
const repair = (o: Partial<RepairWO>): RepairWO =>
  ({
    id: 'r',
    woNumber: 'RPR-1',
    craneId: 'c',
    craneName: 'C',
    failureDescription: '누유',
    componentName: 'General',
    priority: 'normal',
    ...o,
  }) as RepairWO;
const insp = (o: Partial<InspectionWO>): InspectionWO =>
  ({
    id: 'i',
    woNumber: 'INS-1',
    craneId: 'c',
    craneName: 'C',
    woType: 'frequent',
    priority: 'normal',
    ...o,
  }) as InspectionWO;
const parts = (o: Partial<PartsRequest>): PartsRequest =>
  ({
    id: 'p',
    requestNumber: 'PRQ-1',
    craneId: 'c',
    craneName: 'C',
    priority: 'normal',
    items: [{ partId: 'x', partName: 'Bolt', qty: 2, unitPrice: 1 }],
    ...o,
  }) as PartsRequest;

describe('buildTriageRows', () => {
  it('긴급 먼저, 같으면 오래된 것 먼저', () => {
    const rows = buildTriageRows({
      repairs: [
        repair({ id: 'r1', fieldReport: fr('2026-01-02T00:00:00Z') }),
        repair({
          id: 'r2',
          priority: 'emergency',
          fieldReport: fr('2026-01-03T00:00:00Z'),
        }),
      ],
      inspections: [
        insp({
          fieldReport: fr('2026-01-01T00:00:00Z'),
          priority: 'high',
          findings: '균열',
        }),
      ],
      parts: [
        parts({ fieldReport: fr('2026-01-04T00:00:00Z'), priority: 'urgent' }),
      ],
      total: 4,
    });
    expect(rows.map((r) => r.number)).toEqual([
      'RPR-1',
      'PRQ-1',
      'INS-1',
      'RPR-1',
    ]);
    expect(rows[0]!.id).toBe('r2');
    expect(rows[2]!.needsRepair).toBe(true);
    expect(rows[2]!.completed).toBe(false);
    expect(
      buildTriageRows({
        repairs: [],
        inspections: [
          insp({ status: 'completed', result: 'fail', fieldReport: fr('t') }),
        ],
        parts: [],
        total: 1,
      })[0],
    ).toMatchObject({ completed: true, needsRepair: true });
    expect(rows[3]!.title).toBe('누유');
    expect(rows[1]!.title).toBe('Bolt ×2');
  });
  it('표식이 없으면 빈 문자열, 빈 큐는 빈 배열', () => {
    const rows = buildTriageRows({
      repairs: [repair({})],
      inspections: [],
      parts: [],
      total: 1,
    });
    expect(rows[0]!.reportedBy).toBe('');
    expect(
      buildTriageRows({ repairs: [], inspections: [], parts: [], total: 0 }),
    ).toEqual([]);
  });
});

describe('waitedMinutes', () => {
  it('분 단위 내림, 음수·비유한은 0', () => {
    const now = Date.parse('2026-01-01T01:00:00Z');
    expect(waitedMinutes('2026-01-01T00:30:30Z', now)).toBe(29);
    expect(waitedMinutes('2026-01-01T02:00:00Z', now)).toBe(0);
    expect(waitedMinutes('nope', now)).toBe(0);
  });
});
