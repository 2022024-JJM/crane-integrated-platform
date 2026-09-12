import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import {
  circleIntersectsBoxXZ,
  collectCollidableMeshes,
  isValidZoneRadius,
  meshIntersectsVerticalCylinder,
  meshWorldBox,
  modelObjectRegistry,
  zoneCenterWorld,
  type SavedModelInfo,
  type SavedModelZone,
} from '@crane/domain/3d';
import {
  copyMatrix,
  matrixChanged,
  MIN_MESH_EXTENT,
} from '../lib/scene-collision-pairs';
import { ZONE_BVH_RETRY_MS, zoneExitMargin, zoneKey } from '../lib/scene-zones';

/**
 * 모델 영역(원형) 침범 감지 런타임 — React 밖 모듈 싱글턴. 훅(use-scene-zone-
 * detector)이 useFrame 에서 `tick()` 을 부르고 **상태 전이**(진입·이탈)만
 * 돌려받아 스토어에 반영한다. 프레임당 React 상태 쓰기는 없다.
 *
 * 충돌 런타임(scene-collision-runtime)과 같은 골격 — registry 로 루트를 찾고,
 * 메쉬 `matrixWorld` 서명으로 움직인 모델만 다시 보고, job 사이에서만 시간
 * 예산을 본다. 다른 점은 **상태 기반**이라는 것이다. 기준선·억제 단계가
 * 없다: 영역 안에 있으면 "침범 중" 이고, 들어오는 순간이 enter, 나가는 순간이
 * exit 다. 재생 시작 시 이미 안에 있던 모델은 그냥 현재 상태다.
 *
 * 검사 대상:
 * - 영역 × 다른 모델의 메쉬(소유 모델 제외) — AABB XZ 로 거르고 BVH 삼각형을
 *   XZ 투영해 정확 판정(zone-volumes). BVH 가 없으면 상태를 바꾸지 않고
 *   ZONE_BVH_RETRY_MS 뒤 다시 본다 — 가짜 판정을 만들지 않는다.
 * - 영역 × 다른 모델의 영역 — 중심 거리 < r1 + r2. 큐 없이 인라인.
 *   같은 모델의 영역끼리는 보지 않는다.
 * 지도·텍스트는 `sync(models)` 가 모델만 받으므로 들어오지 않는다.
 *
 * 히스테리시스: 진입은 r, 이탈은 r + zoneExitMargin(r). 안에 있는 쌍은
 * exitRadius 로 다시 본다.
 *
 * 영역 중심은 소유 모델 루트의 `matrixWorld` 평행이동(+오프셋) — 루트 서명이
 * 바뀔 때만 다시 잰다(rootLast). 트롤리만 움직인 모델은 침범자로만 재검사되고
 * 자기 영역은 재검사되지 않는다.
 *
 * inside 집합은 런타임이 zoneKey 로 들고 있어 항목 재생성(반경 편집·리마운트)
 * 에도 유지된다 — 반경을 키워 모델이 들어오면 enter 한 번, 무의미한 편집은
 * 전이 0. 영역·모델이 사라지면 남은 inside 에 대해 합성 exit 를 낸다.
 */

interface MeshEntry {
  mesh: Mesh;
  box: Box3;
  lastMatrix: Float64Array;
}

interface ZoneEntry {
  key: string;
  owner: ModelEntry;
  zone: SavedModelZone;
  cx: number;
  cz: number;
  y: number;
  radius: number;
  exitRadius: number;
  inside: Set<string>;
  dirty: boolean;
}

interface ModelEntry {
  id: string;
  model: SavedModelInfo;
  root: Object3D;
  meshes: MeshEntry[];
  box: Box3;
  dirty: boolean;
  rootLast: Float64Array;
  zones: ZoneEntry[];
}

