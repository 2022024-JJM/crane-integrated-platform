import {
  ArrowUpRight,
  Box as BoxIcon,
  ChevronLeft,
  ChevronRight,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '@crane/core/config/i18n';
import {
  evaluateAssetBudget,
  formatBytes,
  formatCount,
  formatDimensions,
  getAssetPreviewMode,
  getAssetVersion,
  getCurrentAssetVersion,
  isDocumentAssetKind,
  isGeometryAssetKind,
  resolveVersionSizeBytes,
  resolveVersionStats,
  type AssetAttentionKind,
  type AssetBudgetMetric,
  type AssetRecord,
  type AssetScope,
} from '@crane/domain/asset-library';
import {
  useAssetFileUrl,
  useAssetLibraryStore,
} from '@crane/features/asset-library';
import { getStorageItem, setStorageItem } from '@crane/core/lib/safe-storage';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Button } from '@crane/ui/atoms/button';
import { formatAssetDate } from '../lib/asset-presentation';
import {
  attentionTargetSearch,
  pickPreviewVersion,
  resolveAttentionTarget,
} from '../lib/attention-target';
import {
  PREVIEW_MODES,
  resolvePreviewStage,
  type PreviewMode,
} from '../lib/preview-stage';
import { useAssetSaveReport } from '../model/use-asset-save-report';
import { useSettled } from '../model/use-settled';
import { AssetAttentionList } from './asset-attention';
import { AssetBreadcrumb } from './asset-breadcrumb';
import { AssetEnvironmentViewer } from './asset-environment-viewer';
import { AssetLifecycle } from './asset-lifecycle';
import { AssetModelViewer } from './asset-model-viewer';
import { AssetThumbnail } from './asset-thumbnail';

/**
 * 이보다 큰 3D 파일은 미리보기에서 바로 열지 않는다. 목록을 훑는 중에 수십 MB
 * 지도가 선택할 때마다 내려오면 훑기가 멈춘다 — 썸네일을 보이고, 원할 때
 * 3D 로 연다.
 */
const AUTO_3D_MAX_BYTES = 6 * 1024 * 1024;
const PREVIEW_MODE_STORAGE_KEY = 'crane:asset-library:preview-mode';

function readPreviewMode(): PreviewMode {
  return getStorageItem(PREVIEW_MODE_STORAGE_KEY) === 'image' ? 'image' : '3d';
}
/** 자산을 올리고 이만큼 머물러야 3D 파일을 받는다 — 지나치는 자산은 받지 않는다. */
const OPEN_3D_DELAY_MS = 350;

interface AssetPreviewPanelProps {
  asset: AssetRecord;
  href: string;
  hrefFor: (assetId: string) => string;
  attention: readonly AssetAttentionKind[];
  /** 목록에 걸린 "처리할 일" 필터 — 그 일의 대상 버전을 보여 준다. */
  attentionFilter: AssetAttentionKind | null;
  placements: number;
  favorite: boolean;
  actor: string;
  /** 결과 목록에서의 위치(1 부터)와 전체 수. */
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onToggleFavorite: () => void;
  /** 경로의 마디를 누름 — 목록을 그 위치로 옮긴다. */
  onSelectScope: (scope: AssetScope) => void;
  /** 카테고리를 누름 — 그 카테고리를 가진 자산만 본다. */
  onSelectCategory: (category: string) => void;
  /**
   * 지우기를 연다. 파일을 다룰 수 있는 환경(dev)에서만 넘어온다 — 없으면
   * 버튼을 내지 않는다.
   */
  onDelete?: () => void;
}

/** 묶음 하나 — 작은 제목 아래 값들이 세 칸 격자로 놓인다. */
function FactGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border border-b px-4 py-4 last:border-b-0">
      <h3 className="text-muted-foreground mb-2.5 text-xs font-medium">
        {title}
      </h3>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3">{children}</dl>
    </section>
  );
}

/** 값 하나 — 라벨이 위, 값이 아래. `wide` 는 한 줄을 다 쓴다. */
function Fact({
  label,
  wide,
  warn,
  children,
}: {
  label: string;
  wide?: boolean;
  /** 권장 상한을 넘은 값. 색과 함께 표식(▲)으로 알린다. */
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-3')}>
      <dt className="text-muted-foreground text-[11px] leading-tight">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 truncate text-[13px] leading-tight font-medium tabular-nums',
          warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
        )}
      >
        {children}
        {warn ? <span aria-hidden> ▲</span> : null}
      </dd>
    </div>
  );
}

/**
 * 목록 옆 미리보기 — 목록을 떠나지 않고 자산을 훑는다. 무엇인지(3D·핵심
 * 수치), 지금 어떤 상태이고 무엇을 할 수 있는지(수명주기)를 보이고, 고치거나
 * 깊이 볼 일은 상세로 넘긴다.
 */
