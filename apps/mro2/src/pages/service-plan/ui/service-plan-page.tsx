import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { KC, KC_FONT_DISPLAY, SERVICE_TONE_COLOR } from '../../../shared/ui/kc';
import { KcSectionHeading, KcStat } from '../../../shared/ui/kc-ui';
import { useMro2Year } from '../../../shared/ui/layout';
import { computeSpend } from '../../../shared/lib/spend';
import { fmtDate } from '../../../shared/lib/service-status';
import { usd } from '../../../shared/ui/kc';
import { buildServicePlan, type PlanCell, type PlanRow } from '../lib/build-plan';

/* ── 접이식 섹션 (매뉴얼 6p 스타일) ─────────────────────────────────── */

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 border-b pb-3" style={{ borderColor: KC.hairline }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between py-1 text-left"
      >
        <span className="text-[13px] font-bold" style={{ color: KC.ink }}>
          {title}
        </span>
        {open ? <ChevronUp size={14} style={{ color: KC.ink }} /> : <ChevronDown size={14} style={{ color: KC.ink }} />}
      </button>
      {open ? <div className="pt-2">{children}</div> : null}
    </div>
  );
}

function FieldRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex py-1 text-[12.5px]">
      <span className="w-[170px] shrink-0 font-bold" style={{ color: KC.ink }}>
        {k}:
      </span>
      <span style={{ color: KC.text }}>{v}</span>
    </div>
  );
}

/* ── 히트맵 셀 ──────────────────────────────────────────────────────── */

function Cell({ cell }: { cell: PlanCell | null }) {
  if (!cell) return <span className="flex h-10 items-center justify-center" />;
  return (
    <span className="flex h-10 items-center justify-center">
      <span
        className="inline-flex h-[28px] min-w-[28px] items-center justify-center rounded-[4px] px-1.5 text-[13px] font-bold text-white"
        style={{ background: SERVICE_TONE_COLOR[cell.tone], fontFamily: KC_FONT_DISPLAY }}
      >
        {cell.count}
      </span>
    </span>
  );
}

const GRID_COLS = 'minmax(210px, 300px) repeat(12, minmax(48px, 1fr)) 34px';

function PlanGridRow({
  row,
  bold,
  indent,
  right,
}: {
  row: PlanRow;
  bold?: boolean;
  indent?: boolean;
  right?: ReactNode;
}) {
  return (
    <div
      className="grid items-center border-b"
      style={{ gridTemplateColumns: GRID_COLS, borderColor: KC.hairline }}
    >
      <span
        className={`truncate py-1 ${bold ? 'text-[14px] font-bold' : 'text-[12.5px]'}`}
        style={{ color: bold ? KC.link : KC.muted, paddingLeft: indent ? 18 : 0 }}
      >
        {row.label}
      </span>
      {row.cells.map((cell, m) => (
        <Cell key={m} cell={cell} />
      ))}
      <span className="flex justify-end">{right}</span>
    </div>
  );
}

/* ── 페이지 ─────────────────────────────────────────────────────────── */

