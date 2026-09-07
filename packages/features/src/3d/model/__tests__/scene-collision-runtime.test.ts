import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { modelObjectRegistry, type SavedModelInfo } from '@crane/domain/3d';
import { SceneCollisionRuntime } from '../scene-collision-runtime';
import {
  BVH_RETRY_MS,
  SEPARATION_MARGIN,
} from '../../lib/scene-collision-pairs';

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

/**
 * 모델 = root Group > [0]Body(Mesh 1×1×1). 지오메트리는 모델마다 새로 만들어
 * BVH 유무를 개별 제어한다.
 */
function mountModel(id: string, x: number, options: { bvh?: boolean } = {}) {
  const root = new Group();
  root.name = id;
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  body.name = 'Body';
  root.add(body);
  root.position.set(x, 0, 0);
  root.updateMatrixWorld(true);
  if (options.bvh !== false) {
    (body.geometry as BvhGeometry).boundsTree = new MeshBVH(body.geometry);
  }
  modelObjectRegistry.register(id, root);
  return { root, body };
}

function model(id: string, x = 0): SavedModelInfo {
  return {
    id,
    equipName: id.toUpperCase(),
    path: `/models/${id}.glb`,
    opacity: 1,
    position: [x, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function moveTo(root: Object3D, x: number) {
  root.position.x = x;
  root.updateMatrixWorld(true);
}

let clockNow = 0;
const clock = () => clockNow;

function makeRuntime() {
  return new SceneCollisionRuntime(clock);
}

/** 예산 안에서 큐가 빌 때까지 반복(기준선 완료 등). */
function settle(rt: SceneCollisionRuntime, now = 0, ticks = 5) {
  let hit = null;
  for (let i = 0; i < ticks && hit === null; i += 1) hit = rt.tick(now, 100);
  return hit;
}

beforeEach(() => {
  clockNow = 0;
  modelObjectRegistry.clear();
});

afterEach(() => {
  modelObjectRegistry.clear();
  vi.restoreAllMocks();
});

describe('SceneCollisionRuntime — 기본 흐름', () => {
  it('idle/halted 에서는 tick 이 아무것도 하지 않는다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 0.5);
    rt.sync([model('a'), model('b', 0.5)]);
    expect(rt.tick(0, 100)).toBeNull();
    expect(rt.currentPhase).toBe('idle');
  });

  it('떨어진 두 모델은 기준선 뒤 scanning 이 되고, 접근해 관통하면 hit 을 돌려준다 — 정지는 halt() 를 불러야 한다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 5);
    rt.sync([model('a'), model('b', 5)]);
    rt.arm();
    expect(settle(rt)).toBeNull();
    expect(rt.currentPhase).toBe('scanning');

    moveTo(a.root, 4.5);
    const hit = rt.tick(10, 100);
    expect(hit).not.toBeNull();
    expect(hit?.key).toBe('a|b');
    expect(hit?.a.modelId).toBe('a');
    expect(hit?.b.modelId).toBe('b');
    expect(hit?.a.nodePath).toBe('[0]Body');
    expect(hit?.b.mesh).toBeInstanceOf(Mesh);
    // 접촉점 근사 = AABB 교집합 중심 x ∈ [4.5, 5] → 4.75
    expect(hit?.contact[0]).toBeCloseTo(4.75);
    // 스스로 멈추지 않는다 — 같은 자세면 다음 tick 엔 변화가 없어 조용하다.
    expect(rt.currentPhase).toBe('scanning');
    expect(rt.tick(20, 100)).toBeNull();
    rt.halt();
    expect(rt.currentPhase).toBe('halted');
    moveTo(a.root, 4.4);
    expect(rt.tick(30, 100)).toBeNull();
  });

  it('무정지 흐름 — hit 뒤 suppress 하면 붙어 있는 동안 재보고 없이 계속 감시하고, 분리 뒤 재접근하면 새 hit', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 5);
    const c = mountModel('c', 20);
    rt.sync([model('a'), model('b', 5), model('c', 20)]);
    rt.arm();
    settle(rt);
    moveTo(a.root, 4.5);
    const hit = rt.tick(10, 100);
    expect(hit?.key).toBe('a|b');
    rt.suppress(hit!.key);
    // 더 파고들어도 보고 없음, 다른 쌍은 여전히 감시된다.
    moveTo(a.root, 4.7);
    expect(rt.tick(20, 100)).toBeNull();
    // c 를 a(4.2~5.2)에는 닿고 b(4.5~5.5)에는 안 닿는 3.8 로.
    moveTo(c.root, 3.8);
    expect(rt.tick(30, 100)?.key).toBe('a|c');
    rt.suppress('a|c');
    // a 가 멀리 빠졌다가 b 에 다시 닿으면 새 hit.
    moveTo(a.root, -10);
    expect(rt.tick(40, 100)).toBeNull();
    moveTo(a.root, 4.6);
    expect(rt.tick(50, 100)?.key).toBe('a|b');
  });

  it('hit 이 난 tick 에 큐에 남아 있던 다른 쌍은 다음 tick 에 검사된다', () => {
    clockNow = 0;
    const advancing = vi.fn(() => (clockNow += 1));
    const rt = new SceneCollisionRuntime(advancing);
    const a = mountModel('a', 0);
    mountModel('b', 5);
    mountModel('c', 10);
    rt.sync([model('a'), model('b', 5), model('c', 10)]);
    rt.arm();
    for (let i = 0; i < 5; i += 1) rt.tick(i, 100);
    expect(rt.currentPhase).toBe('scanning');
    // a 를 b·c 모두와 겹치게(a-b, a-c 두 쌍이 같은 tick 에 큐에 든다).
    a.body.geometry = new BoxGeometry(12, 1, 1);
    (a.body.geometry as BvhGeometry).boundsTree = new MeshBVH(a.body.geometry);
    moveTo(a.root, 7);
    const first = rt.tick(10, 100);
    expect(first).not.toBeNull();
    rt.suppress(first!.key);
    const second = rt.tick(11, 100);
    expect(second).not.toBeNull();
    expect(second!.key).not.toBe(first!.key);
  });

  it('AABB 만 겹치고 OBB·삼각형은 안 닿는 회전 배치는 보고하지 않는다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    a.root.rotation.y = Math.PI / 4;
    a.root.updateMatrixWorld(true);
    // 회전한 큐브 AABB ±0.707. (0.65, 0, 0.65) 의 0.1 큐브는 AABB 안이지만 본체 밖.
    const b = mountModel('b', 0);
    b.body.geometry = new BoxGeometry(0.1, 0.1, 0.1);
    (b.body.geometry as BvhGeometry).boundsTree = new MeshBVH(b.body.geometry);
    b.root.position.set(0.65, 0, 0.65);
    b.root.updateMatrixWorld(true);
    rt.sync([model('a'), model('b')]);
    rt.arm();
    expect(settle(rt)).toBeNull();
    expect(rt.currentPhase).toBe('scanning');
    expect(rt.suppressedKeys.size).toBe(0);
  });
});

