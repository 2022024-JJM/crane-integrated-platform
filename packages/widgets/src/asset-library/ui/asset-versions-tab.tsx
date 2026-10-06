import {
  Columns2,
  Download,
  Eye,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getFormatLocale } from '@crane/core/config/i18n';
import {
  ASSET_NOTE_MAX,
  ASSET_REVISION_MAX,
  canRemoveAssetVersion,
  diffAssetStats,
  formatBytes,
  formatCount,
  formatSignedCount,
  getAllowedAssetKinds,
  getAllowedStatusTransitions,
  isAssetVersionInUse,
  isDocumentAssetKind,
  isGeometryAssetKind,
  isSceneAssetKind,
  resolveVersionSizeBytes,
  resolveVersionStats,
  type AssetRecord,
  type AssetVersion,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';
import {
  useAssetFileUrl,
  useAssetLibraryStore,
} from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import {
  analyzeAssetFile,
  getAssetFileProblemMessage,
} from '../lib/analyze-asset-file';
import { summarizeFileReport } from '../lib/file-report';
import { formatAssetDateTime } from '../lib/asset-presentation';
import {
  compareVersions,
  dropUnknownRows,
  type VersionCompareSide,
} from '../lib/version-compare';
import {
  isAssetSaveFailed,
  useAssetSaveReport,
} from '../model/use-asset-save-report';
import { AssetStatusBadge } from './asset-badges';
import { AssetConfirmDialog } from './asset-confirm-dialog';
import { AssetOptimizeOption } from './asset-optimize-option';
import { CommitInput } from './asset-form-fields';
import { AssetVersionDiff } from './asset-version-diff';

interface AssetVersionsTabProps {
  asset: AssetRecord;
  /** 지금 뷰어에 올라와 있는 버전 번호. */
  viewedVersion: number;
  /** 보고 있는 버전과 나란히 비교 중인 다른 버전 번호. 없으면 null. */
  compareVersion: number | null;
  actor: string;
  onView: (version: number) => void;
  /** 이 버전을 보고 있는 버전과 비교한다. null 은 비교 끝내기. */
  onCompare: (version: number | null) => void;
}

function DownloadLink({ version }: { version: AssetVersion }) {
  const { t } = useTranslation();
  const file = useAssetFileUrl(version.file.ref);
  if (file.status !== 'ready') return null;
  return (
    <Button
      variant="ghost"
      size="xs"
      nativeButton={false}
      render={<a href={file.url} download={version.file.fileName} />}
    >
      <Download />
      {t('asset-library:action.download')}
    </Button>
  );
}

function VersionUpload({
  asset,
  actor,
  onView,
}: {
  asset: AssetRecord;
  actor: string;
  onView: (version: number) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const assets = useAssetLibraryStore((state) => state.assets);
  const statsTable = useAssetLibraryStore((state) => state.statsTable);
  const addVersion = useAssetLibraryStore((state) => state.addVersion);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [revision, setRevision] = useState('');
  const canManageFiles = useAssetLibraryStore((state) => state.canManageFiles);
  const canOptimize = useAssetLibraryStore((state) => state.canOptimize);
  const [optimize, setOptimize] = useState(true);
  // 모델과 지도는 종류마다 다른 파이프라인으로 최적화한다 — 옵션은 하나다.
  const offerOptimize = canOptimize && isGeometryAssetKind(asset.kind);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setNote('');
    setRevision('');
    setProblem(null);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setProblem(null);
    const analysis = await analyzeAssetFile(file, assets, statsTable);
    // 모델·지도 자산에 도면을(또는 그 반대를) 버전으로 붙일 수 없다.
    if (!getAllowedAssetKinds(file.name).includes(asset.kind)) {
      setProblem(t('asset-library:versions.kindMismatch'));
      setBusy(false);
      return;
    }
    if (analysis.problem) {
      const message = getAssetFileProblemMessage(analysis.problem);
      setProblem(t(message.key, message.values));
      setBusy(false);
      return;
    }
    if (analysis.duplicates.some((item) => item.assetId === asset.id)) {
      setProblem(t('asset-library:versions.sameContent'));
      setBusy(false);
      return;
    }
    const added = await addVersion(
      asset.id,
      {
        file,
        note: note.trim(),
        contentHash: analysis.contentHash,
        optimize: offerOptimize && optimize,
        ...(isDocumentAssetKind(asset.kind) && revision.trim()
          ? { revision: revision.trim() }
          : {}),
      },
      actor,
    );
    setBusy(false);
    if (added === null) {
      toast.error(t('asset-library:toast.importFailed'));
      return;
    }
    if (isAssetSaveFailed()) {
      toast.error(t('asset-library:toast.saveFailed'));
    } else {
      const summary = summarizeFileReport(
        useAssetLibraryStore.getState().fileReport,
      );
      toast.success(t('asset-library:toast.versionAdded', { version: added }), {
        description: summary
          ? [t(`asset-library:optimize.${summary.outcome}`), ...summary.lines]
              .join(' · ')
          : undefined,
      });
    }
    reset();
    onView(added);
  };

  // 파일을 올릴 수 없는 환경(운영)에서는 올리는 자리를 내지 않고 이유를 적는다.
  if (!canManageFiles) {
    return (
      <p className="text-muted-foreground border-border border-b px-5 py-4 text-xs leading-relaxed">
        {t('asset-library:versions.uploadUnavailable')}
      </p>
    );
  }

  return (
    <section className="border-border border-b px-5 py-4">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setProblem(null);
          event.target.value = '';
        }}
      />
      {file ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="text-foreground truncate text-[13px] font-medium">
            {file.name}
            <span className="text-muted-foreground ml-2 font-normal tabular-nums">
              {formatBytes(file.size)}
            </span>
          </p>
          <div className="flex gap-2">
            <Input
              value={note}
              maxLength={ASSET_NOTE_MAX}
              aria-label={t('asset-library:field.versionNote')}
              placeholder={t('asset-library:versions.notePlaceholder')}
              className="h-7 text-xs"
              onChange={(event) => setNote(event.target.value)}
            />
            {isDocumentAssetKind(asset.kind) ? (
              <Input
                value={revision}
                maxLength={ASSET_REVISION_MAX}
                aria-label={t('asset-library:field.revision')}
                placeholder={t('asset-library:field.revision')}
                className="h-7 w-20 text-xs"
                onChange={(event) => setRevision(event.target.value)}
              />
            ) : null}
          </div>
          {offerOptimize ? (
            <AssetOptimizeOption
              compact
              kind={asset.kind}
              checked={optimize}
              disabled={busy}
              onChange={setOptimize}
            />
          ) : null}
          {problem ? (
            <p role="alert" className="text-destructive text-xs">
              {problem}
            </p>
          ) : null}
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={reset}
            >
              {t('asset-library:action.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />}
              {t('asset-library:versions.upload')}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {t('asset-library:versions.newVersion')}
        </Button>
      )}
    </section>
  );
}

