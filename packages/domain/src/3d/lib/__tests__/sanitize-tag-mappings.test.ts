import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertLegacyRigBindings,
  convertLegacyValueMapList,
  finalizeModelTagKeys,
  parseTagKeyRef,
  resolveModelTagMappings,
  resolveTagRef,
  sanitizeTagMappings,
} from '../sanitize-tag-mappings';
import type { RigDefinition } from '../../model/rig-types';
import {
  TAG_MAPPING_CAPTION_MAX,
  type TagMapping,
} from '../../model/tag-mapping-types';

const rig: RigDefinition = {
  id: 'rig-a',
  name: 'A',
  assetId: 'a',
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
  overrides: Partial<TagMapping> & {
    node?: string;
    axis?: 'x' | 'y' | 'z';
  } = {},
): TagMapping {
  const { node: path = '', axis = 'z', ...rest } = overrides;
  return {
    id,
    target: { kind: 'node', node: path, channel: 'position', axis },
    code: 'pos',
    ...rest,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseTagKeyRef', () => {
  it('점 키는 크레인·코드로, 옛 콜론 키도 같은 규칙으로 나눈다(trim)', () => {
    expect(parseTagKeyRef(' C_171.tl_distance ')).toEqual({
      code: 'tl_distance',
      craneKey: 'C_171',
    });
    expect(parseTagKeyRef('GC_04:gantry_position')).toEqual({
      code: 'gantry_position',
      craneKey: 'GC_04',
    });
  });

  it('구분자가 없으면 통째로 코드다', () => {
    expect(parseTagKeyRef(' luff ')).toEqual({ code: 'luff' });
  });

  it('첫 점 앞이 크레인, 뒤가 코드다 — 코드에 점이 남아도 된다', () => {
    expect(parseTagKeyRef('A.b.c')).toEqual({ craneKey: 'A', code: 'b.c' });
  });

  it('비었거나 문자열이 아니거나 코드에 금지 글자가 남으면 null', () => {
    expect(parseTagKeyRef('')).toBeNull();
    expect(parseTagKeyRef('   ')).toBeNull();
    expect(parseTagKeyRef(3)).toBeNull();
    expect(parseTagKeyRef(null)).toBeNull();
    expect(parseTagKeyRef('A.b c')).toBeNull();
    expect(parseTagKeyRef(':x')).toBeNull();
    expect(parseTagKeyRef('x:')).toBeNull();
  });
});

describe('resolveTagRef', () => {
  it('새 포맷 code 가 있으면 그것(보존용 craneId 포함)이고 레거시 키는 무시한다', () => {
    expect(resolveTagRef({ code: ' tl_distance ' })).toEqual({
      code: 'tl_distance',
    });
    expect(
      resolveTagRef({ code: 'x', craneId: ' C_172 ', realtimeTagKey: 'C_1.y' }),
    ).toEqual({ code: 'x', craneKey: 'C_172' });
  });

  it('레거시는 realtimeTagKey › virtualTagKey › tagKey 순으로 첫 유효 키', () => {
    expect(
      resolveTagRef({ realtimeTagKey: 'C_1.a', virtualTagKey: 'V:b' }),
    ).toEqual({ code: 'a', craneKey: 'C_1' });
    expect(
      resolveTagRef({ realtimeTagKey: '  ', virtualTagKey: 'V:b' }),
    ).toEqual({ code: 'b', craneKey: 'V' });
    expect(resolveTagRef({ tagKey: 'old' })).toEqual({ code: 'old' });
    expect(
      resolveTagRef({ code: 'bad code', realtimeTagKey: 'C_1.a' }),
    ).toEqual({ code: 'a', craneKey: 'C_1' });
  });

  it('전부 비거나 문자열이 아니면 null', () => {
    expect(resolveTagRef({})).toBeNull();
    expect(resolveTagRef({ code: '', realtimeTagKey: '', tagKey: null })).toBe(
      null,
    );
    expect(resolveTagRef({ realtimeTagKey: 3 })).toBeNull();
  });
});

