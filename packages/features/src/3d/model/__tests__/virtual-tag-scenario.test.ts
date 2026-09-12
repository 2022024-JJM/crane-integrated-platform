import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  VirtualScenario,
  VirtualTagDefinition,
} from '@crane/domain/virtual-tag';
import { useVirtualTagStore } from '../use-virtual-tag-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import { setTagIngest, tagLiveValues } from '../tag-value-bus';

/**
 * 시뮬레이션 시계·시나리오 — 배속, seek, 시나리오 우선, 끝에서 정지, 트랙
 * 없는 태그는 파형 유지. 저장소는 건드리지 않고 스토어 상태를 직접 세운다.
 */
const TAG_A: VirtualTagDefinition = {
  id: 'a',
  key: 'A:x',
  name: '',
  min: 0,
  max: 100,
  initial: 0,
  pattern: { kind: 'sawtooth', periodMs: 10_000 },
  enabled: true,
};
const TAG_B: VirtualTagDefinition = {
  id: 'b',
  key: 'B:y',
  name: '',
  min: -10,
  max: 10,
  initial: 0,
  pattern: { kind: 'manual' },
  enabled: true,
};
const SCENARIO: VirtualScenario = {
  id: 's1',
  name: 'demo',
  loop: false,
  tracks: [
    {
      key: 'B:y',
      keyframes: [
        { atMs: 0, value: -10 },
        { atMs: 2000, value: 10 },
      ],
    },
  ],
};

const last = new Map<string, number>();

function reset() {
  useVirtualTagStore.getState().pause();
  useVirtualTagStore.setState({
    tags: [TAG_A, TAG_B],
    tickMs: 100,
    scenarios: [SCENARIO],
    speed: 1,
    activeScenarioId: null,
    hasSession: false,
    hydrated: true,
    isRunning: false,
  });
  virtualTagRuntime.syncDefinitions([TAG_A, TAG_B]);
  virtualTagRuntime.resetValues();
  last.clear();
  tagLiveValues.clear();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  reset();
  setTagIngest((key, value) => last.set(key, value));
});

afterEach(() => {
  reset();
  setTagIngest(null);
  vi.useRealTimers();
});

describe('배속', () => {
  it('speed 2 면 같은 벽시계에 파형이 두 배 진행한다', () => {
    useVirtualTagStore.getState().setSpeed(2);
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(1000);
    // sawtooth 10s 주기, 0→100: 벽시계 1s × 2 = 2s → 20
    expect(last.get('A:x')).toBeCloseTo(20, 5);
    expect(virtualTagRuntime.elapsed).toBe(2000);
  });

  it('범위 밖·NaN 배속은 클램프/무시', () => {
    const store = useVirtualTagStore.getState();
    store.setSpeed(100);
    expect(useVirtualTagStore.getState().speed).toBe(16);
    store.setSpeed(NaN);
    expect(useVirtualTagStore.getState().speed).toBe(1);
    const before = useVirtualTagStore.getState();
    store.setSpeed(1);
    expect(useVirtualTagStore.getState()).toBe(before);
  });
});

describe('seek', () => {
  it('정지 상태에서도 그 시각의 값을 내보낸다', () => {
    useVirtualTagStore.getState().seek(2500);
    expect(virtualTagRuntime.elapsed).toBe(2500);
    expect(last.get('A:x')).toBeCloseTo(25, 5);
    useVirtualTagStore.getState().seek(-1);
    expect(virtualTagRuntime.elapsed).toBe(0);
  });
});

describe('시나리오', () => {
  it('활성 시나리오의 트랙은 키프레임 값, 트랙 없는 태그는 파형 그대로', () => {
    useVirtualTagStore.getState().setActiveScenario('s1');
    // 선택 즉시 0초로 seek — B 는 첫 키프레임 -10.
    expect(last.get('B:y')).toBe(-10);
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(last.get('B:y')).toBeCloseTo(0, 5);
    expect(last.get('A:x')).toBeCloseTo(10, 5);
  });

  it('loop 아닌 시나리오는 끝에 닿으면 일시정지한다', () => {
    useVirtualTagStore.getState().setActiveScenario('s1');
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(2500);
    expect(useVirtualTagStore.getState().isRunning).toBe(false);
    expect(last.get('B:y')).toBe(10);
  });

  it('loop 시나리오는 계속 돌며 시각이 감긴다', () => {
    useVirtualTagStore.setState({
      scenarios: [{ ...SCENARIO, loop: true }],
    });
    useVirtualTagStore.getState().setActiveScenario('s1');
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(3000);
    expect(useVirtualTagStore.getState().isRunning).toBe(true);
    // 3000 % 2000 = 1000 → 0
    expect(last.get('B:y')).toBeCloseTo(0, 5);
  });

  it('없는 id 를 활성으로 두면 null, 삭제하면 활성 해제', () => {
    const store = useVirtualTagStore.getState();
    store.setActiveScenario('nope');
    expect(useVirtualTagStore.getState().activeScenarioId).toBeNull();
    store.setActiveScenario('s1');
    store.removeScenario('s1');
    expect(useVirtualTagStore.getState().activeScenarioId).toBeNull();
  });
});