export function AssetVersionsTab({
  asset,
  viewedVersion,
  compareVersion,
  actor,
  onView,
  onCompare,
}: AssetVersionsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);
  const report = useAssetSaveReport();
  const statsTable = useAssetLibraryStore((state) => state.statsTable);
  const transitionStatus = useAssetLibraryStore(
    (state) => state.transitionStatus,
  );
  const setCurrentVersion = useAssetLibraryStore(
    (state) => state.setCurrentVersion,
  );
  const updateVersionNote = useAssetLibraryStore(
    (state) => state.updateVersionNote,
  );
  const removeVersion = useAssetLibraryStore((state) => state.removeVersion);
  const canManageFiles = useAssetLibraryStore((state) => state.canManageFiles);
  const usageIndex = useAssetLibraryStore((state) => state.usageIndex);
  // 쓰이고 있는 버전은 철회되지 않는다(스토어가 사용처를 다시 읽어 확인한다).
  // 저장은 됐는데 철회되지 않았으면 그 이유를 알린다.
  const changeStatus = (versionNumber: number, to: AssetVersionStatus) =>
    report(
      transitionStatus(asset.id, versionNumber, to, actor).then((changed) => {
        if (!changed && to === 'withdrawn' && !isAssetSaveFailed()) {
          toast.error(t('asset-library:protect.withdrawBlocked'));
        }
        return changed;
      }),
    );
  // 한 번 더 묻는 일 — 되돌리는 상태 전환(반려·철회)과 버전 지우기.
  const [pending, setPending] = useState<
    | { kind: 'status'; version: number; to: AssetVersionStatus }
    | { kind: 'remove'; version: number }
    | null
  >(null);

  // 최신 버전이 위.
  const versions = [...asset.versions].sort((a, b) => b.version - a.version);

  const sideOf = (version: AssetVersion): VersionCompareSide => {
    const stats = resolveVersionStats(version, statsTable);
    return {
      sizeBytes: resolveVersionSizeBytes(version, statsTable),
      stats,
      meters: stats?.size ?? null,
    };
  };
  const compared = asset.versions.find(
    (item) => item.version === compareVersion,
  );
  const viewed = asset.versions.find((item) => item.version === viewedVersion);
  // 차이는 늘 옛 버전에서 새 버전으로 읽는다.
  const [diffBase, diffTarget] =
    compared && viewed
      ? compared.version < viewed.version
        ? [compared, viewed]
        : [viewed, compared]
      : [null, null];

  return (
    <div>
      <VersionUpload asset={asset} actor={actor} onView={onView} />
      {diffBase && diffTarget ? (
        <section className="border-border border-b px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-foreground text-[13px] font-semibold">
              {t('asset-library:compare.heading', {
                base: diffBase.version,
                target: diffTarget.version,
              })}
            </h3>
            <Button variant="ghost" size="xs" onClick={() => onCompare(null)}>
              {t('asset-library:compare.close')}
            </Button>
          </div>
          <AssetVersionDiff
            baseVersion={diffBase.version}
            targetVersion={diffTarget.version}
            rows={dropUnknownRows(
              compareVersions(sideOf(diffBase), sideOf(diffTarget)),
            )}
          />
        </section>
      ) : null}
      <ol className="px-5 py-2">
        {versions.map((version, index) => {
          const previous = versions[index + 1];
          const stats = resolveVersionStats(version, statsTable);
          const delta = previous
            ? diffAssetStats(
                resolveVersionStats(previous, statsTable) ?? undefined,
                stats ?? undefined,
              )
            : null;
          const isCurrent = asset.currentVersion === version.version;
          const isViewed = viewedVersion === version.version;
          const transitions = getAllowedStatusTransitions(version.status);
          const canBeCurrent =
            !isCurrent &&
            version.status !== 'withdrawn' &&
            version.status !== 'rejected';

          return (
            // 버전은 시간 순서다 — 왼쪽 세로선에 마디를 찍어 타임라인으로 읽힌다.
            // 현재 버전은 채운 마디, 지금 뷰어에 올라온 버전은 주황 테두리.
            <li
              key={version.version}
              className="border-border relative flex flex-col gap-2 border-l py-3 pl-5 last:pb-2"
            >
              <span
                aria-hidden
                className={cn(
                  'absolute top-4 -left-[5px] size-[9px] rounded-full border-2',
                  isCurrent
                    ? 'border-foreground bg-foreground'
                    : 'border-muted-foreground/60 bg-background',
                  isViewed &&
                    'ring-background shadow-[0_0_0_2px_var(--hanwha-orange-100)] ring-2',
                )}
              />
              <div className="flex items-center gap-2">
                <span className="text-foreground font-condensed text-lg leading-none font-semibold tabular-nums">
                  v{version.version}
                </span>
                {version.revision ? (
                  <span className="border-border text-muted-foreground rounded border px-1.5 py-1 text-[11px] leading-none">
                    {t('asset-library:versions.revision', {
                      revision: version.revision,
                    })}
                  </span>
                ) : null}
                {isCurrent ? (
                  <span className="bg-foreground text-background rounded px-1.5 py-1 text-[11px] leading-none font-medium">
                    {t('asset-library:versions.current')}
                  </span>
                ) : null}
                {compareVersion === version.version ? (
                  <span className="border-border text-foreground rounded border px-1.5 py-1 text-[11px] leading-none font-medium">
                    {t('asset-library:compare.comparing')}
                  </span>
                ) : null}
                <span className="ml-auto">
                  {transitions.length > 0 ? (
                    <Select
                      value={version.status}
                      onValueChange={(value) => {
                        if (value === version.status) return;
                        const to = value as AssetVersionStatus;
                        // 쓰이는 버전의 철회는 묻기 전에 막는다.
                        if (
                          to === 'withdrawn' &&
                          isAssetVersionInUse(asset, version.version, usageIndex)
                        ) {
                          toast.error(t('asset-library:protect.withdrawInUse'));
                          return;
                        }
                        if (to === 'rejected' || to === 'withdrawn') {
                          setPending({
                            kind: 'status',
                            version: version.version,
                            to,
                          });
                          return;
                        }
                        changeStatus(version.version, to);
                      }}
                    >
                      <SelectTrigger
                        variant="ghost"
                        aria-label={t('asset-library:versions.changeStatus', {
                          version: version.version,
                        })}
                        className="h-6 px-1.5"
                      >
                        <AssetStatusBadge
                          status={version.status}
                          variant="inline"
                        />
                      </SelectTrigger>
                      <SelectPopup align="end">
                        <SelectItem value={version.status} disabled>
                          {t(`asset-library:status.${version.status}`)}
                        </SelectItem>
                        {transitions.map((next) => (
                          <SelectItem key={next} value={next}>
                            {t(`asset-library:versions.transition.${next}`)}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  ) : (
                    <AssetStatusBadge status={version.status} variant="inline" />
                  )}
                </span>
              </div>

              <CommitInput
                value={version.note}
                maxLength={ASSET_NOTE_MAX}
                placeholder={t('asset-library:versions.notePlaceholder')}
                className="bg-transparent px-0 hover:bg-muted hover:px-2 focus:px-2"
                onCommit={(note) =>
                  report(
                    updateVersionNote(asset.id, version.version, { note }, actor),
                  )
                }
              />

              <dl className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                <div>
                  <dt className="sr-only">{t('asset-library:field.size')}</dt>
                  <dd>
                    {formatBytes(resolveVersionSizeBytes(version, statsTable))}
                    {/* 최적화해 저장한 버전 — 올린 원본에서 얼마나 줄었는지. */}
                    {version.file.originalSizeBytes !== undefined ? (
                      <span
                        className="text-muted-foreground/80 ml-1.5"
                        title={t('asset-library:optimize.stored')}
                      >
                        {t('asset-library:optimize.from', {
                          before: formatBytes(version.file.originalSizeBytes),
                        })}
                      </span>
                    ) : null}
                  </dd>
                </div>
                {stats ? (
                  <div className="flex items-baseline gap-1">
                    <dd>{formatCount(stats.triangles)}</dd>
                    <dt>{t('asset-library:unit.triangles')}</dt>
                    {delta && delta.triangles !== 0 ? (
                      <span
                        className={cn(
                          delta.triangles > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {formatSignedCount(delta.triangles)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="ml-auto">
                  <dt className="sr-only">
                    {t('asset-library:field.created')}
                  </dt>
                  <dd>
                    {formatAssetDateTime(version.createdAt, locale)}
                    {version.createdBy ? ` ${version.createdBy}` : ''}
                  </dd>
                </div>
              </dl>

              <div className="-ml-1.5 flex flex-wrap items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isViewed}
                  onClick={() => onView(version.version)}
                >
                  <Eye />
                  {t(
                    isViewed
                      ? 'asset-library:versions.viewing'
                      : 'asset-library:versions.view',
                  )}
                </Button>
                {canBeCurrent ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      report(
                        setCurrentVersion(asset.id, version.version, actor),
                      )
                    }
                  >
                    {t('asset-library:versions.makeCurrent')}
                  </Button>
                ) : null}
                {!isViewed && compareVersion !== version.version ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onCompare(version.version)}
                  >
                    <Columns2 />
                    {t('asset-library:compare.withViewed')}
                  </Button>
                ) : null}
                <DownloadLink version={version} />
                {/* 잘못 올린 버전을 걷어낸다 — 게시된 적 없는 것만, 파일을
                    지울 수 있는 환경에서만. */}
                {canManageFiles &&
                canRemoveAssetVersion(asset, version.version) ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setPending({ kind: 'remove', version: version.version })
                    }
                  >
                    <Trash2 />
                    {t('asset-library:versions.remove')}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {/* 목록을 가리지 않게, 알아 둘 것은 아래에 조용히 적는다. */}
      <div className="text-muted-foreground border-border flex flex-col gap-1.5 border-t px-5 py-4 text-xs leading-relaxed">
        <p>{t('asset-library:versions.uploadHint')}</p>
        {/* 씬은 놓을 때의 버전을 기억한다 — 현재 버전을 바꿔도 따라오지 않는다. */}
        {isSceneAssetKind(asset.kind) ? (
          <p>{t('asset-library:versions.sceneNotice')}</p>
        ) : null}
      </div>
      <AssetConfirmDialog
        open={pending !== null}
        destructive={pending?.kind === 'remove'}
        title={
          pending?.kind === 'remove'
            ? t('asset-library:versions.removeTitle', {
                version: pending.version,
              })
            : pending
              ? t('asset-library:lifecycle.confirmTitle', {
                  version: pending.version,
                  action: t(`asset-library:versions.transition.${pending.to}`),
                })
              : ''
        }
        description={
          pending?.kind === 'remove'
            ? t('asset-library:versions.removeHint')
            : pending
              ? t(`asset-library:lifecycle.confirmHint.${pending.to}`)
              : ''
        }
        confirmLabel={
          pending?.kind === 'remove'
            ? t('asset-library:action.delete')
            : pending
              ? t(`asset-library:versions.transition.${pending.to}`)
              : ''
        }
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === 'remove') {
            // 지우는 버전을 보고 있었으면 현재 버전으로 돌아간다.
            if (viewedVersion === pending.version) onView(asset.currentVersion);
            if (compareVersion === pending.version) onCompare(null);
            report(removeVersion(asset.id, pending.version, actor));
          } else {
            changeStatus(pending.version, pending.to);
          }
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
