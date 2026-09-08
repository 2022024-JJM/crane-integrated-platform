import { describe, expect, it } from 'vitest';
import { sanitizeSceneInfo } from '../sanitize-scene-info';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
  type SavedModelInfo,
  type SavedSceneInfo,
} from '../../model/types';

/** 최소 유효 씬. 케이스별로 덮어써서 쓴다. */
function scene(overrides: Record<string, unknown> = {}): SavedSceneInfo {
  return {
    maps: [],
    models: [],
    texts: [],
    ...overrides,
  } as unknown as SavedSceneInfo;
}

function model(overrides: Record<string, unknown> = {}): SavedModelInfo {
  return {
    id: 'model-1',
    equipName: 'Crane',
    path: '/models/crane.glb',
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    valueMapList: [],
    ...overrides,
  } as unknown as SavedModelInfo;
}

describe('sanitizeSceneInfo — 지도(maps)', () => {
  it('legacy 단수 map 필드를 maps 배열로 마이그레이션한다', () => {
    const legacy = {
      map: { id: 'map-1', path: '/maps/okpo.glb' },
      models: [],
    } as unknown as SavedSceneInfo;

    const result = sanitizeSceneInfo(legacy);
    expect(result.maps).toHaveLength(1);
    expect(result.maps[0]).toMatchObject({ id: 'map-1', path: '/maps/okpo.glb' });
  });

  it('locked 필드 없음 = 잠김으로 정규화한다 (locked: false만 해제)', () => {
    const result = sanitizeSceneInfo(
      scene({
        maps: [
          { id: 'a', path: '/a.glb' },
          { id: 'b', path: '/b.glb', locked: false },
          { id: 'c', path: '/c.glb', locked: 'yes' },
        ],
      }),
    );
    expect(result.maps.map((m) => m.locked)).toEqual([true, false, true]);
  });

  it('id/path가 비면 id는 새로 발급, path는 빈 문자열', () => {
    const result = sanitizeSceneInfo(
      scene({ maps: [{ id: '', path: 42 }] }),
    );
    expect(result.maps[0].id).not.toBe('');
    expect(result.maps[0].path).toBe('');
  });

  it('유효한 transform만 싣고, 무효/누락 필드는 생략한다', () => {
    const result = sanitizeSceneInfo(
      scene({
        maps: [
          {
            id: 'a',
            path: '/a.glb',
            position: [1, 2, 3],
            rotation: [0, 'x', 0],
            scale: [1, 2],
          },
        ],
      }),
    );
    expect(result.maps[0].position).toEqual([1, 2, 3]);
    expect(result.maps[0]).not.toHaveProperty('rotation');
    expect(result.maps[0]).not.toHaveProperty('scale');
  });

  it('maps 필드 자체가 없으면(legacy map도 없음) 빈 배열', () => {
    const result = sanitizeSceneInfo({
      models: [],
    } as unknown as SavedSceneInfo);
    expect(result.maps).toEqual([]);
  });

  it('공백뿐인 name은 버린다', () => {
    const result = sanitizeSceneInfo(
      scene({
        maps: [
          { id: 'a', path: '/a.glb', name: '  ' },
          { id: 'b', path: '/b.glb', name: 'Dock' },
        ],
      }),
    );
    expect(result.maps[0]).not.toHaveProperty('name');
    expect(result.maps[1].name).toBe('Dock');
  });
});

