import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedModelInfo, SavedSceneInfo } from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
} from '@crane/domain/virtual-tag';
import { subscribeSceneSeek } from '../scene-seek-signal';
import { useScenarioStore } from '../use-scenario-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import {
  setActiveTagSource,
  setTagIngest,
  tagLiveValues,
  type TagPublishOptions,
} from '../tag-value-bus';

/**
 * 시뮬레이션 시계·러너 — 배속, seek(값은 씬 시간의 함수), 종료, 시나리오
 * 전환. 저장소는 건드리지 않고 스토어 상태를 직접 세운다. 키는 씬 모델의
 * craneId 와 코드로 조립된다(`A.x`, `B.y`).
 */
const TAG_A: ScenarioTag = {
  id: 'a',
  modelId: 'mA',
  code: 'x',
  name: '',
  dataType: 'number',
  min: 0,
  max: 100,
  initial: 0,
  pattern: { kind: 'sawtooth', periodSec: 10 },
};
const TAG_B: ScenarioTag = {
  id: 'b',
  modelId: 'mB',
  code: 'y',
  name: '',
  dataType: 'number',
  min: -10,
  max: 10,
  initial: 0,
  pattern: { kind: 'manual' },
};

/** craneId: null 이면 크레인 없는 모델. */
function model(
  id: string,
  craneId: string | null,
  code: string,
): SavedModelInfo {
  return {
    id,
    equipName: id,
    ...(craneId ? { craneId } : {}),
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    tagMappings: [
      {
        id: `map-${id}`,
        target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        code,
      },
    ],
  };
}

function sceneWith(craneA: string | null = 'A'): SavedSceneInfo {
  return {
    maps: [],
    texts: [],
    models: [model('mA', craneA, 'x'), model('mB', 'B', 'y')],
  } as unknown as SavedSceneInfo;
}

function scenarioWith(
  a: ScenarioTag = TAG_A,
  b: ScenarioTag = TAG_B,
): SimulationScenario {
  return { id: 's1', name: 'S', sceneFile: 'test.json', tags: [a, b] };
}

const last = new Map<string, number>();

function reset(
  scenario: SimulationScenario = scenarioWith(),
  scene: SavedSceneInfo = sceneWith(),
) {
  useScenarioStore.getState().pause();
  useScenarioStore.setState({
    scenarios: [scenario],
    activeScenarioId: null,
    tickSec: 0.1,
    speed: 1,
    hasSession: false,
    hydrated: true,
    isRunning: false,
  });
  // entries·issues 는 스토어의 commit 이 씬으로 편다 — 러너 syncDefinitions 까지
  // 한 곳(밖에서 세우면 러너가 옛 정의를 돈다).
  useScenarioStore.getState().attachScene(scene, scenario.sceneFile);
  useScenarioStore.getState().setActiveScenario(scenario.id);
  virtualTagRuntime.resetValues();
  last.clear();
  tagLiveValues.clear();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  setActiveTagSource(null);
  reset();
  setTagIngest((key, value) => last.set(key, value));
});

afterEach(() => {
  reset();
  setTagIngest(null);
  setActiveTagSource(null);
  vi.useRealTimers();
});

describe('배속', () => {
  it('speed 2 면 같은 벽시계에 파형이 두 배 진행한다', () => {
    useScenarioStore.getState().setSpeed(2);
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(1000);
    // sawtooth 10s 주기, 0→100: 벽시계 1s × 2 = 2s → 20
    expect(last.get('A.x')).toBeCloseTo(20, 5);
    expect(virtualTagRuntime.elapsed).toBe(2000);
  });

  it('범위 밖·NaN 배속은 클램프/무시', () => {
    const store = useScenarioStore.getState();
    store.setSpeed(100);
    expect(useScenarioStore.getState().speed).toBe(16);
    store.setSpeed(NaN);
    expect(useScenarioStore.getState().speed).toBe(1);
    const before = useScenarioStore.getState();
    store.setSpeed(1);
    expect(useScenarioStore.getState()).toBe(before);
  });
});

