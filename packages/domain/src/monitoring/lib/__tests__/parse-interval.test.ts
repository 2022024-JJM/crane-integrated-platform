import { describe, expect, it } from 'vitest';
import type { ReplayLiteFrame } from '../../model/types';
import { getReplayFrameDurationsMs } from '../parse-interval';

function frame(timestamp: string): ReplayLiteFrame {
  return { timestamp, cranes: [] };
}

describe('getReplayFrameDurationsMs', () => {
  it('프레임 사이 시간 차이를 길이로 쓰고 마지막은 0 — 합이 시간 폭과 같다', () => {
    const durations = getReplayFrameDurationsMs([
      frame('2026-10-21T00:00:00Z'),
      frame('2026-10-21T00:00:01Z'),
      frame('2026-10-21T00:00:03Z'),
    ]);
    expect(durations).toEqual([1000, 2000, 0]);
    expect(durations.reduce((sum, ms) => sum + ms, 0)).toBe(3000);
  });

  it('1초 격자 601 프레임이면 길이 합이 정확히 10분', () => {
    const base = Date.UTC(2026, 9, 21, 0, 0, 0);
    const frames = Array.from({ length: 601 }, (_, i) =>
      frame(new Date(base + i * 1000).toISOString()),
    );
    const durations = getReplayFrameDurationsMs(frames);
    expect(durations).toHaveLength(601);
    expect(durations[600]).toBe(0);
    expect(durations.reduce((sum, ms) => sum + ms, 0)).toBe(600_000);
  });

  it('못 읽는 시각이나 역행하는 시각은 기본값(5초)으로 남긴다', () => {
    expect(
      getReplayFrameDurationsMs([
        frame('garbage'),
        frame('2026-10-21T00:00:05Z'),
        frame('2026-10-21T00:00:04Z'),
        frame('2026-10-21T00:00:09Z'),
      ]),
    ).toEqual([5000, 5000, 5000, 0]);
  });

  it('빈 목록은 빈 배열, 프레임 하나는 기본값 하나', () => {
    expect(getReplayFrameDurationsMs([])).toEqual([]);
    expect(getReplayFrameDurationsMs([frame('2026-10-21T00:00:00Z')])).toEqual([
      5000,
    ]);
  });
});
