import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectVirtualTagEntries,
  type VirtualEquipment,
  type VirtualTagDefinition,
} from '@crane/domain/virtual-tag';
import { subscribeSceneSeek } from '../scene-seek-signal';
import { useVirtualTagStore } from '../use-virtual-tag-store';
import { virtualTagRuntime } from '../virtual-tag-runner';
import {
  setTagIngest,
  tagLiveValues,
  type TagPublishOptions,
} from '../tag-value-bus';

/**
 * 시뮬레이션 시계·러너 — 배속, seek 재시뮬레이션, 속도·가속 한계, 종료,
 * 장비·태그 켜짐 판정. 저장소는 건드리지 않고 스토어 상태를 직접 세운다.
 */
const TAG_A: VirtualTagDefinition = {
  id: 'a',
  code: 'x',
  name: '',
  dataType: 'number',
  min: 0,
  max: 100,
  initial: 0,
  pattern: { kind: 'sawtooth', periodMs: 10_000 },
  enabled: true,
};
const TAG_B: VirtualTagDefinition = {
  id: 'b',
  code: 'y',
  name: '',
  dataType: 'number',
  min: -10,
  max: 10,
  initial: 0,
  pattern: { kind: 'manual' },
  enabled: true,
};

function equipmentsWith(
  a: VirtualTagDefinition = TAG_A,
  b: VirtualTagDefinition = TAG_B,
  enabledA = true,
): VirtualEquipment[] {
  return [
    { id: 'eA', craneId: 'A', enabled: enabledA, groups: [], tags: [a] },
    { id: 'eB', craneId: 'B', enabled: true, groups: [], tags: [b] },
  ];
}

const last = new Map<string, number>();

