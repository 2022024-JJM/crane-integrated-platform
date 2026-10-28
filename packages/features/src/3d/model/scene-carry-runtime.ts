import { Vector3, type Object3D } from 'three';
import {
  DEFAULT_HOOK_PICK_RADIUS,
  resolveMappingTagKey,
  type SavedModelHook,
  type SavedModelInfo,
} from '@crane/domain/3d';
import {
  cableLength,
  computeCableSegment,
  computeHookAnchor,
  isAttachOn,
  measureHookNode,
  pickNearestCandidate,
  type CableSegment,
  type CarryCandidate,
  type HookNodeExtent,
} from '../lib/scene-carry';
import { sceneCarryState } from './scene-carry-state';

/**
 * 운반 런타임 — 매 프레임 크레인 모델의 훅(`SavedModelInfo.hooks`)을 읽어
 * 부착 태그가 켜진 훅에 운반 가능 모델(`carriable`)을 붙이고, 붙은 모델의
 * 루트를 **그 모델을 든 훅들의 앵커 평균** + 상대 위치로 옮긴다. 같은 크레인의
 * 훅 둘(상부·하부 트롤리)이 한 블록을 함께 들면 탠덤이다 — 블록은 두 앵커의
 * 가운데를 따라가고, 한쪽이 놓으면 남은 훅을 따라간다(드는 훅 구성이 바뀌는
 * 프레임에 상대 위치를 다시 잡아 점프하지 않는다). 다른 크레인이 든 블록은
 * 집지 않는다.
 *
 * 블록을 크레인 노드 아래로 재부모화하지 않는다(ModelMesh 가 래퍼 group 을
 * 걷어낸 구조와 충돌 — "다시 시도하지 않는 것"). 루트 position 만 쓴다.
 *
 * 값의 출처는 모른다 — `readValue(key)` 로 버스의 마지막 값을 읽을 뿐이다.
 * 부착 신호가 어느 훅에도 없으면(시뮬레이션 종료로 live 캐시가 비었거나 다른
 * 시나리오) 이 런타임이 옮겼던 블록을 배치 위치로 되돌린다.
 *
 * 블록 위치는 씬 시간의 순수 함수가 아니다(부착 시점의 상태). 그래서 seek·
 * 리셋(`reset`)은 블록을 배치 위치로 되돌리는 것으로 정한다 — 그 시각에 블록을
 * 들고 있었어야 해도 다시 만들지 않는다. 그때 이미 부착이 켜져 있던 훅은 한 번
 * 꺼질 때까지 집지 않는다: 빈 훅이 운반 경로를 지나며 다른 블록을 반경 안에서
 * 집어 가지 않게 하려는 것이다.
 *
 * three 객체를 받지만 React·R3F 를 모른다. 레이어(ui/scene-carry-layer)가
 * useFrame 에서 부르고 테스트는 Object3D 를 직접 만들어 돌린다.
 */

export interface CarryResolvers {
  /** 씬 모델 루트(modelObjectRegistry). 아직 마운트 전이면 undefined. */
  root(modelId: string): Object3D | undefined;
  /** 모델 안 노드(mesh-path). */
  node(modelId: string, path: string): Object3D | undefined;
  /** 태그 값 버스의 마지막 값. */
  value(key: string): number | undefined;
}

interface HookState {
  /** 이 프레임의 앵커(월드). `resolved` 가 false 면 쓰지 않는다. */
  anchor: Vector3;
  resolved: boolean;
  carriedId: string | undefined;
}

interface CarriedBlock {
  /** (블록 루트 월드 위치 − 드는 훅들의 앵커 평균). 훅 구성이 바뀌면 다시 잡는다. */
  offset: Vector3;
  /** 직전 프레임에 이 블록을 들던 훅 수 — 바뀌면 offset 재설정. 0 은 "아직 없음". */
  holders: number;
}

interface MovedBlock {
  root: Object3D;
  /** 처음 옮기기 전의 로컬 위치 — 신호가 사라지면 여기로 되돌린다. */
  restPosition: Vector3;
}

export interface CarryStepResult {
  /** 이 프레임에 어떤 블록이든 위치가 바뀌었는가 — 그림자 무효화 신호. */
  moved: boolean;
  /** 훅 노드마다 하나(모델 › 훅 › 노드 순). 레이어가 그 노드의 로프를 잇는다. */
  cables: CableSegment[];
}

const _centroid = new Vector3();
const _target = new Vector3();
const _world = new Vector3();

function hookStateKey(modelId: string, hookId: string): string {
  return `${modelId}/${hookId}`;
}

