import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import {
  modelObjectRegistry,
  type SavedModelInfo,
  type SavedModelZone,
} from '@crane/domain/3d';
import { SceneZoneRuntime, type ZoneTransition } from '../scene-zone-runtime';
import { ZONE_BVH_RETRY_MS, zoneExitMargin } from '../../lib/scene-zones';

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

/** 모델 = root Group > Body(Mesh 1×1×1). 지오메트리는 모델마다 새로 만든다. */
function mountModel(
  id: string,
  x: number,
  options: { bvh?: boolean; z?: number } = {},
) {
  const root = new Group();
  root.name = id;
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  body.name = 'Body';
  root.add(body);
  root.position.set(x, 0, options.z ?? 0);
  root.updateMatrixWorld(true);
  if (options.bvh !== false) {
    (body.geometry as BvhGeometry).boundsTree = new MeshBVH(body.geometry);
  }
  modelObjectRegistry.register(id, root);
  return { root, body };
}

function zone(
  id: string,
  radius: number,
  extra: Partial<SavedModelZone> = {},
): SavedModelZone {
  return { id, name: id.toUpperCase(), color: '#38bdf8', radius, ...extra };
}

function model(
  id: string,
  x = 0,
  zones?: SavedModelZone[],
  extra: Partial<SavedModelInfo> = {},
): SavedModelInfo {
  const info: SavedModelInfo = {
    id,
    equipName: id.toUpperCase(),
    path: `/models/${id}.glb`,
    opacity: 1,
    position: [x, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    ...extra,
  };
  if (zones) info.zones = zones;
  return info;
}

function moveTo(root: Object3D, x: number, z = 0) {
  root.position.set(x, 0, z);
  root.updateMatrixWorld(true);
}

let clockNow = 0;
const clock = () => clockNow;

function makeRuntime(customClock: () => number = clock) {
  return new SceneZoneRuntime(customClock);
}

function kinds(transitions: readonly ZoneTransition[]) {
  return transitions.map((t) => `${t.kind}:${t.zoneKey}<${t.intruderId}`);
}

beforeEach(() => {
  clockNow = 0;
  modelObjectRegistry.clear();
});

afterEach(() => {
  modelObjectRegistry.clear();
});

describe('SceneZoneRuntime — 기본 흐름', () => {
  it('arm 전 tick 은 아무것도 하지 않는다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 1);
    rt.sync([model('a', 0, [zone('z', 5)]), model('b', 1)]);
    const res = rt.tick(0, 100);
    expect(res.transitions).toEqual([]);
    expect(res.moved).toBe(false);
    expect(rt.isIntruded('a#z')).toBe(false);
  });

  it('밖에 있던 모델이 들어오면 enter 한 번, 같은 자세면 다음 tick 은 검사 0', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    const b = mountModel('b', 5);
    rt.sync([model('a', 0, [zone('z', 2)]), model('b', 5)]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#z')).toBe(false);

    moveTo(b.root, 2.4); // 큐브 앞면 x=1.9 < 2
    const res = rt.tick(10, 100);
    expect(res.moved).toBe(true);
    expect(kinds(res.transitions)).toEqual(['enter:a#z<b']);
    const t = res.transitions[0];
    expect(t.intruderKind).toBe('model');
    expect(t.owner.id).toBe('a');
    expect(t.zone.id).toBe('z');
    expect(t.intruder.id).toBe('b');
    expect(rt.isIntruded('a#z')).toBe(true);
    expect([...(rt.intrudersOf('a#z') ?? [])]).toEqual(['b']);

    const quiet = rt.tick(20, 100);
    expect(quiet.transitions).toEqual([]);
    expect(quiet.moved).toBe(false);
    expect(rt.lastTickTests).toBe(0);
  });

  it('히스테리시스: 이탈 반경 정확값은 유지, 그 밖이면 exit, 재진입은 r 이하', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    const b = mountModel('b', 2.4);
    rt.sync([model('a', 0, [zone('z', 2)]), model('b', 2.4)]);
    rt.arm();
    expect(kinds(rt.tick(0, 100).transitions)).toEqual(['enter:a#z<b']);

    const exitRadius = 2 + zoneExitMargin(2); // 2.06
    expect(exitRadius).toBeCloseTo(2.06);
    moveTo(b.root, exitRadius + 0.5); // 앞면 x = 2.06 — 경계 정확값
    expect(rt.tick(10, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#z')).toBe(true);

    moveTo(b.root, exitRadius + 0.5 + 0.0001);
    expect(kinds(rt.tick(20, 100).transitions)).toEqual(['exit:a#z<b']);
    expect(rt.isIntruded('a#z')).toBe(false);

    moveTo(b.root, 2.55); // 앞면 2.05 — 진입 반경 2 보다 멀어 아직 밖
    expect(rt.tick(30, 100).transitions).toEqual([]);
    moveTo(b.root, 2.5); // 앞면 2.0 — 정확값 진입
    expect(kinds(rt.tick(40, 100).transitions)).toEqual(['enter:a#z<b']);
  });

  it('소유 모델은 자기 영역을 침범하지 않고, 같은 모델의 영역끼리도 보지 않는다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 50);
    rt.sync([model('a', 0, [zone('z1', 5), zone('z2', 3)]), model('b', 50)]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#z1')).toBe(false);
    expect(rt.isIntruded('a#z2')).toBe(false);
  });

  it('영역이 하나도 없는 씬은 tick 이 검사 없이 끝난다', () => {
    const rt = makeRuntime();
    const a = mountModel('a', 0);
    mountModel('b', 0.2);
    rt.sync([model('a'), model('b', 0.2)]);
    rt.arm();
    moveTo(a.root, 0.1);
    const res = rt.tick(0, 100);
    expect(res.transitions).toEqual([]);
    expect(res.moved).toBe(false);
    expect(rt.lastTickTests).toBe(0);
  });
});

describe('SceneZoneRuntime — registry·BVH', () => {
  it('registry 에 없는 모델은 건너뛰고, 등록되면 다음 tick 에 검사한다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    rt.sync([model('a', 0, [zone('z', 2)]), model('b', 1)]);
    rt.arm();
    expect(() => rt.tick(0, 100)).not.toThrow();
    expect(rt.isIntruded('a#z')).toBe(false);

    mountModel('b', 1);
    expect(kinds(rt.tick(10, 100).transitions)).toEqual(['enter:a#z<b']);
  });

  it('BVH 가 없으면 상태를 바꾸지 않고, 재시도 시각 뒤 BVH 가 생기면 enter', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    const b = mountModel('b', 1, { bvh: false });
    rt.sync([model('a', 0, [zone('z', 2)]), model('b', 1)]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#z')).toBe(false);
    // 재시도 전엔 BVH 가 있어도 보지 않는다.
    (b.body.geometry as BvhGeometry).boundsTree = new MeshBVH(b.body.geometry);
    expect(rt.tick(ZONE_BVH_RETRY_MS - 1, 100).transitions).toEqual([]);
    expect(kinds(rt.tick(ZONE_BVH_RETRY_MS, 100).transitions)).toEqual([
      'enter:a#z<b',
    ]);
  });

  it('시간 예산을 넘기면 남은 job 은 다음 tick 으로 이월되고 전이는 잃지 않는다', () => {
    // clock 호출마다 10ms 가 흐른다 — job 사이 검사에서 예산(5ms)을 바로 넘긴다.
    const rt = makeRuntime(() => {
      const v = clockNow;
      clockNow += 10;
      return v;
    });
    mountModel('a', 0);
    mountModel('b', 1);
    mountModel('c', -1);
    mountModel('d', 0, { z: 1 });
    rt.sync([
      model('a', 0, [zone('z', 3)]),
      model('b', 1),
      model('c', -1),
      model('d', 0),
    ]);
    rt.arm();
    const all: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = rt.tick(i, 5);
      expect(rt.lastTickTests).toBe(1);
      all.push(...kinds(res.transitions));
    }
    expect(all.sort()).toEqual(['enter:a#z<b', 'enter:a#z<c', 'enter:a#z<d']);
    expect(rt.tick(10, 5).transitions).toEqual([]);
  });
});

