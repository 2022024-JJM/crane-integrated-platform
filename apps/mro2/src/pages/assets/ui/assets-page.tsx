import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileSpreadsheet, MapPin, Plus, Wifi, X } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useOpenRisks } from '@crane/features/risk';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import type { CraneAsset } from '@crane/domain/asset';
import { KC, KC_FONT_MONO } from '../../../shared/ui/kc';
import { KcButton, KcFilterChip, KcFilterGroup, KcFilterRail, KcSectionHeading } from '../../../shared/ui/kc-ui';
import { useTranslation } from 'react-i18next';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
} from '../../../shared/lib/service-status';
import { SERVICE_TONE_COLOR } from '../../../shared/ui/kc';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import { useOwnLabels } from '../../../shared/lib/own-labels';
import { assetCriticality, type AssetCriticality } from '../lib/asset-criticality';
import { useMro2Year } from '../../../shared/ui/layout';
import { downloadCsv } from '../../../shared/lib/export-csv';
import {
  ASSET_REPORT_KEYS,
  assetReportToCsv,
  buildAssetReport,
  type AssetReportKey,
} from '../lib/build-asset-report';
import { CraneThumb } from './crane-thumb';

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
  const [criticalityFilter, setCriticalityFilter] = useState<AssetCriticality | null>(null);
  const [labelFilters, setLabelFilters] = useState<Set<string>>(new Set());
  const { allLabels, labelsFor, addLabel, removeLabel } = useOwnLabels();
  const [newLabel, setNewLabel] = useState('');
  const { year } = useMro2Year();
  const [reportOpen, setReportOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭으로 리포트 메뉴 닫기
  useEffect(() => {
    if (!reportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!reportRef.current?.contains(e.target as Node)) setReportOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [reportOpen]);

  const exportReport = (key: AssetReportKey) => {
    const report = buildAssetReport(key, {
      risks: [...safety, ...production],
      inspections,
      repairs,
      year,
    });
    downloadCsv(`${key}-${year}.csv`, assetReportToCsv(report));
    setReportOpen(false);
  };

  const selectedId = searchParams.get('asset');
  const selected = assets.find((a) => a.id === selectedId) ?? null;
  const open = selected !== null;

  // 마지막으로 열렸던 자산 — 닫히는 300ms 동안 패널 내용이 유지되도록 렌더 소스로 쓴다.
  // (열림 중엔 selected 가 우선이므로 지연 초기화가 필요 없다 → 이펙트 없이 상태만 유지)
  const [lastSelected, setLastSelected] = useState<CraneAsset | null>(selected);
  const displayed = selected ?? lastSelected;

  const filtered = assets.filter((a) => {
    if (query && !a.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    if (criticalityFilter && assetCriticality(a) !== criticalityFilter) return false;
    if (labelFilters.size > 0 && !labelsFor(a.id).some((l) => labelFilters.has(l))) return false;
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
        const tone = inspectionTone(w.status, w.scheduledDate);
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
  }, [inspections, repairs, t]);

  // 카드 클릭 = 토글: 같은 카드를 다시 누르면 패널이 닫힌다
  const toggleSlideout = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (selectedId === id) {
      next.delete('asset');
    } else {
      next.set('asset', id);
      const asset = assets.find((a) => a.id === id) ?? null;
      if (asset) setLastSelected(asset);
    }
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
          selectedCount={(statusFilter ? 1 : 0) + (criticalityFilter ? 1 : 0) + labelFilters.size}
          onClear={() => {
            setStatusFilter(null);
            setCriticalityFilter(null);
            setLabelFilters(new Set());
            setQuery('');
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchAssets')}
            className="w-full border px-2 py-1 text-[11px]"
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
            {(['high', 'moderate', 'low'] as const).map((c) => (
              <KcFilterChip
                key={c}
                label={t(`assets.${c}`)}
                active={criticalityFilter === c}
                onClick={() => setCriticalityFilter(criticalityFilter === c ? null : c)}
              />
            ))}
          </KcFilterGroup>
          {allLabels.length > 0 ? (
            <KcFilterGroup title={t('assets.ownLabels')}>
              {allLabels.map((label) => (
                <KcFilterChip
                  key={label}
                  label={label}
                  active={labelFilters.has(label)}
                  onClick={() =>
                    setLabelFilters((prev) => {
                      const next = new Set(prev);
                      if (next.has(label)) next.delete(label);
                      else next.add(label);
                      return next;
                    })
                  }
                />
              ))}
            </KcFilterGroup>
          ) : null}
        </KcFilterRail>
      </div>

      {/* 플릿 그리드 */}
      <div className="min-w-0 flex-1">
        <KcSectionHeading
          right={
            <div className="relative" ref={reportRef}>
            <KcButton variant="teal" onClick={() => setReportOpen((v) => !v)}>
              <FileSpreadsheet size={13} /> {t('common.assetReports')}
            </KcButton>
            {reportOpen ? (
              <div
                className="absolute right-0 z-30 mt-1 w-[220px] border shadow-lg"
                style={{ borderColor: KC.border, background: KC.bg }}
              >
                {ASSET_REPORT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => exportReport(key)}
                    className="kc-hover block w-full cursor-pointer px-3 py-2 text-left text-[11.5px]"
                    style={{ color: KC.ink }}
                  >
                    {t(`assets.report.${key}`)}
                  </button>
                ))}
              </div>
            ) : null}
            </div>
          }
        >
          {t('assets.nAssets', { count: filtered.length })}
        </KcSectionHeading>

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
                  {t('assets.labels', { count: 4 + labelsFor(displayed.id).length })}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[displayed.siteName, displayed.craneType, displayed.indoorOutdoor, t(`assets.${assetCriticality(displayed)}`)].map(
                    (l) => (
                      <span key={l} className="px-1.5 py-0.5 text-[9.5px]" style={{ background: KC.bgRow, color: KC.text }}>
                        {l}
                      </span>
                    ),
                  )}
                  {labelsFor(displayed.id).map((l) => (
                    <span
                      key={`own-${l}`}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[9.5px]"
                      style={{ background: KC.bgRow, color: KC.text, borderLeft: `3px solid ${KC.accent}` }}
                    >
                      {l}
                      <button
                        type="button"
                        aria-label={t('assets.removeLabel', { label: l })}
                        onClick={() => removeLabel(displayed.id, l)}
                        className="cursor-pointer"
                        style={{ color: KC.muted }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <form
                  className="mt-1.5 flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newLabel.trim()) {
                      addLabel(displayed.id, newLabel);
                      setNewLabel('');
                    }
                  }}
                >
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder={t('assets.addLabel')}
                    maxLength={24}
                    className="min-w-0 flex-1 border px-1.5 py-0.5 text-[10px]"
                    style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
                  />
                  <button
                    type="submit"
                    className="cursor-pointer px-1.5 py-0.5 text-[10px]"
                    style={{ background: KC.bgRow, color: KC.text }}
                  >
                    +
                  </button>
                </form>
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
