import { beforeEach, describe, expect, it } from 'vitest';
import { useRealtimeStore } from '../use-realtime-store';

beforeEach(() => {
  useRealtimeStore.setState({
    isRunning: false,
    held: false,
    buffer: [],
    activity: { lastMessageAt: Number.NEGATIVE_INFINITY },
  });
});

describe('useRealtimeStore — hold / release', () => {
  it('hold 는 held 만 켜고 isRunning 은 건드리지 않는다', () => {
    useRealtimeStore.getState().start();
    useRealtimeStore.getState().hold();
    expect(useRealtimeStore.getState()).toMatchObject({
      isRunning: true,
      held: true,
    });
    useRealtimeStore.getState().release();
    expect(useRealtimeStore.getState()).toMatchObject({
      isRunning: true,
      held: false,
    });
  });

  it('같은 값으로 hold / release 를 다시 불러도 상태 참조가 유지된다', () => {
    const idle = useRealtimeStore.getState();
    idle.release();
    expect(useRealtimeStore.getState()).toBe(idle);

    idle.hold();
    const held = useRealtimeStore.getState();
    expect(held).not.toBe(idle);
    held.hold();
    expect(useRealtimeStore.getState()).toBe(held);
  });

  it('start / stop 은 남아 있던 held 를 리셋한다(화면 이탈·재진입 시 보류 잔류 방지)', () => {
    useRealtimeStore.getState().hold();
    useRealtimeStore.getState().start();
    expect(useRealtimeStore.getState().held).toBe(false);

    useRealtimeStore.getState().hold();
    useRealtimeStore.getState().stop();
    expect(useRealtimeStore.getState()).toMatchObject({
      isRunning: false,
      held: false,
    });
  });

  it('isRunning 이 꺼져 있어도 hold 는 켜진다(러너가 돌지 않으니 무해)', () => {
    useRealtimeStore.getState().hold();
    expect(useRealtimeStore.getState().held).toBe(true);
  });
});

describe('useRealtimeStore — buffer', () => {
  it('pushValue 는 held 와 무관하게 쌓이고, React 상태 참조는 바뀌지 않는다', () => {
    const before = useRealtimeStore.getState();
    before.pushValue('c1:a', 1);
    expect(useRealtimeStore.getState()).toBe(before);

    useRealtimeStore.getState().hold();
    const held = useRealtimeStore.getState();
    held.pushValue('c1:b', 2);
    expect(useRealtimeStore.getState()).toBe(held);
    expect(useRealtimeStore.getState().buffer).toEqual([
      { key: 'c1:a', value: 1 },
      { key: 'c1:b', value: 2 },
    ]);
  });

  it('같은 키가 프레임 사이에 여러 번 오면 마지막 값만 남고 버퍼는 고유 키 수를 넘지 않는다', () => {
    const s = useRealtimeStore.getState();
    for (let i = 0; i < 1000; i += 1) {
      s.pushValue('c1:a', i);
      s.pushValue('c1:b', -i);
    }
    expect(useRealtimeStore.getState().buffer).toEqual([
      { key: 'c1:a', value: 999 },
      { key: 'c1:b', value: -999 },
    ]);
    // drain 뒤엔 같은 키가 새 항목으로 다시 들어간다.
    useRealtimeStore.getState().drainBuffer();
    s.pushValue('c1:b', 7);
    s.pushValue('c1:a', 8);
    expect(useRealtimeStore.getState().buffer).toEqual([
      { key: 'c1:b', value: 7 },
      { key: 'c1:a', value: 8 },
    ]);
  });

  it('외부에서 buffer 를 통째로 갈아끼워도(setState) 키 색인이 어긋나지 않는다', () => {
    useRealtimeStore.getState().pushValue('c1:a', 1);
    useRealtimeStore.setState({ buffer: [] });
    useRealtimeStore.getState().pushValue('c1:a', 2);
    useRealtimeStore.getState().pushValue('c1:a', 3);
    expect(useRealtimeStore.getState().buffer).toEqual([
      { key: 'c1:a', value: 3 },
    ]);
  });

  it('drainBuffer 는 쌓인 배열을 넘기고 새 빈 배열로 바꾸며, 비었으면 참조 유지', () => {
    const empty = useRealtimeStore.getState();
    expect(empty.drainBuffer()).toBe(empty.buffer);
    expect(useRealtimeStore.getState()).toBe(empty);

    useRealtimeStore.getState().pushValue('k', 1);
    const filled = useRealtimeStore.getState().buffer;
    expect(useRealtimeStore.getState().drainBuffer()).toBe(filled);
    expect(useRealtimeStore.getState().buffer).toEqual([]);
    expect(useRealtimeStore.getState().buffer).not.toBe(filled);
  });
});

describe('activity.lastMessageAt', () => {
  it('pushValue 가 수신 시각을 제자리 갱신하고 리렌더용 상태는 바꾸지 않는다', () => {
    const before = useRealtimeStore.getState();
    expect(before.activity.lastMessageAt).toBe(Number.NEGATIVE_INFINITY);
    useRealtimeStore.getState().pushValue('C_1:tag', 1);
    const after = useRealtimeStore.getState();
    expect(after).toBe(before);
    expect(after.activity.lastMessageAt).toBeGreaterThan(0);
    expect(after.activity.lastMessageAt).toBeLessThanOrEqual(performance.now());
  });
});
