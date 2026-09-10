import { describe, expect, it } from 'vitest';
import type {
  AlarmJournalEntry,
  CollisionJournalEntry,
} from '../../model/types';
import {
  bucketAlarmsByDay,
  bucketCollisionsByDay,
  countToday,
  toLocalDateKey,
} from '../aggregate-journal';

// 로컬 자정 기준으로 만들어 타임존과 무관하게 결정론을 유지한다.
const NOW = new Date(2026, 8, 10, 12, 0, 0).getTime(); // 2026-09-10 12:00 로컬

function collisionAt(at: number): CollisionJournalEntry {
  return {
    key: `${at}:a|b`,
    at,
    pairKey: 'a|b',
    regionId: 'philly-dock-2',
    a: { modelId: 'a', equipName: 'A' },
    b: { modelId: 'b', equipName: 'B' },
    contactPoint: [0, 0, 0],
  };
}

function alarmAt(time: number, severity: AlarmJournalEntry['severity']) {
  return {
    id: `alarm-${time}-${severity}`,
    regionId: 'philly-dock-2',
    craneId: 'GC_04',
    severity,
    timestamp: new Date(time).toISOString(),
    alarmCode: null,
    alarmName: null,
    active: true,
  } satisfies AlarmJournalEntry;
}

describe('toLocalDateKey', () => {
  it('로컬 날짜로 자른다 — 자정 경계 정확값', () => {
    const midnight = new Date(2026, 8, 10, 0, 0, 0).getTime();
    expect(toLocalDateKey(midnight)).toBe('2026-09-10');
    expect(toLocalDateKey(midnight - 1)).toBe('2026-09-09');
  });

  it('한 자리 월·일을 0 패딩한다', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
  });
});

describe('bucketCollisionsByDay', () => {
  it('오늘 포함 최근 N일을 오래된 날부터, 빈 날은 0 으로 채운다', () => {
    const points = bucketCollisionsByDay([], 7, NOW);
    expect(points).toHaveLength(7);
    expect(points[0].dateKey).toBe('2026-09-04');
    expect(points[6].dateKey).toBe('2026-09-10');
    expect(points.every((p) => p.count === 0)).toBe(true);
  });

  it('날짜별로 센다 — 창 밖(N일 전·미래)은 제외', () => {
    const day = 24 * 60 * 60 * 1000;
    const entries = [
      collisionAt(NOW), // 오늘
      collisionAt(NOW - day), // 어제
      collisionAt(NOW - day), // 어제
      collisionAt(NOW - 7 * day), // 창 밖 (7일 전 = 8번째 날)
      collisionAt(NOW + day), // 미래
    ];
    const points = bucketCollisionsByDay(entries, 7, NOW);
    expect(points[6]).toEqual({ dateKey: '2026-09-10', count: 1 });
    expect(points[5]).toEqual({ dateKey: '2026-09-09', count: 2 });
    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(3);
  });

  it('창 경계 정확값 — 6일 전 자정은 포함, 그 1ms 전은 제외', () => {
    const oldestMidnight = new Date(2026, 8, 4, 0, 0, 0).getTime();
    const inside = bucketCollisionsByDay(
      [collisionAt(oldestMidnight)],
      7,
      NOW,
    );
    expect(inside[0].count).toBe(1);
    const outside = bucketCollisionsByDay(
      [collisionAt(oldestMidnight - 1)],
      7,
      NOW,
    );
    expect(outside.reduce((sum, p) => sum + p.count, 0)).toBe(0);
  });
});

describe('bucketAlarmsByDay', () => {
  it('심각도를 분해해 세고 total 과 합이 맞는다', () => {
    const entries = [
      alarmAt(NOW, 'critical'),
      alarmAt(NOW - 1000, 'high'),
      alarmAt(NOW - 2000, 'high'),
      alarmAt(NOW - 3000, 'info'),
    ];
    const points = bucketAlarmsByDay(entries, 7, NOW);
    const today = points[6];
    expect(today).toEqual({
      dateKey: '2026-09-10',
      critical: 1,
      high: 2,
      medium: 0,
      info: 1,
      total: 4,
    });
  });

  it('파싱 불가 timestamp 는 조용히 건너뛴다', () => {
    const bad = { ...alarmAt(NOW, 'info'), timestamp: 'not-a-date' };
    const points = bucketAlarmsByDay([bad], 7, NOW);
    expect(points.reduce((sum, p) => sum + p.total, 0)).toBe(0);
  });
});

describe('countToday', () => {
  it('로컬 오늘만 센다 — 자정 경계', () => {
    const midnight = new Date(2026, 8, 10, 0, 0, 0).getTime();
    const entries = [
      collisionAt(midnight),
      collisionAt(midnight - 1),
      collisionAt(NOW),
    ];
    expect(countToday(entries, (e) => e.at, NOW)).toBe(2);
  });

  it('빈 배열은 0', () => {
    expect(countToday([], () => 0, NOW)).toBe(0);
  });
});
