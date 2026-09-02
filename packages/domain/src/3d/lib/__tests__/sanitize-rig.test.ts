import { describe, expect, it } from 'vitest';
import {
  sanitizeModelRigId,
  sanitizeRigDefinition,
  sanitizeRigDefinitions,
} from '../sanitize-rig';
import { sanitizeSceneInfo } from '../sanitize-scene-info';
import { getDrivenJointIds, type RigDefinition } from '../../model/rig-types';
import type { SavedModelInfo, SavedSceneInfo } from '../../model/types';

function rig(overrides: Record<string, unknown> = {}): RigDefinition {
  return {
    id: 'rig-llc',
    name: 'LLC',
    modelPath: '/models/LLC_002.glb',
    joints: [
      { id: 'slew', node: '[0]Base/[0]Link_01', type: 'hinge', axis: 'y' },
      {
        id: 'luff',
        node: '[0]Base/[0]Link_01/[0]Lower_Link_01',
        type: 'hinge',
        axis: 'x',
        min: -32,
        max: 11.75,
      },
      {
        id: 'upper1',
        node: '[0]Base/[0]Link_01/[1]Upper_Link_01',
        type: 'hinge',
        axis: 'x',
      },
      {
        id: 'upper2',
        node: '[0]Base/[0]Link_01/[1]Upper_Link_01/[0]Upper_Link_02',
        type: 'hinge',
        axis: 'x',
      },
    ],
    constraints: [
      {
        type: 'linear',
        id: 'l1',
        input: 'luff',
        output: 'upper1',
        factor: 1.14,
      },
      {
        type: 'linear',
        id: 'l2',
        input: 'luff',
        output: 'upper2',
        factor: -2.4,
      },
    ],
    ...overrides,
  } as unknown as RigDefinition;
}

function model(overrides: Record<string, unknown> = {}): SavedModelInfo {
  return {
    id: 'model-1',
    equipName: 'LLC',
    path: '/models/LLC_002.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    valueMapList: [],
    ...overrides,
  } as unknown as SavedModelInfo;
}

