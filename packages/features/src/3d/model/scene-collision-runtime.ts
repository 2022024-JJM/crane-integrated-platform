import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import {
  approxContactPoint,
  boxesDistance,
  closestPointsBetweenBoxes,
  collectCollidableMeshes,
  getMeshPath,
  meshesIntersectExact,
  meshesWithinDistance,
  meshLocalReach,
  meshObbsIntersect,
  meshWorldBox,
  modelObjectRegistry,
  type SavedModelInfo,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  BASELINE_SETTLE_MS,
  BVH_RETRY_MS,
  CLEARANCE_MIN,
  CLEARANCE_PROBE,
  copyMatrix,
  displacementBound,
  matrixChanged,
  MIN_MESH_EXTENT,
  pairKey,
  SEPARATION_MARGIN,
  SUPPRESSED_RECHECK_MS,
} from '../lib/scene-collision-pairs';

/**
 * 씬 객체 충돌 감지 런타임 — React 밖 모듈 싱글턴. 훅(use-scene-collision-
 * detector)이 useFrame 에서 `tick()` 을 부르고, 첫 충돌을 돌려받으면 스토어에
 * 1회 보고한다. 프레임당 React 상태 쓰기는 없다.
 *
 * 검사 범위는 **모델 인스턴스 ↔ 모델 인스턴스**(i<j 전 쌍)이고, 같은 모델
 * 안의 노드끼리(자기 충돌)와 지도는 대상이 아니다.
 *
 * 비용을 줄이는 세 가지 장치.
 * 1. 변화 감지 — 메쉬마다 `matrixWorld` 16 원소를 마지막 검사 시점과
 *    비교해, 바뀐 모델이 낀 쌍만 큐에 넣는다. 이동 원인(리그·태그 맵핑·
 *    기즈모·meshOverrides)이 무엇이든 잡히고, 움직이지 않는 쌍은 기준선
 *    1회 뒤 비용 0 이다. `gl.render` 가 모든 useFrame 뒤에 matrixWorld 를
 *    갱신하므로 여기서 읽는 행렬은 한 프레임 늦지만, 마지막 자세도 다음
 *    틱에 서명이 바뀌어 반드시 검사된다.
 * 2. 3단계 — 모델 AABB → 메쉬 AABB → 메쉬 OBB(SAT) → 삼각형(BVH). 앞
 *    단계가 대부분의 쌍을 걸러 `intersectsGeometry` 는 실제로 겹칠 법한
 *    메쉬 쌍에만 닿는다.
 * 3. 시간 예산 — job(모델 쌍) 사이에서만 예산을 보고, 넘기면 나머지는
 *    다음 틱으로 재큐. job 하나는 끝까지 돌려 매 틱 최소 한 쌍은 완료된다.
 *    `lastTickMs` 로 초과가 관측되면 메쉬 쌍 커서 이월을 도입한다.
 *
 * 기준선(baseline): 이 단계에서 발견된 겹침은 보고하지 않고 억제한다 —
 * 에디터에서 겹쳐 놓은 모델 때문에 켜자마자 정지되면 안 된다. 기준선은
 * `arm()` 1회가 아니라 **시뮬레이션 이외의 움직임이 들어올 때마다** 다시
 * 잡힌다: 검사기가 스캔을 멈췄다 재개할 때(러너 재생·기즈모 드래그 종료)
 * `rebaseline()`, 모델 항목이 새로 만들어질 때(첫 마운트·리마운트·참조 교체)
 * tick 내부에서 자동. baseline 은 큐가 비고(BVH 재시도 대기 쌍은 세지 않는다)
 * BASELINE_SETTLE_MS 안정화 창이 지나야 scanning 이 된다(matrixWorld 1프레임
 * 지연·스무딩 흡수, 상수 주석). 기준선 중 BVH 가 없어 판정하지 못한 쌍은
 * baselineDeferred 로 넘겨, 뒤늦은 첫 hit 을 보고 대신 억제한다.
 * 그래서 창 안에서 시뮬레이션이 만든 겹침도 그 쌍이 분리될 때까지 보고되지
 * 않는다 — 허용된 부작용이다.
 * 억제(보고 뒤 포함)는 두 모델의 **메쉬**가 전부 떨어지면 풀린다
 * (meshPairsSeparated — AABB 에 SEPARATION_MARGIN 히스테리시스, OBB 로 확인).
 * 그래서 붙은 채로 오래 겹쳐 있어도 기록은 한 번만 남고, 떨어졌다 다시
 * 붙으면 새로 보고된다.
 *
 * BVH 는 여기서 빌드하지 않는다(collision-volumes 주석). 없는 메쉬 쌍은
 * 건너뛰고 BVH_RETRY_MS 뒤 다시 본다. 메쉬는 LOD 가시성과 무관하게 LOD0 만
 * 모은다(collectCollidableMeshes) — LOD>0 사본에는 BVH 가 없다.
 */

