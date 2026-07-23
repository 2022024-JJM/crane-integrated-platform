import { updateInspectionSchedule } from '@crane/domain/inspection';
import { updateRepairSchedule } from '@crane/domain/maintenance';
import { useDomainEventStore } from '../shared/use-domain-event-store';
import type { CalendarEvent } from './types';

/** 드래그 재조정 가능 여부 — 완료/취소된 WO는 일정 변경 불가 */
export function canRescheduleEvent(e: CalendarEvent): boolean {
  return e.status !== 'completed' && e.status !== 'cancelled';
}

const pad = (n: number) => String(n).padStart(2, '0');

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalDateTime(d: Date): string {
  return `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 캘린더 이벤트 일정 변경 (구글 캘린더식 드래그 이동/리사이즈의 커밋).
 * 점검은 예정일(date-only), 수리는 예정 기간(datetime)을 갱신하고 tick을 발행한다.
 */
export function useRescheduleEvent(): (
  event: CalendarEvent,
  newStart: Date,
  newEnd: Date,
) => boolean {
  const publish = useDomainEventStore((s) => s.publish);

  return (event, newStart, newEnd) => {
    if (!canRescheduleEvent(event)) return false;
    if (event.sourceType === 'inspection') {
      const ok = updateInspectionSchedule(event.sourceId, toLocalDate(newStart));
      if (ok) publish('inspection');
      return ok;
    }
    const ok = updateRepairSchedule(
      event.sourceId,
      toLocalDateTime(newStart),
      toLocalDateTime(newEnd),
    );
    if (ok) publish('repair');
    return ok;
  };
}
