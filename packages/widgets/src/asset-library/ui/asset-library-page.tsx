import {
  ArrowDown,
  ArrowUp,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHref, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  buildCsv,
  downloadCsv,
  formatCsvTimestamp,
} from '@crane/core/lib/export-csv';
import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { cn } from '@crane/core/lib/utils';
import {
  ASSET_KINDS,
  ASSET_SORT_KEYS,
  ASSET_VERSION_STATUSES,
  buildAssetTree,
  countAssetAttention,
  countAssetFacets,
  countAssetPlacements,
  countAssetScope,
  DEFAULT_ASSET_QUERY,
  getAssetAttention,
  getAssetScope,
  getCurrentAssetVersion,
  isDocumentAssetKind,
  queryAssets,
  resolveVersionSizeBytes,
  resolveVersionStats,
  type AssetAttentionKind,
  type AssetQuery,
  type AssetSiteId,
  type AssetSortKey,
  type AssetVersionStatus,
  withAssetScope,
} from '@crane/domain/asset-library';
import {
  useAssetLibraryStore,
  type ImportAssetInput,
} from '@crane/features/asset-library';
import { useAuth } from '@crane/features/auth';
import { Button } from '@crane/ui/atoms/button';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import {
  activeFilterKey,
  listActiveFilters,
  removeActiveFilter,
  type ActiveFilter,
} from '../lib/active-filters';
import {
  parseAssetQuery,
  PREVIEW_PARAM,
  writeAssetQuery,
} from '../lib/asset-library-url';
import { ASSET_CARD_GRID } from '../lib/asset-presentation';
import { isAssetSaveFailed } from '../model/use-asset-save-report';
import {
  listBulkTags,
  listBulkTransitions,
  withoutTag,
  withTag,
} from '../lib/bulk-selection';
import { copyText } from '../lib/copy-text';
import {
  findNeighbors,
  rangeBetween,
  stepFromRemembered,
  writeResultOrder,
} from '../lib/result-navigation';
import { AssetKindIcon } from './asset-badges';
import { AssetBreadcrumb } from './asset-breadcrumb';
import { AssetBulkBar } from './asset-bulk-bar';
import { AssetConfirmDialog } from './asset-confirm-dialog';
import { AssetFilterRail } from './asset-filter-rail';
import { AssetGrid } from './asset-grid';
import { AssetImportDialog } from './asset-import-dialog';
import { AssetPreviewPanel } from './asset-preview-panel';
import { AssetSaveBanner } from './asset-save-banner';
import { AssetTable } from './asset-table';

const VIEW_STORAGE_KEY = 'crane:asset-library:view';
const SEARCH_DEBOUNCE_MS = 220;
/** 상태 필터의 "전체" 선택값. */
const ANY_STATUS = 'any';

type ViewMode = 'grid' | 'list';
interface ViewPrefs {
  mode: ViewMode;
}

function readViewPrefs(): ViewPrefs {
  const stored = getStorageJson<Partial<ViewPrefs>>(VIEW_STORAGE_KEY);
  return { mode: stored?.mode === 'list' ? 'list' : 'grid' };
}

interface AssetLibraryPageProps {
  /** 이 페이지가 놓인 경로. 상세 화면은 `${basePath}/:assetId`. */
  basePath: string;
}

/**
 * 검색창. 입력은 로컬 상태로 받고 URL 에는 잠시 뒤에 쓴다 — 값을 URL 에
 * 바로 묶으면 라우터 전환이 한글 조합 중인 입력을 끊는다. 밖에서 검색어가
 * 바뀌면(필터 초기화 등) 그 값을 따라간다.
 */
function SearchBox({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  // 내가 마지막으로 URL 에 보낸 검색어. URL 반영은 전환(transition)이라 늦게
  // 돌아올 수 있다 — 돌아온 값이 내가 보낸 것이면 그사이 더 친 글자를 덮지
  // 않는다. 밖에서 바뀐 값(필터 초기화 등)만 입력란에 옮긴다.
  const [committed, setCommitted] = useState(value);
  const timerRef = useRef<number | null>(null);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value.trim() !== committed.trim()) {
      setDraft(value);
      setCommitted(value);
    }
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <div className="border-border bg-muted/40 focus-within:border-ring focus-within:bg-background focus-within:ring-ring/50 flex h-9 w-full items-center gap-2.5 rounded-lg border px-3 transition-colors focus-within:ring-3">
      <Search className="text-muted-foreground size-4 shrink-0" />
      <input
        type="search"
        value={draft}
        aria-label={t('asset-library:browser.search')}
        placeholder={t('asset-library:browser.search')}
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (timerRef.current !== null) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => {
            setCommitted(next);
            onCommit(next);
          }, SEARCH_DEBOUNCE_MS);
        }}
      />
    </div>
  );
}

