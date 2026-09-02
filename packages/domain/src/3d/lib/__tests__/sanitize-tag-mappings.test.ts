import { describe, expect, it } from 'vitest';
import {
  convertLegacyRigBindings,
  convertLegacyValueMapList,
  resolveModelTagMappings,
  sanitizeTagMappings,
} from '../sanitize-tag-mappings';
import type { RigDefinition } from '../../model/rig-types';
import type { TagMapping } from '../../model/tag-mapping-types';

const rig: RigDefinition = {
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
};

function node(
  id: string,
  overrides: Partial<TagMapping> & { node?: string; axis?: 'x' | 'y' | 'z' } = {},
): TagMapping {
  const { node: path = '', axis = 'z', ...rest } = overrides;
  return {
    id,
    target: { kind: 'node', node: path, channel: 'position', axis },
    tagKey: 'C_1:pos',
    ...rest,
  };
}

describe('sanitizeTagMappings', () => {
  it('배열이 아니면 undefined, 비면 undefined(필드 생략)', () => {
    expect(sanitizeTagMappings(undefined)).toBeUndefined();
    expect(sanitizeTagMappings('x')).toBeUndefined();
    expect(sanitizeTagMappings([])).toBeUndefined();
    expect(sanitizeTagMappings([null, 'x', {}])).toBeUndefined();
  });

  it('유효 항목은 tagKey trim·scale/offset 유한수만 살려 통과한다', () => {
    expect(
      sanitizeTagMappings([
        node('m1', { tagKey: ' C_1:z ', scale: 0.1, offset: NaN }),
      ]),
    ).toEqual([node('m1', { tagKey: 'C_1:z', scale: 0.1 })]);
  });

  it('id 없음·중복, 빈 tagKey, 깨진 target 은 개별로 버린다', () => {
    const out = sanitizeTagMappings([
      node('m1'),
      node('m1', { axis: 'x' }), // id 중복
      { ...node('m2', { axis: 'y' }), id: '' },
      node('m3', { axis: 'x', tagKey: '   ' }),
      { id: 'm4', target: { kind: 'node', node: '', channel: 'spin', axis: 'x' }, tagKey: 'k' },
      { id: 'm5', target: { kind: 'node', node: '', channel: 'scale', axis: 'w' }, tagKey: 'k' },
      { id: 'm6', target: { kind: 'node', node: 3, channel: 'scale', axis: 'x' }, tagKey: 'k' },
      { id: 'm7', target: { kind: 'ghost' }, tagKey: 'k' },
      { id: 'm8', target: null, tagKey: 'k' },
    ]);
    expect(out?.map((m) => m.id)).toEqual(['m1']);
  });

  it('같은 대상(노드·채널·축)은 첫 항목만 남긴다(first-wins), 다른 축은 공존', () => {
    const out = sanitizeTagMappings([
      node('first', { tagKey: 'a' }),
      node('second', { tagKey: 'b' }),
      node('other-axis', { axis: 'x', tagKey: 'c' }),
    ]);
    expect(out?.map((m) => m.id)).toEqual(['first', 'other-axis']);
  });

  it('같은 태그가 여러 대상에 붙는 것(팬아웃)은 허용', () => {
    const out = sanitizeTagMappings([
      node('m1', { axis: 'x' }),
      node('m2', { axis: 'y' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('joint 대상: 리그 없음·없는 관절·driven 관절은 버리고, 중복 관절은 첫 항목', () => {
    const j = (id: string, jointId: string, tagKey = 'k'): TagMapping => ({
      id,
      target: { kind: 'joint', jointId },
      tagKey,
    });
    expect(sanitizeTagMappings([j('a', 'luff')])).toBeUndefined();
    expect(
      sanitizeTagMappings([j('a', 'luff'), j('b', 'ghost'), j('c', 'upper'), j('d', 'luff', 'dup')], { rig }),
    ).toEqual([j('a', 'luff')]);
    expect(sanitizeTagMappings([{ id: 'x', target: { kind: 'joint', jointId: '' }, tagKey: 'k' }], { rig })).toBeUndefined();
  });
});

describe('convertLegacyValueMapList', () => {
  const placement = {
    position: [10, 0, 5] as [number, number, number],
    rotation: [0, 30, 0] as [number, number, number],
    scale: [2, 2, 2] as [number, number, number],
  };

  it('PZ offset 은 배치 위치를 빼서 rest-Δ 로 옮긴다 (dock-in 형태)', () => {
    expect(
      convertLegacyValueMapList(
        [{ type: 'PZ', key: 'C_171:tl_distance', scale: 0.1, offset: 71 }],
        placement,
      ),
    ).toEqual([
      {
        id: 'legacy-pz',
        target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        tagKey: 'C_171:tl_distance',
        scale: 0.1,
        offset: 66,
      },
    ]);
  });

  it('변환 전후 좌표가 같다: 옛 world = offset + v·scale, 새 world = rest + offset′ + v·scale', () => {
    const [m] = convertLegacyValueMapList(
      [{ type: 'PZ', key: 'k', scale: 0.1, offset: 71 }],
      placement,
    );
    const v = 118.3;
    const oldWorld = 71 + v * 0.1;
    const newWorld = placement.position[2] + (m.offset ?? 0) + v * (m.scale ?? 1);
    expect(newWorld).toBeCloseTo(oldWorld, 10);
  });

  it('회전·크기는 offset 이 없었으므로 −rest 가 offset′, rest 0 이면 필드 생략', () => {
    expect(
      convertLegacyValueMapList(
        [
          { type: 'RY', key: 'r' },
          { type: 'RX', key: 'rx', offset: 5 },
          { type: 'SX', key: 's' },
        ],
        placement,
      ),
    ).toEqual([
      {
        id: 'legacy-ry',
        target: { kind: 'node', node: '', channel: 'rotation', axis: 'y' },
        tagKey: 'r',
        offset: -30,
      },
      {
        id: 'legacy-rx',
        target: { kind: 'node', node: '', channel: 'rotation', axis: 'x' },
        tagKey: 'rx',
      },
      {
        id: 'legacy-sx',
        target: { kind: 'node', node: '', channel: 'scale', axis: 'x' },
        tagKey: 's',
        offset: -2,
      },
    ]);
  });

  it('모르는 type·빈 key·비객체는 버리고, 배열이 아니면 빈 배열', () => {
    expect(
      convertLegacyValueMapList(
        [{ type: 'QQ', key: 'k' }, { type: 'PX', key: ' ' }, null, 3],
        placement,
      ),
    ).toEqual([]);
    expect(convertLegacyValueMapList(undefined, placement)).toEqual([]);
  });
});

describe('convertLegacyRigBindings', () => {
  it('joint 맵핑으로 옮기고 결정론적 id 를 준다', () => {
    expect(
      convertLegacyRigBindings([
        { jointId: 'luff', key: ' C_1:luff ', scale: 0.5, offset: -1 },
        { jointId: '', key: 'k' },
        { jointId: 'x', key: '' },
        'x',
      ]),
    ).toEqual([
      {
        id: 'legacy-joint-luff',
        target: { kind: 'joint', jointId: 'luff' },
        tagKey: 'C_1:luff',
        scale: 0.5,
        offset: -1,
      },
    ]);
    expect(convertLegacyRigBindings(null)).toEqual([]);
  });
});

describe('resolveModelTagMappings', () => {
  const base = {
    position: [0, 0, 5] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  };

  it('tagMappings 가 배열이면 정본 — 레거시 필드는 무시한다', () => {
    const out = resolveModelTagMappings(
      {
        ...base,
        tagMappings: [node('m1')],
        valueMapList: [{ type: 'PX', key: 'ignored' }],
        rigBindings: [{ jointId: 'luff', key: 'ignored' }],
      },
      rig,
    );
    expect(out?.map((m) => m.id)).toEqual(['m1']);
    expect(resolveModelTagMappings({ ...base, tagMappings: [] }, rig)).toBeUndefined();
  });

  it('tagMappings 가 없으면 레거시 둘을 합쳐 변환·정규화한다 (driven 관절 제외)', () => {
    const out = resolveModelTagMappings(
      {
        ...base,
        valueMapList: [{ type: 'PZ', key: 'C_1:z', scale: 0.1, offset: 71 }],
        rigBindings: [
          { jointId: 'luff', key: 'C_1:luff' },
          { jointId: 'upper', key: 'driven' },
        ],
      },
      rig,
    );
    expect(out).toEqual([
      {
        id: 'legacy-pz',
        target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        tagKey: 'C_1:z',
        scale: 0.1,
        offset: 66,
      },
      {
        id: 'legacy-joint-luff',
        target: { kind: 'joint', jointId: 'luff' },
        tagKey: 'C_1:luff',
      },
    ]);
  });

  it('레거시도 비어 있으면 undefined', () => {
    expect(resolveModelTagMappings({ ...base, valueMapList: [] }, undefined)).toBeUndefined();
    expect(resolveModelTagMappings(base, undefined)).toBeUndefined();
  });

  it('변환은 멱등이다 — 같은 입력을 두 번 넣어도 같은 결과', () => {
    const input = { ...base, valueMapList: [{ type: 'PX', key: 'k', offset: 3 }] };
    expect(resolveModelTagMappings(input, undefined)).toEqual(
      resolveModelTagMappings(input, undefined),
    );
  });
});
