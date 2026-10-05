import { describe, expect, it } from 'vitest';
import {
  ASSET_CATEGORIES_MAX,
  ASSET_HISTORY_MAX,
  ASSET_LIBRARY_SCHEMA_VERSION,
} from '../../model/types';
import {
  createEmptyAssetLibraryDocument,
  sanitizeAssetLibraryDocument,
  sanitizeAssetPlacement,
  sanitizeAssetRecord,
  sanitizeAssetStats,
  sanitizeAssetStatsTable,
  sanitizeAssetCategories,
  assertReadableAssetLibraryDocument,
  collectUnreadableAssetRecords,
} from '../sanitize-asset-library';
import { asset, version } from './fixtures';

describe('sanitizeAssetLibraryDocument', () => {
  it('객체가 아닌 입력은 빈 문서가 된다(던지지 않는다)', () => {
    for (const input of [null, undefined, 'x', 3, [], true]) {
      expect(sanitizeAssetLibraryDocument(input)).toEqual(
        createEmptyAssetLibraryDocument(),
      );
    }
  });

  it('assets·collections 가 배열이 아니면 빈 배열로 본다', () => {
    expect(
      sanitizeAssetLibraryDocument({ assets: 'x', collections: null }),
    ).toEqual(createEmptyAssetLibraryDocument());
  });

  it('깨진 항목만 버리고 나머지는 살린다', () => {
    const result = sanitizeAssetLibraryDocument({
      assets: [null, 'x', asset({ id: 'ok' }), { id: 'no-versions' }, 7],
    });
    expect(result.assets.map((a) => a.id)).toEqual(['ok']);
  });

  it('id 가 겹치면 먼저 온 것만 남긴다', () => {
    const result = sanitizeAssetLibraryDocument({
      assets: [asset({ id: 'dup', name: 'First' }), asset({ id: 'dup', name: 'Second' })],
    });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].name).toBe('First');
  });

  it('컬렉션은 id·이름이 있어야 하고 자산 id 는 형식이 맞는 것만 남는다', () => {
    const result = sanitizeAssetLibraryDocument({
      assets: [asset({ id: 'a' }), asset({ id: 'b' })],
      collections: [
        { id: 'yard', name: ' Yard ', assetIds: ['a', 'a', 'Bad Id', 3, 'b'] },
        { id: 'yard', name: 'Duplicate' },
        { id: 'no-name', name: '   ' },
        { id: 'Bad Id', name: 'x' },
        null,
      ],
    });
    expect(result.collections).toEqual([
      { id: 'yard', name: 'Yard', assetIds: ['a', 'b'] },
    ]);
  });

  it('없어진 자산을 가리키는 컬렉션 항목과 연결을 걷어낸다', () => {
    const result = sanitizeAssetLibraryDocument({
      assets: [
        asset({ id: 'a', relatedAssetIds: ['b', 'gone'] }),
        asset({ id: 'b' }),
      ],
      collections: [{ id: 'yard', name: 'Yard', assetIds: ['a', 'gone', 'b'] }],
    });
    expect(result.assets[0].relatedAssetIds).toEqual(['b']);
    expect(result.collections[0].assetIds).toEqual(['a', 'b']);
  });

  it('방어에서 떨어진 자산을 가리키던 연결도 걷어낸다', () => {
    const result = sanitizeAssetLibraryDocument({
      assets: [
        asset({ id: 'a', relatedAssetIds: ['broken'] }),
        { ...asset({ id: 'broken' }), versions: [] },
      ],
      collections: [],
    });
    expect(result.assets.map((item) => item.id)).toEqual(['a']);
    expect(result.assets[0].relatedAssetIds).toEqual([]);
  });
});

