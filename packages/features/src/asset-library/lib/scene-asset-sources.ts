import {
  getKnownRegionIds,
  getSceneFileUrlByRegionId,
  loadSceneInfoByRegionId,
} from '@crane/domain/3d';
import type {
  AssetSiteId,
  SceneAssetSource,
} from '@crane/domain/asset-library';
import { getRegionById } from '@crane/domain/region';

/**
 * 씬 파일들이 참조하는 자산 경로를 모은다(사용처 계산의 입력).
 *
 * region 여러 개가 한 씬 파일을 공유할 수 있으므로(옥포 dock-1·dock-2)
 * 파일 단위로 묶어 한 번만 읽는다.
 */

/** region 의 사이트 종류 → 조선소. 골리앗 씬은 필리조선소 지도 위에 있다. */
const SITE_BY_SITE_TYPE: Record<string, AssetSiteId> = {
  'hanwha-ocean': 'okpo',
  'philly-shipyard': 'philly',
  'goliath-crane': 'philly',
};

export function getAssetSiteByRegionId(regionId: string): AssetSiteId | null {
  const region = getRegionById(regionId);
  return region ? (SITE_BY_SITE_TYPE[region.siteType] ?? null) : null;
}

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

/**
 * 모든 씬 파일을 읽어 자산 경로 목록을 만든다. 한 씬이 실패해도 나머지는
 * 살린다 — 실패한 씬은 결과에서 빠지고 `failed` 로 알린다.
 */
export async function loadSceneAssetSources(): Promise<{
  sources: SceneAssetSource[];
  failed: string[];
}> {
  const groups = groupRegionsBySceneFile();
  const settled = await Promise.allSettled(
    groups.map(async (group): Promise<SceneAssetSource> => {
      const [firstRegionId] = group.regionIds;
      const info = await loadSceneInfoByRegionId(firstRegionId);
      const region = getRegionById(firstRegionId);
      return {
        sceneFile: group.sceneFile,
        regionIds: group.regionIds,
        site: getAssetSiteByRegionId(firstRegionId),
        editorPath: region ? `${region.navigateTo}/3d-viewer-edit` : '',
        modelPaths: info.models.map((model) => model.path),
        mapPaths: (info.maps ?? []).map((map) => map.path),
      };
    }),
  );

  const sources: SceneAssetSource[] = [];
  const failed: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') sources.push(result.value);
    else failed.push(groups[index].sceneFile);
  });
  return { sources, failed };
}
