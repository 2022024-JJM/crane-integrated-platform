import { describe, expect, it } from 'vitest';
import {
  REALTIME_SMOOTH_MAX_S,
  REALTIME_SMOOTH_MIN_S,
  resolveRealtimeSmoothTime,
} from '../realtime-smoothing';

describe('resolveRealtimeSmoothTime', () => {
  it('간격(ms)을 초로 — 1Hz 수신이면 1초 스무딩', () => {
    expect(resolveRealtimeSmoothTime(1000)).toBe(1);
    expect(resolveRealtimeSmoothTime(500)).toBe(0.5);
  });
  it('하한·상한으로 자른다 — 촘촘한 수신은 하한, 오래 비었던 뒤는 상한', () => {
    expect(resolveRealtimeSmoothTime(10)).toBe(REALTIME_SMOOTH_MIN_S);
    expect(resolveRealtimeSmoothTime(60_000)).toBe(REALTIME_SMOOTH_MAX_S);
  });
  it('모르는 간격(첫 값)·비유한·0 이하는 undefined = 소비자 기본', () => {
    expect(resolveRealtimeSmoothTime(undefined)).toBeUndefined();
    expect(resolveRealtimeSmoothTime(NaN)).toBeUndefined();
    expect(resolveRealtimeSmoothTime(0)).toBeUndefined();
    expect(resolveRealtimeSmoothTime(-5)).toBeUndefined();
  });
});
