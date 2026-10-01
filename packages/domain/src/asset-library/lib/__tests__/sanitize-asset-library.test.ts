import { describe, expect, it } from 'vitest';
import {
  ASSET_HISTORY_MAX,
  ASSET_TAGS_MAX,
} from '../../model/types';
import {
  createEmptyAssetLibraryDocument,
  sanitizeAssetLibraryDocument,
  sanitizeAssetRecord,
  sanitizeAssetSites,
  sanitizeAssetStats,
  sanitizeAssetStatsTable,
  sanitizeAssetTags,
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
      assets: [],
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
      origin: 'whatever',
      name: 42,
      description: null,
      sites: 'okpo',
      tags: { a: 1 },
      owner: [],
      defaultScale: [1, 'x', 1],
      relatedAssetIds: 'none',
      versions: [version()],
      currentVersion: 'one',
      history: 'none',
    });
    expect(result).toMatchObject({
      origin: 'user',
      // 이름이 비면 id 로 대신한다.
      name: 'a',
      description: '',
      sites: [],
      tags: [],
      owner: '',
      defaultScale: [1, 1, 1],
      relatedAssetIds: [],
      currentVersion: 1,
      history: [],
    });
  });

  it('0·음수·NaN 스케일은 [1,1,1] 로 돌린다', () => {
    for (const scale of [[0, 1, 1], [1, -1, 1], [1, Number.NaN, 1], [1, 1]]) {
      expect(sanitizeAssetRecord({ ...asset(), defaultScale: scale })?.defaultScale).toEqual([1, 1, 1]);
    }
    expect(sanitizeAssetRecord(asset({ defaultScale: [0.1, 0.1, 0.1] }))?.defaultScale).toEqual([0.1, 0.1, 0.1]);
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

describe('sanitizeAssetTags', () => {
  it('공백을 다듬고 대소문자만 다른 중복을 버린다', () => {
    expect(sanitizeAssetTags([' crane ', 'Crane', '', 3, 'ship'])).toEqual([
      'crane',
      'ship',
    ]);
  });

  it('상한 개수에서 자른다', () => {
    const tags = Array.from({ length: ASSET_TAGS_MAX + 1 }, (_, i) => `t${i}`);
    expect(sanitizeAssetTags(tags)).toHaveLength(ASSET_TAGS_MAX);
    expect(sanitizeAssetTags(tags.slice(0, ASSET_TAGS_MAX))).toHaveLength(ASSET_TAGS_MAX);
  });
});

describe('sanitizeAssetSites', () => {
  it('아는 조선소만 표의 순서로 남긴다', () => {
    expect(sanitizeAssetSites(['philly', 'mars', 'okpo', 'okpo'])).toEqual([
      'okpo',
      'philly',
    ]);
    expect(sanitizeAssetSites('okpo')).toEqual([]);
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

  it('이 앱보다 새 스키마는 던진다 — 정확히 같은 판은 통과', () => {
    expect(() =>
      assertReadableAssetLibraryDocument({ schemaVersion: 1, assets: [] }),
    ).not.toThrow();
    expect(() =>
      assertReadableAssetLibraryDocument({ schemaVersion: 2, assets: [] }),
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