describe('시나리오 편집', () => {
  it('추가·트랙 추가(첫 키프레임 = initial)·키프레임 교체·빈 키프레임은 트랙 삭제·중복 트랙 거부', () => {
    const store = useVirtualTagStore.getState();
    const id = store.addScenario('테스트')!;
    expect(id).toBeTruthy();
    expect(store.addScenarioTrack(id, 'A:x')).toBe(true);
    expect(store.addScenarioTrack(id, 'A:x')).toBe(false);
    let scenario = useVirtualTagStore
      .getState()
      .scenarios.find((s) => s.id === id)!;
    expect(scenario.tracks[0].keyframes).toEqual([{ atMs: 0, value: 0 }]);
    expect(
      store.setScenarioTrackKeyframes(id, 'A:x', [
        { atMs: 900, value: 5 },
        { atMs: 100, value: 1 },
      ]),
    ).toBe(true);
    scenario = useVirtualTagStore
      .getState()
      .scenarios.find((s) => s.id === id)!;
    expect(scenario.tracks[0].keyframes.map((k) => k.atMs)).toEqual([100, 900]);
    store.setScenarioTrackKeyframes(id, 'A:x', []);
    scenario = useVirtualTagStore
      .getState()
      .scenarios.find((s) => s.id === id)!;
    expect(scenario.tracks).toEqual([]);
    expect(store.setScenarioTrackKeyframes(id, 'zz', [])).toBe(false);
  });

  it('복제는 새 id·유일한 이름, 이름·반복 갱신, 상한', () => {
    const store = useVirtualTagStore.getState();
    const copyId = store.duplicateScenario('s1')!;
    const copy = useVirtualTagStore
      .getState()
      .scenarios.find((s) => s.id === copyId)!;
    expect(copy.name).toBe('demo 2');
    expect(copy.tracks).toEqual(SCENARIO.tracks);
    expect(store.updateScenario(copyId, { name: '  x  ', loop: true })).toBe(
      true,
    );
    const updated = useVirtualTagStore
      .getState()
      .scenarios.find((s) => s.id === copyId)!;
    expect(updated.name).toBe('x');
    expect(updated.loop).toBe(true);
    expect(store.updateScenario('nope', { loop: true })).toBe(false);
  });

  it('dirty 는 시나리오 변경도 잡는다', () => {
    const store = useVirtualTagStore.getState();
    useVirtualTagStore.setState({
      savedSnapshot: JSON.stringify({
        version: 1,
        tickMs: 100,
        tags: [TAG_A, TAG_B],
        scenarios: [SCENARIO],
      }),
    });
    expect(store.isDirty()).toBe(false);
    store.updateScenario('s1', { loop: true });
    expect(useVirtualTagStore.getState().isDirty()).toBe(true);
  });
});

describe('속도·가속 한계', () => {
  it('한계가 있는 태그는 파형 목표를 maxSpeed 이하로 따라간다(배속 곱한 시뮬레이션 초 기준)', () => {
    const limited: VirtualTagDefinition = {
      ...TAG_A,
      // sawtooth 10s 0→100 은 10 unit/s — 한계 2 unit/s 로 잘린다.
      limits: { maxSpeed: 2 },
    };
    useVirtualTagStore.setState({ tags: [limited, TAG_B] });
    virtualTagRuntime.syncDefinitions([limited, TAG_B]);
    virtualTagRuntime.resetValues();
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(1000);
    // 벽시계 1s ×1 → 최대 2 (파형 목표는 10).
    expect(last.get('A:x')).toBeCloseTo(2, 5);
    useVirtualTagStore.getState().setSpeed(2);
    vi.advanceTimersByTime(1000);
    // 시뮬레이션 2초 더 → 2 + 4 = 6.
    expect(last.get('A:x')).toBeCloseTo(6, 5);
  });

  it('seek·리셋은 한계와 무관하게 즉시 이동한다', () => {
    const limited: VirtualTagDefinition = {
      ...TAG_A,
      limits: { maxSpeed: 0.1 },
    };
    useVirtualTagStore.setState({ tags: [limited, TAG_B] });
    virtualTagRuntime.syncDefinitions([limited, TAG_B]);
    useVirtualTagStore.getState().seek(5000);
    expect(last.get('A:x')).toBeCloseTo(50, 5);
    virtualTagRuntime.resetValues();
    expect(last.get('A:x')).toBe(0);
  });
});

