import type { BufferGeometry, Mesh } from 'three';
import {
  hasSilhouetteOutlineGeometry,
  warmSilhouetteOutlineGeometry,
} from './silhouette-outline';

/**
 * 전역 지오메트리 워밍업 큐 — 클릭 hit-test raycast 가속 구조(BVH, boundsTree)와
 * 실루엣 테두리용 스무딩 노멀 사본을 프레임 사이에 나눠 만든다.
 *
 * mount 시 동기 일괄 빌드는 지형 프리미티브 하나(135만 삼각형)에 400ms 대라
 * 첫 진입이 눈에 띄게 멈춘다. 그렇다고 유휴 시간(`requestIdleCallback`)에만
 * 맡기면 로딩 직후엔 셰이더 컴파일·섀도맵·브루트포스 raycast 가 프레임을 다
 * 채워 유휴 시간이 거의 없고, 콜백은 타임아웃으로만 돌아 지오메트리 90개짜리
 * 씬이 수십 초 걸렸다(2026-09-08 실측: philly 씬 전체 빌드 합계는 1초 안팎).
 *
 * 그래서 슬라이스는 **고정 예산**(SLICE_BUDGET_MS, 최소 1개는 처리)으로 돌고,
 * 다음 슬라이스를 **프레임급 간격**(유휴 시간이 있으면 즉시, 없어도
 * SLICE_INTERVAL_MS 안에)으로 예약한다 — 작업 총량이 작으니 1~2초 안에 끝나고
 * 그동안 프레임당 예산만큼만 쓴다. 큐는 **종류(BVH → 외곽선) → 삼각형 수
 * 오름차순**이라 모델·조선소 지도가 먼저 클릭 가능해지고 지형의 큰 프리미티브가
 * 마지막에 간다(그 한 번의 정지는 피할 수 없다 — 없애려면 워커 빌드).
 *
 * 예전에는 `ModelMesh` 인스턴스마다 자기 체인을 돌렸다. 큐를 하나로 모은 이유:
 *  - 진행 상황(`done/total`)을 화면(SceneWarmupIndicator)이 구독할 수 있다.
 *  - 지오메트리는 GLTF 캐시 공유라 같은 GLB 의 다른 인스턴스가 같은 지오메트리를
 *    다시 큐에 넣는 일이 없다(참조 카운트로 한 번만 빌드).
 *  - 크기순 정렬은 전역이어야 의미가 있다.
 *
 * 지도도 BVH 빌드 대상이다 — 없으면 포인터 이동·휠 줌마다 지형 178만 삼각형을
 * 브루트 포스 순회해 프레임이 밀린다(빌드보다 훨씬 비싸다).
 *
 * **외곽선(outline) 작업**은 `enqueue` 옵션으로 켠 메시만 대상이다 — 실루엣
 * 테두리(silhouette-outline.ts)가 처음 켜질 때 메인 스레드에서 도는 스무딩
 * 노멀 사본 생성(골리앗+LLC 한 쌍이면 약 180ms)을 여기서 미리 해 둔다. 지도는
 * 넣지 않는다 — 지형은 135만 삼각형이라 사본이 수 초·수백 MB 다. 사본 캐시와
 * 해제는 silhouette-outline.ts 가 소유하고, 큐는 "없으면 만든다"만 한다.
 *
 * BVH 자체는 `cancel` 에서 버리지 않는다 — 지오메트리가 GLTF 캐시 공유라, 같은
 * GLB 의 다른 인스턴스(예: 씬에 2개 배치된 LLC-002)가 아직 살아 있으면 그쪽
 * raycast 가 느려진다. 해제는 region 을 떠나며 캐시를 비울 때 한다
 * (releaseGltfCache). `cancel` 은 아직 처리하지 않은 항목만 큐에서 뺀다.
 */

export type BvhBuildJobKind = 'bvh' | 'outline';

export interface BvhBuildCounts {
  /** 아직 처리하지 않은 작업 수. */
  pending: number;
  /** 이번 세션에서 마친 수. 큐가 비면 0 으로 돌아간다. */
  done: number;
  /** 이번 세션에 들어온 수(done + pending). 큐가 비면 0 으로 돌아간다. */
  total: number;
}

/** 종류별 진행 상황. 큐 전체가 비어야 둘 다 0 으로 돌아간다. */
export interface BvhBuildSnapshot {
  bvh: BvhBuildCounts;
  outline: BvhBuildCounts;
}

/**
 * 어떤 작업을 넣을지. `cancel` 에는 `enqueue` 와 **같은 옵션**을 넘긴다 —
 * 종류별 참조 카운트라 다른 옵션으로 빼면 남의 참조를 내린다.
 */
