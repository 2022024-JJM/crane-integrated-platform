import { describe, expect, it } from 'vitest';
import {
  buildAssetUsageIndex,
  countAssetPlacements,
  getAssetUsage,
  type SceneAssetSource,
} from '../asset-usage';
import { asset, version } from './fixtures';

const okpo: SceneAssetSource = {
  sceneFile: 'okpo.json',
  regionIds: ['dock-1', 'dock-2'],
  editorPath: '/outdoor-work/dock-1/3d-viewer-edit',
  modelPaths: ['/models/a.glb', '/models/a.glb', '/models/b.glb', ''],
  mapPaths: ['/maps/okpo.glb'],
};
const philly: SceneAssetSource = {
  sceneFile: 'philly.json',
  regionIds: ['philly-dock-2'],
  editorPath: '/outdoor-work/philly-dock-2/3d-viewer-edit',
  modelPaths: ['/models/a.glb'],
  mapPaths: [],
};

describe('buildAssetUsageIndex', () => {
  it('씬마다 파일별 배치 개수를 센다(빈 경로는 뺀다)', () => {
    const index = buildAssetUsageIndex([okpo, philly]);
    expect(index.get('/models/a.glb')).toEqual([
      expect.objectContaining({ sceneFile: 'okpo.json', count: 2 }),
      expect.objectContaining({ sceneFile: 'philly.json', count: 1 }),
    ]);
    expect(index.get('/maps/okpo.glb')?.[0].count).toBe(1);
    expect(index.has('')).toBe(false);
  });

  it('씬이 없으면 빈 인덱스', () => {
    expect(buildAssetUsageIndex([]).size).toBe(0);
  });
});

describe('getAssetUsage / countAssetPlacements', () => {
  const index = buildAssetUsageIndex([okpo, philly]);
  const file = (path: string) => ({ ...version().file, ref: { storage: 'public' as const, path } });

  it('버전별로 그 파일을 쓰는 씬을 모은다', () => {
    const record = asset({
      versions: [
        version({ version: 1, file: file('/models/a.glb') }),
        version({ version: 2, file: file('/models/unused.glb') }),
      ],
    });
    expect(getAssetUsage(record, index)).toEqual([
      { version: 1, usages: index.get('/models/a.glb') },
    ]);
    expect(countAssetPlacements(record, index)).toBe(3);
  });

  it('브라우저에만 있는 버전은 경로가 같아 보여도 미사용이다', () => {
    const record = asset({
      versions: [
        version({
          file: { ...version().file, ref: { storage: 'browser', key: '/models/a.glb' } },
        }),
      ],
    });
    expect(getAssetUsage(record, index)).toEqual([]);
    expect(countAssetPlacements(record, index)).toBe(0);
  });
});
