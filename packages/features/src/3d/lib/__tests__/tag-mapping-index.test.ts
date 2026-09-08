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
            tagKey: 'C_1:z',
            scale: 0.1,
            offset: 66,
          },
          {
            id: 'map-luff',
            target: { kind: 'joint', jointId: 'luff' },
            tagKey: 'C_1:luff',
          },
          {
            id: 'map-driven',
            target: { kind: 'joint', jointId: 'upper' },
            tagKey: 'C_1:luff',
          },
          {
            id: 'map-ghost',
            target: { kind: 'joint', jointId: 'ghost' },
            tagKey: 'C_1:ghost',
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
            target: { kind: 'node', node: '[0]Arm', channel: 'rotation', axis: 'x' },
            tagKey: 'C_1:z',
          },
          {
            id: 'map-b-joint',
            target: { kind: 'joint', jointId: 'luff' },
            tagKey: 'C_1:no-rig',
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
          { type: 'linear', id: 'l1', input: 'luff', output: 'upper', factor: 2 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildTagMappingIndex', () => {
  it('키 → 주소 목록. node 는 mapping id, joint 는 jointId 가 주소 슬롯', () => {
    const index = buildTagMappingIndex(scene());
    expect(resolveFromIndex(index, 'C_1:z')).toEqual([
      { address: 'm1/map-root', scale: 0.1, offset: 66 },
      { address: 'm2/map-b', scale: 1, offset: 0 },
    ]);
    expect(resolveFromIndex(index, 'C_1:luff')).toEqual([
      { address: 'm1/luff', scale: 1, offset: 0 },
    ]);
  });

  it('driven 관절·없는 관절·리그 없는 모델의 joint 맵핑은 제외한다', () => {
    const index = buildTagMappingIndex(scene());
    expect(resolveFromIndex(index, 'C_1:ghost')).toEqual([]);
    expect(resolveFromIndex(index, 'C_1:no-rig')).toEqual([]);
  });

  it('빈 씬·null 은 빈 인덱스, 미지 키는 빈 배열(같은 참조)', () => {
    expect(buildTagMappingIndex(null).size).toBe(0);
    const index = buildTagMappingIndex(scene({ models: [] }));
    expect(index.size).toBe(0);
    expect(resolveFromIndex(index, 'x')).toBe(resolveFromIndex(index, 'y'));
  });
});

describe('collectSceneTagKeys', () => {
  it('등장 순·중복 제거', () => {
    expect(collectSceneTagKeys(scene())).toEqual([
      'C_1:z',
      'C_1:luff',
      'C_1:ghost',
      'C_1:no-rig',
    ]);
    expect(collectSceneTagKeys(null)).toEqual([]);
  });
});
