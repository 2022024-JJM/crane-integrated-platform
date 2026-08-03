import { describe, expect, it } from 'vitest';
import { inspectionTone, isPastDue, OVERDUE_DAYS, repairTone } from './service-status';

const NOW = new Date('2026-07-20T12:00:00').getTime();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

describe('isPastDue — 매뉴얼 8p 5일 규칙', () => {
  it('경계값: 정확히 5일 지나면 지연', () => {
    expect(isPastDue(daysAgo(OVERDUE_DAYS), NOW)).toBe(true);
  });

  it('5일 미만은 지연이 아니다', () => {
    expect(isPastDue(daysAgo(2), NOW)).toBe(false);
    expect(isPastDue(daysAgo(4.9), NOW)).toBe(false);
  });

  it('5일 초과는 지연', () => {
    expect(isPastDue(daysAgo(30), NOW)).toBe(true);
  });

  it('미래 예정일은 지연이 아니다', () => {
    expect(isPastDue(new Date(NOW + 10 * DAY).toISOString(), NOW)).toBe(false);
  });

  it('값이 없거나 잘못된 날짜는 지연이 아니다', () => {
    expect(isPastDue(null, NOW)).toBe(false);
    expect(isPastDue(undefined, NOW)).toBe(false);
    expect(isPastDue('not-a-date', NOW)).toBe(false);
  });
});

describe('repairTone', () => {
  it('완료/진행중 상태가 우선한다', () => {
    expect(repairTone('completed', daysAgo(30), NOW)).toBe('completed');
    expect(repairTone('in_progress', daysAgo(30), NOW)).toBe('inProgress');
    expect(repairTone('re_inspection', null, NOW)).toBe('inProgress');
  });

  it('2일 지난 미완료는 빨강이 아니다', () => {
    expect(repairTone('received', daysAgo(2), NOW)).toBe('open');
  });

  it('예정 종료일이 없으면 open', () => {
    expect(repairTone('received', null, NOW)).toBe('open');
  });
});

describe('inspectionTone', () => {
  it('완료/진행중은 그대로', () => {
    expect(inspectionTone('completed', null, NOW)).toBe('completed');
    expect(inspectionTone('in_progress', null, NOW)).toBe('inProgress');
  });

  it('예정일을 넘겨주지 않으면 도메인의 overdue 판단을 신뢰한다', () => {
    expect(inspectionTone('overdue', undefined, NOW)).toBe('delayed');
  });

  it('overdue라도 5일이 안 지났으면 빨강이 아니다', () => {
    expect(inspectionTone('overdue', daysAgo(2), NOW)).toBe('open');
  });

  it('scheduled여도 5일 이상 지났으면 지연', () => {
    expect(inspectionTone('scheduled', daysAgo(10), NOW)).toBe('delayed');
  });

  it('미래 예정 점검은 open', () => {
    expect(inspectionTone('scheduled', new Date(NOW + 5 * DAY).toISOString(), NOW)).toBe('open');
  });
});