describe('sanitizeAssetRecord', () => {
  it('id 형식이 틀리거나 종류를 모르거나 버전이 없으면 null', () => {
    expect(sanitizeAssetRecord(asset({ id: 'Bad Id' }))).toBeNull();
    expect(sanitizeAssetRecord({ ...asset(), kind: 'texture' })).toBeNull();
    expect(sanitizeAssetRecord(asset({ versions: [] }))).toBeNull();
    expect(sanitizeAssetRecord({ ...asset(), versions: 'x' })).toBeNull();
  });

  it('필드 타입이 오염돼도 기본값으로 살린다', () => {
    const result = sanitizeAssetRecord({
      id: 'a',
      kind: 'model',
      name: 42,
      description: null,
      categories: { a: 1 },
      owner: [],
      placement: 'floating',
      relatedAssetIds: 'none',
      versions: [version()],
      currentVersion: 'one',
      history: 'none',
    });
    expect(result).toMatchObject({
      // 이름이 비면 id 로 대신한다.
      name: 'a',
      description: '',
      categories: [],
      owner: '',
      relatedAssetIds: [],
      currentVersion: 1,
      history: [],
    });
    expect(result).not.toHaveProperty('placement');
  });

  it('옛 문서의 origin·catalogId·defaultScale 은 읽지 않는다', () => {
    const result = sanitizeAssetRecord({
      ...asset(),
      origin: 'builtin',
      catalogId: 'okpo-ttc',
      defaultScale: [0.1, 0.1, 0.1],
    });
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('origin');
    expect(result).not.toHaveProperty('catalogId');
    expect(result).not.toHaveProperty('defaultScale');
  });
});

describe('sanitizeAssetPlacement', () => {
  it('지도 — 역할과 기본 위치를 남긴다', () => {
    expect(
      sanitizeAssetPlacement(
        { mapRole: 'context', defaultPosition: [1, -2, 3.5] },
        'map',
      ),
    ).toEqual({ mapRole: 'context', defaultPosition: [1, -2, 3.5] });
  });

  it('기본 동작인 값은 싣지 않는다 — ground · 원점 · false', () => {
    expect(
      sanitizeAssetPlacement(
        { mapRole: 'ground', defaultPosition: [0, 0, 0], paletteHidden: false },
        'map',
      ),
    ).toBeUndefined();
    expect(sanitizeAssetPlacement({ floating: false }, 'model')).toBeUndefined();
  });

  it('한 축만 0 이 아니어도 기본 위치를 남긴다(경계)', () => {
    expect(
      sanitizeAssetPlacement({ defaultPosition: [0, -40.35, 0] }, 'map'),
    ).toEqual({ defaultPosition: [0, -40.35, 0] });
  });

  it('모델 — 수면에 놓기는 true 만 남긴다', () => {
    expect(sanitizeAssetPlacement({ floating: true }, 'model')).toEqual({
      floating: true,
    });
    for (const floating of ['yes', 1, null, undefined]) {
      expect(sanitizeAssetPlacement({ floating }, 'model')).toBeUndefined();
    }
  });

  it('팔레트 숨김은 씬에 쓰는 종류(모델·지도·배경)에 남는다', () => {
    for (const kind of ['model', 'map', 'environment'] as const) {
      expect(sanitizeAssetPlacement({ paletteHidden: true }, kind)).toEqual({
        paletteHidden: true,
      });
    }
  });

  it('씬에 쓰지 않는 종류(도면·CAD)에는 배치 속성이 없다', () => {
    const full = {
      paletteHidden: true,
      mapRole: 'context',
      defaultPosition: [1, 2, 3],
      floating: true,
    };
    expect(sanitizeAssetPlacement(full, 'drawing')).toBeUndefined();
    expect(sanitizeAssetPlacement(full, 'cad')).toBeUndefined();
  });

  it('종류에 맞지 않는 항목은 떨어진다', () => {
    const full = {
      mapRole: 'context',
      defaultPosition: [1, 2, 3],
      floating: true,
    };
    expect(sanitizeAssetPlacement(full, 'model')).toEqual({ floating: true });
    expect(sanitizeAssetPlacement(full, 'map')).toEqual({
      mapRole: 'context',
      defaultPosition: [1, 2, 3],
    });
    expect(sanitizeAssetPlacement(full, 'environment')).toBeUndefined();
  });

  it.each([
    ['모르는 역할', { mapRole: 'floor' }],
    ['역할이 숫자', { mapRole: 1 }],
    ['위치가 두 칸', { defaultPosition: [1, 2] }],
    ['위치에 NaN', { defaultPosition: [1, Number.NaN, 3] }],
    ['위치에 Infinity', { defaultPosition: [1, Number.POSITIVE_INFINITY, 3] }],
    ['위치에 문자열', { defaultPosition: [1, '2', 3] }],
    ['위치가 문자열', { defaultPosition: '1,2,3' }],
  ])('오염된 값(%s)은 버린다', (_label, value) => {
    expect(sanitizeAssetPlacement(value, 'map')).toBeUndefined();
  });

  it.each([undefined, null, 'floating', 3, [], true])(
    '객체가 아닌 입력 %j 은 undefined',
    (value) => {
      expect(sanitizeAssetPlacement(value, 'model')).toBeUndefined();
    },
  );

  it('위치는 새 배열로 돌려준다(입력을 들고 있지 않는다)', () => {
    const position = [1, 2, 3];
    const result = sanitizeAssetPlacement({ defaultPosition: position }, 'map');
    expect(result?.defaultPosition).toEqual([1, 2, 3]);
    expect(result?.defaultPosition).not.toBe(position);
  });
});

