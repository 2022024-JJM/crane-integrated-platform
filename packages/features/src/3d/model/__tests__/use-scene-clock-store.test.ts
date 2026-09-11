import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSceneClockMs, useSceneClockStore } from '../use-scene-clock-store';

const store = useSceneClockStore;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-11T03:00:00Z'));
  store.setState({
    mode: 'live',
    manualTimeMs: Date.now(),
    liveNowMs: Date.now(),
    yardLights: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSceneClockStore', () => {
  it('기본은 live — readSceneClockMs 가 실시계를 돌려준다', () => {
    expect(store.getState().mode).toBe('live');
    expect(readSceneClockMs()).toBe(Date.now());
    vi.setSystemTime(new Date('2026-09-11T04:00:00Z'));
    expect(readSceneClockMs()).toBe(Date.parse('2026-09-11T04:00:00Z'));
  });

  it('setManualTime 은 manual 로 전환하고 그 값을 고정한다', () => {
    const fixed = Date.parse('2026-09-11T20:30:00Z');
    store.getState().setManualTime(fixed);
    expect(store.getState().mode).toBe('manual');
    expect(store.getState().manualTimeMs).toBe(fixed);
    vi.setSystemTime(new Date('2026-09-12T00:00:00Z'));
    expect(readSceneClockMs()).toBe(fixed);
  });

  it('같은 값 재설정은 상태 참조를 유지한다 (불필요한 리렌더 방지)', () => {
    const fixed = 1_700_000_000_000;
    store.getState().setManualTime(fixed);
    const before = store.getState();
    store.getState().setManualTime(fixed);
    expect(store.getState()).toBe(before);
  });

  it('NaN·무한대는 무시한다 — 모드도 바뀌지 않는다', () => {
    const before = store.getState();
    store.getState().setManualTime(Number.NaN);
    store.getState().setManualTime(Number.POSITIVE_INFINITY);
    expect(store.getState()).toBe(before);
    expect(store.getState().mode).toBe('live');
  });

  it('setLive 는 live 로 돌아오며 liveNowMs 를 갱신하고, 마지막 manual 값은 남긴다', () => {
    const fixed = 1_700_000_000_000;
    store.getState().setManualTime(fixed);
    vi.setSystemTime(new Date('2026-09-11T05:00:00Z'));
    store.getState().setLive();
    expect(store.getState().mode).toBe('live');
    expect(store.getState().liveNowMs).toBe(Date.now());
    expect(store.getState().manualTimeMs).toBe(fixed);
    expect(readSceneClockMs()).toBe(Date.now());
  });

  it('이미 live 면 setLive 는 no-op (참조 유지)', () => {
    const before = store.getState();
    store.getState().setLive();
    expect(store.getState()).toBe(before);
  });

  it('야간 작업등은 기본 켜짐이고 같은 값 재설정은 참조를 유지한다', () => {
    expect(store.getState().yardLights).toBe(true);
    const before = store.getState();
    store.getState().setYardLights(true);
    expect(store.getState()).toBe(before);
    store.getState().setYardLights(false);
    expect(store.getState().yardLights).toBe(false);
    expect(store.getState().mode).toBe('live');
  });

  it('tickLive 는 liveNowMs 만 실시계로 갱신한다', () => {
    vi.setSystemTime(new Date('2026-09-11T06:00:00Z'));
    store.getState().tickLive();
    expect(store.getState().liveNowMs).toBe(Date.now());
    expect(store.getState().mode).toBe('live');
  });
});
