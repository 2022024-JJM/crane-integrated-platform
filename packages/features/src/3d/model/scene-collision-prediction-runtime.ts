import { Box3, Vector3, type Object3D } from 'three';
import {
  approxContactPoint,
  modelObjectRegistry,
  type SavedModelInfo,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { pairKey } from '../lib/scene-collision-pairs';
import {
  buildProbeMeshes,
  probeEntryPair,
  refreshProbeBoxes,
  type ProbeEntry,
  type ProbeHitMeshes,
} from '../lib/scene-collision-probe';

/**
 * 충돌 예측 검사 — **무상태**. 한 샘플(= 미래의 한 시각)에 대해 "지금 이
 * 자세로 부딪히는 쌍이 있는가" 만 답한다.
 *
 * 자세를 만드는 것은 이 모듈이 아니다. 호출자(use-scene-collision-prediction)
 * 가 `rigPoseBorrow.borrow(미래 값)` 로 실제 노드 트리를 미래 자세로 만든 뒤
 * `scanSample` 을 부르고, 곧바로 `release()` 로 되돌린다.
 *
 * 감지 런타임(scene-collision-runtime)의 스케줄링을 재사용하지 않는 이유:
 * 기준선(1초 안정화 창)·억제 집합·변화 감지는 전부 사후 감지 전용 장치이고
 * 예측에는 반대로 작용한다. 창이 있으면 예측이 1초 동안 전부 억제되고,
 * 억제 집합이 있으면 첫 발견 이후 침묵한다. 변화 감지는 매 샘플 자세가
 * 통째로 바뀌므로 절감이 0 이다. 그래서 예측은 매 샘플을 처음부터 돈다.
 * **판정 캐스케이드는 공유한다**(scene-collision-probe) — 갈라지면 "예측은
 * 났는데 감지는 없다" 가 된다.
 *
 * 항목 캐시는 root 참조를 키로 유지한다. 참조가 그대로면 메쉬 목록을 다시
 * 수집하지 않는다(리마운트·`meshOverrides.visible` 변경은 참조가 바뀐다).
 */

export interface ScenePredictionHitParty {
  modelId: string;
  model: SavedModelInfo;
  /** 모델 루트 기준 mesh-path. 루트 자체면 ''. */
  nodePath: string;
  /** 그 메쉬의 **미래** 월드 AABB. */
  box: Box3;
}

export interface ScenePredictionHit {
  key: string;
  a: ScenePredictionHitParty;
  b: ScenePredictionHitParty;
  /** 근사 접촉점(씬 unit) — 미래 자세 기준. */
  contact: Vector3Tuple;
}

interface PredictionEntry extends ProbeEntry {
  id: string;
  model: SavedModelInfo;
  root: Object3D;
}

export interface ScanSampleOptions {
  /** 이 모델들만 움직인다고 본다 — 정적↔정적 쌍은 검사하지 않는다. */
  drivenModelIds: readonly string[];
  /** 감지 기준선이 억제한 쌍 + 이미 보고된 활성 충돌 쌍. */
  excludedPairKeys: ReadonlySet<string>;
  /**
   * 지금 화면에 띄우고 있는 쌍. 같은 시각에 여러 쌍이 겹치면 이 쌍을 먼저
   * 돌려준다 — 쌍 열거 순서로 정하면 표시가 이유 없이 갈아탄다.
   */
  preferPairKey?: string;
}

const _contact = new Vector3();
const _hit: ProbeHitMeshes = { a: null, b: null };

export class SceneCollisionPredictionRuntime {
  private models: SavedModelInfo[] = [];
  private readonly entries = new Map<string, PredictionEntry>();
  /** (구동 모델 × 전체) 쌍. 모델 목록·구동 집합이 바뀔 때만 다시 만든다. */
  private pairs: Array<[PredictionEntry, PredictionEntry]> = [];
  /** 쌍에 등장하는 항목 — 샘플마다 박스를 다시 재야 하는 대상. */
  private touched: PredictionEntry[] = [];
  private pairsSignature = '';

  /** 씬 모델 목록 반영. 참조가 바뀐 모델은 항목을 버리고 다시 만든다. */
  sync(models: SavedModelInfo[] | undefined): void {
    this.models = models ?? [];
    const liveIds = new Set<string>();
    for (const model of this.models) {
      liveIds.add(model.id);
      const entry = this.entries.get(model.id);
      if (entry && entry.model !== model) this.entries.delete(model.id);
    }
    for (const id of this.entries.keys()) {
      if (!liveIds.has(id)) this.entries.delete(id);
    }
    // 쌍 목록은 다음 스캔이 필요할 때 다시 만든다(서명 비교).
    this.pairsSignature = '';
  }

  /** 항목·쌍·캐시를 비운다. 훅 언마운트에서 부른다. */
  reset(): void {
    this.models = [];
    this.entries.clear();
    this.pairs = [];
    this.touched = [];
    this.pairsSignature = '';
  }

  /**
   * 현재 노드 트리 자세(= 호출자가 차용해 만든 미래 자세)로 한 샘플을
   * 검사한다. 첫 hit 에서 멈추고 없으면 null.
   *
   * BVH 미준비(`'no-bvh'`)는 **판정하지 않고 넘긴다** — 감지처럼 재시도하거나
   * 보수적으로 보고하면 로딩 직후 수 초간 오경보가 쏟아진다. 그 구간은 이미
   * 워밍업 표시가 안내한다.
   *
   * 시간 예산은 여기 두지 않는다. 한 샘플의 비용은 쌍 수가 아니라 자세 차용
   * (노드 적용 + updateMatrixWorld)이 지배하고, 실제 쌍 수는 philly 조선소
   * 씬에서 12개다(구동 모델 3 × 나머지). 예산은 **칸 사이**에서 호출자가
   * 본다(use-scene-collision-prediction).
   */
  scanSample({
    drivenModelIds,
    excludedPairKeys,
    preferPairKey,
  }: ScanSampleOptions): ScenePredictionHit | null {
    this.resolveEntries();
    this.ensurePairs(drivenModelIds);
    if (this.pairs.length === 0) return null;

    // 자세가 통째로 바뀌었으므로 이 샘플에 쓰는 항목의 박스를 다시 잰다.
    for (const entry of this.touched) refreshProbeBoxes(entry);

    let first: ScenePredictionHit | null = null;
    for (const [a, b] of this.pairs) {
      const key = pairKey(a.id, b.id);
      if (excludedPairKeys.has(key)) continue;
      // 이미 다른 쌍을 찾았고 이 쌍이 우선 대상도 아니면 볼 이유가 없다.
      if (first !== null && key !== preferPairKey) continue;
      if (!a.box.intersectsBox(b.box)) continue;
      if (probeEntryPair(a, b, _hit) !== 'hit') continue;
      const hit = this.buildHit(key, a, b);
      // 우선 대상이 이 시각에 겹치면 그대로 유지한다.
      if (key === preferPairKey) return hit;
      first = hit;
    }
    return first;
  }

  private buildHit(
    key: string,
    a: PredictionEntry,
    b: PredictionEntry,
  ): ScenePredictionHit {
    const ma = _hit.a;
    const mb = _hit.b;
    if (!ma || !mb) throw new Error('probeEntryPair hit without meshes');
    approxContactPoint(ma.mesh, mb.mesh, _contact);
    _hit.a = null;
    _hit.b = null;
    return {
      key,
      a: {
        modelId: a.id,
        model: a.model,
        nodePath: ma.nodePath,
        box: ma.box.clone(),
      },
      b: {
        modelId: b.id,
        model: b.model,
        nodePath: mb.nodePath,
        box: mb.box.clone(),
      },
      contact: [_contact.x, _contact.y, _contact.z],
    };
  }

  private resolveEntries(): void {
    for (const model of this.models) {
      const root = modelObjectRegistry.get(model.id);
      const entry = this.entries.get(model.id);
      if (entry) {
        if (entry.root === root) continue;
        this.entries.delete(model.id);
        this.pairsSignature = '';
        if (!root) continue;
      }
      if (!root) continue;
      this.entries.set(model.id, {
        id: model.id,
        model,
        root,
        meshes: buildProbeMeshes(root),
        box: new Box3(),
      });
      this.pairsSignature = '';
    }
  }

  /**
   * 검사 쌍 = 구동 모델 × 전체 모델(자기 자신·중복 제외). 정적↔정적 쌍은
   * 자세가 변할 수 없으므로 예측 대상이 아니다 — 그것은 감지 기준선의 소관이다.
   */
  private ensurePairs(drivenModelIds: readonly string[]): void {
    const signature = `${[...drivenModelIds].sort().join(',')}#${[
      ...this.entries.keys(),
    ]
      .sort()
      .join(',')}`;
    if (signature === this.pairsSignature) return;
    this.pairsSignature = signature;

    const driven: PredictionEntry[] = [];
    for (const id of drivenModelIds) {
      const entry = this.entries.get(id);
      if (entry) driven.push(entry);
    }
    const all = [...this.entries.values()];
    const seen = new Set<string>();
    const pairs: Array<[PredictionEntry, PredictionEntry]> = [];
    for (const a of driven) {
      for (const b of all) {
        if (a === b) continue;
        const key = pairKey(a.id, b.id);
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([a, b]);
      }
    }
    this.pairs = pairs;
    const touched = new Set<PredictionEntry>();
    for (const [a, b] of pairs) {
      touched.add(a);
      touched.add(b);
    }
    this.touched = [...touched];
  }

  /** 진단용 — 현재 검사 쌍 수. */
  get pairCount(): number {
    return this.pairs.length;
  }
}

export const sceneCollisionPredictionRuntime =
  new SceneCollisionPredictionRuntime();
