import { getAssetContentHash, withBaseUrl } from '@crane/core/lib/asset-url';
import type { Vector3Tuple } from '@crane/core/types/math';
import {
  ASSET_LIBRARY_DOCUMENT_PATH,
  ASSET_LIBRARY_REVISION_HEADER,
  ASSET_LIBRARY_STATS_PATH,
  buildAssetThumbnailKey,
  buildAssetVersionFileKey,
  DEV_ASSET_LIBRARY_API_PATH,
  hashAssetLibraryText,
  isRemovableLegacyAssetPath,
  toAssetLibraryPublicPath,
} from '../model/asset-library-paths';
import type {
  AssetFileRef,
  AssetLibraryDocument,
  AssetStatsTable,
} from '../model/types';
import {
  createIndexedDbBlobStore,
  createMemoryBlobStore,
  isIndexedDbAvailable,
  type AssetBlobStore,
} from './asset-blob-store';
import {
  assertReadableAssetLibraryDocument,
  collectUnreadableAssetRecords,
  createEmptyAssetLibraryDocument,
  sanitizeAssetLibraryDocument,
  sanitizeAssetStatsTable,
} from './sanitize-asset-library';

/**
 * 자산 라이브러리 저장소 — 화면은 이 인터페이스만 알고, 어디에 저장되는지는
 * 구현이 정한다. 서버가 생기면 같은 인터페이스의 HTTP 구현을 하나 더 만들어
 * `getAssetLibraryRepository` 의 분기만 바꾼다.
 *
 * - dev (`pnpm dev`): 문서는 POST /__dev/asset-library 로
 *   public/asset-library/library.json 에, 파일은 `/file` 하위로
 *   public/asset-library/files·thumbnails 에 쓴다. git 으로 커밋하면 배포의
 *   기준값이 된다.
 * - 운영: 미들웨어가 없으므로 문서는 localStorage 봉투에 둔다 — **이
 *   브라우저에만** 남는다. 파일은 올릴 수 없다(`canManageFiles: false`) —
 *   등록·새 버전·삭제는 dev 에서 하고 배포한다. IndexedDB 에는 그 브라우저가
 *   찍은 썸네일만 들어간다. 봉투의 baseVersion(배포 문서의 콘텐츠 해시)이
 *   현재 배포와 다르면 배포본이 이긴다(씬·가상 태그와 같은 규칙).
 */

export const ASSET_LIBRARY_STORAGE_KEY = 'crane:asset-library';

/**
 * 내가 읽은 뒤로 다른 곳(다른 탭·다른 사람·git pull·손편집)에서 문서가
 * 바뀌었다. 저장은 문서를 통째로 쓰므로, 이대로 쓰면 그 변경을 덮는다 —
 * 쓰지 않고 이 오류로 알린다. 다시 읽어야 풀린다.
 */
export class AssetLibraryConflictError extends Error {
  constructor() {
    super('Asset library changed elsewhere since it was loaded.');
    this.name = 'AssetLibraryConflictError';
  }
}

/** 어느 파이프라인으로 최적화할지 — 모델과 지도는 정책이 다르다. */
export type AssetOptimizeKind = 'model' | 'map';

/** 버전 파일을 저장한 결과. */
export interface AssetStoredFile {
  ref: AssetFileRef;
  /** 저장된 파일의 바이트 크기(최적화했으면 최적화한 뒤의 크기). */
  sizeBytes: number;
  /** 최적화해 저장했는가. 요청했어도 실패하면 원본 그대로 저장하고 false 다. */
  optimized: boolean;
  /**
   * 파이프라인이 한 일(또는 원본 그대로 저장한 이유)을 적은 줄들. 지도는
   * 타일·압축을 스스로 정하므로 무엇을 골랐는지 화면이 알린다.
   */
  report: string[];
  /**
   * 지도 파이프라인이 지운 루트 오프셋(Blender 씬에 놓여 있던 자리). 새로
   * 등록하는 지도는 이 값을 기본 위치로 삼아 원래 자리에 놓인다.
   */
  rootOffset?: Vector3Tuple;
}

