import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Grid3x3,
  LayoutList,
  MapPin,
  PieChart,
  Wrench,
} from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useInspectionList } from '@crane/features/inspection';
import { useInventoryList } from '@crane/features/inventory';
import { useMaintenanceList } from '@crane/features/maintenance';
import { useOpenRisks } from '@crane/features/risk';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO, SERVICE_TONE_COLOR, usd } from '../../../shared/ui/kc';
import { KcCard, KcDonut, KcInfo, KcRing, KcStat } from '../../../shared/ui/kc-ui';
import { useMro2Year } from '../../../shared/ui/layout';
import { computeSpend, SPEND_TYPES, type SpendTypeKey } from '../../../shared/lib/spend';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
  yearOf,
} from '../../../shared/lib/service-status';

export function Mro2OverviewPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const navigate = useNavigate();
  const { year } = useMro2Year();
  const { safety, production } = useOpenRisks();
  const { assets, summary } = useAssetList();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const { summary: invSummary } = useInventoryList();

  const yearInspections = inspections.filter((w) => yearOf(w.scheduledDate) === year);
  const yearRepairs = repairs.filter((w) => yearOf(w.scheduledStart) === year);

  const serviceVisits = yearInspections.length + yearRepairs.length;
  const assetsServiced = new Set([
    ...yearInspections.map((w) => w.craneId),
    ...yearRepairs.map((w) => w.craneId),
  ]).size;
  const totalFindings = yearInspections.reduce(
    (n, w) => n + w.checklistItems.filter((c) => c.judgment === 'fail' || c.judgment === 'na').length,
    0,
  );

  const openWos =
    yearInspections.filter((w) => w.status === 'scheduled' || w.status === 'in_progress').length +
    yearRepairs.filter((w) => w.status !== 'completed').length;
  const completedWos =
    yearInspections.filter((w) => w.status === 'completed').length +
    yearRepairs.filter((w) => w.status === 'completed').length;
  const overdueWos = yearInspections.filter((w) => w.status === 'overdue').length;

  const spend = useMemo(() => computeSpend(inspections, repairs, year), [inspections, repairs, year]);
  const spendPct = (key: SpendTypeKey) =>
    spend.total > 0 ? Math.round((spend.byType[key] / spend.total) * 100) : 0;

  const monitored = assets.length; // 두 자산 모두 컴포넌트 트리(원격 모니터링) 보유
  const openRiskTotal = safety.length + production.length;

  // 최근 활동 — 점검·수리를 최신순으로 합쳐 카드 아래 전폭 타임라인에 표시
  const recent = useMemo(() => {
    const rows = [
      ...inspections.map((w) => ({
        key: `i-${w.id}`,
        path: `/mro2/service-requests/inspection/${w.id}`,
        date: w.actualDate ?? w.scheduledDate,
        tone: inspectionTone(w.status, w.scheduledDate),
        woNumber: w.woNumber,
        product: t('mro2:detail.typeInspection', { type: t(`calendar:type.${w.woType}`) }),
        craneName: w.craneName,
      })),
      ...repairs.map((w) => ({
        key: `r-${w.id}`,
        path: `/mro2/service-requests/repair/${w.id}`,
        date: w.actualEnd ?? w.scheduledStart,
        tone: repairTone(w.status, w.scheduledEnd),
        woNumber: w.woNumber,
        product: w.sourceType === 'breakdown' ? t('mro2:sr.onCallRepair') : t('mro2:sr.plannedRepairs'),
        craneName: w.craneName,
      })),
    ];
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 9);
  }, [inspections, repairs, t]);

  return (
    <div className="pt-2">
      {/* 본문 — 전폭 */}
      <div className="min-w-0">
        {/* 고객 컨텍스트 (기존 필터 레일 대체) */}
        <div className="mb-3 flex items-center gap-1.5 text-[11.5px]" style={{ color: KC.muted }}>
          <MapPin size={13} style={{ color: KC.accent }} />
          <span className="font-semibold" style={{ color: KC.ink }}>
            {t('common.customerName')}
          </span>
          · {t('common.customerAddress')}
        </div>

        {/* SERVICE - OPEN ITEMS — 가운데 정렬 */}
        <div className="flex items-center justify-center gap-2">
          <h2
            className="text-[16px] font-semibold tracking-wider"
            style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
          >
            {t('overview.serviceOpenItems')}
          </h2>
          <KcInfo />
        </div>
        <div className="mt-3 mb-6 flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px]" style={{ color: KC.muted }}>
              {t('overview.openRisks')}
            </div>
            <KcDonut
              size={56}
              stroke={6}
              segments={
                openRiskTotal > 0
                  ? [
                      { value: safety.length, color: KC.safety },
                      { value: production.length, color: KC.production },
                    ]
                  : [{ value: 1, color: 'var(--kc-track)' }]
              }
            >
              <span className="text-[15px] font-bold" style={{ color: KC.ink }}>
                {openRiskTotal}
              </span>
            </KcDonut>
          </div>
          <KcStat value={safety.length} label={t('common.safety')} tone={KC.safety} size="lg" />
          <KcStat value={production.length} label={t('common.production')} tone={KC.production} size="lg" />
        </div>

        {/* SERVICE 섹션 */}
        <div className="mb-2 flex items-center justify-between">
          <div
            className="flex items-center gap-2 text-[15px] font-bold tracking-wider"
            style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
          >
            <Wrench size={15} />
            {t('overview.service')}
          </div>
          <KcInfo />
        </div>

        <div className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <KcCard icon={<Calendar size={15} />} title={t('overview.calendarCard')} to="/mro2/calendar">
            <div className="mb-2 flex items-center gap-1 text-[10px]" style={{ color: KC.faint }}>
              <Clock size={11} /> {year}
            </div>
            <div className="flex items-start justify-around">
              <KcStat value={serviceVisits} label={t('overview.serviceVisits')} />
              <KcStat value={assetsServiced} label={t('overview.assetsServiced')} />
              <KcStat value={totalFindings} label={t('overview.totalFindings')} />
            </div>
          </KcCard>

          <KcCard icon={<Grid3x3 size={15} />} title={t('overview.assetFleet')} to="/mro2/assets">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3 border px-2.5 py-1.5" style={{ borderColor: KC.hairline }}>
                <KcRing
                  pct={summary.total > 0 ? (summary.operating / summary.total) * 100 : 0}
                  color={KC.ok}
                  size={40}
                  stroke={5}
                >
                  <span className="text-[9px] font-bold" style={{ color: KC.ink }}>
                    {summary.total > 0 ? Math.round((summary.operating / summary.total) * 100) : 0}%
                  </span>
                </KcRing>
                <div className="text-[11px]" style={{ color: KC.ink }}>
                  {t('overview.operatingAssets')}
                  <div style={{ color: KC.muted }}>
                    {t('overview.nAssets', { n: summary.operating, total: summary.total })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 border px-2.5 py-1.5" style={{ borderColor: KC.hairline }}>
                <KcRing
                  pct={summary.total > 0 ? (monitored / summary.total) * 100 : 0}
                  color={KC.s1}
                  size={40}
                  stroke={5}
                >
                  <span className="text-[9px] font-bold" style={{ color: KC.ink }}>
                    {summary.total > 0 ? Math.round((monitored / summary.total) * 100) : 0}%
                  </span>
                </KcRing>
                <div className="text-[11px]" style={{ color: KC.ink }}>
                  {t('common.remoteMonitoring')}
                  <div style={{ color: KC.muted }}>
                    {t('overview.nAssets', { n: monitored, total: summary.total })}
                  </div>
                </div>
              </div>
            </div>
          </KcCard>

          <KcCard icon={<LayoutList size={15} />} title={t('overview.serviceRequests')} to="/mro2/service-requests">
            <div className="mb-2 flex items-center gap-1 text-[10px]" style={{ color: KC.faint }}>
              <Clock size={11} /> {year}
            </div>
            <div className="flex items-start justify-around">
              <KcStat value={openWos} label={t('overview.open')} tone={KC.s1} />
              <KcStat value={completedWos} label={t('overview.completed')} tone={KC.ok} />
              <KcStat value={overdueWos} label={t('overview.overdue')} tone={KC.safety} />
            </div>
          </KcCard>

          <KcCard icon={<PieChart size={15} />} title={t('overview.spend')} to="/mro2/spend">
            <div className="mb-2 flex items-center gap-1 text-[10px]" style={{ color: KC.faint }}>
              <Clock size={11} /> {year}
            </div>
            <div className="flex items-center gap-4">
              <KcDonut
                size={72}
                stroke={13}
                segments={SPEND_TYPES.map((s) => ({ value: spend.byType[s.key], color: s.color }))}
              />
              <div className="flex-1">
                <div className="mb-1 text-[10px]" style={{ color: KC.muted }}>
                  {t('overview.spendByType')}
                </div>
                <div className="flex items-start justify-between pr-2">
                  <KcStat value={`${spendPct('ipm')}%`} label={t('overview.ipmShort')} tone={KC.s1} />
                  <KcStat value={`${spendPct('planned')}%`} label={t('overview.plannedRepairs')} tone={KC.s4} />
                  <KcStat value={`${spendPct('oncall')}%`} label={t('overview.onCallService')} tone={KC.safety} />
                </div>
              </div>
            </div>
          </KcCard>

          <KcCard icon={<Wrench size={15} />} title={t('overview.inventoryCard')} to="/mro2/inventory">
            <div className="flex items-start justify-around">
              <KcStat value={invSummary.totalParts} label={t('overview.parts')} />
              <KcStat value={invSummary.lowStock} label={t('overview.lowStock')} tone={KC.production} />
              <KcStat value={invSummary.activePOs} label={t('overview.activePOs')} tone={KC.s1} />
            </div>
            <div className="mt-2 text-center text-[10px]" style={{ color: KC.muted }}>
              {t('overview.stockValue', { value: usd(invSummary.totalValue) })}
            </div>
          </KcCard>

          <KcCard icon={<Grid3x3 size={15} />} title={t('overview.assetsWithOpenItems')}>
            <div className="flex flex-col gap-1.5">
              {assets.map((a) => {
                const s = safety.filter((r) => r.craneId === a.id).length;
                const p = production.filter((r) => r.craneId === a.id).length;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border px-2.5 py-1.5 text-[11px]"
                    style={{ borderColor: KC.hairline }}
                  >
                    <span style={{ color: KC.ink }}>{a.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="border-b-2 px-0.5 font-bold" style={{ borderColor: KC.safety, color: KC.ink }}>
                        {s}
                      </span>
                      <span
                        className="border-b-2 px-0.5 font-bold"
                        style={{ borderColor: KC.production, color: KC.ink }}
                      >
                        {p}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </KcCard>
        </div>

        {/* 최근 활동 — 전폭 타임라인 (하단 공백 해소) */}
        <div className="mt-8 mb-2 flex items-center justify-between border-b pb-1.5" style={{ borderColor: KC.borderStrong }}>
          <h2
            className="flex items-center gap-2 text-[15px] font-semibold tracking-wide"
            style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
          >
            <LayoutList size={15} style={{ color: KC.accent }} />
            {t('overview.recentActivity')}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/mro2/service-requests')}
            className="cursor-pointer text-[11.5px]"
            style={{ color: KC.link }}
          >
            {t('overview.viewAll')} →
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          {recent.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => navigate(r.path)}
              className="kc-hover flex cursor-pointer items-center gap-3 rounded-[4px] border px-3 py-2 text-left"
              style={{ borderColor: KC.hairline, borderLeft: `4px solid ${SERVICE_TONE_COLOR[r.tone]}`, background: KC.bg }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-bold" style={{ color: KC.ink }}>
                    {serviceToneLabel(r.tone)}
                  </span>
                  <span className="truncate text-[10px]" style={{ color: KC.faint, fontFamily: KC_FONT_MONO }}>
                    {r.woNumber}
                  </span>
                </div>
                <div className="truncate text-[10.5px]" style={{ color: KC.muted }}>
                  {r.product} · {r.craneName}
                </div>
              </div>
              <span className="shrink-0 text-[9.5px]" style={{ color: KC.faint }}>
                {fmtDate(r.date)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
