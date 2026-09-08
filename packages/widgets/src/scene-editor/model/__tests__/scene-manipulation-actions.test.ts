import { describe, expect, it, vi } from 'vitest';
import type {
  SavedSceneInfo,
  SceneMapCatalogItem,
  SceneModelCatalogItem,
} from '@crane/domain/3d';
import {
  SCENE_SUN_AZIMUTH_DEFAULT,
  SCENE_SUN_ELEVATION_DEFAULT,
  SCENE_SUN_ELEVATION_MIN,
} from '@crane/domain/3d';
import { createSceneManipulationActions } from '../scene-manipulation-actions';

const catalogModel: SceneModelCatalogItem = {
  id: 'cat-crane',
  label: 'Crane',
  category: 'outdoor',
  path: '/models/crane.glb',
  defaultScale: [1, 2, 1],
};

const catalogMap: SceneMapCatalogItem = {
  id: 'map-okpo',
  label: 'Okpo',
  path: '/maps/okpo.glb',
};

function scene(overrides: Partial<SavedSceneInfo> = {}): SavedSceneInfo {
  return { maps: [], models: [], texts: [], camera: null, ...overrides };
}

/**
 * 히스토리 훅 없이 액션 팩토리만 검증하는 최소 하니스 —
 * updateScene은 updater를 즉시 적용해 현재 씬을 교체한다.
 */
function createHarness(initial: SavedSceneInfo | null = scene()) {
  const sceneInfoRef = { current: initial };
  const transformHistoryBaseRef = { current: null as SavedSceneInfo | null };
  const selectedIds = new Set<string>();
  const updateOptions: Array<{ recordHistory?: boolean } | undefined> = [];

  const deps = {
    updateScene: vi.fn(
      (
        updater:
          | SavedSceneInfo
          | null
          | ((prev: SavedSceneInfo | null) => SavedSceneInfo | null),
        options?: { recordHistory?: boolean },
      ) => {
        const next =
          typeof updater === 'function'
            ? updater(sceneInfoRef.current)
            : updater;
        sceneInfoRef.current = next;
        updateOptions.push(options);
      },
    ),
    commitHistoryFrom: vi.fn(),
    selectModel: vi.fn(),
    selectText: vi.fn(),
    selectMap: vi.fn(),
    clearSelectedModel: vi.fn(),
    selectedIds,
    sceneInfoRef,
    selectAll: vi.fn(),
    transformHistoryBaseRef,
  };

  const actions = createSceneManipulationActions(deps);
  return {
    actions,
    deps,
    updateOptions,
    get scene() {
      return sceneInfoRef.current;
    },
  };
}

describe('addModel / addText', () => {
  it('카탈로그 항목으로 모델을 만들어 붙이고 선택한다', () => {
    const h = createHarness();
    h.actions.addModel(catalogModel, [3, 0, 5]);

    expect(h.scene?.models).toHaveLength(1);
    const added = h.scene!.models[0];
    expect(added).toMatchObject({
      equipName: 'Crane',
      path: '/models/crane.glb',
      position: [3, 0, 5],
      scale: [1, 2, 1],
      opacity: 1,
    });
    expect(h.deps.selectModel).toHaveBeenCalledWith(added.id);
  });

  it('텍스트를 추가하고 선택한다', () => {
    const h = createHarness();
    h.actions.addText([1, 1, 1]);
    expect(h.scene?.texts).toHaveLength(1);
    expect(h.deps.selectText).toHaveBeenCalledWith(h.scene!.texts![0].id);
  });

  it('씬이 없으면(로드 전) no-op', () => {
    const h = createHarness(null);
    h.actions.addModel(catalogModel, [0, 0, 0]);
    expect(h.scene).toBeNull();
  });
});

