import { isSceneAssetKind, type AssetRecord } from '../model/types';

/**
 * 자산 사용처 — 어느 씬(또는 화면 코드)이 어떤 자산의 어느 버전을 몇 번 쓰는지.
 *
 * 씬 스키마(@crane/domain/3d)를 import 하지 않고 필요한 모양만 구조적으로
 * 받는다. 씬은 자산을 **id + 버전**으로 가리키고 파일 경로를 함께 든다. 참조가
 * 없는 객체(자산 참조를 적기 전의 저장본)는 경로로 매칭한다 — 옮겨 적지 않은
 * 씬에 놓인 자산을 "안 쓰인다" 고 보고 지우게 두지 않는다.
 */

/** 한 번 쓰인 자리. 자산 참조가 없으면 경로만 있다. */
export interface AssetUsageRef {
  path: string;
  asset?: { id: string; version: number };
}

export interface AssetUsageSource {
  /** `scene` = 씬 파일에 놓임, `code` = 화면 코드가 직접 로드. */
  kind: 'scene' | 'code';
  /** 씬 파일명(okpo.json) 또는 코드 사용처 이름. */
  name: string;
  /** 이 씬 파일을 쓰는 region 들. 코드 사용처는 비어 있다. */
  regionIds: string[];
  /** 3D 화면 편집 경로. 코드 사용처는 빈 문자열. */
  editorPath: string;
  refs: readonly AssetUsageRef[];
}

export interface AssetUsage {
  kind: 'scene' | 'code';
  name: string;
  regionIds: string[];
  editorPath: string;
  /** 이곳에서 쓰인 횟수. */
  count: number;
}

/** 키(`refUsageKey`·`pathUsageKey`) → 그것을 쓰는 곳 목록. */
export type AssetUsageIndex = Map<string, AssetUsage[]>;

function refUsageKey(assetId: string, version: number): string {
  return `ref:${assetId}@${version}`;
}

function pathUsageKey(path: string): string {
  return `path:${path}`;
}

export function buildAssetUsageIndex(
  sources: readonly AssetUsageSource[],
): AssetUsageIndex {
  const index: AssetUsageIndex = new Map();
  for (const source of sources) {
    const counts = new Map<string, number>();
    for (const ref of source.refs) {
      const key = ref.asset
        ? refUsageKey(ref.asset.id, ref.asset.version)
        : ref.path
          ? pathUsageKey(ref.path)
          : null;
      if (key === null) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts) {
      const list = index.get(key) ?? [];
      list.push({
        kind: source.kind,
        name: source.name,
        regionIds: source.regionIds,
        editorPath: source.editorPath,
        count,
      });
      index.set(key, list);
    }
  }
  return index;
}

/** 같은 곳이 참조로도 경로로도 잡혔으면 한 줄로 합친다. */
function mergeUsages(
  byRef: readonly AssetUsage[],
  byPath: readonly AssetUsage[],
): AssetUsage[] {
  if (byPath.length === 0) return [...byRef];
  const merged = byRef.map((usage) => ({ ...usage }));
  for (const usage of byPath) {
    const same = merged.find(
      (item) => item.kind === usage.kind && item.name === usage.name,
    );
    if (same) same.count += usage.count;
    else merged.push({ ...usage });
  }
  return merged;
}

/** 이 버전을 쓰는 곳. 없으면 빈 배열. */
export function getAssetVersionUsage(
  asset: AssetRecord,
  version: number,
  index: AssetUsageIndex,
): AssetUsage[] {
  const target = asset.versions.find((item) => item.version === version);
  if (!target) return [];
  const byRef = index.get(refUsageKey(asset.id, version)) ?? [];
  // 경로 매칭은 배포 파일에만 — 브라우저에만 있는 파일은 씬이 가리킬 수 없다.
  const byPath =
    target.file.ref.storage === 'public'
      ? (index.get(pathUsageKey(target.file.ref.path)) ?? [])
      : [];
  return mergeUsages(byRef, byPath);
}

export interface AssetVersionUsage {
  version: number;
  usages: AssetUsage[];
}

/** 자산의 버전별 사용처. 쓰이는 버전만 나온다. */
export function getAssetUsage(
  asset: AssetRecord,
  index: AssetUsageIndex,
): AssetVersionUsage[] {
  const result: AssetVersionUsage[] = [];
  for (const version of asset.versions) {
    const usages = getAssetVersionUsage(asset, version.version, index);
    if (usages.length > 0) result.push({ version: version.version, usages });
  }
  return result;
}

/** 자산이 쓰인 총 횟수(모든 사용처·버전 합). */
export function countAssetPlacements(
  asset: AssetRecord,
  index: AssetUsageIndex,
): number {
  return getAssetUsage(asset, index).reduce(
    (sum, entry) => sum + entry.usages.reduce((s, u) => s + u.count, 0),
    0,
  );
}

/** 이 버전이 어디선가 쓰이는가 — 쓰이는 버전은 철회할 수 없다. */
export function isAssetVersionInUse(
  asset: AssetRecord,
  version: number,
  index: AssetUsageIndex,
): boolean {
  return getAssetVersionUsage(asset, version, index).length > 0;
}

/** 자산의 어느 버전이든 쓰이는가 — 쓰이는 자산은 지울 수 없다. */
export function isAssetInUse(
  asset: AssetRecord,
  index: AssetUsageIndex,
): boolean {
  return asset.versions.some((version) =>
    isAssetVersionInUse(asset, version.version, index),
  );
}

/** 사용처 인덱스와, 그것이 모든 사용처를 담고 있는지. */
export interface AssetUsageState {
  index: AssetUsageIndex;
  /**
   * 씬을 전부 읽었는가. 읽는 중이거나 읽지 못한 씬이 있으면 false 다 — 그때는
   * "안 쓰인다" 를 믿을 수 없다.
   */
  known: boolean;
}

/** 철회·삭제를 막는 이유. */
export type AssetUsageBlock =
  /** 씬이나 화면 코드가 쓰고 있다. */
  | 'in-use'
  /** 사용처를 다 읽지 못해 안 쓰이는지 알 수 없다. */
  | 'usage-unknown';

/**
 * 읽은 범위에서 쓰이는 것이 보이면 `in-use`, 보이지 않아도 다 읽지 못했으면
 * `usage-unknown`. 씬에 쓰지 않는 종류(도면·CAD)는 씬을 못 읽어도 막지 않는다 —
 * 그 종류의 사용처는 화면 코드뿐이고 그것은 항상 인덱스에 있다.
 */
function toUsageBlock(
  asset: AssetRecord,
  inUse: boolean,
  usage: AssetUsageState,
): AssetUsageBlock | null {
  if (inUse) return 'in-use';
  return !usage.known && isSceneAssetKind(asset.kind) ? 'usage-unknown' : null;
}

/** 자산을 지울 수 없는 이유. 지울 수 있으면 null. */
export function getAssetRemoveBlock(
  asset: AssetRecord,
  usage: AssetUsageState,
): AssetUsageBlock | null {
  return toUsageBlock(asset, isAssetInUse(asset, usage.index), usage);
}

/** 이 버전을 철회할 수 없는 이유. 철회할 수 있으면 null. */
export function getAssetWithdrawBlock(
  asset: AssetRecord,
  version: number,
  usage: AssetUsageState,
): AssetUsageBlock | null {
  return toUsageBlock(
    asset,
    isAssetVersionInUse(asset, version, usage.index),
    usage,
  );
}
