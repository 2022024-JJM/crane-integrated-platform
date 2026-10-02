import { AlertTriangle, FileUp, Loader2, OctagonAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_DESCRIPTION_MAX,
  ASSET_DRAWING_NO_MAX,
  ASSET_NAME_MAX,
  ASSET_REVISION_MAX,
  ASSET_TAG_MAX,
  ASSET_TAGS_MAX,
  ASSET_UPLOAD_EXTENSIONS,
  formatBytes,
  humanizeAssetFileName,
  isDocumentAssetKind,
  listAssetKindTags,
  type AssetKind,
  type AssetRecord,
  type AssetStatsTable,
} from '@crane/domain/asset-library';
import type { ImportAssetInput } from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@crane/ui/molecules/alert-dialog';
import {
  analyzeAssetFile,
  type AssetFileAnalysis,
} from '../lib/analyze-asset-file';
import { AssetKindIcon } from './asset-badges';
import { FormRow, TagEditor, TextArea } from './asset-form-fields';
import { AssetOptimizeOption } from './asset-optimize-option';

const ACCEPT = ASSET_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',');

interface AssetImportDialogProps {
  open: boolean;
  /** 끌어다 놓아 연 경우의 파일. */
  initialFile: File | null;
  assets: readonly AssetRecord[];
  statsTable: AssetStatsTable;
  /**
   * 목록이 보고 있던 종류와 거기서 고른 태그 — 같은 종류의 파일을 등록하면
   * 그 태그로 시작한다.
   */
  defaultKind: AssetKind | null;
  defaultTags: readonly string[];
  localOnly: boolean;
  /** 등록할 때 모델을 최적화할 수 있는 환경인지. */
  canOptimize: boolean;
  onClose: () => void;
  /** 등록을 수행한다. 성공하면 true — 다이얼로그는 호출부가 닫는다. */
  onSubmit: (input: ImportAssetInput) => Promise<boolean>;
}

export function AssetImportDialog({
  open,
  initialFile,
  assets,
  statsTable,
  defaultKind,
  defaultTags,
  localOnly,
  canOptimize,
  onClose,
  onSubmit,
}: AssetImportDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogPopup className="max-w-xl p-0">
        {/* 열릴 때마다 새로 마운트해 지난 입력이 남지 않게 한다. */}
        {open ? (
          <ImportForm
            initialFile={initialFile}
            assets={assets}
            statsTable={statsTable}
            defaultKind={defaultKind}
            defaultTags={defaultTags}
            localOnly={localOnly}
            canOptimize={canOptimize}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        ) : null}
      </AlertDialogPopup>
    </AlertDialog>
  );
}

