import { useTranslation } from 'react-i18next';
import { getFormatLocale } from '@crane/core/config/i18n';
import type {
  AssetHistoryEntry,
  AssetRecord,
} from '@crane/domain/asset-library';
import { formatAssetDateTime } from '../lib/asset-presentation';

interface AssetActivityTabProps {
  asset: AssetRecord;
}

/** 활동 — 누가 언제 무엇을 바꿨는지. 최근 것이 위. */
export function AssetActivityTab({ asset }: AssetActivityTabProps) {
  const { t, i18n } = useTranslation();
  const locale = getFormatLocale(i18n.language);

  const describe = (entry: AssetHistoryEntry): string => {
    switch (entry.action) {
      case 'status':
        return t('asset-library:activity.status', {
          version: entry.version,
          from: t(`asset-library:status.${entry.from}`),
          to: t(`asset-library:status.${entry.to}`),
        });
      case 'version-added':
        return t('asset-library:activity.versionAdded', {
          version: entry.version,
        });
      case 'version-removed':
        return t('asset-library:activity.versionRemoved', {
          version: entry.version ?? '?',
        });
      case 'current-changed':
        return t('asset-library:activity.currentChanged', {
          from: entry.from,
          to: entry.to,
        });
      case 'metadata':
        return t('asset-library:activity.metadata', {
          fields: (entry.fields ?? [])
            .map((field) =>
              t(`asset-library:activity.field.${field}`, {
                defaultValue: field,
              }),
            )
            .join(', '),
        });
      case 'thumbnail':
        return t('asset-library:activity.thumbnail');
      default:
        return t('asset-library:activity.created');
    }
  };

  if (asset.history.length === 0) {
    return (
      <p className="text-muted-foreground px-5 py-6 text-[13px] leading-relaxed">
        {t(
          asset.origin === 'builtin'
            ? 'asset-library:activity.emptyBuiltin'
            : 'asset-library:activity.empty',
        )}
      </p>
    );
  }

  return (
    <ol className="px-5 py-5">
      {[...asset.history].reverse().map((entry) => (
        <li
          key={entry.id}
          className="border-border relative border-l pb-5 pl-5 last:pb-0"
        >
          <span
            aria-hidden
            className="bg-background border-foreground/40 absolute top-1 -left-[4.5px] size-2 rounded-full border"
          />
          <p className="text-foreground text-[13px] leading-snug">
            {describe(entry)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {formatAssetDateTime(entry.at, locale)}
            {entry.actor ? ` ${entry.actor}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
