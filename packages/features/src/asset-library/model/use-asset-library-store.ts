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
  createAssetRecord,
  getAssetLibraryRepository,
  getAssetRemoveBlock,
  getAssetWithdrawBlock,
  getFileExtension,
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
  type AssetOptimizeKind,
  type AssetRecord,
  type AssetStats,
  type AssetStatsTable,
  type AssetUsageIndex,
  type AssetUsageSource,
  type AssetUsageState,
  type AssetVersionStatus,
  ASSET_VERSIONS_MAX,
  getCurrentAssetVersion,
  getNextAssetVersionNumber,
  removeAssetVersion,
  type AssetFile,
  type AssetStoredFile,
} from '@crane/domain/asset-library';
import { collectCodeAssetSources } from '../lib/code-asset-sources';
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
 *
 * 스토어가 직접 지키는 것은 두 가지다. 파일을 올리고 지우는 일(등록·새 버전·
 * 삭제)은 그럴 수 있는 환경(`canManageFiles`)에서만 한다. 그리고 씬이나 화면
 * 코드가 쓰고 있는 자산은 지우지 않고, 쓰이는 버전은 철회하지 않는다 —
 * 그때마다 사용처를 다시 읽어 확인한다.
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
  categories: string[];
  revision?: string;
  drawingNo?: string;
  contentHash: string | null;
  /** 모델·지도를 최적화해 저장한다(할 수 있는 환경에서만 듣는다). */
  optimize?: boolean;
}

/** 방금 올린 파일을 저장하면서 파이프라인이 한 일. */
export interface AssetFileReport {
  assetId: string;
  version: number;
  /** 최적화를 요청했는가. */
  requested: boolean;
  /** 최적화해 저장했는가. 요청했는데 false 면 원본 그대로 저장한 것이다. */
  optimized: boolean;
  /** 파이프라인이 고른 것·건너뛴 이유. */
  lines: string[];
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
  /**
   * 파일을 올리고 지울 수 있는 환경인지(dev 서버) — 자산 등록, 새 버전 올리기,
   * 자산·버전 삭제. 아니면 그 작업들은 아무것도 하지 않는다.
   */
  canManageFiles: boolean;
  /** 등록할 때 모델·지도를 최적화할 수 있는 환경인지(dev 서버). */
  canOptimize: boolean;
  /** 마지막으로 올린 파일의 처리 결과 — 화면이 한 번 알린다. */
  fileReport: AssetFileReport | null;

  /** `force` 는 이미 읽었어도 다시 읽는다(다른 곳에서 바뀌었을 때). */
  load: (options?: { force?: boolean }) => Promise<void>;
  /** 사용처를 (다시) 읽는다. 이미 읽는 중이면 그 읽기를 기다린다. */
  loadUsage: () => Promise<void>;
  retrySave: () => Promise<boolean>;

  updateMetadata: (
    assetId: string,
    patch: AssetMetadataPatch,
    actor: string,
  ) => Promise<boolean>;
  /** 쓰이고 있는 버전은 철회하지 않는다(false). */
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
  /** 어디에서도 쓰이지 않는 자산만 지운다(파일까지). */
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
  /**
   * 여러 자산의 현재 버전 상태를 한 번에 옮긴다. 허용되지 않는 것(표에 없는
   * 전이, 쓰이고 있는 버전의 철회)은 건너뛴다.
   */
  transitionManyStatus: (
    assetIds: readonly string[],
    to: AssetVersionStatus,
    actor: string,
  ) => Promise<number>;
  /** 쓰이지 않는 자산 여럿을 한 번에 지운다. 지운 수를 돌려준다. */
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
  /** 화면 코드가 직접 쓰는 자산 — 씬과 함께 사용처가 된다. */
  getCodeSources: () => AssetUsageSource[];
  loadSceneSources: () => Promise<{
    sources: AssetUsageSource[];
    failed: string[];
  }>;
  now: () => string;
  createId: () => string;
}

const defaultDeps: AssetLibraryStoreDeps = {
  getRepository: getAssetLibraryRepository,
  getCodeSources: collectCodeAssetSources,
  loadSceneSources: loadSceneAssetSources,
  now: () => new Date().toISOString(),
  createId,
};

/** 사용처를 다 읽었는가 — 다 읽지 못했으면 "안 쓰인다" 를 믿을 수 없다. */
export function toAssetUsageState(
  state: Pick<
    AssetLibraryState,
    'usageIndex' | 'usageStatus' | 'usageFailedScenes'
  >,
): AssetUsageState {
  return {
    index: state.usageIndex,
    known: state.usageStatus === 'ready' && state.usageFailedScenes.length === 0,
  };
}

function readFavorites(): string[] {
  const stored = getStorageJson<unknown>(ASSET_FAVORITES_STORAGE_KEY);
  if (!Array.isArray(stored)) return [];
  // 같은 id 가 두 번 적혀 있으면 한 번만 — 개수가 보이는 자산보다 많아진다.
  return [
    ...new Set(stored.filter((id): id is string => typeof id === 'string')),
  ];
}

