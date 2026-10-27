import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Grid3x3,
  LayoutList,
  ListChecks,
  PieChart,
  Wrench,
} from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useInspectionList } from '@crane/features/inspection';
import { useInventoryList } from '@crane/features/inventory';
import { useMaintenanceList } from '@crane/features/maintenance';
import { useOpenRisks } from '@crane/features/risk';
import { useTriageQueue } from '@crane/features/triage';
import { buildTodoRows } from '../lib/todo-rows';
import { buildWatchAssets } from '../lib/fleet-rows';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { KC, usd } from '../../../shared/ui/kc';
import { KcCard, KcDonut, KcStat } from '../../../shared/ui/kc-ui';
import { useMro2Year } from '../../../shared/ui/layout';
import {
  computeSpend,
  SPEND_TYPES,
  type SpendTypeKey,
} from '../../../shared/lib/spend';
import { yearOf } from '../../../shared/lib/service-status';

export function Mro2OverviewPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const triageTotal = useTriageQueue().total;
  const { year } = useMro2Year();
  const { safety, production } = useOpenRisks();
  const { assets, summary, craneHealthMap, craneNextInspectionMap } =
    useAssetList();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const { summary: invSummary } = useInventoryList();

  const yearInspections = inspections.filter(
    (w) => yearOf(w.scheduledDate) === year,
  );
  const yearRepairs = repairs.filter((w) => yearOf(w.scheduledStart) === year);

  const openWos =
    yearInspections.filter(
      (w) => w.status === 'scheduled' || w.status === 'in_progress',
    ).length + yearRepairs.filter((w) => w.status !== 'completed').length;
  const completedWos =
    yearInspections.filter((w) => w.status === 'completed').length +
    yearRepairs.filter((w) => w.status === 'completed').length;
  const overdueWos = yearInspections.filter(
    (w) => w.status === 'overdue',
  ).length;

  const spend = useMemo(
    () => computeSpend(inspections, repairs, year),
    [inspections, repairs, year],
  );
  const spendPct = (key: SpendTypeKey) =>
    spend.total > 0 ? Math.round((spend.byType[key] / spend.total) * 100) : 0;

  const openRiskTotal = safety.length + production.length;
  // 기준 시각은 마운트 때 한 번 — 렌더 중 Date.now() 는 순수하지 않다.
  const [now] = useState(() => Date.now());
  const { i18n } = useTranslation();
  const watch = useMemo(
    () => buildWatchAssets(assets, craneHealthMap, craneNextInspectionMap, now),
    [assets, craneHealthMap, craneNextInspectionMap, now],
  );
  const todo = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const w of inspections) {
      labels[w.id] =
        `${t('mro2:detail.typeInspection', { type: t(`calendar:type.${w.woType}`) })} · ${w.woNumber}`;
    }
    return buildTodoRows(
      [...safety, ...production],
      now,
      i18n.language === 'ko',
      undefined,
      labels,
    );
  }, [safety, production, now, i18n.language, inspections, t]);

  return (
    <div className="pt-2">
      {/* 본문 — 전폭 */}
      <div className="min-w-0">
        {/* 현장 접수 — 처리할 것이 있을 때만 띠로. 관리자의 첫 일거리다. */}
        {triageTotal > 0 ? (
          <Link
            to="/mro2/triage"
            className="mb-4 flex items-center justify-between rounded px-4 py-3 text-[14px] font-semibold"
            style={{
              background: KC.inverseBg,
              color: KC.inverseText,
              borderRadius: KC.radius,
            }}
          >
            <span className="flex items-center gap-2">
              <Inbox size={16} /> {t('triage.band', { n: triageTotal })}
            </span>
            <span>{t('triage.open')} →</span>
          </Link>
        ) : null}

        {/* 할 일 + 미결 리스크 — 관리자의 첫 화면은 숫자가 아니라 처리할 목록이다 */}
        <div className="mb-6">
          <KcCard
            icon={<ListChecks size={15} />}
            title={t('overview.todo.title')}
            to="/mro2/service-requests"
          >
            <div
              className="mb-1 flex gap-3 text-[12px]"
              style={{ color: KC.muted }}
            >
              <span>
                <span
                  className="font-bold"
                  style={{ color: safety.length > 0 ? KC.safety : KC.muted }}
                >
                  {safety.length}
                </span>{' '}
                {t('common.safety')}
              </span>
              <span>
                <span
                  className="font-bold"
                  style={{
                    color: production.length > 0 ? KC.production : KC.muted,
                  }}
                >
                  {production.length}
                </span>{' '}
                {t('common.production')}
              </span>
            </div>
            {todo.length === 0 ? (
              <div
                className="py-6 text-center text-[13px]"
                style={{ color: KC.muted }}
              >
                {t('overview.todo.empty')}
              </div>
            ) : (
              <ul className="flex flex-col">
                {todo.map((row) => (
                  <li key={row.id}>
                    <Link
                      to={row.detailPath}
                      className="kc-hover flex items-center gap-3 border-b py-2 text-[13px]"
                      style={{ borderColor: KC.hairline, color: KC.ink }}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background:
                            row.riskType === 'safety'
                              ? KC.safety
                              : KC.production,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {row.title}
                        </span>
                        <span
                          className="block truncate text-[12px]"
                          style={{ color: KC.muted }}
                        >
                          {row.assetName}
                          {row.assetName ? ' · ' : ''}
                          {t(`overview.todo.source.${row.source}`)}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-[12px] font-bold tabular-nums"
                        style={{
                          color: row.daysOpen >= 30 ? KC.safety : KC.muted,
                        }}
                      >
                        D+{row.daysOpen}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-2 text-[12px]" style={{ color: KC.muted }}>
              {t('overview.todo.more', {
                n: Math.max(0, openRiskTotal - todo.length),
              })}
            </div>
          </KcCard>
        </div>

        <div className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2">
          <KcCard
            icon={<Grid3x3 size={15} />}
            title={t('overview.assetFleet')}
            to="/mro2/assets"
          >
            {/* 상태 분포 한 줄 + 관심 자산(점검 지연·건강도 낮은 순) */}
            <div
              className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]"
              style={{ color: KC.muted }}
            >
              {(
                [
                  ['operating', summary.operating, KC.ok],
                  ['repair', summary.repair, KC.safety],
                  ['inspection', summary.inspection, KC.undetermined],
                  ['idle', summary.idle, KC.planned],
                ] as const
              ).map(([key, n, color]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: n > 0 ? color : KC.border }}
                  />
                  {t(
                    `assets.status${key.charAt(0).toUpperCase()}${key.slice(1)}`,
                  )}{' '}
                  <span className="font-bold" style={{ color: KC.ink }}>
                    {n}
                  </span>
                </span>
              ))}
              <span className="ml-auto">
                {t('overview.fleet.total', { n: summary.total })}
              </span>
            </div>
            <ul className="flex flex-col">
              {watch.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/mro2/assets/${w.id}`}
                    className="kc-hover flex items-center gap-3 border-t py-1.5 text-[13px]"
                    style={{ borderColor: KC.hairline, color: KC.ink }}
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {w.name}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        color:
                          w.healthPct != null && w.healthPct <= 40
                            ? KC.production
                            : KC.muted,
                      }}
                    >
                      {w.healthPct != null
                        ? t('overview.fleet.health', { pct: w.healthPct })
                        : ''}
                    </span>
                    <span
                      className="w-24 text-right font-bold tabular-nums"
                      style={{
                        color: w.overdueDays > 0 ? KC.safety : KC.faint,
                      }}
                    >
                      {w.overdueDays > 0
                        ? t('assets.card.overdue', { n: w.overdueDays })
                        : '-'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </KcCard>

          <KcCard
            icon={<LayoutList size={15} />}
            title={t('overview.serviceRequests')}
            to="/mro2/service-requests"
          >
            <div
              className="mb-2 flex items-center gap-1 text-[11px]"
              style={{ color: KC.faint }}
            >
              <Clock size={11} /> {year}
            </div>
            <div className="flex items-start justify-around">
              <KcStat value={openWos} label={t('overview.open')} tone={KC.s1} />
              <KcStat
                value={completedWos}
                label={t('overview.completed')}
                tone={KC.ok}
              />
              <KcStat
                value={overdueWos}
                label={t('overview.overdue')}
                tone={KC.safety}
              />
            </div>
          </KcCard>

          <KcCard
            icon={<PieChart size={15} />}
            title={t('overview.spend')}
            to="/mro2/spend"
          >
            <div
              className="mb-2 flex items-center gap-1 text-[11px]"
              style={{ color: KC.faint }}
            >
              <Clock size={11} /> {year}
            </div>
            <div className="flex items-center gap-4">
              <KcDonut
                size={72}
                stroke={13}
                segments={SPEND_TYPES.map((s) => ({
                  value: spend.byType[s.key],
                  color: s.color,
                  label: `${t(`spendType.${s.key}`)} — ${usd(spend.byType[s.key])}`,
                }))}
              />
              <div className="flex-1">
                <div className="mb-1 text-[11px]" style={{ color: KC.muted }}>
                  {t('overview.spendByType')}
                </div>
                <div className="flex items-start justify-between pr-2">
                  <KcStat
                    value={`${spendPct('ipm')}%`}
                    label={t('overview.ipmShort')}
                    tone={KC.s1}
                  />
                  <KcStat
                    value={`${spendPct('planned')}%`}
                    label={t('overview.plannedRepairs')}
                    tone={KC.s4}
                  />
                  <KcStat
                    value={`${spendPct('oncall')}%`}
                    label={t('overview.onCallService')}
                    tone={KC.safety}
                  />
                </div>
              </div>
            </div>
          </KcCard>

          <KcCard
            icon={<Wrench size={15} />}
            title={t('overview.inventoryCard')}
            to="/mro2/inventory"
          >
            <div className="flex items-start justify-around">
              <KcStat
                value={invSummary.lowStock}
                label={t('overview.lowStock')}
                tone={KC.production}
              />
              <KcStat
                value={invSummary.activePOs}
                label={t('overview.activePOs')}
                tone={KC.s1}
              />
            </div>
            <div
              className="mt-2 text-center text-[11px]"
              style={{ color: KC.muted }}
            >
              {t('overview.stockValue', { value: usd(invSummary.totalValue) })}
            </div>
          </KcCard>
        </div>
      </div>
    </div>
  );
}
