import { create } from 'zustand';
import { createId } from '@crane/core/lib/create-id';
import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import {
  AssetLibraryConflictError,
  addAssetVersion,
  ASSET_COLLECTION_NAME_MAX,
  ASSET_COLLECTIONS_MAX,
  ASSET_LIBRARY_SCHEMA_VERSION,
  buildAssetUsageIndex,
  createAssetId,
  createUserAssetRecord,
  getAssetLibraryRepository,
  getFileExtension,
  mergeAssetLibrary,
  sanitizeAssetFileName,
  setAssetThumbnail,
  setAssetVersionStats,
  setCurrentAssetVersion,
  transitionAssetVersionStatus,
  updateAssetMetadata,
  updateAssetVersionNote,
  type AssetChangeContext,
  type AssetCollection,
  type AssetKind,
  type AssetLibraryDocument,
  type AssetLibraryRepository,
  type AssetMetadataPatch,
  type AssetRecord,
  type AssetStats,
  type AssetStatsTable,
  type AssetUsageIndex,
  type AssetVersionStatus,
  type BuiltinAssetSource,
  type SceneAssetSource,
  ASSET_VERSIONS_MAX,
  getCurrentAssetVersion,
  getNextAssetVersionNumber,
  removeAssetVersion,
  type AssetFile,
  type AssetStoredFile,
} from '@crane/domain/asset-library';
import { collectBuiltinAssetSources } from '../lib/builtin-asset-sources';
import { loadSceneAssetSources } from '../lib/scene-asset-sources';

/**
 * 자산 라이브러리 스토어.
 *
 * 자산·컬렉션을 메모리에 두고, 바꿀 때마다 저장소에 **자동 저장**한다 —
 * 자산 관리 화면에는 "저장" 버튼이 없다(작업 하나가 곧 한 번의 기록이다).
 * 저장은 한 줄로 직렬화하고 실행 시점의 최신 상태를 쓰므로, 연달아 바꿔도
 * 마지막 상태가 남는다. 저장에 실패하면 메모리 상태는 유지하고 `saveState`
 * 를 error 로 두어 화면이 재시도를 권한다.
 *
 * 레코드를 바꾸는 규칙은 @crane/domain/asset-library 의 순수 함수에 있고,
 * 여기서는 그 결과를 반영·저장만 한다. 순수 함수가 같은 참조를 돌려주면
 * (바뀐 것이 없으면) 저장하지 않는다.
 */

export const ASSET_FAVORITES_STORAGE_KEY = 'crane:asset-library:favorites';

export type AssetLibraryStatus = 'idle' | 'loading' | 'ready' | 'error';
/**
 * `error` 는 다시 시도하면 풀릴 수 있는 실패, `conflict` 는 읽은 뒤로 다른
 * 곳에서 문서가 바뀌어 다시 읽어야만 풀리는 실패다.
 */
export type AssetLibrarySaveState = 'idle' | 'saving' | 'error' | 'conflict';

export interface ImportAssetInput {
  file: File;
  kind: AssetKind;
  name: string;
  description: string;
  /** 종류 안의 세부 분류 — 탐색 계층의 체크박스가 이 값으로 좁힌다. */
  tags: string[];
  note: string;
  revision?: string;
  drawingNo?: string;
  contentHash: string | null;
  /** 모델을 최적화해 저장한다(할 수 있는 환경에서만 듣는다). */
  optimize?: boolean;
}

export interface AddVersionInput {
  file: File;
  note: string;
  revision?: string;
  contentHash: string | null;
  optimize?: boolean;
}

export interface AssetLibraryState {
  status: AssetLibraryStatus;
  assets: AssetRecord[];
  collections: AssetCollection[];
  statsTable: AssetStatsTable;
  usageIndex: AssetUsageIndex;
  usageStatus: AssetLibraryStatus;
  /** 읽지 못한 씬 파일 — 사용처가 그만큼 빠져 있음을 화면이 알린다. */
  usageFailedScenes: string[];
  favorites: string[];
  saveState: AssetLibrarySaveState;
  /** 저장이 이 브라우저 안에만 남는 환경인지. */
  localOnly: boolean;
  /** 등록할 때 모델을 최적화할 수 있는 환경인지(dev 서버). */
  canOptimize: boolean;

