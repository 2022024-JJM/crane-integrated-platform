import type { SavedSceneInfo, SceneAssetRef } from '@crane/domain/3d';
import {
  getCurrentAssetVersion,
  type AssetRecord,
} from '@crane/domain/asset-library';

/**
 * 씬에 놓인 자산과 자산 라이브러리의 차이 — 에디터가 "새 버전 있음" 으로
 * 알리는 목록이다.
 *
 * 씬은 놓을 때의 버전을 기억하고 라이브러리의 현재 버전을 따라가지 않는다.
 * 여기서 둘이 다른 자산을 찾아 주고, 사용자가 눌러 갱신한다
 * (@crane/domain/3d 의 withSceneAssetVersion). 갱신은 한 씬 안의 같은 자산을
 * 전부 한꺼번에 옮긴다.
 */

export type SceneAssetUpdateKind = 'model' | 'map' | 'environment';

export interface SceneAssetUpdate {
  assetId: string;
  kind: SceneAssetUpdateKind;
  /** 라이브러리의 자산 이름. */
  name: string;
  /** 씬에 놓인(현재 버전이 아닌) 버전들 — 오름차순. */
  fromVersions: number[];
  /** 갱신하면 가는 버전 — 라이브러리의 현재 버전. */
  toVersion: number;
  toPath: string;
  /** 갱신될 객체 수. */
  count: number;
}

interface Placement {
  kind: SceneAssetUpdateKind;
  asset: SceneAssetRef | undefined;
}

/** 씬에 놓인 자산 자리들 — 모델, 지도, 배경 순. */
function listPlacements(scene: SavedSceneInfo): Placement[] {
  const placements: Placement[] = [];
  for (const model of scene.models) {
    placements.push({ kind: 'model', asset: model.asset });
  }
  for (const map of scene.maps ?? []) {
    placements.push({ kind: 'map', asset: map.asset });
  }
  if (scene.environment) {
    placements.push({ kind: 'environment', asset: scene.environment.asset });
  }
  return placements;
}

/**
 * 갱신할 수 있는 자산 — 씬에 놓인 버전이 라이브러리의 현재 버전과 다르고, 그
 * 현재 버전이 게시돼 있으며 파일이 배포 경로에 있는 것. 순서는 씬에 처음 나온
 * 순서다(모델 → 지도 → 배경).
 *
 * 현재 버전이 놓인 버전보다 낮아도(롤백) 갱신 대상이다 — 방향이 아니라
 * "지금 라이브러리가 쓰라고 하는 버전" 과 다른지를 본다.
 */
export function listSceneAssetUpdates(
  scene: SavedSceneInfo | null | undefined,
  assets: readonly AssetRecord[],
): SceneAssetUpdate[] {
  if (!scene) return [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const updates = new Map<string, SceneAssetUpdate>();
  for (const { kind, asset: ref } of listPlacements(scene)) {
    if (!ref) continue;
    const asset = byId.get(ref.id);
    if (!asset) continue;
    const current = getCurrentAssetVersion(asset);
    if (ref.version === current.version) continue;
    if (current.status !== 'published') continue;
    if (current.file.ref.storage !== 'public') continue;
    const update = updates.get(ref.id) ?? {
      assetId: ref.id,
      kind,
      name: asset.name,
      fromVersions: [],
      toVersion: current.version,
      toPath: current.file.ref.path,
      count: 0,
    };
    update.count += 1;
    if (!update.fromVersions.includes(ref.version)) {
      update.fromVersions = [...update.fromVersions, ref.version].sort(
        (a, b) => a - b,
      );
    }
    updates.set(ref.id, update);
  }
  return [...updates.values()];
}

export interface SceneAssetIssues {
  /** 자산 참조가 없는 객체 — 라이브러리가 모르는 파일이다. */
  unmanaged: number;
  /** 참조가 가리키는 자산이나 버전이 라이브러리에 없는 객체. */
  missing: number;
}

/**
 * 라이브러리로 관리되지 않는 객체 수. 이런 객체는 그대로 렌더되지만 새 버전을
 * 알릴 수 없고 사용처에도 경로로만 잡힌다 — 에디터가 한 줄로 알린다.
 */
export function countSceneAssetIssues(
  scene: SavedSceneInfo | null | undefined,
  assets: readonly AssetRecord[],
): SceneAssetIssues {
  const issues: SceneAssetIssues = { unmanaged: 0, missing: 0 };
  if (!scene) return issues;
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  for (const { asset: ref } of listPlacements(scene)) {
    if (!ref) {
      issues.unmanaged += 1;
      continue;
    }
    const asset = byId.get(ref.id);
    if (!asset || !asset.versions.some((v) => v.version === ref.version)) {
      issues.missing += 1;
    }
  }
  return issues;
}
