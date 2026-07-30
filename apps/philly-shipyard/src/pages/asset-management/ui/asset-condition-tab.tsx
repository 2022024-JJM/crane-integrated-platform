import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CraneAsset, CraneComponent } from '@crane/domain/asset';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { TABLE_EMPTY } from '../../../shared/ui/page';
import {
  PILL_INACTIVE,
  TONE_FILL,
  TONE_PILL_ACTIVE,
  TONE_TEXT,
} from '../../../shared/ui/tone';
import { FOCUS_RING } from '../../../shared/ui/controls';
import { RingGauge } from '../../../shared/ui/ring-gauge';
import {
  buildLifeTrend,
  computeClusterCondition,
  type ClusterCondition,
} from '../lib/condition-math';

/** 교체 검토 기준선 (잔여 %) */
const REPLACE_THRESHOLD = 20;
const GAUGE_COUNT = 6;

function ConditionGaugeCard({ cond, craneId }: { cond: ClusterCondition; craneId: string }) {
  const { t } = useTranslation('asset-management');
  // 잔여 수명이 교체 기준선 이하면 판단에서 바로 행동으로 — 수리 티켓 폼을 크레인·구성품 프리필로 연다
  const atRisk = cond.remainingPct <= REPLACE_THRESHOLD;
  const repairHref = `/ticket/create?type=repair&craneId=${craneId}&component=${encodeURIComponent(cond.component.componentName)}`;
  return (
    <div className={cn(SURFACE_PANEL, 'flex flex-col items-center gap-3 p-4')}>
      <RingGauge value={cond.remainingPct} color={TONE_FILL[cond.tone]} size={96} strokeWidth={8}>
        <span className="text-lg font-bold tabular-nums">{cond.remainingPct}%</span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          {t('detail.condition.remaining')}
        </span>
      </RingGauge>
      <div className="w-full space-y-1 text-center">
        <p className="truncate text-xs font-semibold" title={cond.component.componentName}>
          {cond.component.componentName}
        </p>
        <dl className="space-y-0.5 text-[11px] text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>{t('detail.condition.annualAvg')}</dt>
            <dd className={cn('font-medium tabular-nums', TONE_TEXT[cond.tone])}>
              −{cond.annualWearPct}%{t('detail.condition.perYear')}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{t('detail.condition.periodDelta')}</dt>
            <dd className="font-medium tabular-nums text-foreground">−{cond.periodWearPct}%</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>{t('detail.condition.estimatedEol')}</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {cond.estimatedEol ?? '—'}
            </dd>
          </div>
        </dl>
      </div>
      {atRisk && (
        <Link
          to={repairHref}
          className={cn(
            'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium transition-colors hover:bg-muted',
            FOCUS_RING,
          )}
        >
          <Wrench className="h-3 w-3" />
          {t('detail.condition.requestRepair', { defaultValue: 'Request repair' })}
        </Link>
      )}
    </div>
  );
}

/**
 * TRUCONNECT Condition 스타일 — 클러스터별 잔여 수명 링 게이지 + 수명 추이 차트.
 * 모든 값은 기존 installDate/currentHours/expectedLifeHours에서 파생된다.
 */
export function AssetConditionTab({
  asset,
  components,
}: {
  asset: CraneAsset;
  components: CraneComponent[];
}) {
  const { t } = useTranslation('asset-management');
  const now = useMemo(() => new Date(), []);

  // 루트 클러스터를 소모율 내림차순 정렬 — 게이지는 최악 6개
  const conditions = useMemo(
    () =>
      components
        .filter((c) => c.parentId === null)
        .map((c) => computeClusterCondition(c, now))
        .sort((a, b) => b.usedPct - a.usedPct),
    [components, now],
  );
  // 기본은 최악 6개 — 나머지 클러스터도 조회 경로가 있어야 하므로 전체 보기 토글을 둔다
  const [showAll, setShowAll] = useState(false);
  const gauges = showAll ? conditions : conditions.slice(0, GAUGE_COUNT);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    conditions.find((c) => c.component.id === selectedId) ?? conditions[0];

  const trend = useMemo(() => (selected ? buildLifeTrend(selected) : []), [selected]);
  const eolYear = selected?.estimatedEol
    ? Number(selected.estimatedEol.slice(0, 4))
    : null;

  if (conditions.length === 0) {
    return (
      <div className={cn(TABLE_EMPTY, 'rounded-lg border border-dashed border-border/70')}>
        {t('detail.condition.noComponents')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 게이지 그리드 — 최악 클러스터 우선, 전체 보기로 나머지 접근 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t('detail.condition.gaugesTitle')}</h2>
          {conditions.length > GAUGE_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={cn(
                'cursor-pointer rounded px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {showAll
                ? t('detail.condition.showWorst', { defaultValue: 'Show worst 6' })
                : t('detail.condition.showAll', {
                    count: conditions.length,
                    defaultValue: 'View all {{count}}',
                  })}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {gauges.map((cond) => (
            <ConditionGaugeCard key={cond.component.id} cond={cond} craneId={asset.id} />
          ))}
        </div>
      </section>

      {/* 수명 추이 — 선택 클러스터의 잔여 수명 외삽 */}
      <section className={cn(SURFACE_PANEL, 'space-y-4 p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold">{t('detail.condition.trendTitle')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {gauges.map((cond) => {
              const active = selected?.component.id === cond.component.id;
              return (
                <button
                  key={cond.component.id}
                  type="button"
                  onClick={() => setSelectedId(cond.component.id)}
                  className={cn(
                    'cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    FOCUS_RING,
                    active ? TONE_PILL_ACTIVE[cond.tone] : PILL_INACTIVE,
                  )}
                >
                  {cond.component.componentName}
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => [`${value ?? '—'}%`, t('detail.condition.remaining')]}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={REPLACE_THRESHOLD}
                  stroke={TONE_FILL.warning}
                  strokeDasharray="4 4"
                  label={{
                    value: t('detail.condition.threshold'),
                    position: 'insideBottomLeft',
                    fontSize: 10,
                    fill: 'var(--muted-foreground)',
                  }}
                />
                {eolYear !== null && (
                  <ReferenceLine
                    x={eolYear}
                    stroke={TONE_FILL.critical}
                    strokeDasharray="4 4"
                    label={{
                      value: selected.estimatedEol ?? '',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: 'var(--muted-foreground)',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke={TONE_FILL[selected.tone]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
