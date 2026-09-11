import { describe, expect, it } from 'vitest';
import {
  getTimeZoneOffsetMs,
  getZonedTimeParts,
  isValidTimeZone,
  setZonedMinuteOfDay,
  startOfZonedDay,
  zonedWallTimeToUtc,
} from '../time-zone';

const HOUR = 3_600_000;

describe('getZonedTimeParts', () => {
  it('UTC epoch 를 시간대 벽시계로 옮긴다 (서울 +9, DST 없음)', () => {
    // 2026-01-15T03:30:00Z → 서울 12:30
    const utc = Date.UTC(2026, 0, 15, 3, 30, 0);
    const parts = getZonedTimeParts(utc, 'Asia/Seoul');
    expect(parts).toMatchObject({
      year: 2026,
      month: 1,
      day: 15,
      hour: 12,
      minute: 30,
      second: 0,
      minuteOfDay: 12 * 60 + 30,
    });
  });

  it('필라델피아는 여름 EDT(-4)·겨울 EST(-5) 를 구분한다', () => {
    const summer = Date.UTC(2026, 6, 1, 12, 0, 0);
    expect(getZonedTimeParts(summer, 'America/New_York')?.hour).toBe(8);
    const winter = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(getZonedTimeParts(winter, 'America/New_York')?.hour).toBe(7);
  });

  it('자정은 24 가 아니라 0 시로 나온다', () => {
    // 서울 자정 = 전날 15:00Z
    const utc = Date.UTC(2026, 2, 9, 15, 0, 0);
    expect(getZonedTimeParts(utc, 'Asia/Seoul')).toMatchObject({
      day: 10,
      hour: 0,
      minuteOfDay: 0,
    });
  });

  it('NaN·무한대·잘못된 시간대는 null', () => {
    expect(getZonedTimeParts(Number.NaN, 'Asia/Seoul')).toBeNull();
    expect(
      getZonedTimeParts(Number.POSITIVE_INFINITY, 'Asia/Seoul'),
    ).toBeNull();
    expect(getZonedTimeParts(0, 'Not/AZone')).toBeNull();
  });
});

describe('getTimeZoneOffsetMs', () => {
  it('서울은 항상 +9h', () => {
    expect(getTimeZoneOffsetMs(Date.UTC(2026, 0, 1), 'Asia/Seoul')).toBe(
      9 * HOUR,
    );
    expect(getTimeZoneOffsetMs(Date.UTC(2026, 6, 1), 'Asia/Seoul')).toBe(
      9 * HOUR,
    );
  });

  it('뉴욕은 DST 에 따라 -4h/-5h', () => {
    expect(getTimeZoneOffsetMs(Date.UTC(2026, 6, 1), 'America/New_York')).toBe(
      -4 * HOUR,
    );
    expect(getTimeZoneOffsetMs(Date.UTC(2026, 0, 1), 'America/New_York')).toBe(
      -5 * HOUR,
    );
  });

  it('초 이하(ms)는 오프셋에 새지 않는다', () => {
    expect(
      getTimeZoneOffsetMs(Date.UTC(2026, 0, 1, 0, 0, 0, 777), 'Asia/Seoul'),
    ).toBe(9 * HOUR);
  });

  it('잘못된 시간대는 0', () => {
    expect(getTimeZoneOffsetMs(0, 'Not/AZone')).toBe(0);
  });
});

describe('zonedWallTimeToUtc', () => {
  it('벽시계 → UTC 왕복이 일치한다', () => {
    const utc = zonedWallTimeToUtc(
      { year: 2026, month: 9, day: 11, hour: 14, minute: 30 },
      'America/New_York',
    );
    expect(utc).toBe(Date.UTC(2026, 8, 11, 18, 30, 0));
    expect(getZonedTimeParts(utc, 'America/New_York')).toMatchObject({
      hour: 14,
      minute: 30,
    });
  });

  it('DST 전환 직후의 벽시계도 그날의 오프셋으로 해석한다', () => {
    // 2026-03-08 02:00 EST 에 EDT 로 전환 — 03:30 은 EDT(-4).
    const utc = zonedWallTimeToUtc(
      { year: 2026, month: 3, day: 8, hour: 3, minute: 30 },
      'America/New_York',
    );
    expect(utc).toBe(Date.UTC(2026, 2, 8, 7, 30, 0));
  });

  it('존재하지 않는 시각(DST 틈)도 유효한 epoch 를 돌려준다', () => {
    // 02:30 은 2026-03-08 뉴욕에 존재하지 않는다 — 어느 쪽으로든 유한값.
    const utc = zonedWallTimeToUtc(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      'America/New_York',
    );
    expect(Number.isFinite(utc)).toBe(true);
    // 앞뒤 1시간 안에 떨어진다.
    expect(Math.abs(utc - Date.UTC(2026, 2, 8, 7, 0, 0))).toBeLessThanOrEqual(
      HOUR,
    );
  });

  it('시·분·초 생략은 0', () => {
    expect(
      zonedWallTimeToUtc({ year: 2026, month: 1, day: 1 }, 'Asia/Seoul'),
    ).toBe(Date.UTC(2025, 11, 31, 15, 0, 0));
  });
});

describe('setZonedMinuteOfDay / startOfZonedDay', () => {
  const noonSeoul = Date.UTC(2026, 5, 20, 3, 0, 0); // 서울 12:00

  it('같은 현장 날짜의 다른 분으로 옮긴다', () => {
    const at1830 = setZonedMinuteOfDay(noonSeoul, 18 * 60 + 30, 'Asia/Seoul');
    expect(getZonedTimeParts(at1830, 'Asia/Seoul')).toMatchObject({
      day: 20,
      hour: 18,
      minute: 30,
    });
  });

  it('범위 밖 분은 [0, 1439] 로 클램프한다', () => {
    const under = setZonedMinuteOfDay(noonSeoul, -50, 'Asia/Seoul');
    expect(getZonedTimeParts(under, 'Asia/Seoul')?.minuteOfDay).toBe(0);
    const over = setZonedMinuteOfDay(noonSeoul, 5000, 'Asia/Seoul');
    expect(getZonedTimeParts(over, 'Asia/Seoul')?.minuteOfDay).toBe(1439);
  });

  it('startOfZonedDay 는 현장 자정', () => {
    const midnight = startOfZonedDay(noonSeoul, 'Asia/Seoul');
    expect(midnight).toBe(Date.UTC(2026, 5, 19, 15, 0, 0));
  });

  it('유효하지 않은 시각은 그대로 돌려준다', () => {
    expect(setZonedMinuteOfDay(Number.NaN, 10, 'Asia/Seoul')).toBeNaN();
  });
});

describe('isValidTimeZone', () => {
  it('IANA 이름은 true, 엉뚱한 이름은 false', () => {
    expect(isValidTimeZone('Asia/Seoul')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