describe('sanitizeSceneInfo — 모델', () => {
  it('필수 필드가 깨진 모델은 통째로 버린다', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model(),
          model({ id: 'no-path', path: '' }),
          model({ id: 'bad-pos', position: [0, NaN, 0] }),
          null,
        ],
      }),
    );
    expect(result.models.map((m) => m.id)).toEqual(['model-1']);
  });

  it('valueMapList 가 없어도 모델을 버리지 않는다 (레거시 필드는 이제 선택)', () => {
    const result = sanitizeSceneInfo(
      scene({ models: [model({ id: 'no-vml', valueMapList: undefined })] }),
    );
    expect(result.models.map((m) => m.id)).toEqual(['no-vml']);
    expect(result.models[0]).not.toHaveProperty('valueMapList');
  });

  it('레거시 valueMapList 는 루트 tagMappings 로 변환되고 필드는 사라진다', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model({
            position: [0, 0, 5],
            valueMapList: [
              { type: 'PZ', key: 'C_171:tl_distance', scale: 0.1, offset: 71 },
            ],
          }),
        ],
      }),
    );
    const json = JSON.parse(JSON.stringify(result));
    expect(json.models[0]).not.toHaveProperty('valueMapList');
    expect(json.models[0].tagMappings).toEqual([
      {
        id: 'legacy-pz',
        target: { kind: 'node', node: '', channel: 'position', axis: 'z' },
        tagKey: 'C_171:tl_distance',
        scale: 0.1,
        offset: 66,
      },
    ]);
    // 멱등: 정규화 결과를 다시 넣어도 같다.
    expect(sanitizeSceneInfo(result)).toEqual(result);
  });

  it('tagMappings 가 있으면 레거시 valueMapList 는 무시한다', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model({
            tagMappings: [
              {
                id: 'm1',
                target: { kind: 'node', node: '[0]Arm', channel: 'rotation', axis: 'x' },
                tagKey: 'C_1:luff',
              },
            ],
            valueMapList: [{ type: 'PX', key: 'ignored' }],
          }),
        ],
      }),
    );
    expect(result.models[0].tagMappings?.map((m) => m.id)).toEqual(['m1']);
  });

  it('models 배열 자체가 아니면 빈 배열', () => {
    const result = sanitizeSceneInfo(scene({ models: undefined }));
    expect(result.models).toEqual([]);
  });

  it('opacity는 [0.1, 1]로 클램프, 숫자가 아니면 1', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model({ id: 'a', opacity: 0 }),
          model({ id: 'b', opacity: 2 }),
          model({ id: 'c', opacity: 'full' }),
          model({ id: 'd', opacity: 0.5 }),
        ],
      }),
    );
    expect(result.models.map((m) => m.opacity)).toEqual([0.1, 1, 1, 0.5]);
  });

  it('중복 id는 뒤의 것에 새 id를 발급한다 (텍스트와도 공유)', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [model({ id: 'dup' }), model({ id: 'dup' })],
        texts: [
          {
            id: 'dup',
            content: 'T',
            color: '#fff',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        ],
      }),
    );
    expect(result.models[0].id).toBe('dup');
    expect(result.models[1].id).not.toBe('dup');
    expect(result.texts?.[0].id).not.toBe('dup');
    const ids = [
      result.models[0].id,
      result.models[1].id,
      result.texts?.[0].id,
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it('locked는 true만 유지, 그 외 값은 undefined로 정규화한다', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model({ id: 'a', locked: true }),
          model({ id: 'b', locked: 'yes' }),
          model({ id: 'c', locked: false }),
        ],
      }),
    );
    expect(result.models.map((m) => m.locked)).toEqual([
      true,
      undefined,
      undefined,
    ]);
  });

  it('labelHidden은 true만 유지하고 그 외 값·미지정은 undefined로 정규화한다', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model({ id: 'a', labelHidden: true }),
          model({ id: 'b', labelHidden: 'yes' }),
          model({ id: 'c', labelHidden: false }),
          model({ id: 'd' }),
        ],
      }),
    );
    expect(result.models.map((m) => m.labelHidden)).toEqual([
      true,
      undefined,
      undefined,
      undefined,
    ]);
    // 표시 상태(기본)는 직렬화에 키가 남지 않아야 기존 저장본 diff 가 0이다.
    expect(JSON.stringify(result.models[3])).not.toContain('labelHidden');
  });

  it('meshOverrides는 meshPath 없는 항목을 버리고, 전부 무효면 필드를 생략한다', () => {
    const result = sanitizeSceneInfo(
      scene({
        models: [
          model({
            id: 'a',
            meshOverrides: [
              { meshPath: '[0]Body', opacity: 5, visible: false, name: 'B' },
              { meshPath: '' },
              { opacity: 0.5 },
              'garbage',
            ],
          }),
          model({ id: 'b', meshOverrides: [{ meshPath: '' }] }),
        ],
      }),
    );
    expect(result.models[0].meshOverrides).toEqual([
      { meshPath: '[0]Body', opacity: 1, visible: false, name: 'B' },
    ]);
    expect(result.models[1].meshOverrides).toBeUndefined();
  });
});

