import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { modelObjectRegistry, type SavedModelInfo } from '@crane/domain/3d';
import { SceneCollisionPredictionRuntime } from '../scene-collision-prediction-runtime';

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

/** 모델 = root Group > [0]Body(Mesh 1×1×1). scene-collision-runtime.test 와 같은 형태. */
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

function moveTo(root: Group, x: number): void {
  root.position.x = x;
  root.updateMatrixWorld(true);
}

const NO_EXCLUSION: ReadonlySet<string> = new Set();

let runtime: SceneCollisionPredictionRuntime;

beforeEach(() => {
  modelObjectRegistry.clear();
  runtime = new SceneCollisionPredictionRuntime();
});

afterEach(() => {
  modelObjectRegistry.clear();
  vi.restoreAllMocks();
});

describe('scanSample — 기본 판정', () => {
  it('구동 모델이 정적 모델과 겹치면 hit 을 돌려준다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);

    const hit = runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(hit).not.toBeNull();
    expect([hit?.a.modelId, hit?.b.modelId].sort()).toEqual(['a', 'b']);
    expect(hit?.a.nodePath).toBe('[0]Body');
  });

  it('hit 의 박스는 미래 자세 기준이고 스냅샷이라 이후 이동에 영향받지 않는다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);

    const hit = runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    const partyA = hit?.a.modelId === 'a' ? hit?.a : hit?.b;
    expect(partyA?.box.min.x).toBeCloseTo(-0.5);
    // 검사 뒤 모델이 움직여도 굳어 둔 박스는 그대로다.
    moveTo(a.root, 50);
    expect(partyA?.box.min.x).toBeCloseTo(-0.5);
  });

  it('접촉점은 두 메쉬 AABB 교집합 중심이다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    const hit = runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(hit?.contact[0]).toBeCloseTo(0.25);
  });

  it('떨어져 있으면 null', () => {
    mountModel('a', 0);
    mountModel('b', 10);
    runtime.sync([model('a', 0), model('b', 10)]);
    expect(
      runtime.scanSample({
        drivenModelIds: ['a'],
        excludedPairKeys: NO_EXCLUSION,
      }),
    ).toBeNull();
  });

  it('이동 뒤 다시 스캔하면 박스를 다시 재어 판정이 바뀐다', () => {
    const a = mountModel('a', 10);
    mountModel('b', 0);
    runtime.sync([model('a', 10), model('b', 0)]);
    const opts = { drivenModelIds: ['a'], excludedPairKeys: NO_EXCLUSION };
    expect(runtime.scanSample(opts)).toBeNull();
    moveTo(a.root, 0.5);
    expect(runtime.scanSample(opts)).not.toBeNull();
  });
});

