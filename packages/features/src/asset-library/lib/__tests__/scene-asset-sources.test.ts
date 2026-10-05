import { describe, expect, it } from 'vitest';
import { collectSceneAssetRefs } from '../scene-asset-sources';

describe('collectSceneAssetRefs', () => {
  it('빈 씬은 빈 목록', () => {
    expect(collectSceneAssetRefs({ models: [], maps: [] })).toEqual([]);
  });

  it('모델·지도·배경의 경로와 자산 참조를 그 순서로 모은다', () => {
    const refs = collectSceneAssetRefs({
      models: [
        {
          id: 'a',
          equipName: 'A',
          path: '/models/a.glb',
          asset: { id: 'a', version: 2 },
          opacity: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ],
      maps: [
        { id: 'm', path: '/maps/m.glb', asset: { id: 'map-m', version: 1 } },
      ],
      environment: { path: '/scenes/sky.exr', asset: { id: 'sky', version: 1 } },
    });
    expect(refs).toEqual([
      { path: '/models/a.glb', asset: { id: 'a', version: 2 } },
      { path: '/maps/m.glb', asset: { id: 'map-m', version: 1 } },
      { path: '/scenes/sky.exr', asset: { id: 'sky', version: 1 } },
    ]);
  });

  it('자산 참조가 없는 객체는 경로만 싣는다(asset 키를 만들지 않는다)', () => {
    const refs = collectSceneAssetRefs({
      models: [
        {
          id: 'a',
          equipName: 'A',
          path: '/models/a.glb',
          opacity: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ],
      maps: [{ id: 'm', path: '/maps/m.glb' }],
      environment: { path: '/scenes/sky.exr' },
    });
    expect(refs).toEqual([
      { path: '/models/a.glb' },
      { path: '/maps/m.glb' },
      { path: '/scenes/sky.exr' },
    ]);
    for (const ref of refs) expect(ref).not.toHaveProperty('asset');
  });

  it('같은 자산을 여러 번 놓았으면 놓인 만큼 싣는다', () => {
    const model = {
      id: 'a',
      equipName: 'A',
      path: '/models/a.glb',
      asset: { id: 'a', version: 1 },
      opacity: 1,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    expect(
      collectSceneAssetRefs({
        models: [model, { ...model, id: 'b' }],
        maps: [],
      }),
    ).toHaveLength(2);
  });
});