describe('sanitizeAssetRecord — 버전·포인터', () => {
  it('배치 속성을 종류에 맞게 거른다', () => {
    const result = sanitizeAssetRecord({
      ...asset({ kind: 'map' }),
      placement: { mapRole: 'context', floating: true },
    });
    expect(result?.placement).toEqual({ mapRole: 'context' });
  });

  it('현재 버전 포인터가 없는 버전을 가리키면 마지막 버전으로 맞춘다', () => {
    const result = sanitizeAssetRecord(
      asset({
        versions: [version({ version: 1 }), version({ version: 3 })],
        currentVersion: 2,
      }),
    );
    expect(result?.currentVersion).toBe(3);
  });

  it('버전은 번호순으로 정렬하고 겹치는 번호·깨진 버전을 버린다', () => {
    const result = sanitizeAssetRecord({
      ...asset(),
      versions: [
        version({ version: 2, note: 'two' }),
        version({ version: 1 }),
        version({ version: 2, note: 'dup' }),
        { version: 0, file: version().file },
        { version: 1.5, file: version().file },
        { version: 4 },
        null,
      ],
      currentVersion: 2,
    });
    expect(result?.versions.map((v) => [v.version, v.note])).toEqual([
      [1, ''],
      [2, 'two'],
    ]);
  });

  it('모르는 상태는 draft 로 본다', () => {
    const result = sanitizeAssetRecord({
      ...asset(),
      versions: [{ ...version(), status: 'done' }],
    });
    expect(result?.versions[0].status).toBe('draft');
  });

  it('상위 탈출이 든 파일 참조와 모르는 저장 위치는 버전째 버린다', () => {
    const file = version().file;
    const bad = [
      { storage: 'public', path: 'models/a.glb' },
      { storage: 'public', path: '/models/../secret' },
      { storage: 'browser', key: '' },
      { storage: 'browser', key: 'files/../x' },
      { storage: 's3', key: 'x' },
      null,
    ];
    for (const ref of bad) {
      expect(
        sanitizeAssetRecord({ ...asset(), versions: [{ ...version(), file: { ...file, ref } }] }),
      ).toBeNull();
    }
  });

  it('파일 크기가 음수·NaN 이면 null, 파일명이 없으면 경로에서 딴다', () => {
    const result = sanitizeAssetRecord({
      ...asset(),
      versions: [
        {
          ...version(),
          file: {
            ref: { storage: 'public', path: '/models/crane.GLB' },
            sizeBytes: -5,
          },
        },
      ],
    });
    expect(result?.versions[0].file).toMatchObject({
      fileName: 'crane.GLB',
      format: 'glb',
      sizeBytes: null,
      contentHash: null,
    });
  });

  it('자기 자신과 형식이 틀린 id 는 연결 목록에서 뺀다', () => {
    const result = sanitizeAssetRecord({
      ...asset({ id: 'self' }),
      relatedAssetIds: ['self', 'other', 'other', 'Bad Id', null],
    });
    expect(result?.relatedAssetIds).toEqual(['other']);
  });

  it('이력은 모르는 동작·겹치는 id 를 버리고 최근 것만 상한까지 남긴다', () => {
    const entries = Array.from({ length: ASSET_HISTORY_MAX + 5 }, (_, i) => ({
      id: `e${i}`,
      at: '2026-01-01T00:00:00.000Z',
      actor: 'a',
      action: 'metadata',
    }));
    const result = sanitizeAssetRecord({
      ...asset(),
      history: [
        { id: 'x', action: 'hacked' },
        { id: 'e0', action: 'created' },
        ...entries,
        null,
      ],
    });
    expect(result?.history).toHaveLength(ASSET_HISTORY_MAX);
    // 앞쪽(오래된 것)이 잘린다.
    expect(result?.history.at(-1)?.id).toBe(`e${ASSET_HISTORY_MAX + 4}`);
  });

  it('해석되지 않는 시각은 빈 문자열(알 수 없음)이 된다', () => {
    const result = sanitizeAssetRecord({ ...asset(), createdAt: 'yesterday', updatedAt: 5 });
    expect(result?.createdAt).toBe('');
    expect(result?.updatedAt).toBe('');
  });
});

