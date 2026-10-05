import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  FileX,
  Loader2,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useProgressNavigate } from '@crane/core/lib/use-progress-navigate';
import { cn } from '@crane/core/lib/utils';
import {
  countAssetPlacements,
  DEFAULT_ASSET_QUERY,
  formatBytes,
  formatCount,
  formatDimensions,
  getAssetAttention,
  getAssetPreviewMode,
  getAssetRemoveBlock,
  getAssetVersion,
  getCurrentAssetVersion,
  resolveVersionSizeBytes,
  resolveVersionStats,
  withAssetScope,
  type AssetRecord,
  type AssetScope,
  type AssetStats,
} from '@crane/domain/asset-library';
import {
  toAssetUsageState,
  useAssetFileUrl,
  useAssetLibraryStore,
} from '@crane/features/asset-library';
import { useAuth } from '@crane/features/auth';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Button } from '@crane/ui/atoms/button';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';
import {
  COMPARE_PARAM,
  listDetailTabs,
  resolveDetailTab,
  writeAssetQuery,
  parseVersionParam,
  PREVIEW_PARAM,
  type DetailTab,
} from '../lib/asset-library-url';
import { resolveThumbnailSource } from '../lib/asset-presentation';
import {
  attentionTargetSearch,
  resolveAttentionTarget,
} from '../lib/attention-target';
import {
  findNeighbors,
  readResultOrder,
  type StoredResultOrder,
} from '../lib/result-navigation';
import {
  pickDefaultCompareVersion,
  resolveCompareVersion,
} from '../lib/version-compare';
import {
  isAssetSaveFailed,
  useAssetSaveReport,
} from '../model/use-asset-save-report';
import { AssetActivityTab } from './asset-activity-tab';
import { AssetPlacementTab } from './asset-placement-tab';
import { AssetAttentionList } from './asset-attention';
import { AssetKindIcon, AssetStatusBadge } from './asset-badges';
import { AssetBreadcrumb } from './asset-breadcrumb';
import { AssetCompareView } from './asset-compare-view';
import { AssetDrawingViewer } from './asset-drawing-viewer';
import { AssetEnvironmentViewer } from './asset-environment-viewer';
import { AssetInfoTab } from './asset-info-tab';
import { AssetLifecycle } from './asset-lifecycle';
import { AssetSaveBanner } from './asset-save-banner';
import {
  AssetModelViewer,
  type AssetViewerHandle,
  type AssetViewerLoaded,
} from './asset-model-viewer';
import { AssetStatsTab } from './asset-stats-tab';
import { AssetUsageTab } from './asset-usage-tab';
import { AssetVersionsTab } from './asset-versions-tab';

interface AssetDetailPageProps {
  /** 라이브러리 목록 경로. 이 페이지는 `${basePath}/:assetId` 에 놓인다. */
  basePath: string;
}

export function AssetDetailPage({ basePath }: AssetDetailPageProps) {
  const { t } = useTranslation();
  const { assetId = '' } = useParams<{ assetId: string }>();
  const status = useAssetLibraryStore((state) => state.status);
  const asset = useAssetLibraryStore((state) =>
    state.assets.find((item) => item.id === assetId),
  );
  const usageStatus = useAssetLibraryStore((state) => state.usageStatus);
  const load = useAssetLibraryStore((state) => state.load);
  const loadUsage = useAssetLibraryStore((state) => state.loadUsage);
  // 목록이 남긴 결과 순서 — 이 화면에 들어올 때 한 번 읽는다.
  const [resultOrder] = useState(readResultOrder);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (usageStatus === 'idle') void loadUsage();
  }, [loadUsage, usageStatus]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        {t('asset-library:browser.loading')}
      </div>
    );
  }
  if (status === 'error' || !asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-foreground text-sm font-medium">
          {t(
            status === 'error'
              ? 'asset-library:browser.loadFailed'
              : 'asset-library:detail.notFound',
          )}
        </p>
        <p className="text-muted-foreground max-w-sm text-xs">
          {t(
            status === 'error'
              ? 'asset-library:browser.loadFailedHint'
              : 'asset-library:detail.notFoundHint',
          )}
        </p>
        {status === 'error' ? (
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t('asset-library:action.retry')}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<AppLink to={basePath} />}
          >
            {t('asset-library:detail.backToLibrary')}
          </Button>
        )}
      </div>
    );
  }

  // 자산이 바뀌면 화면 상태(측정값·썸네일 시도 여부)를 새로 시작한다.
  return (
    <AssetDetailView
      key={asset.id}
      asset={asset}
      basePath={basePath}
      resultOrder={resultOrder}
    />
  );
}