describe('종료(관제 복귀)', () => {
  it('러너 정지·시간 0·시나리오 해제, 값을 내보내지 않고 live 캐시·값 저장소를 비운다', () => {
    const store = useVirtualTagStore.getState();
    store.setActiveScenario('s1');
    store.start();
    vi.advanceTimersByTime(1000);
    expect(tagLiveValues.size).toBeGreaterThan(0);
    last.clear();
    useVirtualTagStore.getState().stop();
    const state = useVirtualTagStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.activeScenarioId).toBeNull();
    expect(virtualTagRuntime.elapsed).toBe(0);
    expect(last.size).toBe(0);
    expect(tagLiveValues.size).toBe(0);
    // 이후 틱이 돌지 않는다.
    vi.advanceTimersByTime(1000);
    expect(last.size).toBe(0);
  });

  it('정지 상태에서 종료해도 참조가 흔들리지 않는다(no-op 에 가깝게)', () => {
    const before = useVirtualTagStore.getState();
    before.stop();
    expect(useVirtualTagStore.getState()).toBe(before);
  });
});

describe('일시정지 → 재개', () => {
  it('한계로 뒤처진 값이 재개 순간 목표로 점프하지 않고 이어서 간다', () => {
    const limited: VirtualTagDefinition = { ...TAG_A, limits: { maxSpeed: 2 } };
    useVirtualTagStore.setState({ tags: [limited, TAG_B] });
    virtualTagRuntime.syncDefinitions([limited, TAG_B]);
    virtualTagRuntime.resetValues();
    const store = useVirtualTagStore.getState();
    store.start();
    vi.advanceTimersByTime(1000); // 값 2 (목표 10)
    store.pause();
    vi.advanceTimersByTime(5000); // 5초 정지
    last.clear();
    useVirtualTagStore.getState().start();
    // 재개 직후 내보내는 값은 정지 시점 값(2)이어야 한다 — 목표(10)로 튀지 않음.
    expect(last.get('A:x')).toBeCloseTo(2, 5);
    vi.advanceTimersByTime(100);
    expect(last.get('A:x')!).toBeLessThanOrEqual(2.2 + 1e-6);
  });

  it('종료는 배속도 1 로 되돌린다', () => {
    useVirtualTagStore.getState().setSpeed(4);
    useVirtualTagStore.getState().stop();
    expect(useVirtualTagStore.getState().speed).toBe(1);
  });
});

describe('세션 표시(hasSession)', () => {
  it('재생하면 true, 일시정지해도 유지, 종료하면 false', () => {
    expect(useVirtualTagStore.getState().hasSession).toBe(false);
    useVirtualTagStore.getState().start();
    expect(useVirtualTagStore.getState().hasSession).toBe(true);
    useVirtualTagStore.getState().pause();
    expect(useVirtualTagStore.getState().hasSession).toBe(true);
    useVirtualTagStore.getState().stop();
    expect(useVirtualTagStore.getState().hasSession).toBe(false);
  });
});

describe('stopSimulation — 충돌 기록도 지운다', () => {
  it('세션 충돌 기록·활성 기록이 비고 가상 태그도 종료된다', async () => {
    const { stopSimulation } = await import('../stop-simulation');
    const { useSceneCollisionStore } =
      await import('../use-scene-collision-store');
    useSceneCollisionStore.setState({
      history: [
        {
          id: 1,
          pairKey: 'a|b',
          at: 1,
          a: { modelId: 'a', equipName: 'A', nodePath: '' },
          b: { modelId: 'b', equipName: 'B', nodePath: '' },
          contactPoint: [0, 0, 0],
          values: [],
        },
      ],
    });
    useVirtualTagStore.getState().start();
    stopSimulation();
    expect(useSceneCollisionStore.getState().history).toEqual([]);
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    expect(useVirtualTagStore.getState().hasSession).toBe(false);
    expect(useVirtualTagStore.getState().isRunning).toBe(false);
  });
});
