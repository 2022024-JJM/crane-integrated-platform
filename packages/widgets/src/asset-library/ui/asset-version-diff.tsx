import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatBytes,
  formatCount,
  formatMeters,
  formatSignedCount,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';
import { Switch } from '@crane/ui/atoms/switch';
import {
  formatRatio,
  type VersionCompareRow,
  type VersionCompareUnit,
} from '../lib/version-compare';

function formatValue(value: number | null, unit: VersionCompareUnit): string {
  if (value === null) return '—';
  if (unit === 'bytes') return formatBytes(value);
  if (unit === 'meters') return formatMeters(value);
  return formatCount(value);
}

function formatDelta(delta: number, unit: VersionCompareUnit): string {
  if (unit === 'count') return formatSignedCount(delta);
  const sign = delta > 0 ? '+' : '−';
  const size = Math.abs(delta);
  return `${sign}${unit === 'bytes' ? formatBytes(size) : formatMeters(size)}`;
}

interface AssetVersionDiffProps {
  baseVersion: number;
  targetVersion: number;
  rows: readonly VersionCompareRow[];
}

/**
 * 두 버전의 수치 차이 표. 무거워진 값은 amber, 가벼워진 값은 emerald —
 * 치수는 좋고 나쁨이 없어 색을 입히지 않는다.
 */
export function AssetVersionDiff({
  baseVersion,
  targetVersion,
  rows,
}: AssetVersionDiffProps) {
  const { t } = useTranslation();
  const [changedOnly, setChangedOnly] = useState(false);
  const changedCount = rows.filter((row) => row.changed).length;
  const visible = changedOnly ? rows.filter((row) => row.changed) : rows;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {changedCount > 0
            ? t('asset-library:compare.changedCount', { count: changedCount })
            : t('asset-library:compare.noChange')}
        </p>
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
          {t('asset-library:compare.changedOnly')}
          <Switch
            aria-label={t('asset-library:compare.changedOnly')}
            checked={changedOnly}
            onCheckedChange={setChangedOnly}
          />
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border border-dashed px-3 py-4 text-center text-xs">
          {t('asset-library:compare.noChange')}
        </p>
      ) : (
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left">
              <th scope="col" className="py-1.5 pr-2 font-medium">
                {t('asset-library:compare.metric')}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                v{baseVersion}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">
                v{targetVersion}
              </th>
              <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                {t('asset-library:compare.delta')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.metric}
                className="border-border/60 border-b last:border-b-0"
              >
                <th
                  scope="row"
                  className={cn(
                    'py-1.5 pr-2 text-left font-normal',
                    row.changed ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {t(`asset-library:compare.metricName.${row.metric}`)}
                </th>
                <td className="text-muted-foreground px-2 py-1.5 text-right">
                  {formatValue(row.base, row.unit)}
                </td>
                <td
                  className={cn(
                    'px-2 py-1.5 text-right',
                    row.changed
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatValue(row.target, row.unit)}
                </td>
                <td
                  className={cn(
                    'py-1.5 pl-2 text-right whitespace-nowrap',
                    !row.changed || row.delta === null
                      ? 'text-muted-foreground/60'
                      : row.unit === 'meters'
                        ? 'text-foreground'
                        : row.delta > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {row.changed && row.delta !== null ? (
                    <>
                      {formatDelta(row.delta, row.unit)}
                      {row.ratio !== null ? (
                        <span className="ml-1.5 opacity-75">
                          {formatRatio(row.ratio)}
                        </span>
                      ) : null}
                    </>
                  ) : row.base === null || row.target === null ? (
                    '—'
                  ) : (
                    '='
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
