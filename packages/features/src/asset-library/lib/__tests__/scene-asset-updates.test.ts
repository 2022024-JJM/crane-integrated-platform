import { describe, expect, it } from 'vitest';
import type { SavedModelInfo, SavedSceneInfo } from '@crane/domain/3d';
import type {
  AssetKind,
  AssetRecord,
  AssetVersionStatus,
} from '@crane/domain/asset-library';
import {
  countSceneAssetIssues,
  listSceneAssetUpdates,
} from '../scene-asset-updates';

/** 버전 `count` 개짜리 자산 — v1 은 옛 배포 경로, 그 뒤는 라이브러리 경로. */
function asset(
  id: string,
  options: {
    kind?: AssetKind;
    current?: number;
    statuses?: AssetVersionStatus[];
    browserOnly?: number;
  } = {},
): AssetRecord {
  const statuses = options.statuses ?? ['published'];
  return {
    id,
    kind: options.kind ?? 'model',
    name: id.toUpperCase(),
    description: '',
    categories: [],
    owner: '',
    relatedAssetIds: [],
    versions: statuses.map((status, index) => {
      const version = index + 1;
      return {
        version,
        status,
        file: {
          ref:
            options.browserOnly === version
              ? { storage: 'browser', key: `files/${id}/v${version}/${id}.glb` }
              : {
                  storage: 'public',
                  path:
                    version === 1
                      ? `/models/${id}.glb`
                      : `/asset-library/files/${id}/v${version}/${id}.glb`,
                },
          fileName: `${id}.glb`,
          format: 'glb',
          sizeBytes: null,
          contentHash: null,
        },
        note: '',
        createdAt: '',
        createdBy: '',
      };
    }),
    currentVersion: options.current ?? statuses.length,
    createdAt: '',
    updatedAt: '',
    history: [],
  };
}