describe('seek', () => {
  it('정지 상태에서도 그 시각의 값을 내보낸다', () => {
    useScenarioStore.getState().seek(2500);
    expect(virtualTagRuntime.elapsed).toBe(2500);
    expect(last.get('A.x')).toBeCloseTo(25, 5);
    useScenarioStore.getState().seek(-1);
    expect(virtualTagRuntime.elapsed).toBe(0);
  });
});

describe('소스 표시', () => {
  it('모든 publish 는 source: simulation 을 싣는다 — setPublish(null) 로 되돌려도 그대로', () => {
    const sources: Array<string | undefined> = [];
    setTagIngest((_key, _value, options) => sources.push(options?.source));
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(100);
    virtualTagRuntime.setManualValue('B.y', 3);
    useScenarioStore.getState().seek(500);
    virtualTagRuntime.resetValues();
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((s) => s === 'simulation')).toBe(true);

    sources.length = 0;
    virtualTagRuntime.setPublish(null);
    virtualTagRuntime.setManualValue('B.y', 4);
    expect(sources).toEqual(['simulation']);
  });

  it('활성 소스가 다른 화면(실시간)에서는 게이트가 값을 버린다', () => {
    setActiveTagSource('realtime');
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(300);
    expect(last.size).toBe(0);
    expect(tagLiveValues.size).toBe(0);
    setActiveTagSource('simulation');
    vi.advanceTimersByTime(100);
    expect(last.has('A.x')).toBe(true);
  });
});

describe('시나리오·씬 변경', () => {
  it('씬에서 모델 크레인이 바뀌면 다음 동기화부터 새 키로 나가고 옛 키는 사라진다', () => {
    virtualTagRuntime.setManualValue('B.y', 7);
    useScenarioStore.getState().attachScene(sceneWith('A2'), 'test.json');
    expect(useScenarioStore.getState().entries.map((e) => e.key)).toEqual([
      'A2.x',
      'B.y',
    ]);
    expect(virtualTagRuntime.getValue('A.x')).toBeUndefined();
    expect(virtualTagRuntime.getValue('A2.x')).toBe(0);
    // 정의가 그대로인 키의 상태는 유지된다.
    expect(virtualTagRuntime.getValue('B.y')).toBe(7);
  });

  it('크레인 없는 모델의 태그는 issue 로 남고 값이 나가지 않는다', () => {
    reset(scenarioWith(), sceneWith(null));
    expect(useScenarioStore.getState().issues).toEqual([
      { tagId: 'a', modelId: 'mA', code: 'x', reason: 'crane-missing' },
    ]);
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(500);
    expect(last.has('A.x')).toBe(false);
    expect(last.get('B.y')).toBe(0);
  });

  it('범위·패턴이 그대로면 상태를 유지하고, 바뀌면 initial 로 다시 잡는다', () => {
    virtualTagRuntime.setManualValue('B.y', 7);
    useScenarioStore.getState().updateTag('s1', 'b', { name: 'renamed' });
    expect(virtualTagRuntime.getValue('B.y')).toBe(7);
    useScenarioStore.getState().updateTag('s1', 'b', { max: 5 });
    expect(virtualTagRuntime.getValue('B.y')).toBe(0);
  });

  it('재생 중 시나리오를 바꾸면 일시정지하고 시간 0 에서 새 정의로 시작한다', () => {
    const other: SimulationScenario = {
      id: 's2',
      name: 'T',
      sceneFile: 'test.json',
      tags: [{ ...TAG_B, id: 'b2', initial: 5 }],
    };
    useScenarioStore.setState({
      scenarios: [scenarioWith(), other],
    });
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(virtualTagRuntime.elapsed).toBe(1000);
    useScenarioStore.getState().setActiveScenario('s2');
    const state = useScenarioStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.activeScenarioId).toBe('s2');
    expect(virtualTagRuntime.elapsed).toBe(0);
    expect(state.entries.map((e) => e.key)).toEqual(['B.y']);
    expect(virtualTagRuntime.getValue('A.x')).toBeUndefined();
    expect(virtualTagRuntime.getValue('B.y')).toBe(5);
  });

  it('활성 시나리오가 없거나 씬에 닿는 태그가 없으면 start 는 no-op', () => {
    useScenarioStore.getState().setActiveScenario(null);
    // 같은 씬 파일의 시나리오가 있으면 첫 것으로 되돌아간다 — 목록을 비워 본다.
    useScenarioStore.setState({
      scenarios: [],
      activeScenarioId: null,
      entries: [],
    });
    const before = useScenarioStore.getState();
    before.start();
    expect(useScenarioStore.getState().isRunning).toBe(false);
    expect(useScenarioStore.getState().hasSession).toBe(false);
  });
});

