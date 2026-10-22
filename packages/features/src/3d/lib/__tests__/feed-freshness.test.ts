import { describe, expect, it } from 'vitest';
import {
  FEED_STALE_MS,
  formatFeedClock,
  resolveFeedFreshness,
} from '../feed-freshness';

const NOW = 1_000_000;

describe('resolveFeedFreshness', () => {
  it('보류가 소켓 상태보다 앞선다', () => {
    expect(resolveFeedFreshness('open', true, NOW, NOW)).toEqual({
      state: 'held',
      tone: 'warn',
      ageMs: 0,
    });
    expect(resolveFeedFreshness('off', true, null, NOW).state).toBe('held');
  });

  it('연결 중·재연결은 connecting, 끊김은 closed — 경과는 그대로 싣는다', () => {
    expect(resolveFeedFreshness('connecting', false, NOW - 3_000, NOW)).toEqual(
      { state: 'connecting', tone: 'warn', ageMs: 3_000 },
    );
    expect(resolveFeedFreshness('reconnecting', false, null, NOW)).toEqual({
      state: 'connecting',
      tone: 'warn',
      ageMs: null,
    });
    expect(resolveFeedFreshness('off', false, NOW - 10, NOW)).toEqual({
      state: 'closed',
      tone: 'bad',
      ageMs: 10,
    });
  });

  it('연결됐지만 아직 묶음이 없으면 waiting — NaN 시각도 없는 것', () => {
    expect(resolveFeedFreshness('open', false, null, NOW)).toEqual({
      state: 'waiting',
      tone: 'muted',
      ageMs: null,
    });
    expect(resolveFeedFreshness('open', false, NaN, NOW).state).toBe('waiting');
  });

  it('stale 경계 — 정확값은 live, +1ms 는 stale', () => {
    expect(
      resolveFeedFreshness('open', false, NOW - FEED_STALE_MS, NOW),
    ).toEqual({ state: 'live', tone: 'good', ageMs: FEED_STALE_MS });
    expect(
      resolveFeedFreshness('open', false, NOW - FEED_STALE_MS - 1, NOW),
    ).toEqual({ state: 'stale', tone: 'warn', ageMs: FEED_STALE_MS + 1 });
  });

  it('미래 수신 시각은 경과 0 으로 깎는다', () => {
    expect(resolveFeedFreshness('open', false, NOW + 500, NOW).ageMs).toBe(0);
  });

  it('staleMs 를 바꾸면 경계가 따라온다', () => {
    expect(
      resolveFeedFreshness('open', false, NOW - 2_000, NOW, 1_000).state,
    ).toBe('stale');
  });
});

describe('formatFeedClock', () => {
  // 2024-01-01T00:00:05Z — 서울 09:00:05, 뉴욕 19:00:05(전날).
  const MS = Date.UTC(2024, 0, 1, 0, 0, 5);

  it('현장 시간대로 HH:MM:SS 를 만든다', () => {
    expect(formatFeedClock(MS, 'Asia/Seoul')).toBe('09:00:05');
    expect(formatFeedClock(MS, 'America/New_York')).toBe('19:00:05');
  });

  it('못 읽는 시각·시간대는 null, 시간대가 없으면 로컬 시간', () => {
    expect(formatFeedClock(NaN, 'Asia/Seoul')).toBeNull();
    expect(formatFeedClock(MS, 'Not/AZone')).toBeNull();
    const local = new Date(MS);
    expect(formatFeedClock(MS, null)).toBe(
      [local.getHours(), local.getMinutes(), local.getSeconds()]
        .map((v) => String(v).padStart(2, '0'))
        .join(':'),
    );
  });
});
