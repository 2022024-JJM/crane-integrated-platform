import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { createBvhBuildQueue, type BvhBuildQueue } from '../bvh-build-queue';

// three-mesh-bvh 의 타입 증강(boundsTree: MeshBVH)을 우회해 가짜 값을 심는다 —
// 큐는 존재 여부만 보므로 실제 BVH 를 만들 필요가 없다.
function setBoundsTree(g: BoxGeometry, value: unknown): void {
  (g as unknown as { boundsTree: unknown }).boundsTree = value;
}

/** 손으로 돌리는 시계. 빌드 하나가 `costMs` 를 소모한 것으로 친다. */
let nowMs = 0;
const clock = () => nowMs;

/**
 * computeBoundsTree 가 붙은(bvh-setup 이후) 지오메트리 흉내.
 * `tris` 는 정렬 키(인덱스 수 / 3), `costMs` 는 빌드에 걸리는 가짜 시간.
 */
function geometry({ tris = 1, costMs = 1 } = {}): BoxGeometry {
  const g = new BoxGeometry(1, 1, 1);
  g.setIndex(new BufferAttribute(new Uint16Array(tris * 3), 1));
  (g as unknown as { computeBoundsTree: unknown }).computeBoundsTree = vi.fn(
    () => {
      nowMs += costMs;
      setBoundsTree(g, { built: true });
    },
  );
  return g;
}

function meshOf(g: BoxGeometry): Mesh {
  return new Mesh(g, new MeshBasicMaterial());
}

function buildSpy(g: BoxGeometry): ReturnType<typeof vi.fn> {
  return g.computeBoundsTree as unknown as ReturnType<typeof vi.fn>;
}

/** 슬라이스를 손으로 돌리는 스케줄러. */
function manualScheduler() {
  const runs: Array<() => void> = [];
  const cancelled: number[] = [];
  const schedule = (run: () => void) => {
    const index = runs.push(run) - 1;
    return () => {
      cancelled.push(index);
    };
  };
  const flush = () => {
    const run = runs.shift();
    if (!run) return false;
    run();
    return true;
  };
  const drain = () => {
    while (flush()) {
      /* 큐가 빌 때까지 */
    }
  };
  return { runs, cancelled, schedule, flush, drain };
}

function setup(): {
  queue: BvhBuildQueue;
  sched: ReturnType<typeof manualScheduler>;
  listener: ReturnType<typeof vi.fn>;
} {
  const sched = manualScheduler();
  const queue = createBvhBuildQueue({ schedule: sched.schedule, clock });
  const listener = vi.fn();
  queue.subscribe(listener);
  return { queue, sched, listener };
}

