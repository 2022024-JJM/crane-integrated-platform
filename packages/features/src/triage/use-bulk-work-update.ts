import { useCallback } from 'react';
import {
  assignInspectionWO,
  getInspectionWOById,
  updateInspectionSchedule,
} from '@crane/domain/inspection';
import {
  assignRepairWO,
  getRepairWOById,
  updateRepairSchedule,
} from '@crane/domain/maintenance';
import { logActivity } from '@crane/domain/shared';
import { useDomainEventStore } from '../shared/use-domain-event-store';

export interface WorkTarget {
  kind: 'repair' | 'inspection';
  id: string;
}

export interface ScheduleEntry extends WorkTarget {
  date: string;
}

export interface BulkOutcome {
  changed: number;
  undo: () => void;
}

/**
 * 관리자 일괄 처리 — 여러 건의 예정일·담당자를 한 번에 바꾼다. 완료 건은 건너뛴다.
 * 되돌리기는 바뀐 건만 이전 값으로 복원한다. 일괄 완료는 두지 않는다(판정 없는 완료는 거짓).
 */
/** 관리 화면의 행위자 — 계정이 붙으면 로그인 이름으로 */
const OFFICE = 'office';

export function useBulkWorkUpdate() {
  const publish = useDomainEventStore((s) => s.publish);

  /** 건마다 다른 날짜로 — 담당자별 분배(spread) 가 쓴다. */
  const rescheduleEach = useCallback(
    (entries: readonly ScheduleEntry[]): BulkOutcome => {
      const restores: Array<() => void> = [];
      for (const t of entries) {
        const date = t.date;
        if (t.kind === 'inspection') {
          const prev = getInspectionWOById(t.id)?.scheduledDate;
          if (prev === undefined || prev === date) continue;
          if (!updateInspectionSchedule(t.id, date)) continue;
          logActivity({
            kind: 'inspection',
            refId: t.id,
            type: 'rescheduled',
            by: OFFICE,
            detail: date,
          });
          restores.push(() => updateInspectionSchedule(t.id, prev));
        } else {
          const prev = getRepairWOById(t.id);
          if (!prev || prev.scheduledStart === date) continue;
          // 기간은 유지한다 — 시작만 옮기고 끝은 같은 날수만큼 따라간다
          const days = Math.max(
            0,
            Math.round(
              (Date.parse(prev.scheduledEnd) -
                Date.parse(prev.scheduledStart)) /
                86_400_000,
            ),
          );
          const end = new Date(Date.parse(date) + days * 86_400_000)
            .toISOString()
            .slice(0, 10);
          if (!updateRepairSchedule(t.id, date, end)) continue;
          logActivity({
            kind: 'repair',
            refId: t.id,
            type: 'rescheduled',
            by: OFFICE,
            detail: date,
          });
          const { scheduledStart, scheduledEnd } = prev;
          restores.push(() =>
            updateRepairSchedule(t.id, scheduledStart, scheduledEnd),
          );
        }
      }
      if (restores.length) {
        publish('inspection');
        publish('repair');
      }
      return {
        changed: restores.length,
        undo: () => {
          for (const r of restores) r();
          publish('inspection');
          publish('repair');
        },
      };
    },
    [publish],
  );

  const reschedule = useCallback(
    (targets: readonly WorkTarget[], date: string): BulkOutcome =>
      rescheduleEach(targets.map((t) => ({ ...t, date }))),
    [rescheduleEach],
  );

  const reassign = useCallback(
    (targets: readonly WorkTarget[], assignedTo: string): BulkOutcome => {
      const restores: Array<() => void> = [];
      for (const t of targets) {
        if (t.kind === 'inspection') {
          const prev = getInspectionWOById(t.id)?.assignedTo;
          if (prev === undefined || !assignInspectionWO(t.id, assignedTo))
            continue;
          logActivity({
            kind: 'inspection',
            refId: t.id,
            type: 'assigned',
            by: OFFICE,
            detail: assignedTo,
          });
          restores.push(() => assignInspectionWO(t.id, prev));
        } else {
          const prev = getRepairWOById(t.id)?.assignedTo;
          if (prev === undefined || !assignRepairWO(t.id, assignedTo)) continue;
          logActivity({
            kind: 'repair',
            refId: t.id,
            type: 'assigned',
            by: OFFICE,
            detail: assignedTo,
          });
          restores.push(() => assignRepairWO(t.id, prev));
        }
      }
      if (restores.length) {
        publish('inspection');
        publish('repair');
      }
      return {
        changed: restores.length,
        undo: () => {
          for (const r of restores) r();
          publish('inspection');
          publish('repair');
        },
      };
    },
    [publish],
  );

  return { reschedule, rescheduleEach, reassign };
}