interface MeshEntry {
  mesh: Mesh;
  nodePath: string;
  box: Box3;
  lastMatrix: Float64Array;
  /** 항목을 만들 때의 지오메트리 — 바뀌면 강체 이동 한계가 무효라 반드시 검사한다. */
  geometry: Mesh['geometry'];
  /** 로컬 원점에서 가장 먼 정점 거리 — 이동 한계(displacementBound)용. */
  reach: number;
}

interface ModelEntry {
  id: string;
  model: SavedModelInfo;
  root: Object3D;
  meshes: MeshEntry[];
  box: Box3;
  dirty: boolean;
  /** 이번 tick 에 이 모델의 어느 점이든 움직였을 수 있는 거리 상한(메쉬별 최대). */
  tickDrift: number;
}

type PairState = 'untested' | 'clear' | 'suppressed';

interface PairJob {
  key: string;
  a: ModelEntry;
  b: ModelEntry;
  queued: boolean;
  state: PairState;
  /** BVH 미준비로 미룬 경우 이 시각 전엔 다시 보지 않는다. */
  bvhRetryAt: number;
  /**
   * 억제 쌍의 다음 분리 재판정 시각. 직전 판정이 "아직 붙음" 이면
   * SUPPRESSED_RECHECK_MS 뒤로 미루고, 그 전엔 큐에 남겨만 둔다(비용 0).
   */
  separationCheckAt: number;
  /**
   * 마지막 clear 판정 때 잰 여유 거리(두 모델 사이 최단 거리의 하한, 씬 unit).
   * 0 = 모름. 두 모델의 누적 이동 한계(`driftSinceClear`)가 이 값을 넘기
   * 전까지는 다시 검사하지 않는다 — 강체 이동 한계가 보수적이라 놓치는
   * 충돌은 없다.
   */
  clearance: number;
  driftSinceClear: number;

  /**
   * 기준선 단계에서 BVH 가 없어 판정을 못 내린 쌍 — 기준선은 이 쌍을 기다리지
   * 않고 끝나며, 뒤늦게 난 첫 hit 은 기준선 겹침으로 보고 억제한다.
   */
  baselineDeferred: boolean;
}

/** 근접 쌍 — 모델 AABB 간격 기준(씬 unit). 겹치면 gap 0. */
export interface SceneProximityCandidate {
  key: string;
  a: string;
  b: string;
  gap: number;
  from: [number, number, number];
  to: [number, number, number];
}

const _nearA = new Vector3();
const _nearB = new Vector3();

export type SceneCollisionRuntimePhase =
  | 'idle'
  | 'baseline'
  | 'scanning'
  | 'halted';

export interface SceneCollisionHitParty {
  modelId: string;
  model: SavedModelInfo;
  mesh: Mesh;
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
}

export interface SceneCollisionHit {
  key: string;
  a: SceneCollisionHitParty;
  b: SceneCollisionHitParty;
  /** 근사 접촉점(씬 unit). */
  contact: Vector3Tuple;
}

