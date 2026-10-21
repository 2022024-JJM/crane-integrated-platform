import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  buildTagMappingIndex,
  collectSceneTagKeys,
  resolveFromIndex,
} from '../tag-mapping-index';

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return {
    maps: [],
    models: [
      {
        id: 'm1',
        equipName: 'A',
        path: '/models/a.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        rigId: 'rig-a',
        tagMappings: [
          {
            id: 'map-root',
            target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
            realtimeTagKey: 'C_1:z',
            virtualTagKey: 'V:z',
            scale: 0.1,
            offset: 66,
          },
          {
            id: 'map-luff',
            target: { kind: 'joint', jointId: 'luff' },
            realtimeTagKey: 'C_1:luff',
          },
          {
            id: 'map-driven',
            target: { kind: 'joint', jointId: 'upper' },
            realtimeTagKey: 'C_1:luff',
          },
          {
            id: 'map-ghost',
            target: { kind: 'joint', jointId: 'ghost' },
            realtimeTagKey: 'C_1:ghost',
          },
        ],
      },
      {
        id: 'm2',
        equipName: 'B',
        path: '/models/b.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        tagMappings: [
          {
            id: 'map-b',
            target: {
              kind: 'node',
              node: '[0]Arm',
              channel: 'rotation',
              axis: 'x',
            },
            realtimeTagKey: 'C_1:z',
          },
          {
            id: 'map-b-joint',
            target: { kind: 'joint', jointId: 'luff' },
            realtimeTagKey: 'C_1:no-rig',
          },
          {
            id: 'map-b-virtual',
            target: {
              kind: 'node',
              node: '[0]Arm',
              channel: 'rotation',
              axis: 'y',
            },
            virtualTagKey: 'V:arm',
          },
        ],
      },
    ],
    rigs: [
      {
        id: 'rig-a',
        name: 'A',
        modelPath: '/models/a.glb',
        joints: [
          { id: 'luff', node: '[0]Arm', type: 'hinge', axis: 'x' },
          { id: 'upper', node: '[0]Arm/[0]Hand', type: 'hinge', axis: 'x' },
        ],
        constraints: [
          {
            type: 'linear',
            id: 'l1',
            input: 'luff',
            output: 'upper',
            factor: 2,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildTagMappingIndex', () => {
  it('키 → 주소 목록. node 는 mapping id, joint 는 jointId 가 주소 슬롯', () => {
    const index = buildTagMappingIndex(scene(), 'realtime');
    expect(resolveFromIndex(index, 'C_1:z')).toEqual([
      { address: 'm1/map-root', scale: 0.1, offset: 66 },
      { address: 'm2/map-b', scale: 1, offset: 0 },
    ]);
    expect(resolveFromIndex(index, 'C_1:luff')).toEqual([
      { address: 'm1/luff', scale: 1, offset: 0 },
    ]);
  });

  it('활성 슬롯의 키만 인덱스에 든다 — 다른 슬롯 키로 온 값은 아무 데도 닿지 않는다', () => {
    const realtime = buildTagMappingIndex(scene(), 'realtime');
    expect(resolveFromIndex(realtime, 'V:z')).toEqual([]);
    expect(resolveFromIndex(realtime, 'V:arm')).toEqual([]);

    const virtual = buildTagMappingIndex(scene(), 'virtual');
    expect(resolveFromIndex(virtual, 'V:z')).toEqual([
      { address: 'm1/map-root', scale: 0.1, offset: 66 },
    ]);
    expect(resolveFromIndex(virtual, 'V:arm')).toEqual([
      { address: 'm2/map-b-virtual', scale: 1, offset: 0 },
    ]);
    // 실시간 키만 있는 맵핑은 가상 슬롯 인덱스에 없다.
    expect(resolveFromIndex(virtual, 'C_1:z')).toEqual([]);
    expect(resolveFromIndex(virtual, 'C_1:luff')).toEqual([]);
  });

  it('driven 관절·없는 관절·리그 없는 모델의 joint 맵핑은 제외한다', () => {
    const index = buildTagMappingIndex(scene(), 'realtime');
    expect(resolveFromIndex(index, 'C_1:ghost')).toEqual([]);
    expect(resolveFromIndex(index, 'C_1:no-rig')).toEqual([]);
  });

  it('빈 씬·null 은 빈 인덱스, 미지 키는 빈 배열(같은 참조)', () => {
    expect(buildTagMappingIndex(null, 'realtime').size).toBe(0);
    const index = buildTagMappingIndex(scene({ models: [] }), 'realtime');
    expect(index.size).toBe(0);
    expect(resolveFromIndex(index, 'x')).toBe(resolveFromIndex(index, 'y'));
  });
});

describe('collectSceneTagKeys', () => {
  it('활성 슬롯 기준, 등장 순·중복 제거', () => {
    expect(collectSceneTagKeys(scene(), 'realtime')).toEqual([
      'C_1:z',
      'C_1:luff',
      'C_1:ghost',
      'C_1:no-rig',
    ]);
    expect(collectSceneTagKeys(scene(), 'virtual')).toEqual(['V:z', 'V:arm']);
    expect(collectSceneTagKeys(null, 'realtime')).toEqual([]);
  });
});