export interface BvhBuildOptions {
  /** 클릭 raycast 가속 BVH. 기본 true. */
  bvh?: boolean;
  /** 실루엣 테두리용 스무딩 노멀 사본. 기본 false. */
  outline?: boolean;
}

/** 슬라이스 실행을 예약하고 취소 함수를 돌려준다. 테스트에서 주입한다. */
export type BvhBuildScheduler = (run: () => void) => () => void;

/** 외곽선 사본의 존재 확인·생성. 테스트에서 주입한다. */
export interface BvhBuildOutlineWarmer {
  isReady: (geometry: BufferGeometry) => boolean;
  warm: (geometry: BufferGeometry) => void;
}

export interface BvhBuildQueue {
  /**
   * boundsTree 가 이미 있거나 computeBoundsTree 가 없는 지오메트리는 BVH 작업을
   * 건너뛰고, 사본이 이미 있는 지오메트리는 outline 작업을 건너뛴다.
   */
  enqueue: (meshes: readonly Mesh[], options?: BvhBuildOptions) => void;
  /** 미처리 항목의 참조를 하나 내린다. 0 이 되면 큐에서 뺀다. 만든 결과는 유지. */
  cancel: (meshes: readonly Mesh[], options?: BvhBuildOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** 값이 바뀌지 않으면 같은 객체를 돌려준다(useSyncExternalStore 용). */
  getSnapshot: () => BvhBuildSnapshot;
}

type BvhGeometry = BufferGeometry & {
  boundsTree?: unknown;
  computeBoundsTree?: () => void;
};

interface Job {
  geometry: BvhGeometry;
  kind: BvhBuildJobKind;
}

/** 한 슬라이스가 쓰는 시간. 넘겨도 최소 한 개는 처리한다. */
const SLICE_BUDGET_MS = 8;
/** 유휴 시간이 없어도 이 안에는 다음 슬라이스가 돈다(프레임급 간격). */
const SLICE_INTERVAL_MS = 16;

const EMPTY_COUNTS: BvhBuildCounts = { pending: 0, done: 0, total: 0 };
const EMPTY_SNAPSHOT: BvhBuildSnapshot = {
  bvh: EMPTY_COUNTS,
  outline: EMPTY_COUNTS,
};

/** BVH 가 전부 먼저 — 클릭 판정이 외곽선보다 급하다. */
const KIND_RANK: Record<BvhBuildJobKind, number> = { bvh: 0, outline: 1 };
const JOB_KINDS: readonly BvhBuildJobKind[] = ['bvh', 'outline'];

/**
 * 기본 스케줄러 — 유휴 시간이 있으면 `requestIdleCallback` 이 바로 부르고,
 * 없으면 SLICE_INTERVAL_MS 타임아웃이 부른다. rIC 가 없는 환경은 setTimeout.
 */
const defaultScheduler: BvhBuildScheduler = (run) => {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(() => run(), {
      timeout: SLICE_INTERVAL_MS,
    });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(run, SLICE_INTERVAL_MS);
  return () => clearTimeout(id);
};

const defaultClock = (): number => performance.now();

const defaultOutlineWarmer: BvhBuildOutlineWarmer = {
  isReady: hasSilhouetteOutlineGeometry,
  warm: warmSilhouetteOutlineGeometry,
};

function canBuild(geometry: BvhGeometry): boolean {
  return (
    !geometry.boundsTree && typeof geometry.computeBoundsTree === 'function'
  );
}

/** 정렬 키 — 인덱스가 있으면 인덱스 수, 없으면 정점 수 기준 삼각형 수. */
function triangleCount(geometry: BufferGeometry): number {
  const count = geometry.index?.count ?? geometry.attributes.position?.count;
  return typeof count === 'number' ? count / 3 : 0;
}

function sameCounts(a: BvhBuildCounts, b: BvhBuildCounts): boolean {
  return a.pending === b.pending && a.done === b.done && a.total === b.total;
}

export function createBvhBuildQueue({
  schedule = defaultScheduler,
  clock = defaultClock,
  outlineWarmer = defaultOutlineWarmer,
}: {
  schedule?: BvhBuildScheduler;
  clock?: () => number;
  outlineWarmer?: BvhBuildOutlineWarmer;
} = {}): BvhBuildQueue {
  const queue: Job[] = [];
  const refCounts: Record<BvhBuildJobKind, Map<BvhGeometry, number>> = {
    bvh: new Map(),
    outline: new Map(),
  };
  const progress: Record<BvhBuildJobKind, { done: number; total: number }> = {
    bvh: { done: 0, total: 0 },
    outline: { done: 0, total: 0 },
  };
  const listeners = new Set<() => void>();
  let snapshot: BvhBuildSnapshot = EMPTY_SNAPSHOT;
  let cancelScheduled: (() => void) | null = null;

  const countsOf = (kind: BvhBuildJobKind): BvhBuildCounts => ({
    pending: refCounts[kind].size,
    done: progress[kind].done,
    total: progress[kind].total,
  });

  const emit = () => {
    const next: BvhBuildSnapshot = {
      bvh: countsOf('bvh'),
      outline: countsOf('outline'),
    };
    if (
      sameCounts(next.bvh, snapshot.bvh) &&
      sameCounts(next.outline, snapshot.outline)
    ) {
      return;
    }
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const ensureScheduled = () => {
    if (cancelScheduled !== null || queue.length === 0) return;
    cancelScheduled = schedule(runSlice);
  };

  const stopSchedule = () => {
    cancelScheduled?.();
    cancelScheduled = null;
  };

  const resetIfDrained = () => {
    if (queue.length > 0) return;
    for (const kind of JOB_KINDS) {
      progress[kind].done = 0;
      progress[kind].total = 0;
    }
    stopSchedule();
  };

  /** 작업이 아직 필요한지 — 다른 경로가 먼저 만들었으면 건너뛴다. */
  const needsWork = (job: Job): boolean =>
    job.kind === 'bvh'
      ? canBuild(job.geometry)
      : !outlineWarmer.isReady(job.geometry);

  const runJob = (job: Job) => {
    if (job.kind === 'bvh') job.geometry.computeBoundsTree!();
    else outlineWarmer.warm(job.geometry);
  };

  function runSlice() {
    cancelScheduled = null;
    const t0 = clock();
    while (queue.length > 0) {
      const job = queue.shift()!;
      refCounts[job.kind].delete(job.geometry);
      if (needsWork(job)) runJob(job);
      progress[job.kind].done += 1;
      if (clock() - t0 >= SLICE_BUDGET_MS) break;
    }
    resetIfDrained();
    ensureScheduled();
    emit();
  }

  /** 참조를 올리고, 처음이면 큐에 넣는다. 새로 들어갔으면 true. */
  const addJob = (geometry: BvhGeometry, kind: BvhBuildJobKind): boolean => {
    const counts = refCounts[kind];
    const count = counts.get(geometry);
    if (count !== undefined) {
      counts.set(geometry, count + 1);
      return false;
    }
    counts.set(geometry, 1);
    queue.push({ geometry, kind });
    progress[kind].total += 1;
    return true;
  };

  const removeJob = (geometry: BvhGeometry, kind: BvhBuildJobKind) => {
    const counts = refCounts[kind];
    const count = counts.get(geometry);
    if (count === undefined) return;
    if (count > 1) {
      counts.set(geometry, count - 1);
      return;
    }
    counts.delete(geometry);
    const index = queue.findIndex(
      (job) => job.kind === kind && job.geometry === geometry,
    );
    if (index !== -1) queue.splice(index, 1);
    progress[kind].total -= 1;
  };

  return {
    enqueue(meshes, { bvh = true, outline = false } = {}) {
      let added = false;
      for (const mesh of meshes) {
        const geometry = mesh.geometry as BvhGeometry;
        if (bvh && canBuild(geometry)) {
          added = addJob(geometry, 'bvh') || added;
        }
        if (outline && !outlineWarmer.isReady(geometry)) {
          added = addJob(geometry, 'outline') || added;
        }
      }
      // 종류(BVH 먼저) → 작은 것부터. 모델·바닥 지도가 먼저 클릭 가능해지고
      // 큰 지형은 마지막, 외곽선 사본은 그 뒤.
      if (added) {
        queue.sort(
          (a, b) =>
            KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
            triangleCount(a.geometry) - triangleCount(b.geometry),
        );
      }
      ensureScheduled();
      emit();
    },
    cancel(meshes, { bvh = true, outline = false } = {}) {
      for (const mesh of meshes) {
        const geometry = mesh.geometry as BvhGeometry;
        if (bvh) removeJob(geometry, 'bvh');
        if (outline) removeJob(geometry, 'outline');
      }
      resetIfDrained();
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

/** 앱 전역 큐 — ModelMesh 가 넣고 SceneWarmupIndicator 가 구독한다. */
export const bvhBuildQueue = createBvhBuildQueue();
