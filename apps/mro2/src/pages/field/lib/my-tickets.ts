import type { InspectionWO } from '@crane/domain/inspection';
import type { PartsRequest } from '@crane/domain/inventory';
import type { RepairWO } from '@crane/domain/maintenance';
import type { FieldKind } from './field-route';

/**
 * "내 작업" — 내가 올린 것(fieldReport.reportedBy)과 나에게 배정된 것(assignedTo /
 * requester) 둘 다. 사무실이 담당자를 바꿔도 보고자 쪽은 남는다.
 */
export interface MyTicketRow {
  kind: FieldKind;
  id: string;
  number: string;
  craneName: string;
  title: string;
  status: string;
  /** 정렬용 날짜(ISO). */
  date: string;
  /** 수리 — 현장이 올린 조치 내용 */
  action?: string;
  /** 읽지 않은 사무실 메모 수 */
  unread?: number;
  /** 점검 종류 — 소견이 없는 예정 점검의 제목용 */
  woType?: InspectionWO['woType'];
}

export type MyTicketGroup = 'today' | 'overdue' | 'upcoming' | 'done';
export const MY_TICKET_GROUPS: readonly MyTicketGroup[] = [
  'overdue',
  'today',
  'upcoming',
  'done',
];
const DONE = new Set(['completed', 'ordered', 'approved', 'cancelled']);

/** 오늘(YYYY-MM-DD) 기준 묶음 — 지연 › 오늘 › 예정 › 완료. 현장은 "오늘 뭐 하지"가 먼저다. */
export function groupMyTickets(
  rows: readonly MyTicketRow[],
  todayIso: string,
): Record<MyTicketGroup, MyTicketRow[]> {
  const out: Record<MyTicketGroup, MyTicketRow[]> = {
    today: [],
    overdue: [],
    upcoming: [],
    done: [],
  };
  for (const r of rows) {
    const day = r.date.slice(0, 10);
    if (DONE.has(r.status)) out.done.push(r);
    else if (day < todayIso) out.overdue.push(r);
    else if (day === todayIso) out.today.push(r);
    else out.upcoming.push(r);
  }
  out.overdue.sort((a, b) => (a.date < b.date ? -1 : 1));
  out.upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

export function collectMyTickets(
  worker: string,
  repairs: readonly RepairWO[],
  inspections: readonly InspectionWO[],
  parts: readonly PartsRequest[],
  limit = 20,
): MyTicketRow[] {
  const name = worker.trim();
  if (!name) return [];
  // '*' 는 전부 — 티켓 상세가 id 로 찾을 때 쓴다.
  const all = name === '*';
  const rows: MyTicketRow[] = [];
  const mine = (fr: { reportedBy: string } | undefined, fallback: string) =>
    all || fr?.reportedBy === name || fallback === name;
  for (const r of repairs) {
    if (!mine(r.fieldReport, r.assignedTo)) continue;
    rows.push({
      kind: 'repair',
      id: r.id,
      number: r.woNumber,
      craneName: r.craneName,
      title: r.failureDescription,
      status: r.status,
      date: r.scheduledStart,
      action: r.correctiveAction,
    });
  }
  for (const i of inspections) {
    if (!mine(i.fieldReport, i.assignedTo)) continue;
    rows.push({
      kind: 'inspection',
      id: i.id,
      number: i.woNumber,
      craneName: i.craneName,
      title: i.findings ?? '',
      status: i.status,
      date: i.scheduledDate,
      woType: i.woType,
    });
  }
  for (const p of parts) {
    if (!mine(p.fieldReport, p.requester)) continue;
    rows.push({
      kind: 'parts',
      id: p.id,
      number: p.requestNumber,
      craneName: p.craneName,
      title: p.items.map((it) => `${it.partName} ×${it.qty}`).join(', '),
      status: p.status,
      date: p.requestDate,
    });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows.slice(0, limit);
}

/** 상태 → 색 톤(완료/진행/대기). 세 종류의 상태 enum 을 한 축으로. */
export type MyTicketTone = 'done' | 'active' | 'waiting';
export function myTicketTone(status: string): MyTicketTone {
  if (status === 'completed' || status === 'ordered' || status === 'approved') {
    return 'done';
  }
  if (status === 'in_progress' || status === 'waiting_parts') return 'active';
  return 'waiting';
}
