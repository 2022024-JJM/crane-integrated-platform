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
    expect(result.maps[0]).toMatchObject({
      id: 'map-1',
      path: '/maps/okpo.glb',
    });
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

  it('cameraBounds 는 true 만 남긴다 (false·문자열·없음은 필드 제거)', () => {
    const result = sanitizeSceneInfo(
      scene({
        maps: [
          { id: 'a', path: '/a.glb', cameraBounds: true },
          { id: 'b', path: '/b.glb', cameraBounds: false },
          { id: 'c', path: '/c.glb', cameraBounds: 'yes' },
          { id: 'd', path: '/d.glb' },
        ],
      }),
    );
    expect(result.maps[0].cameraBounds).toBe(true);
    expect(result.maps[1]).not.toHaveProperty('cameraBounds');
    expect(result.maps[2]).not.toHaveProperty('cameraBounds');
    expect(result.maps[3]).not.toHaveProperty('cameraBounds');
  });

  it('id/path가 비면 id는 새로 발급, path는 빈 문자열', () => {
    const result = sanitizeSceneInfo(scene({ maps: [{ id: '', path: 42 }] }));
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
                target: {
                  kind: 'node',
                  node: '[0]Arm',
                  channel: 'rotation',
                  axis: 'x',
                },
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

describe('sanitizeSceneInfo — cameraByRegion (공유 씬)', () => {
  it('유효한 슬롯만 남기고 position/target 외 필드는 버린다', () => {
    const result = sanitizeSceneInfo(
      scene({
        cameraByRegion: {
          'dock-1': { position: [1, 2, 3], target: [0, 0, 0], extra: 1 },
          'dock-2': { position: [1, 2, 3] },
          'dock-3': 'nope',
          'dock-4': null,
          '': { position: [1, 2, 3], target: [0, 0, 0] },
        },
      }),
    );
    expect(result.cameraByRegion).toEqual({
      'dock-1': { position: [1, 2, 3], target: [0, 0, 0] },
    });
  });

  it('없거나 비었거나 배열·문자열이면 필드 자체를 뺀다', () => {
    expect('cameraByRegion' in sanitizeSceneInfo(scene())).toBe(false);
    expect(
      'cameraByRegion' in sanitizeSceneInfo(scene({ cameraByRegion: {} })),
    ).toBe(false);
    expect(
      'cameraByRegion' in
        sanitizeSceneInfo(scene({ cameraByRegion: { a: { position: 'x' } } })),
    ).toBe(false);
    expect(
      'cameraByRegion' in sanitizeSceneInfo(scene({ cameraByRegion: [] })),
    ).toBe(false);
    expect(
      'cameraByRegion' in sanitizeSceneInfo(scene({ cameraByRegion: 'x' })),
    ).toBe(false);
  });

  it('camera 폴백과 슬롯은 독립이다 — 슬롯이 있어도 camera 를 바꾸지 않는다', () => {
    const result = sanitizeSceneInfo(
      scene({
        camera: { position: [9, 9, 9], target: [0, 0, 0] },
        cameraByRegion: {
          'dock-1': { position: [1, 2, 3], target: [0, 0, 0] },
        },
      }),
    );
    expect(result.camera).toEqual({ position: [9, 9, 9], target: [0, 0, 0] });
  });
});

describe('sanitizeSceneInfo — environmentId (3-상태)', () => {
  it('문자열은 유지, null(배경 없음)도 유지, 미지정/빈 문자열은 필드 생략', () => {
    expect(
      sanitizeSceneInfo(scene({ environmentId: 'sky-1' })).environmentId,
    ).toBe('sky-1');
    expect(
      sanitizeSceneInfo(scene({ environmentId: null })).environmentId,
    ).toBe(null);
    expect(sanitizeSceneInfo(scene())).not.toHaveProperty('environmentId');
    expect(sanitizeSceneInfo(scene({ environmentId: '' }))).not.toHaveProperty(
      'environmentId',
    );
  });
});

describe('sanitizeSceneInfo — sea (3-상태, boolean 만 유지)', () => {
  it('true·false 는 그대로 유지한다', () => {
    expect(sanitizeSceneInfo(scene({ sea: true })).sea).toBe(true);
    expect(sanitizeSceneInfo(scene({ sea: false })).sea).toBe(false);
  });

  it('미지정이면 필드 자체가 빠진다 (레거시 규칙으로 판정)', () => {
    expect(sanitizeSceneInfo(scene())).not.toHaveProperty('sea');
  });

  it("boolean 이 아닌 오염값('yes'·1·null·NaN)은 필드를 생략한다", () => {
    for (const sea of ['yes', 1, null, Number.NaN, 0, '']) {
      expect(sanitizeSceneInfo(scene({ sea }))).not.toHaveProperty('sea');
    }
  });
});

describe('sanitizeSceneInfo — trueNorth (기본값이면 필드 생략)', () => {
  it('범위 안의 값은 그대로 유지한다', () => {
    expect(sanitizeSceneInfo(scene({ trueNorth: 50.6 })).trueNorth).toBe(50.6);
    expect(sanitizeSceneInfo(scene({ trueNorth: 359.9 })).trueNorth).toBe(
      359.9,
    );
  });

  it('미지정·0(기본값)이면 필드 자체가 빠진다', () => {
    expect(sanitizeSceneInfo(scene())).not.toHaveProperty('trueNorth');
    expect(sanitizeSceneInfo(scene({ trueNorth: 0 }))).not.toHaveProperty(
      'trueNorth',
    );
  });

  it('[0,360) 로 랩한다 — 360 은 기본값이 되어 필드가 빠진다', () => {
    expect(sanitizeSceneInfo(scene({ trueNorth: 360 }))).not.toHaveProperty(
      'trueNorth',
    );
    expect(sanitizeSceneInfo(scene({ trueNorth: 410.5 })).trueNorth).toBe(50.5);
    expect(sanitizeSceneInfo(scene({ trueNorth: -5.6 })).trueNorth).toBeCloseTo(
      354.4,
      10,
    );
    // -0 은 기본값과 같다.
    expect(sanitizeSceneInfo(scene({ trueNorth: -0 }))).not.toHaveProperty(
      'trueNorth',
    );
  });

  it("숫자가 아닌 오염값('50'·null·NaN·Infinity·배열)은 필드를 생략한다", () => {
    for (const trueNorth of [
      '50',
      null,
      true,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      [50],
      { deg: 50 },
    ]) {
      expect(sanitizeSceneInfo(scene({ trueNorth }))).not.toHaveProperty(
        'trueNorth',
      );
    }
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

  it("sunMode 는 'solar' 만 남기고 수동 방위·고도는 함께 보존한다", () => {
    expect(
      sanitizeSceneInfo(
        scene({ lighting: { sunMode: 'solar', sunAzimuth: 90 } }),
      ).lighting,
    ).toEqual({ sunMode: 'solar', sunAzimuth: 90 });
  });

  it("sunMode 'manual'·알 수 없는 값·타입 오염은 기본값(필드 생략)", () => {
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunMode: 'manual' } })),
    ).not.toHaveProperty('lighting');
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunMode: 'lunar' } })),
    ).not.toHaveProperty('lighting');
    expect(
      sanitizeSceneInfo(scene({ lighting: { sunMode: true } })),
    ).not.toHaveProperty('lighting');
  });
});