interface ZoneModelJob {
  key: string;
  zone: ZoneEntry;
  target: ModelEntry;
  queued: boolean;
  inside: boolean;
  /** BVH 미준비로 미룬 경우 이 시각 전엔 다시 보지 않는다. */
  bvhRetryAt: number;
}

interface ZoneZoneJob {
  a: ZoneEntry;
  b: ZoneEntry;
  inside: boolean;
}

export interface ZoneTransition {
  kind: 'enter' | 'exit';
  zoneKey: string;
  owner: SavedModelInfo;
  zone: SavedModelZone;
  intruderKind: 'model' | 'zone';
  /** 모델 id, 또는 상대 영역의 zoneKey. */
  intruderId: string;
  /** 침범 모델, 또는 상대 영역의 소유 모델. */
  intruder: SavedModelInfo;
  /** intruderKind 가 'zone' 일 때 상대 영역. */
  intruderZone?: SavedModelZone;
}

export interface ZoneTickResult {
  /** 이번 tick 의 전이 — 배열은 tick 마다 재사용되므로 동기적으로 소비한다. */
  transitions: readonly ZoneTransition[];
  /** 모델·영역이 하나라도 움직였는지(다음 프레임 요청 근거). */
  moved: boolean;
}

const EMPTY_MODELS: SavedModelInfo[] = [];
const _meshScratch: Mesh[] = [];
const _box = new Box3();
const _size = new Vector3();
const _center = new Vector3();

function defaultClock(): number {
  return performance.now();
}

function isZoneIntruderId(id: string): boolean {
  return id.includes('#');
}

export class SceneZoneRuntime {
  private models: SavedModelInfo[] = EMPTY_MODELS;
  private readonly entries = new Map<string, ModelEntry>();
  private zoneEntries: ZoneEntry[] = [];
  private modelJobs: ZoneModelJob[] = [];
  private readonly modelJobsByKey = new Map<string, ZoneModelJob>();
  private zoneJobs: ZoneZoneJob[] = [];
  private queue: ZoneModelJob[] = [];
  private armed = false;
  /** zoneKey → 침범자 id 집합. 항목 재생성에도 살아남는 상태의 단일 소스. */
  private readonly insideByKey = new Map<string, Set<string>>();
  /** 합성 exit 에 쓸 마지막 정보 — 사라진 영역·모델도 잠시 기억한다. */
  private readonly zoneInfo = new Map<
    string,
    { owner: SavedModelInfo; zone: SavedModelZone }
  >();
  private readonly modelInfo = new Map<string, SavedModelInfo>();
  private readonly transitions: ZoneTransition[] = [];
  /** rebuildJobs 가 만든 합성 exit — sync() 는 tick 밖에서 불리므로 다음 tick 이 실어 간다. */
  private readonly pendingExits: ZoneTransition[] = [];
  private readonly result: ZoneTickResult & { transitions: ZoneTransition[] } =
    { transitions: this.transitions, moved: false };
  /** 마지막 tick 의 소요 시간(ms) — 예산 초과 관측용. */
  lastTickMs = 0;
  /** 마지막 tick 에서 실제로 검사한 영역×모델 job 수(테스트·진단). */
  lastTickTests = 0;

  private readonly clock: () => number;

  constructor(clock: () => number = defaultClock) {
    this.clock = clock;
  }

  get isArmed(): boolean {
    return this.armed;
  }

