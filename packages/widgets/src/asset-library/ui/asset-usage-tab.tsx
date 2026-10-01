import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getAssetUsage,
  isDocumentAssetKind,
  type AssetRecord,
} from '@crane/domain/asset-library';
import { useAssetLibraryStore } from '@crane/features/asset-library';
import { getRegionTitleKey } from '@crane/domain/region';
import { AppLink } from '@crane/ui/atoms/app-link';
import { Button } from '@crane/ui/atoms/button';

interface AssetUsageTabProps {
  asset: AssetRecord;
}

/** 사용처 — 이 자산의 파일을 배치한 씬. */
export function AssetUsageTab({ asset }: AssetUsageTabProps) {
  const { t } = useTranslation();
  const usageIndex = useAssetLibraryStore((state) => state.usageIndex);
  const usageStatus = useAssetLibraryStore((state) => state.usageStatus);
  const failedScenes = useAssetLibraryStore((state) => state.usageFailedScenes);
  const loadUsage = useAssetLibraryStore((state) => state.loadUsage);

  if (isDocumentAssetKind(asset.kind)) {
    return (
      <p className="text-muted-foreground px-5 py-6 text-[13px] leading-relaxed">
        {t('asset-library:usage.drawing')}
      </p>
    );
  }
  if (usageStatus === 'loading' || usageStatus === 'idle') {
    return (
      <p className="text-muted-foreground flex items-center gap-2 px-5 py-6 text-[13px] leading-relaxed">
        <Loader2 className="size-3.5 animate-spin" />
        {t('asset-library:usage.loading')}
      </p>
    );
  }
  if (usageStatus === 'error') {
    return (
      <div className="flex flex-col items-start gap-2 px-4 py-6">
        <p className="text-foreground text-[13px]">
          {t('asset-library:usage.failed')}
        </p>
        <Button variant="outline" size="sm" onClick={() => void loadUsage()}>
          {t('asset-library:action.retry')}
        </Button>
      </div>
    );
  }

  const usage = getAssetUsage(asset, usageIndex);

  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      {failedScenes.length > 0 ? (
        <p
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200"
        >
          {t('asset-library:usage.partial', {
            scenes: failedScenes.join(', '),
          })}
        </p>
      ) : null}

      {usage.length === 0 ? (
        <div>
          <p className="text-foreground text-[13px] font-medium">
            {t('asset-library:usage.none')}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            {t(
              asset.catalogId
                ? 'asset-library:usage.noneCatalogHint'
                : asset.origin === 'builtin'
                  ? 'asset-library:usage.noneRuntimeHint'
                  : 'asset-library:usage.noneUserHint',
            )}
          </p>
        </div>
      ) : (
        usage.map((entry) => (
          <section key={entry.version}>
            <h3 className="text-foreground mb-2.5 text-[13px] font-semibold">
              {t('asset-library:usage.versionHeading', {
                version: entry.version,
              })}
            </h3>
            <ul className="border-border divide-border divide-y rounded-md border">
              {entry.usages.map((item) => (
                <li
                  key={item.sceneFile}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[13px] font-medium">
                      {item.regionIds
                        .map((regionId) => t(getRegionTitleKey(regionId)))
                        .join(', ')}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {item.sceneFile}
                      {item.site
                        ? ` ${t(`asset-library:site.${item.site}`)}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-foreground font-condensed shrink-0 text-base font-semibold tabular-nums">
                    {t('asset-library:usage.count', { count: item.count })}
                  </span>
                  {item.editorPath ? (
                    <AppLink
                      to={item.editorPath}
                      aria-label={t('asset-library:usage.openEditor')}
                      title={t('asset-library:usage.openEditor')}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 flex size-7 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
                    >
                      <ArrowUpRight className="size-3.5" />
                    </AppLink>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
