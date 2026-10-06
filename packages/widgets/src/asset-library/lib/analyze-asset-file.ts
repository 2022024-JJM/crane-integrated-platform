import {
  ASSET_ENVIRONMENT_MAX_SIZE,
  findAssetsByContentHash,
  getAllowedAssetKinds,
  getFileExtension,
  hashBytes,
  validateExrHeader,
  validateGlbHeader,
  type AssetKind,
  type AssetRecord,
  type AssetStatsTable,
  type ExrHeaderError,
  type GlbHeaderError,
} from '@crane/domain/asset-library';

/**
 * 등록할 파일을 올리기 전에 살핀다 — 받을 수 있는 형식인지, GLB 로서
 * 온전한지, 배경으로 쓸 수 있는 EXR 인지(해상도), 같은 내용이 이미
 * 라이브러리에 있는지.
 */

/** 이보다 크면 로딩 시간을 경고한다(막지는 않는다). */
export const LARGE_ASSET_FILE_BYTES = 100 * 1024 * 1024;

export type AssetFileProblem =
  | { code: 'unsupported'; format: string }
  | { code: 'empty' }
  | { code: 'glb'; reason: GlbHeaderError }
  | { code: 'exr'; reason: ExrHeaderError };

/**
 * 문제를 알리는 문장 — 번역 키와 끼워 넣을 값. 등록 대화 상자와 새 버전
 * 올리기가 같은 문장을 쓴다.
 */
export function getAssetFileProblemMessage(problem: AssetFileProblem): {
  key: string;
  values?: Record<string, string | number>;
} {
  switch (problem.code) {
    case 'glb':
      return { key: `asset-library:import.problem.glb.${problem.reason}` };
    case 'exr':
      return {
        key: `asset-library:import.problem.exr.${problem.reason}`,
        values: { max: ASSET_ENVIRONMENT_MAX_SIZE },
      };
    case 'empty':
      return { key: 'asset-library:import.problem.empty' };
    case 'unsupported':
      return {
        key: 'asset-library:import.problem.unsupported',
        values: { format: problem.format || '?' },
      };
  }
}

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
  // 씬 배경으로 쓰이게 되므로 등록할 때 거른다 — GPU 상한을 넘는 EXR 은
  // 배경이 검게 나온다.
  if (format === 'exr') {
    const reason = validateExrHeader(bytes);
    if (reason) return { ...base, problem: { code: 'exr', reason } };
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
