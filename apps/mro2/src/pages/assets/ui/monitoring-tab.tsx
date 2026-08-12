import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Wifi } from 'lucide-react';
import type { CraneComponent } from '@crane/domain/asset';
import type { InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import { KC, KC_FONT_DISPLAY } from '../../../shared/ui/kc';
import { KcEmpty, KcRing } from '../../../shared/ui/kc-ui';
import { COMPONENT_STATUS_COLOR, remainingPct } from '../../../shared/lib/component';
import {
  alertMonthlyTrend,
  alertPareto,
  buildLifeProjection,
  deriveAlerts,
  inRange,
  loadSpectrum,
  presetRange,
  type DateRange,
  type RangePreset,
} from '../lib/truconnect';

/* ── 기간 툴바 (매뉴얼 16p Preset Time Range + Start/End Date) ───────── */

function RangeToolbar({
  preset,
  range,
  onPreset,
  onCustom,
}: {
  preset: RangePreset;
  range: DateRange;
  onPreset: (p: Exclude<RangePreset, 'custom'>) => void;
  onCustom: (start: Date, end: Date) => void;
}) {
  const { t } = useTranslation('mro2');
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return (
    <div
      className="mb-5 flex flex-wrap items-end gap-4 border px-3 py-2"
      style={{ borderColor: KC.hairline, background: KC.bgSubtle }}
    >
      <label className="flex flex-col gap-0.5 text-[10px]" style={{ color: KC.muted }}>
        {t('monitoring.presetRange')}
        <select
          value={preset}
          onChange={(e) => {
            const v = e.target.value as RangePreset;
            if (v !== 'custom') onPreset(v);
          }}
          className="cursor-pointer border px-1.5 py-1 text-[11.5px]"
          style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
        >
          <option value="last30">{t('monitoring.rangeLast30')}</option>
          <option value="month">{t('monitoring.rangeMonth')}</option>
          <option value="year">{t('monitoring.rangeYear')}</option>
          <option value="custom" disabled>
            {t('monitoring.rangeCustom')}
          </option>
        </select>
      </label>
      <label className="flex flex-col gap-0.5 text-[10px]" style={{ color: KC.muted }}>
        {t('monitoring.startDate')}
        <input
          type="date"
          value={iso(range.start)}
          max={iso(range.end)}
          onChange={(e) => {
            if (e.target.value) onCustom(new Date(`${e.target.value}T00:00:00`), range.end);
          }}
          className="border px-1.5 py-0.5 text-[11.5px]"
          style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px]" style={{ color: KC.muted }}>
        {t('monitoring.endDate')}
        <input
          type="date"
          value={iso(range.end)}
          min={iso(range.start)}
          onChange={(e) => {
            if (e.target.value) onCustom(range.start, new Date(`${e.target.value}T23:59:59`));
          }}
          className="border px-1.5 py-0.5 text-[11.5px]"
          style={{ borderColor: KC.border, color: KC.ink, background: KC.bg }}
        />
      </label>
      <button
        type="button"
        onClick={() => onPreset('last30')}
        className="cursor-pointer pb-1 text-[11px]"
        style={{ color: KC.link }}
      >
        {t('monitoring.clearRange')}
      </button>
    </div>
  );
}

/* ── 잔여수명 추정 라인차트 (매뉴얼 18p) ─────────────────────────────── */