const EMPTY_MODELS: SavedModelInfo[] = [];
const _meshScratch: Mesh[] = [];
const _box = new Box3();
const _size = new Vector3();
const _contact = new Vector3();
const _candA: MeshEntry[] = [];
const _candB: MeshEntry[] = [];
const _marginBox = new Box3();

function defaultClock(): number {
  return performance.now();
}

export class SceneCollisionRuntime {
  private models: SavedModelInfo[] = EMPTY_MODELS;
  private readonly entries = new Map<string, ModelEntry>();
  private pairs: PairJob[] = [];
  private readonly jobsByKey = new Map<string, PairJob>();
  private readonly suppressed = new Set<string>();
  private queue: PairJob[] = [];
  private phase: SceneCollisionRuntimePhase = 'idle';
  /** 안정화 창 종료 시각(호출자 시계 `now` 기준). 이 전엔 scanning 으로 넘어가지 않는다. */
  private settleUntil = 0;
  /** arm/rebaseline 은 `now` 를 모른다 — 다음 tick 이 창을 확정한다. */
  private settleFromNextTick = false;
  /** 마지막 tick 의 소요 시간(ms) — 예산 초과 관측용. */
  lastTickMs = 0;
  /** 삼각형(BVH) 교차 검사 누계 — 여유 거리 컬링 효과 관측·테스트용. */
  exactTests = 0;

  private readonly clock: () => number;

  constructor(clock: () => number = defaultClock) {
    this.clock = clock;
  }

  get currentPhase(): SceneCollisionRuntimePhase {
    return this.phase;
  }

  get suppressedKeys(): ReadonlySet<string> {
    return this.suppressed;
  }

  /**
   * 씬의 모델 목록을 반영한다. 참조가 바뀐 모델은 항목을 다시 만들고
   * (메쉬 재수집 — meshOverrides.visible 변경 대응), 사라진 모델은 지운다.
   * registry 에 아직 없는 모델은 다음 tick 에 다시 찾는다. 억제 집합은 유지.
   */
  sync(models: SavedModelInfo[] | undefined): void {
    this.models = models ?? EMPTY_MODELS;
    const liveIds = new Set<string>();
    let changed = false;
    for (const model of this.models) {
      liveIds.add(model.id);
      const entry = this.entries.get(model.id);
      if (entry && entry.model !== model) {
        this.entries.delete(model.id);
        changed = true;
      }
    }
    for (const id of this.entries.keys()) {
      if (!liveIds.has(id)) {
        this.entries.delete(id);
        changed = true;
      }
    }
    if (changed) this.rebuildPairs();
  }

  /** 감시 시작(기준선부터). 억제 집합은 유지한다 — 닫기 뒤 재무장에 쓴다. */
  arm(): void {
    this.phase = 'baseline';
    this.settleFromNextTick = true;
    for (const entry of this.entries.values()) {
      this.markAllDirty(entry);
    }
    for (const job of this.pairs) {
      if (job.state !== 'suppressed') job.state = 'untested';
      job.bvhRetryAt = 0;
      job.separationCheckAt = 0;
      job.clearance = 0;
      job.driftSinceClear = 0;
    }
  }

  /** 감시 중단·정리. 억제 집합도 비운다 — 다시 켜면 새 기준선을 잡는다. */
  disarm(): void {
    this.phase = 'idle';
    this.resetSettle();
    this.suppressed.clear();
    this.entries.clear();
    this.pairs = [];
    this.jobsByKey.clear();
    this.resetQueue();
    this.lastTickMs = 0;
  }

  /**
   * 정지. tick 은 arm() 전까지 아무것도 하지 않는다. 충돌·기록 복원은 이제
   * 이것을 쓰지 않는다 — 그 쌍만 억제하고 감시를 계속해야 떼었다 다시 붙인
   * 충돌이 보고된다. 외부 정지가 필요할 때를 위해 남겨 둔다.
   */
  halt(): void {
    this.phase = 'halted';
    this.resetSettle();
    this.resetQueue();
  }

