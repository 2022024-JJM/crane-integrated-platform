import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { SavedModelInfo } from '@crane/domain/3d';
import { rigValueStore } from '../rig-value-store';
import { buildCollisionRecord } from '../scene-collision-record';
import type { SceneCollisionHit } from '../scene-collision-runtime';

function model(id: string): SavedModelInfo {
  return {
    id,
    equipName: id.toUpperCase(),
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function hit(a: SavedModelInfo, b: SavedModelInfo): SceneCollisionHit {
  const mesh = () => new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  return {
    key: `${a.id}|${b.id}`,
    a: { modelId: a.id, model: a, mesh: mesh(), nodePath: '[0]Body' },
    b: { modelId: b.id, model: b, mesh: mesh(), nodePath: '' },
    contact: [1, 2, 3],
  };
}

afterEach(() => {
  rigValueStore.reset();
});

describe('buildCollisionRecord', () => {
  it('id 는 증가하고 hit 의 키·시각·접촉점·노드 참조(id·경로)를 옮긴다', () => {
    const h = hit(model('a'), model('b'));
    const r1 = buildCollisionRecord(h, 123);
    const r2 = buildCollisionRecord(h, 456);
    expect(r2.id).toBe(r1.id + 1);
    expect(r1.pairKey).toBe('a|b');
    expect(r1.at).toBe(123);
    expect(r1.contactPoint).toEqual([1, 2, 3]);
    expect(r1.contactPoint).not.toBe(h.contact);
    expect(r1.a).toEqual({ modelId: 'a', equipName: 'A', nodePath: '[0]Body' });
    expect(r1.b).toEqual({ modelId: 'b', equipName: 'B', nodePath: '' });
  });

  it('values 는 충돌 순간 씬 전체 자세의 스냅샷이며 이후 저장소가 바뀌어도 불변', () => {
    rigValueStore.set('a/boom', 42.5);
    rigValueStore.set('c/other', -1);
    const r = buildCollisionRecord(hit(model('a'), model('b')));
    expect(r.values).toEqual([
      ['a/boom', 42.5],
      ['c/other', -1],
    ]);
    rigValueStore.set('a/boom', 99);
    rigValueStore.reset();
    expect(r.values).toEqual([
      ['a/boom', 42.5],
      ['c/other', -1],
    ]);
  });

  it('값 저장소가 비어 있으면 values 도 빈 배열', () => {
    expect(buildCollisionRecord(hit(model('a'), model('b'))).values).toEqual(
      [],
    );
  });
});