function LifeChart({ component }: { component: CraneComponent }) {
  const { t } = useTranslation('mro2');
  const proj = useMemo(() => buildLifeProjection(component, new Date()), [component]);
  if (proj.points.length < 2) return null;

  const W = 560;
  const H = 120;
  const PAD = { l: 30, r: 8, t: 8, b: 18 };
  const years = proj.points.map((p) => p.year);
  const minY = years[0];
  const maxY = years[years.length - 1];
  const x = (year: number) => PAD.l + ((year - minY) / Math.max(maxY - minY, 1)) * (W - PAD.l - PAD.r);
  const y = (pct: number) => PAD.t + (1 - pct / 100) * (H - PAD.t - PAD.b);
  const path = proj.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const nowYear = new Date().getFullYear();
  const yearTicks = years.filter((yr) => (maxY - minY > 8 ? yr % 4 === 0 : yr % 2 === 0));

  return (
    <div className="mt-2 border-t pt-2" style={{ borderColor: KC.hairline }}>
      <div className="mb-1 text-[10.5px]" style={{ color: KC.muted }}>
        {t('monitoring.lifeEstimate')}
        {proj.estimatedEndYear ? (
          <span style={{ color: KC.safety }}> · {t('monitoring.estimatedEnd', { year: proj.estimatedEndYear })}</span>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('monitoring.lifeEstimate')}>
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} stroke={KC.hairline} strokeWidth={1} />
            <text x={PAD.l - 4} y={y(p) + 3} textAnchor="end" fontSize={8} fill={KC.faint}>
              {p}%
            </text>
          </g>
        ))}
        {yearTicks.map((yr) => (
          <text key={yr} x={x(yr)} y={H - 4} textAnchor="middle" fontSize={8} fill={KC.faint}>
            {yr}
          </text>
        ))}
        {/* 현재 시점 세로선 */}
        {nowYear >= minY && nowYear <= maxY ? (
          <line x1={x(nowYear)} x2={x(nowYear)} y1={PAD.t} y2={H - PAD.b} stroke={KC.borderStrong} strokeDasharray="3 3" />
        ) : null}
        <path d={path} fill="none" stroke={KC.s1} strokeWidth={1.8} />
        {/* 예상 수명 종료 마커 */}
        {proj.estimatedEndYear && proj.estimatedEndYear <= maxY ? (
          <g>
            <circle cx={x(proj.estimatedEndYear)} cy={y(0)} r={3.5} fill={KC.safety} />
            <title>{t('monitoring.estimatedEnd', { year: proj.estimatedEndYear })}</title>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

/* ── Alert Pareto (매뉴얼 19p) ──────────────────────────────────────── */

function ParetoChart({
  entries,
  causeLabel,
}: {
  entries: ReturnType<typeof alertPareto>;
  causeLabel: (cause: string) => string;
}) {
  const { t } = useTranslation('mro2');
  if (entries.length === 0) {
    return (
      <KcEmpty>{t('monitoring.noAlerts')}</KcEmpty>
    );
  }
  const W = 560;
  const H = 150;
  const PAD = { l: 26, r: 30, t: 8, b: 34 };
  const maxCount = Math.max(...entries.map((e) => e.count), 1);
  const bw = (W - PAD.l - PAD.r) / entries.length;
  const yCount = (n: number) => PAD.t + (1 - n / maxCount) * (H - PAD.t - PAD.b);
  const yPct = (p: number) => PAD.t + (1 - p / 100) * (H - PAD.t - PAD.b);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('monitoring.alertPareto')}>
      {entries.map((e, i) => {
        const bx = PAD.l + i * bw + bw * 0.15;
        return (
          <g key={e.cause}>
            <rect
              x={bx}
              y={yCount(e.count)}
              width={bw * 0.7}
              height={H - PAD.b - yCount(e.count)}
              fill={KC.production}
            >
              <title>{`${causeLabel(e.cause)} — ${e.count}`}</title>
            </rect>
            <text x={bx + bw * 0.35} y={yCount(e.count) - 3} textAnchor="middle" fontSize={8.5} fill={KC.ink}>
              {e.count}
            </text>
            <text
              x={PAD.l + i * bw + bw / 2}
              y={H - PAD.b + 10}
              textAnchor="middle"
              fontSize={7.5}
              fill={KC.muted}
            >
              {causeLabel(e.cause).slice(0, 14)}
            </text>
          </g>
        );
      })}
      {/* 누적 % 라인 */}
      <path
        d={entries
          .map((e, i) => `${i === 0 ? 'M' : 'L'}${(PAD.l + i * bw + bw / 2).toFixed(1)},${yPct(e.cumPct).toFixed(1)}`)
          .join(' ')}
        fill="none"
        stroke={KC.s2}
        strokeWidth={1.5}
      />
      {entries.map((e, i) => (
        <circle key={e.cause} cx={PAD.l + i * bw + bw / 2} cy={yPct(e.cumPct)} r={2.5} fill={KC.s2}>
          <title>{`${e.cumPct}%`}</title>
        </circle>
      ))}
      {[0, 50, 100].map((p) => (
        <text key={p} x={W - PAD.r + 4} y={yPct(p) + 3} fontSize={8} fill={KC.faint}>
          {p}%
        </text>
      ))}
    </svg>
  );
}

/* ── 월별 알림 트렌드 ───────────────────────────────────────────────── */

