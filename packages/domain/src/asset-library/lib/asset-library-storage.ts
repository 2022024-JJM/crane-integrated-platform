import { getAssetContentHash, withBaseUrl } from '@crane/core/lib/asset-url';
import {
  ASSET_LIBRARY_DOCUMENT_PATH,
  ASSET_LIBRARY_STATS_PATH,
  buildAssetThumbnailKey,
  buildAssetVersionFileKey,
  DEV_ASSET_LIBRARY_API_PATH,
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
 * - 운영: 미들웨어가 없으므로 문서는 localStorage 봉투에, 파일은 IndexedDB 에
 *   둔다 — **이 브라우저에만** 남는다. 봉투의 baseVersion(배포 문서의 콘텐츠
 *   해시)이 현재 배포와 다르면 배포본이 이긴다(씬·가상 태그와 같은 규칙).
 */

export const ASSET_LIBRARY_STORAGE_KEY = 'crane:asset-library';

export interface AssetLibraryRepository {
  /** 저장이 이 브라우저 안에만 남는 환경인지. */
  readonly localOnly: boolean;
  load(): Promise<AssetLibraryDocument>;
  loadStatsTable(): Promise<AssetStatsTable>;
  save(document: AssetLibraryDocument): Promise<void>;
  /** 버전 파일을 저장하고 그 위치를 돌려준다. 같은 위치에 덮어쓰지 않는다. */
  putVersionFile(
    target: { assetId: string; version: number; fileName: string },
    blob: Blob,
  ): Promise<AssetFileRef>;
  putThumbnail(assetId: string, blob: Blob): Promise<AssetFileRef>;
  /** 자산의 모든 파일(버전·썸네일)을 지운다. */
  removeAssetFiles(assetId: string): Promise<void>;
  /** 화면에서 읽을 수 있는 URL. 브라우저 저장분은 object URL 이다. */
  resolveUrl(ref: AssetFileRef): Promise<string | null>;
}

function isBrowser() {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

async function fetchDeployedDocument(): Promise<AssetLibraryDocument> {
  const response = await fetch(withBaseUrl(ASSET_LIBRARY_DOCUMENT_PATH), {
    cache: 'no-store',
  });
  // 문서가 아직 없는 배포(404)는 "저장된 메타데이터 없음" 이다 — builtin
  // 자산만으로 라이브러리가 성립하므로 빈 문서로 본다.
  if (response.status === 404) return createEmptyAssetLibraryDocument();
  if (!response.ok) {
    throw new Error(`Failed to load asset library. HTTP ${response.status}`);
  }
  return sanitizeAssetLibraryDocument(await response.json());
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

  return {
    localOnly: false,
    load: fetchDeployedDocument,
    loadStatsTable: fetchStatsTable,
    save: async (document) => {
      const response = await fetch(DEV_ASSET_LIBRARY_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document),
      });
      if (!response.ok) {
        throw new Error(`Failed to save asset library. HTTP ${response.status}`);
      }
    },
    putVersionFile: (target, blob) =>
      postFile(
        buildAssetVersionFileKey(
          target.assetId,
          target.version,
          target.fileName,
        ),
        blob,
      ),
    putThumbnail: (assetId, blob) =>
      postFile(buildAssetThumbnailKey(assetId), blob),
    removeAssetFiles: async (assetId) => {
      const params = new URLSearchParams({ assetId });
      const response = await fetch(
        `${DEV_ASSET_LIBRARY_API_PATH}/file?${params.toString()}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(`Failed to remove asset files. HTTP ${response.status}`);
      }
    },
    resolveUrl: async (ref) => resolvePublicUrl(ref),
  };
}

interface StoredEnvelope {
  baseVersion: string | null;
  document: AssetLibraryDocument;
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
  isCurrent: boolean;
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
  return {
    document: sanitizeAssetLibraryDocument(parsed.document),
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

  return {
    localOnly: true,
    load: async () => {
      const stored = readStoredRecord();
      if (stored?.isCurrent) return stored.document;
      try {
        const deployed = await fetchDeployedDocument();
        if (stored && isBrowser()) {
          window.localStorage.removeItem(ASSET_LIBRARY_STORAGE_KEY);
        }
        return deployed;
      } catch (error) {
        if (stored) {
          console.warn(
            '[asset-library-storage] Failed to load deployed library. Falling back to stale local copy.',
            error,
          );
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
      const envelope: StoredEnvelope = {
        baseVersion: getAssetContentHash(ASSET_LIBRARY_DOCUMENT_PATH),
        document,
      };
      // 용량 초과(QuotaExceededError)는 그대로 던진다 — 호출부가 저장 실패로
      // 알린다. 조용히 삼키면 사용자는 저장된 줄 안다.
      window.localStorage.setItem(
        ASSET_LIBRARY_STORAGE_KEY,
        JSON.stringify(envelope),
      );
    },
    putVersionFile: (target, blob) =>
      put(
        buildAssetVersionFileKey(
          target.assetId,
          target.version,
          target.fileName,
        ),
        blob,
      ),
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
