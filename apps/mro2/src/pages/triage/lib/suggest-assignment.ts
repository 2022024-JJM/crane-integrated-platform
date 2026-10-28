import type { InspectionWO, PerformerType } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import type { Technician } from '@crane/domain/shared';
import { addDays, nextWorkday } from '../../../shared/lib/workdays';

/**
 * 접수함 배정 추천 — 관리자가 드롭다운 넷을 매번 고르지 않도록 규칙으로
 * 미리 채운다. 담당은 그 장비를 최근에 맡은 사람 › 보고자 본인(기술자면) ›
 * 기본 자체 인력. 날짜는 긴급이면 오늘, 아니면 그 담당자의 다음 빈 평일
 * (하루 상한 `capPerDay`). 틀리면 관리자가 고치면 된다 — 추천은 초기값이다.
 */
export interface SuggestionContext {
  repairs: readonly RepairWO[];
  inspections: readonly InspectionWO[];
  technicians: readonly Technician[];
  /** ISO 오늘. */
  today: string;
  capPerDay?: number;
}

export interface SuggestionTarget {
  kind: 'repair' | 'inspection';
  id: string;
  craneId: string;
  reportedBy: string;
  urgency: 0 | 1 | 2;
}

export interface AssignmentSuggestion {
  assignedTo: string;
  performerType: PerformerType;
  scheduledDate: string;
  reason: 'lastAssignee' | 'reporter' | 'default';
  dateReason: 'today' | 'nextFree';
}

const OPEN_REPAIR = new Set<RepairWO['status']>([
  'received',
  'waiting_parts',
  'in_progress',
  're_inspection',
  'on_hold',
]);

/** 담당자의 그날 열린 작업 수 — 수리는 시작일, 점검은 예정일 기준. */
export function dailyLoad(
  ctx: Pick<SuggestionContext, 'repairs' | 'inspections'>,
  assignee: string,
  date: string,
  excludeId?: string,
): number {
  let n = 0;
  for (const w of ctx.repairs) {
    if (w.id === excludeId) continue;
    if (
      w.assignedTo === assignee &&
      OPEN_REPAIR.has(w.status) &&
      w.scheduledStart === date
    )
      n += 1;
  }
  for (const w of ctx.inspections) {
    if (w.id === excludeId) continue;
    if (
      w.assignedTo === assignee &&
      w.status !== 'completed' &&
      w.status !== 'cancelled' &&
      w.scheduledDate === date
    )
      n += 1;
  }
  return n;
}

/** 장비를 가장 최근에 맡은 기술자 — 접수 안 된 현장 보고는 "맡은 것" 이 아니다. */
export function lastAssigneeFor(
  ctx: Pick<SuggestionContext, 'repairs' | 'inspections' | 'technicians'>,
  craneId: string,
  excludeId?: string,
): Technician | null {
  const known = new Map(ctx.technicians.map((t) => [t.name, t]));
  let best: { date: string; tech: Technician } | null = null;
  const consider = (date: string, name: string) => {
    const tech = known.get(name);
    if (!tech) return;
    if (!best || date > best.date) best = { date, tech };
  };
  for (const w of ctx.repairs) {
    if (w.id === excludeId || w.craneId !== craneId) continue;
    if (w.fieldReport && !w.fieldReport.triagedAt) continue;
    consider(w.scheduledStart, w.assignedTo);
  }
  for (const w of ctx.inspections) {
    if (w.id === excludeId || w.craneId !== craneId) continue;
    if (w.fieldReport && !w.fieldReport.triagedAt) continue;
    consider(w.scheduledDate, w.assignedTo);
  }
  return best ? (best as { tech: Technician }).tech : null;
}

export function suggestAssignment(
  target: SuggestionTarget,
  ctx: SuggestionContext,
): AssignmentSuggestion | null {
  if (ctx.technicians.length === 0) return null;
  const cap = ctx.capPerDay ?? 2;
  let tech = lastAssigneeFor(ctx, target.craneId, target.id);
  let reason: AssignmentSuggestion['reason'] = 'lastAssignee';
  if (!tech) {
    const reporter = ctx.technicians.find((t) => t.name === target.reportedBy);
    if (reporter) {
      tech = reporter;
      reason = 'reporter';
    } else {
      tech =
        ctx.technicians.find((t) => t.performerType === 'internal') ??
        ctx.technicians[0]!;
      reason = 'default';
    }
  }
  let date: string;
  if (target.urgency === 2) {
    date = ctx.today;
  } else {
    // 높음은 오늘부터, 보통은 내일부터 — 평일만, 하루 상한 안에서.
    let d = nextWorkday(
      target.urgency === 1 ? ctx.today : addDays(ctx.today, 1),
    );
    for (let i = 0; i < 60; i += 1) {
      if (dailyLoad(ctx, tech.name, d, target.id) < cap) break;
      d = nextWorkday(addDays(d, 1));
    }
    date = d;
  }
  return {
    assignedTo: tech.name,
    performerType: tech.performerType,
    scheduledDate: date,
    reason,
    dateReason: date === ctx.today ? 'today' : 'nextFree',
  };
}
