import { useEffect, useMemo, useState } from 'react';
import type { SceneModelCatalogItem } from '@crane/domain/3d';
import {
  buildScenePaletteModels,
  selectPlaceableCatalog,
  type ScenePaletteModel,
} from '../lib/scene-palette';
import { useAssetLibraryStore } from './use-asset-library-store';

const NOTHING_PLACEABLE: SceneModelCatalogItem[] = [];

/**
 * 3D 화면 편집의 모델 팔레트 — 카탈로그를 자산 라이브러리와 합친 목록.
 * `models` 는 팔레트에 보일 전부(놓을 수 없는 것 포함), `placeable` 은
 * 캔버스가 미리 받아 두고 드롭을 받는 것이다.
 */
export function useScenePaletteModels(catalog: SceneModelCatalogItem[]): {
  models: ScenePaletteModel[];
  placeable: SceneModelCatalogItem[];
} {
  const status = useAssetLibraryStore((state) => state.status);
  const assets = useAssetLibraryStore((state) => state.assets);
  const load = useAssetLibraryStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(
    () => buildScenePaletteModels(catalog, status === 'ready' ? assets : null),
    [assets, catalog, status],
  );

  // 캔버스는 이 목록이 바뀌면 프리로드한 모델을 비우고 다시 받는다(수십 MB).
  // 그래서 (1) 라이브러리를 읽는 동안에는 빈 목록을 주어 프리로드를 한 번만
  // 시작하게 하고, (2) 내용이 같으면 같은 배열을 유지한다 — 렌더 중에 직전
  // 값과 견줘 달라졌을 때만 바꾼다. 읽기에 실패하면 카탈로그 그대로다.
  const pending = status === 'idle' || status === 'loading';
  const [placeable, setPlaceable] = useState(() =>
    pending ? NOTHING_PLACEABLE : selectPlaceableCatalog(models, catalog),
  );
  const next = pending
    ? NOTHING_PLACEABLE
    : selectPlaceableCatalog(
        models,
        placeable === NOTHING_PLACEABLE ? catalog : placeable,
      );
  if (next !== placeable) setPlaceable(next);

  return { models, placeable };
}
