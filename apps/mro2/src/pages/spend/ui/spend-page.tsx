import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { KC, KC_FONT_DISPLAY, usd } from '../../../shared/ui/kc';
import { KcDonut, KcSectionHeading } from '../../../shared/ui/kc-ui';
import { useMro2Year } from '../../../shared/ui/layout/mro2-layout';
import {
  bucketTotal,
  computeSpend,
  SPEND_TYPES,
  type SpendBucket,
} from '../../../shared/lib/spend';

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className="cursor-pointer px-2.5 py-1 text-[10.5px]"
          style={{
            background: value === key ? KC.inverseBg : KC.bgRow,
            color: value === key ? KC.inverseText : KC.text,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  const { t } = useTranslation('mro2');
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
      {SPEND_TYPES.map((st) => (
        <span key={st.key} className="flex items-center gap-1.5 text-[10px]" style={{ color: KC.text }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: st.color }} />
          {t(`spendType.${st.key}`)}
        </span>
      ))}
    </div>
  );
}

/** 수직 스택 바 묶음 (Trend by Service Type) */
function StackedColumns({ data }: { data: { label: string; bucket: SpendBucket }[] }) {
  const max = Math.max(...data.map((d) => bucketTotal(d.bucket)), 1);
  return (
    <div className="flex items-end justify-center gap-6 px-4" style={{ height: 190 }}>
      {data.map((d) => {
        const total = bucketTotal(d.bucket);
        return (
          <div key={d.label} className="flex h-full w-14 flex-col items-center justify-end">
            <span className="mb-1 text-[9.5px]" style={{ color: KC.muted }}>
              {total > 0 ? usd(total) : ''}
            </span>
            <div className="flex w-9 flex-col-reverse" style={{ height: `${(total / max) * 78}%` }}>
              {SPEND_TYPES.map((t) =>
                d.bucket[t.key] > 0 ? (
                  <span
                    key={t.key}
                    style={{ height: `${(d.bucket[t.key] / (total || 1)) * 100}%`, background: t.color }}
                  />
                ) : null,
              )}
            </div>
            <span className="mt-1 text-[9.5px]" style={{ color: KC.muted }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 수평 스택 바 (Spend by Location / Assets) */
function StackedRows({ data }: { data: { label: string; bucket: SpendBucket }[] }) {
  const max = Math.max(...data.map((d) => bucketTotal(d.bucket)), 1);
  return (
    <div className="flex flex-col gap-2 px-2">
      {data.map((d) => {
        const total = bucketTotal(d.bucket);
        return (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-[150px] shrink-0 truncate text-right text-[10px]" style={{ color: KC.link }}>
              {d.label}
            </span>
            <div className="flex h-[16px] flex-1 items-stretch">
              <div className="flex" style={{ width: `${(total / max) * 100}%` }}>
                {SPEND_TYPES.map((t) =>
                  d.bucket[t.key] > 0 ? (
                    <span
                      key={t.key}
                      style={{ width: `${(d.bucket[t.key] / (total || 1)) * 100}%`, background: t.color }}
                    />
                  ) : null,
                )}
              </div>
              <span className="ml-2 self-center text-[9.5px]" style={{ color: KC.muted }}>
                {total > 0 ? usd(total) : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Mro2SpendPage() {
  const { t } = useTranslation('mro2');
  const MONTH_SHORT = t('calendar.monthsShort', { returnObjects: true }) as string[];
  const { year } = useMro2Year();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const [trendMode, setTrendMode] = useState<'yearly' | 'monthly'>('yearly');
  const [byMode, setByMode] = useState<'locations' | 'assets'>('locations');

  const spend = useMemo(() => computeSpend(inspections, repairs, year), [inspections, repairs, year]);

  const yearlyData = Object.entries(spend.byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([y, bucket]) => ({ label: y, bucket }));

  const monthlyData = spend.byMonth.map((bucket, m) => ({ label: MONTH_SHORT[m], bucket }));

  const assetData = Object.values(spend.byAsset).map((a) => ({ label: a.name, bucket: a.bucket }));
  const locationBucket = Object.values(spend.byAsset).reduce<SpendBucket>(
    (acc, a) => {
      acc.ipm += a.bucket.ipm;
      acc.planned += a.bucket.planned;
      acc.oncall += a.bucket.oncall;
      acc.parts += a.bucket.parts;
      return acc;
    },
    { ipm: 0, planned: 0, oncall: 0, parts: 0 },
  );

  return (
    <div className="pt-1">
      <Link to="/mro2" className="mb-2 flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
        <ChevronLeft size={14} /> {t('common.back')}
      </Link>

      <KcSectionHeading>{t('spend.title')}</KcSectionHeading>
      <div className="mb-5 text-[11px]" style={{ color: KC.muted }}>
        {t('common.customerName')}
        <br />
        {year}
      </div>

      {/* 대형 스탯 페어 */}
      <div className="mb-8 flex items-start justify-center gap-24">
        <div className="flex flex-col items-center">
          <span className="text-[11px]" style={{ color: KC.muted }}>
            {t('spend.serviceVisits')}
          </span>
          <span className="text-[10px]" style={{ color: KC.faint }}>
            {year}
          </span>
          <span className="mt-1 text-[30px] font-bold" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {spend.visits}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[11px]" style={{ color: KC.muted }}>
            {t('spend.totalSpend')}
          </span>
          <span className="text-[10px]" style={{ color: KC.faint }}>
            {year}
          </span>
          <span className="mt-1 text-[30px] font-bold" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {usd(spend.total)}
          </span>
        </div>
      </div>

      {/* 도넛 + 트렌드 — 전폭 2컬럼 */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-[4px] border p-4" style={{ borderColor: KC.hairline }}>
          <div
            className="mb-1 text-center text-[14px] font-semibold tracking-wide"
            style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
          >
            {t('spend.byType')}
          </div>
          <div className="mb-2 text-center text-[10px]" style={{ color: KC.faint }}>
            {year}
          </div>
          <div className="flex items-center justify-center gap-10 pt-3">
            <KcDonut size={148} stroke={24} segments={SPEND_TYPES.map((st) => ({ value: spend.byType[st.key], color: st.color }))} />
            <div className="flex flex-col gap-1.5">
              {SPEND_TYPES.map((st) => (
                <div key={st.key} className="flex items-center gap-2 text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: st.color }} />
                  <span className="w-[220px]" style={{ color: KC.text }}>
                    {t(`spendType.${st.key}`)}
                  </span>
                  <span className="text-right font-bold" style={{ color: KC.ink }}>
                    {usd(spend.byType[st.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[4px] border p-4" style={{ borderColor: KC.hairline }}>
          <div
            className="mb-1 text-center text-[14px] font-semibold tracking-wide"
            style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
          >
            {t('spend.trendByType')}
          </div>
          <div className="mb-2 text-center text-[10px]" style={{ color: KC.faint }}>
            {yearlyData.length > 0 ? `${yearlyData[0].label} - ${yearlyData[yearlyData.length - 1].label}` : year}
          </div>
          <div className="mb-2 flex justify-center">
            <Toggle
              value={trendMode}
              options={[
                ['yearly', t('spend.yearlyTrend')],
                ['monthly', t('spend.monthlyTrend')],
              ]}
              onChange={setTrendMode}
            />
          </div>
          <StackedColumns data={trendMode === 'yearly' ? yearlyData : monthlyData} />
          <Legend />
        </div>
      </div>

      {/* 위치/자산별 */}
      <div
        className="mt-8 mb-1 text-center text-[14px] font-semibold tracking-wide"
        style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
      >
        {t('spend.byLocation')}
      </div>
      <div className="mb-2 text-center text-[10px]" style={{ color: KC.faint }}>
        {year}
      </div>
      <div className="mb-3 flex justify-center">
        <Toggle
          value={byMode}
          options={[
            ['locations', t('spend.locations')],
            ['assets', t('spend.assetsToggle')],
          ]}
          onChange={setByMode}
        />
      </div>
      <StackedRows
        data={
          byMode === 'locations'
            ? [{ label: t('spend.locationLabel'), bucket: locationBucket }]
            : assetData
        }
      />
      <Legend />
    </div>
  );
}