  /**
   * 기준선을 다시 잡는다 — 지금 자세에서 겹친 쌍은 보고 대신 억제하고, 다음
   * tick 부터 BASELINE_SETTLE_MS 안정화 창이 열린다. 검사기가 스캔을 멈췄다
   * 재개할 때(러너 재생·드래그 종료)와 기록 복원이 부르고, 새 모델 항목은
   * tick 이 스스로 부른다. 모든 메쉬를 dirty 로 만들지 않는다 — 변화 감지가
   * 움직인 메쉬만 찾으므로 비용은 움직인 쌍만큼이다. 억제 집합·BVH 재시도
   * 시각도 건드리지 않는다. baseline 중 다시 불리면 창이 연장된다(순차
   * 마운트 의도). idle/halted 에선 no-op — 무장 여부는 arm/disarm 이 정한다.
   */
  rebaseline(): void {
    if (this.phase === 'idle' || this.phase === 'halted') return;
    this.phase = 'baseline';
    this.settleFromNextTick = true;
  }

  /**
   * 모델 AABB 간격이 `maxGap` 이하인 쌍을 가까운 순으로 최대 `limit` 개.
   * 상자는 마지막 tick 의 변화 감지가 갱신한 값이다(tick 뒤에 부른다).
   * 비용은 쌍 수에 비례한 AABB 간격 계산뿐이다. idle 이면 빈 배열.
   */
  nearestPairs(
    maxGap: number,
    limit: number,
    include: (model: SavedModelInfo) => boolean = () => true,
  ): SceneProximityCandidate[] {
    if (this.phase === 'idle') return [];
    const out: SceneProximityCandidate[] = [];
    for (const job of this.pairs) {
      if (job.a.meshes.length === 0 || job.b.meshes.length === 0) continue;
      if (job.a.box.isEmpty() || job.b.box.isEmpty()) continue;
      if (!include(job.a.model) || !include(job.b.model)) continue;
      // 모델 상자 간격으로 먼저 거르고, 들어오면 **메쉬 상자 쌍의 최소 간격**으로
      // 잰다 — 타워크레인은 마스트·상부가 메쉬로 나뉘어 있어 모델 상자(지브가
      // 쓸고 간 전체)보다 훨씬 덜 보수적이다(상부가 높이 60m 면 아래 크레인과
      // 겹치지 않는다).
      if (boxesDistance(job.a.box, job.b.box) > maxGap) continue;
      let gap = Number.POSITIVE_INFINITY;
      let nearA: MeshEntry | null = null;
      let nearB: MeshEntry | null = null;
      for (const ma of job.a.meshes) {
        for (const mb of job.b.meshes) {
          const d = boxesDistance(ma.box, mb.box);
          if (d < gap) {
            gap = d;
            nearA = ma;
            nearB = mb;
          }
        }
      }
      if (!nearA || !nearB || gap > maxGap) continue;
      closestPointsBetweenBoxes(nearA.box, nearB.box, _nearA, _nearB);
      out.push({
        key: job.key,
        a: job.a.id,
        b: job.b.id,
        gap,
        from: [_nearA.x, _nearA.y, _nearA.z],
        to: [_nearB.x, _nearB.y, _nearB.z],
      });
    }
    out.sort((x, y) => x.gap - y.gap);
    return out.length > limit ? out.slice(0, limit) : out;
  }

  /** 닫기 — 이 쌍은 분리될 때까지 보고하지 않는다. 없는 키는 no-op. */
  suppress(key: string): void {
    this.suppressed.add(key);
    const job = this.jobsByKey.get(key);
    if (job) {
      job.state = 'suppressed';
      job.separationCheckAt = 0;
    }
  }