describe('sanitizeRigDefinition — 관절', () => {
  it('유효한 정의는 그대로 통과한다', () => {
    const out = sanitizeRigDefinition(rig());
    expect(out).toEqual(rig());
  });

  it('id·modelPath 가 없으면 리그 자체를 버린다', () => {
    expect(sanitizeRigDefinition(rig({ id: '' }))).toBeNull();
    expect(sanitizeRigDefinition(rig({ modelPath: 12 }))).toBeNull();
    expect(sanitizeRigDefinition(null)).toBeNull();
    expect(sanitizeRigDefinition('rig')).toBeNull();
  });

  it('name 이 문자열이 아니면 빈 문자열로 정규화한다', () => {
    expect(sanitizeRigDefinition(rig({ name: undefined }))?.name).toBe('');
  });

  it('축·타입 오타, 빈 id, 중복 id 관절은 개별로 버리고 나머지는 살린다', () => {
    const out = sanitizeRigDefinition(
      rig({
        joints: [
          { id: 'a', node: '', type: 'hinge', axis: 'w' },
          { id: 'b', node: '', type: 'twist', axis: 'x' },
          { id: '', node: '', type: 'hinge', axis: 'x' },
          { id: 'ok', node: '[0]A', type: 'slide', axis: 'z' },
          { id: 'ok', node: '[1]B', type: 'slide', axis: 'z' },
          { id: 'nodeless', type: 'hinge', axis: 'x' },
        ],
        constraints: [],
      }),
    );
    expect(out?.joints).toEqual([
      { id: 'ok', node: '[0]A', type: 'slide', axis: 'z' },
    ]);
  });

  it('min > max 면 둘 다 버리고, 한쪽만 유효하면 그것만 남긴다', () => {
    const [both, onlyMin, nan] = sanitizeRigDefinition(
      rig({
        joints: [
          { id: 'a', node: '', type: 'hinge', axis: 'x', min: 10, max: -10 },
          { id: 'b', node: '', type: 'hinge', axis: 'x', min: -5, max: 'x' },
          {
            id: 'c',
            node: '',
            type: 'hinge',
            axis: 'x',
            min: NaN,
            max: Infinity,
          },
        ],
        constraints: [],
      }),
    )!.joints;
    expect(both).toEqual({ id: 'a', node: '', type: 'hinge', axis: 'x' });
    expect(onlyMin).toEqual({
      id: 'b',
      node: '',
      type: 'hinge',
      axis: 'x',
      min: -5,
    });
    expect(nan).toEqual({ id: 'c', node: '', type: 'hinge', axis: 'x' });
  });

  it('min === max 는 경계 정확값으로 허용한다', () => {
    const [j] = sanitizeRigDefinition(
      rig({
        joints: [
          { id: 'a', node: '', type: 'hinge', axis: 'x', min: 3, max: 3 },
        ],
        constraints: [],
      }),
    )!.joints;
    expect(j.min).toBe(3);
    expect(j.max).toBe(3);
  });

  it('sign 은 -1 일 때만 남기고 그 외(1, 문자열, 0)는 생략한다', () => {
    const joints = sanitizeRigDefinition(
      rig({
        joints: [
          { id: 'a', node: '', type: 'hinge', axis: 'x', sign: -1 },
          { id: 'b', node: '', type: 'hinge', axis: 'x', sign: 1 },
          { id: 'c', node: '', type: 'hinge', axis: 'x', sign: '-1' },
          { id: 'd', node: '', type: 'hinge', axis: 'x', sign: 0 },
        ],
        constraints: [],
      }),
    )!.joints;
    expect(joints.map((j) => j.sign)).toEqual([
      -1,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('공백뿐인 label 은 버린다', () => {
    const [j] = sanitizeRigDefinition(
      rig({
        joints: [{ id: 'a', node: '', type: 'hinge', axis: 'x', label: '   ' }],
        constraints: [],
      }),
    )!.joints;
    expect(j).not.toHaveProperty('label');
  });
});

describe('sanitizeRigDefinition — 선형 연동', () => {
  const base = rig().constraints[0];

  it('입력·출력 관절이 없으면 버린다', () => {
    const out = sanitizeRigDefinition(
      rig({
        constraints: [
          { ...base, input: 'ghost' },
          { ...base, id: 'l9', output: 'ghost' },
          { ...base, id: 'l8', input: '' },
        ],
      }),
    );
    expect(out?.constraints).toEqual([]);
  });

  it('입력과 출력이 같은 관절이면 버린다', () => {
    const out = sanitizeRigDefinition(
      rig({ constraints: [{ ...base, output: 'luff' }] }),
    );
    expect(out?.constraints).toEqual([]);
  });

  it('factor 가 NaN/문자열이면 버리고, offset 은 finite 일 때만 남긴다', () => {
    expect(
      sanitizeRigDefinition(rig({ constraints: [{ ...base, factor: NaN }] }))
        ?.constraints,
    ).toEqual([]);
    expect(
      sanitizeRigDefinition(rig({ constraints: [{ ...base, factor: '2' }] }))
        ?.constraints,
    ).toEqual([]);
    const [withOffset, badOffset] = sanitizeRigDefinition(
      rig({
        constraints: [
          { ...base, offset: 3 },
          { ...base, id: 'l2', output: 'upper2', offset: Infinity },
        ],
      }),
    )!.constraints;
    expect(withOffset.offset).toBe(3);
    expect(badOffset).not.toHaveProperty('offset');
  });

  it('factor 0 은 유효값이다', () => {
    const [c] = sanitizeRigDefinition(
      rig({ constraints: [{ ...base, factor: 0 }] }),
    )!.constraints;
    expect(c.factor).toBe(0);
  });

  it('같은 관절을 출력으로 쓰는 두 번째 연동은 버린다', () => {
    const out = sanitizeRigDefinition(
      rig({
        constraints: [
          base,
          { ...base, id: 'dup', input: 'slew', factor: 9 },
          rig().constraints[1],
        ],
      }),
    );
    expect(out?.constraints.map((c) => c.id)).toEqual(['l1', 'l2']);
  });

  it('driven 관절을 입력으로 쓰는 체인은 허용한다', () => {
    const out = sanitizeRigDefinition(
      rig({
        constraints: [
          base,
          {
            type: 'linear',
            id: 'chain',
            input: 'upper1',
            output: 'upper2',
            factor: 2,
          },
        ],
      }),
    );
    expect(out?.constraints).toHaveLength(2);
  });

  it('모르는 타입, 중복 id 는 버린다', () => {
    const out = sanitizeRigDefinition(
      rig({
        constraints: [
          { ...base, type: 'planarLoop' },
          base,
          { ...base, output: 'upper2' },
        ],
      }),
    );
    expect(out?.constraints).toEqual([base]);
  });

  it('공백뿐인 label 은 버린다', () => {
    const [c] = sanitizeRigDefinition(
      rig({ constraints: [{ ...base, label: '  ' }] }),
    )!.constraints;
    expect(c).not.toHaveProperty('label');
  });
});

describe('getDrivenJointIds', () => {
  it('연동의 출력 관절 집합을 돌려준다', () => {
    expect([...getDrivenJointIds(rig())].sort()).toEqual(['upper1', 'upper2']);
    expect(getDrivenJointIds(rig({ constraints: [] })).size).toBe(0);
  });
});

describe('sanitizeRigDefinitions', () => {
  it('배열이 아니면 undefined, 비면 undefined', () => {
    expect(sanitizeRigDefinitions(undefined)).toBeUndefined();
    expect(sanitizeRigDefinitions({})).toBeUndefined();
    expect(sanitizeRigDefinitions([])).toBeUndefined();
    expect(sanitizeRigDefinitions([null, 'x', { id: 'a' }])).toBeUndefined();
  });

  it('id 중복은 첫 항목만 남긴다', () => {
    const out = sanitizeRigDefinitions([
      rig({ name: 'first' }),
      rig({ name: 'second' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out?.[0].name).toBe('first');
  });
});

describe('sanitizeModelRigId', () => {
  const rigs = [rig()];

  it('rigId 가 없거나 rigs 에 없으면 undefined', () => {
    expect(sanitizeModelRigId(undefined, rigs)).toBeUndefined();
    expect(sanitizeModelRigId('', rigs)).toBeUndefined();
    expect(sanitizeModelRigId('nope', rigs)).toBeUndefined();
    expect(sanitizeModelRigId('rig-llc', undefined)).toBeUndefined();
    expect(sanitizeModelRigId(3, rigs)).toBeUndefined();
  });

  it('rigs 에 있으면 그대로', () => {
    expect(sanitizeModelRigId('rig-llc', rigs)).toBe('rig-llc');
  });
});

describe('sanitizeSceneInfo — 리그 통합', () => {
  it('리그가 없는 씬은 rigs/rigId/tagMappings 필드가 직렬화에 나타나지 않는다', () => {
    const out = sanitizeSceneInfo({
      maps: [],
      models: [model()],
      texts: [],
    } as SavedSceneInfo);
    expect(out).not.toHaveProperty('rigs');
    const json = JSON.parse(JSON.stringify(out));
    expect(json.models[0]).not.toHaveProperty('rigId');
    expect(json.models[0]).not.toHaveProperty('rigBindings');
    expect(json.models[0]).not.toHaveProperty('tagMappings');
    expect(json.models[0]).not.toHaveProperty('valueMapList');
  });

  it('rigId 가 가리키는 리그가 정규화에서 사라지면 모델의 rigId 도 떨어진다', () => {
    const out = sanitizeSceneInfo({
      maps: [],
      models: [
        model({
          rigId: 'rig-llc',
          rigBindings: [{ jointId: 'slew', key: 'k' }],
        }),
      ],
      texts: [],
      rigs: [rig({ id: '' })],
    } as unknown as SavedSceneInfo);
    expect(out).not.toHaveProperty('rigs');
    expect(out.models[0].rigId).toBeUndefined();
    expect(out.models[0].rigBindings).toBeUndefined();
    // 관절을 가리키던 레거시 바인딩도 리그와 함께 떨어진다.
    expect(out.models[0].tagMappings).toBeUndefined();
  });

  it('유효한 리그와 참조는 모델을 버리지 않고 그대로 싣는다', () => {
    const out = sanitizeSceneInfo({
      maps: [],
      models: [
        model({
          rigId: 'rig-llc',
          rigBindings: [{ jointId: 'slew', key: 'k' }],
        }),
      ],
      texts: [],
      rigs: [rig()],
    } as unknown as SavedSceneInfo);
    expect(out.rigs).toEqual([rig()]);
    expect(out.models[0].rigId).toBe('rig-llc');
    // 레거시 rigBindings 는 joint 맵핑으로 흡수되고 필드는 사라진다.
    expect(out.models[0].rigBindings).toBeUndefined();
    expect(out.models[0].tagMappings).toEqual([
      {
        id: 'legacy-joint-slew',
        target: { kind: 'joint', jointId: 'slew' },
        tagKey: 'k',
      },
    ]);
  });
});
