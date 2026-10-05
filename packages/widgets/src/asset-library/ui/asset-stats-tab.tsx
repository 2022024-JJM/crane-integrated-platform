import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ASSET_BUDGET,
  evaluateAssetBudget,
  formatBytes,
  formatCount,
  formatMeters,
  isDocumentAssetKind,
  isGeometryAssetKind,
  type AssetBudgetMetric,
  type AssetRecord,
  type AssetStats,
} from '@crane/domain/asset-library';
import { cn } from '@crane/core/lib/utils';

interface AssetStatsTabProps {
  asset: AssetRecord;
  /** 저장된 값이 있으면 그것, 없으면 뷰어가 잰 값. 둘 다 없으면 null. */
  stats: AssetStats | null;
  /** 뷰어에서 방금 잰 값인지(저장된 값과 구분해 알린다). */
  live: boolean;
}

interface BudgetItem {
  metric: AssetBudgetMetric;
  value: number;
  limit: number;
}

function formatMetric(metric: AssetBudgetMetric, value: number): string {
  return metric === 'textureMemory' ? formatBytes(value) : formatCount(value);
}

/**
 * 권장 상한이 있는 지표 한 줄 — 값, 상한, 그리고 상한 대비 어디쯤인지의 막대.
 * 막대는 상한에서 가득 찬다. 넘으면 색만 바꾸지 않고 표식과 글자로도 알린다.
 */
function BudgetRow({ item }: { item: BudgetItem }) {
  const { t } = useTranslation();
  const over = item.value > item.limit;
  const ratio = item.limit > 0 ? Math.min(item.value / item.limit, 1) : 0;
  const label = t(`asset-library:stats.metric.${item.metric}`);

  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground text-[13px]">{label}</span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-foreground font-condensed text-base leading-none font-semibold">
            {formatMetric(item.metric, item.value)}
          </span>
          <span className="text-muted-foreground text-xs">
            / {formatMetric(item.metric, item.limit)}
          </span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={item.limit}
        aria-valuenow={Math.min(item.value, item.limit)}
        aria-valuetext={`${formatMetric(item.metric, item.value)} / ${formatMetric(item.metric, item.limit)}`}
        // 막대의 바탕은 채움과 같은 색의 옅은 단 — 넘었을 때 줄 전체가
        // 같은 상태로 읽힌다.
        className={cn(
          'mt-2 h-1.5 overflow-hidden rounded-full',
          over ? 'bg-amber-500/20' : 'bg-foreground/10',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full',
            over ? 'bg-amber-500' : 'bg-foreground/55',
          )}
          // 0 이 아닌 값은 최소 한 점이라도 보이게 한다.
          style={{ width: `${item.value > 0 ? Math.max(ratio * 100, 2) : 0}%` }}
        />
      </div>
      {over ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <TriangleAlert className="size-3.5 shrink-0" />
          {t('asset-library:stats.overBudget')}
        </p>
      ) : null}
    </div>
  );
}

export function AssetStatsTab({ asset, stats, live }: AssetStatsTabProps) {
  const { t } = useTranslation();

  if (!isGeometryAssetKind(asset.kind)) {
    return (
      <p className="text-muted-foreground px-5 py-6 text-[13px] leading-relaxed">
        {t(
          isDocumentAssetKind(asset.kind)
            ? 'asset-library:stats.drawing'
            : 'asset-library:stats.environment',
        )}
      </p>
    );
  }
  if (!stats) {
    return (
      <p className="text-muted-foreground px-5 py-6 text-[13px] leading-relaxed">
        {t('asset-library:stats.pending')}
      </p>
    );
  }

  const meters = stats.size ?? null;
  const hasWarning = evaluateAssetBudget(asset.kind, stats).length > 0;

  // 지도는 타일·LOD 로 나눠 노드와 드로우콜이 많은 것이 정상이라 텍스처
  // 메모리만 상한과 견준다(evaluateAssetBudget 과 같은 기준).
  const budgets: BudgetItem[] = [
    ...(asset.kind === 'model'
      ? ([
          {
            metric: 'triangles',
            value: stats.triangles,
            limit: ASSET_BUDGET.triangles,
          },
          {
            metric: 'drawCalls',
            value: stats.drawCalls,
            limit: ASSET_BUDGET.drawCalls,
          },
          { metric: 'nodes', value: stats.nodes, limit: ASSET_BUDGET.nodes },
        ] satisfies BudgetItem[])
      : []),
    {
      metric: 'textureMemory',
      value: stats.textureMemoryBytes,
      limit: ASSET_BUDGET.textureMemoryBytes,
    },
  ];
  const budgeted = new Set(budgets.map((item) => item.metric));

  const counts: { key: string; value: string }[] = [
    { key: 'triangles', value: formatCount(stats.triangles) },
    { key: 'vertices', value: formatCount(stats.vertices) },
    { key: 'drawCalls', value: formatCount(stats.drawCalls) },
    { key: 'meshes', value: formatCount(stats.meshes) },
    { key: 'materials', value: formatCount(stats.materials) },
    { key: 'textures', value: formatCount(stats.textures) },
    { key: 'nodes', value: formatCount(stats.nodes) },
    { key: 'lodLevels', value: String(stats.lodLevels) },
    { key: 'animations', value: String(stats.animations) },
  ].filter((item) => !budgeted.has(item.key as AssetBudgetMetric));

  return (
    <div className="divide-border divide-y">
      {meters ? (
        <section className="px-5 py-5">
          <h3 className="text-foreground mb-3 text-[13px] font-semibold">
            {t('asset-library:stats.dimensions')}
          </h3>
          <dl className="grid grid-cols-3 gap-3">
            {(
              [
                ['W', meters[0]],
                ['D', meters[2]],
                ['H', meters[1]],
              ] as const
            ).map(([axis, value]) => (
              <div key={axis} className="flex flex-col-reverse">
                <dt className="text-muted-foreground mt-1 text-xs">
                  {t(`asset-library:stats.axis.${axis}`)}
                </dt>
                <dd className="text-foreground font-condensed text-xl leading-none font-semibold">
                  {formatMeters(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="px-5 py-5">
        <h3 className="text-foreground text-[13px] font-semibold">
          {t('asset-library:stats.budgetHeading')}
        </h3>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {t('asset-library:stats.budgetLegend')}
        </p>
        <div className="divide-border mt-2 divide-y">
          {budgets.map((item) => (
            <BudgetRow key={item.metric} item={item} />
          ))}
        </div>
        {hasWarning ? (
          <p className="mt-3 rounded-md bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            {t('asset-library:stats.budgetHint')}
          </p>
        ) : null}
      </section>

      <section className="px-5 py-5">
        <h3 className="text-foreground mb-3 text-[13px] font-semibold">
          {t('asset-library:stats.geometry')}
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
          {counts.map((item) => (
            <div key={item.key} className="flex flex-col-reverse">
              <dt className="text-muted-foreground mt-1 text-xs">
                {t(`asset-library:stats.metric.${item.key}`)}
              </dt>
              <dd className="text-foreground font-condensed text-lg leading-none font-semibold tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          {t(
            live
              ? 'asset-library:stats.sourceLive'
              : 'asset-library:stats.sourceStored',
          )}
        </p>
      </section>
    </div>
  );
}
