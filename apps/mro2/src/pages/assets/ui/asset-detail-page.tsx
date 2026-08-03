import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronUp, Plus, Wifi } from 'lucide-react';
import { useAssetDetail } from '@crane/features/asset';
import { useOpenRisks } from '@crane/features/risk';
import type { CraneComponent } from '@crane/domain/asset';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO, SERVICE_TONE_COLOR } from '../../../shared/ui/kc';
import { KcButton, KcRing, KcStat } from '../../../shared/ui/kc-ui';
import { i18n } from '@crane/core/config/i18n';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
} from '../../../shared/lib/service-status';
import { COMPONENT_STATUS_COLOR, remainingPct } from '../../../shared/lib/component';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import { CraneThumb } from './crane-thumb';
import { CraneFrontView } from './crane-front-view';

const Asset3dTab = lazy(() =>
  import('./asset-3d-tab').then((m) => ({ default: m.Asset3dTab })),
);

const TABS = [
  { key: 'open', labelKey: 'detail.tabOpenItems' },
  { key: 'activity', labelKey: 'detail.tabActivities' },
  { key: '3d', labelKey: 'detail.tab3d' },
  { key: 'monitoring', labelKey: 'detail.tabMonitoring' },
  { key: 'info', labelKey: 'detail.tabInfo' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function Mro2AssetDetailPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const { craneId = '' } = useParams<{ craneId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openTicket } = useNewTicket();
  const { asset, components, inspections, repairs } = useAssetDetail(craneId);
  const { safety, production } = useOpenRisks();

  const tab = (searchParams.get('tab') as TabKey | null) ?? 'open';
  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (t === 'open') next.delete('tab');
    else next.set('tab', t);
    setSearchParams(next);
  };

  if (!asset) {
    return (
      <div className="pt-8 text-center text-[13px]" style={{ color: KC.muted }}>
        {t('mro2:assets.notFound')}{' '}
        <Link to="/mro2/assets" style={{ color: KC.link }}>
          {t('mro2:assets.backToFleet')}
        </Link>
      </div>
    );
  }

  const safetyCount = safety.filter((r) => r.craneId === craneId).length;
  const productionCount = production.filter((r) => r.craneId === craneId).length;
  const openInspections = inspections.filter(
    (w) => w.status !== 'completed' && w.status !== 'cancelled',
  );
  const openRepairs = repairs.filter((w) => w.status !== 'completed');
  const openWoCount = openInspections.length + openRepairs.length;

  return (
    <div className="pt-1">
      <Link to="/mro2/assets" className="mb-2 flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
        <ChevronLeft size={14} /> {t('mro2:common.back')}
      </Link>

      {/* 헤더 + 탭 */}
      <div className="flex flex-wrap items-center gap-4 border-b" style={{ borderColor: KC.border }}>
        <div className="flex items-center gap-2.5 pb-2">
          <CraneThumb craneType={asset.craneType} size={42} />
          <div>
            <div className="text-[16px] font-bold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
              {asset.name}
            </div>
            <div className="text-[10.5px]" style={{ color: KC.muted }}>
              {asset.model}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 items-end gap-5 self-end text-[12px]">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              type="button"
              onClick={() => setTab(tabDef.key)}
              className="cursor-pointer pb-2"
              style={{
                color: KC.ink,
                fontWeight: tab === tabDef.key ? 700 : 400,
                borderBottom: tab === tabDef.key ? `2px solid ${KC.ink}` : '2px solid transparent',
              }}
            >
              {t(`mro2:${tabDef.labelKey}`)}
            </button>
          ))}
        </nav>
        <div className="pb-2">
          <KcButton variant="teal" onClick={() => openTicket('repair', craneId)}>
            <Plus size={12} /> {t('mro2:common.newServiceRequest')}
          </KcButton>
        </div>
      </div>

      {/* ── Open Items ── */}
      {tab === 'open' ? (
        <div className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px]" style={{ color: KC.ink }}>
              {t('mro2:detail.openItemsNow')}
            </h3>
          </div>
          <div className="mb-5 flex items-start gap-8">
            <KcStat value={safetyCount + productionCount + openWoCount} label={t('mro2:common.openItems')} size="lg" />
            <KcStat value={safetyCount} label={t('mro2:detail.safetyRisks')} tone={KC.safety} />
            <KcStat value={productionCount} label={t('mro2:detail.productionRisks')} tone={KC.production} />
            <KcStat value={openWoCount} label={t('mro2:common.openWos')} tone={KC.planned} />
          </div>
          <WoTimeline
            inspections={openInspections}
            repairs={openRepairs}
            navigate={(p) => navigate(p)}
          />
          {openWoCount === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: KC.muted }}>
              {t('mro2:detail.noOpenItems')}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── All Activities ── */}
      {tab === 'activity' ? (
        <div className="pt-4">
          <h3 className="mb-3 text-[13px]" style={{ color: KC.ink }}>
            {t('mro2:common.activities', { count: inspections.length + repairs.length })}
          </h3>
          <WoTimeline inspections={inspections} repairs={repairs} navigate={(p) => navigate(p)} />
        </div>
      ) : null}

      {/* ── 3D View ── */}
      {tab === '3d' ? (
        <Suspense
          fallback={
            <div className="py-16 text-center text-[12px]" style={{ color: KC.muted }}>
              {t('mro2:detail.loading3d')}
            </div>
          }
        >
          <Asset3dTab asset={asset} components={components} />
        </Suspense>
      ) : null}

      {/* ── Remote Monitoring ── */}
      {tab === 'monitoring' ? <MonitoringTab components={components} /> : null}

      {/* ── Asset Info ── */}
      {tab === 'info' ? (
        <div className="grid grid-cols-1 items-stretch gap-6 pt-4 lg:grid-cols-2">
          {/* 제원 표 */}
          <div className="min-w-0">
            <InfoRow k={t('mro2:info.manufacturer')} v={asset.manufacturer} />
            <InfoRow k={t('mro2:info.model')} v={asset.model} />
            <InfoRow k={t('mro2:info.serialNumber')} v={asset.serialNumber} />
            <InfoRow k={t('mro2:info.capacity')} v={`${asset.capacityTon} t`} />
            {asset.spanM ? <InfoRow k={t('mro2:info.span')} v={`${asset.spanM} m`} /> : null}
            {asset.liftHeightM ? <InfoRow k={t('mro2:info.liftHeight')} v={`${asset.liftHeightM} m`} /> : null}
            <InfoRow k={t('mro2:info.manufactureDate')} v={fmtDate(asset.manufactureDate)} />
            <InfoRow k={t('mro2:info.installationDate')} v={fmtDate(asset.installationDate)} />
            <InfoRow k={t('mro2:info.warranty')} v={`${fmtDate(asset.warrantyStart)} – ${fmtDate(asset.warrantyEnd)}`} />
            <InfoRow k={t('mro2:info.site')} v={asset.siteName} />
            <InfoRow k={t('mro2:info.location')} v={asset.locationZone} />
            <InfoRow k={t('mro2:info.indoorOutdoor')} v={asset.indoorOutdoor} />
            <InfoRow k={t('mro2:info.oshaClassification')} v={asset.oshaClassification} />
            <InfoRow k={t('mro2:info.status')} v={asset.status} />
          </div>

          {/* 정면 3D 뷰 — 우측 절반을 꽉 채운다 (높이는 좌측 표에 맞춰 늘어남) */}
          <div className="min-w-0">
            <CraneFrontView
              craneType={asset.craneType}
              caption={t('mro2:info.frontViewCaption', { name: asset.name })}
              fill
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex border-b py-1.5 text-[11.5px]" style={{ borderColor: KC.hairline }}>
      <span className="w-[180px] shrink-0 font-bold" style={{ color: KC.ink }}>
        {k}
      </span>
      <span style={{ color: KC.text }}>{v}</span>
    </div>
  );
}