export interface AssetLibraryRepository {
  /** 저장이 이 브라우저 안에만 남는 환경인지. */
  readonly localOnly: boolean;
  /**
   * 파일을 올리고 지울 수 있는 환경인지 — 자산 등록, 새 버전 올리기, 자산·버전
   * 삭제. dev 서버에서만 된다. 운영 브라우저에서 올린 파일은 그 브라우저에만
   * 남아 씬이 가리킬 수 없으므로 막는다(이름·카테고리·상태 같은 문서 수정은 된다).
   */
  readonly canManageFiles: boolean;
  /**
   * 등록할 때 모델·지도를 최적화할 수 있는 환경인지. 최적화는 Node 스크립트
   * (`scripts/optimize-glb.mjs`·`optimize-map.mjs`)라 dev 서버에서만 된다.
   */
  readonly canOptimize: boolean;
  load(): Promise<AssetLibraryDocument>;
  loadStatsTable(): Promise<AssetStatsTable>;
  /**
   * 문서를 통째로 쓴다. 읽은 뒤로 다른 곳에서 바뀌었으면 쓰지 않고
   * `AssetLibraryConflictError` 를 던진다.
   */
  save(document: AssetLibraryDocument): Promise<void>;
  /**
   * 버전 파일을 저장하고 그 위치를 돌려준다. 같은 위치에 덮어쓰지 않는다.
   * `optimize` 는 GLB 를 그 종류의 최적화 파이프라인에 통과시켜 저장한다(할 수
   * 있는 환경에서만).
   */
  putVersionFile(
    target: { assetId: string; version: number; fileName: string },
    blob: Blob,
    options?: { optimize?: AssetOptimizeKind },
  ): Promise<AssetStoredFile>;
  putThumbnail(assetId: string, blob: Blob): Promise<AssetFileRef>;
  /**
   * 자산의 모든 파일(버전·썸네일)을 지운다. `legacyPaths` 는 라이브러리
   * 디렉터리 밖에 있는 그 자산의 버전 파일(옛 배포 경로 `/models/x.glb`)이다.
   */
  removeAssetFiles(
    assetId: string,
    legacyPaths?: readonly string[],
  ): Promise<void>;
  /** 한 버전의 파일만 지운다(지운 버전의 뒷정리). */
  removeVersionFiles(assetId: string, version: number): Promise<void>;
  /** 화면에서 읽을 수 있는 URL. 브라우저 저장분은 object URL 이다. */
  resolveUrl(ref: AssetFileRef): Promise<string | null>;
}

