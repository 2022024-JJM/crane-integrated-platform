import { describe, expect, it } from 'vitest';
import { resolveConnectionView } from '../use-realtime-connection-state';

describe('resolveConnectionView', () => {
  it('리플레이는 항상 replay/muted', () => {
    expect(resolveConnectionView('replay', 'open', true, true)).toEqual({
      state: 'replay',
      tone: 'muted',
    });
  });

  it('시뮬레이션은 러너 재생 여부만 본다', () => {
    expect(resolveConnectionView('simulation', 'closed', true, true)).toEqual({
      state: 'simulationRunning',
      tone: 'good',
    });
    expect(resolveConnectionView('simulation', 'open', false, false)).toEqual({
      state: 'simulationPaused',
      tone: 'muted',
    });
  });

  it('실시간은 보류가 소켓 상태보다 우선, 그 외는 소켓 상태', () => {
    expect(resolveConnectionView('realtime', 'open', true, false).state).toBe(
      'held',
    );
    expect(resolveConnectionView('realtime', 'open', false, false)).toEqual({
      state: 'open',
      tone: 'good',
    });
    expect(
      resolveConnectionView('realtime', 'connecting', false, false),
    ).toEqual({ state: 'connecting', tone: 'warn' });
    for (const socket of ['idle', 'closing', 'closed'] as const) {
      expect(resolveConnectionView('realtime', socket, false, false)).toEqual({
        state: 'closed',
        tone: 'bad',
      });
    }
  });
});
