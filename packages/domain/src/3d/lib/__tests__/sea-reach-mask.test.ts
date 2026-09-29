import { describe, expect, it, vi } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  type Side,
} from 'three';
import { SEA_REACH_DRY, SEA_REACH_WET } from '../sea-reach-grid';
import {
  buildSeaReachMask,
  sampleSeaReachMask,
  type SeaReachBuildOptions,
  type SeaReachSource,
} from '../sea-reach-mask';

type Point = [number, number, number];

/** 칸 1m·여유 4m — 좌표를 손으로 따라갈 수 있게 작게 둔다. */
const OPTIONS: SeaReachBuildOptions = { cellSize: 1, margin: 4 };

function drain<T>(task: Generator<void, T>): { value: T; steps: number } {
  let steps = 0;
  for (;;) {
    const step = task.next();
    steps += 1;
    if (step.done) return { value: step.value, steps };
  }
}

function build(sources: SeaReachSource[], options = OPTIONS) {
  return drain(buildSeaReachMask(sources, options)).value;
}

/** 네 점(a→b→c→d)으로 사각형 메시. a,b,c 의 감는 방향이 앞면이다. */
function quad(a: Point, b: Point, c: Point, d: Point, side?: Side): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([...a, ...b, ...c, ...d]), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return new Mesh(geometry, new MeshBasicMaterial(side ? { side } : {}));
}

/** 위를 향한 수평 사각형. */
function floor(x0: number, z0: number, x1: number, z1: number, y: number) {
  return quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
}

/** 아래를 향한 수평 사각형(단면이면 위에서 컬링된다). */
function ceiling(x0: number, z0: number, x1: number, z1: number, y: number) {
  return quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
}

/** (x0,z0)–(x1,z1) 를 따라 선 두께 없는 수직 벽. */
function wall(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  bottom: number,
  top: number,
) {
  return quad([x0, bottom, z0], [x1, bottom, z1], [x1, top, z1], [x0, top, z0]);
}

/**
 * 야드(y=1, x·z ±20) 한가운데 +z 가장자리로 열린 도크(x ±4, z 0‥20, 바닥
 * y=-5). 도크 입구(z=20)는 두께 없는 게이트가 막는다.
 */
function yard({ gateTop = 1 as number | null } = {}): Group {
  const root = new Group();
  root.add(floor(-20, -20, -4, 20, 1));
  root.add(floor(4, -20, 20, 20, 1));
  root.add(floor(-4, -20, 4, 0, 1));
  root.add(floor(-4, 0, 4, 20, -5));
  root.add(wall(-4, 0, -4, 20, -5, 1));
  root.add(wall(4, 0, 4, 20, -5, 1));
  root.add(wall(-4, 0, 4, 0, -5, 1));
  if (gateTop !== null) root.add(wall(-4, 20, 4, 20, -5, gateTop));
  return root;
}

/** 야드 +z 쪽 바다 밑 해저(y=-8, z 20‥40). */
function seabed(): Group {
  const root = new Group();
  root.add(floor(-20, 20, 20, 40, -8));
  return root;
}

function scene(ground: Object3D, context: Object3D = seabed()) {
  return [
    { root: ground, bounds: true },
    { root: context, bounds: false },
  ];
}

const DOCK: [number, number] = [0.5, 10.5];
const SEABED: [number, number] = [0.5, 22.5];
const YARD: [number, number] = [-12.5, 0.5];