  /** `force` 는 이미 읽었어도 다시 읽는다(다른 곳에서 바뀌었을 때). */
  load: (options?: { force?: boolean }) => Promise<void>;
  loadUsage: () => Promise<void>;
  retrySave: () => Promise<boolean>;

  updateMetadata: (
    assetId: string,
    patch: AssetMetadataPatch,
    actor: string,
  ) => Promise<boolean>;
  transitionStatus: (
    assetId: string,
    version: number,
    to: AssetVersionStatus,
    actor: string,
  ) => Promise<boolean>;
  setCurrentVersion: (
    assetId: string,
    version: number,
    actor: string,
  ) => Promise<boolean>;
  updateVersionNote: (
    assetId: string,
    version: number,
    patch: { note?: string; revision?: string },
    actor: string,
  ) => Promise<boolean>;
  /** 측정한 통계를 버전에 채운다(이력 없음). 이미 있으면 아무것도 안 한다. */
  recordVersionStats: (
    assetId: string,
    version: number,
    stats: AssetStats,
  ) => Promise<boolean>;
  importAsset: (
    input: ImportAssetInput,
    actor: string,
  ) => Promise<AssetRecord | null>;
  addVersion: (
    assetId: string,
    input: AddVersionInput,
    actor: string,
  ) => Promise<number | null>;
  /**
   * 썸네일을 저장한다. `actor` 가 null 이면 자동 생성으로 보고 이력을 남기지
   * 않는다.
   */
  saveThumbnail: (
    assetId: string,
    blob: Blob,
    actor: string | null,
  ) => Promise<boolean>;
  /** 이 화면에서 등록한 자산만 지울 수 있다. */
  removeAsset: (assetId: string) => Promise<boolean>;
  /** 게시된 적 없는(초안·반려) 버전을 파일과 함께 지운다. */
  removeVersion: (
    assetId: string,
    version: number,
    actor: string,
  ) => Promise<boolean>;
  /**
   * 여러 자산을 한 번에 고치고 **한 번만** 저장한다. `toPatch` 가 null 을
   * 돌려준 자산은 건드리지 않는다. 실제로 바뀐 자산 수를 돌려준다(저장에
   * 실패하면 0 이고 `saveState` 가 알린다).
   */
  updateManyMetadata: (
    assetIds: readonly string[],
    toPatch: (asset: AssetRecord) => AssetMetadataPatch | null,
    actor: string,
  ) => Promise<number>;
  /** 여러 자산의 현재 버전 상태를 한 번에 옮긴다. 허용되지 않는 것은 건너뛴다. */
  transitionManyStatus: (
    assetIds: readonly string[],
    to: AssetVersionStatus,
    actor: string,
  ) => Promise<number>;
  /** 등록한 자산 여럿을 한 번에 지운다. 지운 수를 돌려준다. */
  removeManyAssets: (assetIds: readonly string[]) => Promise<number>;

  toggleFavorite: (assetId: string) => void;
  createCollection: (name: string) => Promise<string | null>;
  renameCollection: (collectionId: string, name: string) => Promise<boolean>;
  removeCollection: (collectionId: string) => Promise<boolean>;
  setCollectionMembership: (
    collectionId: string,
    assetIds: readonly string[],
    member: boolean,
  ) => Promise<boolean>;
}

export interface AssetLibraryStoreDeps {
  getRepository: () => AssetLibraryRepository;
  getBuiltinSources: () => BuiltinAssetSource[];
  loadSceneSources: () => Promise<{
    sources: SceneAssetSource[];
    failed: string[];
  }>;
  now: () => string;
  createId: () => string;
}

const defaultDeps: AssetLibraryStoreDeps = {
  getRepository: getAssetLibraryRepository,
  getBuiltinSources: collectBuiltinAssetSources,
  loadSceneSources: loadSceneAssetSources,
  now: () => new Date().toISOString(),
  createId,
};

function readFavorites(): string[] {
  const stored = getStorageJson<unknown>(ASSET_FAVORITES_STORAGE_KEY);
  return Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === 'string')
    : [];
}