describe('sanitizeSceneInfo — 텍스트', () => {
  it('content/color/transform이 깨진 텍스트는 버린다', () => {
    const valid = {
      id: 't1',
      content: 'Hello',
      color: '#fff',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    const result = sanitizeSceneInfo(
      scene({
        texts: [valid, { ...valid, id: 't2', content: 7 }, null],
      }),
    );
    expect(result.texts?.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('sanitizeSceneInfo — 카메라', () => {
  it('position/target이 유효하면 그 둘만 남긴다', () => {
    const result = sanitizeSceneInfo(
      scene({
        camera: { position: [1, 2, 3], target: [0, 0, 0], extra: true },
      }),
    );
    expect(result.camera).toEqual({ position: [1, 2, 3], target: [0, 0, 0] });
  });

  it('무효/누락 카메라는 null', () => {
    expect(sanitizeSceneInfo(scene()).camera).toBeNull();
    expect(
      sanitizeSceneInfo(scene({ camera: { position: [1, 2, 3] } })).camera,
    ).toBeNull();
  });
});

describe('sanitizeSceneInfo — environmentId (3-상태)', () => {
  it('문자열은 유지, null(배경 없음)도 유지, 미지정/빈 문자열은 필드 생략', () => {
    expect(sanitizeSceneInfo(scene({ environmentId: 'sky-1' })).environmentId).toBe(
      'sky-1',
    );
    expect(sanitizeSceneInfo(scene({ environmentId: null })).environmentId).toBe(
      null,
    );
    expect(sanitizeSceneInfo(scene())).not.toHaveProperty('environmentId');
    expect(sanitizeSceneInfo(scene({ environmentId: '' }))).not.toHaveProperty(
      'environmentId',
    );
  });
});

describe('sanitizeSceneInfo — 조명 (기본값이면 필드 생략)', () => {
  it('전부 기본값이면 lighting 필드 자체가 빠진다', () => {
    expect(
      sanitizeSceneInfo(
        scene({
          lighting: {
            shadows: false,
            sunAzimuth: SCENE_SUN_AZIMUTH_DEFAULT,
            sunElevation: SCENE_SUN_ELEVATION_DEFAULT,
          },
        }),
      ),
    ).not.toHaveProperty('lighting');
  });

  it('shadows는 true일 때만 남는다', () => {
    expect(
      sanitizeSceneInfo(scene({ lighting: { shadows: true } })).lighting,
    ).toEqual({ shadows: true });
  });

  it('sunAzimuth는 [0,360)로 랩한다 (360 = 0, -90 = 270)', () => {
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunAzimuth: 360 } })).lighting,
    ).toEqual({ sunAzimuth: 0 });
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunAzimuth: -90 } })).lighting,
    ).toEqual({ sunAzimuth: 270 });
  });

  it('sunElevation은 [MIN, 90]로 클램프한다', () => {
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunElevation: 0 } })).lighting,
    ).toEqual({ sunElevation: SCENE_SUN_ELEVATION_MIN });
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunElevation: 720 } })).lighting,
    ).toEqual({ sunElevation: 90 });
  });

  it('숫자가 아닌 값은 무시한다', () => {
    expect(
      sanitizeSceneInfo(
        scene({ lighting: { sunAzimuth: 'south', sunElevation: NaN } }),
      ),
    ).not.toHaveProperty('lighting');
  });
});