function model(
  id: string,
  ref?: { id: string; version: number },
): SavedModelInfo {
  return {
    id,
    equipName: id,
    path: ref ? `/models/${ref.id}.glb` : '/models/unknown.glb',
    ...(ref ? { asset: ref } : {}),
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return { maps: [], models: [], ...overrides };
}

const TTC_V2 = asset('ttc', { statuses: ['published', 'published'] });

describe('listSceneAssetUpdates', () => {
  it('씬이 없거나 비어 있으면 빈 목록', () => {
    expect(listSceneAssetUpdates(null, [TTC_V2])).toEqual([]);
    expect(listSceneAssetUpdates(undefined, [TTC_V2])).toEqual([]);
    expect(listSceneAssetUpdates(scene(), [TTC_V2])).toEqual([]);
  });

  it('놓인 버전이 현재 버전과 같으면 알리지 않는다', () => {
    expect(
      listSceneAssetUpdates(
        scene({ models: [model('a', { id: 'ttc', version: 2 })] }),
        [TTC_V2],
      ),
    ).toEqual([]);
  });

  it('현재 버전이 달라진 자산을 한 줄로 — 놓인 개수와 갈 버전·경로를 싣는다', () => {
    const updates = listSceneAssetUpdates(
      scene({
        models: [
          model('a', { id: 'ttc', version: 1 }),
          model('b', { id: 'ttc', version: 1 }),
          model('c', { id: 'ttc', version: 1 }),
        ],
      }),
      [TTC_V2],
    );
    expect(updates).toEqual([
      {
        assetId: 'ttc',
        kind: 'model',
        name: 'TTC',
        fromVersions: [1],
        toVersion: 2,
        toPath: '/asset-library/files/ttc/v2/ttc.glb',
        count: 3,
      },
    ]);
  });

  it('이미 현재 버전인 것은 세지 않는다 — 한 씬에 버전이 섞여 있을 때', () => {
    const three = asset('ttc', {
      statuses: ['published', 'published', 'published'],
    });
    const [update] = listSceneAssetUpdates(
      scene({
        models: [
          model('a', { id: 'ttc', version: 2 }),
          model('b', { id: 'ttc', version: 3 }),
          model('c', { id: 'ttc', version: 1 }),
          model('d', { id: 'ttc', version: 2 }),
        ],
      }),
      [three],
    );
    expect(update.count).toBe(3);
    // 놓인(현재가 아닌) 버전들 — 오름차순, 중복 없이.
    expect(update.fromVersions).toEqual([1, 2]);
    expect(update.toVersion).toBe(3);
  });

  it('현재 버전이 놓인 버전보다 낮아도(롤백) 갱신 대상이다', () => {
    const rolledBack = asset('ttc', {
      statuses: ['published', 'published'],
      current: 1,
    });
    const [update] = listSceneAssetUpdates(
      scene({ models: [model('a', { id: 'ttc', version: 2 })] }),
      [rolledBack],
    );
    expect(update).toMatchObject({
      fromVersions: [2],
      toVersion: 1,
      toPath: '/models/ttc.glb',
    });
  });

  it.each(['draft', 'in-review', 'approved', 'rejected', 'withdrawn'] as const)(
    '현재 버전이 게시 상태가 아니면(%s) 알리지 않는다',
    (status) => {
      const pending = asset('ttc', { statuses: ['published', status] });
      expect(
        listSceneAssetUpdates(
          scene({ models: [model('a', { id: 'ttc', version: 1 })] }),
          [pending],
        ),
      ).toEqual([]);
    },
  );

  it('현재 버전의 파일이 브라우저에만 있으면 알리지 않는다', () => {
    const local = asset('ttc', {
      statuses: ['published', 'published'],
      browserOnly: 2,
    });
    expect(
      listSceneAssetUpdates(
        scene({ models: [model('a', { id: 'ttc', version: 1 })] }),
        [local],
      ),
    ).toEqual([]);
  });

  it('라이브러리에 없는 자산과 참조가 없는 객체는 갱신 대상이 아니다', () => {
    expect(
      listSceneAssetUpdates(
        scene({
          models: [model('a', { id: 'gone', version: 1 }), model('b')],
        }),
        [TTC_V2],
      ),
    ).toEqual([]);
  });

  it('지도와 배경도 찾는다 — 순서는 모델, 지도, 배경', () => {
    const map = asset('map-okpo', {
      kind: 'map',
      statuses: ['published', 'published'],
    });
    const sky = asset('sky', {
      kind: 'environment',
      statuses: ['published', 'published'],
    });
    const updates = listSceneAssetUpdates(
      scene({
        environment: { path: '/scenes/sky.exr', asset: { id: 'sky', version: 1 } },
        maps: [
          {
            id: 'm',
            path: '/maps/okpo.glb',
            asset: { id: 'map-okpo', version: 1 },
          },
        ],
        models: [model('a', { id: 'ttc', version: 1 })],
      }),
      [sky, map, TTC_V2],
    );
    expect(updates.map((update) => [update.assetId, update.kind])).toEqual([
      ['ttc', 'model'],
      ['map-okpo', 'map'],
      ['sky', 'environment'],
    ]);
  });

  it('여러 자산은 씬에 처음 나온 순서다', () => {
    const oc = asset('oc', { statuses: ['published', 'published'] });
    const updates = listSceneAssetUpdates(
      scene({
        models: [
          model('a', { id: 'oc', version: 1 }),
          model('b', { id: 'ttc', version: 1 }),
          model('c', { id: 'oc', version: 1 }),
        ],
      }),
      [TTC_V2, oc],
    );
    expect(updates.map((update) => [update.assetId, update.count])).toEqual([
      ['oc', 2],
      ['ttc', 1],
    ]);
  });

  it('입력을 고치지 않는다', () => {
    const input = scene({ models: [model('a', { id: 'ttc', version: 1 })] });
    const snapshot = JSON.stringify(input);
    listSceneAssetUpdates(input, [TTC_V2]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('countSceneAssetIssues', () => {
  it('씬이 없으면 전부 0', () => {
    expect(countSceneAssetIssues(null, [])).toEqual({
      unmanaged: 0,
      missing: 0,
    });
  });

  it('전부 라이브러리로 관리되면 0', () => {
    expect(
      countSceneAssetIssues(
        scene({ models: [model('a', { id: 'ttc', version: 1 })] }),
        [TTC_V2],
      ),
    ).toEqual({ unmanaged: 0, missing: 0 });
  });

  it('참조가 없는 객체는 unmanaged — 모델·지도·배경 모두 센다', () => {
    expect(
      countSceneAssetIssues(
        scene({
          models: [model('a'), model('b')],
          maps: [{ id: 'm', path: '/maps/x.glb' }],
          environment: { path: '/scenes/x.exr' },
        }),
        [],
      ),
    ).toEqual({ unmanaged: 4, missing: 0 });
  });

  it('자산이 없거나 그 버전이 없으면 missing', () => {
    expect(
      countSceneAssetIssues(
        scene({
          models: [
            model('a', { id: 'gone', version: 1 }),
            model('b', { id: 'ttc', version: 9 }),
            model('c', { id: 'ttc', version: 2 }),
          ],
        }),
        [TTC_V2],
      ),
    ).toEqual({ unmanaged: 0, missing: 2 });
  });

  it('배경이 없는 씬은 배경을 세지 않는다', () => {
    expect(countSceneAssetIssues(scene(), [])).toEqual({
      unmanaged: 0,
      missing: 0,
    });
  });
});