export class SceneCarryRuntime {
  private readonly hookStates = new Map<string, HookState>();
  private readonly carried = new Map<string, CarriedBlock>();
  private readonly moved = new Map<string, MovedBlock>();
  /** 부착이 꺼질 때까지 집지 않는 훅(상태 키). `reset` 이 채운다. */
  private readonly disarmed = new Set<string>();
  /** 다음 step 에서 부착이 켜져 있는 훅을 `disarmed` 에 넣는다. */
  private disarmPending = false;
  private readonly extents: HookNodeExtent[] = [];
  private readonly candidates: CarryCandidate[] = [];
  private readonly result: CarryStepResult = { moved: false, cables: [] };

  /** 지금 어떤 훅이든 블록을 들고 있는가. */
  get carrying(): boolean {
    return this.carried.size > 0;
  }

  /** 블록을 들고 있는 훅 수(탠덤이면 2). 안 들면 0. */
  holdersOf(carriedId: string): number {
    let n = 0;
    for (const state of this.hookStates.values()) {
      if (state.carriedId === carriedId) n += 1;
    }
    return n;
  }

  step(
    models: readonly SavedModelInfo[] | undefined,
    resolve: CarryResolvers,
  ): CarryStepResult {
    const result = this.result;
    result.moved = false;
    result.cables.length = 0;
    if (!models || models.length === 0) {
      if (this.restoreAll()) result.moved = true;
      return result;
    }

    // (1) 훅마다 앵커·케이블·부착/분리.
    let anySignal = false;
    const disarm = this.disarmPending;
    this.disarmPending = false;
    for (const state of this.hookStates.values()) state.resolved = false;
    for (const model of models) {
      if (!model.hooks || model.hooks.length === 0) continue;
      for (const hook of model.hooks) {
        const key = resolveMappingTagKey(model, { code: hook.attachCode });
        const value = key ? resolve.value(key) : undefined;
        if (value !== undefined) anySignal = true;
        this.stepHook(
          model,
          hook,
          value,
          disarm,
          models,
          resolve,
          result.cables,
        );
      }
    }
    // 어느 훅에도 부착 신호가 없으면 소스가 꺼진 것 — 옮긴 블록을 제자리로.
    if (!anySignal) {
      if (this.restoreAll()) result.moved = true;
      return result;
    }

    // (2) 든 블록마다 앵커 평균을 따라간다.
    for (const [id, block] of this.carried) {
      const root = resolve.root(id);
      if (!root) {
        // 언마운트된 블록 — 놓는다.
        this.drop(id);
        continue;
      }
      let holders = 0;
      _centroid.set(0, 0, 0);
      for (const state of this.hookStates.values()) {
        if (state.carriedId !== id || !state.resolved) continue;
        _centroid.add(state.anchor);
        holders += 1;
      }
      if (holders === 0) {
        this.drop(id);
        continue;
      }
      _centroid.divideScalar(holders);
      if (holders !== block.holders) {
        // 훅 구성이 바뀐 프레임(첫 부착·탠덤 합류·한쪽 분리) — 지금 자리를 기준으로.
        root.getWorldPosition(_world);
        block.offset.copy(_world).sub(_centroid);
        block.holders = holders;
      }
      _target.copy(_centroid).add(block.offset);
      if (root.parent) root.parent.worldToLocal(_target);
      if (root.position.equals(_target)) continue;
      root.position.copy(_target);
      result.moved = true;
    }
    return result;
  }

  /**
   * seek·리셋 — 옮긴 블록을 배치 위치로 되돌리고 운반 상태를 비운다. 다음
   * step 에서 부착이 켜져 있는 훅은 꺼질 때까지 집지 않는다. 레이어가 seek
   * 신호(`subscribeSceneSeek`)를 받은 다음 프레임에 부른다. 블록이 하나라도
   * 움직였으면 true — 그림자 무효화 신호.
   */
  reset(): boolean {
    this.disarmPending = true;
    return this.restoreAll();
  }

  /** 해체 — 옮긴 블록을 되돌리고 운반 상태를 비운다. 레이어 언마운트가 부른다. */
  dispose(): void {
    this.restoreAll();
    this.hookStates.clear();
    this.disarmed.clear();
    this.disarmPending = false;
  }