export function createAssetLibraryStore(
  overrides: Partial<AssetLibraryStoreDeps> = {},
) {
  const deps = { ...defaultDeps, ...overrides };
  // 저장을 한 줄로 세운다. 앞선 저장이 실패해도 다음 저장은 진행한다.
  let saveQueue: Promise<unknown> = Promise.resolve();
  let loadPromise: Promise<void> | null = null;

  return create<AssetLibraryState>((set, get) => {
    const context = (actor: string): AssetChangeContext => ({
      entryId: deps.createId(),
      at: deps.now(),
      actor,
    });

    const toDocument = (): AssetLibraryDocument => ({
      schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
      assets: get().assets,
      collections: get().collections,
    });

    /**
     * 라이브러리를 다 읽은 뒤에만 고치고 저장한다. 읽는 중이거나 읽기에
     * 실패한 상태의 메모리는 빈 목록이라, 그대로 저장하면 문서가 빈 것으로
     * 덮인다.
     */
    const isReady = () => get().status === 'ready';

    /**
     * 최적화를 걸지 — 요청했고, 모델이고, GLB 일 때만. 지도는 전용
     * 파이프라인(타일·LOD)이 따로 있어 여기서 건드리지 않는다.
     */
    const canOptimizeFile = (
      requested: boolean | undefined,
      kind: AssetRecord['kind'],
      fileName: string,
    ) =>
      requested === true &&
      kind === 'model' &&
      getFileExtension(fileName) === 'glb';

    /** 저장 결과를 버전의 파일 정보로. */
    const toAssetFile = (
      stored: AssetStoredFile,
      fileName: string,
      upload: File,
      contentHash: string | null,
    ): AssetFile => ({
      ref: stored.ref,
      fileName,
      format: getFileExtension(fileName),
      sizeBytes: stored.sizeBytes,
      contentHash,
      ...(stored.optimized ? { originalSizeBytes: upload.size } : {}),
    });

    const persist = (): Promise<boolean> => {
      if (!isReady()) return Promise.resolve(false);
      // 다른 곳에서 바뀐 뒤로는 다시 읽기 전까지 쓰지 않는다 — 어차피 거부되고,
      // 그사이 "저장 중"·"저장됨" 으로 보이면 충돌이 가려진다.
      if (get().saveState === 'conflict') return Promise.resolve(false);
      set({ saveState: 'saving' });
      const run = saveQueue
        .catch(() => undefined)
        // 실행 시점의 상태를 쓴다 — 줄 서 있는 동안 더 바뀌었으면 그것까지 담긴다.
        .then(() => deps.getRepository().save(toDocument()));
      saveQueue = run;
      return run.then(
        () => {
          if (saveQueue === run && get().saveState !== 'conflict') {
            set({ saveState: 'idle' });
          }
          return true;
        },
        (error: unknown) => {
          console.error('[asset-library] Failed to save.', error);
          // 다른 곳에서 바뀐 것은 다시 시도해도 풀리지 않는다 — 다시 읽어야
          // 한다. 뒤이은 저장이 성공으로 덮어 감추지 않게 줄과 무관하게 남긴다.
          if (error instanceof AssetLibraryConflictError) {
            set({ saveState: 'conflict' });
          } else if (saveQueue === run && get().saveState !== 'conflict') {
            set({ saveState: 'error' });
          }
          return false;
        },
      );
    };

    /** 순수 함수의 결과를 반영한다. 같은 참조면 no-op(저장 없음). */
    const applyToAsset = (
      assetId: string,
      change: (asset: AssetRecord) => AssetRecord,
    ): Promise<boolean> => {
      if (!isReady()) return Promise.resolve(false);
      const current = get().assets.find((asset) => asset.id === assetId);
      if (!current) return Promise.resolve(false);
      const next = change(current);
      if (next === current) return Promise.resolve(false);
      set({
        assets: get().assets.map((asset) =>
          asset.id === assetId ? next : asset,
        ),
      });
      return persist();
    };

    /** 여러 자산에 같은 변경을 걸고 한 번만 저장한다. 바뀐 수를 돌려준다. */
    const applyToMany = async (
      assetIds: readonly string[],
      change: (asset: AssetRecord) => AssetRecord,
    ): Promise<number> => {
      if (!isReady()) return 0;
      const targets = new Set(assetIds);
      let changed = 0;
      const next = get().assets.map((asset) => {
        if (!targets.has(asset.id)) return asset;
        const updated = change(asset);
        if (updated !== asset) changed += 1;
        return updated;
      });
      if (changed === 0) return 0;
      set({ assets: next });
      return (await persist()) ? changed : 0;
    };

    const setCollections = (collections: AssetCollection[]) => {
      if (!isReady()) return Promise.resolve(false);
      set({ collections });
      return persist();
    };

    return {
      status: 'idle',
      assets: [],
      collections: [],
      statsTable: {},
      usageIndex: new Map(),
      usageStatus: 'idle',
      usageFailedScenes: [],
      favorites: readFavorites(),
      saveState: 'idle',
      localOnly: false,
      canOptimize: false,

      load: (options) => {
        // 여러 화면이 동시에 불러도 한 번만 읽는다.
        if (loadPromise) return loadPromise;
        if (get().status === 'ready' && !options?.force) {
          return Promise.resolve();
        }
        set({ status: 'loading' });
        const repository = deps.getRepository();
        loadPromise = Promise.all([
          repository.load(),
          repository.loadStatsTable(),
        ])
          .then(([document, statsTable]) => {
            const merged = mergeAssetLibrary(
              deps.getBuiltinSources(),
              document,
            );
            set({
              status: 'ready',
              assets: merged.assets,
              collections: merged.collections,
              statsTable,
              localOnly: repository.localOnly,
              canOptimize: repository.canOptimize,
              // 다시 읽었으니 저장 못 한 변경과 충돌은 여기서 끝난다.
              saveState: 'idle',
            });
          })
          .catch((error: unknown) => {
            console.error('[asset-library] Failed to load.', error);
            set({ status: 'error' });
          })
          .finally(() => {
            loadPromise = null;
          });
        return loadPromise;
      },

      loadUsage: async () => {
        if (get().usageStatus === 'loading') return;
        set({ usageStatus: 'loading' });
        try {
          const { sources, failed } = await deps.loadSceneSources();
          set({
            usageIndex: buildAssetUsageIndex(sources),
            usageFailedScenes: failed,
            usageStatus: 'ready',
          });
        } catch (error) {
          console.error('[asset-library] Failed to load scene usage.', error);
          set({ usageStatus: 'error' });
        }
      },

      retrySave: () => persist(),

      updateMetadata: (assetId, patch, actor) =>
        applyToAsset(assetId, (asset) =>
          updateAssetMetadata(asset, patch, context(actor)),
        ),

      transitionStatus: (assetId, version, to, actor) =>
        applyToAsset(assetId, (asset) =>
          transitionAssetVersionStatus(asset, version, to, context(actor)),
        ),

      setCurrentVersion: (assetId, version, actor) =>
        applyToAsset(assetId, (asset) =>
          setCurrentAssetVersion(asset, version, context(actor)),
        ),

      updateVersionNote: (assetId, version, patch, actor) =>
        applyToAsset(assetId, (asset) =>
          updateAssetVersionNote(asset, version, patch, context(actor)),
        ),

      recordVersionStats: (assetId, version, stats) =>
        applyToAsset(assetId, (asset) => {
          const target = asset.versions.find((v) => v.version === version);
          if (!target || target.stats) return asset;
          return setAssetVersionStats(asset, version, stats);
        }),

      importAsset: async (input, actor) => {
        if (!isReady()) return null;
        const existingIds = new Set(get().assets.map((asset) => asset.id));
        const id = createAssetId(input.name, existingIds, deps.createId());
        const fileName = sanitizeAssetFileName(input.file.name);
        let stored;
        try {
          stored = await deps
            .getRepository()
            .putVersionFile({ assetId: id, version: 1, fileName }, input.file, {
              optimize: canOptimizeFile(input.optimize, input.kind, fileName),
            });
        } catch (error) {
          console.error('[asset-library] Failed to store file.', error);
          return null;
        }
        const record = createUserAssetRecord(
          {
            id,
            kind: input.kind,
            name: input.name,
            description: input.description,
            tags: input.tags,
            file: toAssetFile(stored, fileName, input.file, input.contentHash),
            note: input.note,
            revision: input.revision,
            drawingNo: input.drawingNo,
          },
          context(actor),
        );
        set({ assets: [...get().assets, record] });
        await persist();
        return record;
      },

      addVersion: async (assetId, input, actor) => {
        if (!isReady()) return null;
        const asset = get().assets.find((a) => a.id === assetId);
        if (!asset) return null;
        // 상한에 닿은 자산에는 파일부터 올리지 않는다(주인 없는 파일이 남는다).
        if (asset.versions.length >= ASSET_VERSIONS_MAX) return null;
        const version = getNextAssetVersionNumber(asset);
        const fileName = sanitizeAssetFileName(input.file.name);
        let stored;
        try {
          stored = await deps
            .getRepository()
            .putVersionFile({ assetId, version, fileName }, input.file, {
              optimize: canOptimizeFile(input.optimize, asset.kind, fileName),
            });
        } catch (error) {
          console.error('[asset-library] Failed to store file.', error);
          return null;
        }
        let added: number | null = null;
        await applyToAsset(assetId, (current) => {
          const next = addAssetVersion(
            current,
            {
              file: toAssetFile(stored, fileName, input.file, input.contentHash),
              note: input.note,
              revision: input.revision,
            },
            context(actor),
          );
          if (next !== current) {
            added = next.versions[next.versions.length - 1].version;
          }
          return next;
        });
        return added;
      },

      saveThumbnail: async (assetId, blob, actor) => {
        if (!isReady()) return false;
        let ref;
        try {
          ref = await deps.getRepository().putThumbnail(assetId, blob);
        } catch (error) {
          console.error('[asset-library] Failed to store thumbnail.', error);
          return false;
        }
        const updatedAt = deps.now();
        return applyToAsset(assetId, (asset) =>
          setAssetThumbnail(
            asset,
            { ref, updatedAt },
            actor === null ? null : { ...context(actor), at: updatedAt },
          ),
        );
      },

      removeAsset: async (assetId) => {
        if (!isReady()) return false;
        const asset = get().assets.find((a) => a.id === assetId);
        if (!asset || asset.origin !== 'user') return false;
        const before = {
          assets: get().assets,
          collections: get().collections,
          favorites: get().favorites,
        };
        set({
          assets: get()
            .assets.filter((a) => a.id !== assetId)
            .map((a) =>
              a.relatedAssetIds.includes(assetId)
                ? {
                    ...a,
                    relatedAssetIds: a.relatedAssetIds.filter(
                      (id) => id !== assetId,
                    ),
                  }
                : a,
            ),
          collections: get().collections.map((collection) =>
            collection.assetIds.includes(assetId)
              ? {
                  ...collection,
                  assetIds: collection.assetIds.filter((id) => id !== assetId),
                }
              : collection,
          ),
          favorites: get().favorites.filter((id) => id !== assetId),
        });
        const saved = await persist();
        // 문서에서 빠진 것이 저장된 뒤에만 파일을 지운다. 저장에 실패하면
        // 문서에는 자산이 남아 있으므로, 파일을 지우면 다시 열었을 때 파일
        // 없는 자산이 된다 — 지우지 않고 화면도 지우기 전으로 되돌린다.
        if (!saved) {
          set(before);
          return false;
        }
        // 파일 삭제 실패는 고아 파일로 남을 뿐이다.
        try {
          await deps.getRepository().removeAssetFiles(assetId);
        } catch (error) {
          console.warn('[asset-library] Failed to remove asset files.', error);
        }
        return saved;
      },

      removeVersion: async (assetId, version, actor) => {
        const saved = await applyToAsset(assetId, (asset) =>
          removeAssetVersion(asset, version, context(actor)),
        );
        if (!saved) return false;
        try {
          await deps.getRepository().removeVersionFiles(assetId, version);
        } catch (error) {
          console.warn('[asset-library] Failed to remove version files.', error);
        }
        return true;
      },

      updateManyMetadata: (assetIds, toPatch, actor) =>
        applyToMany(assetIds, (asset) => {
          const patch = toPatch(asset);
          return patch ? updateAssetMetadata(asset, patch, context(actor)) : asset;
        }),

      transitionManyStatus: (assetIds, to, actor) =>
        applyToMany(assetIds, (asset) =>
          transitionAssetVersionStatus(
            asset,
            getCurrentAssetVersion(asset).version,
            to,
            context(actor),
          ),
        ),

      removeManyAssets: async (assetIds) => {
        if (!isReady()) return 0;
        const targets = new Set(
          get()
            .assets.filter(
              (asset) => assetIds.includes(asset.id) && asset.origin === 'user',
            )
            .map((asset) => asset.id),
        );
        if (targets.size === 0) return 0;
        const before = {
          assets: get().assets,
          collections: get().collections,
          favorites: get().favorites,
        };
        set({
          assets: before.assets
            .filter((asset) => !targets.has(asset.id))
            .map((asset) =>
              asset.relatedAssetIds.some((id) => targets.has(id))
                ? {
                    ...asset,
                    relatedAssetIds: asset.relatedAssetIds.filter(
                      (id) => !targets.has(id),
                    ),
                  }
                : asset,
            ),
          collections: before.collections.map((collection) =>
            collection.assetIds.some((id) => targets.has(id))
              ? {
                  ...collection,
                  assetIds: collection.assetIds.filter((id) => !targets.has(id)),
                }
              : collection,
          ),
          favorites: before.favorites.filter((id) => !targets.has(id)),
        });
        if (!(await persist())) {
          set(before);
          return 0;
        }
        for (const assetId of targets) {
          try {
            await deps.getRepository().removeAssetFiles(assetId);
          } catch (error) {
            console.warn('[asset-library] Failed to remove asset files.', error);
          }
        }
        return targets.size;
      },

      toggleFavorite: (assetId) => {
        const favorites = get().favorites.includes(assetId)
          ? get().favorites.filter((id) => id !== assetId)
          : [...get().favorites, assetId];
        set({ favorites });
        setStorageJson(ASSET_FAVORITES_STORAGE_KEY, favorites);
      },

      createCollection: async (rawName) => {
        if (!isReady()) return null;
        const name = rawName.trim().slice(0, ASSET_COLLECTION_NAME_MAX);
        const collections = get().collections;
        if (!name || collections.length >= ASSET_COLLECTIONS_MAX) return null;
        if (collections.some((c) => c.name === name)) return null;
        const id = createAssetId(
          name,
          new Set(collections.map((c) => c.id)),
          deps.createId(),
        );
        await setCollections([...collections, { id, name, assetIds: [] }]);
        return id;
      },

      renameCollection: (collectionId, rawName) => {
        const name = rawName.trim().slice(0, ASSET_COLLECTION_NAME_MAX);
        const collections = get().collections;
        const target = collections.find((c) => c.id === collectionId);
        if (!target || !name || target.name === name) {
          return Promise.resolve(false);
        }
        if (collections.some((c) => c.name === name)) {
          return Promise.resolve(false);
        }
        return setCollections(
          collections.map((c) => (c.id === collectionId ? { ...c, name } : c)),
        );
      },

      removeCollection: (collectionId) => {
        const collections = get().collections;
        if (!collections.some((c) => c.id === collectionId)) {
          return Promise.resolve(false);
        }
        return setCollections(collections.filter((c) => c.id !== collectionId));
      },

      setCollectionMembership: (collectionId, assetIds, member) => {
        const collections = get().collections;
        const target = collections.find((c) => c.id === collectionId);
        if (!target) return Promise.resolve(false);
        const known = new Set(get().assets.map((asset) => asset.id));
        const current = new Set(target.assetIds);
        const before = current.size;
        let removed = false;
        for (const assetId of assetIds) {
          if (!known.has(assetId)) continue;
          if (member) current.add(assetId);
          else removed = current.delete(assetId) || removed;
        }
        if (current.size === before && !removed) return Promise.resolve(false);
        return setCollections(
          collections.map((c) =>
            c.id === collectionId ? { ...c, assetIds: [...current] } : c,
          ),
        );
      },
    };
  });
}

export const useAssetLibraryStore = createAssetLibraryStore();
