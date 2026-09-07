// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLASH_MS, HISTORY_MAX } from '../../lib/scene-collision-pairs';
import { rigValueStore } from '../rig-value-store';
import { sceneCollisionRuntime } from '../scene-collision-runtime';
import {
  useSceneCollisionStore,
  type SceneCollisionRecord,
} from '../use-scene-collision-store';
import { useRealtimeStore } from '../use-realtime-store';
import { useVirtualTagStore } from '../use-virtual-tag-store';

function record(
  id: number,
  values: Array<[string, number]> = [],
): SceneCollisionRecord {
  return {
    id,
    pairKey: 'a|b',
    at: 1000 + id,
    a: { modelId: 'a', equipName: 'A', nodePath: '[0]Body' },
    b: { modelId: 'b', equipName: 'B', nodePath: '' },
    contactPoint: [0, 0, 0],
    values,
  };
}

function reset(enabled = true) {
  useSceneCollisionStore.setState({
    enabled,
    pauseOnCollision: true,
    history: [],
    activeRecordId: null,
    activeMode: null,
  });
  useRealtimeStore.setState({ isRunning: true, held: false, buffer: [] });
}

let runtimePhase: 'idle' | 'halted' | 'scanning' = 'halted';

beforeEach(() => {
  vi.useFakeTimers();
  reset();
  runtimePhase = 'halted';
  vi.spyOn(sceneCollisionRuntime, 'currentPhase', 'get').mockImplementation(
    () => runtimePhase,
  );
  vi.spyOn(sceneCollisionRuntime, 'arm').mockImplementation(() => {});
  vi.spyOn(sceneCollisionRuntime, 'halt').mockImplementation(() => {});
  vi.spyOn(sceneCollisionRuntime, 'suppress').mockImplementation(() => {});
  vi.spyOn(rigValueStore, 'restore').mockImplementation(() => {});
  useVirtualTagStore.setState({ isRunning: true });
});

afterEach(() => {
  useSceneCollisionStore.getState().clearHistory();
  vi.useRealTimers();
  vi.restoreAllMocks();
  useVirtualTagStore.setState({ isRunning: false });
});

describe('토글', () => {
  it('toggle 은 enabled 를 뒤집고, 끄면 active 만 지우고 기록은 남긴다', () => {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.pin(1);
    s.toggle();
    expect(useSceneCollisionStore.getState()).toMatchObject({
      enabled: false,
      activeRecordId: null,
      activeMode: null,
    });
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);
    useSceneCollisionStore.getState().toggle();
    expect(useSceneCollisionStore.getState().enabled).toBe(true);
  });

  it('같은 값으로 setEnabled / setPauseOnCollision 하면 참조가 유지된다', () => {
    const before = useSceneCollisionStore.getState();
    before.setEnabled(true);
    before.setPauseOnCollision(true);
    expect(useSceneCollisionStore.getState()).toBe(before);
    before.setPauseOnCollision(false);
    expect(useSceneCollisionStore.getState().pauseOnCollision).toBe(false);
  });
});