describe('sanitizeTagMappings', () => {
  it('배열이 아니면 undefined, 비면 undefined(필드 생략)', () => {
    expect(sanitizeTagMappings(undefined)).toBeUndefined();
    expect(sanitizeTagMappings('x')).toBeUndefined();
    expect(sanitizeTagMappings([])).toBeUndefined();
    expect(sanitizeTagMappings([null, 'x', {}])).toBeUndefined();
  });

  it('유효 항목은 코드 trim·scale/offset 유한수만 살려 통과한다', () => {
    expect(
      sanitizeTagMappings([
        node('m1', { code: ' z ', scale: 0.1, offset: NaN }),
      ]),
    ).toEqual([node('m1', { code: 'z', scale: 0.1 })]);
  });

  it('레거시 키(두 슬롯·단일 tagKey)는 코드와 크레인 접두어로 나뉘어 craneId 로 실린다', () => {
    expect(
      sanitizeTagMappings([
        {
          ...node('m1'),
          code: undefined,
          virtualTagKey: 'GC_04:gantry_position',
        },
        {
          ...node('m2', { axis: 'x' }),
          code: undefined,
          realtimeTagKey: 'C_171.tl_distance',
        },
        { ...node('m3', { axis: 'y' }), code: undefined, tagKey: 'bare' },
      ]),
    ).toEqual([
      node('m1', { code: 'gantry_position', craneId: 'GC_04' }),
      node('m2', { axis: 'x', code: 'tl_distance', craneId: 'C_171' }),
      node('m3', { axis: 'y', code: 'bare' }),
    ]);
    const out = sanitizeTagMappings([
      { ...node('m1'), code: undefined, tagKey: 'C_171.tl_distance' },
    ]);
    expect(out?.[0]).not.toHaveProperty('tagKey');
    expect(out?.[0]).not.toHaveProperty('realtimeTagKey');
  });

  it('id 없음·중복, 코드 없음·금지 글자, 깨진 target 은 개별로 버린다', () => {
    const out = sanitizeTagMappings([
      node('m1'),
      node('m1', { axis: 'x' }), // id 중복
      { ...node('m2', { axis: 'y' }), id: '' },
      node('m3', { axis: 'x', code: '   ' }),
      node('m9', { axis: 'y', code: 'a b' }),
      {
        id: 'm4',
        target: { kind: 'node', node: '', channel: 'spin', axis: 'x' },
        code: 'k',
      },
      {
        id: 'm5',
        target: { kind: 'node', node: '', channel: 'scale', axis: 'w' },
        code: 'k',
      },
      {
        id: 'm6',
        target: { kind: 'node', node: 3, channel: 'scale', axis: 'x' },
        code: 'k',
      },
      { id: 'm7', target: { kind: 'ghost' }, code: 'k' },
      { id: 'm8', target: null, code: 'k' },
    ]);
    expect(out?.map((m) => m.id)).toEqual(['m1']);
  });

  it('같은 대상(노드·채널·축)은 첫 항목만 남긴다(first-wins), 다른 축은 공존', () => {
    const out = sanitizeTagMappings([
      node('first', { code: 'a' }),
      node('second', { code: 'b' }),
      node('other-axis', { axis: 'x', code: 'c' }),
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
    const j = (id: string, jointId: string, code = 'k'): TagMapping => ({
      id,
      target: { kind: 'joint', jointId },
      code,
    });
    expect(sanitizeTagMappings([j('a', 'luff')])).toBeUndefined();
    expect(
      sanitizeTagMappings(
        [
          j('a', 'luff'),
          j('b', 'ghost'),
          j('c', 'upper'),
          j('d', 'luff', 'dup'),
        ],
        { rig },
      ),
    ).toEqual([j('a', 'luff')]);
    expect(
      sanitizeTagMappings(
        [{ id: 'x', target: { kind: 'joint', jointId: '' }, code: 'k' }],
        { rig },
      ),
    ).toBeUndefined();
  });
});

describe('sanitizeTagMappings — 라벨 표시(showOnLabel·caption)', () => {
  it('showOnLabel 은 true 만 남긴다', () => {
    const out = sanitizeTagMappings([
      node('m1', { showOnLabel: true }),
      node('m2', { axis: 'x', showOnLabel: false }),
      {
        ...node('m3', { axis: 'y' }),
        showOnLabel: 'yes',
      },
      { ...node('m4', { node: '[0]A' }), showOnLabel: 1 },
    ]);
    expect(out?.[0].showOnLabel).toBe(true);
    for (const mapping of out!.slice(1)) {
      expect(mapping).not.toHaveProperty('showOnLabel');
    }
  });

  it('이름은 trim 하고, 비거나 문자열이 아니면 필드를 생략한다', () => {
    const out = sanitizeTagMappings([
      node('m1', { caption: '  주행  ' }),
      node('m2', { axis: 'x', caption: '   ' }),
      node('m3', { axis: 'y', caption: '' }),
      { ...node('m4', { node: '[0]A' }), caption: 12 },
    ]);
    expect(out?.[0].caption).toBe('주행');
    for (const mapping of out!.slice(1)) {
      expect(mapping).not.toHaveProperty('caption');
    }
  });

  it('이름은 최대 길이에서 자른다 — 경계 정확값은 그대로, +1 은 잘린다', () => {
    const exact = 'a'.repeat(TAG_MAPPING_CAPTION_MAX);
    const out = sanitizeTagMappings([
      node('m1', { caption: exact }),
      node('m2', { axis: 'x', caption: `${exact}b` }),
    ]);
    expect(out?.[0].caption).toBe(exact);
    expect(out?.[1].caption).toBe(exact);
  });

  it('표시를 꺼도 이름은 보존한다 — 다시 켜면 되살아난다', () => {
    expect(sanitizeTagMappings([node('m1', { caption: '주행' })])).toEqual([
      node('m1', { caption: '주행' }),
    ]);
  });

  it('라벨 필드가 없는 맵핑은 저장본(JSON)에 새 키가 생기지 않는다', () => {
    const out = sanitizeTagMappings([node('m1')]);
    expect(Object.keys(JSON.parse(JSON.stringify(out))[0]).sort()).toEqual([
      'code',
      'id',
      'target',
    ]);
  });
});

describe('convertLegacyValueMapList', () => {
  const placement = {
    position: [10, 0, 5] as [number, number, number],
    rotation: [0, 30, 0] as [number, number, number],
    scale: [2, 2, 2] as [number, number, number],
  };

  it('PZ offset 은 배치 위치를 빼서 rest-Δ 로 옮기고 키는 코드·크레인으로 나뉜다 (dock-in 형태)', () => {
    expect(
      convertLegacyValueMapList(
        [{ type: 'PZ', key: 'C_171.tl_distance', scale: 0.1, offset: 71 }],
        placement,
      ),
    ).toEqual([
      {
        id: 'legacy-pz',
        target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        code: 'tl_distance',
        craneId: 'C_171',
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
    const newWorld =
      placement.position[2] + (m.offset ?? 0) + v * (m.scale ?? 1);
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
        code: 'r',
        offset: -30,
      },
      {
        id: 'legacy-rx',
        target: { kind: 'node', node: '', channel: 'rotation', axis: 'x' },
        code: 'rx',
      },
      {
        id: 'legacy-sx',
        target: { kind: 'node', node: '', channel: 'scale', axis: 'x' },
        code: 's',
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
        { jointId: 'luff', key: ' C_1.luff ', scale: 0.5, offset: -1 },
        { jointId: '', key: 'k' },
        { jointId: 'x', key: '' },
        'x',
      ]),
    ).toEqual([
      {
        id: 'legacy-joint-luff',
        target: { kind: 'joint', jointId: 'luff' },
        code: 'luff',
        craneId: 'C_1',
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
    expect(
      resolveModelTagMappings({ ...base, tagMappings: [] }, rig),
    ).toBeUndefined();
  });

  it('tagMappings 가 없으면 레거시 둘을 합쳐 변환·정규화한다 (driven 관절 제외)', () => {
    const out = resolveModelTagMappings(
      {
        ...base,
        valueMapList: [{ type: 'PZ', key: 'C_1.z', scale: 0.1, offset: 71 }],
        rigBindings: [
          { jointId: 'luff', key: 'C_1.luff' },
          { jointId: 'upper', key: 'driven' },
        ],
      },
      rig,
    );
    expect(out).toEqual([
      {
        id: 'legacy-pz',
        target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        code: 'z',
        craneId: 'C_1',
        scale: 0.1,
        offset: 66,
      },
      {
        id: 'legacy-joint-luff',
        target: { kind: 'joint', jointId: 'luff' },
        code: 'luff',
        craneId: 'C_1',
      },
    ]);
  });

  it('레거시도 비어 있으면 undefined', () => {
    expect(
      resolveModelTagMappings({ ...base, valueMapList: [] }, undefined),
    ).toBeUndefined();
    expect(resolveModelTagMappings(base, undefined)).toBeUndefined();
  });

  it('변환은 멱등이다 — 같은 입력을 두 번 넣어도 같은 결과', () => {
    const input = {
      ...base,
      valueMapList: [{ type: 'PX', key: 'k', offset: 3 }],
    };
    expect(resolveModelTagMappings(input, undefined)).toEqual(
      resolveModelTagMappings(input, undefined),
    );
  });
});

describe('finalizeModelTagKeys', () => {
  it('모델에 craneId 가 없고 접두어가 하나뿐이면 그것을 채우고 맵핑에서는 뗀다 (philly 형태)', () => {
    const out = finalizeModelTagKeys(
      undefined,
      [
        node('m1', { code: 'gantry_position', craneId: 'GC_04' }),
        node('m2', { axis: 'x', code: 'trolley_position', craneId: 'GC_04' }),
      ],
      { fault: { code: 'fault', craneKey: 'GC_04' } },
    );
    expect(out).toEqual({
      craneId: 'GC_04',
      tagMappings: [
        node('m1', { code: 'gantry_position' }),
        node('m2', { axis: 'x', code: 'trolley_position' }),
      ],
      statusTags: { fault: 'fault' },
    });
    expect(out.tagMappings?.[0]).not.toHaveProperty('craneId');
  });

  it('상태 태그에만 접두어가 있어도 채운다', () => {
    expect(
      finalizeModelTagKeys(undefined, undefined, {
        controlOn: { code: 'on', craneKey: 'C_171' },
      }),
    ).toEqual({
      craneId: 'C_171',
      tagMappings: undefined,
      statusTags: { controlOn: 'on' },
    });
  });

  it('접두어가 둘이면 채우지 않는다 — 맵핑은 craneId 를 들고 남고 상태 태그는 버린다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = finalizeModelTagKeys(
      undefined,
      [
        node('m1', { code: 'a', craneId: 'C_1' }),
        node('m2', { axis: 'x', code: 'b', craneId: 'C_2' }),
      ],
      { fault: { code: 'f', craneKey: 'C_1' }, bypass: { code: 'bp' } },
    );
    expect(out.craneId).toBeUndefined();
    expect(out.tagMappings).toEqual([
      node('m1', { code: 'a', craneId: 'C_1' }),
      node('m2', { axis: 'x', code: 'b', craneId: 'C_2' }),
    ]);
    expect(out.statusTags).toEqual({ bypass: 'bp' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('모델 craneId 와 같은 접두어는 정규화 기준으로 비교해 뗀다 (GC-04 ≡ GC_04)', () => {
    const out = finalizeModelTagKeys(
      'GC-04',
      [node('m1', { code: 'a', craneId: 'GC_04' })],
      { fault: { code: 'f', craneKey: 'GC_04' } },
    );
    expect(out).toEqual({
      craneId: 'GC-04',
      tagMappings: [node('m1', { code: 'a' })],
      statusTags: { fault: 'f' },
    });
  });

  it('모델 craneId 와 다른 접두어는 맵핑에 남기고, 상태 태그는 경고하고 버린다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = finalizeModelTagKeys(
      'C_171',
      [node('m1', { code: 'a', craneId: 'C_172' })],
      { fault: { code: 'f', craneKey: 'C_172' }, bypass: { code: 'bp' } },
    );
    expect(out.craneId).toBe('C_171');
    expect(out.tagMappings).toEqual([
      node('m1', { code: 'a', craneId: 'C_172' }),
    ]);
    expect(out.statusTags).toEqual({ bypass: 'bp' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('접두어가 없는 코드만 있으면 craneId 는 그대로고 필드도 생기지 않는다', () => {
    const out = finalizeModelTagKeys(undefined, [node('m1')], {
      fault: { code: 'f' },
    });
    expect(out).toEqual({
      craneId: undefined,
      tagMappings: [node('m1')],
      statusTags: { fault: 'f' },
    });
  });

  it('맵핑·상태 태그가 비면 둘 다 undefined', () => {
    expect(finalizeModelTagKeys('C_1', undefined, undefined)).toEqual({
      craneId: 'C_1',
      tagMappings: undefined,
      statusTags: undefined,
    });
    expect(finalizeModelTagKeys('C_1', [], {})).toEqual({
      craneId: 'C_1',
      tagMappings: undefined,
      statusTags: undefined,
    });
  });
});
