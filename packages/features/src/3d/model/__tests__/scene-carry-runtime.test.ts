import { beforeEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, Object3D, Scene } from 'three';
import type { SavedModelInfo } from '@crane/domain/3d';
import { SceneCarryRuntime, type CarryResolvers } from '../scene-carry-runtime';
import { sceneCarryState } from '../scene-carry-state';

/**
 * 씬 하나: 크레인(트롤리 → 훅 노드 → 훅 블록 메쉬)과 블록 둘. 값은 Map 으로
 * 직접 넣는다 — 버스·React 없이 결정론으로 돈다.
 */
const CRANE = 'crane';
const ROPE = '[0]Trolley/[0]Rope';

function model(
  partial: Partial<SavedModelInfo> & { id: string },
): SavedModelInfo {
  return {
    equipName: partial.id,
    path: '/x.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...partial,
  };
}

function setup() {
  const scene = new Scene();
  const crane = new Group();
  const trolley = new Group();
  trolley.position.set(0, 60, 0);
  const rope = new Group();
  rope.position.set(0, -20, 0);
  const hookBlock = new Mesh(new BoxGeometry(2, 2, 2));
  hookBlock.position.set(0, -1, 0); // 바닥 = 60 - 20 - 2 = 38
  rope.add(hookBlock);
  trolley.add(rope);
  crane.add(trolley);
  scene.add(crane);

  const blockA = new Group();
  blockA.position.set(1, 6, 1); // 앵커(0,38,0)에서 XZ 1.4
  const blockB = new Group();
  blockB.position.set(50, 6, 0); // 반경 밖
  scene.add(blockA, blockB);
  scene.updateMatrixWorld(true);

  const models: SavedModelInfo[] = [
    model({
      id: CRANE,
      craneId: 'GC_04',
      hooks: [{ id: 'hook', nodes: [ROPE], attachCode: 'attach' }],
    }),
    model({ id: 'a', carriable: true, position: [1, 6, 1] }),
    model({ id: 'b', carriable: true, position: [50, 6, 0] }),
    model({ id: 'c', position: [0, 6, 0] }), // 운반 불가 — 앵커 바로 아래여도 안 붙는다
  ];
  const roots = new Map<string, Object3D>([
    [CRANE, crane],
    ['a', blockA],
    ['b', blockB],
    ['c', new Group()],
  ]);
  const values = new Map<string, number>();
  const resolve: CarryResolvers = {
    root: (id) => roots.get(id),
    node: (id, path) => (id === CRANE && path === ROPE ? rope : undefined),
    value: (key) => values.get(key),
  };
  return { scene, trolley, rope, blockA, blockB, models, values, resolve };
}