describe('삭제 — 잠금 방어', () => {
  it('잠긴 모델은 삭제되지 않는다', () => {
    const base = scene({
      models: [
        {
          id: 'locked',
          equipName: 'A',
          path: '/a.glb',
          opacity: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          valueMapList: [],
          locked: true,
        },
      ],
    });
    const h = createHarness(base);
    h.actions.deletePlacedModel('locked');
    expect(h.scene?.models).toHaveLength(1);
  });

  it('잠기지 않은 모델은 삭제되고, 선택 중이었다면 선택 해제된다', () => {
    const base = scene({
      models: [
        {
          id: 'free',
          equipName: 'A',
          path: '/a.glb',
          opacity: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          valueMapList: [],
        },
      ],
    });
    const h = createHarness(base);
    h.deps.selectedIds.add('free');
    h.actions.deletePlacedModel('free');
    expect(h.scene?.models).toHaveLength(0);
    expect(h.deps.clearSelectedModel).toHaveBeenCalled();
  });

  it('지도는 필드 없음 = 잠김이라 locked: false일 때만 삭제된다', () => {
    const h1 = createHarness(scene({ maps: [{ id: 'm', path: '/m.glb' }] }));
    h1.actions.deletePlacedMap('m');
    expect(h1.scene?.maps).toHaveLength(1);

    const h2 = createHarness(
      scene({ maps: [{ id: 'm', path: '/m.glb', locked: false }] }),
    );
    h2.actions.deletePlacedMap('m');
    expect(h2.scene?.maps).toHaveLength(0);
  });

  it('잠긴 텍스트는 삭제되지 않는다', () => {
    const text = {
      id: 't',
      content: 'T',
      color: '#fff',
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      locked: true,
    };
    const h = createHarness(scene({ texts: [text] }));
    h.actions.deletePlacedText('t');
    expect(h.scene?.texts).toHaveLength(1);

    const h2 = createHarness(scene({ texts: [{ ...text, locked: false }] }));
    h2.actions.deletePlacedText('t');
    expect(h2.scene?.texts).toHaveLength(0);
  });
});

describe('setSceneMap', () => {
  it('새 지도는 명시적 원점 transform + 잠금 해제 상태로 교체된다', () => {
    const h = createHarness(
      scene({ maps: [{ id: 'old', path: '/old.glb', locked: false }] }),
    );
    h.actions.setSceneMap(catalogMap);

    expect(h.scene?.maps).toHaveLength(1);
    expect(h.scene?.maps[0]).toMatchObject({
      path: '/maps/okpo.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      locked: false,
    });
  });

  it('현재 지도가 잠겨 있으면(기본값 포함) 교체·제거 모두 no-op', () => {
    const h = createHarness(scene({ maps: [{ id: 'm', path: '/m.glb' }] }));
    h.actions.setSceneMap(catalogMap);
    expect(h.scene?.maps[0].path).toBe('/m.glb');
    h.actions.setSceneMap(null);
    expect(h.scene?.maps).toHaveLength(1);
    expect(h.deps.updateScene).not.toHaveBeenCalled();
  });

  it('같은 path로의 교체는 no-op', () => {
    const h = createHarness(
      scene({ maps: [{ id: 'm', path: '/maps/okpo.glb', locked: false }] }),
    );
    h.actions.setSceneMap(catalogMap);
    expect(h.deps.updateScene).not.toHaveBeenCalled();
  });

  it('null이면 지도를 제거하고, 선택 중이었다면 선택 해제', () => {
    const h = createHarness(
      scene({ maps: [{ id: 'm', path: '/m.glb', locked: false }] }),
    );
    h.deps.selectedIds.add('m');
    h.actions.setSceneMap(null);
    expect(h.scene?.maps).toHaveLength(0);
    expect(h.deps.clearSelectedModel).toHaveBeenCalled();
  });

  it('지도가 없는데 null이면 no-op', () => {
    const h = createHarness();
    h.actions.setSceneMap(null);
    expect(h.deps.updateScene).not.toHaveBeenCalled();
  });
});

describe('setEnvironmentId', () => {
  it('배경을 바꾸고, 같은 값이면 참조를 유지한다', () => {
    const h = createHarness();
    h.actions.setEnvironmentId('sky-1');
    expect(h.scene?.environmentId).toBe('sky-1');

    const before = h.scene;
    h.actions.setEnvironmentId('sky-1');
    expect(h.scene).toBe(before);
  });

  it('null(배경 없음)을 명시적으로 저장한다', () => {
    const h = createHarness();
    h.actions.setEnvironmentId(null);
    expect(h.scene?.environmentId).toBeNull();
  });
});

