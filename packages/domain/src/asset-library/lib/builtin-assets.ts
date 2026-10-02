import { getFileExtension } from '../model/asset-library-paths';
import type {
  AssetCollection,
  AssetLibraryDocument,
  AssetRecord,
  AssetVersion,
  BuiltinAssetSource,
} from '../model/types';

/**
 * builtin 자산 — 코드 카탈로그와 배포 파일에서 온 자산을 라이브러리 레코드로
 * 만들고, 저장된 문서와 합친다.
 *
 * 카탈로그가 정체성(id·종류·파일 경로·기본 스케일)의 원천이고 저장 문서가
 * 메타데이터(이름·설명·태그·상태·추가 버전·이력)의 원천이다. 카탈로그에
 * 항목을 추가하면 문서를 고치지 않아도 라이브러리에 나타나고, 카탈로그에서
 * 뺀 항목은 문서에 남아 있어도 사라진다.
 */

export const BUILTIN_ASSET_ACTOR = 'system';

export function buildBuiltinAssetRecord(source: BuiltinAssetSource): AssetRecord {
  const fileName = source.path.split('/').pop() ?? source.path;
  return {
    id: source.id,
    kind: source.kind,
    origin: 'builtin',
    name: source.name,
    description: source.description ?? '',
    tags: source.tags ?? [],
    owner: '',
    ...(source.catalogId ? { catalogId: source.catalogId } : {}),
    defaultScale: source.defaultScale ?? [1, 1, 1],
    relatedAssetIds: [],
    versions: [
      {
        version: 1,
        // 배포돼 씬이 쓰고 있는 파일이다.
        status: 'published',
        file: {
          ref: { storage: 'public', path: source.path },
          fileName,
          format: getFileExtension(fileName),
          sizeBytes: null,
          contentHash: null,
        },
        note: '',
        createdAt: '',
        createdBy: BUILTIN_ASSET_ACTOR,
      },
    ],
    currentVersion: 1,
    createdAt: '',
    updatedAt: '',
    history: [],
  };
}

/**
 * 저장된 builtin 레코드 위에 카탈로그의 정체성을 덮어쓴다. 버전 1 의 파일은
 * 항상 카탈로그 경로다(GLB 파일명이 바뀌어도 따라간다) — 상태·메모·시각은
 * 저장본의 것을 유지한다.
 */
function mergeBuiltinRecord(base: AssetRecord, stored: AssetRecord): AssetRecord {
  const baseV1 = base.versions[0];
  const storedV1 = stored.versions.find((v) => v.version === 1);
  const v1: AssetVersion = storedV1
    ? {
        ...storedV1,
        file: {
          ...baseV1.file,
          sizeBytes: storedV1.file.sizeBytes,
          contentHash: storedV1.file.contentHash,
        },
      }
    : baseV1;
  const versions = [v1, ...stored.versions.filter((v) => v.version > 1)];
  const { catalogId: _storedCatalogId, ...storedRest } = stored;
  void _storedCatalogId;
  return {
    ...storedRest,
    kind: base.kind,
    origin: 'builtin',
    ...(base.catalogId ? { catalogId: base.catalogId } : {}),
    defaultScale: base.defaultScale,
    versions,
    currentVersion: versions.some((v) => v.version === stored.currentVersion)
      ? stored.currentVersion
      : 1,
  };
}

export interface MergedAssetLibrary {
  assets: AssetRecord[];
  collections: AssetCollection[];
}

/**
 * builtin 원천과 저장 문서를 합친다. 순서는 builtin(원천 순서) → 사용자 자산
 * (등록 시각 오름차순)이다. builtin id 와 겹치는 사용자 자산은 버린다.
 */
export function mergeAssetLibrary(
  sources: readonly BuiltinAssetSource[],
  stored: AssetLibraryDocument,
): MergedAssetLibrary {
  const storedById = new Map(stored.assets.map((asset) => [asset.id, asset]));
  const builtinIds = new Set<string>();
  const assets: AssetRecord[] = [];

  for (const source of sources) {
    if (builtinIds.has(source.id)) continue;
    builtinIds.add(source.id);
    const base = buildBuiltinAssetRecord(source);
    const saved = storedById.get(source.id);
    // builtin 으로 저장된 레코드만 메타데이터 원천이다. 같은 id 의 사용자
    // 자산(카탈로그에 그 id 가 나중에 생긴 경우)이 builtin 의 이름·상태를
    // 덮어쓰면 안 된다.
    assets.push(
      saved?.origin === 'builtin' ? mergeBuiltinRecord(base, saved) : base,
    );
  }

  const userAssets = stored.assets
    .filter((asset) => asset.origin === 'user' && !builtinIds.has(asset.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  assets.push(...userAssets);

  const liveIds = new Set(assets.map((asset) => asset.id));
  return {
    assets: assets.map((asset) => pruneRelated(asset, liveIds)),
    collections: stored.collections.map((collection) => ({
      ...collection,
      assetIds: collection.assetIds.filter((id) => liveIds.has(id)),
    })),
  };
}

function pruneRelated(
  asset: AssetRecord,
  liveIds: ReadonlySet<string>,
): AssetRecord {
  const related = asset.relatedAssetIds.filter((id) => liveIds.has(id));
  return related.length === asset.relatedAssetIds.length
    ? asset
    : { ...asset, relatedAssetIds: related };
}
