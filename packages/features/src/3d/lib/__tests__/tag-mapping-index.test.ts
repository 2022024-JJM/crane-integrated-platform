import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  buildTagMappingIndex,
  collectSceneTagKeys,
  resolveFromIndex,
} from '../tag-mapping-index';

/**
 * m1·m2 는 같은 크레인(C_1), m2 의 맵핑 하나는 다른 크레인(C_2)을 덮어쓰고,
 * m3 는 craneId 가 없다 — 키는 `${craneId}.${code}` 로 조립된다.
 */
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
        craneId: 'C_1',
        rigId: 'rig-a',
        tagMappings: [
          {
            id: 'map-root',
            target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
            code: 'z',
            scale: 0.1,
            offset: 66,
          },
          {
            id: 'map-luff',
            target: { kind: 'joint', jointId: 'luff' },
            code: 'luff',
          },
          {
            id: 'map-driven',
            target: { kind: 'joint', jointId: 'upper' },
            code: 'luff',
          },
          {
            id: 'map-ghost',
            target: { kind: 'joint', jointId: 'ghost' },
            code: 'ghost',
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
        craneId: 'C_1',
        tagMappings: [
          {
            id: 'map-b',
            target: {
              kind: 'node',
              node: '[0]Arm',
              channel: 'rotation',
              axis: 'x',
            },
            code: 'z',
          },
          {
            id: 'map-b-joint',
            target: { kind: 'joint', jointId: 'luff' },
            code: 'norig',
          },
          {
            id: 'map-b-other',
            target: {
              kind: 'node',
              node: '[0]Arm',
              channel: 'rotation',
              axis: 'y',
            },
            code: 'arm',
            craneId: 'C_2',
          },
        ],
      },
      {
        id: 'm3',
        equipName: 'C',
        path: '/models/c.glb',
        opacity: 1,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        tagMappings: [
          {
            id: 'map-c',
            target: { kind: 'node', node: '', channel: 'position', axis: 'x' },
            code: 'x',
          },
        ],
      },
    ],
    rigs: [
      {
        id: 'rig-a',
        name: 'A',
        assetId: 'a',
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
    const index = buildTagMappingIndex(scene());
    expect(resolveFromIndex(index, 'C_1.z')).toEqual([
      { address: 'm1/map-root', scale: 0.1, offset: 66 },
      { address: 'm2/map-b', scale: 1, offset: 0 },
    ]);
    expect(resolveFromIndex(index, 'C_1.luff')).toEqual([
      { address: 'm1/luff', scale: 1, offset: 0 },
    ]);
  });

  it('craneId 없는 모델의 맵핑은 인덱스에 없다 — 어떤 키로 온 값도 닿지 않는다', () => {
    const index = buildTagMappingIndex(scene());
    expect(resolveFromIndex(index, 'x')).toEqual([]);
    expect(resolveFromIndex(index, '.x')).toEqual([]);
    const addresses = [...index.values()].flat().map((t) => t.address);
    expect(addresses).not.toContain('m3/map-c');
  });

  it('맵핑 자체의 craneId 는 모델 craneId 보다 앞선다', () => {
    const index = buildTagMappingIndex(scene());
    expect(resolveFromIndex(index, 'C_2.arm')).toEqual([
      { address: 'm2/map-b-other', scale: 1, offset: 0 },
    ]);
    expect(resolveFromIndex(index, 'C_1.arm')).toEqual([]);
  });

  it('driven 관절·없는 관절·리그 없는 모델의 joint 맵핑은 제외한다', () => {
    const index = buildTagMappingIndex(scene());
    expect(resolveFromIndex(index, 'C_1.ghost')).toEqual([]);
    expect(resolveFromIndex(index, 'C_1.norig')).toEqual([]);
  });

  it('빈 씬·null 은 빈 인덱스, 미지 키는 빈 배열(같은 참조)', () => {
    expect(buildTagMappingIndex(null).size).toBe(0);
    const index = buildTagMappingIndex(scene({ models: [] }));
    expect(index.size).toBe(0);
    expect(resolveFromIndex(index, 'x')).toBe(resolveFromIndex(index, 'y'));
  });
});

describe('collectSceneTagKeys', () => {
  it('등장 순·중복 제거, craneId 없는 모델의 맵핑은 빠진다', () => {
    expect(collectSceneTagKeys(scene())).toEqual([
      'C_1.z',
      'C_1.luff',
      'C_1.ghost',
      'C_1.norig',
      'C_2.arm',
    ]);
    expect(collectSceneTagKeys(null)).toEqual([]);
  });
});