function isBrowser() {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

interface LoadedDocument {
  document: AssetLibraryDocument;
  /** 읽은 글자의 지문. 파일이 없으면 빈 문자열. */
  revision: string;
  /** 이 앱이 읽지 못한 자산 레코드(원본 그대로). 저장할 때 도로 붙인다. */
  unreadable: unknown[];
}

async function fetchDeployedDocument(): Promise<LoadedDocument> {
  const response = await fetch(withBaseUrl(ASSET_LIBRARY_DOCUMENT_PATH), {
    cache: 'no-store',
  });
  // 문서가 아직 없는 배포(404)는 자산이 하나도 없는 라이브러리다 — 빈 문서로
  // 본다.
  if (response.status === 404) {
    return {
      document: createEmptyAssetLibraryDocument(),
      revision: '',
      unreadable: [],
    };
  }
  if (!response.ok) {
    throw new Error(`Failed to load asset library. HTTP ${response.status}`);
  }
  const text = await response.text();
  const raw: unknown = JSON.parse(text);
  // 읽을 수 없는 문서는 빈 문서로 받아들이지 않고 실패로 알린다 — 빈 문서로
  // 열리면 다음 저장이 내용을 덮는다.
  assertReadableAssetLibraryDocument(raw);
  return {
    document: sanitizeAssetLibraryDocument(raw),
    revision: hashAssetLibraryText(text),
    unreadable: collectUnreadableAssetRecords(raw),
  };
}

/** 읽지 못한 레코드를 문서 끝에 도로 붙여, 쓸 때 사라지지 않게 한다. */
function withUnreadable(
  document: AssetLibraryDocument,
  unreadable: readonly unknown[],
): unknown {
  if (unreadable.length === 0) return document;
  return { ...document, assets: [...document.assets, ...unreadable] };
}

async function fetchStatsTable(): Promise<AssetStatsTable> {
  try {
    const response = await fetch(withBaseUrl(ASSET_LIBRARY_STATS_PATH), {
      cache: 'no-store',
    });
    if (!response.ok) return {};
    return sanitizeAssetStatsTable(await response.json());
  } catch {
    // 통계 표는 목록의 보조 정보다 — 없어도 라이브러리는 열린다.
    return {};
  }
}

function resolvePublicUrl(ref: AssetFileRef): string | null {
  return ref.storage === 'public' ? withBaseUrl(ref.path) : null;
}

export function createDevAssetLibraryRepository(): AssetLibraryRepository {
  const postFile = async (key: string, blob: Blob): Promise<AssetFileRef> => {
    const params = new URLSearchParams({ key });
    const response = await fetch(
      `${DEV_ASSET_LIBRARY_API_PATH}/file?${params.toString()}`,
      { method: 'POST', body: blob },
    );
    if (!response.ok) {
      throw new Error(`Failed to store asset file. HTTP ${response.status}`);
    }
    return { storage: 'public', path: toAssetLibraryPublicPath(key) };
  };

  // 마지막으로 읽거나 쓴 문서의 지문 — 저장할 때 서버의 현재 파일과 견준다.
  let revision: string | null = null;
  let unreadable: unknown[] = [];

  return {
    localOnly: false,
    canManageFiles: true,
    canOptimize: true,
    load: async () => {
      const loaded = await fetchDeployedDocument();
      revision = loaded.revision;
      unreadable = loaded.unreadable;
      if (unreadable.length > 0) {
        console.warn(
          `[asset-library-storage] ${unreadable.length} asset record(s) could not be read. They are kept as-is on save.`,
        );
      }
      return loaded.document;
    },
    loadStatsTable: fetchStatsTable,
    save: async (document) => {
      const response = await fetch(DEV_ASSET_LIBRARY_API_PATH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 읽은 적이 없으면 견줄 판이 없다 — 헤더를 싣지 않는다.
          ...(revision === null
            ? {}
            : { [ASSET_LIBRARY_REVISION_HEADER]: revision }),
        },
        body: JSON.stringify(withUnreadable(document, unreadable)),
      });
      if (response.status === 409) throw new AssetLibraryConflictError();
      if (!response.ok) {
        throw new Error(`Failed to save asset library. HTTP ${response.status}`);
      }
      const result: unknown = await response.json().catch(() => null);
      if (
        typeof result === 'object' &&
        result !== null &&
        'revision' in result &&
        typeof result.revision === 'string'
      ) {
        revision = result.revision;
      }
    },
    putVersionFile: async (target, blob, options) => {
      const key = buildAssetVersionFileKey(
        target.assetId,
        target.version,
        target.fileName,
      );
      const params = new URLSearchParams({ key });
      if (options?.optimize) params.set('optimize', options.optimize);
      const response = await fetch(
        `${DEV_ASSET_LIBRARY_API_PATH}/file?${params.toString()}`,
        { method: 'POST', body: blob },
      );
      if (!response.ok) {
        throw new Error(`Failed to store asset file. HTTP ${response.status}`);
      }
      const result: unknown = await response.json().catch(() => null);
      const info =
        typeof result === 'object' && result !== null
          ? (result as {
              bytes?: unknown;
              optimized?: unknown;
              report?: unknown;
              rootOffset?: unknown;
            })
          : {};
      const rootOffset = info.rootOffset;
      return {
        ref: { storage: 'public', path: toAssetLibraryPublicPath(key) },
        sizeBytes:
          typeof info.bytes === 'number' && Number.isFinite(info.bytes)
            ? info.bytes
            : blob.size,
        optimized: info.optimized === true,
        report: Array.isArray(info.report)
          ? info.report.filter((line): line is string => typeof line === 'string')
          : [],
        ...(Array.isArray(rootOffset) &&
        rootOffset.length === 3 &&
        rootOffset.every(
          (item) => typeof item === 'number' && Number.isFinite(item),
        )
          ? { rootOffset: [rootOffset[0], rootOffset[1], rootOffset[2]] }
          : {}),
      };
    },
    putThumbnail: (assetId, blob) =>
      postFile(buildAssetThumbnailKey(assetId), blob),
    removeAssetFiles: async (assetId, legacyPaths = []) => {
      const params = new URLSearchParams({ assetId });
      // 미들웨어가 정해진 디렉터리·확장자만 받는다 — 여기서도 같은 판정으로
      // 걸러, 거부될 요청을 보내지 않는다.
      for (const path of legacyPaths) {
        if (isRemovableLegacyAssetPath(path)) params.append('path', path);
      }
      const response = await fetch(
        `${DEV_ASSET_LIBRARY_API_PATH}/file?${params.toString()}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(`Failed to remove asset files. HTTP ${response.status}`);
      }
    },
    removeVersionFiles: async (assetId, version) => {
      const params = new URLSearchParams({
        assetId,
        version: String(version),
      });
      const response = await fetch(
        `${DEV_ASSET_LIBRARY_API_PATH}/file?${params.toString()}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(`Failed to remove version files. HTTP ${response.status}`);
      }
    },
    resolveUrl: async (ref) => resolvePublicUrl(ref),
  };
}