export function AssetPreviewPanel({
  asset,
  href,
  hrefFor,
  attention,
  attentionFilter,
  placements,
  favorite,
  actor,
  position,
  total,
  onPrevious,
  onNext,
  onClose,
  onToggleFavorite,
  onSelectScope,
  onSelectCategory,
  onDelete,
}: AssetPreviewPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const statsTable = useAssetLibraryStore((state) => state.statsTable);
  const usageStatus = useAssetLibraryStore((state) => state.usageStatus);
  const setCurrentVersion = useAssetLibraryStore(
    (state) => state.setCurrentVersion,
  );
  const report = useAssetSaveReport();
  const allAssets = useAssetLibraryStore((state) => state.assets);

  // 보여 줄 버전은 "지금 손이 가야 하는 버전" 이다 — 검토 대기 목록에서 열면
  // 검토할 버전이, 그렇지 않으면 현재 버전이 올라온다.
  // 한 자산을 보는 동안에는 버전을 바꿔치지 않는다 — 검토 중이던 버전을
  // 승인하면 그 자산은 "검토 대기" 가 아니게 되는데, 그때 현재 버전으로 넘어가
  // 버리면 이어서 게시할 수가 없다. 자산이 바뀔 때만 다시 고른다.
  const current = getCurrentAssetVersion(asset);
  const [pinned, setPinned] = useState(() => ({
    assetId: asset.id,
    version: pickPreviewVersion(asset, attentionFilter),
  }));
  if (pinned.assetId !== asset.id) {
    setPinned({
      assetId: asset.id,
      version: pickPreviewVersion(asset, attentionFilter),
    });
  }
  const version =
    (pinned.assetId === asset.id
      ? getAssetVersion(asset, pinned.version)
      : null) ?? current;
  const pendingVersion = version.version !== asset.currentVersion;
  const canBeCurrent =
    pendingVersion &&
    version.status !== 'withdrawn' &&
    version.status !== 'rejected';
  const file = useAssetFileUrl(version.file.ref);
  const mode = getAssetPreviewMode(version.file.format);
  const sizeBytes = resolveVersionSizeBytes(version, statsTable);
  const stats = resolveVersionStats(version, statsTable);
  const meters = stats?.size ?? null;
  const document = isDocumentAssetKind(asset.kind);
  const overBudget = new Set<AssetBudgetMetric>(
    stats ? evaluateAssetBudget(asset.kind, stats).map((w) => w.metric) : [],
  );
  const related = asset.relatedAssetIds
    .map((id) => allAssets.find((item) => item.id === id))
    .filter((item): item is AssetRecord => item !== undefined);

  // 큰 파일을 3D 로 열겠다고 고른 자산. 다른 자산으로 넘어가면 다시 묻는다.
  const [opened3dFor, setOpened3dFor] = useState<string | null>(null);
  // 이미지로 볼지 3D 로 볼지 — 브라우저마다 기억한다. 이미지로 두면 자산을
  // 넘길 때 파일을 받지 않는다.
  const [previewMode, setPreviewMode] = useState(readPreviewMode);
  const small = sizeBytes !== null && sizeBytes <= AUTO_3D_MAX_BYTES;
  const settled = useSettled(asset.id, OPEN_3D_DELAY_MS);
  const wants3d = small || opened3dFor === asset.id;
  // 돌려 볼 수 있는 자산 — 모델·지도(GLB)와 배경(파노라마).
  const interactive = mode === 'model' || mode === 'environment';
  const stage = resolvePreviewStage({
    previewMode,
    interactive,
    fileStatus: file.status,
    wants3d,
    settled,
  });
  // 뷰어는 열기로 정해지면 바로 올리고, 파일 주소는 받아도 될 때 넘긴다.
  const viewerUrl = stage === 'viewer' ? file.url : null;

  return (
    <aside
      aria-label={t('asset-library:preview.label', { name: asset.name })}
      // 패널이 열릴 때만 옆에서 들어온다(자산을 넘길 때는 움직이지 않는다).
      className="border-border bg-sidebar animate-in fade-in slide-in-from-right-3 flex w-[26rem] max-w-full shrink-0 flex-col border-l duration-200 motion-reduce:animate-none max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-2xl"
    >
      <header className="border-border flex items-center gap-1 border-b py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-foreground font-condensed truncate text-lg leading-tight font-semibold">
              {asset.name}
            </h2>
            <span className="border-border text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium tabular-nums">
              v{version.version}
            </span>
            {pendingVersion ? (
              <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                {t('asset-library:preview.currentIs', {
                  version: asset.currentVersion,
                })}
              </span>
            ) : null}
          </div>
          {/* 이 자산이 계층에서 놓인 자리. 마디를 누르면 목록이 그리로 간다. */}
          <AssetBreadcrumb
            hideRoot
            className="mt-0.5"
            scope={{ kind: asset.kind }}
            renderCrumb={(target, label) => (
              <button
                type="button"
                onClick={() => onSelectScope(target)}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 min-w-0 cursor-pointer truncate rounded text-xs whitespace-nowrap outline-none hover:underline focus-visible:ring-2"
              >
                {label}
              </button>
            )}
          />
        </div>
        <span
          className="text-muted-foreground px-1 text-xs tabular-nums"
          title={
            position === 0 ? t('asset-library:preview.outOfList') : undefined
          }
        >
          {position === 0 ? '–' : position} / {total}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('asset-library:preview.previous')}
          title={t('asset-library:preview.previousHint')}
          disabled={total === 0 || position === 1}
          onClick={onPrevious}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('asset-library:preview.next')}
          title={t('asset-library:preview.nextHint')}
          disabled={total === 0 || (position > 0 && position >= total)}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('asset-library:preview.close')}
          title={t('asset-library:preview.closeHint')}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-border relative aspect-[16/10] w-full border-b">
          {stage === 'opening' || stage === 'viewer' ? (
            // 자산마다 새로 마운트한다 — 앞 자산의 카메라가 남지 않게.
            // 표시 상태는 탭이 기억해 둔 값으로 다시 시작한다.
            mode === 'environment' ? (
              <AssetEnvironmentViewer
                key={`${asset.id}@${version.version}`}
                url={viewerUrl}
              />
            ) : (
              <AssetModelViewer
                key={`${asset.id}@${version.version}`}
                url={viewerUrl}
                toolbar="compact"
              />
            )
          ) : (
            <>
              <AssetThumbnail asset={asset} className="absolute inset-0" />
              {stage === 'ask' ? (
                <div className="absolute inset-x-0 bottom-3 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shadow-sm"
                    onClick={() => setOpened3dFor(asset.id)}
                  >
                    <BoxIcon />
                    {t('asset-library:preview.open3d', {
                      size: formatBytes(sizeBytes),
                    })}
                  </Button>
                </div>
              ) : null}
            </>
          )}
          {/* 이미지 ↔ 3D — Unity Asset Manager 의 미리보기 띠처럼 그림 아래쪽에
              둔다. 돌려 볼 수 있는 자산에만 있다. */}
          {interactive ? (
            <div
              role="group"
              aria-label={t('asset-library:preview.modeLabel')}
              className="absolute bottom-3 left-3 z-10 flex h-8 items-center gap-0.5 rounded-lg bg-black/50 p-1 shadow-sm backdrop-blur-md"
            >
              {PREVIEW_MODES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={previewMode === item}
                  onClick={() => {
                    setPreviewMode(item);
                    setStorageItem(PREVIEW_MODE_STORAGE_KEY, item);
                  }}
                  className={cn(
                    'h-6 cursor-pointer rounded-md px-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                    previewMode === item
                      ? 'bg-white text-zinc-900'
                      : 'text-white/75 hover:bg-white/15 hover:text-white',
                  )}
                >
                  {t(
                    item === 'image'
                      ? 'asset-library:preview.modeImage'
                      : 'asset-library:preview.mode3d',
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {attention.length > 0 ? (
          <section className="border-border border-b px-4 py-2.5">
            <AssetAttentionList
              kinds={attention}
              hrefFor={(kind) =>
                href +
                attentionTargetSearch(
                  asset,
                  resolveAttentionTarget(asset, kind),
                )
              }
            />
          </section>
        ) : null}

        <section className="border-border border-b px-4 py-4">
          <AssetLifecycle
            asset={asset}
            version={version}
            actor={actor}
            compact
            aside={
              canBeCurrent ? (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    report(setCurrentVersion(asset.id, version.version, actor))
                  }
                >
                  {t('asset-library:versions.makeCurrent')}
                </Button>
              ) : null
            }
          />
        </section>

        <FactGroup title={t('asset-library:preview.group.file')}>
          <Fact label={t('asset-library:field.format')}>
            {version.file.format.toUpperCase()}
          </Fact>
          <Fact label={t('asset-library:field.size')}>
            {formatBytes(sizeBytes)}
          </Fact>
          <Fact label={t('asset-library:field.version')}>
            v{version.version}
            {asset.versions.length > 1 ? (
              <span className="text-muted-foreground font-normal">
                {' '}
                / {asset.versions.length}
              </span>
            ) : null}
          </Fact>
          <Fact label={t('asset-library:field.owner')}>
            {asset.owner || '—'}
          </Fact>
          <Fact label={t('asset-library:field.updated')}>
            {formatAssetDate(asset.updatedAt, locale)}
          </Fact>
          {isGeometryAssetKind(asset.kind) && usageStatus === 'ready' ? (
            <Fact label={t('asset-library:preview.placements')}>
              {placements > 0
                ? t('asset-library:usage.count', { count: placements })
                : t('asset-library:preview.notPlaced')}
            </Fact>
          ) : null}
          <Fact label={t('asset-library:field.fileName')} wide>
            <span title={version.file.fileName}>{version.file.fileName}</span>
          </Fact>
        </FactGroup>

        {document ? (
          <FactGroup title={t('asset-library:preview.group.document')}>
            <Fact label={t('asset-library:field.drawingNo')}>
              {asset.drawingNo || '—'}
            </Fact>
            <Fact label={t('asset-library:field.revision')}>
              {version.revision || '—'}
            </Fact>
            <Fact label={t('asset-library:preview.relatedCount')}>
              {related.length}
            </Fact>
            {related.length > 0 ? (
              <div className="col-span-3 flex flex-wrap gap-1.5">
                {related.map((item) => (
                  <AppLink
                    key={item.id}
                    to={hrefFor(item.id)}
                    className="border-border text-foreground/85 hover:bg-muted focus-visible:ring-ring/50 rounded-md border px-2 py-1 text-xs leading-none outline-none focus-visible:ring-2"
                  >
                    {item.name}
                  </AppLink>
                ))}
              </div>
            ) : null}
          </FactGroup>
        ) : stats ? (
          <FactGroup title={t('asset-library:preview.group.geometry')}>
            <Fact
              label={t('asset-library:field.triangles')}
              warn={overBudget.has('triangles')}
            >
              {formatCount(stats.triangles)}
            </Fact>
            <Fact label={t('asset-library:compare.metricName.vertices')}>
              {formatCount(stats.vertices)}
            </Fact>
            <Fact label={t('asset-library:compare.metricName.meshes')}>
              {formatCount(stats.meshes)}
            </Fact>
            <Fact label={t('asset-library:compare.metricName.materials')}>
              {formatCount(stats.materials)}
            </Fact>
            <Fact label={t('asset-library:compare.metricName.textures')}>
              {formatCount(stats.textures)}
            </Fact>
            <Fact
              label={t('asset-library:compare.metricName.drawCalls')}
              warn={overBudget.has('drawCalls')}
            >
              {formatCount(stats.drawCalls)}
            </Fact>
            <Fact
              label={t('asset-library:compare.metricName.textureMemoryBytes')}
              warn={overBudget.has('textureMemory')}
            >
              {formatBytes(stats.textureMemoryBytes)}
            </Fact>
            <Fact label={t('asset-library:preview.lodLevels')}>
              {stats.lodLevels}
            </Fact>
            <Fact label={t('asset-library:preview.animations')}>
              {stats.animations}
            </Fact>
            {meters ? (
              <Fact label={t('asset-library:titleBlock.size')} wide>
                {formatDimensions(meters)}
              </Fact>
            ) : null}
          </FactGroup>
        ) : null}

        {asset.categories.length > 0 || asset.description ? (
          <section className="px-4 py-4">
            {asset.description ? (
              <p className="text-foreground/85 text-[13px] leading-relaxed">
                {asset.description}
              </p>
            ) : null}
            {asset.categories.length > 0 ? (
              <ul
                className={cn(
                  'flex flex-wrap gap-1.5',
                  asset.description && 'mt-3',
                )}
              >
                {asset.categories.map((category) => (
                  <li key={category}>
                    <button
                      type="button"
                      aria-label={t('asset-library:preview.filterByCategory', {
                        category,
                      })}
                      onClick={() => onSelectCategory(category)}
                      className="border-border text-foreground/80 hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 cursor-pointer rounded-full border px-2.5 py-1 text-xs leading-none outline-none focus-visible:ring-2"
                    >
                      {category}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer className="border-border flex items-center gap-2 border-t px-4 py-3">
        <Button
          size="sm"
          className="flex-1"
          nativeButton={false}
          // 보고 있던 버전 그대로 상세로 간다.
          render={
            <AppLink
              to={pendingVersion ? `${href}?v=${version.version}` : href}
            />
          }
        >
          {t('asset-library:preview.openDetail')}
          <ArrowUpRight />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-pressed={favorite}
          aria-label={t(
            favorite
              ? 'asset-library:browser.unfavorite'
              : 'asset-library:browser.favorite',
            { name: asset.name },
          )}
          onClick={onToggleFavorite}
        >
          <Star
            className={cn(favorite && 'fill-current text-(--hanwha-orange-100)')}
          />
        </Button>
        {onDelete ? (
          <Button
            variant="outline"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={t('asset-library:preview.delete', { name: asset.name })}
            title={t('asset-library:action.delete')}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        ) : null}
      </footer>
    </aside>
  );
}