describe('SceneCarryRuntime', () => {
  beforeEach(() => sceneCarryState.clear());

  it('부착 신호가 켜지면 반경 안 가장 가까운 운반 가능 블록이 붙고 훅을 따라간다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    // 신호 없음 — 아무것도 안 붙고 케이블만 계산된다.
    let r = rt.step(s.models, s.resolve);
    expect(r.moved).toBe(false);
    expect(r.cables).toHaveLength(1);
    expect(r.cables[0].from.y).toBe(60);
    expect(r.cables[0].to.y).toBeCloseTo(40);
    expect(sceneCarryState.size).toBe(0);

    s.values.set('GC_04.attach', 1);
    r = rt.step(s.models, s.resolve);
    expect(sceneCarryState.carrierOf('a')).toBe(CRANE);
    expect(sceneCarryState.isCarried('b')).toBe(false);
    // 부착 프레임: 블록은 제자리(오프셋 기록만).
    expect(s.blockA.position.toArray()).toEqual([1, 6, 1]);
    expect(r.moved).toBe(false);

    // 훅이 10 올라가면 블록도 10 올라간다(상대 위치 유지).
    s.trolley.position.y = 70;
    r = rt.step(s.models, s.resolve);
    expect(r.moved).toBe(true);
    expect(s.blockA.position.toArray()).toEqual([1, 16, 1]);
    expect(rt.carrying).toBe(true);

    // 같은 자세면 움직임 없음.
    r = rt.step(s.models, s.resolve);
    expect(r.moved).toBe(false);
  });

  it('신호가 꺼지면 그 자리에 놓고, 신호가 아예 사라지면 배치 위치로 되돌린다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.attach', 1);
    rt.step(s.models, s.resolve);
    s.trolley.position.y = 70;
    s.trolley.position.x = 30;
    rt.step(s.models, s.resolve);
    expect(s.blockA.position.toArray()).toEqual([31, 16, 1]);

    s.values.set('GC_04.attach', 0);
    const r = rt.step(s.models, s.resolve);
    expect(r.moved).toBe(false);
    expect(sceneCarryState.size).toBe(0);
    expect(rt.carrying).toBe(false);
    expect(s.blockA.position.toArray()).toEqual([31, 16, 1]); // 놓은 자리 유지

    // 훅이 더 움직여도 따라오지 않는다.
    s.trolley.position.y = 80;
    rt.step(s.models, s.resolve);
    expect(s.blockA.position.toArray()).toEqual([31, 16, 1]);

    // 소스가 꺼져 값이 없어지면 rest 로.
    s.values.clear();
    const r2 = rt.step(s.models, s.resolve);
    expect(r2.moved).toBe(true);
    expect(s.blockA.position.toArray()).toEqual([1, 6, 1]);
  });

  it('다른 크레인이 든 블록·운반 불가 모델·반경 밖 블록은 집지 않는다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    sceneCarryState.attach('a', 'someone-else');
    s.values.set('GC_04.attach', 1);
    rt.step(s.models, s.resolve);
    expect(sceneCarryState.carrierOf('a')).toBe('someone-else');
    expect(sceneCarryState.isCarried('b')).toBe(false);
    expect(sceneCarryState.isCarried('c')).toBe(false);
    expect(rt.carrying).toBe(false);
  });

  it('훅 노드가 해석되지 않으면 아무것도 하지 않는다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.attach', 1);
    const r = rt.step(s.models, {
      ...s.resolve,
      node: () => undefined,
    });
    expect(r.cables).toHaveLength(0);
    expect(sceneCarryState.size).toBe(0);
  });

  it('craneId 가 없는 크레인은 키를 못 만들어 신호를 읽지 않는다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.attach', 1);
    const models = s.models.map((m) =>
      m.id === CRANE ? { ...m, craneId: undefined } : m,
    );
    rt.step(models, s.resolve);
    expect(sceneCarryState.size).toBe(0);
  });

  it('들고 있던 블록이 언마운트되면 놓는다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.attach', 1);
    rt.step(s.models, s.resolve);
    expect(sceneCarryState.isCarried('a')).toBe(true);
    const r = rt.step(s.models, {
      ...s.resolve,
      root: (id) => (id === 'a' ? undefined : s.resolve.root(id)),
    });
    expect(r.moved).toBe(false);
    expect(sceneCarryState.isCarried('a')).toBe(false);
  });

  it('dispose 는 옮긴 블록을 되돌리고 상태를 비운다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.attach', 1);
    rt.step(s.models, s.resolve);
    s.trolley.position.y = 70;
    rt.step(s.models, s.resolve);
    rt.dispose();
    expect(s.blockA.position.toArray()).toEqual([1, 6, 1]);
    expect(sceneCarryState.size).toBe(0);
    expect(rt.carrying).toBe(false);
  });

  it('모델 목록이 비면 옮긴 블록을 되돌린다', () => {
    const s = setup();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.attach', 1);
    rt.step(s.models, s.resolve);
    s.trolley.position.y = 70;
    rt.step(s.models, s.resolve);
    const r = rt.step([], s.resolve);
    expect(r.moved).toBe(true);
    expect(s.blockA.position.toArray()).toEqual([1, 6, 1]);
  });
});