describe('sanitizeAssetCategories', () => {
  it('공백을 다듬고 대소문자만 다른 중복을 버린다', () => {
    expect(sanitizeAssetCategories([' crane ', 'Crane', '', 3, 'ship'])).toEqual([
      'crane',
      'ship',
    ]);
  });

  it('상한 개수에서 자른다', () => {
    const categories = Array.from({ length: ASSET_CATEGORIES_MAX + 1 }, (_, i) => `t${i}`);
    expect(sanitizeAssetCategories(categories)).toHaveLength(ASSET_CATEGORIES_MAX);
    expect(sanitizeAssetCategories(categories.slice(0, ASSET_CATEGORIES_MAX))).toHaveLength(ASSET_CATEGORIES_MAX);
  });
});

describe('sanitizeAssetRecord — 구버전 필드', () => {
  it('조선소·분류 필드가 남은 옛 레코드도 읽고, 그 키는 버린다', () => {
    const result = sanitizeAssetRecord({
      ...asset({ categories: ['crane'] }),
      sites: ['okpo'],
      category: 'indoor',
    });
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('sites');
    expect(result).not.toHaveProperty('category');
    // 옛 값은 카테고리로 옮겨 오지 않는다 — 배포 문서는 이미 옮겨져 있다.
    expect(result?.categories).toEqual(['crane']);
  });

  it('옛 필드가 오염돼 있어도 레코드를 버리지 않는다', () => {
    for (const legacy of [
      { sites: 'okpo', category: 42 },
      { sites: null, category: null },
      { sites: [null, 7], category: { a: 1 } },
    ]) {
      expect(sanitizeAssetRecord({ ...asset(), ...legacy })).toEqual(asset());
    }
  });
});

