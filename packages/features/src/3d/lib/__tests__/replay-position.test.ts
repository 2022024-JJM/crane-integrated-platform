import { describe, expect, it } from 'vitest';
import { cumulativeMs, frameIndexAtMs, totalMs } from '../replay-position';

const D = [5000, 5000, 2000, 8000];

describe('cumulativeMs / totalMs', () => {
  it('index 프레임의 시작 시각은 앞 프레임 길이의 합', () => {
    expect(cumulativeMs(D, 0)).toBe(0);
    expect(cumulativeMs(D, 1)).toBe(5000);
    expect(cumulativeMs(D, 3)).toBe(12000);
    expect(totalMs(D)).toBe(20000);
  });

  it('범위 밖 index 는 clamp, 음수 길이는 0 으로', () => {
    expect(cumulativeMs(D, -3)).toBe(0);
    expect(cumulativeMs(D, 99)).toBe(20000);
    expect(cumulativeMs([5000, -100, 5000], 3)).toBe(10000);
    expect(totalMs([])).toBe(0);
  });
});

describe('frameIndexAtMs', () => {
  it('시작 시각이 ms 이하인 마지막 프레임', () => {
    expect(frameIndexAtMs(D, 0)).toBe(0);
    expect(frameIndexAtMs(D, 4999)).toBe(0);
    expect(frameIndexAtMs(D, 5000)).toBe(1);
    expect(frameIndexAtMs(D, 11999)).toBe(2);
    expect(frameIndexAtMs(D, 12000)).toBe(3);
  });

  it('끝을 넘으면 마지막, 음수·NaN 은 0, 빈 목록은 0', () => {
    expect(frameIndexAtMs(D, 20000)).toBe(3);
    expect(frameIndexAtMs(D, 1e9)).toBe(3);
    expect(frameIndexAtMs(D, -1)).toBe(0);
    expect(frameIndexAtMs(D, Number.NaN)).toBe(0);
    expect(frameIndexAtMs([], 500)).toBe(0);
  });

  it('cumulativeMs 와 왕복한다', () => {
    for (let i = 0; i < D.length; i += 1) {
      expect(frameIndexAtMs(D, cumulativeMs(D, i))).toBe(i);
    }
  });
});