function AssetDetailView({
  asset,
  basePath,
  resultOrder,
}: {
  asset: AssetRecord;
  basePath: string;
  resultOrder: StoredResultOrder;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const actor = user?.id ?? 'unknown';
  const navigate = useProgressNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerRef = useRef<AssetViewerHandle | null>(null);
  const autoThumbnailTriedRef = useRef(false);

  const report = useAssetSaveReport();
  const statsTable = useAssetLibraryStore((state) => state.statsTable);
  const usageIndex = useAssetLibraryStore((state) => state.usageIndex);
  const usageStatus = useAssetLibraryStore((state) => state.usageStatus);
  const usageFailedScenes = useAssetLibraryStore(
    (state) => state.usageFailedScenes,
  );
  const loadUsage = useAssetLibraryStore((state) => state.loadUsage);
  const canManageFiles = useAssetLibraryStore((state) => state.canManageFiles);
  const setCurrentVersion = useAssetLibraryStore(
    (state) => state.setCurrentVersion,
  );
  const favorite = useAssetLibraryStore((state) =>
    state.favorites.includes(asset.id),
  );
  const toggleFavorite = useAssetLibraryStore((state) => state.toggleFavorite);
  const recordVersionStats = useAssetLibraryStore(
    (state) => state.recordVersionStats,
  );
  const saveThumbnail = useAssetLibraryStore((state) => state.saveThumbnail);
  const removeAsset = useAssetLibraryStore((state) => state.removeAsset);

  const [liveStats, setLiveStats] = useState<{
    version: number;
    stats: AssetStats;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 배치 속성은 씬에 쓰는 종류(모델·지도·배경)에만 있다 — 다른 종류에서 그
  // 탭을 가리키는 링크는 정보 탭으로 떨어진다.
  const tabs = listDetailTabs(asset.kind);
  const tab = resolveDetailTab(searchParams.get('tab'), asset.kind);
  const requested = parseVersionParam(searchParams.get('v'));
  // 없는 버전 번호가 URL 에 있으면 현재 버전을 본다.
  const version =
    (requested !== null ? getAssetVersion(asset, requested) : null) ??
    getCurrentAssetVersion(asset);
  const isCurrentVersion = version.version === asset.currentVersion;
  const canBeCurrent =
    !isCurrentVersion &&
    version.status !== 'withdrawn' &&
    version.status !== 'rejected';

  // 나란히 비교 — 기준 버전은 URL(`?compare=`)이 단일 소스다.
  const compareNumber = resolveCompareVersion(
    parseVersionParam(searchParams.get(COMPARE_PARAM)),
    version.version,
    asset.versions,
  );
  const compareOther =
    compareNumber !== null ? getAssetVersion(asset, compareNumber) : null;
  const defaultCompare = pickDefaultCompareVersion(
    version.version,
    asset.versions,
  );

  // 목록에서 보던 순서의 앞뒤 자산. 목록을 거치지 않고 들어왔으면 없다.
  const neighbors = findNeighbors(resultOrder.ids, asset.id);
  const listHref = useMemo(() => {
    // 목록으로 돌아가면 보던 필터 그대로, 이 자산이 미리보기에 올라와 있다.
    const params = new URLSearchParams(resultOrder.search);
    if (neighbors.position > 0) params.set(PREVIEW_PARAM, asset.id);
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  }, [asset.id, basePath, neighbors.position, resultOrder.search]);
  // 자산을 넘길 때 보던 탭은 유지한다 — 여러 자산의 통계를 연달아 본다.
  const siblingHref = useCallback(
    (assetId: string) =>
      tab === 'info'
        ? `${basePath}/${assetId}`
        : `${basePath}/${assetId}?tab=${tab}`,
    [basePath, tab],
  );

  const scopeHref = useCallback(
    (target: AssetScope) => {
      const search = writeAssetQuery(
        new URLSearchParams(),
        withAssetScope(DEFAULT_ASSET_QUERY, target),
      ).toString();
      return search ? `${basePath}?${search}` : basePath;
    },
    [basePath],
  );

  const placementCount = useMemo(
    () => countAssetPlacements(asset, usageIndex),
    [asset, usageIndex],
  );
  // 쓰이고 있거나 사용처를 다 읽지 못했으면 지울 수 없다 — 대화 상자가 이유를
  // 적는다. 지우는 순간 스토어가 사용처를 다시 읽어 한 번 더 확인한다.
  const removeBlock = useMemo(
    () =>
      getAssetRemoveBlock(
        asset,
        toAssetUsageState({ usageIndex, usageStatus, usageFailedScenes }),
      ),
    [asset, usageFailedScenes, usageIndex, usageStatus],
  );
  const attention = useMemo(() => {
    const placements = new Map<string, number>();
    const count = placementCount;
    if (count > 0) placements.set(asset.id, count);
    return (
      getAssetAttention(asset, {
        statsTable,
        placements,
        usageKnown: usageStatus === 'ready',
      })
        // 이미 그 일을 처리하는 자리(버전·탭)에 와 있으면 안내하지 않는다.
        .filter((kind) => {
          const target = resolveAttentionTarget(asset, kind);
          return (
            target.tab !== tab ||
            (target.version ?? asset.currentVersion) !== version.version
          );
        })
    );
  }, [asset, placementCount, statsTable, tab, usageStatus, version.version]);

  const file = useAssetFileUrl(version.file.ref);
  const previewMode = getAssetPreviewMode(version.file.format);
  const storedStats = resolveVersionStats(version, statsTable);
  const measured =
    liveStats?.version === version.version ? liveStats.stats : null;
  // 저장된 값이 있으면 그것을 쓴다. 배포 파일의 표(스크립트 측정)와 브라우저
  // 측정은 노드 수를 세는 기준이 달라(glTF 노드 vs three 객체) 섞어 보이면
  // 목록과 상세의 숫자가 어긋난다. 브라우저 측정은 표에 없는 파일(이 화면에서
  // 올린 것)을 채우는 데 쓴다.
  const stats = storedStats ?? measured;

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === null) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const hrefFor = useCallback(
    (assetId: string) => `${basePath}/${assetId}`,
    [basePath],
  );

  const needsThumbnail = resolveThumbnailSource(asset).kind === 'none';

  const setCompare = useCallback(
    (next: number | null) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === null) {
            params.delete(COMPARE_PARAM);
          } else {
            params.set(COMPARE_PARAM, String(next));
            // 차이 표가 있는 버전 탭을 함께 연다.
            params.set('tab', 'versions');
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // 비교 화면의 뷰어가 잰 값 — 표에 없는 버전이면 채워 둔다(차이 표가 쓴다).
  const handleCompareMeasured = useCallback(
    (measuredVersion: number, next: AssetStats) => {
      const target = getAssetVersion(asset, measuredVersion);
      if (target && !resolveVersionStats(target, statsTable)) {
        void recordVersionStats(asset.id, measuredVersion, next);
      }
    },
    [asset, recordVersionStats, statsTable],
  );

  // ←/→ 로 목록 순서의 앞뒤 자산으로 넘어간다. 글자를 치는 중이거나 뷰어·
  // 대화 상자에 초점이 있으면 가로채지 않는다.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
      if (event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"], [role="tablist"], canvas',
        )
      ) {
        return;
      }
      const next =
        event.key === 'ArrowRight'
          ? neighbors.nextId
          : event.key === 'ArrowLeft'
            ? neighbors.previousId
            : null;
      if (!next) return;
      event.preventDefault();
      // 넘겨 본 자산마다 뒤로 가기 기록이 쌓이지 않게 자리를 바꿔 넣는다.
      navigate(siblingHref(next), { replace: true });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, neighbors.nextId, neighbors.previousId, siblingHref]);

  const handleLoaded = useCallback(
    ({ stats: next }: AssetViewerLoaded) => {
      setLiveStats({ version: version.version, stats: next });
      // 배포 통계 표에도 저장본에도 없는 버전이면 방금 잰 값을 채워 둔다 —
      // 다음부터 목록이 파일을 열지 않고도 크기·삼각형을 보인다.
      if (!storedStats) {
        void recordVersionStats(asset.id, version.version, next);
      }
    },
    [asset.id, recordVersionStats, storedStats, version.version],
  );

  // 썸네일이 없는 자산은 처음 열렸을 때 한 번 찍어 둔다. 뷰어가 카메라를 맞춘
  // 뒤에 부르므로 모델 전체가 담긴다(배경은 처음 보이는 시점이 담긴다).
  const handleReady = useCallback(() => {
    if (!needsThumbnail || !isCurrentVersion) return;
    if (autoThumbnailTriedRef.current) return;
    autoThumbnailTriedRef.current = true;
    void viewerRef.current?.captureThumbnail().then((blob) => {
      // 자동 생성은 이력에 남기지 않는다(행위자 null).
      if (blob) void saveThumbnail(asset.id, blob, null);
    });
  }, [asset.id, isCurrentVersion, needsThumbnail, saveThumbnail]);

  const handleSaveThumbnail = async () => {
    const blob = await viewerRef.current?.captureThumbnail();
    if (!blob) {
      toast.error(t('asset-library:toast.thumbnailFailed'));
      return;
    }
    const ok = await saveThumbnail(asset.id, blob, actor);
    if (ok) toast.success(t('asset-library:toast.thumbnailSaved'));
    else toast.error(t('asset-library:toast.thumbnailFailed'));
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await removeAsset(asset.id);
    if (ok) {
      toast.success(t('asset-library:toast.deleted', { name: asset.name }));
      navigate(listHref);
      return;
    }
    setDeleting(false);
    setDeleteOpen(false);
    // 저장은 됐는데 지워지지 않았다면 그사이 어디선가 쓰이기 시작한 것이다.
    toast.error(
      t(
        isAssetSaveFailed()
          ? 'asset-library:toast.saveFailed'
          : 'asset-library:protect.removeBlocked',
      ),
    );
  };

  const meters = stats?.size ?? null;
  const titleBlock = (
    <dl className="border-border bg-background divide-border flex shrink-0 divide-x border-t">
      {/* 이름과 상태는 머리말·진행 단계가 말한다 — 표제란은 지금 뷰어에
          올라온 파일이 무엇인지만 적는다. */}
      <TitleCell
        label={t('asset-library:field.fileName')}
        className="min-w-0 flex-[2]"
      >
        <span className="block truncate">{version.file.fileName}</span>
      </TitleCell>
      <TitleCell label={t('asset-library:field.version')}>
        v{version.version}
        {version.revision ? ` / ${version.revision}` : ''}
      </TitleCell>
      <TitleCell label={t('asset-library:field.size')}>
        {formatBytes(resolveVersionSizeBytes(version, statsTable))}
      </TitleCell>
      {meters ? (
        <TitleCell
          label={t('asset-library:titleBlock.size')}
          className="hidden lg:block"
        >
          {formatDimensions(meters)}
        </TitleCell>
      ) : null}
      {stats ? (
        <TitleCell
          label={t('asset-library:field.triangles')}
          className="hidden md:block"
        >
          {formatCount(stats.triangles)}
        </TitleCell>
      ) : null}
    </dl>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('asset-library:detail.backToLibrary')}
          nativeButton={false}
          render={<AppLink to={listHref} />}
        >
          <ArrowLeft />
        </Button>
        {neighbors.position > 0 && neighbors.total > 1 ? (
          <div className="border-border flex items-center gap-0.5 border-r pr-3">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('asset-library:detail.previousAsset')}
              title={t('asset-library:detail.previousAsset')}
              disabled={!neighbors.previousId}
              onClick={() =>
                neighbors.previousId &&
                navigate(siblingHref(neighbors.previousId), { replace: true })
              }
            >
              <ChevronLeft />
            </Button>
            <span className="text-muted-foreground min-w-12 text-center text-xs tabular-nums">
              {neighbors.position} / {neighbors.total}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('asset-library:detail.nextAsset')}
              title={t('asset-library:detail.nextAsset')}
              disabled={!neighbors.nextId}
              onClick={() =>
                neighbors.nextId &&
                navigate(siblingHref(neighbors.nextId), { replace: true })
              }
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-foreground font-condensed min-w-0 truncate text-xl leading-tight font-semibold">
              {asset.name}
            </h1>
            <span className="border-border text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-xs leading-none font-medium tabular-nums">
              v{version.version}
            </span>
            <AssetStatusBadge status={version.status} />
            {isCurrentVersion ? null : (
              <button
                type="button"
                onClick={() => setParam('v', null)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded text-xs underline underline-offset-2 outline-none focus-visible:ring-2"
              >
                {t('asset-library:detail.viewingOldVersion', {
                  version: version.version,
                  current: asset.currentVersion,
                })}
              </button>
            )}
          </div>
          {/* 계층에서 놓인 자리 — 마디를 누르면 목록의 그 위치로 간다. */}
          <AssetBreadcrumb
            hideRoot
            className="mt-1"
            scope={{ kind: asset.kind }}
            renderCrumb={(target, label) => (
              <AppLink
                to={scopeHref(target)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1.5 truncate rounded text-xs outline-none hover:underline focus-visible:ring-2"
              >
                {target.kind !== null ? (
                  <AssetKindIcon kind={target.kind} />
                ) : null}
                {label}
              </AppLink>
            )}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={favorite}
            aria-label={t(
              favorite
                ? 'asset-library:browser.unfavorite'
                : 'asset-library:browser.favorite',
              { name: asset.name },
            )}
            onClick={() => toggleFavorite(asset.id)}
          >
            <Star
              className={cn(
                favorite && 'fill-current text-(--hanwha-orange-100)',
              )}
            />
          </Button>
          {defaultCompare !== null ? (
            <Button
              variant={compareOther ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={compareOther !== null}
              onClick={() => setCompare(compareOther ? null : defaultCompare)}
            >
              <Columns2 />
              {t('asset-library:compare.toggle')}
            </Button>
          ) : null}
          {file.status === 'ready' ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={file.url} download={version.file.fileName} />}
            >
              <Download />
              {t('asset-library:action.download')}
            </Button>
          ) : null}
          {/* 지우기는 파일을 다룰 수 있는 환경(dev)에서만 — 운영에는 배포된
              자산뿐이고 그 파일은 지울 수 없다. */}
          {canManageFiles ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('asset-library:action.delete')}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </header>
      <AssetSaveBanner />

      {/* 좁은 화면에서는 뷰어와 인스펙터가 위아래로 놓이고 통째로 스크롤된다 —
          인스펙터가 화면 아래로 잘려 닿지 않는 일이 없게. */}
      <div className="flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
        <div className="min-h-[18rem] min-w-0 flex-1 max-lg:h-[60vh] max-lg:flex-none">
          {compareOther ? (
            <AssetCompareView
              asset={asset}
              viewed={version}
              other={compareOther}
              onChangeOther={setCompare}
              onClose={() => setCompare(null)}
              onMeasured={handleCompareMeasured}
            />
          ) : file.status === 'loading' ? (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : file.status === 'missing' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <FileX className="text-muted-foreground size-7" />
              <p className="text-foreground text-sm font-medium">
                {t('asset-library:detail.fileMissing')}
              </p>
              <p className="text-muted-foreground max-w-sm text-xs">
                {t('asset-library:detail.fileMissingHint')}
              </p>
            </div>
          ) : previewMode === 'model' ? (
            <AssetModelViewer
              url={file.url}
              titleBlock={titleBlock}
              handleRef={viewerRef}
              onLoaded={handleLoaded}
              onReady={handleReady}
              onSaveThumbnail={() => void handleSaveThumbnail()}
            />
          ) : previewMode === 'environment' ? (
            <AssetEnvironmentViewer
              url={file.url}
              titleBlock={titleBlock}
              handleRef={viewerRef}
              onReady={handleReady}
              onSaveThumbnail={() => void handleSaveThumbnail()}
            />
          ) : (
            <AssetDrawingViewer
              url={file.url}
              mode={previewMode}
              fileName={version.file.fileName}
              titleBlock={titleBlock}
            />
          )}
        </div>

        <aside className="bg-sidebar border-border flex min-h-0 w-full shrink-0 flex-col border-t lg:w-[25rem] lg:border-t-0 lg:border-l">
          {/* 지금 어디까지 왔고 다음에 무엇을 하는가 — 어느 탭에서도 보인다. */}
          <section className="border-border shrink-0 border-b px-5 py-4">
            <AssetLifecycle
              asset={asset}
              version={version}
              actor={actor}
              aside={
                canBeCurrent ? (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      report(
                        setCurrentVersion(asset.id, version.version, actor),
                      )
                    }
                  >
                    {t('asset-library:versions.makeCurrent')}
                  </Button>
                ) : isCurrentVersion ? (
                  <span className="bg-foreground/8 text-foreground/80 rounded px-1.5 py-1 text-[11px] leading-none font-medium">
                    {t('asset-library:lifecycle.currentVersion')}
                  </span>
                ) : null
              }
            />
            {attention.length > 0 ? (
              <div className="border-border mt-4 border-t pt-2">
                <AssetAttentionList
                  kinds={attention}
                  hrefFor={(kind) =>
                    `${basePath}/${asset.id}` +
                    attentionTargetSearch(
                      asset,
                      resolveAttentionTarget(asset, kind),
                    )
                  }
                />
              </div>
            ) : null}
          </section>
          <div
            role="tablist"
            aria-label={t('asset-library:detail.tabs')}
            className="border-border flex shrink-0 border-b px-3"
          >
            {tabs.map((item: DetailTab) => (
              <button
                key={item}
                type="button"
                role="tab"
                id={`asset-tab-${item}`}
                aria-selected={tab === item}
                aria-controls="asset-tab-panel"
                onClick={() => setParam('tab', item === 'info' ? null : item)}
                className={cn(
                  'focus-visible:ring-ring/50 relative h-11 cursor-pointer px-2.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset',
                  tab === item
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`asset-library:detail.tab.${item}`)}
                {item === 'versions' ? (
                  <span className="text-muted-foreground ml-1 font-normal tabular-nums">
                    {asset.versions.length}
                  </span>
                ) : null}
                {tab === item ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 bg-(--hanwha-orange-100)"
                  />
                ) : null}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="asset-tab-panel"
            aria-labelledby={`asset-tab-${tab}`}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {tab === 'info' ? (
              <AssetInfoTab
                asset={asset}
                version={version}
                actor={actor}
                hrefFor={hrefFor}
              />
            ) : tab === 'stats' ? (
              <AssetStatsTab
                asset={asset}
                stats={stats}
                live={storedStats === null && measured !== null}
              />
            ) : tab === 'versions' ? (
              <AssetVersionsTab
                asset={asset}
                viewedVersion={version.version}
                compareVersion={compareOther?.version ?? null}
                actor={actor}
                onCompare={setCompare}
                onView={(next) =>
                  setParam(
                    'v',
                    next === asset.currentVersion ? null : String(next),
                  )
                }
              />
            ) : tab === 'usage' ? (
              <AssetUsageTab asset={asset} />
            ) : tab === 'placement' ? (
              <AssetPlacementTab asset={asset} actor={actor} />
            ) : (
              <AssetActivityTab asset={asset} />
            )}
          </div>
        </aside>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!deleting) setDeleteOpen(next);
        }}
      >
        {removeBlock ? (
          // 쓰이는 자산은 지우지 않는다 — 왜 못 지우는지와 다음에 할 일을 적는다.
          <AlertDialogPopup>
            <AlertDialogTitle>
              {t('asset-library:protect.removeTitle', { name: asset.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(`asset-library:protect.remove.${removeBlock}`, {
                count: placementCount,
              })}
            </AlertDialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              {removeBlock === 'in-use' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteOpen(false);
                    setParam('tab', 'usage');
                  }}
                >
                  {t('asset-library:protect.openUsage')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={usageStatus === 'loading'}
                  onClick={() => void loadUsage()}
                >
                  {usageStatus === 'loading' ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {t('asset-library:action.retry')}
                </Button>
              )}
              <AlertDialogClose render={<Button size="sm" />}>
                {t('asset-library:action.close')}
              </AlertDialogClose>
            </div>
          </AlertDialogPopup>
        ) : (
          <AlertDialogPopup>
            <AlertDialogTitle>
              {t('asset-library:detail.deleteTitle', { name: asset.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('asset-library:detail.deleteDescription', {
                count: asset.versions.length,
              })}
            </AlertDialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialogClose
                render={
                  <Button variant="outline" size="sm" disabled={deleting} />
                }
              >
                {t('asset-library:action.cancel')}
              </AlertDialogClose>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {t('asset-library:action.delete')}
              </Button>
            </div>
          </AlertDialogPopup>
        )}
      </AlertDialog>
    </div>
  );
}

function TitleCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('px-4 py-2', className)}>
      <dt className="text-muted-foreground text-[11px] leading-tight">
        {label}
      </dt>
      <dd className="text-foreground font-condensed mt-0.5 text-[15px] leading-tight font-semibold whitespace-nowrap tabular-nums">
        {children}
      </dd>
    </div>
  );
}
