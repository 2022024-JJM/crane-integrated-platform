import { Copy, Link2, X } from 'lucide-react';
import { useId, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ASSET_CATEGORY_MAX,
  ASSET_DESCRIPTION_MAX,
  ASSET_DRAWING_NO_MAX,
  ASSET_NAME_MAX,
  ASSET_OWNER_MAX,
  formatBytes,
  isDocumentAssetKind,
  resolveVersionSizeBytes,
  type AssetMetadataPatch,
  type AssetRecord,
  type AssetVersion,
} from '@crane/domain/asset-library';
import { useAssetLibraryStore } from '@crane/features/asset-library';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';
import { InputNumber } from '@crane/ui/atoms/input-number';
import { Combobox } from '@crane/ui/molecules/combobox';
import { copyText } from '../lib/copy-text';
import { shortenContentHash } from '../lib/asset-presentation';
import { useAssetSaveReport } from '../model/use-asset-save-report';
import { AssetKindIcon } from './asset-badges';
import {
  CommitInput,
  CommitTextArea,
  SitePicker,
  TagEditor,
} from './asset-form-fields';

interface AssetInfoTabProps {
  asset: AssetRecord;
  /** 지금 뷰어에 올라와 있는 버전. */
  version: AssetVersion;
  actor: string;
  hrefFor: (assetId: string) => string;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border flex flex-col gap-3 border-b px-5 py-5 last:border-b-0">
      <h3 className="text-foreground text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/**
 * 속성 한 줄 — 라벨은 왼쪽 열, 값은 오른쪽 열. 라벨이 한 줄로 서 있어 값만
 * 훑어 내려갈 수 있다. `top` 은 여러 줄 값(설명·태그)의 라벨을 위에 맞춘다.
 */
function PropertyRow({
  label,
  htmlFor,
  top,
  children,
}: {
  label: string;
  htmlFor?: string;
  top?: boolean;
  children: ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div
      className={cn(
        'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3',
        top ? 'items-start' : 'items-center',
      )}
    >
      <Label
        htmlFor={htmlFor}
        className={cn('text-muted-foreground text-[13px]', top && 'pt-1.5')}
      >
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ReadOnlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function AssetInfoTab({
  asset,
  version,
  actor,
  hrefFor,
}: AssetInfoTabProps) {
  const { t } = useTranslation();
  const report = useAssetSaveReport();
  const assets = useAssetLibraryStore((state) => state.assets);
  const collections = useAssetLibraryStore((state) => state.collections);
  const statsTable = useAssetLibraryStore((state) => state.statsTable);
  const updateMetadata = useAssetLibraryStore((state) => state.updateMetadata);
  const setCollectionMembership = useAssetLibraryStore(
    (state) => state.setCollectionMembership,
  );

  const patch = (change: AssetMetadataPatch) =>
    report(updateMetadata(asset.id, change, actor));

  const related = useMemo(
    () =>
      asset.relatedAssetIds
        .map((id) => assets.find((item) => item.id === id))
        .filter((item): item is AssetRecord => item !== undefined),
    [asset.relatedAssetIds, assets],
  );
  // 다른 자산이 이 자산을 연결해 둔 것 — 한쪽에만 적어도 양쪽에서 보인다.
  const referencedBy = useMemo(
    () =>
      assets.filter(
        (item) =>
          item.id !== asset.id &&
          item.relatedAssetIds.includes(asset.id) &&
          !asset.relatedAssetIds.includes(item.id),
      ),
    [asset.id, asset.relatedAssetIds, assets],
  );
  const relatedOptions = useMemo(
    () =>
      assets
        .filter(
          (item) =>
            item.id !== asset.id && !asset.relatedAssetIds.includes(item.id),
        )
        .map((item) => ({
          value: item.id,
          label: item.name,
          description: t(`asset-library:kind.${item.kind}`),
        })),
    [asset.id, asset.relatedAssetIds, assets, t],
  );

  const location =
    version.file.ref.storage === 'public'
      ? version.file.ref.path
      : version.file.ref.key;
  const editable = asset.origin === 'user';
  const baseId = useId();
  const ids = {
    name: `${baseId}-name`,
    description: `${baseId}-description`,
    owner: `${baseId}-owner`,
    category: `${baseId}-category`,
    drawingNo: `${baseId}-drawing-no`,
    tags: `${baseId}-tags`,
  };

  return (
    <div>
      <Section title={t('asset-library:info.basics')}>
        <PropertyRow label={t('asset-library:field.name')} htmlFor={ids.name}>
          <CommitInput
            id={ids.name}
            value={asset.name}
            maxLength={ASSET_NAME_MAX}
            required
            onCommit={(name) => patch({ name })}
          />
        </PropertyRow>
        <PropertyRow
          label={t('asset-library:field.description')}
          htmlFor={ids.description}
          top
        >
          <CommitTextArea
            id={ids.description}
            value={asset.description}
            maxLength={ASSET_DESCRIPTION_MAX}
            placeholder={t('asset-library:info.descriptionPlaceholder')}
            onCommit={(description) => patch({ description })}
          />
        </PropertyRow>
        <PropertyRow label={t('asset-library:field.owner')} htmlFor={ids.owner}>
          <CommitInput
            id={ids.owner}
            value={asset.owner}
            maxLength={ASSET_OWNER_MAX}
            onCommit={(owner) => patch({ owner })}
          />
        </PropertyRow>
        <PropertyRow
          label={t('asset-library:field.category')}
          htmlFor={ids.category}
        >
          <CommitInput
            id={ids.category}
            value={asset.category}
            maxLength={ASSET_CATEGORY_MAX}
            onCommit={(category) => patch({ category })}
          />
        </PropertyRow>
        {isDocumentAssetKind(asset.kind) ? (
          <PropertyRow
            label={t('asset-library:field.drawingNo')}
            htmlFor={ids.drawingNo}
          >
            <CommitInput
              id={ids.drawingNo}
              value={asset.drawingNo ?? ''}
              maxLength={ASSET_DRAWING_NO_MAX}
              onCommit={(drawingNo) => patch({ drawingNo })}
            />
          </PropertyRow>
        ) : null}
      </Section>

      <Section title={t('asset-library:info.classification')}>
        <PropertyRow label={t('asset-library:field.site')} top>
          <SitePicker
            value={asset.sites}
            onChange={(sites) => patch({ sites })}
          />
        </PropertyRow>
        <PropertyRow
          label={t('asset-library:field.tags')}
          htmlFor={ids.tags}
          top
        >
          <TagEditor
            id={ids.tags}
            value={asset.tags}
            onChange={(tags) => patch({ tags })}
          />
        </PropertyRow>
        {collections.length > 0 ? (
          <PropertyRow label={t('asset-library:rail.collections')} top>
            <div className="flex flex-wrap gap-1.5">
              {collections.map((collection) => {
                const member = collection.assetIds.includes(asset.id);
                return (
                  <button
                    key={collection.id}
                    type="button"
                    aria-pressed={member}
                    onClick={() =>
                      report(
                        setCollectionMembership(
                          collection.id,
                          [asset.id],
                          !member,
                        ),
                      )
                    }
                    className={cn(
                      'focus-visible:ring-ring/50 h-7 cursor-pointer rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-2',
                      member
                        ? 'border-foreground bg-foreground text-background font-medium'
                        : 'border-border text-foreground/75 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {collection.name}
                  </button>
                );
              })}
            </div>
          </PropertyRow>
        ) : null}
      </Section>

      <Section title={t('asset-library:info.related')}>
        {related.length + referencedBy.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {[...related, ...referencedBy].map((item) => {
              const removable = asset.relatedAssetIds.includes(item.id);
              return (
                <li
                  key={item.id}
                  className="bg-muted/60 flex items-center gap-2.5 rounded-md px-2.5 py-2"
                >
                  <AssetKindIcon
                    kind={item.kind}
                    className="text-muted-foreground"
                  />
                  <AppLink
                    to={hrefFor(item.id)}
                    className="text-foreground min-w-0 flex-1 truncate text-[13px] hover:underline"
                  >
                    {item.name}
                  </AppLink>
                  {removable ? (
                    <button
                      type="button"
                      aria-label={t('asset-library:info.unlink', {
                        name: item.name,
                      })}
                      onClick={() =>
                        patch({
                          relatedAssetIds: asset.relatedAssetIds.filter(
                            (id) => id !== item.id,
                          ),
                        })
                      }
                      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2"
                    >
                      <X className="size-3" />
                    </button>
                  ) : (
                    <Link2
                      aria-label={t('asset-library:info.linkedFromOther')}
                      className="text-muted-foreground size-3 shrink-0"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {t(
              isDocumentAssetKind(asset.kind)
                ? 'asset-library:info.relatedEmptyDrawing'
                : 'asset-library:info.relatedEmptyModel',
            )}
          </p>
        )}
        <Combobox
          value={null}
          options={relatedOptions}
          placeholder={t('asset-library:info.linkAsset')}
          searchPlaceholder={t('asset-library:browser.search')}
          emptyText={t('asset-library:info.noLinkCandidates')}
          aria-label={t('asset-library:info.linkAsset')}
          className="h-8 w-full text-[13px]"
          onValueChange={(value) => {
            if (!value) return;
            patch({ relatedAssetIds: [...asset.relatedAssetIds, value] });
          }}
        />
      </Section>

      <Section
        title={t('asset-library:info.file', { version: version.version })}
      >
        <dl className="flex flex-col gap-2">
          <ReadOnlyRow label={t('asset-library:field.file')}>
            {version.file.fileName}
          </ReadOnlyRow>
          <ReadOnlyRow label={t('asset-library:field.size')}>
            {formatBytes(resolveVersionSizeBytes(version, statsTable))}
          </ReadOnlyRow>
          <ReadOnlyRow label={t('asset-library:field.storage')}>
            {t(`asset-library:storage.${version.file.ref.storage}`)}
          </ReadOnlyRow>
          <ReadOnlyRow label={t('asset-library:field.path')}>
            <span className="inline-flex max-w-full items-center gap-1">
              <span className="truncate" title={location}>
                {location}
              </span>
              <button
                type="button"
                aria-label={t('asset-library:info.copyPath')}
                onClick={() => {
                  void copyText(location).then((copied) => {
                    if (copied) {
                      toast.success(t('asset-library:toast.pathCopied'));
                    }
                  });
                }}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded outline-none focus-visible:ring-2"
              >
                <Copy className="size-3" />
              </button>
            </span>
          </ReadOnlyRow>
          <ReadOnlyRow label={t('asset-library:field.hash')}>
            <span title={version.file.contentHash ?? undefined}>
              {shortenContentHash(version.file.contentHash)}
            </span>
          </ReadOnlyRow>
          <ReadOnlyRow label="ID">{asset.id}</ReadOnlyRow>
          {isDocumentAssetKind(asset.kind) ? null : (
            <ReadOnlyRow label={t('asset-library:field.defaultScale')}>
              {editable ? (
                <InputNumber
                  value={asset.defaultScale[0]}
                  min={0.0001}
                  max={10000}
                  step={0.1}
                  className="h-7 w-24"
                  inputClassName="text-xs"
                  onChange={(scale) =>
                    patch({ defaultScale: [scale, scale, scale] })
                  }
                />
              ) : (
                asset.defaultScale.join(' × ')
              )}
            </ReadOnlyRow>
          )}
          <ReadOnlyRow label={t('asset-library:field.origin')}>
            {t(`asset-library:origin.${asset.origin}`)}
          </ReadOnlyRow>
        </dl>
        {isDocumentAssetKind(asset.kind) ? null : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('asset-library:info.defaultScaleHint')}
          </p>
        )}
      </Section>
    </div>
  );
}