  private stepHook(
    model: SavedModelInfo,
    hook: SavedModelHook,
    value: number | undefined,
    disarm: boolean,
    models: readonly SavedModelInfo[],
    resolve: CarryResolvers,
    cables: CableSegment[],
  ): void {
    const stateKey = hookStateKey(model.id, hook.id);
    let state = this.hookStates.get(stateKey);
    if (!state) {
      state = { anchor: new Vector3(), resolved: false, carriedId: undefined };
      this.hookStates.set(stateKey, state);
    }
    // 노드 해석보다 먼저 — 노드가 아직 없는 프레임이어도 reset 직후의 부착
    // 상태로 잠근다. 꺼지면 언제든 풀린다.
    if (!isAttachOn(value)) this.disarmed.delete(stateKey);
    else if (disarm) this.disarmed.add(stateKey);

    // 노드 해석 — 매 프레임 registry 조회(O(1)). 하나도 없으면 훅이 없는 것.
    const extents = this.extents;
    let count = 0;
    for (const path of hook.nodes) {
      const node = resolve.node(model.id, path);
      if (!node) continue;
      let extent = extents[count];
      if (!extent) {
        extent = { origin: new Vector3(), top: 0, bottom: 0 };
        extents[count] = extent;
      }
      measureHookNode(node, extent);
      const cable = this.cableAt(cables, cables.length);
      computeCableSegment(node, extent, cable);
      count += 1;
    }
    if (count === 0) {
      this.release(state);
      return;
    }
    extents.length = count;
    computeHookAnchor(extents, hook.anchorOffsetY ?? 0, state.anchor);
    state.resolved = true;

    if (!isAttachOn(value)) {
      this.release(state);
      return;
    }
    if (state.carriedId !== undefined) return;
    if (this.disarmed.has(stateKey)) return;

    const picked = this.pick(model.id, hook, state.anchor, models, resolve);
    if (!picked) return;
    const root = resolve.root(picked.id);
    if (!root) return;
    state.carriedId = picked.id;
    if (!this.carried.has(picked.id)) {
      this.carried.set(picked.id, { offset: new Vector3(), holders: 0 });
    }
    // 훅마다 부른다 — 탠덤 합류 훅의 노드 경로가 제외 집합에 더해진다.
    sceneCarryState.attach(picked.id, model.id, hook.nodes);
    if (!this.moved.has(picked.id)) {
      this.moved.set(picked.id, { root, restPosition: root.position.clone() });
    }
  }

  /** 훅이 놓는다 — 마지막 훅이면 블록은 그 자리에 남고 운반 상태에서 빠진다. */
  private release(state: HookState): void {
    if (state.carriedId === undefined) return;
    const id = state.carriedId;
    state.carriedId = undefined;
    if (this.holdersOf(id) === 0) this.drop(id);
  }

  private drop(id: string): void {
    this.carried.delete(id);
    sceneCarryState.release(id);
    for (const state of this.hookStates.values()) {
      if (state.carriedId === id) state.carriedId = undefined;
    }
  }

  private pick(
    carrierId: string,
    hook: SavedModelHook,
    anchor: Vector3,
    models: readonly SavedModelInfo[],
    resolve: CarryResolvers,
  ): CarryCandidate | null {
    const candidates = this.candidates;
    let count = 0;
    for (const m of models) {
      if (m.carriable !== true || m.id === carrierId) continue;
      // 다른 크레인이 든 블록은 못 집는다. 같은 크레인의 다른 훅이 든 것은 탠덤.
      const carrier = sceneCarryState.carrierOf(m.id);
      if (carrier !== undefined && carrier !== carrierId) continue;
      const root = resolve.root(m.id);
      if (!root) continue;
      root.getWorldPosition(_world);
      let c = candidates[count];
      if (!c) {
        c = { id: m.id, position: new Vector3() };
        candidates[count] = c;
      }
      c.id = m.id;
      c.position.copy(_world);
      count += 1;
    }
    candidates.length = count;
    return pickNearestCandidate(
      anchor,
      candidates,
      hook.pickRadius ?? DEFAULT_HOOK_PICK_RADIUS,
    );
  }

  private cableAt(cables: CableSegment[], index: number): CableSegment {
    let cable = cables[index];
    if (!cable) {
      cable = { from: new Vector3(), to: new Vector3(), node: null };
      cables[index] = cable;
    }
    return cable;
  }

  /** 옮긴 블록 전부를 배치 위치로. 하나라도 움직였으면 true. */
  private restoreAll(): boolean {
    let moved = false;
    for (const block of this.moved.values()) {
      if (!block.root.position.equals(block.restPosition)) {
        block.root.position.copy(block.restPosition);
        moved = true;
      }
    }
    this.moved.clear();
    for (const id of [...this.carried.keys()]) this.drop(id);
    return moved;
  }
}

/** 보이는 케이블 수 — 길이 0 은 그리지 않는다. 레이어의 표시 판정. */
export function visibleCableCount(cables: readonly CableSegment[]): number {
  let n = 0;
  for (const c of cables) if (cableLength(c) > 0) n += 1;
  return n;
}