function TrendChart({ buckets }: { buckets: ReturnType<typeof alertMonthlyTrend> }) {
  const { t } = useTranslation('mro2');
  const MONTHS_SHORT = t('calendar.monthsShort', { returnObjects: true }) as string[];
  const max = Math.max(...buckets.map((b) => b.safety + b.production), 1);

  const W = 560;
  const H = 150;
  const PAD = { l: 24, r: 8, t: 12, b: 20 };
  const plotH = H - PAD.t - PAD.b;
  const slotW = (W - PAD.l - PAD.r) / Math.max(buckets.length, 1);
  const bw = Math.min(22, slotW * 0.5);
  const y = (n: number) => PAD.t + (1 - n / max) * plotH;
  // 정수 눈금 — 최대 4개 안팎으로 유지
  const step = Math.max(1, Math.ceil(max / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('monitoring.alertsTrend')}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={KC.hairline} strokeWidth={1} />
          <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill={KC.faint}>
            {v}
          </text>
        </g>
      ))}
      {buckets.map((b, i) => {
        const total = b.safety + b.production;
        const cx = PAD.l + i * slotW + slotW / 2;
        const bx = cx - bw / 2;
        // 스택: 아래 safety(적), 위 production(주황) — 기준선에서 위로 쌓는다
        const safetyH = (b.safety / max) * plotH;
        const prodH = (b.production / max) * plotH;
        return (
          <g key={`${b.year}-${b.month}`}>
            {b.safety > 0 ? (
              <rect x={bx} y={y(0) - safetyH} width={bw} height={safetyH} fill={KC.safety}>
                <title>{`${MONTHS_SHORT[b.month]} · ${t('monitoring.safetyAlerts')} — ${b.safety}`}</title>
              </rect>
            ) : null}
            {b.production > 0 ? (
              <rect x={bx} y={y(0) - safetyH - prodH} width={bw} height={prodH} fill={KC.production}>
                <title>{`${MONTHS_SHORT[b.month]} · ${t('monitoring.productionAlerts')} — ${b.production}`}</title>
              </rect>
            ) : null}
            {total > 0 ? (
              <text x={cx} y={y(total) - 3} textAnchor="middle" fontSize={8.5} fill={KC.ink}>
                {total}
              </text>
            ) : null}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize={8} fill={KC.faint}>
              {MONTHS_SHORT[b.month]}
            </text>
          </g>
        );
      })}
      {/* 기준선 */}
      <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke={KC.borderStrong} strokeWidth={1} />
    </svg>
  );
}

/* ── Load spectrum (매뉴얼 20p) ─────────────────────────────────────── */