describe('SceneZoneRuntime — 영역 ↔ 영역', () => {
  it('중심 거리 ≤ r1+r2 면 한 번 enter(a 쪽), 양쪽 링이 모두 침범 상태', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    const b = mountModel('b', 12);
    rt.sync([model('a', 0, [zone('za', 5)]), model('b', 12, [zone('zb', 5)])]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);

    moveTo(b.root, 9);
    const res = rt.tick(10, 100);
    expect(kinds(res.transitions)).toEqual(['enter:a#za<b#zb']);
    expect(res.transitions[0].intruderKind).toBe('zone');
    expect(res.transitions[0].intruderZone?.id).toBe('zb');
    expect(res.transitions[0].intruder.id).toBe('b');
    expect(rt.isIntruded('a#za')).toBe(true);
    expect(rt.isIntruded('b#zb')).toBe(true);

    // 이탈 히스테리시스: 10 + max(0.15, 0.15) = 10.15
    moveTo(b.root, 10.1);
    expect(rt.tick(20, 100).transitions).toEqual([]);
    moveTo(b.root, 10.2);
    expect(kinds(rt.tick(30, 100).transitions)).toEqual(['exit:a#za<b#zb']);
    expect(rt.isIntruded('a#za')).toBe(false);
    expect(rt.isIntruded('b#zb')).toBe(false);
  });
});