  /**
   * 씬의 모델 목록을 반영한다. 참조가 바뀐 모델은 항목을 다시 만들고(영역
   * 정의 재독), 사라진 모델은 지운다. registry 에 아직 없는 모델은 다음 tick
   * 에 다시 찾는다. inside 상태는 zoneKey 로 유지된다.
   */
  sync(models: SavedModelInfo[] | undefined): void {
    this.models = models ?? EMPTY_MODELS;
    const liveIds = new Set<string>();
    let changed = false;
    for (const model of this.models) {
      liveIds.add(model.id);
      this.modelInfo.set(model.id, model);
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
    if (changed) this.rebuildJobs();
  }

  /** 감시 시작. 다음 tick 에 모든 항목을 다시 잰다. */
  arm(): void {
    this.armed = true;
    for (const entry of this.entries.values()) this.markAllDirty(entry);
    for (const job of this.modelJobs) job.bvhRetryAt = 0;
  }

  /** 감시 중단·정리. inside 상태도 비운다 — 다시 켜면 현재 상태를 새로 잡는다. */
  disarm(): void {
    this.armed = false;
    this.entries.clear();
    this.zoneEntries = [];
    this.modelJobs = [];
    this.modelJobsByKey.clear();
    this.zoneJobs = [];
    this.resetQueue();
    this.insideByKey.clear();
    this.zoneInfo.clear();
    this.transitions.length = 0;
    this.pendingExits.length = 0;
    this.lastTickMs = 0;
    this.lastTickTests = 0;
  }

  /** 영역에 침범자가 하나라도 있는지 — 링·미니맵이 프레임마다 읽는다(O(1)). */
  isIntruded(key: string): boolean {
    const set = this.insideByKey.get(key);
    return set !== undefined && set.size > 0;
  }

  intrudersOf(key: string): ReadonlySet<string> | undefined {
    return this.insideByKey.get(key);
  }

  /**
   * 한 스캔. `now` 는 호출자의 시계(performance.now) — BVH 재시도 시각에 쓰고,
   * 예산 측정은 생성자에 주입된 clock 으로 한다(테스트 결정론). 돌려주는
   * 객체·배열은 tick 마다 재사용된다.
   */
  tick(now: number, budgetMs: number): ZoneTickResult {
    this.transitions.length = 0;
    this.result.moved = false;
    this.lastTickTests = 0;
    if (!this.armed) return this.result;
    const t0 = this.clock();

    if (this.resolvePending()) this.rebuildJobs();
    for (const exit of this.pendingExits) this.transitions.push(exit);
    this.pendingExits.length = 0;
    // 씬에 영역이 하나도 없으면 변화 감지도 건드리지 않는다 — 비용 0.
    if (this.zoneEntries.length === 0) {
      this.lastTickMs = this.clock() - t0;
      return this.result;
    }

    // A. 변화 감지 — 메쉬(침범자 박스)와 루트(영역 중심)를 따로 본다.
    let moved = false;
    for (const entry of this.entries.values()) {
      for (const m of entry.meshes) {
        if (!matrixChanged(m.lastMatrix, m.mesh.matrixWorld)) continue;
        copyMatrix(m.mesh.matrixWorld, m.lastMatrix);
        meshWorldBox(m.mesh, m.box);
        entry.dirty = true;
      }
      if (entry.dirty) {
        this.refreshModelBox(entry);
        moved = true;
      }
      if (
        entry.zones.length > 0 &&
        matrixChanged(entry.rootLast, entry.root.matrixWorld)
      ) {
        copyMatrix(entry.root.matrixWorld, entry.rootLast);
        for (const zone of entry.zones) {
          zoneCenterWorld(entry.root.matrixWorld, zone.zone.offset, _center);
          zone.cx = _center.x;
          zone.cz = _center.z;
          zone.y = _center.y;
          zone.dirty = true;
        }
        moved = true;
      }
    }
    this.result.moved = moved;

    // B. 움직인 영역·모델이 낀 job 만 큐에. 영역↔영역은 인라인.
    for (const job of this.modelJobs) {
      if (job.zone.dirty || job.target.dirty) this.enqueue(job);
    }
    for (const job of this.zoneJobs) {
      if (job.a.dirty || job.b.dirty) this.testZonePair(job);
    }
    for (const entry of this.entries.values()) {
      entry.dirty = false;
      for (const zone of entry.zones) zone.dirty = false;
    }

    // C. 이번 tick 에 볼 job 은 지금 큐에 있는 것까지(처리 중 재큐된 것은
    //    다음 tick). 예산은 job 사이에서만 보고 첫 job 은 항상 완료한다.
    const pending = this.takeQueue();
    for (let i = 0; i < pending.length; i += 1) {
      if (i > 0 && this.clock() - t0 >= budgetMs) {
        for (let j = i; j < pending.length; j += 1) this.enqueue(pending[j]);
        break;
      }
      const job = pending[i];
      if (job.bvhRetryAt > now) {
        this.enqueue(job);
        continue;
      }
      this.lastTickTests += 1;
      const verdict = this.testJob(job);
      if (verdict === 'no-bvh') {
        job.bvhRetryAt = now + ZONE_BVH_RETRY_MS;
        this.enqueue(job);
        continue;
      }
      if (verdict === 'in' && !job.inside) {
        job.inside = true;
        job.zone.inside.add(job.target.id);
        this.push('enter', job.zone, 'model', job.target.id, job.target.model);
      } else if (verdict === 'out' && job.inside) {
        job.inside = false;
        job.zone.inside.delete(job.target.id);
        this.push('exit', job.zone, 'model', job.target.id, job.target.model);
      }
    }

    this.lastTickMs = this.clock() - t0;
    return this.result;
  }

  // ---- 내부 ----

  private push(
    kind: 'enter' | 'exit',
    zone: ZoneEntry,
    intruderKind: 'model' | 'zone',
    intruderId: string,
    intruder: SavedModelInfo,
    intruderZone?: SavedModelZone,
  ): void {
    const transition: ZoneTransition = {
      kind,
      zoneKey: zone.key,
      owner: zone.owner.model,
      zone: zone.zone,
      intruderKind,
      intruderId,
      intruder,
    };
    if (intruderZone) transition.intruderZone = intruderZone;
    this.transitions.push(transition);
  }

  /** 영역 × 모델 메쉬. 안에 있는 쌍은 exitRadius(히스테리시스)로 본다. */
  private testJob(job: ZoneModelJob): 'in' | 'out' | 'no-bvh' {
    const { zone, target } = job;
    const r = job.inside ? zone.exitRadius : zone.radius;
    if (!circleIntersectsBoxXZ(target.box, zone.cx, zone.cz, r)) return 'out';
    let bvhMissing = false;
    for (const m of target.meshes) {
      if (!circleIntersectsBoxXZ(m.box, zone.cx, zone.cz, r)) continue;
      const hit = meshIntersectsVerticalCylinder(m.mesh, zone.cx, zone.cz, r);
      if (hit === null) {
        bvhMissing = true;
        continue;
      }
      if (hit) return 'in';
    }
    return bvhMissing ? 'no-bvh' : 'out';
  }

  /**
   * 영역 × 영역 — 중심 거리. 진입 d ≤ ra+rb, 이탈 d > ra+rb+max(ma,mb).
   * 전이는 a 쪽에서 한 번만 내고(기록 한 줄), inside 는 양쪽에 기록한다
   * (두 링이 모두 밝아진다).
   */
  private testZonePair(job: ZoneZoneJob): void {
    const { a, b } = job;
    const dx = a.cx - b.cx;
    const dz = a.cz - b.cz;
    const d2 = dx * dx + dz * dz;
    const sum = a.radius + b.radius;
    if (!job.inside) {
      if (d2 <= sum * sum) {
        job.inside = true;
        a.inside.add(b.key);
        b.inside.add(a.key);
        this.push('enter', a, 'zone', b.key, b.owner.model, b.zone);
      }
      return;
    }
    const margin = Math.max(a.exitRadius - a.radius, b.exitRadius - b.radius);
    const limit = sum + margin;
    if (d2 > limit * limit) {
      job.inside = false;
      a.inside.delete(b.key);
      b.inside.delete(a.key);
      this.push('exit', a, 'zone', b.key, b.owner.model, b.zone);
    }
  }

  /** registry 에 root 가 생겼거나 바뀐 모델의 항목을 만든다. 변경이 있으면 true. */
  private resolvePending(): boolean {
    let changed = false;
    for (const model of this.models) {
      const root = modelObjectRegistry.get(model.id);
      const entry = this.entries.get(model.id);
      if (entry) {
        if (entry.root === root) continue;
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
      meshWorldBox(mesh, _box);
      if (_box.getSize(_size).length() < MIN_MESH_EXTENT) continue;
      meshes.push({
        mesh,
        box: new Box3(),
        lastMatrix: new Float64Array(16).fill(Number.NaN),
      });
    }
    _meshScratch.length = 0;
    const entry: ModelEntry = {
      id: model.id,
      model,
      root,
      meshes,
      box: new Box3(),
      dirty: true,
      rootLast: new Float64Array(16).fill(Number.NaN),
      zones: [],
    };
    const seen = new Set<string>();
    for (const zone of model.zones ?? []) {
      // sanitize 와 같은 방어 — 무효 반경·중복 id 는 건너뛴다.
      if (!isValidZoneRadius(zone.radius) || seen.has(zone.id)) continue;
      seen.add(zone.id);
      const key = zoneKey(model.id, zone.id);
      let inside = this.insideByKey.get(key);
      if (!inside) {
        inside = new Set();
        this.insideByKey.set(key, inside);
      }
      this.zoneInfo.set(key, { owner: model, zone });
      entry.zones.push({
        key,
        owner: entry,
        zone,
        cx: 0,
        cz: 0,
        y: 0,
        radius: zone.radius,
        exitRadius: zone.radius + zoneExitMargin(zone.radius),
        inside,
        dirty: true,
      });
    }
    return entry;
  }

  /** 다음 tick 의 변화 감지가 모든 메쉬·루트를 새로 재게 한다. */
  private markAllDirty(entry: ModelEntry): void {
    for (const m of entry.meshes) m.lastMatrix.fill(Number.NaN);
    entry.rootLast.fill(Number.NaN);
    entry.dirty = true;
  }

  private refreshModelBox(entry: ModelEntry): void {
    entry.box.makeEmpty();
    for (const m of entry.meshes) entry.box.union(m.box);
  }

  /**
   * job 목록 재생성. inside 는 insideByKey 에서 복원하고, 더는 존재하지 않는
   * (영역, 침범자) 쌍은 합성 exit 로 정리한다. 예산 초과로 큐에 남아 있던
   * job 은 잃지 않도록 다시 넣는다.
   */
  private rebuildJobs(): void {
    const carried = new Set<string>();
    for (const job of this.queue) carried.add(job.key);

    const entries = [...this.entries.values()];
    const zones: ZoneEntry[] = [];
    for (const entry of entries) for (const z of entry.zones) zones.push(z);
    this.zoneEntries = zones;

    const nextJobs: ZoneModelJob[] = [];
    const nextByKey = new Map<string, ZoneModelJob>();
    for (const zone of zones) {
      for (const target of entries) {
        if (target.id === zone.owner.id) continue;
        // 제외(zoneExempt) 모델은 침범자가 되지 않는다 — 자기 영역은 그대로.
        if (target.model.zoneExempt === true) continue;
        const key = `${zone.key}|${target.id}`;
        const prev = this.modelJobsByKey.get(key);
        const job: ZoneModelJob = {
          key,
          zone,
          target,
          queued: false,
          inside: zone.inside.has(target.id),
          bvhRetryAt: prev?.bvhRetryAt ?? 0,
        };
        nextJobs.push(job);
        nextByKey.set(key, job);
      }
    }
    const nextZoneJobs: ZoneZoneJob[] = [];
    for (let i = 0; i < zones.length; i += 1) {
      for (let j = i + 1; j < zones.length; j += 1) {
        const a = zones[i];
        const b = zones[j];
        if (a.owner.id === b.owner.id) continue;
        nextZoneJobs.push({ a, b, inside: a.inside.has(b.key) });
      }
    }

    // 사라진 쌍의 합성 exit — 기준은 job 존재가 아니라 **씬 모델 목록**이다.
    // sync() 는 참조가 바뀐 모델의 항목을 지우고 곧바로 여기 오므로, 그 모델의
    // 쌍은 다음 tick 의 resolvePending 까지 job 이 없다. 그걸 사라진 것으로
    // 보면 이름만 바꿔도 exit+enter 가 난다. 영역↔영역은 한 번만.
    const liveZoneKeys = new Set<string>();
    const liveModelIds = new Set<string>();
    /** 침범자로 남을 수 있는 모델 — 제외(zoneExempt)로 바뀐 모델은 합성 exit. */
    const liveIntruderIds = new Set<string>();
    for (const m of this.models) {
      liveModelIds.add(m.id);
      if (m.zoneExempt !== true) liveIntruderIds.add(m.id);
      for (const z of m.zones ?? []) {
        if (isValidZoneRadius(z.radius)) liveZoneKeys.add(zoneKey(m.id, z.id));
      }
    }
    const isLive = (intruderId: string): boolean =>
      isZoneIntruderId(intruderId)
        ? liveZoneKeys.has(intruderId)
        : liveIntruderIds.has(intruderId);
    for (const [key, inside] of this.insideByKey) {
      const zoneLive = liveZoneKeys.has(key);
      if (inside.size === 0) {
        if (!zoneLive) this.insideByKey.delete(key);
        continue;
      }
      const info = this.zoneInfo.get(key);
      for (const intruderId of [...inside]) {
        if (zoneLive && isLive(intruderId)) continue;
        inside.delete(intruderId);
        if (!info) continue;
        if (isZoneIntruderId(intruderId)) {
          const other = this.zoneInfo.get(intruderId);
          // 상대 집합에서도 빼 두면 상대 키를 처리할 때 이 쌍이 다시 나오지
          // 않는다 — 영역↔영역 exit 는 한 번만.
          this.insideByKey.get(intruderId)?.delete(key);
          if (!other) continue;
          this.pendingExits.push({
            kind: 'exit',
            zoneKey: key,
            owner: info.owner,
            zone: info.zone,
            intruderKind: 'zone',
            intruderId,
            intruder: other.owner,
            intruderZone: other.zone,
          });
        } else {
          const intruder = this.modelInfo.get(intruderId);
          if (!intruder) continue;
          this.pendingExits.push({
            kind: 'exit',
            zoneKey: key,
            owner: info.owner,
            zone: info.zone,
            intruderKind: 'model',
            intruderId,
            intruder,
          });
        }
      }
      if (inside.size === 0 && !zoneLive) this.insideByKey.delete(key);
    }
    for (const key of this.zoneInfo.keys()) {
      if (!liveZoneKeys.has(key)) this.zoneInfo.delete(key);
    }
    for (const id of this.modelInfo.keys()) {
      if (!liveModelIds.has(id)) this.modelInfo.delete(id);
    }

    this.modelJobs = nextJobs;
    this.modelJobsByKey.clear();
    for (const [key, job] of nextByKey) this.modelJobsByKey.set(key, job);
    this.zoneJobs = nextZoneJobs;
    this.resetQueue();
    for (const job of nextJobs) {
      if (carried.has(job.key)) this.enqueue(job);
    }
  }

  private enqueue(job: ZoneModelJob): void {
    if (job.queued) return;
    job.queued = true;
    this.queue.push(job);
  }

  private takeQueue(): ZoneModelJob[] {
    const taken = this.queue;
    this.queue = [];
    for (const job of taken) job.queued = false;
    return taken;
  }

  private resetQueue(): void {
    for (const job of this.queue) job.queued = false;
    this.queue = [];
  }
}

export const sceneZoneRuntime = new SceneZoneRuntime();