function reset(equipments: VirtualEquipment[] = equipmentsWith()) {
  useVirtualTagStore.getState().pause();
  const entries = collectVirtualTagEntries(equipments);
  useVirtualTagStore.setState({
    equipments,
    entries,
    tickMs: 100,
    speed: 1,
    hasSession: false,
    hydrated: true,
    isRunning: false,
  });
  virtualTagRuntime.syncDefinitions(entries);
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

describe('장비·태그 켜짐', () => {
  it('꺼진 장비의 태그는 태그가 켜져 있어도 내보내지 않고, 슬라이더도 조용하다', () => {
    const [a, b] = equipmentsWith();
    reset([a, { ...b, enabled: false }]);
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(500);
    expect(last.has('B:y')).toBe(false);
    expect(last.get('A:x')).toBeCloseTo(5, 5);
    virtualTagRuntime.setManualValue('B:y', 7);
    expect(last.has('B:y')).toBe(false);
    // 값은 들고 있다가 다시 켜면 그 값이 나간다.
    expect(virtualTagRuntime.getValue('B:y')).toBe(7);
    useVirtualTagStore.getState().updateEquipment('eB', { enabled: true });
    vi.advanceTimersByTime(100);
    expect(last.get('B:y')).toBe(7);
  });

  it('꺼진 태그는 내보내지 않는다', () => {
    reset(equipmentsWith({ ...TAG_A, enabled: false }));
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(300);
    expect(last.has('A:x')).toBe(false);
    expect(last.has('B:y')).toBe(true);
  });

  it('코드를 바꾸면 새 키로 상태가 다시 잡히고 옛 키는 사라진다', () => {
    virtualTagRuntime.setManualValue('B:y', 7);
    expect(
      useVirtualTagStore.getState().updateTag('eB', 'b', { code: 'z' }),
    ).toBe(true);
    expect(virtualTagRuntime.getValue('B:y')).toBeUndefined();
    expect(virtualTagRuntime.getValue('B:z')).toBe(0);
  });

  it('범위·패턴이 그대로면 상태를 유지하고, 바뀌면 initial 로 다시 잡는다', () => {
    virtualTagRuntime.setManualValue('B:y', 7);
    useVirtualTagStore.getState().updateTag('eB', 'b', { name: 'renamed' });
    expect(virtualTagRuntime.getValue('B:y')).toBe(7);
    useVirtualTagStore.getState().updateTag('eB', 'b', { max: 5 });
    expect(virtualTagRuntime.getValue('B:y')).toBe(0);
  });
});

describe('속도·가속 한계', () => {
  it('한계가 있는 태그는 파형 목표를 maxSpeed 이하로 따라간다(배속 곱한 시뮬레이션 초 기준)', () => {
    // sawtooth 10s 0→100 은 10 unit/s — 한계 2 unit/s 로 잘린다.
    reset(equipmentsWith({ ...TAG_A, limits: { maxSpeed: 2 } }));
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(1000);
    // 벽시계 1s ×1 → 최대 2 (파형 목표는 10).
    expect(last.get('A:x')).toBeCloseTo(2, 5);
    useVirtualTagStore.getState().setSpeed(2);
    vi.advanceTimersByTime(1000);
    // 시뮬레이션 2초 더 → 2 + 4 = 6.
    expect(last.get('A:x')).toBeCloseTo(6, 5);
  });

  it('seek 도 한계를 지킨다 — 0 부터 다시 적분한 값이지 그 시각의 목표값이 아니다', () => {
    reset(equipmentsWith({ ...TAG_A, limits: { maxSpeed: 0.1 } }));
    useVirtualTagStore.getState().seek(5000);
    // 목표는 50 이지만 0.1 unit/s × 5s = 0.5.
    expect(last.get('A:x')).toBeCloseTo(0.5, 5);
    virtualTagRuntime.resetValues();
    expect(last.get('A:x')).toBe(0);
  });
});

describe('seek 재시뮬레이션 — 값은 씬 시간의 함수', () => {
  // sawtooth 10s 0→100(10 unit/s) 를 maxSpeed 2 · maxAccel 1 로 따라간다 —
  // 한계가 실제로 작용해 값이 목표보다 뒤처지는 구간에서 본다.
  const LIMITED: VirtualTagDefinition = {
    ...TAG_A,
    limits: { maxSpeed: 2, maxAccel: 1 },
  };

  it('재생으로 t 에 닿은 값과 정지 상태에서 seek(t) 한 값이 같다', () => {
    reset(equipmentsWith(LIMITED));
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(3000);
    const played = last.get('A:x')!;
    expect(played).toBeGreaterThan(0);
    expect(played).toBeLessThan(30); // 목표 30 보다 뒤처져 있다.
    useVirtualTagStore.getState().pause();
    virtualTagRuntime.resetValues();
    last.clear();
    useVirtualTagStore.getState().seek(3000);
    expect(last.get('A:x')).toBeCloseTo(played, 10);
  });

  it('seek 뒤 재개하면 원래 재생과 같은 궤적을 잇는다(속도 상태 복원)', () => {
    reset(equipmentsWith(LIMITED));
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(2000);
    const at2s = last.get('A:x')!;
    vi.advanceTimersByTime(1000);
    const at3s = last.get('A:x')!;
    expect(at3s).toBeGreaterThan(at2s);
    useVirtualTagStore.getState().pause();
    useVirtualTagStore.getState().seek(2000);
    expect(last.get('A:x')).toBeCloseTo(at2s, 10);
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(1000);
    expect(last.get('A:x')).toBeCloseTo(at3s, 10);
  });

  it('벽시계 틱이 밀려도 같은 씬 시각의 값은 같다(고정 스텝, 나머지는 이월)', () => {
    reset(equipmentsWith(LIMITED));
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(1000);
    // 타이머는 울리지 않고 시계만 250ms 감 → 한 콜백에 스텝 2개 + 50ms 이월.
    vi.setSystemTime(Date.now() + 250);
    virtualTagRuntime.tick();
    expect(virtualTagRuntime.elapsed).toBe(1250);
    const jittered = last.get('A:x')!;
    useVirtualTagStore.getState().pause();
    useVirtualTagStore.getState().seek(1250);
    expect(last.get('A:x')).toBeCloseTo(jittered, 10);
  });

  it('스텝 사이 시각으로 seek 하면 위치는 그대로, 값은 직전 스텝 경계 값', () => {
    useVirtualTagStore.getState().seek(2550);
    expect(virtualTagRuntime.elapsed).toBe(2550);
    expect(last.get('A:x')).toBeCloseTo(25, 5);
  });

  it('seek 는 manual 태그의 슬라이더 값을 유지하고, 리셋은 initial 로', () => {
    virtualTagRuntime.setManualValue('B:y', 7);
    useVirtualTagStore.getState().seek(2500);
    expect(last.get('B:y')).toBe(7);
    virtualTagRuntime.resetValues();
    expect(last.get('B:y')).toBe(0);
  });

  it('seek·리셋은 즉시(smoothTime 0), 정상 전진은 publish 간격 스무딩으로 내보낸다', () => {
    const options: Array<TagPublishOptions | undefined> = [];
    setTagIngest((_key, _value, o) => options.push(o));
    useVirtualTagStore.getState().seek(1000);
    expect(options.length).toBe(2);
    expect(options.every((o) => o?.smoothTime === 0)).toBe(true);
    options.length = 0;
    virtualTagRuntime.resetValues();
    expect(options.every((o) => o?.smoothTime === 0)).toBe(true);
    options.length = 0;
    useVirtualTagStore.getState().setSpeed(2);
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(100);
    // 100ms 스텝 ÷ ×2 = 50ms 벽시계 간격.
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => o?.smoothTime === 0.05)).toBe(true);
  });

  it('배속이 높으면 타이머 간격이 줄어 스텝마다 내보낸다(하한 16ms)', () => {
    let publishes = 0;
    setTagIngest((key) => {
      if (key === 'A:x') publishes += 1;
    });
    useVirtualTagStore.getState().setSpeed(8);
    useVirtualTagStore.getState().start();
    publishes = 0;
    vi.advanceTimersByTime(100);
    // 16ms 간격 → 100ms 안에 6번, 경과 = 6 × 16 × 8 = 768 → 700ms 스텝 값 7.
    expect(publishes).toBe(6);
    expect(virtualTagRuntime.elapsed).toBe(768);
    expect(virtualTagRuntime.getValue('A:x')).toBeCloseTo(7, 5);
  });
});

