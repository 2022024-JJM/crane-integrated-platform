import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRealtimeIngestStats,
  recordRealtimeDrain,
  recordRealtimeMessage,
  startRealtimeIngestStats,
} from '../realtime-ingest-stats';

describe('realtime-ingest-stats', () => {
  let stop: () => void;
  let nowMs = 0;

  beforeEach(() => {
    nowMs = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    stop = startRealtimeIngestStats();
  });

  afterEach(() => {
    stop();
    vi.restoreAllMocks();
  });

  it('1초 창의 비율과 누적을 따로 센다', () => {
    recordRealtimeMessage(1, 0, 0.2);
    recordRealtimeMessage(3, 1, 0.3); // 배치: 태그 3 수용, 1 거부
    recordRealtimeDrain(4, 4);
    recordRealtimeDrain(0, 0);
    nowMs += 2000;

    const s = getRealtimeIngestStats();
    expect(s.receivedPerS).toBe(1); // 2건 / 2초
    expect(s.tagsPerS).toBe(2); // 4태그 / 2초
    expect(s.rejectedPerS).toBe(1); // 1 / 2초 → 반올림 1
    expect(s.fps).toBe(1);
    expect(s.drainAvg).toBe(2);
    expect(s.drainMax).toBe(4);
    expect(s.bufferMax).toBe(4);
    expect(s.totalReceived).toBe(2);
    expect(s.totalTags).toBe(4);
    expect(s.totalRejected).toBe(1);
  });

  it('창을 닫으면 창 카운터는 비고 누적은 남는다', () => {
    recordRealtimeMessage(1, 0, 0);
    nowMs += 1000;
    const first = getRealtimeIngestStats();
    expect(first.totalReceived).toBe(1);

    nowMs += 1000;
    const second = getRealtimeIngestStats();
    expect(second.receivedPerS).toBe(0);
    expect(second.totalReceived).toBe(1);
  });

  it('1초가 안 지났으면 직전 스냅샷을 그대로 돌려준다', () => {
    recordRealtimeMessage(1, 0, 0);
    nowMs += 1000;
    const a = getRealtimeIngestStats();
    recordRealtimeMessage(1, 0, 0);
    nowMs += 500;
    expect(getRealtimeIngestStats()).toBe(a);
  });

  it('빈 창도 NaN 없이 0 으로 계산한다', () => {
    nowMs += 1000;
    const s = getRealtimeIngestStats();
    expect(s.drainAvg).toBe(0);
    expect(Number.isNaN(s.tagsPerS)).toBe(false);
  });
});