  /**
   * 한 스캔. `now` 는 호출자의 시계(performance.now) — BVH 재시도 시각에
   * 쓰고, 예산 측정은 생성자에 주입된 clock 으로 한다(테스트 결정론).
   *
   * 첫 충돌을 찾으면 그 자리에서 hit 을 돌려준다. **스스로 멈추지 않는다** —
   * 남은 쌍은 다음 tick 으로 재큐되고, 정지할지(halt) 그 쌍만 억제하고
   * 계속 볼지(suppress)는 호출자가 정한다.
   */
  tick(now: number, budgetMs: number): SceneCollisionHit | null {
    if (this.phase === 'idle' || this.phase === 'halted') return null;
    const t0 = this.clock();

    if (this.resolvePending()) {
      this.rebuildPairs();
      this.rebaseline();
    }
    // 창은 같은 tick 에서 확정된다 — 종료 조건이 같은 now 로는 참이 되지 않아
    // 최소 다음 tick 까지 baseline 이 유지된다.
    if (this.settleFromNextTick) {
      this.settleUntil = now + BASELINE_SETTLE_MS;
      this.settleFromNextTick = false;
    }

    // A. 변화 감지 — 메쉬 matrixWorld 비교. 바뀐 메쉬만 박스를 다시 재고,
    //    이번 tick 의 이동 한계(어느 점이든 이보다 멀리는 못 갔다)를 모델에 모은다.
    for (const entry of this.entries.values()) {
      for (const m of entry.meshes) {
        const geometrySwapped = m.mesh.geometry !== m.geometry;
        if (
          !geometrySwapped &&
          !matrixChanged(m.lastMatrix, m.mesh.matrixWorld)
        ) {
          continue;
        }
        let drift = displacementBound(
          m.lastMatrix,
          m.mesh.matrixWorld,
          m.reach,
        );
        if (geometrySwapped) {
          m.geometry = m.mesh.geometry;
          m.reach = meshLocalReach(m.mesh);
          drift = Number.POSITIVE_INFINITY;
        }
        if (drift > entry.tickDrift) entry.tickDrift = drift;
        copyMatrix(m.mesh.matrixWorld, m.lastMatrix);
        meshWorldBox(m.mesh, m.box);
        entry.dirty = true;
      }
      if (entry.dirty) this.refreshModelBox(entry);
    }

    // B. dirty 모델이 낀 쌍만 큐에. 억제된 쌍도 분리 판정을 위해 넣는다.
    //    clear 쌍은 여유 거리가 남아 있으면(누적 이동 한계 < clearance) 건너뛴다
    //    — 이 비교가 유일한 비용이다.
    for (const job of this.pairs) {
      if (!job.a.dirty && !job.b.dirty) continue;
      if (job.state === 'clear' && job.clearance > 0) {
        job.driftSinceClear += job.a.tickDrift + job.b.tickDrift;
        if (job.driftSinceClear < job.clearance) continue;
      }
      this.enqueue(job);
    }
    for (const entry of this.entries.values()) {
      entry.dirty = false;
      entry.tickDrift = 0;
    }

    // C. 이번 tick 에 볼 job 은 지금 큐에 있는 것까지다 — 처리 중 재큐된
    //    job(BVH 재시도 등)은 다음 tick 으로 간다. 그렇지 않으면 예산 안에서
    //    같은 job 을 무한히 다시 꺼낸다. 예산은 job 사이에서만 보고 첫 job 은
    //    항상 완료한다.
    const pending = this.takeQueue();
    for (let i = 0; i < pending.length; i += 1) {
      if (i > 0 && this.clock() - t0 >= budgetMs) {
        for (let j = i; j < pending.length; j += 1) this.enqueue(pending[j]);
        break;
      }
      const job = pending[i];

      if (job.state === 'suppressed') {
        if (job.separationCheckAt > now) {
          // 재판정 시각까지 큐에 남겨 움직임이 멈춰도 때가 되면 다시 본다.
          this.enqueue(job);
          continue;
        }
        if (this.meshPairsSeparated(job)) {
          this.suppressed.delete(job.key);
          job.state = 'untested';
          job.separationCheckAt = 0;
        } else {
          job.separationCheckAt = now + SUPPRESSED_RECHECK_MS;
        }
        continue;
      }
      if (!job.a.box.intersectsBox(job.b.box)) {
        job.state = 'clear';
        job.baselineDeferred = false;
        // 모델 AABB 간격은 메쉬 거리의 하한 — 그만큼 움직이기 전엔 안 본다.
        this.setClearance(job, boxesDistance(job.a.box, job.b.box));
        continue;
      }
      if (job.bvhRetryAt > now) {
        this.enqueue(job);
        continue;
      }

      const result = this.testPair(job);
      if (result === 'hit') {
        if (this.phase === 'baseline' || job.baselineDeferred) {
          job.baselineDeferred = false;
          this.suppressed.add(job.key);
          job.state = 'suppressed';
          job.separationCheckAt = now + SUPPRESSED_RECHECK_MS;
          continue;
        }
        for (let j = i + 1; j < pending.length; j += 1)
          this.enqueue(pending[j]);
        this.lastTickMs = this.clock() - t0;
        return this.buildHit(job);
      }
      if (result === 'no-bvh') {
        if (this.phase === 'baseline') job.baselineDeferred = true;
        job.state = 'untested';
        job.bvhRetryAt = now + BVH_RETRY_MS;
        this.setClearance(job, 0);
        this.enqueue(job);
        continue;
      }
      job.state = 'clear';
      job.baselineDeferred = false;
      this.setClearance(job, this.measureClearance(job));
    }

    // BVH 재시도 대기 쌍과 분리 재판정을 기다리는 억제 쌍은 기다리지 않는다 —
    // BVH 가 끝내 안 생기는 메쉬 하나가 기준선 전체를 붙잡으면 안 된다(그 쌍은
    // baselineDeferred 로 따로 넘긴다).
    if (
      this.phase === 'baseline' &&
      now >= this.settleUntil &&
      this.queue.every(
        (job) =>
          job.bvhRetryAt > now ||
          (job.state === 'suppressed' && job.separationCheckAt > now),
      )
    ) {
      this.phase = 'scanning';
    }
    this.lastTickMs = this.clock() - t0;
    return null;
  }

