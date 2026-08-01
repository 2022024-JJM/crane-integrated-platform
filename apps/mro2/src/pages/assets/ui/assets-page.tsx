import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileSpreadsheet, MapPin, Plus, Wifi, X } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useOpenRisks } from '@crane/features/risk';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import type { CraneAsset } from '@crane/domain/asset';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO } from '../../../shared/ui/kc';
import { KcButton, KcFilterChip, KcFilterGroup, KcFilterRail } from '../../../shared/ui/kc-ui';
import { useTranslation } from 'react-i18next';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
} from '../../../shared/lib/service-status';
import { SERVICE_TONE_COLOR } from '../../../shared/ui/kc';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import { CraneThumb } from './crane-thumb';

export function assetCriticality(asset: CraneAsset): 'high' | 'moderate' {
  return asset.capacityTon >= 300 ? 'high' : 'moderate';
}

interface ActivityLine {
  key: string;
  title: string;
  subtitle: string;
  date: string;
  tone: string;
}

export function Mro2AssetsPage() {
  const { t } = useTranslation('mro2');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { openTicket } = useNewTicket();
  const { assets } = useAssetList();
  const { safety, production } = useOpenRisks();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const selectedId = searchParams.get('asset');
  const selected = assets.find((a) => a.id === selectedId) ?? null;
  const open = selected !== null;

  // 닫히는 동안에도 내용이 유지되도록 마지막 선택 자산을 잠시 보관 (슬라이드 아웃 애니메이션용)
  const [displayed, setDisplayed] = useState<CraneAsset | null>(selected);
  useEffect(() => {
    if (selected) {
      setDisplayed(selected);
      return;
    }
    const timer = setTimeout(() => setDisplayed(null), 300);
    return () => clearTimeout(timer);
  }, [selected]);

  const filtered = assets.filter((a) => {
    if (query && !a.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  const openWoCount = (craneId: string) =>
    inspections.filter(
      (w) => w.craneId === craneId && w.status !== 'completed' && w.status !== 'cancelled',
    ).length + repairs.filter((w) => w.craneId === craneId && w.status !== 'completed').length;

  const activityFor = useMemo(() => {
    return (craneId: string): ActivityLine[] => {
      const lines: ActivityLine[] = [];
      for (const r of repairs.filter((w) => w.craneId === craneId)) {
        const tone = repairTone(r.status, r.scheduledEnd);
        lines.push({
          key: `r-${r.id}`,
          title: r.status === 'completed' ? t('common.repaired') : t('detail.repairOf', { status: serviceToneLabel(tone) }),
          subtitle: r.componentName,
          date: r.actualEnd ?? r.scheduledStart,
          tone: SERVICE_TONE_COLOR[tone],
        });
      }
      for (const w of inspections.filter((i) => i.craneId === craneId)) {
        const tone = inspectionTone(w.status);
        lines.push({
          key: `i-${w.id}`,
          title: t('detail.inspectionOf', { status: serviceToneLabel(tone) }),
          subtitle: w.woNumber,
          date: w.actualDate ?? w.scheduledDate,
          tone: SERVICE_TONE_COLOR[tone],
        });
      }
      return lines
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspections, repairs, t]);

  // 카드 클릭 = 토글: 같은 카드를 다시 누르면 패널이 닫힌다
  const toggleSlideout = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (selectedId === id) next.delete('asset');
    else next.set('asset', id);
    setSearchParams(next);
  };
  const closeSlideout = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('asset');
    setSearchParams(next);
  };

  return (
    <div className="flex gap-6 pt-2">
      {/* 필터 레일 */}
      <div className="hidden lg:block">
        <div className="mb-2">
          <Link to="/mro2" className="flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
            <ChevronLeft size={14} /> {t('common.back')}
          </Link>
        </div>
        <KcFilterRail
          selectedCount={statusFilter ? 1 : 0}
          onClear={() => {
            setStatusFilter(null);
            setQuery('');
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchAssets')}
            className="w-full border px-2 py-1 text-[11px] outline-none"
            style={{ borderColor: KC.border, color: KC.ink }}
          />
          <KcFilterGroup title={t('common.selectedCustomers')}>
            <div className="w-full px-2 py-1.5 text-[10.5px] leading-snug" style={{ background: KC.inverseBg, color: KC.inverseText }}>
              {t('common.customerName')}
              <div style={{ color: KC.inverseMuted }}>{t('common.customerAddress')}</div>
            </div>
          </KcFilterGroup>
          <KcFilterGroup title={t('assets.assetStatus')}>
            {(['operating', 'repair', 'inspection', 'idle'] as const).map((s) => (
              <KcFilterChip
                key={s}
                label={t(`assets.status${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                active={statusFilter === s}
                onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              />
            ))}
          </KcFilterGroup>
          <KcFilterGroup title={t('assets.assetCriticality')}>
            <KcFilterChip label={t('assets.high')} />
            <KcFilterChip label={t('assets.moderate')} />
            <KcFilterChip label={t('assets.low')} />
          </KcFilterGroup>
        </KcFilterRail>
      </div>

      {/* 플릿 그리드 */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {t('assets.nAssets', { count: filtered.length })}
          </h2>
          <KcButton variant="teal" onClick={() => window.print()}>
            <FileSpreadsheet size={13} /> {t('common.assetReports')}
          </KcButton>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => {
            const s = safety.filter((r) => r.craneId === a.id).length;
            const p = production.filter((r) => r.craneId === a.id).length;
            const open = openWoCount(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleSlideout(a.id)}
                className="kc-hover cursor-pointer border text-left transition-shadow hover:shadow-md"
                style={{
                  borderColor: selectedId === a.id ? KC.ink : KC.border,
                  background: KC.bg,
                }}
              >
                <div className="px-3 pt-3">
                  <div className="truncate text-[13px] font-bold" style={{ color: KC.ink }}>
                    {a.name}
                  </div>
                  <div className="truncate text-[10.5px]" style={{ color: KC.muted }}>
                    {a.model}
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 pt-2 pb-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11px]" style={{ color: KC.muted }}>
                    <span>⚖ {a.capacityTon}</span>
                    <span className="flex items-center gap-1">
                      <Wifi size={12} /> {t('common.remoteMonitoring')}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {a.locationZone}
                    </span>
                  </div>
                  <CraneThumb craneType={a.craneType} size={112} />
                </div>
                <div className="mt-1 flex items-center justify-end px-3 pb-1 text-[9.5px]" style={{ color: KC.faint }}>
                  {t('common.openItems')}
                </div>
                <div className="grid grid-cols-3 border-t text-center" style={{ borderColor: KC.hairline }}>
                  <div className="flex flex-col items-center border-r py-1.5" style={{ borderColor: KC.hairline }}>
                    <span className="text-[13px] font-bold" style={{ color: KC.ink }}>
                      {s}
                    </span>
                    <span className="border-t-2 px-1 text-[9.5px]" style={{ borderColor: KC.safety, color: KC.muted }}>
                      {t('common.safety')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center border-r py-1.5" style={{ borderColor: KC.hairline }}>
                    <span className="text-[13px] font-bold" style={{ color: KC.ink }}>
                      {p}
                    </span>
                    <span
                      className="border-t-2 px-1 text-[9.5px]"
                      style={{ borderColor: KC.production, color: KC.muted }}
                    >
                      {t('common.production')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center py-1.5">
                    <span className="text-[13px] font-bold" style={{ color: KC.ink }}>
                      {open}
                    </span>
                    <span className="border-t-2 px-1 text-[9.5px]" style={{ borderColor: KC.planned, color: KC.muted }}>
                      {t('common.openWos')}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 우측 슬라이드아웃 요약 (?asset= URL 단일 소스) — 항상 마운트, transform으로 슬라이드 */}
      <aside
        aria-hidden={!open}
        className="fixed top-14 right-0 bottom-0 z-40 w-[300px] overflow-y-auto border-l shadow-xl transition-transform duration-300 ease-out"
        style={{
          borderColor: KC.border,
          background: KC.bg,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: open ? 'auto' : 'none',
          willChange: 'transform',
        }}
      >
        {displayed ? (
          <>
            <div className="flex items-start justify-between px-4 pt-4">
              <div className="flex items-center gap-2.5">
                <CraneThumb craneType={displayed.craneType} size={44} />
                <h3 className="text-[14px] font-bold" style={{ color: KC.ink }}>
                  {displayed.name}
                </h3>
              </div>
              <button type="button" aria-label="Close" onClick={closeSlideout} className="cursor-pointer">
                <X size={15} style={{ color: KC.ink }} />
              </button>
            </div>
            <div className="px-4 pb-4">
              <div className="mt-1 text-[11px]" style={{ color: KC.muted }}>
                {displayed.model}
              </div>
              <div className="mt-2">
                <KcButton variant="teal" onClick={() => openTicket('repair', displayed.id)}>
                  <Plus size={12} /> {t('common.newServiceRequest')}
                </KcButton>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-[11px]" style={{ color: KC.text }}>
                <span>{displayed.manufacturer}</span>
                <span>⚖ {displayed.capacityTon}</span>
                <span>{t('assets.criticality', { level: t(`assets.${assetCriticality(displayed)}`) })}</span>
                <span className="flex items-center gap-1">
                  <Wifi size={11} /> {t('common.remoteMonitoring')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {displayed.locationZone}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 text-[10.5px] font-bold" style={{ color: KC.ink }}>
                  {t('assets.labels', { count: 4 })}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[displayed.siteName, displayed.craneType, displayed.indoorOutdoor, t(`assets.${assetCriticality(displayed)}`)].map(
                    (l) => (
                      <span key={l} className="px-1.5 py-0.5 text-[9.5px]" style={{ background: KC.bgRow, color: KC.text }}>
                        {l}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[11.5px] font-bold" style={{ color: KC.ink }}>
                  {t('assets.activitySummary')}
                </div>
                <div className="flex flex-col gap-1.5">
                  {activityFor(displayed.id).map((line) => (
                    <div
                      key={line.key}
                      className="border px-2 py-1.5"
                      style={{ borderColor: KC.hairline, borderLeft: `4px solid ${line.tone}` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold" style={{ color: KC.ink }}>
                          {line.title}
                        </span>
                        <span className="text-[9.5px]" style={{ color: KC.faint }}>
                          📅 {fmtDate(line.date)}
                        </span>
                      </div>
                      <div className="text-[10px]" style={{ color: KC.muted, fontFamily: KC_FONT_MONO }}>
                        {line.subtitle}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <KcButton
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => navigate(`/mro2/assets/${displayed.id}`)}
                >
                  {t('assets.viewAsset')}
                </KcButton>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