/* WO 타임라인 (Open Items / All Activities 공용) */
function WoTimeline({
  inspections,
  repairs,
  navigate,
}: {
  inspections: ReturnType<typeof useAssetDetail>['inspections'];
  repairs: ReturnType<typeof useAssetDetail>['repairs'];
  navigate: (path: string) => void;
}) {
  const rows = [
    ...inspections.map((w) => ({
      key: `i-${w.id}`,
      date: w.actualDate ?? w.scheduledDate,
      tone: SERVICE_TONE_COLOR[inspectionTone(w.status, w.scheduledDate)],
      statusLabel: i18n.t('mro2:detail.srOf', { status: serviceToneLabel(inspectionTone(w.status, w.scheduledDate)) }),
      woNumber: w.woNumber,
      subtitle: i18n.t('mro2:detail.typeInspection', { type: i18n.t(`calendar:type.${w.woType}`) }),
      path: `/mro2/service-requests/inspection/${w.id}`,
      findings: w.checklistItems
        .filter((c) => c.judgment === 'fail')
        .map((c) => ({ name: c.itemName, tone: c.severity === 'critical' || c.severity === 'major' ? KC.safety : KC.production })),
    })),
    ...repairs.map((w) => ({
      key: `r-${w.id}`,
      date: w.actualEnd ?? w.scheduledStart,
      tone: SERVICE_TONE_COLOR[repairTone(w.status, w.scheduledEnd)],
      statusLabel: i18n.t('mro2:detail.repairOf', { status: serviceToneLabel(repairTone(w.status, w.scheduledEnd)) }),
      woNumber: w.woNumber,
      subtitle: w.componentName,
      path: `/mro2/service-requests/repair/${w.id}`,
      findings: [] as { name: string; tone: string }[],
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <div key={row.key} className="flex gap-3">
          <div className="w-[64px] shrink-0 pt-2 text-right text-[10px]" style={{ color: KC.faint }}>
            {fmtDate(row.date)}
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate(row.path)}
            onKeyDown={(e) => (e.key === 'Enter' ? navigate(row.path) : undefined)}
            className="kc-hover mb-2 flex-1 cursor-pointer border"
            style={{ borderColor: KC.hairline, borderLeft: `4px solid ${row.tone}` }}
          >
            <div className="px-3 py-2">
              <div className="text-[10px]" style={{ color: KC.faint, fontFamily: KC_FONT_MONO }}>
                🔧 {row.woNumber}
              </div>
              <div className="text-[12px] font-bold" style={{ color: KC.ink }}>
                {row.statusLabel}
              </div>
              <div className="text-[10.5px]" style={{ color: KC.muted }}>
                {row.subtitle}
              </div>
            </div>
            {row.findings.length > 0 ? (
              <div className="border-t" style={{ borderColor: KC.hairline }}>
                {row.findings.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-1 text-[10.5px]"
                    style={{ borderLeft: `3px solid ${f.tone}`, color: KC.text }}
                  >
                    {f.name}
                    <span style={{ color: KC.faint }}>{i18n.t('mro2:common.quote')} ⌄</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Monitoring 탭 — Condition 클러스터 아코디언 + 요약 */
function MonitoringTab({ components }: { components: CraneComponent[] }) {
  const { t } = useTranslation('mro2');
  const clusters = components.filter((c) => c.parentId === null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const worst = clusters.reduce<CraneComponent | null>((acc, c) => {
    if (!acc) return c;
    return remainingPct(c) < remainingPct(acc) ? c : acc;
  }, null);
  const criticalCount = components.filter(
    (c) => c.parentId !== null && (c.status === 'critical' || c.status === 'replace'),
  ).length;
  const totalHours = clusters.reduce((s, c) => s + c.currentHours, 0);

  const toggle = (id: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="pt-4">
      <div className="mb-1 flex items-center gap-2 border-b pb-1.5" style={{ borderColor: KC.borderStrong }}>
        <span className="text-[14px]" style={{ color: KC.ink }}>
          {t('common.remoteMonitoring')}
        </span>
        <Wifi size={14} style={{ color: KC.ink }} />
      </div>
      <div className="mb-4 text-[11px]" style={{ color: KC.muted }}>
        {t('monitoring.summary')}
      </div>

      {/* 3-메트릭 요약 (17p) */}
      <div className="mb-6 flex items-start justify-around">
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10.5px]" style={{ color: KC.muted }}>
            {t('monitoring.condition')}
          </div>
          <KcRing
            pct={worst ? remainingPct(worst) : 0}
            color={worst && remainingPct(worst) < 30 ? KC.safety : KC.ok}
            size={56}
            stroke={6}
          >
            <span className="text-[11px] font-bold" style={{ color: KC.ink }}>
              {worst ? `${remainingPct(worst)}%` : '-'}
            </span>
          </KcRing>
          <div className="text-center text-[10px]" style={{ color: KC.text }}>
            {worst?.componentName ?? '-'}
            <div style={{ color: KC.faint }}>{t('monitoring.shortestServiceLife')}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10.5px]" style={{ color: KC.muted }}>
            {t('monitoring.alerts')}
          </div>
          <div
            className="flex items-center justify-center rounded-full text-[15px] font-bold text-white"
            style={{ background: KC.safety, width: 48, height: 48 }}
          >
            {criticalCount}
          </div>
          <div className="text-center text-[10px]" style={{ color: KC.text }}>
            {t('monitoring.criticalComponents')}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10.5px]" style={{ color: KC.muted }}>
            {t('monitoring.operatingStatistics')}
          </div>
          <div className="text-[26px] font-bold" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {totalHours.toLocaleString('en-US')}
          </div>
          <div className="text-center text-[10px]" style={{ color: KC.text }}>
            {t('monitoring.hours')}
            <div style={{ color: KC.faint }}>{t('monitoring.total')}</div>
          </div>
        </div>
      </div>

      {/* Condition 아코디언 */}
      <div className="mb-2 flex items-center justify-between border-b pb-1" style={{ borderColor: KC.borderStrong }}>
        <span className="text-[13px]" style={{ color: KC.ink }}>
          {t('monitoring.condition')}
        </span>
        <button
          type="button"
          className="cursor-pointer text-[11px]"
          style={{ color: KC.link }}
          onClick={() => setExpandAll((v) => !v)}
        >
          {expandAll ? t('common.collapseAll') : t('common.expandAll')}
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {clusters.map((cluster) => {
          const leaves = components.filter((c) => c.parentId === cluster.id);
          const open = expandAll || openKeys.has(cluster.id);
          return (
            <div key={cluster.id} className="border" style={{ borderColor: KC.hairline }}>
              <button
                type="button"
                onClick={() => toggle(cluster.id)}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left"
                style={{
                  borderLeft: `4px solid ${COMPONENT_STATUS_COLOR[cluster.status]}`,
                  background: KC.bgSubtle,
                }}
              >
                <span className="text-[11.5px]" style={{ color: KC.ink }}>
                  {cluster.componentName}
                </span>
                <span className="flex items-center gap-3 text-[10px]" style={{ color: KC.muted }}>
                  {t('monitoring.serviceLife', { pct: remainingPct(cluster) })}
                  {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
              </button>
              {open ? (
                <div className="px-3 py-2">
                  {leaves.slice(0, 12).map((leaf) => (
                    <div
                      key={leaf.id}
                      className="flex items-center gap-2 border-b py-1 text-[10.5px] last:border-b-0"
                      style={{ borderColor: KC.hairline }}
                    >
                      <span
                        className="inline-block h-3 w-[3px]"
                        style={{ background: COMPONENT_STATUS_COLOR[leaf.status] }}
                      />
                      <span className="min-w-0 flex-1 truncate" style={{ color: KC.text }}>
                        {leaf.componentName}
                      </span>
                      <span className="w-[110px]">
                        <span className="block h-[5px] w-full" style={{ background: KC.track }}>
                          <span
                            className="block h-full"
                            style={{
                              width: `${remainingPct(leaf)}%`,
                              background: remainingPct(leaf) < 25 ? KC.safety : KC.s1,
                            }}
                          />
                        </span>
                      </span>
                      <span className="w-[36px] text-right" style={{ color: KC.muted }}>
                        {remainingPct(leaf)}%
                      </span>
                    </div>
                  ))}
                  {leaves.length > 12 ? (
                    <div className="pt-1 text-[10px]" style={{ color: KC.faint }}>
                      {t('monitoring.moreComponents', { count: leaves.length - 12 })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Operating Statistics */}
      <div className="mt-6 mb-2 border-b pb-1 text-[13px]" style={{ borderColor: KC.borderStrong, color: KC.ink }}>
        {t('monitoring.operatingStatistics')}
      </div>
      <div className="flex flex-col gap-1">
        {[...clusters]
          .sort((a, b) => b.currentHours - a.currentHours)
          .slice(0, 6)
          .map((c) => {
            const max = Math.max(...clusters.map((x) => x.currentHours), 1);
            return (
              <div key={c.id} className="flex items-center gap-2 text-[10.5px]">
                <span className="w-[170px] shrink-0 truncate" style={{ color: KC.text }}>
                  {c.componentName}
                </span>
                <span className="h-[10px] flex-1" style={{ background: KC.track }}>
                  <span
                    className="block h-full"
                    style={{ width: `${(c.currentHours / max) * 100}%`, background: KC.s3 }}
                  />
                </span>
                <span className="w-[64px] text-right" style={{ color: KC.muted }}>
                  {c.currentHours.toLocaleString('en-US')} h
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
