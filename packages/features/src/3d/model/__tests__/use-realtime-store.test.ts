import { beforeEach, describe, expect, it } from 'vitest';
import { useRealtimeStore } from '../use-realtime-store';

beforeEach(() => {
  useRealtimeStore.setState({ isRunning: false, held: false, buffer: [] });
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