describe('기록', () => {
  it('pushRecord 는 최신을 앞에 두고 HISTORY_MAX 를 넘기면 가장 오래된 것을 버린다', () => {
    const s = useSceneCollisionStore.getState();
    for (let i = 1; i <= HISTORY_MAX; i += 1) s.pushRecord(record(i));
    expect(useSceneCollisionStore.getState().history.map((r) => r.id)).toEqual([
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    s.pushRecord(record(11));
    const ids = useSceneCollisionStore.getState().history.map((r) => r.id);
    expect(ids).toHaveLength(HISTORY_MAX);
    expect(ids[0]).toBe(11);
    expect(ids).not.toContain(1);
  });

  it('clearHistory 는 기록과 active 를 모두 비우고, 빈 상태에선 참조 유지', () => {
    const empty = useSceneCollisionStore.getState();
    empty.clearHistory();
    expect(useSceneCollisionStore.getState()).toBe(empty);
    empty.pushRecord(record(1));
    useSceneCollisionStore.getState().pin(1);
    useSceneCollisionStore.getState().clearHistory();
    expect(useSceneCollisionStore.getState()).toMatchObject({
      history: [],
      activeRecordId: null,
      activeMode: null,
    });
  });
});

describe('pin / flash', () => {
  it('없는 id 는 no-op(참조 유지)', () => {
    const before = useSceneCollisionStore.getState();
    before.pin(99);
    before.flash(99);
    expect(useSceneCollisionStore.getState()).toBe(before);
  });

  it('flash 는 FLASH_MS 뒤 자동 해제되고, 새 flash 가 이전 타이머를 대체한다', () => {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.pushRecord(record(2));
    s.flash(1);
    expect(useSceneCollisionStore.getState()).toMatchObject({
      activeRecordId: 1,
      activeMode: 'flash',
    });
    vi.advanceTimersByTime(FLASH_MS - 1);
    useSceneCollisionStore.getState().flash(2);
    vi.advanceTimersByTime(FLASH_MS - 1);
    // 첫 타이머는 취소됐고 둘째는 아직 — 2 가 그대로.
    expect(useSceneCollisionStore.getState().activeRecordId).toBe(2);
    vi.advanceTimersByTime(1);
    expect(useSceneCollisionStore.getState()).toMatchObject({
      activeRecordId: null,
      activeMode: null,
    });
  });

  it('flash 뒤 pin 하면 타이머가 취소돼 pinned 는 시간이 지나도 남는다', () => {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.flash(1);
    useSceneCollisionStore.getState().pin(1);
    vi.advanceTimersByTime(FLASH_MS * 2);
    expect(useSceneCollisionStore.getState()).toMatchObject({
      activeRecordId: 1,
      activeMode: 'pinned',
    });
  });
});

describe('selectRecord / resume', () => {
  it('기록 클릭은 쌍 억제 → 값 복원 → 러너 정지 → pin 순서로 진행하고 런타임을 멈추지 않는다', () => {
    const calls: string[] = [];
    vi.mocked(sceneCollisionRuntime.suppress).mockImplementation((key) => {
      calls.push(`suppress:${key}`);
    });
    vi.mocked(rigValueStore.restore).mockImplementation(() => {
      calls.push('restore');
    });
    useVirtualTagStore.setState({
      pause: () => {
        calls.push('pause');
        useVirtualTagStore.setState({ isRunning: false });
      },
    });
    const values: Array<[string, number]> = [['a/j', 3]];
    useSceneCollisionStore.getState().pushRecord(record(1, values));
    useSceneCollisionStore.getState().selectRecord(1);
    expect(calls).toEqual(['suppress:a|b', 'restore', 'pause']);
    // 실시간은 화면 반영 보류 — 다음 프레임에 복원이 덮어써지지 않는다.
    expect(useRealtimeStore.getState().held).toBe(true);
    expect(sceneCollisionRuntime.halt).not.toHaveBeenCalled();
    expect(rigValueStore.restore).toHaveBeenCalledWith(values);
    expect(useSceneCollisionStore.getState()).toMatchObject({
      activeRecordId: 1,
      activeMode: 'pinned',
    });
  });

  it('없는 id 는 no-op(참조 유지, 런타임 호출 없음)', () => {
    const before = useSceneCollisionStore.getState();
    before.selectRecord(42);
    expect(useSceneCollisionStore.getState()).toBe(before);
    expect(sceneCollisionRuntime.suppress).not.toHaveBeenCalled();
  });

  it('이미 고정된 같은 기록을 다시 클릭하면 resume — active 해제 + 정지된 런타임 재무장', () => {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.selectRecord(1);
    useSceneCollisionStore.getState().selectRecord(1);
    expect(sceneCollisionRuntime.arm).toHaveBeenCalledTimes(1);
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    expect(useRealtimeStore.getState().held).toBe(false);
  });

  it('resume 은 enabled 이고 런타임이 halted 일 때만 arm 하고, active 가 없으면 참조 유지', () => {
    const s = useSceneCollisionStore.getState();
    runtimePhase = 'scanning';
    s.resume();
    expect(sceneCollisionRuntime.arm).not.toHaveBeenCalled();
    expect(useSceneCollisionStore.getState()).toBe(s);

    runtimePhase = 'halted';
    useSceneCollisionStore.getState().setEnabled(false);
    useSceneCollisionStore.getState().resume();
    expect(sceneCollisionRuntime.arm).not.toHaveBeenCalled();

    useSceneCollisionStore.getState().setEnabled(true);
    useSceneCollisionStore.getState().resume();
    expect(sceneCollisionRuntime.arm).toHaveBeenCalledTimes(1);
  });

  it('clear 는 active 만 해제하고 기록·enabled 는 유지하며 런타임을 건드리지 않는다', () => {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.pin(1);
    useSceneCollisionStore.getState().clear();
    expect(useSceneCollisionStore.getState()).toMatchObject({
      enabled: true,
      activeRecordId: null,
    });
    expect(useSceneCollisionStore.getState().history).toHaveLength(1);
    expect(sceneCollisionRuntime.arm).not.toHaveBeenCalled();
    const idle = useSceneCollisionStore.getState();
    idle.clear();
    expect(useSceneCollisionStore.getState()).toBe(idle);
  });
});

describe('실시간 화면 반영 보류(held) 해제 경로', () => {
  function pinWithHold(): void {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.selectRecord(1);
    expect(useRealtimeStore.getState().held).toBe(true);
  }

  it.each([
    ['resume', () => useSceneCollisionStore.getState().resume()],
    ['clearActive', () => useSceneCollisionStore.getState().clearActive()],
    ['clearHistory', () => useSceneCollisionStore.getState().clearHistory()],
    ['clear', () => useSceneCollisionStore.getState().clear()],
    [
      'setEnabled(false)',
      () => useSceneCollisionStore.getState().setEnabled(false),
    ],
  ])('%s 는 pinned 을 풀며 실시간 보류도 푼다', (_name, release) => {
    pinWithHold();
    release();
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    expect(useRealtimeStore.getState().held).toBe(false);
  });

  it('setEnabled(true) 와 같은 값 재설정은 보류를 건드리지 않는다', () => {
    pinWithHold();
    useSceneCollisionStore.getState().setEnabled(true); // 같은 값
    expect(useRealtimeStore.getState().held).toBe(true);
    useSceneCollisionStore.getState().setPauseOnCollision(false);
    expect(useRealtimeStore.getState().held).toBe(true);
  });

  it('pin / flash 자체는 보류를 만들지 않는다(검사기가 hold 를 부른다)', () => {
    const s = useSceneCollisionStore.getState();
    s.pushRecord(record(1));
    s.pin(1);
    expect(useRealtimeStore.getState().held).toBe(false);
    s.flash(1);
    vi.advanceTimersByTime(FLASH_MS);
    expect(useRealtimeStore.getState().held).toBe(false);
  });

  it('보류가 없는 상태에서 해제 경로를 밟아도 실시간 상태 참조가 유지된다', () => {
    const before = useRealtimeStore.getState();
    useSceneCollisionStore.getState().resume();
    useSceneCollisionStore.getState().clear();
    expect(useRealtimeStore.getState()).toBe(before);
  });
});