describe('SceneZoneRuntime — sync·항목 재생성', () => {
  it('같은 참조 sync 는 상태를 건드리지 않고, 반경을 키운 새 참조는 enter 한 번', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 7);
    const a = model('a', 0, [zone('z', 2)]);
    const b = model('b', 7);
    rt.sync([a, b]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);

    rt.sync([a, b]);
    expect(rt.tick(10, 100).transitions).toEqual([]);

    rt.sync([model('a', 0, [zone('z', 10)]), b]);
    expect(kinds(rt.tick(20, 100).transitions)).toEqual(['enter:a#z<b']);
    // 이름만 바꾼 새 참조 — 이미 안이라 전이 없음(inside 유지).
    rt.sync([model('a', 0, [zone('z', 10, { name: 'renamed' })]), b]);
    expect(rt.tick(30, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#z')).toBe(true);
    // 반경을 줄인 새 참조 — 나간 것으로 판정된다.
    rt.sync([model('a', 0, [zone('z', 2)]), b]);
    expect(kinds(rt.tick(40, 100).transitions)).toEqual(['exit:a#z<b']);
  });

  it('침범 중 영역이 삭제되면 합성 exit 가 나오고 상태가 풀린다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 1);
    const b = model('b', 1);
    rt.sync([model('a', 0, [zone('z', 2)]), b]);
    rt.arm();
    expect(kinds(rt.tick(0, 100).transitions)).toEqual(['enter:a#z<b']);

    rt.sync([model('a', 0), b]);
    const res = rt.tick(10, 100);
    expect(kinds(res.transitions)).toEqual(['exit:a#z<b']);
    expect(res.transitions[0].zone.id).toBe('z');
    expect(rt.isIntruded('a#z')).toBe(false);
    expect(rt.tick(20, 100).transitions).toEqual([]);
  });

  it('침범 중 모델이 삭제되면 속했던 영역마다 exit', () => {
    const rt = makeRuntime();
    // a(z=0)·c(z=5) 의 영역(r=3)은 겹치지만 큐브는 서로의 영역 밖, b(z=2.5)
    // 큐브는 두 영역 모두에 들어 있다.
    mountModel('a', 0);
    mountModel('c', 0, { z: 5 });
    mountModel('b', 0, { z: 2.5 });
    const a = model('a', 0, [zone('za', 3)]);
    const c = model('c', 0, [zone('zc', 3)]);
    rt.sync([a, c, model('b', 0)]);
    rt.arm();
    const first = kinds(rt.tick(0, 100).transitions).sort();
    expect(first).toEqual(['enter:a#za<b', 'enter:a#za<c#zc', 'enter:c#zc<b']);

    rt.sync([a, c]);
    modelObjectRegistry.unregister('b');
    const res = kinds(rt.tick(10, 100).transitions).sort();
    expect(res).toEqual(['exit:a#za<b', 'exit:c#zc<b']);
    expect([...(rt.intrudersOf('a#za') ?? [])]).toEqual(['c#zc']);
  });

  it('영역↔영역 침범 중 한쪽 영역이 삭제되면 exit 한 번, 양쪽 상태 해제', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 9);
    const b = model('b', 9, [zone('zb', 5)]);
    rt.sync([model('a', 0, [zone('za', 5)]), b]);
    rt.arm();
    expect(kinds(rt.tick(0, 100).transitions)).toEqual(['enter:a#za<b#zb']);

    rt.sync([model('a', 0), b]);
    expect(kinds(rt.tick(10, 100).transitions)).toEqual(['exit:a#za<b#zb']);
    expect(rt.isIntruded('b#zb')).toBe(false);
  });

  it('무효 반경 영역은 job 을 만들지 않고, 중복 id 는 첫 항목만 쓴다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 5);
    rt.sync([
      model('a', 0, [
        zone('bad', 0),
        zone('nan', Number.NaN),
        zone('z', 2),
        zone('z', 100),
      ]),
      model('b', 5),
    ]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#bad')).toBe(false);
    expect(rt.isIntruded('a#z')).toBe(false);
  });

  it('zoneExempt 모델은 침범자가 되지 않고, 침범 중 제외로 바뀌면 합성 exit', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 1);
    mountModel('c', 0, { z: 1 });
    const a = model('a', 0, [zone('z', 2)]);
    rt.sync([a, model('b', 1), model('c', 0, undefined, { zoneExempt: true })]);
    rt.arm();
    expect(kinds(rt.tick(0, 100).transitions)).toEqual(['enter:a#z<b']);

    rt.sync([a, model('b', 1, undefined, { zoneExempt: true }), model('c')]);
    const res = kinds(rt.tick(10, 100).transitions).sort();
    expect(res).toEqual(['enter:a#z<c', 'exit:a#z<b']);
    expect([...(rt.intrudersOf('a#z') ?? [])]).toEqual(['c']);
  });

  it('제외 모델의 자기 영역도 감지하지 않는다(양방향 제외)', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 1);
    rt.sync([
      model('a', 0, [zone('z', 2)], { zoneExempt: true }),
      model('b', 1),
    ]);
    rt.arm();
    expect(rt.tick(0, 100).transitions).toEqual([]);
    expect(rt.isIntruded('a#z')).toBe(false);
    expect(rt.lastTickTests).toBe(0);
  });

  it('자기 영역이 침범 중인 모델을 제외로 바꾸면 그 침범자들도 exit', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 1);
    mountModel('c', -1);
    const b = model('b', 1);
    const c = model('c', -1);
    rt.sync([model('a', 0, [zone('z', 2)]), b, c]);
    rt.arm();
    expect(kinds(rt.tick(0, 100).transitions).sort()).toEqual([
      'enter:a#z<b',
      'enter:a#z<c',
    ]);

    rt.sync([model('a', 0, [zone('z', 2)], { zoneExempt: true }), b, c]);
    expect(kinds(rt.tick(10, 100).transitions).sort()).toEqual([
      'exit:a#z<b',
      'exit:a#z<c',
    ]);
    expect(rt.isIntruded('a#z')).toBe(false);

    // 제외를 풀면 다시 감지한다.
    rt.sync([model('a', 0, [zone('z', 2)]), b, c]);
    expect(kinds(rt.tick(20, 100).transitions).sort()).toEqual([
      'enter:a#z<b',
      'enter:a#z<c',
    ]);
  });

  it('영역↔영역 침범 중 한쪽 소유 모델이 제외되면 exit 한 번, 양쪽 해제', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 9);
    const a = model('a', 0, [zone('za', 5)]);
    rt.sync([a, model('b', 9, [zone('zb', 5)])]);
    rt.arm();
    expect(kinds(rt.tick(0, 100).transitions)).toEqual(['enter:a#za<b#zb']);

    rt.sync([a, model('b', 9, [zone('zb', 5)], { zoneExempt: true })]);
    expect(kinds(rt.tick(10, 100).transitions)).toEqual(['exit:a#za<b#zb']);
    expect(rt.isIntruded('a#za')).toBe(false);
    expect(rt.isIntruded('b#zb')).toBe(false);
  });

  it('disarm 은 상태를 비우고 tick 을 멈춘다', () => {
    const rt = makeRuntime();
    mountModel('a', 0);
    mountModel('b', 1);
    rt.sync([model('a', 0, [zone('z', 2)]), model('b', 1)]);
    rt.arm();
    rt.tick(0, 100);
    expect(rt.isIntruded('a#z')).toBe(true);
    rt.disarm();
    expect(rt.isArmed).toBe(false);
    expect(rt.isIntruded('a#z')).toBe(false);
    expect(rt.tick(10, 100).transitions).toEqual([]);
  });
});