export function AssetLibraryPage({ basePath }: AssetLibraryPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const actor = user?.id ?? 'unknown';
  const navigate = useProgressNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = useAssetLibraryStore((state) => state.status);
  const assets = useAssetLibraryStore((state) => state.assets);
  const collections = useAssetLibraryStore((state) => state.collections);
  const statsTable = useAssetLibraryStore((state) => state.statsTable);
  const usageIndex = useAssetLibraryStore((state) => state.usageIndex);
  const usageStatus = useAssetLibraryStore((state) => state.usageStatus);
  const favoriteIds = useAssetLibraryStore((state) => state.favorites);
  const saveState = useAssetLibraryStore((state) => state.saveState);
  const localOnly = useAssetLibraryStore((state) => state.localOnly);
  const load = useAssetLibraryStore((state) => state.load);
  const loadUsage = useAssetLibraryStore((state) => state.loadUsage);
  const updateManyMetadata = useAssetLibraryStore(
    (state) => state.updateManyMetadata,
  );
  const transitionManyStatus = useAssetLibraryStore(
    (state) => state.transitionManyStatus,
  );
  const removeManyAssets = useAssetLibraryStore(
    (state) => state.removeManyAssets,
  );
  const importAsset = useAssetLibraryStore((state) => state.importAsset);
  const toggleFavorite = useAssetLibraryStore((state) => state.toggleFavorite);
  const createCollection = useAssetLibraryStore(
    (state) => state.createCollection,
  );
  const removeCollection = useAssetLibraryStore(
    (state) => state.removeCollection,
  );
  const setCollectionMembership = useAssetLibraryStore(
    (state) => state.setCollectionMembership,
  );

  const [viewPrefs, setViewPrefs] = useState(readViewPrefs);
  // "얼마 전" 표기의 기준 — 화면에 들어온 때로 고정한다(렌더마다 바뀌지 않게).
  const [now] = useState(() => Date.now());
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [importOpen, setImportOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (usageStatus === 'idle') void loadUsage();
  }, [loadUsage, usageStatus]);

  const query = useMemo(() => parseAssetQuery(searchParams), [searchParams]);
  // 위치나 필터가 바뀌면 선택을 비운다 — 화면에서 사라진 자산이 선택된 채
  // 남으면, 보이지 않는 자산에 일괄 작업이 걸린다. 정렬만 바뀐 것은 같은 목록이다.
  const selectionScope = useMemo(
    () =>
      writeAssetQuery(new URLSearchParams(), {
        ...query,
        sort: DEFAULT_ASSET_QUERY.sort,
        reverse: false,
      }).toString(),
    [query],
  );
  const [selectedScope, setSelectedScope] = useState(selectionScope);
  if (selectedScope !== selectionScope) {
    setSelectedScope(selectionScope);
    if (selectedIds.size > 0) setSelectedIds(new Set());
  }
  const setQuery = useCallback(
    (next: AssetQuery) => {
      setSearchParams((current) => writeAssetQuery(current, next), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const tree = useMemo(() => buildAssetTree(assets), [assets]);
  const scope = getAssetScope(query);
  const placements = useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of assets) {
      const count = countAssetPlacements(asset, usageIndex);
      if (count > 0) map.set(asset.id, count);
    }
    return map;
  }, [assets, usageIndex]);
  const usageKnown = usageStatus === 'ready';

  // 처리할 일 — 자산마다 손이 가야 하는 이유. 레일의 개수, 카드의 표식,
  // 미리보기의 안내가 전부 이 판정 하나를 쓴다.
  const attentionContext = useMemo(
    () => ({ statsTable, placements, usageKnown }),
    [placements, statsTable, usageKnown],
  );
  // 지금 위치에 놓인 자산(필터 전). 레일의 처리할 일 개수와 상태 선택의
  // 개수는 이 범위로 센다 — 누르면 이 위치 안에서 걸리므로, 전체 기준으로
  // 세면 "5" 를 눌렀는데 1개가 나온다.
  const scopedAssets = useMemo(
    () =>
      queryAssets(
        assets,
        withAssetScope(DEFAULT_ASSET_QUERY, {
          site: scope.site,
          kind: scope.kind,
          category: scope.category,
        }),
        { collections: [], favorites: new Set<string>(), statsTable: {} },
      ),
    [assets, scope.category, scope.kind, scope.site],
  );
  const scopedFacets = useMemo(
    () => countAssetFacets(scopedAssets),
    [scopedAssets],
  );
  const attentionCounts = useMemo(
    () => countAssetAttention(scopedAssets, attentionContext),
    [attentionContext, scopedAssets],
  );
  const attentionByAsset = useMemo(() => {
    const map = new Map<string, AssetAttentionKind[]>();
    for (const asset of assets) {
      const reasons = getAssetAttention(asset, attentionContext);
      if (reasons.length > 0) map.set(asset.id, reasons);
    }
    return map;
  }, [assets, attentionContext]);

  const results = useMemo(
    () =>
      queryAssets(assets, query, {
        collections,
        favorites,
        statsTable,
        placements,
        usageKnown,
      }),
    [assets, collections, favorites, placements, query, statsTable, usageKnown],
  );

  // 카드 보기는 종류별로 묶는다 — 크레인 사이에 도면이 섞이면 훑기 어렵다.
  // 종류를 하나만 고른 상태면 묶을 것이 없어 제목 없이 한 덩어리다.
  const groups = useMemo(() => {
    if (query.kinds.length === 1) return [{ kind: null, assets: results }];
    return ASSET_KINDS.map((kind) => ({
      kind,
      assets: results.filter((asset) => asset.kind === kind),
    })).filter((group) => group.assets.length > 0);
  }, [query.kinds.length, results]);

  const hrefFor = useCallback(
    (assetId: string) => `${basePath}/${assetId}`,
    [basePath],
  );
  // 주소창에 붙여 넣을 수 있는 전체 주소(배포 하위 경로 포함).
  const baseHref = useHref(basePath);

  // 화면에 놓인 순서 — 카드 보기는 종류별 묶음을 이어 붙인 순서다. 미리보기의
  // 이전/다음, Shift 범위 선택, 상세의 이전/다음이 전부 이 순서를 따른다.
  const orderedIds = useMemo(
    () =>
      (viewPrefs.mode === 'grid'
        ? groups.flatMap((group) => group.assets)
        : results
      ).map((asset) => asset.id),
    [groups, results, viewPrefs.mode],
  );

  // 미리보기에 올린 자산은 URL(`?preview=`)이 단일 소스다 — 링크로 공유되고,
  // 상세에서 뒤로 오면 보던 자산이 그대로 올라와 있다.
  const previewParam = searchParams.get(PREVIEW_PARAM);
  // 결과가 아니라 전체에서 찾는다 — 검수 목록에서 승인하면 그 자산은 결과에서
  // 빠지는데, 그때 패널이 닫히면 방금 한 일의 결과도 못 보고 다음으로도 못 간다.
  const previewAsset = useMemo(
    () =>
      previewParam
        ? (assets.find((asset) => asset.id === previewParam) ?? null)
        : null,
    [assets, previewParam],
  );
  const previewId = previewAsset?.id ?? null;
  // 미리보기 자산이 결과에서 차지하던 자리. 결과에서 빠진 뒤의 이전/다음이
  // 여기서 이어 간다(이벤트 처리기에서만 읽는다).
  const previewIndexRef = useRef(0);
  const setPreview = useCallback(
    (assetId: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (assetId) next.set(PREVIEW_PARAM, assetId);
          else next.delete(PREVIEW_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const handlePreview = useCallback(
    (assetId: string, toggle: boolean) => {
      const current = new URLSearchParams(window.location.search).get(
        PREVIEW_PARAM,
      );
      setPreview(toggle && current === assetId ? null : assetId);
    },
    [setPreview],
  );
  const handleOpen = useCallback(
    (assetId: string) => navigate(hrefFor(assetId)),
    [hrefFor, navigate],
  );
  const neighbors = previewId ? findNeighbors(orderedIds, previewId) : null;
  useEffect(() => {
    if (neighbors && neighbors.position > 0) {
      previewIndexRef.current = neighbors.position - 1;
    }
  }, [neighbors]);
  const stepPreview = useCallback(
    (step: number) => {
      const next = stepFromRemembered(
        orderedIds,
        previewId,
        previewIndexRef.current,
        step,
      );
      if (next && next !== previewId) setPreview(next);
    },
    [orderedIds, previewId, setPreview],
  );

  // 상세 화면이 이전/다음 자산과 "목록으로" 에 쓸 수 있게 순서를 남긴다.
  useEffect(() => {
    if (status !== 'ready') return;
    const params = new URLSearchParams(searchParams);
    params.delete(PREVIEW_PARAM);
    const search = params.toString();
    writeResultOrder(orderedIds, search ? `?${search}` : '');
  }, [orderedIds, searchParams, status]);

  // 미리보기에 올린 자산이 목록에서 보이게 한다(방향키로 옮길 때).
  useEffect(() => {
    if (!previewId) return;
    const item = document.querySelector<HTMLElement>(
      `[data-asset-id="${CSS.escape(previewId)}"]`,
    );
    item?.scrollIntoView({ block: 'nearest' });
    // 초점이 다른 카드에 남아 있으면 따라 옮긴다 — 방향키로 넘긴 뒤 Enter 가
    // 올라와 있는 자산을 연다.
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused.closest('[data-asset-id]') &&
      !item?.contains(focused)
    ) {
      // 카드는 덮개 버튼, 목록 보기는 줄 자체가 초점을 받는다.
      (
        item?.querySelector<HTMLElement>('button[aria-pressed]') ?? item
      )?.focus({ preventScroll: true });
    }
  }, [previewId]);

  // 방향키로 미리보기를 옮기고 Esc 로 닫는다. 글자를 치는 중이거나 대화
  // 상자·메뉴가 열려 있으면 가로채지 않는다.
  useEffect(() => {
    if (!previewId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
      if (event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], canvas',
        )
      ) {
        return;
      }
      if (event.key === 'Escape') {
        setPreview(null);
        return;
      }
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (step === 0) return;
      event.preventDefault();
      stepPreview(step);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewId, setPreview, stepPreview]);

  const updateViewPrefs = (patch: Partial<ViewPrefs>) => {
    const next = { ...viewPrefs, ...patch };
    setViewPrefs(next);
    setStorageJson(VIEW_STORAGE_KEY, next);
  };

  // Shift 범위 선택의 기준점 — 마지막으로 고른 자산. 순서는 ref 로 읽어
  // 카드에 넘기는 콜백이 결과가 바뀔 때마다 새로 만들어지지 않게 한다.
  const selectAnchorRef = useRef<string | null>(null);
  const orderedIdsRef = useRef(orderedIds);
  useEffect(() => {
    orderedIdsRef.current = orderedIds;
  }, [orderedIds]);

  const toggleSelect = useCallback((assetId: string, range: boolean) => {
    const anchor = selectAnchorRef.current;
    selectAnchorRef.current = assetId;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (range && anchor && anchor !== assetId) {
        for (const id of rangeBetween(orderedIdsRef.current, anchor, assetId)) {
          next.add(id);
        }
      } else if (!next.delete(assetId)) {
        next.add(assetId);
      }
      return next;
    });
  }, []);

  const copyLink = useCallback(
    (assetId: string) => {
      const url = new URL(`${baseHref}/${assetId}`, window.location.origin);
      void copyText(url.href).then((copied) => {
        if (copied) toast.success(t('asset-library:toast.linkCopied'));
        else toast.error(t('asset-library:toast.copyFailed'));
      });
    },
    [baseHref, t],
  );

  const toggleSelectAll = () => {
    const allSelected = results.every((asset) => selectedIds.has(asset.id));
    setSelectedIds(
      allSelected ? new Set() : new Set(results.map((asset) => asset.id)),
    );
  };

  const reportSave = (ok: boolean) => {
    if (!ok) toast.error(t('asset-library:toast.saveFailed'));
  };

  // 일괄 작업의 대상과, 그 자산들에 실제로 걸리는 것들.
  const selection = useMemo(() => [...selectedIds], [selectedIds]);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedIds.has(asset.id)),
    [assets, selectedIds],
  );
  const selectionTransitions = useMemo(
    () => listBulkTransitions(selectedAssets),
    [selectedAssets],
  );
  const selectionTags = useMemo(
    () => listBulkTags(selectedAssets),
    [selectedAssets],
  );
  const selectionCategories = useMemo(
    () =>
      [
        ...new Set(assets.map((asset) => asset.category).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [assets],
  );
  const removableAssets = selectedAssets.filter(
    (asset) => asset.origin === 'user',
  );
  const removableCount = removableAssets.length;
  const removablePlaced = removableAssets.reduce(
    (sum, asset) => sum + (placements.get(asset.id) ?? 0),
    0,
  );
  const [bulkConfirm, setBulkConfirm] = useState<
    { kind: 'status'; to: AssetVersionStatus } | { kind: 'remove' } | null
  >(null);

  /** 일괄 작업의 결과(바뀐 수)를 알린다. 저장은 스토어가 한 번에 한다. */
  const runBulk = async (work: Promise<number>) => {
    const changed = await work;
    if (isAssetSaveFailed()) {
      toast.error(
        t(
          useAssetLibraryStore.getState().saveState === 'conflict'
            ? 'asset-library:toast.saveConflict'
            : 'asset-library:toast.saveFailed',
        ),
      );
    } else {
      toast.success(t('asset-library:toast.bulkApplied', { count: changed }));
    }
  };

  const handleImport = async (input: ImportAssetInput): Promise<boolean> => {
    const record = await importAsset(input, actor);
    if (!record) {
      toast.error(t('asset-library:toast.importFailed'));
      return false;
    }
    setImportOpen(false);
    setDroppedFile(null);
    if (isAssetSaveFailed()) {
      toast.error(t('asset-library:toast.saveFailed'));
    } else {
      toast.success(t('asset-library:toast.imported', { name: record.name }));
    }
    navigate(hrefFor(record.id));
    return true;
  };

  const exportCsv = () => {
    const headers = [
      'id',
      t('asset-library:field.name'),
      t('asset-library:field.kind'),
      t('asset-library:field.category'),
      t('asset-library:field.site'),
      t('asset-library:field.status'),
      t('asset-library:field.version'),
      t('asset-library:field.drawingNo'),
      t('asset-library:field.revision'),
      t('asset-library:field.file'),
      t('asset-library:field.sizeBytes'),
      t('asset-library:field.triangles'),
      t('asset-library:browser.placed'),
      t('asset-library:field.tags'),
      t('asset-library:field.updated'),
    ];
    const rows = results.map((asset) => {
      const current = getCurrentAssetVersion(asset);
      return [
        asset.id,
        asset.name,
        t(`asset-library:kind.${asset.kind}`),
        asset.category,
        asset.sites.length === 0
          ? t('asset-library:site.common')
          : asset.sites.map((site) => t(`asset-library:site.${site}`)).join(' '),
        t(`asset-library:status.${current.status}`),
        current.version,
        asset.drawingNo ?? '',
        current.revision ?? '',
        current.file.fileName,
        resolveVersionSizeBytes(current, statsTable) ?? '',
        resolveVersionStats(current, statsTable)?.triangles ?? '',
        placements.get(asset.id) ?? 0,
        asset.tags.join(' '),
        asset.updatedAt,
      ];
    });
    downloadCsv(
      `asset-library-${formatCsvTimestamp()}.csv`,
      buildCsv(headers, rows),
    );
  };

  const isFileDrag = (event: DragEvent) =>
    Array.from(event.dataTransfer.types).includes('Files');

  const defaultSites: AssetSiteId[] =
    query.site === 'all' || query.site === 'common' ? [] : [query.site];
  const activeFilters = listActiveFilters(query, collections);
  const filterLabel = (filter: ActiveFilter): string => {
    switch (filter.type) {
      case 'text':
        return `“${filter.value}”`;
      case 'attention':
        return t(`asset-library:attention.${filter.value}.label`);
      case 'kind':
        return t(`asset-library:kind.${filter.value}`);
      case 'category':
        return filter.value;
      case 'status':
        return t(`asset-library:status.${filter.value}`);
      case 'tag':
        return `#${filter.value}`;
      case 'collection':
        return filter.name;
      case 'favorites':
        return t('asset-library:rail.favorites');
    }
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={(event) => {
        if (!isFileDrag(event) || importOpen) return;
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!isFileDrag(event)) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDragOver={(event) => {
        // 등록 창이 열려 있어도 기본 동작은 막는다 — 창 밖에 떨어뜨린 파일을
        // 브라우저가 열어 화면을 떠나지 않게.
        if (isFileDrag(event)) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        if (importOpen) return;
        dragDepthRef.current = 0;
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (!file) return;
        setDroppedFile(file);
        setImportOpen(true);
      }}
    >
      {/* 머리말은 지금 있는 위치다 — 화면 이름은 그 길의 뿌리에 있다. */}
      <header className="border-border flex items-center gap-3 border-b px-5 py-3">
        <h1 className="sr-only">{t('asset-library:title')}</h1>
        <AssetBreadcrumb
          scope={scope}
          className="shrink-0"
          renderCrumb={(target, label, current) =>
            current ? (
              <span
                aria-current="page"
                className="text-foreground font-condensed truncate text-lg leading-tight font-semibold"
              >
                {label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setQuery(withAssetScope(query, target))}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 font-condensed shrink-0 cursor-pointer rounded text-lg leading-tight outline-none focus-visible:ring-2"
              >
                {label}
              </button>
            )
          }
        />
        {/* 검색은 화면 맨 위 가운데 — 어느 위치에 있든 같은 자리에서 찾는다. */}
        <div className="mx-auto w-full max-w-xl min-w-40 flex-1 px-4">
          <SearchBox
            value={query.text}
            onCommit={(text) => setQuery({ ...parseCurrentQuery(), text })}
          />
        </div>
        {saveState === 'saving' ? (
          <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Loader2 className="size-3 animate-spin" />
            {t('asset-library:save.saving')}
          </span>
        ) : null}
        <Button
          size="sm"
          disabled={status !== 'ready'}
          onClick={() => {
            setDroppedFile(null);
            setImportOpen(true);
          }}
        >
          <Plus />
          {t('asset-library:action.import')}
        </Button>
      </header>

      <AssetSaveBanner />
      {localOnly && status === 'ready' ? (
        <p className="border-border bg-muted/40 text-muted-foreground border-b px-5 py-2 text-[11px]">
          {t('asset-library:save.localOnly')}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        <AssetFilterRail
          query={query}
          tree={tree}
          attention={attentionCounts}
          collections={collections}
          favoriteCount={favoriteIds.length}
          onChange={setQuery}
          onCreateCollection={async (name) => {
            const id = await createCollection(name);
            if (!id) toast.error(t('asset-library:toast.collectionRejected'));
            return id !== null;
          }}
          onRemoveCollection={(collectionId) => {
            if (query.collectionId === collectionId) {
              setQuery({ ...query, collectionId: null });
            }
            void removeCollection(collectionId).then(reportSave);
          }}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="border-border flex flex-wrap items-center gap-2 border-b px-5 py-2">
            <div className="flex items-center gap-2">
              <Select
                value={query.statuses[0] ?? ANY_STATUS}
                onValueChange={(value) =>
                  setQuery({
                    ...query,
                    statuses:
                      value === ANY_STATUS
                        ? []
                        : [value as AssetVersionStatus],
                  })
                }
              >
                <SelectTrigger
                  aria-label={t('asset-library:rail.status')}
                  label={
                    query.statuses.length === 1
                      ? t(`asset-library:status.${query.statuses[0]}`)
                      : query.statuses.length > 1
                        ? t('asset-library:browser.statusCount', {
                            count: query.statuses.length,
                          })
                        : t('asset-library:browser.anyStatus')
                  }
                />
                <SelectPopup align="start">
                  <SelectItem value={ANY_STATUS}>
                    {t('asset-library:browser.anyStatus')}
                  </SelectItem>
                  {ASSET_VERSION_STATUSES.filter(
                    (item) =>
                      scopedFacets.statuses[item] > 0 ||
                      query.statuses.includes(item),
                  ).map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`asset-library:status.${item}`)}
                      <span className="text-muted-foreground ml-2 tabular-nums">
                        {scopedFacets.statuses[item]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>

              <Select
                value={query.sort}
                onValueChange={(value) =>
                  setQuery({ ...query, sort: value as AssetSortKey })
                }
              >
                <SelectTrigger
                  aria-label={t('asset-library:browser.sort')}
                  label={t(`asset-library:sort.${query.sort}`)}
                />
                <SelectPopup align="start">
                  {ASSET_SORT_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`asset-library:sort.${key}`)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <Button
                variant="outline"
                size="icon-sm"
                aria-pressed={query.reverse}
                aria-label={t('asset-library:browser.reverseSort')}
                title={t('asset-library:browser.reverseSort')}
                onClick={() => setQuery({ ...query, reverse: !query.reverse })}
              >
                {query.reverse ? <ArrowUp /> : <ArrowDown />}
              </Button>
            </div>
            <span className="text-muted-foreground text-[13px] tabular-nums">
              {/* 걸린 필터가 없으면 이 위치의 수, 있으면 그중 몇 개인지. */}
              {activeFilters.length > 0
                ? t('asset-library:browser.resultCount', {
                    count: results.length,
                    total: countAssetScope(tree, scope),
                  })
                : t('asset-library:browser.scopeCount', {
                    count: results.length,
                  })}
            </span>

            <div className="ml-auto flex items-center gap-2">

              <div
                role="group"
                aria-label={t('asset-library:browser.viewMode')}
                className="border-border flex h-7 items-center rounded-md border p-0.5"
              >
                {(
                  [
                    ['grid', LayoutGrid],
                    ['list', List],
                  ] as const
                ).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={viewPrefs.mode === mode}
                    aria-label={t(`asset-library:browser.view.${mode}`)}
                    title={t(`asset-library:browser.view.${mode}`)}
                    onClick={() => updateViewPrefs({ mode })}
                    className={cn(
                      'focus-visible:ring-ring/50 flex h-full w-7 cursor-pointer items-center justify-center rounded transition-colors outline-none focus-visible:ring-2',
                      viewPrefs.mode === mode
                        ? 'bg-foreground/10 text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('asset-library:action.exportCsv')}
                title={t('asset-library:action.exportCsv')}
                disabled={results.length === 0}
                onClick={exportCsv}
              >
                <Download />
              </Button>
            </div>
          </div>

          {activeFilters.length > 0 ? (
            <div className="border-border flex flex-wrap items-center gap-1.5 border-b px-5 py-2">
              <ul
                aria-label={t('asset-library:browser.activeFilters')}
                className="flex flex-wrap items-center gap-1.5"
              >
                {activeFilters.map((filter) => (
                  <li key={activeFilterKey(filter)}>
                    <button
                      type="button"
                      aria-label={t('asset-library:browser.removeFilter', {
                        name: filterLabel(filter),
                      })}
                      onClick={() =>
                        setQuery(removeActiveFilter(query, filter))
                      }
                      className="bg-foreground/8 text-foreground hover:bg-foreground/14 focus-visible:ring-ring/50 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full pr-2 pl-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2"
                    >
                      {filterLabel(filter)}
                      <X className="text-muted-foreground size-3" />
                    </button>
                  </li>
                ))}
              </ul>
              {activeFilters.length > 1 ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() =>
                    setQuery({
                      ...withAssetScope(DEFAULT_ASSET_QUERY, scope),
                      sort: query.sort,
                      reverse: query.reverse,
                    })
                  }
                >
                  {t('asset-library:browser.clearFilters')}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {selectedIds.size > 0 ? (
              <div className="mb-3">
                <AssetBulkBar
                  count={selectedIds.size}
                  collections={collections}
                  tags={selectionTags}
                  categories={selectionCategories}
                  transitions={selectionTransitions}
                  removableCount={removableCount}
                  onTransition={(to) =>
                    // 되돌리는 걸음(반려·철회)은 한 번 더 묻는다.
                    to === 'rejected' || to === 'withdrawn'
                      ? setBulkConfirm({ kind: 'status', to })
                      : void runBulk(transitionManyStatus(selection, to, actor))
                  }
                  onAssignSites={(sites) =>
                    void runBulk(
                      updateManyMetadata(selection, () => ({ sites }), actor),
                    )
                  }
                  onAssignCategory={(category) =>
                    void runBulk(
                      updateManyMetadata(selection, () => ({ category }), actor),
                    )
                  }
                  onAddTag={(tag) =>
                    void runBulk(
                      updateManyMetadata(
                        selection,
                        (asset) => {
                          const tags = withTag(asset.tags, tag);
                          return tags ? { tags } : null;
                        },
                        actor,
                      ),
                    )
                  }
                  onRemoveTag={(tag) =>
                    void runBulk(
                      updateManyMetadata(
                        selection,
                        (asset) => {
                          const tags = withoutTag(asset.tags, tag);
                          return tags ? { tags } : null;
                        },
                        actor,
                      ),
                    )
                  }
                  onAddToCollection={(collectionId) =>
                    void setCollectionMembership(
                      collectionId,
                      selection,
                      true,
                    ).then((changed) => {
                      if (isAssetSaveFailed()) {
                        toast.error(t('asset-library:toast.saveFailed'));
                      } else if (changed) {
                        toast.success(
                          t('asset-library:toast.addedToCollection'),
                        );
                      }
                    })
                  }
                  onRemove={() => setBulkConfirm({ kind: 'remove' })}
                  onClear={() => setSelectedIds(new Set())}
                />
              </div>
            ) : null}

            {status === 'loading' || status === 'idle' ? (
              // 불러오는 동안 카드가 놓일 자리를 미리 잡아 둔다 — 빙글 도는
              // 표시 뒤에 화면이 통째로 바뀌지 않는다.
              <div
                role="status"
                aria-label={t('asset-library:browser.loading')}
                className={ASSET_CARD_GRID}
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <div
                    key={index}
                    className="border-border animate-pulse rounded-xl border p-1.5"
                  >
                    <div className="bg-muted aspect-[4/3] rounded-lg" />
                    <div className="bg-muted mx-1.5 mt-3 h-3.5 w-2/3 rounded" />
                    <div className="bg-muted/70 mx-1.5 mt-2 mb-2 h-3 w-1/2 rounded" />
                  </div>
                ))}
              </div>
            ) : status === 'error' ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <p className="text-foreground text-sm font-medium">
                  {t('asset-library:browser.loadFailed')}
                </p>
                <p className="text-muted-foreground max-w-sm text-xs">
                  {t('asset-library:browser.loadFailedHint')}
                </p>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  {t('asset-library:action.retry')}
                </Button>
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
                <span className="border-border text-muted-foreground flex size-12 items-center justify-center rounded-full border border-dashed">
                  {activeFilters.length === 0 && scope.kind !== null ? (
                    <AssetKindIcon kind={scope.kind} className="size-5" />
                  ) : (
                    <Search className="size-5" />
                  )}
                </span>
                <p className="text-foreground text-sm font-medium">
                  {t(
                    activeFilters.length > 0
                      ? 'asset-library:browser.empty'
                      : 'asset-library:browser.emptyScope',
                  )}
                </p>
                <p className="text-muted-foreground max-w-sm text-xs">
                  {activeFilters.length > 0
                    ? t('asset-library:browser.emptyHint')
                    : scope.kind !== null
                      ? t(`asset-library:browser.emptyScopeHint.${scope.kind}`)
                      : t('asset-library:browser.emptyHint')}
                </p>
                {activeFilters.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={status !== 'ready'}
                    onClick={() => {
                      setDroppedFile(null);
                      setImportOpen(true);
                    }}
                  >
                    <Plus />
                    {t('asset-library:action.import')}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuery({
                        ...withAssetScope(DEFAULT_ASSET_QUERY, scope),
                        sort: query.sort,
                        reverse: query.reverse,
                      })
                    }
                  >
                    {t('asset-library:browser.clearFilters')}
                  </Button>
                )}
              </div>
            ) : viewPrefs.mode === 'grid' ? (
              <div className="flex flex-col gap-8">
                {groups.map((group) => (
                  <section key={group.kind ?? 'all'}>
                    {group.kind ? (
                      <h2 className="text-foreground mb-3 flex items-baseline gap-2 text-sm font-semibold">
                        {t(`asset-library:kind.${group.kind}`)}
                        <span className="text-muted-foreground text-xs font-normal tabular-nums">
                          {group.assets.length}
                        </span>
                      </h2>
                    ) : null}
                    <AssetGrid
                      assets={group.assets}
                      statsTable={statsTable}
                      selectedIds={selectedIds}
                      favorites={favorites}
                      attention={attentionByAsset}
                      previewId={previewId}
                      showSite={scope.site === 'all'}
                      now={now}
                      hrefFor={hrefFor}
                      onPreview={handlePreview}
                      onOpen={handleOpen}
                      onToggleSelect={toggleSelect}
                      onToggleFavorite={toggleFavorite}
                      onCopyLink={copyLink}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <AssetTable
                assets={results}
                statsTable={statsTable}
                selectedIds={selectedIds}
                placements={placements}
                attention={attentionByAsset}
                previewId={previewId}
                columns={
                  scope.kind !== null && isDocumentAssetKind(scope.kind)
                    ? 'document'
                    : 'geometry'
                }
                showKind={scope.kind === null}
                hrefFor={hrefFor}
                onPreview={handlePreview}
                onOpen={handleOpen}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
              />
            )}
          </div>
        </section>

        {previewAsset && neighbors ? (
          <AssetPreviewPanel
            asset={previewAsset}
            href={hrefFor(previewAsset.id)}
            hrefFor={hrefFor}
            attention={attentionByAsset.get(previewAsset.id) ?? []}
            attentionFilter={query.attention}
            placements={placements.get(previewAsset.id) ?? 0}
            favorite={favorites.has(previewAsset.id)}
            actor={actor}
            position={neighbors.position}
            total={neighbors.total}
            onPrevious={() => stepPreview(-1)}
            onNext={() => stepPreview(1)}
            onClose={() => setPreview(null)}
            onToggleFavorite={() => toggleFavorite(previewAsset.id)}
            onSelectScope={(target) => setQuery(withAssetScope(query, target))}
            onSelectTag={(tag) => setQuery({ ...query, tags: [tag] })}
          />
        ) : null}
      </div>

      {dragging ? (
        <div className="bg-background/85 pointer-events-none absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm">
          <div className="border-foreground/40 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-12 py-10 text-center">
            <Upload className="text-foreground size-7" />
            <p className="text-foreground text-sm font-medium">
              {t('asset-library:browser.dropTitle')}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('asset-library:import.formats')}
            </p>
          </div>
        </div>
      ) : null}

      <AssetConfirmDialog
        open={bulkConfirm !== null}
        destructive={bulkConfirm?.kind === 'remove'}
        title={
          bulkConfirm?.kind === 'remove'
            ? t('asset-library:bulk.removeTitle', { count: removableCount })
            : bulkConfirm
              ? t('asset-library:bulk.statusTitle', {
                  action: t(
                    `asset-library:versions.transition.${bulkConfirm.to}`,
                  ),
                })
              : ''
        }
        description={
          bulkConfirm?.kind === 'remove'
            ? t('asset-library:bulk.removeHint')
            : bulkConfirm
              ? t(`asset-library:lifecycle.confirmHint.${bulkConfirm.to}`)
              : ''
        }
        confirmLabel={
          bulkConfirm?.kind === 'remove'
            ? t('asset-library:action.delete')
            : bulkConfirm
              ? t(`asset-library:versions.transition.${bulkConfirm.to}`)
              : ''
        }
        onConfirm={() => {
          if (!bulkConfirm) return;
          if (bulkConfirm.kind === 'remove') {
            void runBulk(
              removeManyAssets(removableAssets.map((asset) => asset.id)),
            ).then(() => setSelectedIds(new Set()));
          } else {
            void runBulk(transitionManyStatus(selection, bulkConfirm.to, actor));
          }
        }}
        onClose={() => setBulkConfirm(null)}
      >
        {bulkConfirm?.kind === 'remove' && removablePlaced > 0 ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-xs leading-relaxed"
          >
            {t('asset-library:detail.deletePlaced', { count: removablePlaced })}
          </p>
        ) : null}
      </AssetConfirmDialog>

      <AssetImportDialog
        open={importOpen}
        initialFile={droppedFile}
        assets={assets}
        statsTable={statsTable}
        defaultSites={defaultSites}
        defaultCategory={scope.category ?? ''}
        localOnly={localOnly}
        onClose={() => {
          setImportOpen(false);
          setDroppedFile(null);
        }}
        onSubmit={handleImport}
      />
    </div>
  );

  /**
   * 검색어는 입력 뒤 잠시 있다가 확정된다. 그 사이 다른 필터가 바뀌었을 수
   * 있으므로, 확정 시점의 URL 에서 탐색 상태를 다시 읽어 검색어만 얹는다.
   */
  function parseCurrentQuery(): AssetQuery {
    return parseAssetQuery(new URLSearchParams(window.location.search));
  }
}