describe('스키마 1 의 문서 — 카테고리를 `tags` 로 적던 판', () => {
  /** 스키마 1 의 레코드 모양 — `categories` 대신 `tags`. */
  const legacy = (tags: unknown, extra: Record<string, unknown> = {}) => {
    const record: Record<string, unknown> = { ...asset(), tags, ...extra };
    if (!('categories' in extra)) delete record.categories;
    return record;
  };

  it('`tags` 를 카테고리로 읽고, 옛 키는 남기지 않는다', () => {
    const result = sanitizeAssetRecord(legacy(['indoor', 'crane']));
    expect(result?.categories).toEqual(['indoor', 'crane']);
    expect(result).not.toHaveProperty('tags');
  });

  it('옛 필드의 값도 같은 방어를 거친다 — 공백·중복·상한', () => {
    const many = Array.from(
      { length: ASSET_CATEGORIES_MAX + 3 },
      (_, i) => `c${i}`,
    );
    expect(sanitizeAssetRecord(legacy([' crane ', 'Crane', '', 3]))?.categories).toEqual([
      'crane',
    ]);
    expect(sanitizeAssetRecord(legacy(many))?.categories).toHaveLength(
      ASSET_CATEGORIES_MAX,
    );
  });

  it('두 필드가 다 있으면 새 필드가 이긴다 — 비어 있어도', () => {
    expect(
      sanitizeAssetRecord(legacy(['old'], { categories: ['new'] }))?.categories,
    ).toEqual(['new']);
    expect(
      sanitizeAssetRecord(legacy(['old'], { categories: [] }))?.categories,
    ).toEqual([]);
  });

  it('새 필드가 배열이 아니면 옛 필드를 읽는다', () => {
    for (const broken of ['crane', null, { a: 1 }, 3]) {
      expect(
        sanitizeAssetRecord(legacy(['old'], { categories: broken }))?.categories,
      ).toEqual(['old']);
    }
  });

  it('옛 필드가 오염돼 있거나 둘 다 없어도 레코드를 버리지 않는다', () => {
    for (const broken of ['crane', null, { a: 1 }, 3, undefined]) {
      expect(sanitizeAssetRecord(legacy(broken))?.categories).toEqual([]);
    }
  });

  it('이력이 적은 옛 필드 이름을 새 이름으로 읽는다 — 다른 이름은 그대로', () => {
    const result = sanitizeAssetRecord({
      ...asset(),
      history: [
        { id: 'h1', action: 'metadata', fields: ['tags', 'name'] },
        { id: 'h2', action: 'metadata', fields: ['sites'] },
      ],
    });
    expect(result?.history.map((entry) => entry.fields)).toEqual([
      ['categories', 'name'],
      ['sites'],
    ]);
  });

  it('옛 이름과 새 이름이 한 이력에 함께 있으면 한 번만 남는다', () => {
    const result = sanitizeAssetRecord({
      ...asset(),
      history: [
        { id: 'h1', action: 'metadata', fields: ['tags', 'categories', 'tags'] },
      ],
    });
    expect(result?.history[0].fields).toEqual(['categories']);
  });

  it('문서를 읽으면 이 앱의 스키마 판이 된다', () => {
    const result = sanitizeAssetLibraryDocument({
      schemaVersion: 1,
      assets: [legacy(['crane'])],
      collections: [],
    });
    expect(result.schemaVersion).toBe(ASSET_LIBRARY_SCHEMA_VERSION);
    expect(result.assets[0].categories).toEqual(['crane']);
  });

  it('읽지 못한 레코드로 치지 않는다 — 저장할 때 도로 붙지 않는다', () => {
    expect(
      collectUnreadableAssetRecords({
        schemaVersion: 1,
        assets: [legacy(['crane'])],
      }),
    ).toEqual([]);
  });
});

describe('sanitizeAssetStats', () => {
  it('객체가 아니면 undefined', () => {
    expect(sanitizeAssetStats(null)).toBeUndefined();
    expect(sanitizeAssetStats([1])).toBeUndefined();
  });

  it('음수·NaN·문자열 수치는 0, LOD 단계는 최소 1, 음수 크기는 null', () => {
    expect(
      sanitizeAssetStats({
        triangles: -1,
        vertices: Number.NaN,
        meshes: '3',
        drawCalls: 2.9,
        lodLevels: 0,
        size: [1, -2, 3],
      }),
    ).toEqual({
      triangles: 0,
      vertices: 0,
      meshes: 0,
      materials: 0,
      textures: 0,
      drawCalls: 2,
      nodes: 0,
      textureMemoryBytes: 0,
      size: null,
      lodLevels: 1,
      animations: 0,
    });
  });
});

