import { describe, expect, it } from 'vitest';
import {
  createRealtimeCadenceTracker,
  REALTIME_SMOOTH_MAX_S,
  REALTIME_SMOOTH_MIN_S,
  resolveRealtimeSmoothTime,
} from '../realtime-smoothing';

describe('resolveRealtimeSmoothTime', () => {
  it('간격(ms)을 초로 — 1Hz 변화면 1초, 500ms 면 0.5초', () => {
    expect(resolveRealtimeSmoothTime(1000)).toBe(1);
    expect(resolveRealtimeSmoothTime(500)).toBe(0.5);
  });

  it('하한·상한으로 자른다 — 경계 정확값은 통과, 밖은 경계로', () => {
    expect(resolveRealtimeSmoothTime(REALTIME_SMOOTH_MIN_S * 1000)).toBe(
      REALTIME_SMOOTH_MIN_S,
    );
    expect(resolveRealtimeSmoothTime(REALTIME_SMOOTH_MIN_S * 1000 - 1)).toBe(
      REALTIME_SMOOTH_MIN_S,
    );
    expect(resolveRealtimeSmoothTime(REALTIME_SMOOTH_MAX_S * 1000)).toBe(
      REALTIME_SMOOTH_MAX_S,
    );
    expect(resolveRealtimeSmoothTime(REALTIME_SMOOTH_MAX_S * 1000 + 1)).toBe(
      REALTIME_SMOOTH_MAX_S,
    );
    expect(resolveRealtimeSmoothTime(60_000)).toBe(REALTIME_SMOOTH_MAX_S);
  });

  it('0·음수(같은 프레임 안의 연속 변화·시계 역행)는 하한', () => {
    expect(resolveRealtimeSmoothTime(0)).toBe(REALTIME_SMOOTH_MIN_S);
    expect(resolveRealtimeSmoothTime(-5)).toBe(REALTIME_SMOOTH_MIN_S);
  });

  it('모르는 간격(첫 값)·비유한은 undefined = 소비자 기본', () => {
    expect(resolveRealtimeSmoothTime(undefined)).toBeUndefined();
    expect(resolveRealtimeSmoothTime(NaN)).toBeUndefined();
    expect(resolveRealtimeSmoothTime(Infinity)).toBeUndefined();
    expect(resolveRealtimeSmoothTime(-Infinity)).toBeUndefined();
  });
});

describe('createRealtimeCadenceTracker', () => {
  it('첫 값은 기본(undefined), 그 값의 재발행도 기본 — 아직 간격을 모른다', () => {
    const tracker = createRealtimeCadenceTracker();
    expect(tracker.observe('c1.a', 5, 0)).toBeUndefined();
    expect(tracker.observe('c1.a', 5, 1000)).toBeUndefined();
    expect(tracker.size).toBe(1);
  });

  it('값이 바뀌면 직전 변화와의 간격이 스무딩 시간이다', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    expect(tracker.observe('c1.a', 6, 1000)).toBe(1);
    expect(tracker.observe('c1.a', 7, 1250)).toBe(0.25);
  });

  it('바뀌지 않은 재발행은 마지막 스무딩 시간을 그대로 이어받는다 — 진행 중 스무딩이 잘리지 않게', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    expect(tracker.observe('c1.a', 6, 1000)).toBe(1);
    // 250ms 묶음마다 같은 값이 다시 와도 1초가 유지된다.
    expect(tracker.observe('c1.a', 6, 1250)).toBe(1);
    expect(tracker.observe('c1.a', 6, 1500)).toBe(1);
    expect(tracker.observe('c1.a', 6, 1750)).toBe(1);
    // 재발행은 변경 시각을 밀지 않는다 — 다음 변화의 간격은 마지막 변화 기준.
    expect(tracker.observe('c1.a', 7, 2000)).toBe(1);
  });

  it('오래 멈춘 뒤 첫 변화는 상한, 그 다음 변화부터 실제 간격', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    tracker.observe('c1.a', 6, 1000);
    expect(tracker.observe('c1.a', 7, 61_000)).toBe(REALTIME_SMOOTH_MAX_S);
    expect(tracker.observe('c1.a', 8, 62_000)).toBe(1);
  });

  it('같은 시각(한 프레임)에 두 번 바뀌면 하한', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    tracker.observe('c1.a', 6, 1000);
    expect(tracker.observe('c1.a', 7, 1000)).toBe(REALTIME_SMOOTH_MIN_S);
  });

  it('키는 서로 독립이다', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    tracker.observe('c1.b', 5, 500);
    expect(tracker.observe('c1.a', 6, 1000)).toBe(1);
    expect(tracker.observe('c1.b', 6, 1000)).toBe(0.5);
    expect(tracker.size).toBe(2);
  });

  it('clear 뒤에는 모든 키가 첫 값으로 돌아간다', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    tracker.observe('c1.a', 6, 1000);
    tracker.clear();
    expect(tracker.size).toBe(0);
    expect(tracker.observe('c1.a', 7, 2000)).toBeUndefined();
    expect(tracker.observe('c1.a', 8, 3000)).toBe(1);
  });

  it('비유한 시각이 섞이면 기본으로 떨어지고 상태는 오염되지 않는다', () => {
    const tracker = createRealtimeCadenceTracker();
    tracker.observe('c1.a', 5, 0);
    expect(tracker.observe('c1.a', 6, NaN)).toBeUndefined();
    // 그 뒤 정상 시각은 NaN 기준이라 역시 기본 — 다음 변화부터 회복한다.
    expect(tracker.observe('c1.a', 7, 1000)).toBeUndefined();
    expect(tracker.observe('c1.a', 8, 2000)).toBe(1);
  });
});