function SpectrumChart({ craneId }: { craneId: string }) {
  const { t } = useTranslation('mro2');
  const [excludeLow, setExcludeLow] = useState(false);
  const buckets = useMemo(() => loadSpectrum(craneId), [craneId]);
  const visible = excludeLow ? buckets.slice(1) : buckets;
  const max = Math.max(...visible.map((b) => b.pct), 1);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: KC.ink }}>
          {t('monitoring.loadSpectrum')}
        </span>
        <button
          type="button"
          onClick={() => setExcludeLow((v) => !v)}
          className="cursor-pointer px-1.5 py-0.5 text-[10px]"
          style={{
            background: excludeLow ? KC.inverseBg : KC.bgRow,
            color: excludeLow ? KC.inverseText : KC.text,
          }}
        >
          {t('monitoring.excludeLow')}
        </button>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 110 }}>
        {visible.map((b) => (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-0.5 text-[8.5px]" style={{ color: KC.muted }}>
              {b.pct >= 1 ? `${Math.round(b.pct)}%` : ''}
            </span>
            <span
              className="w-full max-w-7"
              title={`${b.label}% — ${b.pct}%`}
              style={{ height: `${(b.pct / max) * 74}%`, background: KC.s3 }}
            />
            <span className="mt-0.5 text-[8px] whitespace-nowrap" style={{ color: KC.faint }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[9.5px]" style={{ color: KC.faint }}>
        {t('monitoring.spectrumCaption')}
      </div>
    </div>
  );
}

/* ── Monitoring 탭 본체 ─────────────────────────────────────────────── */

export function MonitoringTab({
  craneId,
  components,
  inspections,
  repairs,
}: {
  craneId: string;
  components: CraneComponent[];
  inspections: InspectionWO[];
  repairs: RepairWO[];
}) {
  const { t } = useTranslation(['mro2', 'calendar']);
  const clusters = components.filter((c) => c.parentId === null);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const [preset, setPreset] = useState<RangePreset>('year');
  const [range, setRange] = useState<DateRange>(() => presetRange('year', new Date()));

  const alerts = useMemo(() => deriveAlerts(inspections, repairs), [inspections, repairs]);
  const rangeAlerts = useMemo(() => alerts.filter((a) => inRange(a.date, range)), [alerts, range]);
  const pareto = useMemo(() => alertPareto(rangeAlerts), [rangeAlerts]);
  const trend = useMemo(() => alertMonthlyTrend(rangeAlerts, range), [rangeAlerts, range]);

  const causeLabel = (cause: string) =>
    t(`mro2:ticket.ft_${cause}`, { defaultValue: cause });

  const worst = clusters.reduce<CraneComponent | null>((acc, c) => {
    if (!acc) return c;
    return remainingPct(c) < remainingPct(acc) ? c : acc;
  }, null);
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
          {t('mro2:common.remoteMonitoring')}
        </span>
        <Wifi size={14} style={{ color: KC.ink }} />
      </div>
      <div className="mb-3 text-[11px]" style={{ color: KC.muted }}>
        {t('mro2:monitoring.summary')}
      </div>

      <RangeToolbar
        preset={preset}
        range={range}
        onPreset={(p) => {
          setPreset(p);
          setRange(presetRange(p, new Date()));
        }}
        onCustom={(start, end) => {
          setPreset('custom');
          setRange({ start, end });
        }}
      />

      {/* 3-메트릭 요약 (17p) — Alerts 는 선택 기간의 파생 알림 수 */}
      <div className="mb-6 flex items-start justify-around">
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10.5px]" style={{ color: KC.muted }}>
            {t('mro2:monitoring.condition')}
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
            <div style={{ color: KC.faint }}>{t('mro2:monitoring.shortestServiceLife')}</div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10.5px]" style={{ color: KC.muted }}>
            {t('mro2:monitoring.alerts')}
          </div>
          <div
            className="flex items-center justify-center rounded-full text-[15px] font-bold"
            style={{
              background: rangeAlerts.length > 0 ? KC.safety : KC.ok,
              color: rangeAlerts.length > 0 ? KC.onSafety : KC.onOk,
              width: 48,
              height: 48,
            }}
          >
            {rangeAlerts.length}
          </div>
          <div className="text-center text-[10px]" style={{ color: KC.text }}>
            {t('mro2:monitoring.alertsInRange')}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10.5px]" style={{ color: KC.muted }}>
            {t('mro2:monitoring.operatingStatistics')}
          </div>
          <div className="text-[26px] font-bold" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
            {totalHours.toLocaleString('en-US')}
          </div>
          <div className="text-center text-[10px]" style={{ color: KC.text }}>
            {t('mro2:monitoring.hours')}
            <div style={{ color: KC.faint }}>{t('mro2:monitoring.total')}</div>
          </div>
        </div>
      </div>

      {/* Condition 아코디언 + 클러스터별 수명 추정 차트 */}
      <div className="mb-2 flex items-center justify-between border-b pb-1" style={{ borderColor: KC.borderStrong }}>
        <span className="text-[13px]" style={{ color: KC.ink }}>
          {t('mro2:monitoring.condition')}
        </span>
        <button
          type="button"
          className="cursor-pointer text-[11px]"
          style={{ color: KC.link }}
          onClick={() => setExpandAll((v) => !v)}
        >
          {expandAll ? t('mro2:common.collapseAll') : t('mro2:common.expandAll')}
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
                aria-expanded={open}
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
                  {t('mro2:monitoring.serviceLife', { pct: remainingPct(cluster) })}
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
                      {t('mro2:monitoring.moreComponents', { count: leaves.length - 12 })}
                    </div>
                  ) : null}
                  <LifeChart component={cluster} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Alerts — Pareto + 월별 트렌드 (19p) */}
      <div className="mt-6 mb-2 border-b pb-1 text-[13px]" style={{ borderColor: KC.borderStrong, color: KC.ink }}>
        {t('mro2:monitoring.alerts')}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="border p-3" style={{ borderColor: KC.hairline }}>
          <div className="mb-2 text-[11px] font-bold" style={{ color: KC.ink }}>
            {t('mro2:monitoring.alertPareto')}
          </div>
          <ParetoChart entries={pareto} causeLabel={causeLabel} />
        </div>
        <div className="border p-3" style={{ borderColor: KC.hairline }}>
          <div className="mb-2 flex items-center gap-4">
            <span className="text-[11px] font-bold" style={{ color: KC.ink }}>
              {t('mro2:monitoring.alertsTrend')}
            </span>
            <span className="flex items-center gap-1 text-[9.5px]" style={{ color: KC.text }}>
              <span className="inline-block h-2 w-2" style={{ background: KC.safety }} /> {t('mro2:monitoring.safetyAlerts')}
            </span>
            <span className="flex items-center gap-1 text-[9.5px]" style={{ color: KC.text }}>
              <span className="inline-block h-2 w-2" style={{ background: KC.production }} /> {t('mro2:monitoring.productionAlerts')}
            </span>
          </div>
          <TrendChart buckets={trend} />
        </div>
      </div>

      {/* Operating Statistics — 가동시간 + Load spectrum (20p) */}
      <div className="mt-6 mb-2 border-b pb-1 text-[13px]" style={{ borderColor: KC.borderStrong, color: KC.ink }}>
        {t('mro2:monitoring.operatingStatistics')}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-bold" style={{ color: KC.ink }}>
            {t('mro2:monitoring.runningHours')}
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
                        title={`${c.componentName} — ${c.currentHours.toLocaleString('en-US')} h`}
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
        <SpectrumChart craneId={craneId} />
      </div>
    </div>
  );
}