describe('seek — 값은 씬 시간의 함수', () => {
  it('재생으로 t 에 닿은 값과 정지 상태에서 seek(t) 한 값이 같다', () => {
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(3000);
    const played = last.get('A.x')!;
    expect(played).toBeCloseTo(30, 5);
    useScenarioStore.getState().pause();
    virtualTagRuntime.resetValues();
    last.clear();
    useScenarioStore.getState().seek(3000);
    expect(last.get('A.x')).toBeCloseTo(played, 10);
  });

  it('seek 뒤 재개하면 원래 재생과 같은 궤적을 잇는다', () => {
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(2000);
    const at2s = last.get('A.x')!;
    vi.advanceTimersByTime(1000);
    const at3s = last.get('A.x')!;
    expect(at3s).toBeGreaterThan(at2s);
    useScenarioStore.getState().pause();
    useScenarioStore.getState().seek(2000);
    expect(last.get('A.x')).toBeCloseTo(at2s, 10);
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(last.get('A.x')).toBeCloseTo(at3s, 10);
  });

  it('벽시계 틱이 밀려도 같은 씬 시각의 값은 같다(고정 스텝, 나머지는 이월)', () => {
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(1000);
    // 타이머는 울리지 않고 시계만 250ms 감 → 한 콜백에 스텝 2개 + 50ms 이월.
    vi.setSystemTime(Date.now() + 250);
    virtualTagRuntime.tick();
    expect(virtualTagRuntime.elapsed).toBe(1250);
    const jittered = last.get('A.x')!;
    useScenarioStore.getState().pause();
    useScenarioStore.getState().seek(1250);
    expect(last.get('A.x')).toBeCloseTo(jittered, 10);
  });

  it('스텝 사이 시각으로 seek 하면 위치는 그대로, 값은 직전 스텝 경계 값', () => {
    useScenarioStore.getState().seek(2550);
    expect(virtualTagRuntime.elapsed).toBe(2550);
    expect(last.get('A.x')).toBeCloseTo(25, 5);
  });

  it('seek 는 manual 태그의 슬라이더 값을 유지하고, 리셋은 initial 로', () => {
    virtualTagRuntime.setManualValue('B.y', 7);
    useScenarioStore.getState().seek(2500);
    expect(last.get('B.y')).toBe(7);
    virtualTagRuntime.resetValues();
    expect(last.get('B.y')).toBe(0);
  });

  it('seek·리셋은 즉시(smoothTime 0), 정상 전진은 publish 간격 스무딩으로 내보낸다', () => {
    const options: Array<TagPublishOptions | undefined> = [];
    setTagIngest((_key, _value, o) => options.push(o));
    useScenarioStore.getState().seek(1000);
    expect(options.length).toBe(2);
    expect(options.every((o) => o?.smoothTime === 0)).toBe(true);
    options.length = 0;
    virtualTagRuntime.resetValues();
    expect(options.every((o) => o?.smoothTime === 0)).toBe(true);
    options.length = 0;
    useScenarioStore.getState().setSpeed(2);
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(100);
    // 100ms 스텝 ÷ ×2 = 50ms 벽시계 간격.
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => o?.smoothTime === 0.05)).toBe(true);
  });

  it('배속이 높으면 타이머 간격이 줄어 스텝마다 내보낸다(하한 16ms)', () => {
    let publishes = 0;
    setTagIngest((key) => {
      if (key === 'A.x') publishes += 1;
    });
    useScenarioStore.getState().setSpeed(8);
    useScenarioStore.getState().start();
    publishes = 0;
    vi.advanceTimersByTime(100);
    // 16ms 간격 → 100ms 안에 6번, 경과 = 6 × 16 × 8 = 768 → 700ms 스텝 값 7.
    expect(publishes).toBe(6);
    expect(virtualTagRuntime.elapsed).toBe(768);
    expect(virtualTagRuntime.getValue('A.x')).toBeCloseTo(7, 5);
  });
});

