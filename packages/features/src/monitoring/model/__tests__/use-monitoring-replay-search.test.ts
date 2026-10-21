// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useMonitoringReplaySearch } from '../use-monitoring-replay-search';

/** 로컬 시각 → ISO(UTC, 초 단위). 도메인의 서버 형식과 같다. */
function iso(...parts: [number, number, number, number, number, number]) {
  return new Date(...parts).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

beforeEach(() => {
  // Date 만 가짜로 — 타이머는 진짜로 둔다(훅은 타이머를 쓰지 않는다).
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 21, 11, 39, 5));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useMonitoringReplaySearch', () => {
  it('기본값은 직전 정각 한 시간 전부터 10분이고 그대로 확정돼 있다', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    expect(result.current.draftStart).toBe('2026-10-21T10:00:00');
    expect(result.current.duration).toBe('10m');
    expect(result.current.canSearch).toBe(true);
    expect(result.current.query).toEqual({
      from: iso(2026, 9, 21, 10, 0, 0),
      to: iso(2026, 9, 21, 10, 10, 0),
    });
    expect(result.current.viewingFrom).toBe('2026-10-21T10:00:00');
    expect(result.current.viewingTo).toBe('2026-10-21T10:10:00');
  });

  it('미래 시작은 future 로 막히고 불러오기를 눌러도 확정 구간이 그대로다', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    const before = result.current.query;
    act(() => result.current.setDraftStart('2026-10-21T12:00:00'));
    expect(result.current.canSearch).toBe(false);
    expect(result.current.validationReason).toBe('future');
    expect(result.current.draftEnd).toBe('');
    act(() => result.current.submitSearch());
    expect(result.current.query).toBe(before);
  });

  it('종료가 지금을 넘으면 미리보기와 확정 구간 모두 지금으로 잘린다', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    act(() => result.current.setDraftStart('2026-10-21T11:35:00'));
    act(() => result.current.setDuration('30m'));
    expect(result.current.draftEnd).toBe('2026-10-21T11:39:05');
    act(() => result.current.submitSearch());
    expect(result.current.query).toEqual({
      from: iso(2026, 9, 21, 11, 35, 0),
      to: iso(2026, 9, 21, 11, 39, 5),
    });
  });

  it('잘린 구간을 시간이 지난 뒤 다시 누르면 늘어난 종료로 새 구간이 된다', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    act(() => result.current.setDraftStart('2026-10-21T11:35:00'));
    act(() => result.current.submitSearch());
    const first = result.current.query;
    vi.setSystemTime(new Date(2026, 9, 21, 11, 41, 0));
    act(() => result.current.submitSearch());
    expect(result.current.query).not.toBe(first);
    expect(result.current.query.to).toBe(iso(2026, 9, 21, 11, 41, 0));
  });

  it('렌더만으로는 확정 구간이 바뀌지 않는다 — 시계가 흘러도 같은 참조', () => {
    const { result, rerender } = renderHook(() =>
      useMonitoringReplaySearch('dock-1'),
    );
    const before = result.current.query;
    vi.setSystemTime(new Date(2026, 9, 21, 12, 30, 0));
    rerender();
    expect(result.current.query).toBe(before);
  });

  it('시작 초기화는 입력만 기본값으로 되돌리고 길이·확정 구간은 그대로 둔다', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    const query = result.current.query;
    act(() => result.current.setDraftStart('2026-10-21T08:15:30'));
    act(() => result.current.setDuration('30m'));
    act(() => result.current.resetDraftStart());
    expect(result.current.draftStart).toBe('2026-10-21T10:00:00');
    expect(result.current.duration).toBe('30m');
    expect(result.current.query).toBe(query);
    // 미래 입력도 초기화로 풀린다.
    act(() => result.current.setDraftStart('2026-10-21T23:00:00'));
    expect(result.current.validationReason).toBe('future');
    act(() => result.current.resetDraftStart());
    expect(result.current.canSearch).toBe(true);
  });

  it('시작 초기화는 누르는 순간의 시계로 계산한다 — 정각이 지나면 새 기본값', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    vi.setSystemTime(new Date(2026, 9, 21, 12, 5, 0));
    act(() => result.current.resetDraftStart());
    expect(result.current.draftStart).toBe('2026-10-21T11:00:00');
  });

  it('시작 초기화 함수는 렌더가 바뀌어도 같은 참조다(폼 memo 유지)', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    const reset = result.current.resetDraftStart;
    act(() => result.current.setDraftStart('2026-10-21T08:15:30'));
    expect(result.current.resetDraftStart).toBe(reset);
  });

  it('화면 검증이 낡았어도(입력 후 시간이 흐름) 누르는 순간 미래면 확정하지 않는다', () => {
    const { result } = renderHook(() => useMonitoringReplaySearch('dock-1'));
    const before = result.current.query;
    act(() => result.current.setDraftStart('2026-10-21T11:39:00'));
    expect(result.current.canSearch).toBe(true);
    // 시계를 되돌려 같은 입력이 미래가 되게 한다.
    vi.setSystemTime(new Date(2026, 9, 21, 11, 38, 0));
    act(() => result.current.submitSearch());
    expect(result.current.query).toBe(before);
  });
});
