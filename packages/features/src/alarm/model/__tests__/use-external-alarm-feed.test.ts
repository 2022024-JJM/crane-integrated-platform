// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

import {
  useExternalAlarmFeed,
  useExternalAlarms,
  useExternalAlarmFeedStore,
  type ExternalAlarm,
} from '../use-external-alarm-feed';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function alarm(
  id: string,
  timestamp: string,
  overrides: Partial<ExternalAlarm> = {},
): ExternalAlarm {
  return {
    id,
    severity: 'medium',
    active: true,
    title: `${id} 제목`,
    message: `${id} 본문`,
    source: 'PBS-5BAY',
    timestamp,
    ...overrides,
  };
}

beforeEach(() => {
  useExternalAlarmFeedStore.setState({ feeds: {} });
});

afterEach(() => {
  cleanup();
});

describe('외부 알람 공급자', () => {
  it('마운트하면 벨이 그 목록을 본다', () => {
    const feed = [alarm('a', '2026-09-07T01:00:00.000Z')];
    renderHook(() => useExternalAlarmFeed('indoorshop', feed));

    const { result } = renderHook(() => useExternalAlarms());
    expect(result.current.map((a) => a.id)).toEqual(['a']);
  });

  it('언마운트하면 그 공급자의 알람이 사라진다 — 화면을 벗어나면 옛 값이 굳지 않는다', () => {
    const feed = [alarm('a', '2026-09-07T01:00:00.000Z')];
    const mounted = renderHook(() => useExternalAlarmFeed('indoorshop', feed));

    expect(useExternalAlarmFeedStore.getState().feeds.indoorshop).toHaveLength(
      1,
    );
    act(() => mounted.unmount());
    expect(useExternalAlarmFeedStore.getState().feeds.indoorshop).toBeUndefined();
  });

  it('공급자가 여럿이면 시각 최신 순으로 한 줄기가 된다', () => {
    renderHook(() =>
      useExternalAlarmFeed('indoorshop', [
        alarm('old', '2026-09-07T01:00:00.000Z'),
      ]),
    );
    renderHook(() =>
      useExternalAlarmFeed('other', [alarm('new', '2026-09-07T03:00:00.000Z')]),
    );

    const { result } = renderHook(() => useExternalAlarms());
    expect(result.current.map((a) => a.id)).toEqual(['new', 'old']);
  });

  it('내용이 같으면 상태 참조를 유지한다 — 폴링 한 틱마다 벨이 다시 그리지 않게', () => {
    const publish = useExternalAlarmFeedStore.getState().publish;
    act(() => publish('indoorshop', [alarm('a', '2026-09-07T01:00:00.000Z')]));
    const before = useExternalAlarmFeedStore.getState().feeds;

    /* 같은 내용의 **새 배열** — 판정이 다시 돌면 이렇게 온다 */
    act(() => publish('indoorshop', [alarm('a', '2026-09-07T01:00:00.000Z')]));
    expect(useExternalAlarmFeedStore.getState().feeds).toBe(before);

    /* 한 글자라도 다르면 반영된다 */
    act(() =>
      publish('indoorshop', [
        alarm('a', '2026-09-07T01:00:00.000Z', { active: false }),
      ]),
    );
    expect(useExternalAlarmFeedStore.getState().feeds).not.toBe(before);
  });

  it('없는 공급자를 거둬도 상태 참조가 그대로다 (no-op)', () => {
    const before = useExternalAlarmFeedStore.getState().feeds;
    act(() => useExternalAlarmFeedStore.getState().withdraw('없는공급자'));
    expect(useExternalAlarmFeedStore.getState().feeds).toBe(before);
  });

  it('아무도 안 실었으면 빈 목록이다', () => {
    const { result } = renderHook(() => useExternalAlarms());
    expect(result.current).toEqual([]);
  });
});
