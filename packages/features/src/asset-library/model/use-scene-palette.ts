import { useEffect, useMemo, useState } from 'react';
import type { ScenePlaceableModel } from '@crane/domain/3d';
import {
  buildScenePaletteEnvironments,
  buildScenePaletteMaps,
  buildScenePaletteModels,
  selectPlaceableModels,
  type ScenePaletteEnvironment,
  type ScenePaletteMap,
  type ScenePaletteModel,
} from '../lib/scene-palette';
import {
  useAssetLibraryStore,
  type AssetLibraryStatus,
} from './use-asset-library-store';

const NOTHING_PLACEABLE: ScenePlaceableModel[] = [];

export interface ScenePalette {
  /**
   * 라이브러리를 읽는 상태. `error` 면 목록이 비고 화면이 다시 읽기를 권한다 —
   * 이미 놓인 것은 씬이 경로를 들고 있어 그대로 보인다.
   */
  status: AssetLibraryStatus;
  /** 모델 탭에 보일 전부(놓을 수 없는 것 포함). */
  models: ScenePaletteModel[];
  /** 캔버스가 미리 받아 두고 드롭을 받는 모델. */
  placeableModels: ScenePlaceableModel[];
  maps: ScenePaletteMap[];
  environments: ScenePaletteEnvironment[];
  /** 라이브러리를 다시 읽는다(읽기에 실패했을 때). */
  reload: () => void;
}

/**
 * 3D 화면 편집의 팔레트 — 자산 라이브러리에서 만든 모델·맵·배경 목록.
 */
export function useScenePalette(): ScenePalette {
  const status = useAssetLibraryStore((state) => state.status);
  const assets = useAssetLibraryStore((state) => state.assets);
  const load = useAssetLibraryStore((state) => state.load);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(() => buildScenePaletteModels(assets), [assets]);
  const maps = useMemo(() => buildScenePaletteMaps(assets), [assets]);
  const environments = useMemo(
    () => buildScenePaletteEnvironments(assets),
    [assets],
  );

  // 캔버스는 이 목록이 바뀌면 프리로드한 모델을 비우고 다시 받는다(수십 MB).
  // 그래서 (1) 라이브러리를 읽는 동안에는 빈 목록을 주어 프리로드를 한 번만
  // 시작하게 하고, (2) 내용이 같으면 같은 배열을 유지한다 — 렌더 중에 직전
  // 값과 견줘 달라졌을 때만 바꾼다.
  const pending = status === 'idle' || status === 'loading';
  const [placeableModels, setPlaceableModels] = useState(() =>
    pending ? NOTHING_PLACEABLE : selectPlaceableModels(models, NOTHING_PLACEABLE),
  );
  const next = pending
    ? NOTHING_PLACEABLE
    : selectPlaceableModels(models, placeableModels);
  if (next !== placeableModels) setPlaceableModels(next);

  return {
    status,
    models,
    placeableModels,
    maps,
    environments,
    reload: () => void load({ force: true }),
  };
}