afterEach(() => {
  nowMs = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createBvhBuildQueue — enqueue', () => {
  it('지오메트리를 큐에 넣고 슬라이스를 예약한다', () => {
    const { queue, sched, listener } = setup();
    queue.enqueue([meshOf(geometry())]);
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 0, total: 1 });
    expect(sched.runs).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('같은 지오메트리를 쓰는 인스턴스 둘은 한 번만 빌드된다', () => {
    const { queue, sched } = setup();
    const g = geometry();
    queue.enqueue([meshOf(g)]);
    queue.enqueue([meshOf(g)]);
    expect(queue.getSnapshot().total).toBe(1);
    sched.flush();
    expect(buildSpy(g)).toHaveBeenCalledTimes(1);
  });

  it('boundsTree 가 이미 있으면 넣지 않고 스냅샷 참조를 유지한다', () => {
    const { queue, sched, listener } = setup();
    const g = geometry();
    setBoundsTree(g, {});
    const before = queue.getSnapshot();
    queue.enqueue([meshOf(g)]);
    expect(queue.getSnapshot()).toBe(before);
    expect(sched.runs).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('computeBoundsTree 가 없는 지오메트리는 건너뛴다', () => {
    const { queue, sched } = setup();
    const g = new BoxGeometry(1, 1, 1);
    queue.enqueue([new Mesh(g, new MeshBasicMaterial())]);
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
    expect(sched.runs).toHaveLength(0);
  });

  it('빈 배열은 no-op 이다', () => {
    const { queue, sched, listener } = setup();
    const before = queue.getSnapshot();
    queue.enqueue([]);
    expect(queue.getSnapshot()).toBe(before);
    expect(sched.runs).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('슬라이스가 예약된 상태에서 더 넣어도 예약을 중복하지 않는다', () => {
    const { queue, sched } = setup();
    queue.enqueue([meshOf(geometry())]);
    queue.enqueue([meshOf(geometry())]);
    expect(sched.runs).toHaveLength(1);
    expect(queue.getSnapshot()).toEqual({ pending: 2, done: 0, total: 2 });
  });
});

describe('createBvhBuildQueue — 정렬', () => {
  it('삼각형 수 오름차순으로 빌드한다 — 큰 지형은 마지막, 나중에 넣어도 앞에 낀다', () => {
    const { queue, sched } = setup();
    const big = geometry({ tris: 1_000_000, costMs: 400 });
    const mid = geometry({ tris: 5_000 });
    const small = geometry({ tris: 100 });
    const order: string[] = [];
    for (const [name, g] of [
      ['big', big],
      ['mid', mid],
      ['small', small],
    ] as const) {
      buildSpy(g).mockImplementation(() => {
        order.push(name);
        setBoundsTree(g, {});
      });
    }
    queue.enqueue([meshOf(big), meshOf(mid)]);
    queue.enqueue([meshOf(small)]);
    sched.drain();
    expect(order).toEqual(['small', 'mid', 'big']);
  });

  it('인덱스가 없으면 정점 수로, 둘 다 없으면 0 으로 보고 정렬한다', () => {
    const { queue, sched } = setup();
    // BoxGeometry 정점 24개 → 8 삼각형 상당.
    const noIndex = geometry({ tris: 10 });
    noIndex.setIndex(null);
    const indexed = geometry({ tris: 2 });
    const bare = geometry({ tris: 100 });
    bare.setIndex(null);
    bare.deleteAttribute('position');
    const order: BoxGeometry[] = [];
    for (const g of [noIndex, indexed, bare]) {
      buildSpy(g).mockImplementation(() => {
        order.push(g);
        setBoundsTree(g, {});
      });
    }
    queue.enqueue([meshOf(noIndex), meshOf(indexed), meshOf(bare)]);
    sched.drain();
    expect(order).toEqual([bare, indexed, noIndex]);
  });
});

describe('createBvhBuildQueue — 슬라이스 예산', () => {
  it('예산 안에서는 여러 개를 이어서 빌드한다(1ms 짜리 → 슬라이스당 8개)', () => {
    const { queue, sched } = setup();
    const gs = Array.from({ length: 10 }, () => geometry({ costMs: 1 }));
    queue.enqueue(gs.map(meshOf));
    sched.flush();
    expect(queue.getSnapshot()).toEqual({ pending: 2, done: 8, total: 10 });
    // 남았으니 다음 슬라이스가 예약된다.
    expect(sched.runs).toHaveLength(1);
    sched.flush();
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
  });

  it('예산을 넘기는 큰 빌드도 슬라이스당 최소 한 개는 한다', () => {
    const { queue, sched } = setup();
    const gs = [geometry({ costMs: 400 }), geometry({ costMs: 400 })];
    queue.enqueue(gs.map(meshOf));
    sched.flush();
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 1, total: 2 });
  });

  it('예산 정확값(8ms)에 도달하면 멈추고, 그 직전(7ms)이면 계속한다', () => {
    const { queue, sched } = setup();
    queue.enqueue(
      [
        geometry({ tris: 1, costMs: 7 }),
        geometry({ tris: 2, costMs: 1 }),
        geometry({ tris: 3 }),
      ].map(meshOf),
    );
    sched.flush();
    // 7 → 계속, 7+1 = 8 → 멈춤.
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 2, total: 3 });
  });

  it('큐가 비면 done/total 을 0 으로 되돌리고 예약을 멈춘다', () => {
    const { queue, sched, listener } = setup();
    queue.enqueue([geometry(), geometry()].map(meshOf));
    listener.mockClear();
    sched.flush();
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
    expect(sched.runs).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('드레인 뒤 새로 넣으면 카운트가 다시 시작된다', () => {
    const { queue, sched } = setup();
    queue.enqueue([meshOf(geometry())]);
    sched.flush();
    queue.enqueue(
      [geometry({ tris: 9, costMs: 20 }), geometry(), geometry()].map(meshOf),
    );
    expect(queue.getSnapshot()).toEqual({ pending: 3, done: 0, total: 3 });
    sched.flush();
    // 작은 둘(1ms) 뒤 큰 것(20ms)까지 — 8ms 를 넘긴 시점에 멈춘다.
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
  });

  it('큐에 있는 동안 다른 경로가 먼저 빌드했으면 다시 빌드하지 않는다', () => {
    const { queue, sched } = setup();
    const g = geometry();
    queue.enqueue([meshOf(g)]);
    setBoundsTree(g, {});
    sched.flush();
    expect(buildSpy(g)).not.toHaveBeenCalled();
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
  });
});

describe('createBvhBuildQueue — cancel', () => {
  it('미빌드 항목을 큐에서 빼고 total 을 줄인다', () => {
    const { queue, sched } = setup();
    const a = geometry();
    const b = geometry();
    queue.enqueue([meshOf(a), meshOf(b)]);
    queue.cancel([meshOf(a)]);
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 0, total: 1 });
    sched.flush();
    expect(buildSpy(a)).not.toHaveBeenCalled();
    expect(buildSpy(b)).toHaveBeenCalledTimes(1);
  });

  it('이미 빌드된 BVH 는 버리지 않는다', () => {
    const { queue, sched } = setup();
    const g = geometry();
    const mesh = meshOf(g);
    queue.enqueue([mesh]);
    sched.flush();
    const before = queue.getSnapshot();
    queue.cancel([mesh]);
    expect(g.boundsTree).toEqual({ built: true });
    expect(queue.getSnapshot()).toBe(before);
  });

  it('큐에 없는 메시 cancel 은 no-op 이다(참조 유지)', () => {
    const { queue, listener } = setup();
    queue.enqueue([meshOf(geometry())]);
    const before = queue.getSnapshot();
    listener.mockClear();
    queue.cancel([meshOf(geometry())]);
    expect(queue.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('같은 지오메트리 인스턴스 둘 중 하나만 cancel 하면 큐에 남는다', () => {
    const { queue, sched } = setup();
    const g = geometry();
    const m1 = meshOf(g);
    const m2 = meshOf(g);
    queue.enqueue([m1]);
    queue.enqueue([m2]);
    queue.cancel([m1]);
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 0, total: 1 });
    queue.cancel([m2]);
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
    // 전부 빠졌으므로 예약도 취소된다.
    expect(sched.cancelled).toHaveLength(1);
  });

  it('전부 cancel 되면 done 도 0 으로 돌아간다', () => {
    const { queue, sched } = setup();
    const a = geometry({ tris: 1, costMs: 20 });
    const b = geometry({ tris: 5 });
    const mb = meshOf(b);
    queue.enqueue([meshOf(a), mb]);
    sched.flush(); // a(20ms) 빌드 후 예산 초과, b 대기
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 1, total: 2 });
    queue.cancel([mb]);
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
  });
});