interface StoredEnvelope {
  baseVersion: string | null;
  /** 저장할 때마다 1 씩 오른다 — 다른 탭이 그사이 썼는지 견준다. */
  revision?: number;
  document: unknown;
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'document' in value &&
    'baseVersion' in value
  );
}

interface StoredRecord {
  document: AssetLibraryDocument;
  unreadable: unknown[];
  revision: number;
  isCurrent: boolean;
}

function readStoredRevision(): number {
  if (!isBrowser()) return 0;
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY) ?? 'null',
    );
    if (!isEnvelope(parsed)) return 0;
    // 낡은 봉투(배포가 바뀐 것)는 없는 것과 같다.
    if (parsed.baseVersion !== getAssetContentHash(ASSET_LIBRARY_DOCUMENT_PATH)) {
      return 0;
    }
    return typeof parsed.revision === 'number' ? parsed.revision : 0;
  } catch {
    return 0;
  }
}

/** 삭제 없이 읽고 신선도만 판정한다 — 삭제는 배포본 fetch 성공 뒤에만. */
function readStoredRecord(): StoredRecord | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(ASSET_LIBRARY_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(
      '[asset-library-storage] Failed to parse localStorage entry. Falling back to deployed file.',
      error,
    );
    return null;
  }
  if (!isEnvelope(parsed)) return null;
  try {
    assertReadableAssetLibraryDocument(parsed.document);
  } catch (error) {
    console.warn(
      '[asset-library-storage] Stored document is unreadable. Falling back to deployed file.',
      error,
    );
    return null;
  }
  return {
    document: sanitizeAssetLibraryDocument(parsed.document),
    unreadable: collectUnreadableAssetRecords(parsed.document),
    revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
    isCurrent:
      parsed.baseVersion === getAssetContentHash(ASSET_LIBRARY_DOCUMENT_PATH),
  };
}