describe('sanitizeSceneInfo — 모델 영역(zones)', () => {
  it('zoneExempt 는 true 만 남긴다(문자열·false·없음은 undefined)', () => {
    const out = sanitizeSceneInfo(
      scene({
        models: [
          model({ id: 'a', zoneExempt: true }),
          model({ id: 'b', zoneExempt: 'yes' }),
          model({ id: 'c', zoneExempt: false }),
          model({ id: 'd' }),
        ],
      }),
    );
    expect(out.models.map((m) => m.zoneExempt)).toEqual([
      true,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('유효 항목만 남기고 색을 정규화하며, 전부 무효면 필드를 생략한다', () => {
    const out = sanitizeSceneInfo(
      scene({
        models: [
          model({
            zones: [
              { id: 'z1', name: 'A', color: '#FF0000', radius: 5 },
              { id: 'z2', name: 'B', color: '#00ff00', radius: 0 },
            ],
          }),
          model({ id: 'model-2', zones: [{ id: 'z', radius: -1 }] }),
          model({ id: 'model-3' }),
        ],
      }),
    );
    expect(out.models[0].zones).toEqual([
      { id: 'z1', name: 'A', color: '#ff0000', radius: 5 },
    ]);
    // undefined 는 JSON 직렬화에서 빠진다(locked·tagMappings 와 같은 규칙).
    expect(out.models[1].zones).toBeUndefined();
    expect(out.models[2].zones).toBeUndefined();
  });
});

describe('sanitizeSceneInfo — 상태 태그(statusTags)', () => {
  it('유효한 역할만 남기고, 전부 무효·미지정이면 필드를 생략한다', () => {
    const out = sanitizeSceneInfo(
      scene({
        models: [
          model({
            id: 'a',
            statusTags: { controlOn: ' A:on ', fault: 1, junk: 'A:x' },
          }),
          model({ id: 'b', statusTags: { controlOn: '' } }),
          model({ id: 'c', statusTags: ['A:on'] }),
          model({ id: 'd' }),
        ],
      }),
    );
    expect(out.models[0].statusTags).toEqual({ controlOn: 'A:on' });
    expect(out.models[1].statusTags).toBeUndefined();
    expect(out.models[2].statusTags).toBeUndefined();
    expect(out.models[3].statusTags).toBeUndefined();
  });

  it('무효인 필드는 저장본(JSON)에 남지 않는다', () => {
    const out = sanitizeSceneInfo(
      scene({ models: [model({ statusTags: { controlOn: '   ' } })] }),
    );
    const json = JSON.parse(JSON.stringify(out));
    expect('statusTags' in json.models[0]).toBe(false);
  });
});

describe('sanitizeSceneInfo — 거리 눈금(rulers)', () => {
  function ruler(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ruler-1',
      name: '1Dock 레일',
      position: [10, 5, -20],
      rotation: [0, 90, 0],
      length: 750,
      interval: 100,
      textColor: '#ffffff',
      dotColor: '#ffffff',
      ...overrides,
    };
  }

  it('유효한 눈금은 id 와 함께 보존한다', () => {
    const out = sanitizeSceneInfo(scene({ rulers: [ruler()] }));
    expect(out.rulers).toEqual([ruler()]);
  });

  it('눈금이 없거나 전부 무효·배열이 아니면 필드 자체가 빠진다', () => {
    for (const rulers of [
      undefined,
      [],
      [null, 'x', 3, {}],
      [ruler({ length: 0 })],
      { id: 'ruler-1' },
      'rulers',
    ]) {
      const out = sanitizeSceneInfo(scene({ rulers }));
      expect(out).not.toHaveProperty('rulers');
      expect('rulers' in JSON.parse(JSON.stringify(out))).toBe(false);
    }
  });

  it('깨진 항목만 버리고 나머지는 순서대로 살린다', () => {
    const out = sanitizeSceneInfo(
      scene({
        rulers: [
          ruler({ id: 'a' }),
          ruler({ id: 'b', length: Number.NaN }),
          null,
          ruler({ id: 'c', position: [1, 2] }),
          ruler({ id: 'd', guide: { length: 10, color: '#ffffff' } }),
        ],
      }),
    );
    expect(out.rulers?.map((r) => r.id)).toEqual(['a', 'd']);
    expect(out.rulers?.[1].guide).toEqual({ length: 10, color: '#ffffff' });
  });

  it('표시 옵션이 깨진 눈금은 버리지 않고 기본값으로 되돌린다', () => {
    const out = sanitizeSceneInfo(
      scene({
        rulers: [
          ruler({
            interval: 30,
            textColor: 'red',
            guide: { length: -1, color: '#ffffff' },
          }),
        ],
      }),
    );
    expect(out.rulers).toHaveLength(1);
    expect(out.rulers?.[0].interval).toBe(100);
    expect(out.rulers?.[0].textColor).toBe('#ffffff');
    expect(out.rulers?.[0]).not.toHaveProperty('guide');
  });

  it('id 가 없거나 비면 새로 발급한다', () => {
    const { id: _id, ...noId } = ruler();
    void _id;
    const out = sanitizeSceneInfo(
      scene({ rulers: [noId, ruler({ id: '' }), ruler({ id: 7 })] }),
    );
    const ids = out.rulers!.map((r) => r.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(
      true,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('중복 id 는 뒤의 것에 새 id 를 발급한다 (모델·텍스트와도 공유)', () => {
    const out = sanitizeSceneInfo(
      scene({
        models: [model({ id: 'shared' })],
        texts: [
          {
            id: 'text-1',
            content: 'T',
            color: '#ffffff',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        ],
        rulers: [
          ruler({ id: 'shared' }),
          ruler({ id: 'text-1' }),
          ruler({ id: 'own' }),
          ruler({ id: 'own' }),
        ],
      }),
    );
    const ids = out.rulers!.map((r) => r.id);
    expect(out.models[0].id).toBe('shared');
    expect(ids).toHaveLength(4);
    expect(ids).not.toContain('shared');
    expect(ids).not.toContain('text-1');
    expect(ids[2]).toBe('own');
    expect(ids[3]).not.toBe('own');
    expect(new Set([...ids, 'shared', 'text-1']).size).toBe(6);
  });

  it('스키마에 없는 scale 은 저장본에 남지 않는다', () => {
    const out = sanitizeSceneInfo(
      scene({ rulers: [ruler({ scale: [2, 2, 2] })] }),
    );
    expect(out.rulers?.[0]).not.toHaveProperty('scale');
  });

  it('정규화는 멱등이다 — 결과를 다시 넣어도 같다', () => {
    const once = sanitizeSceneInfo(
      scene({
        rulers: [
          ruler({
            textColor: '#FFAA00',
            startValue: 150,
            guide: { length: 10, color: '#00FF00', side: 'right', opacity: 0 },
          }),
          ruler({ id: 'r2', interval: 50, unitHidden: true, locked: true }),
        ],
      }),
    );
    expect(sanitizeSceneInfo(once)).toEqual(once);
  });
});

describe('sanitizeSceneInfo — 씬 뷰(views)·분할(viewSplit)', () => {
  const view = (id: string, name = id) => ({
    id,
    name,
    position: [1, 2, 3],
    target: [0, 0, 0],
  });

  it('뷰가 없는 씬은 두 필드 모두 빠진다 — 기존 저장본과 diff 0', () => {
    const out = sanitizeSceneInfo(scene());
    expect(out).not.toHaveProperty('views');
    expect(out).not.toHaveProperty('viewSplit');
    const empty = sanitizeSceneInfo(
      scene({ views: [], viewSplit: { slots: [null, null, null, null] } }),
    );
    expect(empty).not.toHaveProperty('views');
    expect(empty).not.toHaveProperty('viewSplit');
  });

  it('분할은 정규화된 뷰 목록 기준으로 걸러진다 — 버려진 뷰를 가리키는 칸은 빈다', () => {
    const out = sanitizeSceneInfo(
      scene({
        views: [view('a'), { id: 'broken', name: 'B', position: [1] }],
        viewSplit: { slots: ['a', 'broken', null, null], pinned: true },
      }),
    );
    expect(out.views!.map((v) => v.id)).toEqual(['a']);
    expect(out.viewSplit).toEqual({
      slots: ['a', null, null, null],
      pinned: true,
    });
  });

  it('뷰 id 는 씬 객체 id 와 겹쳐도 그대로 둔다 — 다른 집합이다', () => {
    const out = sanitizeSceneInfo(
      scene({ models: [model({ id: 'shared' })], views: [view('shared')] }),
    );
    expect(out.models[0].id).toBe('shared');
    expect(out.views![0].id).toBe('shared');
  });

  it('정규화는 멱등이다', () => {
    const once = sanitizeSceneInfo(
      scene({
        views: [view('a'), { ...view('b'), pinned: true }],
        viewSplit: { slots: ['b', 'a'] },
      }),
    );
    expect(sanitizeSceneInfo(once)).toEqual(once);
  });
});
