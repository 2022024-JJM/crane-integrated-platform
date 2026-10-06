import { describe, expect, it } from 'vitest';
import { withSceneAssetVersion } from '../scene-asset-update';
import type {
  SavedMapInfo,
  SavedModelInfo,
  SavedSceneInfo,
} from '../../model/types';

function model(overrides: Partial<SavedModelInfo> = {}): SavedModelInfo {
  return {
    id: 'm1',
    equipName: 'TTC',
    path: '/models/ttc.glb',
    asset: { id: 'ttc', version: 1 },
    opacity: 1,
    position: [1, 2, 3],
    rotation: [0, 90, 0],
    scale: [0.7, 0.7, 0.7],
    ...overrides,
  };
}

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return { maps: [], models: [], ...overrides };
}

const V2 = '/asset-library/files/ttc/v2/ttc.glb';

describe('withSceneAssetVersion', () => {
  it('그 자산을 가리키는 모델을 전부 새 버전으로 옮긴다', () => {
    const before = scene({
      models: [
        model({ id: 'a' }),
        model({ id: 'b' }),
        model({ id: 'c', path: '/models/oc.glb', asset: { id: 'oc', version: 1 } }),
      ],
    });
    const after = withSceneAssetVersion(before, 'ttc', 2, V2);
    expect(after.models.map((m) => [m.id, m.path, m.asset])).toEqual([
      ['a', V2, { id: 'ttc', version: 2 }],
      ['b', V2, { id: 'ttc', version: 2 }],
      ['c', '/models/oc.glb', { id: 'oc', version: 1 }],
    ]);
  });

  it('파일과 버전만 바꾼다 — 배치·이름·태그 맵핑은 그대로', () => {
    const tagMappings = [
      { id: 't', key: 'X', target: { kind: 'node' as const, nodePath: '', channel: 'position' as const, axis: 'x' as const } },
    ] as unknown as SavedModelInfo['tagMappings'];
    const original = model({ tagMappings, locked: true });
    const [updated] = withSceneAssetVersion(
      scene({ models: [original] }),
      'ttc',
      2,
      V2,
    ).models;
    expect(updated).toEqual({
      ...original,
      path: V2,
      asset: { id: 'ttc', version: 2 },
    });
    // 태그 맵핑은 같은 참조 그대로 실려 간다.
    expect(updated.tagMappings).toBe(tagMappings);
  });

  it('한 씬에 여러 버전이 섞여 있어도 전부 한 버전으로 모은다', () => {
    const after = withSceneAssetVersion(
      scene({
        models: [
          model({ id: 'a', asset: { id: 'ttc', version: 1 } }),
          model({ id: 'b', path: V2, asset: { id: 'ttc', version: 2 } }),
          model({ id: 'c', path: '/x/v3.glb', asset: { id: 'ttc', version: 3 } }),
        ],
      }),
      'ttc',
      2,
      V2,
    );
    expect(after.models.every((m) => m.asset?.version === 2 && m.path === V2)).toBe(
      true,
    );
  });

  it('지도와 배경도 같은 규칙으로 옮긴다', () => {
    const map: SavedMapInfo = {
      id: 'map',
      path: '/maps/okpo.glb',
      asset: { id: 'map-okpo', version: 1 },
      role: 'ground',
      locked: true,
      cameraBounds: true,
    };
    const before = scene({
      maps: [map],
      environment: { path: '/scenes/sky.exr', asset: { id: 'sky', version: 1 } },
    });
    const withMap = withSceneAssetVersion(before, 'map-okpo', 2, '/m/v2.glb');
    expect(withMap.maps[0]).toEqual({
      ...map,
      path: '/m/v2.glb',
      asset: { id: 'map-okpo', version: 2 },
    });
    // 다른 자산(배경)은 같은 참조 그대로다.
    expect(withMap.environment).toBe(before.environment);

    const withSky = withSceneAssetVersion(before, 'sky', 3, '/s/v3.exr');
    expect(withSky.environment).toEqual({
      path: '/s/v3.exr',
      asset: { id: 'sky', version: 3 },
    });
    expect(withSky.maps).toBe(before.maps);
  });

  it('바뀐 것이 없으면 같은 참조를 돌려준다 — 이미 그 버전', () => {
    const before = scene({ models: [model()] });
    expect(withSceneAssetVersion(before, 'ttc', 1, '/models/ttc.glb')).toBe(
      before,
    );
  });

  it('바뀐 것이 없으면 같은 참조를 돌려준다 — 씬에 없는 자산', () => {
    const before = scene({ models: [model()] });
    expect(withSceneAssetVersion(before, 'nobody', 2, '/x.glb')).toBe(before);
  });

  it('바뀌지 않은 객체와 배열은 참조를 유지한다', () => {
    const untouched = model({ id: 'x', asset: { id: 'oc', version: 1 } });
    const before = scene({
      models: [model({ id: 'a' }), untouched],
      maps: [{ id: 'map', path: '/maps/a.glb' }],
    });
    const after = withSceneAssetVersion(before, 'ttc', 2, V2);
    expect(after).not.toBe(before);
    expect(after.models[1]).toBe(untouched);
    expect(after.maps).toBe(before.maps);
  });

  it('버전은 같고 경로만 다른 것도 맞춘다(참조와 경로가 어긋난 저장본)', () => {
    const before = scene({
      models: [model({ path: '/models/old-name.glb' })],
    });
    const after = withSceneAssetVersion(before, 'ttc', 1, '/models/ttc.glb');
    expect(after.models[0].path).toBe('/models/ttc.glb');
  });

  it('자산 참조가 없는 객체는 건드리지 않는다 — 같은 경로여도', () => {
    const unmanaged = model({ asset: undefined });
    const before = scene({ models: [unmanaged] });
    expect(withSceneAssetVersion(before, 'ttc', 2, V2)).toBe(before);
  });

  it('빈 자산 id·빈 경로는 아무것도 하지 않는다', () => {
    const before = scene({ models: [model()] });
    expect(withSceneAssetVersion(before, '', 2, V2)).toBe(before);
    expect(withSceneAssetVersion(before, 'ttc', 2, '')).toBe(before);
  });

  it('배경이 없는 씬에 배경 필드를 만들지 않는다', () => {
    const after = withSceneAssetVersion(
      scene({ models: [model()] }),
      'ttc',
      2,
      V2,
    );
    expect(after).not.toHaveProperty('environment');
  });

  it('빈 씬은 같은 참조다', () => {
    const empty = scene();
    expect(withSceneAssetVersion(empty, 'ttc', 2, V2)).toBe(empty);
  });

  it('입력 씬을 고치지 않는다', () => {
    const before = scene({ models: [model()] });
    const snapshot = JSON.stringify(before);
    withSceneAssetVersion(before, 'ttc', 2, V2);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