describe('sanitizeAssetStatsTable', () => {
  it('절대 경로 키와 hash·bytes 가 있는 항목만 남긴다', () => {
    expect(
      sanitizeAssetStatsTable({
        '/models/a.glb': { hash: 'abcd', bytes: 10.7, stats: { triangles: 5 } },
        'models/b.glb': { hash: 'x', bytes: 1 },
        '/models/c.glb': { hash: 3, bytes: 1 },
        '/models/d.glb': { hash: 'x', bytes: 'big' },
        '/models/e.glb': null,
      }),
    ).toEqual({
      '/models/a.glb': {
        hash: 'abcd',
        bytes: 10,
        stats: expect.objectContaining({ triangles: 5, lodLevels: 1 }),
      },
    });
    expect(sanitizeAssetStatsTable('nope')).toEqual({});
  });
});

describe('assertReadableAssetLibraryDocument', () => {
  it('객체이고 assets 가 배열(또는 없음)이면 통과', () => {
    expect(() => assertReadableAssetLibraryDocument({})).not.toThrow();
    expect(() =>
      assertReadableAssetLibraryDocument({ schemaVersion: 1, assets: [] }),
    ).not.toThrow();
  });

  it('객체가 아니거나 assets 가 배열이 아니면 던진다', () => {
    for (const value of [null, undefined, 'x', 3, [], { assets: 'no' }, { assets: {} }]) {
      expect(() => assertReadableAssetLibraryDocument(value)).toThrow();
    }
  });

  it('이 앱보다 새 스키마는 던진다 — 정확히 같은 판과 옛 판은 통과', () => {
    expect(() =>
      assertReadableAssetLibraryDocument({
        schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
        assets: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertReadableAssetLibraryDocument({ schemaVersion: 1, assets: [] }),
    ).not.toThrow();
    expect(() =>
      assertReadableAssetLibraryDocument({
        schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION + 1,
        assets: [],
      }),
    ).toThrow();
  });
});

describe('collectUnreadableAssetRecords', () => {
  it('방어를 통과하지 못한 레코드를 원본 그대로 돌려준다', () => {
    const good = asset({ id: 'good' });
    const broken = { id: 'BAD ID', kind: 'model' };
    const duplicate = asset({ id: 'good', name: '둘째' });
    expect(
      collectUnreadableAssetRecords({ assets: [good, broken, null, duplicate] }),
    ).toEqual([broken, null, duplicate]);
  });

  it('전부 읽히면 빈 목록, 문서가 이상하면 빈 목록', () => {
    expect(collectUnreadableAssetRecords({ assets: [asset()] })).toEqual([]);
    expect(collectUnreadableAssetRecords(null)).toEqual([]);
    expect(collectUnreadableAssetRecords({ assets: 'no' })).toEqual([]);
  });
});

describe('파일 경로의 상위 탈출 판정', () => {
  const withPath = (path: string) =>
    sanitizeAssetLibraryDocument({
      assets: [
        asset({
          versions: [
            version({
              file: {
                ref: { storage: 'public', path },
                fileName: 'a.glb',
                format: 'glb',
                sizeBytes: null,
                contentHash: null,
              },
            }),
          ],
        }),
      ],
    }).assets;

  it('조각이 .. 인 경로는 버린다', () => {
    expect(withPath('/models/../secret.glb')).toEqual([]);
    expect(withPath('/..')).toEqual([]);
  });

  it('파일 이름 안의 이어진 점은 탈출이 아니다', () => {
    expect(withPath('/asset-library/files/a/v1/crane..v2.glb')).toHaveLength(1);
  });
});

describe('원본 크기(최적화 기록)', () => {
  const withOriginal = (originalSizeBytes: unknown) =>
    sanitizeAssetLibraryDocument({
      assets: [
        asset({
          versions: [
            version({
              file: { ...version().file, originalSizeBytes } as never,
            }),
          ],
        }),
      ],
    }).assets[0].versions[0].file;

  it('양수만 받고 정수로 내린다', () => {
    expect(withOriginal(1234.9).originalSizeBytes).toBe(1234);
  });

  it('0·음수·숫자가 아닌 값·NaN 은 필드 자체를 두지 않는다', () => {
    for (const value of [0, -5, '100', Number.NaN, null, undefined]) {
      expect(withOriginal(value)).not.toHaveProperty('originalSizeBytes');
    }
  });
});
