import { beforeEach, describe, expect, it } from 'vitest';
import { useRealtimeStore } from '../use-realtime-store';

beforeEach(() => {
  useRealtimeStore.setState({
    isRunning: false,
    held: false,
    buffer: new Map(),
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
    expect([...useRealtimeStore.getState().buffer]).toEqual([
      ['c1:a', 1],
      ['c1:b', 2],
    ]);
  });

  it('같은 키가 여러 번 오면 최신값 하나만 남고 처음 들어온 순서를 지킨다', () => {
    const { pushValue } = useRealtimeStore.getState();
    pushValue('c1:a', 1);
    pushValue('c1:b', 2);
    pushValue('c1:a', 3);
    pushValue('c1:a', 4);
    expect([...useRealtimeStore.getState().buffer]).toEqual([
      ['c1:a', 4],
      ['c1:b', 2],
    ]);
  });

  it('버퍼 크기는 키 수를 넘지 않는다 — 숨김 탭에서 drain 이 멈춰도 무한 성장하지 않는다', () => {
    const { pushValue } = useRealtimeStore.getState();
    for (let i = 0; i < 10_000; i++) pushValue(`c:${i % 50}`, i);
    expect(useRealtimeStore.getState().buffer.size).toBe(50);
    expect(useRealtimeStore.getState().buffer.get('c:49')).toBe(9_999);
  });

  it('pushBatch 는 키 사전으로 id 를 풀어 넣고, count 만큼만 읽으며, 사전 밖 id 는 버린다', () => {
    const keys = ['c:a', 'c:b', 'c:c'];
    const ids = Int32Array.from([0, 2, 7, 1]);
    const values = Float64Array.from([1, 3, 99, 2]);
    const before = useRealtimeStore.getState();
    before.pushBatch(keys, ids, values, 3); // 마지막 쌍(1→2)은 count 밖
    expect(useRealtimeStore.getState()).toBe(before);
    expect([...useRealtimeStore.getState().buffer]).toEqual([
      ['c:a', 1],
      ['c:c', 3],
    ]);
    expect(before.activity.lastMessageAt).toBeGreaterThan(0);
  });

  it('count 0 배치는 아무것도 하지 않는다(수신 시각도 그대로)', () => {
    const before = useRealtimeStore.getState();
    before.pushBatch([], new Int32Array(0), new Float64Array(0), 0);
    expect(before.activity.lastMessageAt).toBe(Number.NEGATIVE_INFINITY);
    expect(before.buffer.size).toBe(0);
  });

  it('drainBuffer 는 쌓인 Map 을 넘기고 빈 Map 으로 바꾸며, 비었으면 참조 유지', () => {
    const empty = useRealtimeStore.getState();
    expect(empty.drainBuffer()).toBe(empty.buffer);
    expect(useRealtimeStore.getState()).toBe(empty);

    useRealtimeStore.getState().pushValue('k', 1);
    const filled = useRealtimeStore.getState().buffer;
    expect(useRealtimeStore.getState().drainBuffer()).toBe(filled);
    expect(useRealtimeStore.getState().buffer.size).toBe(0);
    expect(useRealtimeStore.getState().buffer).not.toBe(filled);
  });

  it('drain 이 넘긴 Map 은 다음 drain 까지 유효하고, 그 뒤 재사용된다(교대 버퍼)', () => {
    useRealtimeStore.getState().pushValue('a', 1);
    const first = useRealtimeStore.getState().drainBuffer();
    expect([...first]).toEqual([['a', 1]]);
    // 다음 프레임의 수신은 다른 Map 에 쌓인다 — 아직 first 는 그대로.
    useRealtimeStore.getState().pushValue('b', 2);
    expect([...first]).toEqual([['a', 1]]);
    const second = useRealtimeStore.getState().drainBuffer();
    expect([...second]).toEqual([['b', 2]]);
    expect(second).not.toBe(first);
    // first 가 비워져 새 버퍼로 돌아왔다.
    expect(useRealtimeStore.getState().buffer).toBe(first);
    expect(first.size).toBe(0);
  });

  it('start / stop 은 남은 버퍼를 버린다 — 화면 재진입 첫 프레임에 옛 값이 쏟아지지 않는다', () => {
    useRealtimeStore.getState().pushValue('a', 1);
    useRealtimeStore.getState().start();
    expect(useRealtimeStore.getState().buffer.size).toBe(0);
    useRealtimeStore.getState().pushValue('a', 2);
    useRealtimeStore.getState().stop();
    expect(useRealtimeStore.getState().buffer.size).toBe(0);
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