  // ---- 내부 ----

  private hitMeshA: MeshEntry | null = null;
  private hitMeshB: MeshEntry | null = null;

  private setClearance(job: PairJob, clearance: number): void {
    job.clearance = Number.isFinite(clearance) && clearance > 0 ? clearance : 0;
    job.driftSinceClear = 0;
  }

  /**
   * clear 판정 직후 두 모델 사이 최단 거리의 하한(CLEARANCE_PROBE 상한) —
   * **메쉬 AABB 간격만** 쓴다. 어느 메쉬 쌍이든 AABB 가 겹치면 0(컬링 없음).
   * 삼각형 거리(BVH 쌍 탐색)로 재지 않는다 — 옥포 타워크레인처럼 삼각형이
   * 조밀한 큰 메쉬 쌍은 질의 하나가 수 초라 화면이 1 fps 로 떨어졌다.
   * CLEARANCE_MIN 아래는 한두 스캔에 소진돼 의미가 없어 0 으로 둔다.
   */
  private measureClearance(job: PairJob): number {
    let clearance = CLEARANCE_PROBE;
    for (const ma of job.a.meshes) {
      for (const mb of job.b.meshes) {
        const gap = boxesDistance(ma.box, mb.box);
        if (gap < clearance) clearance = gap;
        if (clearance < CLEARANCE_MIN) return 0;
      }
    }
    return clearance;
  }

