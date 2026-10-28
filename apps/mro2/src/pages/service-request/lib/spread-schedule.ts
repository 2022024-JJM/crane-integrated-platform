import type { ScheduleEntry } from '@crane/features/triage';
import { addDays, nextWorkday } from '../../../shared/lib/workdays';

/**
 * 지연 건 담당자별 분배 — 고른 작업을 `start` 부터 평일에, 담당자마다 하루
 * `capPerDay` 건씩 차례로 깐다. 입력 순서가 곧 우선순위(목록이 이미 긴급·
 * 오래된 순)다. 담당자가 없는 건은 건너뛴다(`skipped`) — 날짜만 잡고 사람을
 * 안 정하면 또 지연된다. 결정론적이라 같은 입력에 같은 결과가 나온다.
 */
export interface SpreadItem {
  kind: 'repair' | 'inspection';
  id: string;
  assignee: string;
}

export interface SpreadResult {
  entries: ScheduleEntry[];
  skipped: number;
}

export function spreadSchedule(
  items: readonly SpreadItem[],
  start: string,
  /** 담당자의 그날 기존 부하(고른 건 제외). */
  load: (assignee: string, date: string) => number,
  capPerDay = 2,
  horizonDays = 90,
): SpreadResult {
  const taken = new Map<string, number>();
  const entries: ScheduleEntry[] = [];
  let skipped = 0;
  const first = nextWorkday(start);
  for (const item of items) {
    const who = item.assignee.trim();
    if (!who) {
      skipped += 1;
      continue;
    }
    let date = first;
    let placed = false;
    for (let i = 0; i < horizonDays; i += 1) {
      const key = `${who}|${date}`;
      const used = (taken.get(key) ?? 0) + load(who, date);
      if (used < capPerDay) {
        taken.set(key, (taken.get(key) ?? 0) + 1);
        entries.push({ kind: item.kind, id: item.id, date });
        placed = true;
        break;
      }
      date = nextWorkday(addDays(date, 1));
    }
    if (!placed) skipped += 1;
  }
  return { entries, skipped };
}
