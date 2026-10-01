import {
  findAssetsByContentHash,
  getAllowedAssetKinds,
  getFileExtension,
  hashBytes,
  validateGlbHeader,
  type AssetKind,
  type AssetRecord,
  type AssetStatsTable,
  type GlbHeaderError,
} from '@crane/domain/asset-library';

/**
 * 등록할 파일을 올리기 전에 살핀다 — 받을 수 있는 형식인지, GLB 로서
 * 온전한지, 같은 내용이 이미 라이브러리에 있는지.
 */

/** 이보다 크면 로딩 시간을 경고한다(막지는 않는다). */
export const LARGE_ASSET_FILE_BYTES = 100 * 1024 * 1024;

export type AssetFileProblem =
  | { code: 'unsupported'; format: string }
  | { code: 'empty' }
  | { code: 'glb'; reason: GlbHeaderError };

export interface AssetFileDuplicate {
  assetId: string;
  assetName: string;
  version: number;
}

export interface AssetFileAnalysis {
  format: string;
  allowedKinds: AssetKind[];
  contentHash: string | null;
  /** 등록을 막는 문제. 없으면 null. */
  problem: AssetFileProblem | null;
  duplicates: AssetFileDuplicate[];
  large: boolean;
}

export async function analyzeAssetFile(
  file: File,
  assets: readonly AssetRecord[],
  statsTable: AssetStatsTable = {},
): Promise<AssetFileAnalysis> {
  const format = getFileExtension(file.name);
  const allowedKinds = getAllowedAssetKinds(file.name);
  const base = {
    format,
    allowedKinds,
    contentHash: null,
    duplicates: [],
    large: file.size > LARGE_ASSET_FILE_BYTES,
  };

  if (allowedKinds.length === 0) {
    return { ...base, problem: { code: 'unsupported', format } };
  }
  if (file.size === 0) return { ...base, problem: { code: 'empty' } };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (format === 'glb') {
    const reason = validateGlbHeader(bytes.subarray(0, 12), file.size);
    if (reason) return { ...base, problem: { code: 'glb', reason } };
  }

  const contentHash = await hashBytes(bytes);
  return {
    ...base,
    contentHash,
    problem: null,
    duplicates: findAssetsByContentHash(assets, contentHash, {
      sizeBytes: file.size,
      statsTable,
    }).map(
      ({ asset, version }) => ({
        assetId: asset.id,
        assetName: asset.name,
        version,
      }),
    ),
  };
}
