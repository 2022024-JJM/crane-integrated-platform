import { describe, expect, it } from 'vitest';
import { formatSimClock } from '../sim-clock';

describe('formatSimClock', () => {
  it('mm:ss, 초 단위 내림, 음수·NaN 은 00:00, 한 시간 넘으면 분이 커진다', () => {
    expect(formatSimClock(0)).toBe('00:00');
    expect(formatSimClock(999)).toBe('00:00');
    expect(formatSimClock(61_500)).toBe('01:01');
    expect(formatSimClock(-5)).toBe('00:00');
    expect(formatSimClock(NaN)).toBe('00:00');
    expect(formatSimClock(3_600_000)).toBe('60:00');
  });
});
