import { afterEach, describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { SavedModelInfo } from '@crane/domain/3d';
import { rigLiveReadouts } from '../rig-live-readouts';
import { buildCollisionReport } from '../scene-collision-report';
import type { SceneCollisionHit } from '../scene-collision-runtime';
import { publishTagValue, tagLiveValues } from '../tag-value-bus';

function model(id: string, tagKeys: string[] = []): SavedModelInfo {
  return {
    id,
    equipName: id.toUpperCase(),
    path: '/m.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    tagMappings: tagKeys.map((tagKey, i) => ({
      id: `m${i}`,
      tagKey,
      target: { kind: 'node', node: '', channel: 'position', axis: 'x' },
      offset: 0,
      scale: 1,
    })),
  } as SavedModelInfo;
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
  tagLiveValues.clear();
  rigLiveReadouts.clear();
});

describe('buildCollisionReport', () => {
  it('id 는 증가하고 hit 의 키·접촉점·노드를 옮긴다(접촉점은 새 배열)', () => {
    const h = hit(model('a'), model('b'));
    const r1 = buildCollisionReport(h, 123);
    const r2 = buildCollisionReport(h, 456);
    expect(r2.id).toBe(r1.id + 1);
    expect(r1.pairKey).toBe('a|b');
    expect(r1.detectedAt).toBe(123);
    expect(r1.contactPoint).toEqual([1, 2, 3]);
    expect(r1.contactPoint).not.toBe(h.contact);
    expect(r1.a.node).toBe(h.a.mesh);
    expect(r1.b.nodePath).toBe('');
    expect(r1.a.equipName).toBe('A');
  });

  it('태그값은 충돌 순간 버스 값의 스냅샷이고, 없는 키는 null, 중복 키는 한 번', () => {
    publishTagValue('C1:boom', 42.5);
    const r = buildCollisionReport(
      hit(model('a', ['C1:boom', 'C1:boom', 'C1:trolley']), model('b')),
    );
    expect(r.a.tags).toEqual([
      { tagKey: 'C1:boom', value: 42.5 },
      { tagKey: 'C1:trolley', value: null },
    ]);
    expect(r.b.tags).toEqual([]);
    publishTagValue('C1:boom', 99);
    expect(r.a.tags[0].value).toBe(42.5);
  });

  it('관절값은 rigLiveReadouts 스냅샷이며, readout 이 없으면 빈 배열', () => {
    rigLiveReadouts.set('a', {
      unresolvedJoints: [],
      jointValues: new Map([
        ['boom', 12],
        ['hook', -3],
      ]),
      unresolvedMappings: [],
      mappingValues: new Map(),
    });
    const r = buildCollisionReport(hit(model('a'), model('b')));
    expect(r.a.jointValues).toEqual([
      { jointId: 'boom', value: 12 },
      { jointId: 'hook', value: -3 },
    ]);
    expect(r.b.jointValues).toEqual([]);
  });
});
