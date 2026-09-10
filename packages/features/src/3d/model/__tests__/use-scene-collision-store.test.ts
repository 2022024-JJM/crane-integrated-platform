// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLASH_MS,
  HISTORY_MAX,
  PREDICTION_HORIZON_DEFAULT_SEC,
  PREDICTION_HORIZON_MAX_SEC,
  PREDICTION_HORIZON_MIN_SEC,
} from '../../lib/scene-collision-pairs';
import { rigValueStore } from '../rig-value-store';
import { sceneCollisionRuntime } from '../scene-collision-runtime';
import {
  useSceneCollisionStore,
  type SceneCollisionRecord,
  type ScenePredictedCollision,
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
    baselinePending: false,
    predictionEnabled: true,
    predictionHorizonSec: PREDICTION_HORIZON_DEFAULT_SEC,
    predicted: null,
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
  vi.spyOn(sceneCollisionRuntime, 'rebaseline').mockImplementation(() => {});
  vi.spyOn(rigValueStore, 'restore').mockImplementation(() => {});
  useVirtualTagStore.setState({ isRunning: true });
});

afterEach(() => {
  useSceneCollisionStore.getState().clearHistory();
  vi.useRealTimers();
  vi.restoreAllMocks();
  useVirtualTagStore.setState({ isRunning: false });
});

