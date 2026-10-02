import type { AssetRecord } from '../model/types';

/**
 * 자산 사용처 — 어느 씬이 어떤 파일을 몇 번 배치했는지.
 *
 * 씬 스키마(@crane/domain/3d)를 import 하지 않고 필요한 모양만 구조적으로
 * 받는다. 씬 JSON 은 자산을 id 가 아니라 파일 경로로 참조하므로 매칭도
 * 경로로 한다.
 */

export interface SceneAssetSource {
  /** 씬 파일명(okpo.json). */
  sceneFile: string;
  /** 이 씬 파일을 쓰는 region 들. */
  regionIds: string[];
  /** 3D 화면 편집 경로. */
  editorPath: string;
  modelPaths: readonly string[];
  mapPaths: readonly string[];
}

export interface AssetUsage {
  sceneFile: string;
  regionIds: string[];
  editorPath: string;
  /** 이 씬에 배치된 개수. */
  count: number;
}

/** 파일 경로 → 그 파일을 쓰는 씬 목록. */
export type AssetUsageIndex = Map<string, AssetUsage[]>;

export function buildAssetUsageIndex(
  sources: readonly SceneAssetSource[],
): AssetUsageIndex {
  const index: AssetUsageIndex = new Map();
  for (const source of sources) {
    const counts = new Map<string, number>();
    for (const path of [...source.modelPaths, ...source.mapPaths]) {
      if (!path) continue;
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
    for (const [path, count] of counts) {
      const list = index.get(path) ?? [];
      list.push({
        sceneFile: source.sceneFile,
        regionIds: source.regionIds,
        editorPath: source.editorPath,
        count,
      });
      index.set(path, list);
    }
  }
  return index;
}

export interface AssetVersionUsage {
  version: number;
  usages: AssetUsage[];
}

/**
 * 자산의 버전별 사용처. 씬이 가리킬 수 있는 것은 배포 파일(public)뿐이라
 * 브라우저에만 있는 버전은 항상 미사용이다.
 */
export function getAssetUsage(
  asset: AssetRecord,
  index: AssetUsageIndex,
): AssetVersionUsage[] {
  const result: AssetVersionUsage[] = [];
  for (const version of asset.versions) {
    if (version.file.ref.storage !== 'public') continue;
    const usages = index.get(version.file.ref.path);
    if (usages && usages.length > 0) {
      result.push({ version: version.version, usages });
    }
  }
  return result;
}

/** 자산이 놓인 총 개수(모든 씬·버전 합). */
export function countAssetPlacements(
  asset: AssetRecord,
  index: AssetUsageIndex,
): number {
  return getAssetUsage(asset, index).reduce(
    (sum, entry) => sum + entry.usages.reduce((s, u) => s + u.count, 0),
    0,
  );
}
