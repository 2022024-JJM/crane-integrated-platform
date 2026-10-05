import {
  getKnownRegionIds,
  getSceneFileUrlByRegionId,
  loadSceneInfoByRegionId,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type {
  AssetUsageRef,
  AssetUsageSource,
} from '@crane/domain/asset-library';
import { getRegionById } from '@crane/domain/region';

/**
 * 씬 파일들이 쓰는 자산을 모은다(사용처 계산의 입력) — 모델·지도·배경의 자산
 * 참조와 파일 경로.
 *
 * region 여러 개가 한 씬 파일을 공유할 수 있으므로(옥포 dock-1·dock-2)
 * 파일 단위로 묶어 한 번만 읽는다.
 */

function toSceneFileName(regionId: string): string | null {
  const url = getSceneFileUrlByRegionId(regionId);
  if (!url) return null;
  return url.split(/[?#]/)[0].split('/').pop() ?? null;
}

export interface SceneFileGroup {
  sceneFile: string;
  regionIds: string[];
}

/** 등록된 region 을 씬 파일별로 묶는다. */
export function groupRegionsBySceneFile(): SceneFileGroup[] {
  const groups = new Map<string, string[]>();
  for (const regionId of getKnownRegionIds()) {
    const sceneFile = toSceneFileName(regionId);
    if (!sceneFile) continue;
    groups.set(sceneFile, [...(groups.get(sceneFile) ?? []), regionId]);
  }
  return [...groups.entries()].map(([sceneFile, regionIds]) => ({
    sceneFile,
    regionIds,
  }));
}

/** 씬이 쓰는 자산 자리들 — 모델, 지도, 배경 순. */
export function collectSceneAssetRefs(
  info: Pick<SavedSceneInfo, 'models' | 'maps' | 'environment'>,
): AssetUsageRef[] {
  const refs: AssetUsageRef[] = [];
  for (const item of [...info.models, ...(info.maps ?? [])]) {
    refs.push(
      item.asset ? { path: item.path, asset: item.asset } : { path: item.path },
    );
  }
  if (info.environment) {
    const { path, asset } = info.environment;
    refs.push(asset ? { path, asset } : { path });
  }
  return refs;
}

/**
 * 모든 씬 파일을 읽어 자산 참조 목록을 만든다. 한 씬이 실패해도 나머지는
 * 살린다 — 실패한 씬은 결과에서 빠지고 `failed` 로 알린다.
 */
export async function loadSceneAssetSources(): Promise<{
  sources: AssetUsageSource[];
  failed: string[];
}> {
  const groups = groupRegionsBySceneFile();
  const settled = await Promise.allSettled(
    groups.map(async (group): Promise<AssetUsageSource> => {
      const [firstRegionId] = group.regionIds;
      const info = await loadSceneInfoByRegionId(firstRegionId);
      const region = getRegionById(firstRegionId);
      return {
        kind: 'scene',
        name: group.sceneFile,
        regionIds: group.regionIds,
        editorPath: region ? `${region.navigateTo}/3d-viewer-edit` : '',
        refs: collectSceneAssetRefs(info),
      };
    }),
  );

  const sources: AssetUsageSource[] = [];
  const failed: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') sources.push(result.value);
    else failed.push(groups[index].sceneFile);
  });
  return { sources, failed };
}