describe('초기값', () => {
  it('모듈 초기 상태는 감지 ON·충돌 시 정지 ON·기록 없음이다', () => {
    // beforeEach 의 reset 이 현재 상태를 덮어쓰므로 zustand 가 보관한
    // 초기 상태를 본다(vi.resetModules 는 three 까지 재평가해 경고를 낸다).
    expect(useSceneCollisionStore.getInitialState()).toMatchObject({
      enabled: true,
      pauseOnCollision: true,
      history: [],
      activeRecordId: null,
      activeMode: null,
    });
  });
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
  it('기록 클릭은 쌍 억제 → 값 복원 → 재기준선 → 러너 정지 → pin 순서로 진행하고 런타임을 멈추지 않는다', () => {
    const calls: string[] = [];
    vi.mocked(sceneCollisionRuntime.suppress).mockImplementation((key) => {
      calls.push(`suppress:${key}`);
    });
    vi.mocked(rigValueStore.restore).mockImplementation(() => {
      calls.push('restore');
    });
    vi.mocked(sceneCollisionRuntime.rebaseline).mockImplementation(() => {
      calls.push('rebaseline');
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
    expect(calls).toEqual(['suppress:a|b', 'restore', 'rebaseline', 'pause']);
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
    expect(sceneCollisionRuntime.rebaseline).not.toHaveBeenCalled();
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

describe('baselinePending', () => {
  it('기본 false 이고 같은 값 재설정은 상태 참조를 유지한다', () => {
    expect(useSceneCollisionStore.getState().baselinePending).toBe(false);
    const before = useSceneCollisionStore.getState();
    useSceneCollisionStore.getState().setBaselinePending(false);
    expect(useSceneCollisionStore.getState()).toBe(before);
    useSceneCollisionStore.getState().setBaselinePending(true);
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
  });

  it('clear(검사기 언마운트)는 baselinePending 을 건드리지 않는다 — 검사기가 직접 내린다', () => {
    useSceneCollisionStore.getState().setBaselinePending(true);
    useSceneCollisionStore.getState().clear();
    expect(useSceneCollisionStore.getState().baselinePending).toBe(true);
  });
});

function prediction(
  patch: Partial<ScenePredictedCollision> = {},
): ScenePredictedCollision {
  return {
    pairKey: patch.pairKey ?? 'a|b',
    a: patch.a ?? { modelId: 'a', equipName: 'A', nodePath: '[0]Body' },
    b: patch.b ?? { modelId: 'b', equipName: 'B', nodePath: '[0]Body' },
    leadTimeSec: patch.leadTimeSec ?? 3,
    initialLeadTimeSec: patch.initialLeadTimeSec ?? 5,
    contactPoint: patch.contactPoint ?? [1, 2, 3],
    ghosts: patch.ghosts ?? [
      { modelId: 'a', path: '/models/a.glb', nodes: [] },
    ],
  };
}

describe('예측 토글·지평선', () => {
  it('기본값은 켜짐이고 지평선은 기본 상수다', () => {
    // 세션 전용이라 스토어를 새로 만들 수 없어 초기값 상수로 확인한다.
    expect(PREDICTION_HORIZON_DEFAULT_SEC).toBeGreaterThan(0);
    reset();
    expect(useSceneCollisionStore.getState().predictionEnabled).toBe(true);
  });

  it('같은 값 재설정은 상태를 바꾸지 않는다', () => {
    const before = useSceneCollisionStore.getState();
    useSceneCollisionStore.getState().setPredictionEnabled(true);
    expect(useSceneCollisionStore.getState()).toBe(before);
    useSceneCollisionStore
      .getState()
      .setPredictionHorizonSec(PREDICTION_HORIZON_DEFAULT_SEC);
    expect(useSceneCollisionStore.getState()).toBe(before);
  });

  it('예측을 끄면 현재 예측도 함께 내려간다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().setPredictionEnabled(false);
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('지평선은 경계 정확값을 통과하고 그 밖은 클램프된다', () => {
    const set = (v: number) =>
      useSceneCollisionStore.getState().setPredictionHorizonSec(v);
    const get = () => useSceneCollisionStore.getState().predictionHorizonSec;

    set(PREDICTION_HORIZON_MIN_SEC);
    expect(get()).toBe(PREDICTION_HORIZON_MIN_SEC);
    set(PREDICTION_HORIZON_MIN_SEC - 1);
    expect(get()).toBe(PREDICTION_HORIZON_MIN_SEC);

    set(PREDICTION_HORIZON_MAX_SEC);
    expect(get()).toBe(PREDICTION_HORIZON_MAX_SEC);
    set(PREDICTION_HORIZON_MAX_SEC + 1);
    expect(get()).toBe(PREDICTION_HORIZON_MAX_SEC);
  });

  it('NaN·Infinity 지평선은 기본값으로 되돌아간다', () => {
    const set = (v: number) =>
      useSceneCollisionStore.getState().setPredictionHorizonSec(v);
    set(PREDICTION_HORIZON_MAX_SEC);
    set(Number.NaN);
    expect(useSceneCollisionStore.getState().predictionHorizonSec).toBe(
      PREDICTION_HORIZON_DEFAULT_SEC,
    );
    set(Number.POSITIVE_INFINITY);
    expect(useSceneCollisionStore.getState().predictionHorizonSec).toBe(
      PREDICTION_HORIZON_DEFAULT_SEC,
    );
  });

  it('지평선이 바뀌면 현재 예측은 근거를 잃어 내려간다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().setPredictionHorizonSec(5);
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });
});

describe('setPredicted — 발행 정책', () => {
  it('같은 쌍·같은 리드타임이면 참조를 유지한다', () => {
    const first = prediction();
    useSceneCollisionStore.getState().setPredicted(first);
    const stored = useSceneCollisionStore.getState().predicted;
    useSceneCollisionStore.getState().setPredicted(prediction());
    expect(useSceneCollisionStore.getState().predicted).toBe(stored);
  });

  it('같은 쌍이면 고스트·접촉점은 첫 값을 유지하고 리드타임만 갱신한다', () => {
    const first = prediction({ leadTimeSec: 3, contactPoint: [1, 2, 3] });
    useSceneCollisionStore.getState().setPredicted(first);
    const stored = useSceneCollisionStore.getState().predicted;
    useSceneCollisionStore.getState().setPredicted(
      prediction({
        leadTimeSec: 2,
        contactPoint: [9, 9, 9],
        ghosts: [{ modelId: 'z', path: '/models/z.glb', nodes: [] }],
      }),
    );
    const next = useSceneCollisionStore.getState().predicted;
    expect(next?.leadTimeSec).toBe(2);
    // 발견 시점 고정 — 매 스윕 갱신하면 clone·라인이 계속 다시 만들어지고
    // 캡처(자세 차용 십수 회)도 매번 돈다.
    expect(next?.ghosts).toBe(stored?.ghosts);
    expect(next?.contactPoint).toEqual([1, 2, 3]);
    // 카운트다운 호의 분모도 첫 값이어야 줄어드는 것이 보인다.
    expect(next?.initialLeadTimeSec).toBe(5);
  });

  it('쌍이 바뀌면 통째로 교체한다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore
      .getState()
      .setPredicted(prediction({ pairKey: 'b|c', contactPoint: [7, 7, 7] }));
    expect(useSceneCollisionStore.getState().predicted?.pairKey).toBe('b|c');
    expect(useSceneCollisionStore.getState().predicted?.contactPoint).toEqual([
      7, 7, 7,
    ]);
  });

  it('null 재설정은 no-op 이다', () => {
    const before = useSceneCollisionStore.getState();
    useSceneCollisionStore.getState().setPredicted(null);
    expect(useSceneCollisionStore.getState()).toBe(before);
  });
});

describe('예측이 내려가는 경로', () => {
  it('감지를 끄면 내려간다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().setEnabled(false);
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('clearActive 로 내려간다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().clearActive();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('clear(검사기 언마운트)로 내려간다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().clear();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('resume 으로 내려간다', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().resume();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('clearHistory 로 내려간다 — 기록이 비어 있어도', () => {
    useSceneCollisionStore.getState().setPredicted(prediction());
    // 기록이 없으면 early return 하는 경로라 별도 확인이 필요하다.
    expect(useSceneCollisionStore.getState().history).toEqual([]);
    useSceneCollisionStore.getState().clearHistory();
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
  });

  it('selectRecord 는 자세를 순간이동시키므로 예측을 먼저 내린다', () => {
    useSceneCollisionStore.getState().pushRecord(record(1, [['m/j', 5]]));
    useSceneCollisionStore.getState().setPredicted(prediction());
    useSceneCollisionStore.getState().selectRecord(1);
    expect(useSceneCollisionStore.getState().predicted).toBeNull();
    expect(useSceneCollisionStore.getState().activeMode).toBe('pinned');
  });
});