export function createAssetLibraryStore(
  overrides: Partial<AssetLibraryStoreDeps> = {},
) {
  const deps = { ...defaultDeps, ...overrides };
  // 저장을 한 줄로 세운다. 앞선 저장이 실패해도 다음 저장은 진행한다.
  let saveQueue: Promise<unknown> = Promise.resolve();
  let loadPromise: Promise<void> | null = null;
  let usagePromise: Promise<void> | null = null;

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
     * 어느 파이프라인으로 최적화할지 — 요청했고, GLB 이고, 모델이나 지도일
     * 때만. 지도는 정책이 달라(타일·LOD·평면 레이어 보호) 전용 파이프라인을
     * 탄다.
     */
    const resolveOptimizeKind = (
      requested: boolean | undefined,
      kind: AssetRecord['kind'],
      fileName: string,
    ): AssetOptimizeKind | undefined => {
      if (requested !== true || getFileExtension(fileName) !== 'glb') {
        return undefined;
      }
      return kind === 'model' || kind === 'map' ? kind : undefined;
    };

    /**
     * 사용처를 새로 읽고, 다 읽었는지와 함께 돌려준다. 철회·삭제 직전에
     * 부른다 — 화면을 연 뒤로 씬이 바뀌었을 수 있다.
     */
    const readUsage = async (): Promise<AssetUsageState> => {
      await get().loadUsage();
      return toAssetUsageState(get());
    };

    /**
     * 자산을 지울 때 함께 지울 옛 배포 경로의 파일 — 남는 자산이 같은 파일을
     * 가리키면 뺀다. 라이브러리 디렉터리 안의 파일은 저장소가 자산 id 로
     * 지운다.
     */
    const collectLegacyPaths = (
      removed: readonly AssetRecord[],
      remaining: readonly AssetRecord[],
    ): Map<string, string[]> => {
      const kept = new Set<string>();
      for (const asset of remaining) {
        for (const version of asset.versions) {
          if (version.file.ref.storage === 'public') {
            kept.add(version.file.ref.path);
          }
        }
      }
      return new Map(
        removed.map((asset) => [
          asset.id,
          asset.versions.flatMap((version) =>
            version.file.ref.storage === 'public' &&
            !kept.has(version.file.ref.path)
              ? [version.file.ref.path]
              : [],
          ),
        ]),
      );
    };

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
      // 화면 코드가 쓰는 자산은 씬을 읽기 전에도 안다 — 처음부터 담아 둔다.
      usageIndex: buildAssetUsageIndex(deps.getCodeSources()),
      usageStatus: 'idle',
      usageFailedScenes: [],
      favorites: readFavorites(),
      saveState: 'idle',
      localOnly: false,
      canManageFiles: false,
      canOptimize: false,
      fileReport: null,

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
            // 없어진 자산을 가리키는 즐겨찾기는 걷어낸다(다른 곳에서 지워졌거나
            // 배포가 바뀌어 사라진 자산). 남겨 두면 레일의 개수에는 세어지는데
            // 눌러도 보이지 않는다. 읽기에 성공했을 때만 한다 — 실패한 상태의
            // 빈 목록으로 견주면 전부 지워진다.
            const liveIds = new Set(document.assets.map((asset) => asset.id));
            const current = get().favorites;
            const favorites = current.filter((id) => liveIds.has(id));
            const pruned = favorites.length !== current.length;
            set({
              status: 'ready',
              assets: document.assets,
              collections: document.collections,
              statsTable,
              localOnly: repository.localOnly,
              canManageFiles: repository.canManageFiles,
              canOptimize: repository.canOptimize,
              // 다시 읽었으니 저장 못 한 변경과 충돌은 여기서 끝난다.
              saveState: 'idle',
              ...(pruned ? { favorites } : {}),
            });
            if (pruned) setStorageJson(ASSET_FAVORITES_STORAGE_KEY, favorites);
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

      loadUsage: () => {
        if (usagePromise) return usagePromise;
        // 이미 읽은 것을 다시 읽을 때는 화면을 "읽는 중" 으로 되돌리지 않는다 —
        // 읽은 값이 보이는 채로 새 값으로 바뀐다.
        if (get().usageStatus !== 'ready') set({ usageStatus: 'loading' });
        usagePromise = deps
          .loadSceneSources()
          .then(
            ({ sources, failed }) => {
              set({
                usageIndex: buildAssetUsageIndex([
                  ...sources,
                  ...deps.getCodeSources(),
                ]),
                usageFailedScenes: failed,
                usageStatus: 'ready',
              });
            },
            (error: unknown) => {
              console.error(
                '[asset-library] Failed to load scene usage.',
                error,
              );
              // 씬을 못 읽어도 코드가 쓰는 자산은 사용처에 남긴다.
              set({
                usageIndex: buildAssetUsageIndex(deps.getCodeSources()),
                usageStatus: 'error',
              });
            },
          )
          .finally(() => {
            usagePromise = null;
          });
        return usagePromise;
      },

      retrySave: () => persist(),

      updateMetadata: (assetId, patch, actor) =>
        applyToAsset(assetId, (asset) =>
          updateAssetMetadata(asset, patch, context(actor)),
        ),

      transitionStatus: async (assetId, version, to, actor) => {
        if (to === 'withdrawn') {
          if (!isReady()) return false;
          const usage = await readUsage();
          const asset = get().assets.find((a) => a.id === assetId);
          if (!asset || getAssetWithdrawBlock(asset, version, usage)) {
            return false;
          }
        }
        return applyToAsset(assetId, (asset) =>
          transitionAssetVersionStatus(asset, version, to, context(actor)),
        );
      },

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
        if (!isReady() || !get().canManageFiles) return null;
        const existingIds = new Set(get().assets.map((asset) => asset.id));
        const id = createAssetId(input.name, existingIds, deps.createId());
        const fileName = sanitizeAssetFileName(input.file.name);
        const optimize = resolveOptimizeKind(
          input.optimize,
          input.kind,
          fileName,
        );
        let stored;
        try {
          stored = await deps
            .getRepository()
            .putVersionFile({ assetId: id, version: 1, fileName }, input.file, {
              optimize,
            });
        } catch (error) {
          console.error('[asset-library] Failed to store file.', error);
          return null;
        }
        const record = createAssetRecord(
          {
            id,
            kind: input.kind,
            name: input.name,
            description: input.description,
            categories: input.categories,
            file: toAssetFile(stored, fileName, input.file, input.contentHash),
            revision: input.revision,
            drawingNo: input.drawingNo,
            // 지도 파이프라인이 지운 루트 오프셋 — 팔레트로 추가하면 그 자리에
            // 놓인다(Blender 씬에 있던 자리). 새 버전에는 적용하지 않는다:
            // 이미 놓인 것과 기본 위치는 그 자산의 것이다.
            ...(stored.rootOffset
              ? { placement: { defaultPosition: stored.rootOffset } }
              : {}),
          },
          context(actor),
        );
        set({
          assets: [...get().assets, record],
          fileReport: {
            assetId: id,
            version: 1,
            requested: optimize !== undefined,
            optimized: stored.optimized,
            lines: stored.report,
          },
        });
        await persist();
        return record;
      },

      addVersion: async (assetId, input, actor) => {
        if (!isReady() || !get().canManageFiles) return null;
        const asset = get().assets.find((a) => a.id === assetId);
        if (!asset) return null;
        // 상한에 닿은 자산에는 파일부터 올리지 않는다(주인 없는 파일이 남는다).
        if (asset.versions.length >= ASSET_VERSIONS_MAX) return null;
        const version = getNextAssetVersionNumber(asset);
        const fileName = sanitizeAssetFileName(input.file.name);
        const optimize = resolveOptimizeKind(
          input.optimize,
          asset.kind,
          fileName,
        );
        let stored;
        try {
          stored = await deps
            .getRepository()
            .putVersionFile({ assetId, version, fileName }, input.file, {
              optimize,
            });
        } catch (error) {
          console.error('[asset-library] Failed to store file.', error);
          return null;
        }
        const report: AssetFileReport = {
          assetId,
          version,
          requested: optimize !== undefined,
          optimized: stored.optimized,
          lines: stored.report,
        };
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
        if (added !== null) set({ fileReport: report });
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
        if (!isReady() || !get().canManageFiles) return false;
        const usage = await readUsage();
        const asset = get().assets.find((a) => a.id === assetId);
        if (!asset || getAssetRemoveBlock(asset, usage)) return false;
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
        const legacyPaths = collectLegacyPaths([asset], get().assets);
        try {
          await deps
            .getRepository()
            .removeAssetFiles(assetId, legacyPaths.get(assetId) ?? []);
        } catch (error) {
          console.warn('[asset-library] Failed to remove asset files.', error);
        }
        return saved;
      },

      removeVersion: async (assetId, version, actor) => {
        if (!get().canManageFiles) return false;
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

      transitionManyStatus: async (assetIds, to, actor) => {
        if (!isReady()) return 0;
        const usage = to === 'withdrawn' ? await readUsage() : null;
        return applyToMany(assetIds, (asset) => {
          const version = getCurrentAssetVersion(asset).version;
          if (usage && getAssetWithdrawBlock(asset, version, usage)) {
            return asset;
          }
          return transitionAssetVersionStatus(
            asset,
            version,
            to,
            context(actor),
          );
        });
      },

      removeManyAssets: async (assetIds) => {
        if (!isReady() || !get().canManageFiles) return 0;
        const usage = await readUsage();
        const removed = get().assets.filter(
          (asset) =>
            assetIds.includes(asset.id) && !getAssetRemoveBlock(asset, usage),
        );
        const targets = new Set(removed.map((asset) => asset.id));
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
        const legacyPaths = collectLegacyPaths(removed, get().assets);
        for (const assetId of targets) {
          try {
            await deps
              .getRepository()
              .removeAssetFiles(assetId, legacyPaths.get(assetId) ?? []);
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
