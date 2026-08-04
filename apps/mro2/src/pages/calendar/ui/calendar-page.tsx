import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react';
import { useServiceCalendar } from '@crane/features/calendar';
import type { CalendarEvent } from '@crane/features/calendar';
import { useAssetList } from '@crane/features/asset';
import { KC, KC_FONT_MONO, SERVICE_TONE_COLOR, type ServiceTone } from '../../../shared/ui/kc';
import { KcEmpty, KcFilterChip, KcFilterGroup, KcFilterRail, KcSectionHeading } from '../../../shared/ui/kc-ui';
import { useTranslation } from 'react-i18next';
import {
  fmtDate,
  inspectionTone,
  repairTone,
  serviceToneLabel,
} from '../../../shared/lib/service-status';
import { MRO2_YEARS, useMro2Year } from '../../../shared/ui/layout';

function eventTone(e: CalendarEvent): ServiceTone {
  return e.sourceType === 'inspection' ? inspectionTone(e.status) : repairTone(e.status);
}

function eventPath(e: CalendarEvent): string {
  return `/mro2/service-requests/${e.sourceType}/${e.sourceId}`;
}

export function Mro2CalendarPage() {
  const { t } = useTranslation('mro2');
  const { t: tCal } = useTranslation('calendar');
  const MONTHS = t('calendar.months', { returnObjects: true }) as string[];
  const MONTHS_SHORT = t('calendar.monthsShort', { returnObjects: true }) as string[];
  const WEEKDAYS = t('calendar.weekdays', { returnObjects: true }) as string[];
  const navigate = useNavigate();
  const { year, setYear } = useMro2Year();
  const { events } = useServiceCalendar();
  const { assets } = useAssetList();
  const [statusFilters, setStatusFilters] = useState<Set<ServiceTone>>(new Set());
  const [productFilters, setProductFilters] = useState<Set<string>>(new Set());
  // 서비스 플랜 히트맵 셀 등에서 ?a=<craneId> 로 자산을 지정해 진입할 수 있다 (초기값만)
  const [initialSearchParams] = useSearchParams();
  const aParam = initialSearchParams.get('a');
  const [assetFilters, setAssetFilters] = useState<Set<string>>(
    () => new Set(aParam && assets.some((x) => x.id === aParam) ? [aParam] : []),
  );

  // 이벤트에 실제 존재하는 서비스 상품만 필터 후보로 노출한다
  const productKeys = useMemo(() => {
    const keys = new Set(events.map((e) => e.productKey));
    return ['frequent', 'periodic', 'emergency', 'special', 'planned', 'oncall'].filter((k) =>
      keys.has(k),
    );
  }, [events]);
  const productLabel = (key: string): string =>
    key === 'planned'
      ? t('sr.plannedRepairs')
      : key === 'oncall'
        ? t('sr.onCallRepair')
        : t('detail.typeInspection', { type: tCal(`type.${key}`) });

  const yearEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          e.start.getFullYear() === year &&
          (statusFilters.size === 0 || statusFilters.has(eventTone(e))) &&
          (productFilters.size === 0 || productFilters.has(e.productKey)) &&
          (assetFilters.size === 0 || assetFilters.has(e.craneId)),
      ),
    [events, year, statusFilters, productFilters, assetFilters],
  );

  const defaultMonth = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === year) return now.getMonth();
    const monthsWithEvents = yearEvents.map((e) => e.start.getMonth());
    return monthsWithEvents.length > 0 ? Math.min(...monthsWithEvents) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);
  // 서비스 플랜 등에서 ?m=<0..11> 로 특정 월을 딥링크할 수 있다 (초기값만)
  const mParam = initialSearchParams.get('m');
  const deepLinkMonth =
    mParam !== null && Number.isInteger(Number(mParam)) && Number(mParam) >= 0 && Number(mParam) <= 11
      ? Number(mParam)
      : null;
  const [month, setMonth] = useState(deepLinkMonth ?? defaultMonth);

  const monthEvents = yearEvents
    .filter((e) => e.start.getMonth() === month)
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  const monthTones = (m: number): ServiceTone[] => {
    const tones = new Set<ServiceTone>();
    for (const e of yearEvents) if (e.start.getMonth() === m) tones.add(eventTone(e));
    return [...tones];
  };

  const dayTones = (day: number): ServiceTone[] => {
    const tones = new Set<ServiceTone>();
    for (const e of monthEvents) if (e.start.getDate() === day) tones.add(eventTone(e));
    return [...tones];
  };

  // 월 그리드 (월요일 시작)
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const cells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = new Date();

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

  const stepYear = (dir: -1 | 1) => {
    const idx = MRO2_YEARS.indexOf(year);
    const next = MRO2_YEARS[idx + dir];
    if (next) setYear(next);
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
          selectedCount={statusFilters.size + productFilters.size + assetFilters.size}
          onClear={() => {
            setStatusFilters(new Set());
            setProductFilters(new Set());
            setAssetFilters(new Set());
          }}
        >
          <KcFilterGroup title={t('common.selectedCustomers')}>
            <div className="w-full px-2 py-1.5 text-[10.5px]" style={{ background: KC.inverseBg, color: KC.inverseText }}>
              {t('common.customerName')}
              <div style={{ color: KC.inverseMuted }}>{t('common.customerAddress')}</div>
            </div>
          </KcFilterGroup>
          <KcFilterGroup title={t('calendar.serviceStatus')}>
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
          <KcFilterGroup title={t('calendar.serviceProduct')}>
            {productKeys.map((key) => (
              <KcFilterChip
                key={key}
                label={productLabel(key)}
                active={productFilters.has(key)}
                onClick={() => toggleIn(setProductFilters, key)}
              />
            ))}
          </KcFilterGroup>
          <KcFilterGroup title={t('calendar.assetName')}>
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

      {/* 본문 */}
      <div className="min-w-0 flex-1">
        <KcSectionHeading>{t('calendar.title')}</KcSectionHeading>
        <div className="-mt-2 mb-4 text-[11px]" style={{ color: KC.muted }}>
          {t('common.customerName')}
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* 연 뷰 */}
          <div className="flex-1">
            <div className="mb-3 flex items-center justify-center gap-6">
              <button type="button" aria-label="Previous year" className="cursor-pointer" onClick={() => stepYear(-1)}>
                <ChevronLeft size={15} style={{ color: KC.ink }} />
              </button>
              <span className="text-[14px] font-bold" style={{ color: KC.ink }}>
                {year}
              </span>
              <button type="button" aria-label="Next year" className="cursor-pointer" onClick={() => stepYear(1)}>
                <ChevronRight size={15} style={{ color: KC.ink }} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              {MONTHS.map((name, m) => {
                const tones = monthTones(m);
                const active = m === month;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setMonth(m)}
                    className="cursor-pointer px-2 py-1.5 text-center text-[11.5px]"
                    style={{
                      background: active ? KC.inverseBg : 'transparent',
                      color: active ? KC.inverseText : KC.text,
                    }}
                  >
                    {name}
                    <span className="mt-1 flex justify-center gap-0.5">
                      {tones.length > 0 ? (
                        tones.map((t) => (
                          <span
                            key={t}
                            className="inline-block h-[3px] w-6"
                            style={{ background: SERVICE_TONE_COLOR[t] }}
                          />
                        ))
                      ) : (
                        <span className="inline-block h-[3px] w-6" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 월 뷰 */}
          <div className="flex-1">
            <div className="mb-3 flex items-center justify-center gap-6">
              <button
                type="button"
                aria-label="Previous month"
                className="cursor-pointer"
                onClick={() => {
                  if (month === 0 && MRO2_YEARS.includes(year - 1)) {
                    setYear(year - 1);
                    setMonth(11);
                  } else {
                    setMonth((m) => Math.max(0, m - 1));
                  }
                }}
              >
                <ChevronLeft size={15} style={{ color: KC.ink }} />
              </button>
              <span className="text-[14px] font-bold" style={{ color: KC.ink }}>
                {MONTHS_SHORT[month]} {year}
              </span>
              <button
                type="button"
                aria-label="Next month"
                className="cursor-pointer"
                onClick={() => {
                  if (month === 11 && MRO2_YEARS.includes(year + 1)) {
                    setYear(year + 1);
                    setMonth(0);
                  } else {
                    setMonth((m) => Math.min(11, m + 1));
                  }
                }}
              >
                <ChevronRight size={15} style={{ color: KC.ink }} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[10.5px]">
              {WEEKDAYS.map((d) => (
                <div key={d} style={{ color: KC.faint }}>
                  {d}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`b${i}`} />;
                const tones = dayTones(day);
                const isToday =
                  today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                return (
                  <div
                    key={day}
                    className="mx-auto flex w-7 flex-col items-center pt-1 pb-0.5"
                    style={{ border: isToday ? `1px solid ${KC.ink}` : '1px solid transparent', color: KC.text }}
                  >
                    {day}
                    <span className="mt-0.5 flex gap-0.5">
                      {tones.map((t) => (
                        <span key={t} className="inline-block h-[3px] w-3" style={{ background: SERVICE_TONE_COLOR[t] }} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 활동 목록 */}
        <div className="mt-8 border-b pb-1.5" style={{ borderColor: KC.borderStrong }}>
          <h3 className="text-[14px]" style={{ color: KC.ink }}>
            {t('common.activities', { count: monthEvents.length })}
          </h3>
        </div>
        <div className="mt-3 flex flex-col">
          {monthEvents.map((e) => {
            const tone = eventTone(e);
            return (
              <div key={e.id} className="flex gap-3">
                <div className="w-[64px] shrink-0 pt-2 text-right text-[10px]" style={{ color: KC.faint }}>
                  {fmtDate(e.start)}
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(eventPath(e))}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      navigate(eventPath(e));
                    }
                  }}
                  className="kc-hover mb-2 flex-1 cursor-pointer border px-3 py-2"
                  style={{
                    borderColor: KC.hairline,
                    borderLeft: `4px solid ${SERVICE_TONE_COLOR[tone]}`,
                    background: KC.bgSubtle,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: KC.ink }}>
                      <Wrench size={12} /> {t('common.serviceRequest')}
                    </span>
                    <span className="text-[10px]" style={{ color: KC.faint }}>
                      📅 {fmtDate(e.start)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10.5px]" style={{ color: KC.muted }}>
                    <span style={{ fontFamily: KC_FONT_MONO }}>{e.title}</span>
                    <span>{e.craneName}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {monthEvents.length === 0 ? (
            <KcEmpty>{t('calendar.noActivities', { month: MONTHS[month], year })}</KcEmpty>
          ) : null}
        </div>
      </div>
    </div>
  );
}
