import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type SavedMapInfo,
  type SeaReachMask,
  type SeaReachSource,
} from '@crane/domain/3d';
import { Group, type Object3D } from 'three';
import type { SliceScheduler } from '../../lib/sliced-task';
import {
  createSeaReachController,
  resolveSeaReachSignature,
  type SeaReachStore,
} from '../sea-reach-controller';

const GROUND: SavedMapInfo = {
  id: 'ground',
  path: '/maps/okpo.glb',
  role: 'ground',
};
const CONTEXT: SavedMapInfo = {
  id: 'context',
  path: '/maps/okpo-terrain.glb',
  role: 'context',
};

function maskOf(tag: number): SeaReachMask {
  return {
    data: new Uint8Array([tag]),
    width: 1,
    height: 1,
    transform: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };
}

function fakeStore(initial: string | null = null) {
  let signature = initial;
  const store: SeaReachStore = {
    publish: vi.fn((_mask: SeaReachMask | null, next: string) => {
      signature = next;
    }),
    reset: vi.fn(() => {
      signature = null;
    }),
    signature: () => signature,
  };
  return store;
}

function manualScheduler() {
  const pending: { run: () => void; cancelled: boolean }[] = [];
  const schedule: SliceScheduler = (run) => {
    const entry = { run, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  return {
    schedule,
    /** 예약된 슬라이스를 끝까지(새로 예약되는 것 포함) 돌린다. */
    flush() {
      while (pending.length > 0) {
        const entry = pending.shift()!;
        if (!entry.cancelled) entry.run();
      }
    },
    /** 슬라이스 하나만 돌린다. */
    step() {
      const entry = pending.shift();
      if (entry && !entry.cancelled) entry.run();
    },
    get size() {
      return pending.filter((entry) => !entry.cancelled).length;
    },
  };
}

function setup({
  published = null as string | null,
  steps = 2,
  roots = {} as Record<string, Object3D>,
} = {}) {
  const store = fakeStore(published);
  const scheduler = manualScheduler();
  const onChange = vi.fn();
  const builds: { sources: readonly SeaReachSource[]; tag: number }[] = [];
  const registry = new Map(Object.entries(roots));
  const build = vi.fn(function* (
    sources: readonly SeaReachSource[],
  ): Generator<void, SeaReachMask | null> {
    const tag = builds.length + 1;
    builds.push({ sources, tag });
    for (let step = 0; step < steps; step += 1) yield;
    return maskOf(tag);
  });
  const controller = createSeaReachController({
    resolveRoot: (id) => registry.get(id),
    onChange,
    build,
    store,
    // 호출마다 예산을 넘기는 시계 — 슬라이스 하나가 한 구간만 돈다.
    task: { schedule: scheduler.schedule, clock: steppingClock(100) },
  });
  return { controller, store, scheduler, onChange, build, builds, registry };
}

function steppingClock(step: number): () => number {
  let now = 0;
  return () => {
    const value = now;
    now += step;
    return value;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveSeaReachSignature', () => {
  it('지도가 없으면 빈 문자열이다', () => {
    expect(resolveSeaReachSignature(undefined)).toBe('');
    expect(resolveSeaReachSignature(null)).toBe('');
    expect(resolveSeaReachSignature([])).toBe('');
  });

  it('배치가 생략된 지도는 원점·무회전·등배와 같다', () => {
    expect(resolveSeaReachSignature([GROUND])).toBe(
      resolveSeaReachSignature([
        {
          ...GROUND,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ]),
    );
  });

  it.each([
    ['경로', { path: '/maps/plane.glb' }],
    ['위치', { position: [0, -35.349, 0] as [number, number, number] }],
    ['회전', { rotation: [0, 309.4, 0] as [number, number, number] }],
    ['크기', { scale: [1, 2, 1] as [number, number, number] }],
  ])('%s 가 바뀌면 서명이 바뀐다', (_label, patch) => {
    expect(resolveSeaReachSignature([{ ...GROUND, ...patch }])).not.toBe(
      resolveSeaReachSignature([GROUND]),
    );
  });

  it('id·이름·잠금·카메라 기준은 서명에 들어가지 않는다', () => {
    expect(
      resolveSeaReachSignature([
        {
          ...GROUND,
          id: 'other',
          name: '옥포',
          locked: false,
          cameraBounds: true,
        },
      ]),
    ).toBe(resolveSeaReachSignature([GROUND]));
  });

  it('지도 수와 순서를 구분한다', () => {
    const both = resolveSeaReachSignature([GROUND, CONTEXT]);
    expect(both).not.toBe(resolveSeaReachSignature([GROUND]));
    expect(both).not.toBe(resolveSeaReachSignature([CONTEXT, GROUND]));
  });
});

describe('createSeaReachController', () => {
  it('지도가 없는 씬은 계산 없이 바로 전부 바다다', () => {
    const { controller, store, onChange, build, scheduler } = setup();

    controller.poll([]);

    expect(store.publish).toHaveBeenCalledTimes(1);
    expect(store.publish).toHaveBeenCalledWith(null, '');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
    expect(scheduler.size).toBe(0);

    // 다음 프레임 — 이미 올라가 있으므로 no-op.
    controller.poll([]);
    controller.poll(undefined);
    expect(store.publish).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('선언된 지도가 전부 로드될 때까지 만들지 않는다', () => {
    const { controller, registry, build, store, scheduler, builds } = setup({
      roots: { ground: new Group() },
    });
    const maps = [GROUND, CONTEXT];

    controller.poll(maps);
    controller.poll(maps);
    expect(build).not.toHaveBeenCalled();
    expect(store.publish).not.toHaveBeenCalled();

    registry.set('context', new Group());
    controller.poll(maps);
    // 프레임 콜백 안에서는 예약만 한다 — 계산 본문은 아직 돌지 않았다.
    expect(builds).toHaveLength(0);
    expect(scheduler.size).toBe(1);

    scheduler.flush();
    expect(build).toHaveBeenCalledTimes(1);
    expect(builds).toHaveLength(1);
    expect(builds[0].sources.map((source) => source.root)).toEqual([
      registry.get('ground'),
      registry.get('context'),
    ]);
  });

  it('계산이 끝나면 서명과 함께 올리고 한 프레임을 깨운다', () => {
    const { controller, store, onChange, scheduler } = setup({
      roots: { ground: new Group() },
    });
    const maps = [GROUND];

    controller.poll(maps);
    expect(store.publish).not.toHaveBeenCalled();

    scheduler.flush();
    expect(store.publish).toHaveBeenCalledTimes(1);
    expect(store.publish).toHaveBeenCalledWith(
      maskOf(1),
      resolveSeaReachSignature(maps),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('계산 중에는 프레임마다 다시 시작하지 않는다', () => {
    const { controller, build, scheduler } = setup({
      roots: { ground: new Group() },
      steps: 5,
    });
    const maps = [GROUND];

    controller.poll(maps);
    scheduler.step();
    controller.poll(maps);
    scheduler.step();
    controller.poll(maps);
    scheduler.flush();

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('올린 뒤에는 다시 만들지 않는다', () => {
    const { controller, build, store, scheduler } = setup({
      roots: { ground: new Group() },
    });
    const maps = [GROUND];
    controller.poll(maps);
    scheduler.flush();

    controller.poll(maps);
    controller.poll([{ ...GROUND }]);
    scheduler.flush();

    expect(build).toHaveBeenCalledTimes(1);
    expect(store.publish).toHaveBeenCalledTimes(1);
  });

  it('범위 지도는 역할이 바닥(ground)인 지도다', () => {
    const { controller, builds, scheduler } = setup({
      roots: { ground: new Group(), context: new Group() },
    });

    controller.poll([CONTEXT, GROUND]);
    scheduler.flush();

    expect(builds[0].sources.map((source) => source.bounds)).toEqual([
      false,
      true,
    ]);
  });

  it('바닥 지도가 없으면 첫 지도가 범위 지도다', () => {
    const { controller, builds, scheduler } = setup({
      roots: { context: new Group(), custom: new Group() },
    });

    controller.poll([CONTEXT, { id: 'custom', path: '/maps/unknown.glb' }]);
    scheduler.flush();

    expect(builds[0].sources.map((source) => source.bounds)).toEqual([
      true,
      false,
    ]);
  });

  describe('이미 올라가 있는 마스크', () => {
    it('서명이 같으면 그대로 쓴다 — 계산도 초기화도 없다', () => {
      const maps = [GROUND];
      const { controller, build, store, onChange, scheduler } = setup({
        published: resolveSeaReachSignature(maps),
        roots: { ground: new Group() },
      });

      controller.poll(maps);
      scheduler.flush();

      expect(build).not.toHaveBeenCalled();
      expect(store.reset).not.toHaveBeenCalled();
      expect(store.publish).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('다른 씬이 남긴 마스크는 지도 로드를 기다리지 않고 바로 내린다', () => {
      const { controller, store, onChange, build } = setup({
        published: 'another-scene',
      });

      controller.poll([GROUND]);

      expect(store.reset).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(build).not.toHaveBeenCalled();

      // 내린 뒤에는 반복하지 않는다.
      controller.poll([GROUND]);
      expect(store.reset).toHaveBeenCalledTimes(1);
    });

    it('다른 씬의 마스크가 남아 있어도 지도 없는 씬은 전부 바다로 바꾼다', () => {
      const { controller, store } = setup({ published: 'another-scene' });

      controller.poll([]);

      expect(store.publish).toHaveBeenLastCalledWith(null, '');
      expect(store.signature()).toBe('');
    });

    it('이 컨트롤러가 올린 마스크는 다시 만드는 동안 내리지 않는다', () => {
      const { controller, store, scheduler, build } = setup({
        roots: { ground: new Group() },
      });
      controller.poll([GROUND]);
      scheduler.flush();
      expect(store.publish).toHaveBeenCalledTimes(1);

      const moved = [
        { ...GROUND, position: [0, -5, 0] as [number, number, number] },
      ];
      controller.poll(moved);
      expect(store.reset).not.toHaveBeenCalled();
      expect(store.signature()).toBe(resolveSeaReachSignature([GROUND]));

      scheduler.flush();
      expect(build).toHaveBeenCalledTimes(2);
      expect(store.publish).toHaveBeenLastCalledWith(
        maskOf(2),
        resolveSeaReachSignature(moved),
      );
      expect(store.reset).not.toHaveBeenCalled();
    });

    it('재사용한 마스크도 이 컨트롤러 것으로 본다 — 편집해도 내리지 않는다', () => {
      const maps = [GROUND];
      const { controller, store, scheduler } = setup({
        published: resolveSeaReachSignature(maps),
        roots: { ground: new Group() },
      });
      controller.poll(maps);

      controller.poll([{ ...GROUND, scale: [2, 2, 2] }]);

      expect(store.reset).not.toHaveBeenCalled();
      expect(scheduler.size).toBe(1);
    });
  });

  describe('계산 도중 지도 구성이 바뀔 때', () => {
    it('이전 계산을 버리고 새 구성으로 다시 시작한다', () => {
      const { controller, store, scheduler, build } = setup({
        roots: { ground: new Group() },
        steps: 5,
      });
      const moved = [
        { ...GROUND, position: [10, 0, 0] as [number, number, number] },
      ];

      controller.poll([GROUND]);
      scheduler.step();
      scheduler.step();
      controller.poll(moved);
      scheduler.flush();

      expect(build).toHaveBeenCalledTimes(2);
      // 버린 계산(1)은 올라가지 않는다.
      expect(store.publish).toHaveBeenCalledTimes(1);
      expect(store.publish).toHaveBeenCalledWith(
        maskOf(2),
        resolveSeaReachSignature(moved),
      );
    });

    it('새 구성의 지도가 아직 없으면 이전 계산만 버리고 기다린다', () => {
      const { controller, store, scheduler, build, registry } = setup({
        roots: { ground: new Group() },
        steps: 5,
      });

      controller.poll([GROUND]);
      scheduler.step();
      controller.poll([GROUND, CONTEXT]);
      scheduler.flush();

      expect(build).toHaveBeenCalledTimes(1);
      expect(store.publish).not.toHaveBeenCalled();

      registry.set('context', new Group());
      controller.poll([GROUND, CONTEXT]);
      scheduler.flush();
      expect(build).toHaveBeenCalledTimes(2);
      expect(store.publish).toHaveBeenCalledTimes(1);
    });

    it('계산 중 지도가 전부 빠지면 계산을 버리고 전부 바다로 둔다', () => {
      const { controller, store, scheduler } = setup({
        roots: { ground: new Group() },
        steps: 5,
      });

      controller.poll([GROUND]);
      scheduler.step();
      controller.poll([]);
      scheduler.flush();

      expect(store.publish).toHaveBeenCalledTimes(1);
      expect(store.publish).toHaveBeenCalledWith(null, '');
    });
  });

  describe('계산 실패', () => {
    function failingSetup() {
      const store = fakeStore();
      const scheduler = manualScheduler();
      const onChange = vi.fn();
      const build = vi.fn(function* (): Generator<void, SeaReachMask | null> {
        yield;
        throw new Error('geometry gone');
      });
      const controller = createSeaReachController({
        resolveRoot: () => new Group(),
        onChange,
        build,
        store,
        task: { schedule: scheduler.schedule, clock: steppingClock(100) },
      });
      return { controller, store, scheduler, onChange, build };
    }

    it('콘솔에 남기고 아무것도 올리지 않으며, 같은 구성은 다시 시도하지 않는다', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { controller, store, scheduler, onChange, build } = failingSetup();

      controller.poll([GROUND]);
      scheduler.flush();
      controller.poll([GROUND]);
      controller.poll([GROUND]);
      scheduler.flush();

      expect(build).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(store.publish).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
      expect(store.signature()).toBeNull();
    });

    it('구성이 바뀌면 다시 시도한다', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { controller, scheduler, build } = failingSetup();

      controller.poll([GROUND]);
      scheduler.flush();
      controller.poll([{ ...GROUND, position: [1, 0, 0] }]);
      scheduler.flush();

      expect(build).toHaveBeenCalledTimes(2);
    });
  });

  describe('정리', () => {
    it('dispose 는 돌던 계산을 버린다 — 그 뒤로 올라가지 않는다', () => {
      const { controller, store, scheduler, onChange } = setup({
        roots: { ground: new Group() },
        steps: 5,
      });

      controller.poll([GROUND]);
      scheduler.step();
      controller.dispose();
      scheduler.flush();

      expect(store.publish).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('dispose 는 올라가 있는 마스크를 내리지 않는다 — 재진입 때 다시 쓴다', () => {
      const { controller, store, scheduler } = setup({
        roots: { ground: new Group() },
      });
      controller.poll([GROUND]);
      scheduler.flush();

      controller.dispose();

      expect(store.reset).not.toHaveBeenCalled();
      expect(store.signature()).toBe(resolveSeaReachSignature([GROUND]));
    });

    it('계산이 없을 때의 dispose 와 두 번째 dispose 는 no-op 이다', () => {
      const { controller } = setup();
      expect(() => {
        controller.dispose();
        controller.dispose();
      }).not.toThrow();
    });
  });

  it('같은 배열 참조면 서명을 다시 만들지 않는다', () => {
    const { controller } = setup();
    const maps = [GROUND];
    const join = vi.spyOn(Array.prototype, 'join');

    controller.poll(maps);
    const afterFirst = join.mock.calls.length;
    controller.poll(maps);
    controller.poll(maps);

    expect(afterFirst).toBeGreaterThan(0);
    expect(join.mock.calls.length).toBe(afterFirst);
  });
});
