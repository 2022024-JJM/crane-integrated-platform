import { registerPersisted, replaceArray } from './persistence';
import type { NoteRefKind } from './notes';

export type ActivityType =
  | 'reported'
  | 'triaged'
  | 'rejected'
  | 'assigned'
  | 'rescheduled'
  | 'started'
  | 'completed'
  | 'status'
  | 'approved'
  | 'fulfilled'
  | 'acknowledged';

/** 요청 하나에 쌓이는 사실의 기록 — 누가 언제 무엇을 바꿨는가. 분쟁·인수인계용. */
export interface Activity {
  id: string;
  kind: NoteRefKind;
  refId: string;
  type: ActivityType;
  by: string;
  /** ISO */
  at: string;
  /** 담당자 이름·날짜·상태 등 짧은 값 */
  detail?: string;
}

const allActivities: Activity[] = [];
let seq = 0;
registerPersisted(
  'activities',
  () => allActivities,
  (v: Activity[]) => {
    replaceArray(allActivities, v);
    seq = v.length;
  },
);

export function getAllActivities(): Activity[] {
  return allActivities;
}

export function getActivities(kind: NoteRefKind, refId: string): Activity[] {
  return allActivities.filter((a) => a.kind === kind && a.refId === refId);
}

export function logActivity(
  input: Omit<Activity, 'id' | 'at'> & { at?: string },
): Activity {
  seq += 1;
  const a: Activity = {
    id: `act-${Date.now().toString(36)}-${seq}`,
    kind: input.kind,
    refId: input.refId,
    type: input.type,
    by: input.by,
    at: input.at ?? new Date().toISOString(),
    detail: input.detail,
  };
  allActivities.push(a);
  return a;
}

/** 테스트용 */
export function resetActivitiesForTest(): void {
  allActivities.length = 0;
  seq = 0;
}