describe('buildSeaReachMask', () => {
  it('게이트로 막힌 도크는 마른 곳, 해저는 바다가 닿는 곳이다', () => {
    const mask = build(scene(yard()));
    expect(mask).not.toBeNull();
    expect(sampleSeaReachMask(mask!, ...DOCK)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, ...SEABED)).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, ...YARD)).toBe(SEA_REACH_DRY);
    // 지면 없는 열린 바다(격자 여유 안).
    expect(sampleSeaReachMask(mask!, -22.5, 0.5)).toBe(SEA_REACH_WET);
    // 도크 안쪽 벽에 붙은 바닥과 게이트 바로 안쪽도 마른 곳이다.
    expect(sampleSeaReachMask(mask!, -3.5, 10.5)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, 0.5, 19.5)).toBe(SEA_REACH_DRY);
  });

  it('게이트가 없으면 도크에 물이 든다', () => {
    const mask = build(scene(yard({ gateTop: null })));
    expect(sampleSeaReachMask(mask!, ...DOCK)).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, ...YARD)).toBe(SEA_REACH_DRY);
  });

  it('게이트 윗변이 수면과 같으면 막고, 수면 아래면 물이 넘는다', () => {
    const atSea = build(scene(yard({ gateTop: 0 })));
    expect(sampleSeaReachMask(atSea!, ...DOCK)).toBe(SEA_REACH_DRY);

    const below = build(scene(yard({ gateTop: -0.5 })));
    expect(sampleSeaReachMask(below!, ...DOCK)).toBe(SEA_REACH_WET);
  });

  it('seaLevel 옵션이 기준 높이를 바꾼다', () => {
    // 수면이 야드(y=1)보다 높으면 야드도 잠긴 지면이다.
    const mask = build(scene(yard()), { ...OPTIONS, seaLevel: 2 });
    expect(sampleSeaReachMask(mask!, ...YARD)).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, ...DOCK)).toBe(SEA_REACH_WET);
  });

  it('안벽 칸(물에 붙은 육지 가장자리)은 바다가 닿는 곳이다', () => {
    const mask = build(scene(yard()));
    // 야드 가장자리 x=-20 이 지나는 칸과 그 안쪽 칸.
    expect(sampleSeaReachMask(mask!, -19.5, 0.5)).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, -18.5, 0.5)).toBe(SEA_REACH_DRY);
  });

  it('격자 밖은 바다다', () => {
    const mask = build(scene(yard()));
    expect(sampleSeaReachMask(mask!, 0.5, 30.5)).toBe(255);
    expect(sampleSeaReachMask(mask!, -1000, -1000)).toBe(255);
  });

  it('격자 범위는 bounds 지도의 정점 범위 + 여유다', () => {
    const mask = build(scene(yard()));
    expect(mask).toMatchObject({ width: 48, height: 48 });
    const m = mask!.transform;
    expect(m[0] * -24 + m[2]).toBeCloseTo(0);
    expect(m[0] * 24 + m[2]).toBeCloseTo(1);
    expect(m[4] * -24 + m[5]).toBeCloseTo(0);
    expect(m[4] * 24 + m[5]).toBeCloseTo(1);
  });

  it('bounds 지도가 하나도 없으면 모든 지도가 범위를 정한다', () => {
    const mask = build([
      { root: yard(), bounds: false },
      { root: seabed(), bounds: false },
    ]);
    // z 가 -20‥40 으로 넓어진다.
    expect(mask).toMatchObject({ width: 48, height: 68 });
    expect(sampleSeaReachMask(mask!, 0.5, 30.5)).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, ...DOCK)).toBe(SEA_REACH_DRY);
  });

  it('회전한 지도는 월드 좌표로 판정한다', () => {
    const yaw = (30 * Math.PI) / 180;
    const ground = yard();
    const context = seabed();
    ground.rotation.y = yaw;
    context.rotation.y = yaw;
    const mask = build(scene(ground, context));
    const rotate = ([x, z]: [number, number]): [number, number] => [
      x * Math.cos(yaw) + z * Math.sin(yaw),
      -x * Math.sin(yaw) + z * Math.cos(yaw),
    ];
    expect(sampleSeaReachMask(mask!, ...rotate(DOCK))).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, ...rotate(SEABED))).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, ...rotate(YARD))).toBe(SEA_REACH_DRY);
    // 회전 전 자리의 도크 위치는 이제 야드 위다.
    expect(sampleSeaReachMask(mask!, 0.5, 15.5)).toBe(SEA_REACH_DRY);
  });

  it('옮기고 키운 지도도 월드 좌표로 판정한다', () => {
    const ground = yard();
    ground.position.set(100, -0.5, -50);
    ground.scale.set(2, 1, 2);
    const mask = build([{ root: ground, bounds: true }]);
    expect(sampleSeaReachMask(mask!, 100.5, -29.5)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, 76.5, -49.5)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, 58.5, -49.5)).toBe(SEA_REACH_WET);
  });

  it('거울상으로 놓인 지도도 윗면을 육지로 본다', () => {
    const ground = yard();
    ground.scale.set(-1, 1, 1);
    const mask = build(scene(ground));
    expect(sampleSeaReachMask(mask!, ...YARD)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, ...DOCK)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, ...SEABED)).toBe(SEA_REACH_WET);
  });

  it('아래를 향한 단면(지도에 딸려 온 바다 평면)은 바다를 막지 않는다', () => {
    const context = seabed();
    context.add(ceiling(-100, -100, 100, 100, 0.6));
    const mask = build(scene(yard(), context));
    expect(sampleSeaReachMask(mask!, ...SEABED)).toBe(SEA_REACH_WET);
    expect(sampleSeaReachMask(mask!, -22.5, 0.5)).toBe(SEA_REACH_WET);
  });

  it('같은 평면이 양면이면 위에서 보이므로 바다를 막는다', () => {
    const context = seabed();
    const plane = ceiling(-100, -100, 100, 100, 0.6);
    (plane.material as MeshBasicMaterial).side = DoubleSide;
    context.add(plane);
    const mask = build(scene(yard(), context));
    expect(sampleSeaReachMask(mask!, ...SEABED)).toBe(SEA_REACH_DRY);
  });

  it('LOD 사본(lod>0)은 읽지 않고, 숨겨진 LOD0 은 읽는다', () => {
    const context = seabed();
    const proxy = new Group();
    proxy.userData.lod = 1;
    proxy.add(floor(-20, 20, 20, 40, 5));
    context.add(proxy);
    expect(sampleSeaReachMask(build(scene(yard(), context))!, ...SEABED)).toBe(
      SEA_REACH_WET,
    );

    const hiddenLod0 = new Group();
    hiddenLod0.userData.lod = 0;
    hiddenLod0.visible = false;
    hiddenLod0.add(floor(-20, 20, 20, 40, 5));
    const far = seabed();
    far.add(hiddenLod0);
    expect(sampleSeaReachMask(build(scene(yard(), far))!, ...SEABED)).toBe(
      SEA_REACH_DRY,
    );
  });

  it('숨긴 노드(visible=false)는 읽지 않는다', () => {
    const context = seabed();
    const hidden = floor(-20, 20, 20, 40, 5);
    hidden.visible = false;
    context.add(hidden);
    expect(sampleSeaReachMask(build(scene(yard(), context))!, ...SEABED)).toBe(
      SEA_REACH_WET,
    );
  });

  it('인덱스 없는 지오메트리도 읽는다', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        // prettier-ignore
        new Float32Array([
          -10, 1, -10,  -10, 1, 10,  10, 1, 10,
          -10, 1, -10,   10, 1, 10,  10, 1, -10,
        ]),
        3,
      ),
    );
    const root = new Group();
    root.add(new Mesh(geometry, new MeshBasicMaterial()));
    const mask = build([{ root, bounds: true }]);
    expect(sampleSeaReachMask(mask!, 0.5, 0.5)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, -12.5, 0.5)).toBe(SEA_REACH_WET);
  });

  it('양자화(normalized Int16) 정점을 풀어서 읽는다', () => {
    const geometry = new BufferGeometry();
    const n = 32767;
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        // prettier-ignore
        new Int16Array([
          -n, n, -n,  -n, n, n,  n, n, n,  n, n, -n,
        ]),
        3,
        true,
      ),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.scale.set(10, 1, 10);
    const root = new Group();
    root.add(mesh);
    const mask = build([{ root, bounds: true }]);
    expect(mask).toMatchObject({ width: 28, height: 28 });
    expect(sampleSeaReachMask(mask!, 0.5, 0.5)).toBe(SEA_REACH_DRY);
  });

  it('유한하지 않은 정점이 섞여도 던지지 않고 그 삼각형만 건너뛴다', () => {
    // three 가 boundingBox 계산에서 NaN 을 콘솔에 알린다 — 출력만 막는다.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // 해저 위(y=5)에 놓인 깨진 사각형 — 찍혔다면 해저가 육지가 된다.
      const context = seabed();
      context.add(
        quad([Number.NaN, 5, 21], [-10, 5, 24], [Infinity, 5, 24], [10, 5, 21]),
      );
      const mask = build(scene(yard(), context));
      expect(mask).toMatchObject({ width: 48, height: 48 });
      expect(sampleSeaReachMask(mask!, ...DOCK)).toBe(SEA_REACH_DRY);
      expect(sampleSeaReachMask(mask!, ...SEABED)).toBe(SEA_REACH_WET);
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it('범위 지도의 유한하지 않은 정점은 격자 범위에 들어가지 않는다', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const ground = yard();
      ground.add(
        quad([Number.NaN, 5, 0], [0, 5, 10], [Infinity, 5, 10], [10, 5, 0]),
      );
      expect(build(scene(ground))).toMatchObject({ width: 48, height: 48 });
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });

  it('maxCells 를 넘는 범위는 칸을 키워 격자 크기를 지킨다', () => {
    const mask = build(scene(yard()), { ...OPTIONS, maxCells: 8 });
    expect(mask).toMatchObject({ width: 8, height: 8 });
    expect(mask!.data).toHaveLength(64);
    expect(sampleSeaReachMask(mask!, ...YARD)).toBe(SEA_REACH_DRY);
  });

  it.each([
    ['지도가 없는 씬', () => []],
    ['메시가 없는 루트', () => [{ root: new Group(), bounds: true }]],
    [
      '정점이 전부 한 점인 지도(범위가 서지 않는다)',
      () => {
        const root = new Group();
        root.add(quad([1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]));
        return [{ root, bounds: true }];
      },
    ],
  ])('%s 은 null 이다 — 막는 지형이 없다', (_label, make) => {
    expect(build(make(), { ...OPTIONS, margin: 0 })).toBeNull();
  });

  it('여러 번 나눠 돌고, 끝까지 돌리면 마스크를 돌려준다', () => {
    const { value, steps } = drain(buildSeaReachMask(scene(yard()), OPTIONS));
    expect(steps).toBeGreaterThan(3);
    expect(value?.data).toHaveLength(48 * 48);
  });

  it('같은 입력은 같은 마스크를 만든다', () => {
    const first = build(scene(yard()));
    const second = build(scene(yard()));
    expect(second!.data).toEqual(first!.data);
    expect(second!.transform).toEqual(first!.transform);
  });

  it('부모 행렬이 갱신되지 않은 루트도 현재 배치로 읽는다', () => {
    const parent = new Group();
    const ground = yard();
    parent.add(ground);
    parent.position.set(50, 0, 0);
    // updateMatrixWorld 를 부르지 않은 상태.
    const mask = build([{ root: ground, bounds: true }]);
    expect(sampleSeaReachMask(mask!, 50.5, 10.5)).toBe(SEA_REACH_DRY);
    expect(sampleSeaReachMask(mask!, 37.5, 0.5)).toBe(SEA_REACH_DRY);
  });
});
