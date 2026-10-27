import { describe, expect, it } from 'vitest';
import type { InspectionWO } from '@crane/domain/inspection';
import type { PartsRequest } from '@crane/domain/inventory';
import type { RepairWO } from '@crane/domain/maintenance';
import { collectMyTickets, myTicketTone } from '../my-tickets';

const repair = (o: Partial<RepairWO>): RepairWO =>
  ({
    id: 'r',
    woNumber: 'WO-R',
    craneName: 'C',
    failureDescription: 'f',
    status: 'scheduled',
    scheduledStart: '2026-01-02',
    assignedTo: '',
    ...o,
  }) as RepairWO;
const insp = (o: Partial<InspectionWO>): InspectionWO =>
  ({
    id: 'i',
    woNumber: 'WO-I',
    craneName: 'C',
    status: 'scheduled',
    scheduledDate: '2026-01-03',
    assignedTo: '',
    ...o,
  }) as InspectionWO;
const parts = (o: Partial<PartsRequest>): PartsRequest =>
  ({
    id: 'p',
    requestNumber: 'PR-1',
    craneName: 'C',
    status: 'pending',
    requestDate: '2026-01-01',
    requester: '',
    items: [{ partId: 'x', partName: 'Bolt', qty: 2, unitPrice: 1 }],
    ...o,
  }) as PartsRequest;

describe('collectMyTickets', () => {
  it('작업자 이름으로만 고르고 최신순, 빈 이름은 빈 배열', () => {
    const rows = collectMyTickets(
      '김현장',
      [
        repair({ assignedTo: '김현장' }),
        repair({ id: 'r2', assignedTo: '다른' }),
      ],
      [insp({ assignedTo: '김현장', findings: '균열' })],
      [parts({ requester: '김현장' })],
    );
    expect(rows.map((r) => r.number)).toEqual(['WO-I', 'WO-R', 'PR-1']);
    expect(rows[2]!.title).toBe('Bolt ×2');
    expect(rows[0]!.title).toBe('균열');
    expect(collectMyTickets('', [repair({ assignedTo: '' })], [], [])).toEqual(
      [],
    );
  });
  it("'*' 는 보고자와 무관하게 전부", () => {
    const rows = collectMyTickets(
      '*',
      [repair({ assignedTo: 'x' })],
      [insp({ assignedTo: 'y' })],
      [parts({ requester: 'z' })],
    );
    expect(rows).toHaveLength(3);
  });
  it('limit 으로 자른다', () => {
    const rows = collectMyTickets(
      'a',
      [repair({ assignedTo: 'a' }), repair({ id: 'r2', assignedTo: 'a' })],
      [],
      [],
      1,
    );
    expect(rows).toHaveLength(1);
  });
  it('tone 축', () => {
    expect(myTicketTone('completed')).toBe('done');
    expect(myTicketTone('ordered')).toBe('done');
    expect(myTicketTone('in_progress')).toBe('active');
    expect(myTicketTone('scheduled')).toBe('waiting');
    expect(myTicketTone('pending')).toBe('waiting');
  });
});
