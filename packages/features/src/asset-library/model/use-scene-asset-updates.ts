import { useMemo } from 'react';
import type { SavedSceneInfo } from '@crane/domain/3d';
import {
  countSceneAssetIssues,
  listSceneAssetUpdates,
  type SceneAssetIssues,
  type SceneAssetUpdate,
} from '../lib/scene-asset-updates';
import { useAssetLibraryStore } from './use-asset-library-store';

const NO_UPDATES: SceneAssetUpdate[] = [];
const NO_ISSUES: SceneAssetIssues = { unmanaged: 0, missing: 0 };

/**
 * 편집 중인 씬에서 새 버전으로 갱신할 수 있는 자산과, 라이브러리로 관리되지
 * 않는 객체 수. 라이브러리를 다 읽은 뒤에만 판정한다 — 읽는 중의 빈 목록으로
 * 견주면 전부 "없는 자산" 으로 보인다. 읽기는 팔레트(useScenePalette)가 한다.
 */
export function useSceneAssetUpdates(scene: SavedSceneInfo | null): {
  updates: SceneAssetUpdate[];
  issues: SceneAssetIssues;
} {
  const ready = useAssetLibraryStore((state) => state.status === 'ready');
  const assets = useAssetLibraryStore((state) => state.assets);
  return useMemo(
    () =>
      ready
        ? {
            updates: listSceneAssetUpdates(scene, assets),
            issues: countSceneAssetIssues(scene, assets),
          }
        : { updates: NO_UPDATES, issues: NO_ISSUES },
    [assets, ready, scene],
  );
}