describe('setLighting', () => {
  it('기본값 필드는 제거해 정규화한다 — 전부 기본값이면 lighting 자체가 빠진다', () => {
    const h = createHarness(scene({ lighting: { shadows: true } }));
    h.actions.setLighting({ shadows: false });
    expect(h.scene?.lighting).toBeUndefined();
  });

  it('방위각은 [0,360)로 랩한다 (sanitize와 같은 규칙)', () => {
    const h = createHarness();
    h.actions.setLighting({ sunAzimuth: 450 });
    expect(h.scene?.lighting).toEqual({ sunAzimuth: 90 });

    h.actions.setLighting({ sunAzimuth: SCENE_SUN_AZIMUTH_DEFAULT });
    expect(h.scene?.lighting).toBeUndefined();
  });

  it('고도는 [MIN, 90]로 클램프한다', () => {
    const h = createHarness();
    h.actions.setLighting({ sunElevation: 5 });
    expect(h.scene?.lighting).toEqual({ sunElevation: SCENE_SUN_ELEVATION_MIN });

    h.actions.setLighting({ sunElevation: SCENE_SUN_ELEVATION_DEFAULT });
    expect(h.scene?.lighting).toBeUndefined();
  });

  it('patch는 기존 값과 merge된다', () => {
    const h = createHarness(scene({ lighting: { shadows: true } }));
    h.actions.setLighting({ sunAzimuth: 90 });
    expect(h.scene?.lighting).toEqual({ shadows: true, sunAzimuth: 90 });
  });

  it('정규화 결과가 같으면 참조를 유지한다 (no-op이 히스토리에 안 쌓임)', () => {
    const h = createHarness(scene({ lighting: { sunAzimuth: 90 } }));
    const before = h.scene;
    h.actions.setLighting({ sunAzimuth: 90 });
    expect(h.scene).toBe(before);
  });

  it('recordHistory 옵션을 updateScene에 그대로 전달한다', () => {
    const h = createHarness();
    h.actions.setLighting({ sunAzimuth: 90 }, { recordHistory: false });
    expect(h.updateOptions.at(-1)).toEqual({ recordHistory: false });
  });
});

describe('duplicateSelectedObject', () => {
  const model = {
    id: 'm1',
    equipName: 'A',
    path: '/a.glb',
    opacity: 1,
    position: [10, 0, 5] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    valueMapList: [],
  };
  const text = {
    id: 't1',
    content: 'T',
    color: '#fff',
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    locked: true,
  };

  it('선택된 모델·텍스트를 +2(x)로 복제하고 새 복제본들을 선택한다', () => {
    const h = createHarness(scene({ models: [model], texts: [text] }));
    h.deps.selectedIds.add('m1');
    h.deps.selectedIds.add('t1');

    h.actions.duplicateSelectedObject();

    expect(h.scene?.models).toHaveLength(2);
    const dupModel = h.scene!.models[1];
    expect(dupModel.id).not.toBe('m1');
    expect(dupModel.position).toEqual([12, 0, 5]);

    const dupText = h.scene!.texts![1];
    // 복제본은 잠김을 물려받지 않는다.
    expect(dupText.locked).toBeUndefined();
    expect(dupText.position).toEqual([2, 0, 0]);

    expect(h.deps.selectAll).toHaveBeenCalledWith([
      { id: dupModel.id, type: 'model' },
      { id: dupText.id, type: 'text' },
    ]);
  });

  it('labelHidden 은 표시 설정이라 잠금과 달리 복제본에도 남는다 (특성화)', () => {
    const h = createHarness(
      scene({ models: [{ ...model, labelHidden: true }] }),
    );
    h.deps.selectedIds.add('m1');

    h.actions.duplicateSelectedObject();

    expect(h.scene!.models[1].labelHidden).toBe(true);
  });

  it('선택이 없거나 대상이 씬에 없으면 no-op', () => {
    const h = createHarness(scene({ models: [model] }));
    h.actions.duplicateSelectedObject();
    h.deps.selectedIds.add('ghost');
    h.actions.duplicateSelectedObject();
    expect(h.scene?.models).toHaveLength(1);
    expect(h.deps.selectAll).not.toHaveBeenCalled();
  });
});

describe('transform 인터랙션 히스토리', () => {
  it('start에서 base를 잡고 end에서 그 base로 1회 커밋한다', () => {
    const base = scene({ environmentId: 'base' });
    const h = createHarness(base);

    h.actions.startTransformInteraction();
    expect(h.deps.transformHistoryBaseRef.current).toBe(base);

    // 드래그로 씬이 바뀐 뒤 종료
    h.actions.setEnvironmentId('after-drag');
    h.actions.endTransformInteraction();

    expect(h.deps.commitHistoryFrom).toHaveBeenCalledWith(base);
    expect(h.deps.transformHistoryBaseRef.current).toBeNull();
  });
});