function ImportForm({
  initialFile,
  assets,
  statsTable,
  defaultKind,
  defaultTags,
  localOnly,
  canOptimize,
  onClose,
  onSubmit,
}: Omit<AssetImportDialogProps, 'open'>) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(initialFile);
  const [analysis, setAnalysis] = useState<AssetFileAnalysis | null>(null);
  const [analyzedFile, setAnalyzedFile] = useState<File | null>(null);
  const [name, setName] = useState(
    initialFile ? humanizeAssetFileName(initialFile.name) : '',
  );
  // 이름을 직접 고치기 전까지는 고른 파일의 이름을 따라간다.
  const [nameEdited, setNameEdited] = useState(false);
  const [kind, setKind] = useState<AssetKind | null>(null);
  const [optimize, setOptimize] = useState(true);
  // 손대기 전(null)에는 목록에서 고른 태그를 따른다 — 단, 보고 있던 종류와
  // 같은 종류의 파일일 때만. 모델의 태그를 도면에 붙이지 않는다.
  const [editedTags, setEditedTags] = useState<string[] | null>(null);
  const [description, setDescription] = useState('');
  const [drawingNo, setDrawingNo] = useState('');
  const [revision, setRevision] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tags =
    editedTags ??
    (kind !== null && kind === defaultKind
      ? defaultTags
          .slice(0, ASSET_TAGS_MAX)
          .map((tag) => tag.slice(0, ASSET_TAG_MAX))
      : []);
  const kindTags = useMemo(
    () => (kind !== null ? listAssetKindTags(assets, kind) : []),
    [assets, kind],
  );

  // 파일이 바뀌면 다시 살핀다. 늦게 끝난 이전 분석은 버린다.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    analyzeAssetFile(file, assets, statsTable).then((result) => {
      if (cancelled) return;
      setAnalysis(result);
      setAnalyzedFile(file);
      setKind((previous) =>
        previous && result.allowedKinds.includes(previous)
          ? previous
          : (result.allowedKinds[0] ?? null),
      );
    });
    return () => {
      cancelled = true;
    };
    // assets·statsTable 은 중복 판정의 기준일 뿐이다 — 목록이 바뀌었다고 다시
    // 해시하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const analyzing = file !== null && analyzedFile !== file;
  const ready = file !== null && !analyzing && analysis !== null;
  const blocked = ready && analysis.problem !== null;
  const canSubmit =
    ready && !blocked && kind !== null && name.trim() !== '' && !submitting;

  const pickFile = (next: File | null) => {
    if (!next) return;
    setFile(next);
    if (!nameEdited) setName(humanizeAssetFileName(next.name));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !file || !analysis || !kind) return;
    setSubmitting(true);
    const ok = await onSubmit({
      file,
      kind,
      name: name.trim(),
      description: description.trim(),
      optimize: canOptimize && kind === 'model' && optimize,
      tags,
      contentHash: analysis.contentHash,
      ...(kind !== null && isDocumentAssetKind(kind) && drawingNo.trim()
        ? { drawingNo: drawingNo.trim() }
        : {}),
      ...(kind !== null && isDocumentAssetKind(kind) && revision.trim()
        ? { revision: revision.trim() }
        : {}),
    });
    if (!ok) setSubmitting(false);
  };

  return (
    <form
      className="flex max-h-[85vh] flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <header className="border-border border-b px-5 py-4">
        <AlertDialogTitle>{t('asset-library:import.title')}</AlertDialogTitle>
        {/* 설명은 두 줄이다 — 문구의 줄바꿈을 그대로 살린다. */}
        <AlertDialogDescription className="mt-1 whitespace-pre-line">
          {t('asset-library:import.description')}
        </AlertDialogDescription>
      </header>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            pickFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            pickFile(event.dataTransfer.files[0] ?? null);
          }}
          className={cn(
            'focus-visible:ring-ring/50 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2',
            file
              ? 'border-border bg-muted/40'
              : 'border-foreground/25 hover:bg-muted/50',
          )}
        >
          <span className="bg-background border-border flex size-9 shrink-0 items-center justify-center rounded-md border">
            {analyzing ? (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            ) : (
              <FileUp className="text-muted-foreground size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-sm font-medium">
              {file ? file.name : t('asset-library:import.pickFile')}
            </span>
            <span className="text-muted-foreground block text-[11px]">
              {file
                ? analyzing
                  ? t('asset-library:import.analyzing')
                  : formatBytes(file.size)
                : t('asset-library:import.formats')}
            </span>
          </span>
          {file ? (
            <span className="text-muted-foreground shrink-0 text-[11px] underline underline-offset-2">
              {t('asset-library:import.changeFile')}
            </span>
          ) : null}
        </button>

        {ready && analysis.problem ? (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
          >
            <OctagonAlert className="mt-px size-3.5 shrink-0" />
            {analysis.problem.code === 'glb'
              ? t(`asset-library:import.problem.glb.${analysis.problem.reason}`)
              : analysis.problem.code === 'unsupported'
                ? t('asset-library:import.problem.unsupported', {
                    format: analysis.problem.format || '?',
                  })
                : t('asset-library:import.problem.empty')}
          </p>
        ) : null}

        {ready && !analysis.problem && analysis.duplicates.length > 0 ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {t('asset-library:import.duplicate', {
              names: analysis.duplicates
                .map((item) => `${item.assetName} v${item.version}`)
                .join(', '),
            })}
          </p>
        ) : null}

        {ready && !analysis.problem && analysis.large ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {t('asset-library:import.large')}
          </p>
        ) : null}

        <fieldset
          disabled={!ready || blocked || submitting}
          className="flex flex-col gap-4 disabled:opacity-50"
        >
          <FormRow label={t('asset-library:field.name')}>
            {(id) => (
              <Input
                id={id}
                value={name}
                maxLength={ASSET_NAME_MAX}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameEdited(true);
                }}
              />
            )}
          </FormRow>

          {ready && analysis.allowedKinds.length > 1 ? (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px]">
                {t('asset-library:field.kind')}
              </span>
              <div className="flex gap-1.5">
                {analysis.allowedKinds.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={kind === option}
                    onClick={() => setKind(option)}
                    className={cn(
                      'focus-visible:ring-ring/50 flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-xs transition-colors outline-none focus-visible:ring-2',
                      kind === option
                        ? 'border-foreground/40 bg-foreground/8 text-foreground font-medium'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <AssetKindIcon kind={option} />
                    {t(`asset-library:kind.${option}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* 모델만 — 지도는 타일·LOD 를 만드는 전용 파이프라인이 따로 있다. */}
          {canOptimize && kind === 'model' ? (
            <AssetOptimizeOption checked={optimize} onChange={setOptimize} />
          ) : null}

          {kind !== null && isDocumentAssetKind(kind) ? (
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <FormRow label={t('asset-library:field.drawingNo')}>
                {(id) => (
                  <Input
                    id={id}
                    value={drawingNo}
                    maxLength={ASSET_DRAWING_NO_MAX}
                    onChange={(event) => setDrawingNo(event.target.value)}
                  />
                )}
              </FormRow>
              <FormRow label={t('asset-library:field.revision')}>
                {(id) => (
                  <Input
                    id={id}
                    value={revision}
                    maxLength={ASSET_REVISION_MAX}
                    placeholder="A"
                    onChange={(event) => setRevision(event.target.value)}
                  />
                )}
              </FormRow>
            </div>
          ) : null}

          <FormRow label={t('asset-library:field.tags')}>
            {(id) => (
              <TagEditor
                id={id}
                value={tags}
                suggestions={kindTags}
                onChange={setEditedTags}
              />
            )}
          </FormRow>

          <FormRow label={t('asset-library:field.description')}>
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                className="min-h-0"
                value={description}
                maxLength={ASSET_DESCRIPTION_MAX}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </FormRow>
        </fieldset>
      </div>

      <footer className="border-border flex items-center justify-between gap-3 border-t px-5 py-3">
        <p className="text-muted-foreground min-w-0 text-[11px] leading-snug">
          {localOnly
            ? t('asset-library:import.localOnly')
            : t('asset-library:import.startsAsDraft')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={onClose}
          >
            {t('asset-library:action.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {t('asset-library:import.submit')}
          </Button>
        </div>
      </footer>
    </form>
  );
}