describe('종료(관제 복귀)', () => {
  it('러너 정지·시간 0, 값을 내보내지 않고 live 캐시·값 저장소를 비운다', () => {
    const store = useVirtualTagStore.getState();
    store.start();
    vi.advanceTimersByTime(1000);
    expect(tagLiveValues.size).toBeGreaterThan(0);
    last.clear();
    useVirtualTagStore.getState().stop();
    const state = useVirtualTagStore.getState();
    expect(state.isRunning).toBe(false);
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
    reset(equipmentsWith({ ...TAG_A, limits: { maxSpeed: 2 } }));
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

describe('seek 신호', () => {
  it('러너 seek·resetValues(스토어 seek·패널 리셋·종료 경로)는 알리고, 틱은 알리지 않는다. 언서브 뒤엔 오지 않는다', () => {
    let count = 0;
    const unsubscribe = subscribeSceneSeek(() => {
      count += 1;
    });
    useVirtualTagStore.getState().seek(2500);
    expect(count).toBe(1);
    virtualTagRuntime.resetValues();
    expect(count).toBe(2);
    virtualTagRuntime.resetValues(false);
    expect(count).toBe(3);
    useVirtualTagStore.getState().start();
    vi.advanceTimersByTime(500);
    expect(virtualTagRuntime.elapsed).toBeGreaterThan(0);
    expect(count).toBe(3);
    unsubscribe();
    useVirtualTagStore.getState().seek(0);
    expect(count).toBe(3);
  });
});
