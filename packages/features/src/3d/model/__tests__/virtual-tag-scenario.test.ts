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