export function Mro2ServicePlanPage() {
  const { t } = useTranslation(['mro2', 'calendar']);
  const navigate = useNavigate();
  const { year } = useMro2Year();
  const { inspections } = useInspectionList();
  const { repairs } = useMaintenanceList();
  const [openAssets, setOpenAssets] = useState<Set<string>>(new Set());

  const MONTHS_SHORT = t('mro2:calendar.monthsShort', { returnObjects: true }) as string[];

  const plan = useMemo(
    () =>
      buildServicePlan(inspections, repairs, year, {
        inspectionProduct: (woType) =>
          t('mro2:detail.typeInspection', { type: t(`calendar:type.${woType}`) }),
        repairProduct: (sourceType) =>
          sourceType === 'breakdown' ? t('mro2:sr.onCallRepair') : t('mro2:sr.plannedRepairs'),
      }),
    [inspections, repairs, year, t],
  );
  const spend = useMemo(() => computeSpend(inspections, repairs, year), [inspections, repairs, year]);

  const pct = (n: number) => (plan.summary.total > 0 ? Math.round((n / plan.summary.total) * 100) : 0);

  const toggleAsset = (id: string) =>
    setOpenAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const goMonth = (m: number) => navigate(`/mro2/calendar?m=${m}`);

  return (
    <div className="pt-1">
      <KcSectionHeading>{t('mro2:plan.title')}</KcSectionHeading>

      {/* 계약 정보 */}
      <Section title={t('mro2:plan.agreementInfo')} defaultOpen={false}>
        <FieldRow k={t('mro2:plan.name')} v={`HPSI Planned Maintenance — ${t('mro2:common.customerName')}`} />
        <FieldRow k={t('mro2:plan.number')} v="HPSI-MA-2026-001" />
        <FieldRow k={t('mro2:plan.type')} v={t('mro2:plan.evergreen')} />
        <FieldRow k={t('mro2:plan.statusLabel')} v={t('mro2:plan.active')} />
        <FieldRow k={t('mro2:plan.startDate')} v={fmtDate('2026-01-01')} />
        <FieldRow k={t('mro2:plan.billing')} v={t('mro2:sr.timeMaterial')} />
        <FieldRow k={t('mro2:ticket.asset')} v={String(plan.assets.length)} />
        <FieldRow k={t('mro2:plan.contact')} v="정종민 · HPSI Service" />
      </Section>

      {/* 요약 */}
      <Section title={t('mro2:plan.summary')}>
        <div className="mb-4 flex items-start justify-around">
          <KcStat value={usd(spend.total)} label={t('mro2:plan.annualSpend')} size="lg" />
          <KcStat value={plan.products.length} label={t('mro2:plan.products')} size="lg" />
          <KcStat value={plan.assets.length} label={t('mro2:nav.assets')} size="lg" />
          <KcStat value={t('mro2:plan.evergreen')} label={t('mro2:plan.validity')} size="lg" />
        </div>
        <div className="mb-1 text-[11px] font-bold" style={{ color: KC.ink }}>
          {t('mro2:plan.productsIncluded')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {plan.products.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-[12px]"
              style={{ background: KC.bgRow, color: KC.text }}
            >
              {p}
              <Check size={11} style={{ color: KC.ok }} />
            </span>
          ))}
        </div>
      </Section>

      {/* 자산 및 서비스 플랜 */}
      <Section title={t('mro2:plan.planTitle')}>
        {/* 상태 요약 (88% Completed 스타일) */}
        <div className="mb-1 text-[11px] font-bold" style={{ color: KC.ink }}>
          {t('mro2:plan.serviceStatus')}
        </div>
        <div className="mb-0.5 text-[10px]" style={{ color: KC.faint }}>
          {year}
        </div>
        <div className="mb-5 flex items-start justify-around">
          <KcStat
            value={`${pct(plan.summary.completed)}%`}
            label={t('mro2:status.completed')}
            tone={SERVICE_TONE_COLOR.completed}
            size="lg"
          />
          <KcStat
            value={`${pct(plan.summary.open)}%`}
            label={t('mro2:status.open')}
            tone={SERVICE_TONE_COLOR.open}
            size="lg"
          />
          <KcStat
            value={`${pct(plan.summary.inProgress)}%`}
            label={t('mro2:status.inProgress')}
            tone={SERVICE_TONE_COLOR.inProgress}
            size="lg"
          />
          <KcStat
            value={`${pct(plan.summary.delayed)}%`}
            label={t('mro2:status.delayed')}
            tone={SERVICE_TONE_COLOR.delayed}
            size="lg"
          />
        </div>

        {/* 셀 색 범례 */}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {(['completed', 'inProgress', 'open', 'delayed'] as const).map((tone) => (
            <span key={tone} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: KC.text }}>
              <span
                className="inline-block h-3.5 w-3.5 rounded-[3px]"
                style={{ background: SERVICE_TONE_COLOR[tone] }}
              />
              {t(`mro2:status.${tone}`)}
            </span>
          ))}
        </div>

        {/* 헤더: 월 (클릭 → 캘린더) */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid items-center border-b pb-1" style={{ gridTemplateColumns: GRID_COLS, borderColor: KC.borderStrong }}>
              <span className="text-[13px] font-bold" style={{ color: KC.ink }}>
                {t('mro2:plan.planTitle')}
              </span>
              {MONTHS_SHORT.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => goMonth(i)}
                  className="kc-hover cursor-pointer rounded-[3px] py-1.5 text-center text-[13px] font-semibold"
                  style={{ color: KC.text, fontFamily: KC_FONT_DISPLAY }}
                  title={t('mro2:plan.monthHint')}
                >
                  {m}
                </button>
              ))}
              <span />
            </div>

            {plan.assets.map((asset) => {
              const open = openAssets.has(asset.craneId);
              return (
                <div key={asset.craneId}>
                  <button
                    type="button"
                    onClick={() => toggleAsset(asset.craneId)}
                    className="kc-hover block w-full cursor-pointer text-left"
                  >
                    <PlanGridRow
                      row={asset.total}
                      bold
                      right={
                        open ? (
                          <ChevronUp size={13} style={{ color: KC.muted }} />
                        ) : (
                          <ChevronDown size={13} style={{ color: KC.muted }} />
                        )
                      }
                    />
                  </button>
                  {open
                    ? asset.products.map((row) => <PlanGridRow key={row.key} row={row} indent />)
                    : null}
                </div>
              );
            })}
            {plan.assets.length === 0 ? (
              <div className="py-8 text-center text-[12px]" style={{ color: KC.muted }}>
                {t('mro2:sr.noRequests')}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-2 text-[10px]" style={{ color: KC.faint }}>
          {t('mro2:plan.monthHint')}
        </div>
      </Section>
    </div>
  );
}