  /**
   * 억제 해제 판정 — **메쉬 단위**로 떨어졌는지. 모델 전체 AABB 는 크레인처럼
   * 길고 큰 모델끼리 붐이 상대 위를 지나는 동안 계속 겹쳐 있어, 그것을
   * 기준으로 하면 메쉬는 떨어졌는데도 억제가 영영 풀리지 않는다(재충돌 미보고).
   * 후보 메쉬 쌍 중 하나라도 "AABB 를 SEPARATION_MARGIN 만큼 넓혀도 겹치고,
   * 같은 margin 으로 부풀린 OBB 도 교차하고, 삼각형 최단 거리까지 margin
   * 이하" 면 아직 붙은 것이다. 크레인 모델은 대부분 단일 메쉬라 OBB 가
   * 실루엣 전체를 감싸 두 OBB 가 늘 겹치므로 삼각형 단계가 최종 판정이다.
   * margin 이 경계 떨림을 막는 히스테리시스다.
   */
  private meshPairsSeparated(job: PairJob): boolean {
    _marginBox.copy(job.b.box).expandByScalar(SEPARATION_MARGIN);
    if (!job.a.box.intersectsBox(_marginBox)) return true;
    _candA.length = 0;
    _candB.length = 0;
    for (const m of job.a.meshes) {
      if (m.box.intersectsBox(_marginBox)) _candA.push(m);
    }
    _marginBox.copy(job.a.box).expandByScalar(SEPARATION_MARGIN);
    for (const m of job.b.meshes) {
      if (m.box.intersectsBox(_marginBox)) _candB.push(m);
    }
    for (const ma of _candA) {
      _marginBox.copy(ma.box).expandByScalar(SEPARATION_MARGIN);
      for (const mb of _candB) {
        if (!_marginBox.intersectsBox(mb.box)) continue;
        if (!meshObbsIntersect(ma.mesh, mb.mesh, SEPARATION_MARGIN)) continue;
        // OBB 는 실루엣 전체를 감싸므로(단일 메쉬 크레인) 삼각형 거리로 확정한다.
        // BVH 가 아직 없으면 보수적으로 "붙음" — 빌드되면 다음 dirty 틱에 다시 본다.
        const near = meshesWithinDistance(ma.mesh, mb.mesh, SEPARATION_MARGIN);
        if (near === null || near) return false;
      }
    }
    return true;
  }

  /** 모델 AABB 가 겹친 쌍의 메쉬 단위 검사. 'hit' 이면 hitMeshA/B 가 채워진다. */
  private testPair(job: PairJob): 'hit' | 'clear' | 'no-bvh' {
    _candA.length = 0;
    _candB.length = 0;
    for (const m of job.a.meshes) {
      if (m.box.intersectsBox(job.b.box)) _candA.push(m);
    }
    for (const m of job.b.meshes) {
      if (m.box.intersectsBox(job.a.box)) _candB.push(m);
    }
    let bvhMissing = false;
    for (const ma of _candA) {
      for (const mb of _candB) {
        if (!ma.box.intersectsBox(mb.box)) continue;
        if (!meshObbsIntersect(ma.mesh, mb.mesh)) continue;
        this.exactTests += 1;
        const exact = meshesIntersectExact(ma.mesh, mb.mesh);
        if (exact === null) {
          bvhMissing = true;
          continue;
        }
        if (exact) {
          this.hitMeshA = ma;
          this.hitMeshB = mb;
          return 'hit';
        }
      }
    }
    return bvhMissing ? 'no-bvh' : 'clear';
  }

  private buildHit(job: PairJob): SceneCollisionHit {
    const ma = this.hitMeshA as MeshEntry;
    const mb = this.hitMeshB as MeshEntry;
    approxContactPoint(ma.mesh, mb.mesh, _contact);
    this.hitMeshA = null;
    this.hitMeshB = null;
    return {
      key: job.key,
      a: {
        modelId: job.a.id,
        model: job.a.model,
        mesh: ma.mesh,
        nodePath: ma.nodePath,
      },
      b: {
        modelId: job.b.id,
        model: job.b.model,
        mesh: mb.mesh,
        nodePath: mb.nodePath,
      },
      contact: [_contact.x, _contact.y, _contact.z],
    };
  }

  /** registry 에 root 가 생겼거나 바뀐 모델의 항목을 만든다. 변경이 있으면 true. */
  private resolvePending(): boolean {
    let changed = false;
    for (const model of this.models) {
      const root = modelObjectRegistry.get(model.id);
      const entry = this.entries.get(model.id);
      if (entry) {
        if (entry.root === root) continue;
        // 리마운트(root 교체) 또는 등록 해제.
        this.entries.delete(model.id);
        changed = true;
        if (!root) continue;
      }
      if (!root) continue;
      this.entries.set(model.id, this.buildEntry(model, root));
      changed = true;
    }
    return changed;
  }