describe('SceneCollisionRuntime — 기준선·억제', () => {
  it('arm 시점에 이미 겹친 쌍은 보고 대신 억제하고, margin 보다 떨어지면 해제 뒤 다시 감지한다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 0.5);
    rt.sync([model('a'), model('b', 0.5)]);
    rt.arm();
    expect(settle(rt)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(true);

    // margin 정확값만큼 떨어짐 → 아직 억제. (간격 = margin)
    moveTo(a.root, -0.5 - SEPARATION_MARGIN);
    expect(rt.tick(10, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(true);

    // margin 보다 조금 더 → 해제.
    moveTo(a.root, -0.5 - SEPARATION_MARGIN - 0.01);
    expect(rt.tick(20, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(false);

    // 다시 접근 → 보고.
    moveTo(a.root, 0.2);
    expect(rt.tick(30, 100)?.key).toBe('a|b');
  });

  it('suppress(key) 로 닫은 쌍은 재무장 뒤에도 분리 전까지 보고하지 않고, 없는 키는 no-op', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 5);
    rt.sync([model('a'), model('b', 5)]);
    rt.arm();
    settle(rt);
    moveTo(a.root, 4.5);
    expect(rt.tick(10, 100)).not.toBeNull();

    rt.halt();
    rt.suppress('a|b');
    rt.suppress('nope|x');
    rt.arm();
    expect(settle(rt, 20)).toBeNull();
    expect(rt.currentPhase).toBe('scanning');
    // 조금 더 파고들어도(여전히 겹침) 보고 없음.
    moveTo(a.root, 4.7);
    expect(rt.tick(30, 100)).toBeNull();
    // 분리 → 해제 → 재접근 시 보고.
    moveTo(a.root, 0);
    expect(rt.tick(40, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(false);
    moveTo(a.root, 4.6);
    expect(rt.tick(50, 100)?.key).toBe('a|b');
  });

  it('모델 AABB 가 계속 겹쳐 있어도 메쉬가 떨어지면 억제가 풀리고, 다시 붙이면 새 hit', () => {
    const rt = makeRuntime();
    // a = 길이 10 짜리 모델(x=0 과 x=10 에 큐브 둘). 모델 AABB 는 -0.5~10.5.
    const a = mountModel('a', 0);
    const far = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    far.name = 'Far';
    far.position.x = 10;
    (far.geometry as BvhGeometry).boundsTree = new MeshBVH(far.geometry);
    a.root.add(far);
    a.root.updateMatrixWorld(true);
    const b = mountModel('b', 5); // 모델 AABB 안이지만 어느 메쉬와도 4 떨어짐
    rt.sync([model('a'), model('b', 5)]);
    rt.arm();
    expect(settle(rt)).toBeNull();
    expect(rt.suppressedKeys.size).toBe(0);

    moveTo(b.root, 0.5);
    const hit = rt.tick(10, 100);
    expect(hit?.key).toBe('a|b');
    rt.suppress('a|b');

    // 메쉬는 떨어졌지만 모델 AABB 는 여전히 겹친다 → 그래도 해제.
    moveTo(b.root, 5);
    expect(rt.tick(20, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(false);

    moveTo(b.root, 9.6); // 다른 메쉬(Far)에 붙임
    expect(
      rt.tick(30, 100)?.a.nodePath ?? rt.tick(31, 100)?.b.nodePath,
    ).toBeDefined();
  });

  it('메쉬 AABB 는 겹치지만 OBB 가 안 겹치면(회전 판) 떨어진 것으로 본다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    a.body.geometry = new BoxGeometry(4, 1, 0.1);
    (a.body.geometry as BvhGeometry).boundsTree = new MeshBVH(a.body.geometry);
    mountModel('b', 0.5);
    rt.sync([model('a'), model('b', 0.5)]);
    rt.arm();
    settle(rt); // 겹침 → 기준선 억제
    expect(rt.suppressedKeys.has('a|b')).toBe(true);

    // 판을 45° 돌리고 b 를 판의 AABB 안이지만 판 밖(수직 방향 1.7)으로.
    a.root.rotation.y = Math.PI / 4;
    a.root.updateMatrixWorld(true);
    const b = modelObjectRegistry.get('b') as Object3D;
    b.position.set(1.2, 0, 1.2);
    b.updateMatrixWorld(true);
    expect(rt.tick(10, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(false);
  });

  it('OBB 는 계속 겹쳐도(큰 상자 안으로 들어간 작은 상자) 삼각형이 떨어지면 억제가 풀린다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    a.body.geometry = new BoxGeometry(4, 4, 4);
    (a.body.geometry as BvhGeometry).boundsTree = new MeshBVH(a.body.geometry);
    const b = mountModel('b', 10);
    b.body.geometry = new BoxGeometry(0.5, 0.5, 0.5);
    (b.body.geometry as BvhGeometry).boundsTree = new MeshBVH(b.body.geometry);
    rt.sync([model('a'), model('b', 10)]);
    rt.arm();
    settle(rt);

    moveTo(b.root, 2); // 큰 상자의 면(x=2)을 관통
    expect(rt.tick(10, 100)?.key).toBe('a|b');
    rt.suppress('a|b');

    moveTo(b.root, 0); // 상자 안쪽 — OBB·AABB 는 겹치지만 면과 1.75 떨어짐
    expect(rt.tick(20, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(false);

    moveTo(b.root, 2); // 다시 면을 관통 → 새 hit
    expect(rt.tick(30, 100)?.key).toBe('a|b');
  });

  it('BVH 가 없는 메쉬 쌍은 OBB 가 겹치는 동안 억제를 유지한다(보수적)', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0, { bvh: false });
    a.body.geometry = new BoxGeometry(4, 4, 4);
    mountModel('b', 0.5);
    rt.sync([model('a'), model('b', 0.5)]);
    rt.arm();
    settle(rt);
    rt.suppress('a|b');
    const b = modelObjectRegistry.get('b') as Object3D;
    b.position.x = 0;
    b.updateMatrixWorld(true);
    expect(rt.tick(10, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(true);
    b.position.x = 10;
    b.updateMatrixWorld(true);
    expect(rt.tick(20, 100)).toBeNull();
    expect(rt.suppressedKeys.has('a|b')).toBe(false);
  });

  it('disarm 은 억제 집합까지 비운다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 0.5);
    rt.sync([model('a'), model('b', 0.5)]);
    rt.arm();
    settle(rt);
    expect(rt.suppressedKeys.size).toBe(1);
    rt.disarm();
    expect(rt.suppressedKeys.size).toBe(0);
    expect(rt.currentPhase).toBe('idle');
    expect(rt.lastTickMs).toBe(0);
  });
});

describe('SceneCollisionRuntime — 비용 절감', () => {
  it('움직임이 없는 쌍은 기준선 뒤 삼각형 검사가 0회다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 0.5);
    rt.sync([model('a'), model('b', 0.5)]);
    rt.arm();
    settle(rt);
    const bvh = (a.body.geometry as BvhGeometry).boundsTree as MeshBVH;
    const spy = vi.spyOn(bvh, 'intersectsGeometry');
    for (let i = 0; i < 10; i += 1) rt.tick(100 + i, 100);
    expect(spy).not.toHaveBeenCalled();
  });

  it('한쪽만 움직이면 그 모델이 낀 쌍만 검사된다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    const b = mountModel('b', 10);
    const c = mountModel('c', 20);
    rt.sync([model('a'), model('b', 10), model('c', 20)]);
    rt.arm();
    settle(rt);
    // c 의 BVH 는 b·c 쌍이 검사돼야만 불린다. a 만 움직이면 a-b, a-c 만 큐에 든다.
    const spyC = vi.spyOn(
      (c.body.geometry as BvhGeometry).boundsTree as MeshBVH,
      'intersectsGeometry',
    );
    const spyA = vi.spyOn(
      (a.body.geometry as BvhGeometry).boundsTree as MeshBVH,
      'intersectsGeometry',
    );
    moveTo(a.root, 9.5); // a-b 가 0.5 겹침 → hit
    const hit = rt.tick(10, 100);
    expect(hit?.key).toBe('a|b');
    // a 의 BVH 가 b 지오메트리와 검사됐고, c 는 어느 쪽으로도 불리지 않았다.
    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyC).not.toHaveBeenCalled();
    void b;
  });

  it('예산 0 이어도 첫 job 은 완료되고 나머지는 다음 tick 으로 넘어간다', () => {
    const rt = makeRuntime();
    // 세 모델 모두 떨어져 있다 → 기준선은 AABB 단계에서 끝나지만 job 수는 3.
    mountModel('a', 0);
    mountModel('b', 10);
    mountModel('c', 20);
    rt.sync([model('a'), model('b', 10), model('c', 20)]);
    rt.arm();
    // clock 을 매 호출마다 전진시켜 예산(0)을 즉시 넘기게 한다.
    clockNow = 0;
    const advancing = vi.fn(() => (clockNow += 1));
    const rtBudget = new SceneCollisionRuntime(advancing);
    rtBudget.sync([model('a'), model('b', 10), model('c', 20)]);
    rtBudget.arm();
    expect(rtBudget.tick(0, 0)).toBeNull();
    expect(rtBudget.currentPhase).toBe('baseline'); // 아직 큐가 남았다
    rtBudget.tick(1, 0);
    rtBudget.tick(2, 0);
    expect(rtBudget.currentPhase).toBe('scanning');
    expect(rtBudget.lastTickMs).toBeGreaterThan(0);
  });

  it('예산 이월 중 sync 로 쌍이 재생성돼도 큐에 남아 있던 쌍을 잃지 않는다', () => {
    clockNow = 0;
    const advancing = vi.fn(() => (clockNow += 1));
    const rt = new SceneCollisionRuntime(advancing);
    const a = mountModel('a', 0);
    mountModel('b', 10);
    mountModel('c', 0.5); // a-c 는 처음부터 겹침 → 기준선에서 억제돼야 한다
    const models = [model('a'), model('b', 10), model('c', 0.5)];
    rt.sync(models);
    rt.arm();
    rt.tick(0, 0); // 첫 job(a-b)만 처리, a-c·b-c 는 큐에 남음
    // 편집으로 b 의 참조가 바뀜 → 쌍 재생성.
    rt.sync([models[0], model('b', 10), models[2]]);
    for (let i = 1; i < 6; i += 1) rt.tick(i, 0);
    expect(rt.currentPhase).toBe('scanning');
    expect(rt.suppressedKeys.has('a|c')).toBe(true);
    void a;
  });
});

describe('SceneCollisionRuntime — BVH·registry 상태', () => {
  it('BVH 가 없는 쌍은 보고하지 않고 BVH_RETRY_MS 뒤 다시 보며, 빌드되면 감지한다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0, { bvh: false });
    const b = mountModel('b', 5);
    rt.sync([model('a'), model('b', 5)]);
    rt.arm();
    settle(rt);
    moveTo(a.root, 4.5);
    expect(rt.tick(100, 100)).toBeNull();
    // 재시도 시각 전 — 여전히 null (재큐만 됨)
    expect(rt.tick(100 + BVH_RETRY_MS - 1, 100)).toBeNull();
    // BVH 빌드 완료 후 재시도 시각 도달 → 감지
    (a.body.geometry as BvhGeometry).boundsTree = new MeshBVH(a.body.geometry);
    expect(rt.tick(100 + BVH_RETRY_MS, 100)?.key).toBe('a|b');
    void b;
  });

  it('registry 에 아직 없는 모델은 보류했다가 등록되면 다음 tick 에 합류한다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    rt.sync([model('a'), model('b', 0.5)]);
    rt.arm();
    settle(rt);
    expect(rt.currentPhase).toBe('scanning');
    mountModel('b', 0.5); // 늦게 마운트 — 이미 겹친 자리
    // 기준선은 끝났으므로 새 쌍은 즉시 검사돼 보고된다(에디터에서 겹친 곳에 드롭한 경우).
    expect(rt.tick(10, 100)?.key).toBe('a|b');
    void a;
  });

  it('리마운트(root 교체)된 모델은 항목을 다시 만든다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 5);
    rt.sync([model('a'), model('b', 5)]);
    rt.arm();
    settle(rt);
    modelObjectRegistry.unregister('a', a.root);
    expect(rt.tick(10, 100)).toBeNull();
    mountModel('a', 4.5); // 새 root 가 겹친 자리에
    expect(rt.tick(20, 100)?.key).toBe('a|b');
  });

  it('sync 에서 사라진 모델의 쌍은 검사되지 않고, 참조가 바뀐 모델은 메쉬를 다시 모은다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 5);
    rt.sync([model('a'), model('b', 5)]);
    rt.arm();
    settle(rt);
    rt.sync([model('a')]);
    moveTo(a.root, 4.5);
    expect(rt.tick(10, 100)).toBeNull();

    // b 복귀 + a 의 Body 를 숨긴 뒤 참조 갱신 → a 에 충돌 메쉬가 없어 보고 없음.
    a.body.visible = false;
    rt.sync([model('a'), model('b', 5)]);
    expect(settle(rt, 20)).toBeNull();
    a.body.visible = true;
    rt.sync([model('a'), model('b', 5)]);
    expect(settle(rt, 30)?.key).toBe('a|b');
  });

  it('충돌 메쉬가 없는 모델(빈 root)·모델 1개·0개는 조용히 지나간다', () => {
    const rt = makeRuntime();
    modelObjectRegistry.register('empty', new Group());
    rt.sync([model('empty')]);
    rt.arm();
    expect(settle(rt)).toBeNull();
    expect(rt.currentPhase).toBe('scanning');
    rt.sync([]);
    expect(rt.tick(10, 100)).toBeNull();
    rt.sync(undefined);
    expect(rt.tick(20, 100)).toBeNull();
  });
});
