import type { BufferGeometry, Mesh } from 'three';

/**
 * 전역 BVH(boundsTree) 빌드 큐 — 클릭 hit-test raycast 가속 구조를 프레임
 * 사이에 나눠 만든다.
 *
 * mount 시 동기 일괄 빌드는 지형 프리미티브 하나(135만 삼각형)에 400ms 대라
 * 첫 진입이 눈에 띄게 멈춘다. 그렇다고 유휴 시간(`requestIdleCallback`)에만
 * 맡기면 로딩 직후엔 셰이더 컴파일·섀도맵·브루트포스 raycast 가 프레임을 다
 * 채워 유휴 시간이 거의 없고, 콜백은 타임아웃으로만 돌아 지오메트리 90개짜리
 * 씬이 수십 초 걸렸다(2026-09-08 실측: philly 씬 전체 빌드 합계는 1초 안팎).
 *
 * 그래서 슬라이스는 **고정 예산**(SLICE_BUDGET_MS, 최소 1개는 빌드)으로 돌고,
 * 다음 슬라이스를 **프레임급 간격**(유휴 시간이 있으면 즉시, 없어도
 * SLICE_INTERVAL_MS 안에)으로 예약한다 — 작업 총량이 작으니 1~2초 안에 끝나고
 * 그동안 프레임당 예산만큼만 쓴다. 큐는 **삼각형 수 오름차순**이라 모델·조선소
 * 지도가 먼저 클릭 가능해지고 지형의 큰 프리미티브가 마지막에 간다(그 한 번의
 * 정지는 피할 수 없다 — 없애려면 워커 빌드).
 *
 * 예전에는 `ModelMesh` 인스턴스마다 자기 체인을 돌렸다. 큐를 하나로 모은 이유:
 *  - 진행 상황(`done/total`)을 화면(SceneWarmupIndicator)이 구독할 수 있다.
 *  - 지오메트리는 GLTF 캐시 공유라 같은 GLB 의 다른 인스턴스가 같은 지오메트리를
 *    다시 큐에 넣는 일이 없다(참조 카운트로 한 번만 빌드).
 *  - 크기순 정렬은 전역이어야 의미가 있다.
 *
 * 지도도 빌드 대상이다 — 없으면 포인터 이동·휠 줌마다 지형 178만 삼각형을
 * 브루트 포스 순회해 프레임이 밀린다(빌드보다 훨씬 비싸다).
 *
 * BVH 자체는 `cancel` 에서 버리지 않는다 — 지오메트리가 GLTF 캐시 공유라, 같은
 * GLB 의 다른 인스턴스(예: 씬에 2개 배치된 LLC-002)가 아직 살아 있으면 그쪽
 * raycast 가 느려진다. 해제는 region 을 떠나며 캐시를 비울 때 한다
 * (releaseGltfCache). `cancel` 은 아직 빌드하지 않은 항목만 큐에서 뺀다.
 */

export interface BvhBuildSnapshot {
  /** 아직 빌드하지 않은 지오메트리 수. */
  pending: number;
  /** 이번 세션에서 빌드를 마친 수. 큐가 비면 0 으로 돌아간다. */
  done: number;
  /** 이번 세션에 들어온 수(done + pending). 큐가 비면 0 으로 돌아간다. */
  total: number;
}

/** 슬라이스 실행을 예약하고 취소 함수를 돌려준다. 테스트에서 주입한다. */
export type BvhBuildScheduler = (run: () => void) => () => void;

export interface BvhBuildQueue {
  /** boundsTree 가 이미 있거나 computeBoundsTree 가 없는 지오메트리는 건너뛴다. */
  enqueue: (meshes: readonly Mesh[]) => void;
  /** 미빌드 항목의 참조를 하나 내린다. 0 이 되면 큐에서 뺀다. 빌드된 BVH 는 유지. */
  cancel: (meshes: readonly Mesh[]) => void;
  subscribe: (listener: () => void) => () => void;
  /** 값이 바뀌지 않으면 같은 객체를 돌려준다(useSyncExternalStore 용). */
  getSnapshot: () => BvhBuildSnapshot;
}

type BvhGeometry = BufferGeometry & {
  boundsTree?: unknown;
  computeBoundsTree?: () => void;
};

/** 한 슬라이스가 쓰는 시간. 넘겨도 최소 한 개는 빌드한다. */
const SLICE_BUDGET_MS = 8;
/** 유휴 시간이 없어도 이 안에는 다음 슬라이스가 돈다(프레임급 간격). */
const SLICE_INTERVAL_MS = 16;

const EMPTY_SNAPSHOT: BvhBuildSnapshot = { pending: 0, done: 0, total: 0 };

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

export function createBvhBuildQueue({
  schedule = defaultScheduler,
  clock = defaultClock,
}: { schedule?: BvhBuildScheduler; clock?: () => number } = {}): BvhBuildQueue {
  const queue: BvhGeometry[] = [];
  const refCounts = new Map<BvhGeometry, number>();
  const listeners = new Set<() => void>();
  let done = 0;
  let total = 0;
  let snapshot: BvhBuildSnapshot = EMPTY_SNAPSHOT;
  let cancelScheduled: (() => void) | null = null;

  const emit = () => {
    const next: BvhBuildSnapshot = { pending: queue.length, done, total };
    if (
      next.pending === snapshot.pending &&
      next.done === snapshot.done &&
      next.total === snapshot.total
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
    done = 0;
    total = 0;
    stopSchedule();
  };

  function runSlice() {
    cancelScheduled = null;
    const t0 = clock();
    while (queue.length > 0) {
      const geometry = queue.shift()!;
      refCounts.delete(geometry);
      // 다른 경로(예: 먼저 빌드된 같은 지오메트리)가 이미 만들었으면 건너뛴다.
      if (canBuild(geometry)) geometry.computeBoundsTree!();
      done += 1;
      if (clock() - t0 >= SLICE_BUDGET_MS) break;
    }
    resetIfDrained();
    ensureScheduled();
    emit();
  }

  return {
    enqueue(meshes) {
      let added = false;
      for (const mesh of meshes) {
        const geometry = mesh.geometry as BvhGeometry;
        if (!canBuild(geometry)) continue;
        const count = refCounts.get(geometry);
        if (count !== undefined) {
          refCounts.set(geometry, count + 1);
          continue;
        }
        refCounts.set(geometry, 1);
        queue.push(geometry);
        total += 1;
        added = true;
      }
      // 작은 것부터 — 모델·바닥 지도가 먼저 클릭 가능해지고 큰 지형은 마지막.
      if (added) queue.sort((a, b) => triangleCount(a) - triangleCount(b));
      ensureScheduled();
      emit();
    },
    cancel(meshes) {
      for (const mesh of meshes) {
        const geometry = mesh.geometry as BvhGeometry;
        const count = refCounts.get(geometry);
        if (count === undefined) continue;
        if (count > 1) {
          refCounts.set(geometry, count - 1);
          continue;
        }
        refCounts.delete(geometry);
        const index = queue.indexOf(geometry);
        if (index !== -1) queue.splice(index, 1);
        total -= 1;
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