  private buildEntry(model: SavedModelInfo, root: Object3D): ModelEntry {
    const meshes: MeshEntry[] = [];
    for (const mesh of collectCollidableMeshes(root, _meshScratch)) {
      const nodePath = getMeshPath(root, mesh);
      if (nodePath === null) continue;
      meshWorldBox(mesh, _box);
      if (_box.getSize(_size).length() < MIN_MESH_EXTENT) continue;
      meshes.push({
        mesh,
        nodePath,
        box: new Box3(),
        lastMatrix: new Float64Array(16).fill(Number.NaN),
        geometry: mesh.geometry,
        reach: meshLocalReach(mesh),
      });
    }
    _meshScratch.length = 0;
    return {
      id: model.id,
      model,
      root,
      meshes,
      box: new Box3(),
      dirty: true,
      tickDrift: 0,
    };
  }

  /** 다음 tick 의 변화 감지가 모든 메쉬를 새로 재게 한다. */
  private markAllDirty(entry: ModelEntry): void {
    for (const m of entry.meshes) m.lastMatrix.fill(Number.NaN);
    entry.dirty = true;
  }

  private refreshModelBox(entry: ModelEntry): void {
    entry.box.makeEmpty();
    for (const m of entry.meshes) entry.box.union(m.box);
  }

  /**
   * 쌍 목록 재생성. 기존 키의 상태는 유지하고 새 쌍은 untested(새 항목이
   * dirty 라 다음 tick 에 검사된다). 예산 초과로 큐에 남아 있던 쌍은 큐를
   * 새로 만들며 잃지 않도록 다시 넣는다 — 그 쌍의 항목은 이미 dirty 가
   * 풀려 있어 저절로는 재큐되지 않는다.
   */
  private rebuildPairs(): void {
    const carried = new Set<string>();
    for (const job of this.queue) carried.add(job.key);
    const entries = [...this.entries.values()];
    const next: PairJob[] = [];
    const nextByKey = new Map<string, PairJob>();
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        const key = pairKey(a.id, b.id);
        const prev = this.jobsByKey.get(key);
        const job: PairJob = {
          key,
          a,
          b,
          queued: false,
          state: this.suppressed.has(key)
            ? 'suppressed'
            : prev && prev.a === a && prev.b === b
              ? prev.state
              : 'untested',
          bvhRetryAt: prev?.bvhRetryAt ?? 0,
          separationCheckAt: prev?.separationCheckAt ?? 0,
          clearance: prev && prev.a === a && prev.b === b ? prev.clearance : 0,
          driftSinceClear:
            prev && prev.a === a && prev.b === b ? prev.driftSinceClear : 0,
          baselineDeferred:
            prev !== undefined && prev.a === a && prev.b === b
              ? prev.baselineDeferred
              : false,
        };
        next.push(job);
        nextByKey.set(key, job);
      }
    }
    this.pairs = next;
    this.jobsByKey.clear();
    for (const [key, job] of nextByKey) this.jobsByKey.set(key, job);
    this.resetQueue();
    for (const job of next) {
      if (carried.has(job.key)) this.enqueue(job);
    }
  }

  private enqueue(job: PairJob): void {
    if (job.queued) return;
    job.queued = true;
    this.queue.push(job);
  }

  /** 큐를 비우고 그 내용을 돌려준다. 꺼낸 항목은 다시 enqueue 될 수 있게 queued 를 내린다. */
  private takeQueue(): PairJob[] {
    const taken = this.queue;
    this.queue = [];
    for (const job of taken) job.queued = false;
    return taken;
  }

  private resetQueue(): void {
    for (const job of this.queue) job.queued = false;
    this.queue = [];
  }

  private resetSettle(): void {
    this.settleUntil = 0;
    this.settleFromNextTick = false;
  }
}

export const sceneCollisionRuntime = new SceneCollisionRuntime();