describe('종료(관제 복귀)', () => {
  it('러너 정지·시간 0, 값을 내보내지 않고 live 캐시·값 저장소를 비운다', () => {
    const store = useScenarioStore.getState();
    store.start();
    vi.advanceTimersByTime(1000);
    expect(tagLiveValues.size).toBeGreaterThan(0);
    last.clear();
    useScenarioStore.getState().stop();
    const state = useScenarioStore.getState();
    expect(state.isRunning).toBe(false);
    expect(virtualTagRuntime.elapsed).toBe(0);
    expect(last.size).toBe(0);
    expect(tagLiveValues.size).toBe(0);
    // 이후 틱이 돌지 않는다.
    vi.advanceTimersByTime(1000);
    expect(last.size).toBe(0);
  });

  it('정지 상태에서 종료해도 참조가 흔들리지 않는다(no-op 에 가깝게)', () => {
    const before = useScenarioStore.getState();
    before.stop();
    expect(useScenarioStore.getState()).toBe(before);
  });
});

describe('일시정지 → 재개', () => {
  it('재개 순간 정지 시점 값을 내보내고 거기서 이어 간다(멈춘 시간은 흐르지 않는다)', () => {
    const store = useScenarioStore.getState();
    store.start();
    vi.advanceTimersByTime(1000); // 값 10
    store.pause();
    vi.advanceTimersByTime(5000); // 5초 정지
    last.clear();
    useScenarioStore.getState().start();
    expect(last.get('A.x')).toBeCloseTo(10, 5);
    vi.advanceTimersByTime(100);
    expect(last.get('A.x')).toBeCloseTo(11, 5);
  });

  it('종료는 배속도 1 로 되돌린다', () => {
    useScenarioStore.getState().setSpeed(4);
    useScenarioStore.getState().stop();
    expect(useScenarioStore.getState().speed).toBe(1);
  });
});

describe('세션 표시(hasSession)', () => {
  it('재생하면 true, 일시정지해도 유지, 종료하면 false', () => {
    expect(useScenarioStore.getState().hasSession).toBe(false);
    useScenarioStore.getState().start();
    expect(useScenarioStore.getState().hasSession).toBe(true);
    useScenarioStore.getState().pause();
    expect(useScenarioStore.getState().hasSession).toBe(true);
    useScenarioStore.getState().stop();
    expect(useScenarioStore.getState().hasSession).toBe(false);
  });
});

describe('stopSimulation — 충돌 기록도 지운다', () => {
  it('세션 충돌 기록·활성 기록이 비고 시나리오도 종료된다', async () => {
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
    useScenarioStore.getState().start();
    stopSimulation();
    expect(useSceneCollisionStore.getState().history).toEqual([]);
    expect(useSceneCollisionStore.getState().activeRecordId).toBeNull();
    expect(useScenarioStore.getState().hasSession).toBe(false);
    expect(useScenarioStore.getState().isRunning).toBe(false);
  });
});

describe('seek 신호', () => {
  it('러너 seek·resetValues(스토어 seek·패널 리셋·종료 경로)는 알리고, 틱은 알리지 않는다. 언서브 뒤엔 오지 않는다', () => {
    let count = 0;
    const unsubscribe = subscribeSceneSeek(() => {
      count += 1;
    });
    useScenarioStore.getState().seek(2500);
    expect(count).toBe(1);
    virtualTagRuntime.resetValues();
    expect(count).toBe(2);
    virtualTagRuntime.resetValues(false);
    expect(count).toBe(3);
    useScenarioStore.getState().start();
    vi.advanceTimersByTime(500);
    expect(virtualTagRuntime.elapsed).toBeGreaterThan(0);
    expect(count).toBe(3);
    unsubscribe();
    useScenarioStore.getState().seek(0);
    expect(count).toBe(3);
  });
});