describe('createBvhBuildQueue — 구독', () => {
  it('unsubscribe 뒤에는 알리지 않는다', () => {
    const sched = manualScheduler();
    const queue = createBvhBuildQueue({ schedule: sched.schedule, clock });
    const listener = vi.fn();
    const unsubscribe = queue.subscribe(listener);
    unsubscribe();
    queue.enqueue([meshOf(geometry())]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createBvhBuildQueue — 기본 스케줄러', () => {
  it('requestIdleCallback 이 없으면 setTimeout 으로 폴백한다', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const queue = createBvhBuildQueue({ clock });
    const gs = [geometry({ costMs: 20 }), geometry({ costMs: 20 })];
    queue.enqueue(gs.map(meshOf));
    vi.runOnlyPendingTimers();
    expect(queue.getSnapshot()).toEqual({ pending: 1, done: 1, total: 2 });
    vi.runOnlyPendingTimers();
    expect(queue.getSnapshot()).toEqual({ pending: 0, done: 0, total: 0 });
  });

  it('requestIdleCallback 이 있으면 프레임급 timeout 과 함께 쓴다', () => {
    const ric = vi.fn<(run: () => void, opts: unknown) => number>(() => 1);
    const cic = vi.fn();
    vi.stubGlobal('requestIdleCallback', ric);
    vi.stubGlobal('cancelIdleCallback', cic);
    const queue = createBvhBuildQueue({ clock });
    const mesh = meshOf(geometry());
    queue.enqueue([mesh]);
    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 16 });
    queue.cancel([mesh]);
    expect(cic).toHaveBeenCalledWith(1);
  });
});