export function createBrowserAssetLibraryRepository(
  blobStore: AssetBlobStore = isIndexedDbAvailable()
    ? createIndexedDbBlobStore()
    : createMemoryBlobStore(),
): AssetLibraryRepository {
  // 같은 파일에 object URL 을 매번 새로 만들면 해제되지 않은 URL 이 쌓이고,
  // drei 의 GLTF 캐시 키도 매번 달라진다 — 키마다 하나만 만든다.
  const objectUrls = new Map<string, string>();

  const revoke = (key: string) => {
    const url = objectUrls.get(key);
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.delete(key);
  };

  const put = async (key: string, blob: Blob): Promise<AssetFileRef> => {
    await blobStore.put(key, blob);
    revoke(key);
    return { storage: 'browser', key };
  };

  // 내가 마지막으로 읽거나 쓴 봉투의 판. 다른 탭이 그사이 쓰면 달라진다.
  let revision: number | null = null;
  let unreadable: unknown[] = [];

  return {
    localOnly: true,
    canManageFiles: false,
    canOptimize: false,
    load: async () => {
      const stored = readStoredRecord();
      if (stored?.isCurrent) {
        revision = stored.revision;
        unreadable = stored.unreadable;
        return stored.document;
      }
      try {
        const deployed = await fetchDeployedDocument();
        if (stored && isBrowser()) {
          window.localStorage.removeItem(ASSET_LIBRARY_STORAGE_KEY);
        }
        revision = 0;
        unreadable = deployed.unreadable;
        return deployed.document;
      } catch (error) {
        if (stored) {
          console.warn(
            '[asset-library-storage] Failed to load deployed library. Falling back to stale local copy.',
            error,
          );
          // 낡은 봉투는 저장할 때 "없는 것" 으로 센다(readStoredRevision).
          revision = 0;
          unreadable = stored.unreadable;
          return stored.document;
        }
        throw error;
      }
    },
    loadStatsTable: fetchStatsTable,
    save: async (document) => {
      if (!isBrowser()) {
        throw new Error('localStorage is not available in this environment.');
      }
      const current = readStoredRevision();
      if (revision !== null && current !== revision) {
        throw new AssetLibraryConflictError();
      }
      const envelope: StoredEnvelope = {
        baseVersion: getAssetContentHash(ASSET_LIBRARY_DOCUMENT_PATH),
        revision: current + 1,
        document: withUnreadable(document, unreadable),
      };
      // 용량 초과(QuotaExceededError)는 그대로 던진다 — 호출부가 저장 실패로
      // 알린다. 조용히 삼키면 사용자는 저장된 줄 안다.
      window.localStorage.setItem(
        ASSET_LIBRARY_STORAGE_KEY,
        JSON.stringify(envelope),
      );
      revision = current + 1;
    },
    putVersionFile: async (target, blob) => ({
      ref: await put(
        buildAssetVersionFileKey(
          target.assetId,
          target.version,
          target.fileName,
        ),
        blob,
      ),
      sizeBytes: blob.size,
      optimized: false,
      report: [],
    }),
    putThumbnail: (assetId, blob) => put(buildAssetThumbnailKey(assetId), blob),
    removeAssetFiles: async (assetId) => {
      const prefix = `files/${assetId}/`;
      const thumbnailKey = buildAssetThumbnailKey(assetId);
      for (const key of await blobStore.keys()) {
        if (key.startsWith(prefix) || key === thumbnailKey) {
          await blobStore.delete(key);
          revoke(key);
        }
      }
    },
    removeVersionFiles: async (assetId, version) => {
      const prefix = `files/${assetId}/v${version}/`;
      for (const key of await blobStore.keys()) {
        if (key.startsWith(prefix)) {
          await blobStore.delete(key);
          revoke(key);
        }
      }
    },
    resolveUrl: async (ref) => {
      if (ref.storage === 'public') return resolvePublicUrl(ref);
      const cached = objectUrls.get(ref.key);
      if (cached) return cached;
      const blob = await blobStore.get(ref.key);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      objectUrls.set(ref.key, url);
      return url;
    },
  };
}

let sharedRepository: AssetLibraryRepository | null = null;

/** 환경에 맞는 저장소(싱글턴). object URL 캐시를 화면 간에 공유한다. */
export function getAssetLibraryRepository(): AssetLibraryRepository {
  if (!sharedRepository) {
    sharedRepository = import.meta.env.DEV
      ? createDevAssetLibraryRepository()
      : createBrowserAssetLibraryRepository();
  }
  return sharedRepository;
}
