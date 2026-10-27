import type { Activity, Note } from '@crane/domain/shared';

/** 요청 하나의 타임라인 한 줄 — 사람의 메모와 시스템 기록을 한 축에 놓는다. */
export type TimelineEntry =
  | { id: string; at: string; type: 'note'; note: Note }
  | { id: string; at: string; type: 'activity'; activity: Activity };

/** 오래된 것이 위, 같은 시각이면 활동 먼저. */
export function buildTimeline(
  activities: readonly Activity[],
  notes: readonly Note[],
): TimelineEntry[] {
  const rows: TimelineEntry[] = [
    ...activities.map(
      (a): TimelineEntry => ({
        id: a.id,
        at: a.at,
        type: 'activity',
        activity: a,
      }),
    ),
    ...notes.map(
      (n): TimelineEntry => ({ id: n.id, at: n.at, type: 'note', note: n }),
    ),
  ];
  return rows.sort(
    (a, b) =>
      cmp(a.at, b.at) ||
      (a.type === b.type ? 0 : a.type === 'activity' ? -1 : 1),
  );
}

/**
 * 상대편 메모 중 내가 아직 보지 않은 것 — ref 별 "마지막으로 본 시각" 과 비교한다.
 * 결과는 ref 키(`kind:refId`) → 건수.
 */
export function unreadByRef(
  notes: readonly Note[],
  mySide: Note['side'],
  seen: Readonly<Record<string, string>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of notes) {
    if (n.side === mySide) continue;
    const key = `${n.kind}:${n.refId}`;
    const last = seen[key];
    if (last && n.at <= last) continue;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function sumCounts(counts: Readonly<Record<string, number>>): number {
  let n = 0;
  for (const v of Object.values(counts)) n += v;
  return n;
}

/** 현장 작업자에게 새로 떨어진 배정 — `since` 이후의 배정·접수 기록 중 담당이 나인 것. */
export function newAssignments(
  activities: readonly Activity[],
  worker: string,
  since: string | undefined,
): Activity[] {
  if (!worker) return [];
  return activities.filter(
    (a) =>
      (a.type === 'assigned' || a.type === 'triaged') &&
      a.detail === worker &&
      (!since || a.at > since),
  );
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
