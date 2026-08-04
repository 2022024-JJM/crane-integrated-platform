import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Plus, Wrench } from 'lucide-react';
import { useAssetList } from '@crane/features/asset';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { KC, KC_FONT_DISPLAY, KC_FONT_MONO, SERVICE_TONE_COLOR, type ServiceTone } from '../../../shared/ui/kc';
import { KcButton, KcFilterChip, KcFilterGroup, KcFilterRail } from '../../../shared/ui/kc-ui';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import { useTranslation } from 'react-i18next';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
  yearOf,
} from '../../../shared/lib/service-status';
import { useMro2Year } from '../../../shared/ui/layout';

interface SrRow {
  key: string;
  path: string;
  date: string;
  tone: ServiceTone;
  woNumber: string;
  product: string;
  /** 서비스 상품 필터 키 — 점검=woType, 수리=planned|oncall */
  productKey: string;
  craneId: string;
  craneName: string;
  siteName: string;
}

export function Mro2ServiceRequestsPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const navigate = useNavigate();
  const { openTicket } = useNewTicket();
  const { year } = useMro2Year();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const { assets } = useAssetList();
  const [statusFilters, setStatusFilters] = useState<Set<ServiceTone>>(new Set());
  const [productFilters, setProductFilters] = useState<Set<string>>(new Set());
  const [assetFilters, setAssetFilters] = useState<Set<string>>(new Set());

  const allRows: SrRow[] = [
    ...inspections
      .filter((w) => yearOf(w.scheduledDate) === year)
      .map((w) => ({
        key: `i-${w.id}`,
        path: `/mro2/service-requests/inspection/${w.id}`,
        date: w.actualDate ?? w.scheduledDate,
        tone: inspectionTone(w.status, w.scheduledDate),
        woNumber: w.woNumber,
        product: t('mro2:detail.typeInspection', { type: t(`calendar:type.${w.woType}`) }),
        productKey: w.woType as string,
        craneId: w.craneId,
        craneName: w.craneName,
        siteName: w.siteName,
      })),
    ...repairs
      .filter((w) => yearOf(w.scheduledStart) === year)
      .map((w) => ({
        key: `r-${w.id}`,
        path: `/mro2/service-requests/repair/${w.id}`,
        date: w.actualEnd ?? w.scheduledStart,
        tone: repairTone(w.status, w.scheduledEnd),
        woNumber: w.woNumber,
        product: w.sourceType === 'breakdown' ? t('mro2:sr.onCallRepair') : t('mro2:sr.plannedRepairs'),
        productKey: w.sourceType === 'breakdown' ? 'oncall' : 'planned',
        craneId: w.craneId,
        craneName: w.craneName,
        siteName: w.siteName,
      })),
  ];

  // 올해 데이터에 실제 존재하는 서비스 상품만 후보로 노출한다 (표시 라벨 재사용)
  const productOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRows) if (!seen.has(r.productKey)) seen.set(r.productKey, r.product);
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspections, repairs, year, t]);

  const rows = allRows
    .filter(
      (r) =>
        (statusFilters.size === 0 || statusFilters.has(r.tone)) &&
        (productFilters.size === 0 || productFilters.has(r.productKey)) &&
        (assetFilters.size === 0 || assetFilters.has(r.craneId)),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const toggleStatus = (t: ServiceTone) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const toggleIn = (set: (fn: (prev: Set<string>) => Set<string>) => void, key: string) => {
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex gap-6 pt-2">
      <div className="hidden lg:block">
        <div className="mb-2">
          <Link to="/mro2" className="flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
            <ChevronLeft size={14} /> {t('mro2:common.back')}
          </Link>
        </div>
        <KcFilterRail
          selectedCount={statusFilters.size + productFilters.size + assetFilters.size}
          onClear={() => {
            setStatusFilters(new Set());
            setProductFilters(new Set());
            setAssetFilters(new Set());
          }}
        >
          <KcFilterGroup title={t('mro2:common.selectedCustomers')}>
            <div className="w-full px-2 py-1.5 text-[10.5px]" style={{ background: KC.inverseBg, color: KC.inverseText }}>
              {t('mro2:common.customerName')}
              <div style={{ color: KC.inverseMuted }}>{t('mro2:common.customerAddress')}</div>
            </div>
          </KcFilterGroup>
          <KcFilterGroup title={t('mro2:calendar.serviceStatus')}>
            {(['completed', 'delayed', 'inProgress', 'open'] as const).map((tone) => (
              <KcFilterChip
                key={tone}
                label={serviceToneLabel(tone)}
                tone={SERVICE_TONE_COLOR[tone]}
                active={statusFilters.has(tone)}
                onClick={() => toggleStatus(tone)}
              />
            ))}
          </KcFilterGroup>
          <KcFilterGroup title={t('mro2:calendar.serviceProduct')}>
            {productOptions.map(({ key, label }) => (
              <KcFilterChip
                key={key}
                label={label}
                active={productFilters.has(key)}
                onClick={() => toggleIn(setProductFilters, key)}
              />
            ))}
          </KcFilterGroup>
          <KcFilterGroup title={t('mro2:calendar.assetName')}>
            {assets.map((a) => (
              <KcFilterChip
                key={a.id}
                label={a.name}
                active={assetFilters.has(a.id)}
                onClick={() => toggleIn(setAssetFilters, a.id)}
              />
            ))}
          </KcFilterGroup>
        </KcFilterRail>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-end justify-between border-b pb-1.5" style={{ borderColor: KC.borderStrong }}>
          <h2 className="text-[18px] font-semibold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {t('mro2:common.activities', { count: rows.length })}
          </h2>
          <KcButton variant="teal" onClick={() => openTicket('repair')}>
            <Plus size={13} /> {t('mro2:common.newServiceRequest')}
          </KcButton>
        </div>
        <div className="mt-3 flex flex-col">
          {rows.map((r) => (
            <div key={r.key} className="flex gap-3">
              <div className="w-[64px] shrink-0 pt-2 text-right text-[10px]" style={{ color: KC.faint }}>
                {fmtDate(r.date)}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(r.path)}
                onKeyDown={(e) => (e.key === 'Enter' ? navigate(r.path) : undefined)}
                className="kc-hover mb-2 flex-1 cursor-pointer border px-3 py-2"
                style={{
                  borderColor: KC.hairline,
                  borderLeft: `4px solid ${SERVICE_TONE_COLOR[r.tone]}`,
                  background: KC.bgSubtle,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: KC.ink }}>
                    <Wrench size={12} /> {t('mro2:detail.srOf', { status: serviceToneLabel(r.tone) })}
                  </span>
                  <span className="text-right text-[9.5px]" style={{ color: KC.faint }}>
                    {t('mro2:common.scheduled')}
                    <br />📅 {fmtDate(r.date)}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-bold" style={{ color: KC.text, fontFamily: KC_FONT_MONO }}>
                  {r.woNumber} · {r.product}
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10.5px]" style={{ color: KC.muted }}>
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> {r.siteName}
                  </span>
                  <span>{r.craneName}</span>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="py-8 text-center text-[12px]" style={{ color: KC.muted }}>
              {t('mro2:sr.noRequests')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