describe('scanSample — 쌍 선별', () => {
  it('정적↔정적 쌍은 검사하지 않는다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    // 구동 모델이 없으면 쌍이 0 이라 겹쳐 있어도 null.
    expect(
      runtime.scanSample({
        drivenModelIds: [],
        excludedPairKeys: NO_EXCLUSION,
      }),
    ).toBeNull();
    expect(runtime.pairCount).toBe(0);
  });

  it('구동 모델이 둘이어도 같은 쌍을 두 번 만들지 않는다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    runtime.scanSample({
      drivenModelIds: ['a', 'b'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(runtime.pairCount).toBe(1);
  });

  it('excludedPairKeys 에 든 쌍은 겹쳐도 보고하지 않는다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    expect(
      runtime.scanSample({
        drivenModelIds: ['a'],
        excludedPairKeys: new Set(['a|b']),
      }),
    ).toBeNull();
  });

  it('registry 에 없는 모델은 쌍에 들어가지 않는다', () => {
    mountModel('a', 0);
    // b 는 씬 데이터에만 있고 마운트되지 않았다.
    runtime.sync([model('a', 0), model('b', 0.5)]);
    runtime.scanSample({
      drivenModelIds: ['a', 'b'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(runtime.pairCount).toBe(0);
  });

  it('빈 씬·모델 1개는 쌍이 없다', () => {
    runtime.sync(undefined);
    expect(
      runtime.scanSample({
        drivenModelIds: ['a'],
        excludedPairKeys: NO_EXCLUSION,
      }),
    ).toBeNull();
    mountModel('a', 0);
    runtime.sync([model('a', 0)]);
    expect(
      runtime.scanSample({
        drivenModelIds: ['a'],
        excludedPairKeys: NO_EXCLUSION,
      }),
    ).toBeNull();
    expect(runtime.pairCount).toBe(0);
  });
});

describe('scanSample — BVH 미준비', () => {
  it('BVH 가 없으면 판정하지 않고 넘긴다 — 보수적 보고도, 재시도도 없다', () => {
    mountModel('a', 0, { bvh: false });
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    const opts = { drivenModelIds: ['a'], excludedPairKeys: NO_EXCLUSION };
    expect(runtime.scanSample(opts)).toBeNull();
    // 다시 불러도 여전히 조용하다(재시도 상태를 들지 않는다).
    expect(runtime.scanSample(opts)).toBeNull();
  });

  it('BVH 가 뒤늦게 붙으면 그 다음 스캔부터 보고한다', () => {
    const a = mountModel('a', 0, { bvh: false });
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    const opts = { drivenModelIds: ['a'], excludedPairKeys: NO_EXCLUSION };
    expect(runtime.scanSample(opts)).toBeNull();
    (a.body.geometry as BvhGeometry).boundsTree = new MeshBVH(a.body.geometry);
    expect(runtime.scanSample(opts)).not.toBeNull();
  });
});

describe('scanSample — 비용', () => {
  it('떨어진 쌍은 삼각형 검사를 부르지 않는다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 10);
    runtime.sync([model('a', 0), model('b', 10)]);
    const bvh = (a.body.geometry as BvhGeometry).boundsTree as MeshBVH;
    const spy = vi.spyOn(bvh, 'intersectsGeometry');
    runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('제외된 쌍은 박스 교차조차 보지 않는다', () => {
    const a = mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    const bvh = (a.body.geometry as BvhGeometry).boundsTree as MeshBVH;
    const spy = vi.spyOn(bvh, 'intersectsGeometry');
    runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: new Set(['a|b']),
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('sync / reset', () => {
  it('모델 참조가 바뀌면 항목을 다시 만든다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    expect(
      runtime.scanSample({
        drivenModelIds: ['a'],
        excludedPairKeys: NO_EXCLUSION,
      }),
    ).not.toBeNull();
    // 새 참조(인스펙터 편집) — 여전히 정상 동작해야 한다.
    runtime.sync([model('a', 0), model('b', 0.5)]);
    expect(
      runtime.scanSample({
        drivenModelIds: ['a'],
        excludedPairKeys: NO_EXCLUSION,
      }),
    ).not.toBeNull();
  });

  it('사라진 모델의 항목은 지운다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(runtime.pairCount).toBe(1);
    runtime.sync([model('a', 0)]);
    runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(runtime.pairCount).toBe(0);
  });

  it('리마운트(root 교체)를 따라간다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    const models = [model('a', 0), model('b', 0.5)];
    runtime.sync(models);
    const opts = { drivenModelIds: ['a'], excludedPairKeys: NO_EXCLUSION };
    expect(runtime.scanSample(opts)).not.toBeNull();
    // 같은 id 로 새 root 를 등록 — 이번엔 멀리 떨어진 곳에.
    mountModel('a', 50);
    expect(runtime.scanSample(opts)).toBeNull();
  });

  it('reset 은 항목·쌍 캐시를 비운다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    runtime.scanSample({
      drivenModelIds: ['a'],
      excludedPairKeys: NO_EXCLUSION,
    });
    expect(runtime.pairCount).toBe(1);
    runtime.reset();
    expect(runtime.pairCount).toBe(0);
  });

  it('reset 뒤에도 씬 모델 목록은 남아 다음 스캔이 스스로 복구한다', () => {
    // 예측을 껐다 켜는 경로다. 목록까지 지우면 `sync` 를 다시 부를 일이
    // 없어(models 참조가 그대로) 검사 쌍이 0 인 채로 남는다 — 예측이 영영
    // 안 뜨던 실측 결함(2026-09-10).
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    const opts = { drivenModelIds: ['a'], excludedPairKeys: NO_EXCLUSION };
    expect(runtime.scanSample(opts)).not.toBeNull();

    runtime.reset();
    expect(runtime.scanSample(opts)).not.toBeNull();
    expect(runtime.pairCount).toBe(1);
  });

  it('reset 은 항목을 다시 해석하므로 그 사이 리마운트를 따라간다', () => {
    mountModel('a', 0);
    mountModel('b', 0.5);
    runtime.sync([model('a', 0), model('b', 0.5)]);
    const opts = { drivenModelIds: ['a'], excludedPairKeys: NO_EXCLUSION };
    expect(runtime.scanSample(opts)).not.toBeNull();

    runtime.reset();
    // 꺼져 있는 동안 모델이 멀리 리마운트됐다.
    mountModel('a', 50);
    expect(runtime.scanSample(opts)).toBeNull();
  });
});

describe('scanSample — 표시 고정(preferPairKey)', () => {
  it('같은 시각에 두 쌍이 겹치면 현재 띄우고 있는 쌍을 돌려준다', () => {
    // 구동 모델 m 하나가 좌우 두 장비와 동시에 겹치는 배치.
    mountModel('m', 0);
    mountModel('left', 0.5);
    mountModel('right', -0.5);
    runtime.sync([model('m', 0), model('left', 0.5), model('right', -0.5)]);

    const scan = (prefer?: string) =>
      runtime.scanSample({
        drivenModelIds: ['m'],
        excludedPairKeys: NO_EXCLUSION,
        preferPairKey: prefer,
      });

    const free = scan();
    expect(free).not.toBeNull();
    // 어느 쪽이 먼저 열거되든, 반대쪽을 지정하면 그쪽이 나와야 한다.
    const other = free?.key === 'left|m' ? 'm|right' : 'left|m';
    expect(scan(other)?.key).toBe(other);
    // 그리고 그 선택이 반복 호출에서 유지된다 — 번갈아 뜨지 않는다.
    for (let i = 0; i < 5; i += 1) expect(scan(other)?.key).toBe(other);
  });

  it('우선 쌍이 이 시각에 안 겹치면 다른 쌍을 돌려준다', () => {
    mountModel('m', 0);
    mountModel('near', 0.5);
    runtime.sync([model('m', 0), model('near', 0.5)]);
    const hit = runtime.scanSample({
      drivenModelIds: ['m'],
      excludedPairKeys: NO_EXCLUSION,
      preferPairKey: 'ghost|pair',
    });
    expect(hit?.key).toBe('m|near');
  });

  it('우선 쌍이 제외 목록에 있으면 무시된다', () => {
    mountModel('m', 0);
    mountModel('near', 0.5);
    runtime.sync([model('m', 0), model('near', 0.5)]);
    expect(
      runtime.scanSample({
        drivenModelIds: ['m'],
        excludedPairKeys: new Set(['m|near']),
        preferPairKey: 'm|near',
      }),
    ).toBeNull();
  });
});