/** 같은 크레인에 훅 둘(상부·하부) — 한 블록 위에 x 로 ±4 떨어져 있다. */
function setupTandem() {
  const scene = new Scene();
  const crane = new Group();
  const makeHook = (x: number) => {
    const trolley = new Group();
    trolley.position.set(x, 60, 0);
    const rope = new Group();
    rope.position.set(0, -20, 0);
    const hookBlock = new Mesh(new BoxGeometry(2, 2, 2));
    hookBlock.position.set(0, -1, 0);
    rope.add(hookBlock);
    trolley.add(rope);
    crane.add(trolley);
    return { trolley, rope };
  };
  const upper = makeHook(-4);
  const lower = makeHook(4);
  scene.add(crane);
  const block = new Group();
  block.position.set(0, 6, 0);
  scene.add(block);
  scene.updateMatrixWorld(true);
  const models: SavedModelInfo[] = [
    model({
      id: CRANE,
      craneId: 'GC_04',
      hooks: [
        { id: 'upper', nodes: ['U'], attachCode: 'att_u' },
        { id: 'lower', nodes: ['L'], attachCode: 'att_l' },
      ],
    }),
    model({ id: 'blk', carriable: true, position: [0, 6, 0] }),
  ];
  const values = new Map<string, number>();
  const resolve: CarryResolvers = {
    root: (id) => (id === CRANE ? crane : id === 'blk' ? block : undefined),
    node: (_id, path) =>
      path === 'U' ? upper.rope : path === 'L' ? lower.rope : undefined,
    value: (key) => values.get(key),
  };
  return { upper, lower, block, models, values, resolve };
}

describe('SceneCarryRuntime — 탠덤(같은 크레인 훅 둘)', () => {
  beforeEach(() => sceneCarryState.clear());

  it('두 훅이 같은 블록을 들면 앵커 평균을 따라가고, 한쪽만 올리면 절반만 오른다', () => {
    const s = setupTandem();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.att_u', 1);
    rt.step(s.models, s.resolve);
    expect(rt.holdersOf('blk')).toBe(1);
    // 첫 훅만 든 동안엔 그 훅 노드만 충돌 제외 대상이다.
    expect(sceneCarryState.isCarriedMeshPair(CRANE, 'U', 'blk', '')).toBe(true);
    expect(sceneCarryState.isCarriedMeshPair(CRANE, 'L', 'blk', '')).toBe(
      false,
    );
    s.values.set('GC_04.att_l', 1);
    rt.step(s.models, s.resolve);
    expect(rt.holdersOf('blk')).toBe(2);
    expect(sceneCarryState.carrierOf('blk')).toBe(CRANE);
    expect(sceneCarryState.isCarriedMeshPair(CRANE, 'L', 'blk', '')).toBe(true);
    // 합류 프레임엔 점프 없음.
    expect(s.block.position.toArray()).toEqual([0, 6, 0]);

    s.upper.trolley.position.y = 70;
    s.lower.trolley.position.y = 70;
    let r = rt.step(s.models, s.resolve);
    expect(r.moved).toBe(true);
    expect(s.block.position.toArray()).toEqual([0, 16, 0]);

    s.upper.trolley.position.y = 80; // 상부만 +10 → 평균 +5
    r = rt.step(s.models, s.resolve);
    expect(s.block.position.toArray()).toEqual([0, 21, 0]);
    expect(r.moved).toBe(true);
  });

  it('한쪽이 놓으면 남은 훅을 점프 없이 따라가고, 둘 다 놓으면 그 자리에 남는다', () => {
    const s = setupTandem();
    const rt = new SceneCarryRuntime();
    s.values.set('GC_04.att_u', 1);
    s.values.set('GC_04.att_l', 1);
    rt.step(s.models, s.resolve);
    s.upper.trolley.position.y = 70;
    s.lower.trolley.position.y = 70;
    rt.step(s.models, s.resolve);
    expect(s.block.position.toArray()).toEqual([0, 16, 0]);

    s.values.set('GC_04.att_l', 0);
    let r = rt.step(s.models, s.resolve);
    expect(r.moved).toBe(false); // 재기준 프레임
    expect(rt.holdersOf('blk')).toBe(1);
    expect(sceneCarryState.isCarried('blk')).toBe(true);
    expect(s.block.position.toArray()).toEqual([0, 16, 0]);

    s.upper.trolley.position.x = -14; // 상부만 x −10 → 블록도 −10 (하부는 이제 무관)
    s.lower.trolley.position.x = 40;
    r = rt.step(s.models, s.resolve);
    expect(s.block.position.toArray()).toEqual([-10, 16, 0]);

    s.values.set('GC_04.att_u', 0);
    r = rt.step(s.models, s.resolve);
    expect(rt.holdersOf('blk')).toBe(0);
    expect(sceneCarryState.size).toBe(0);
    expect(rt.carrying).toBe(false);
    s.upper.trolley.position.y = 90;
    rt.step(s.models, s.resolve);
    expect(s.block.position.toArray()).toEqual([-10, 16, 0]);
  });
});
