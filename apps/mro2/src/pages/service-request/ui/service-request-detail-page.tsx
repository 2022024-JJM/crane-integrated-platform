import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronUp, FileText, Info } from 'lucide-react';
import { useInspectionDetail } from '@crane/features/inspection';
import { useMaintenanceDetail } from '@crane/features/maintenance';
import type { ChecklistItem, InspectionWO } from '@crane/domain/inspection';
import type { RepairWO } from '@crane/domain/maintenance';
import { FINDING_TONE_COLOR, KC, KC_FONT_DISPLAY, KC_FONT_MONO, usd, type FindingTone } from '../../../shared/ui/kc';
import { KcButton } from '../../../shared/ui/kc-ui';
import { i18n } from '@crane/core/config/i18n';
import { fmtDate } from '../../../shared/lib/service-status';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import { CraneIcon } from '../../../shared/ui/crane-icon';

/* ── 소견 분류: 체크리스트 → findings 심각도 문법 ───────────────────── */

function findingLabel(tone: FindingTone): string {
  return i18n.t(`mro2:finding.${tone}`);
}

function actionLabel(action: string): string {
  return i18n.t(`mro2:action.${action}`, { defaultValue: '-' });
}

function woStatusLabel(status: string): string {
  return i18n.t(`mro2:woStatus.${status}`, { defaultValue: status });
}

function categorize(item: ChecklistItem): FindingTone {
  if (item.judgment === 'fail') {
    return item.severity === 'critical' || item.severity === 'major' ? 'safety' : 'production';
  }
  if (item.judgment === 'na') return 'undetermined';
  if (item.actionRequired === 'monitor') return 'improvement';
  return 'ok';
}

/* ── 접이식 섹션 ────────────────────────────────────────────────────── */

function Section({
  title,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  right?: ReactNode;
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
        <span className="flex items-center gap-2">
          {right}
          {open ? <ChevronUp size={14} style={{ color: KC.ink }} /> : <ChevronDown size={14} style={{ color: KC.ink }} />}
        </span>
      </button>
      {open ? <div className="pt-2">{children}</div> : null}
    </div>
  );
}

function FieldRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex py-0.5 text-[11px]">
      <span className="w-[150px] shrink-0 font-bold" style={{ color: KC.ink }}>
        {k}:
      </span>
      <span style={{ color: KC.text }}>{v}</span>
    </div>
  );
}

/* 소견 카운트 행: ▌15 Safety Risks */
function FindingCount({ tone, count }: { tone: FindingTone; count: number }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11.5px]" style={{ color: KC.ink }}>
      <span className="inline-block h-4 w-[5px]" style={{ background: FINDING_TONE_COLOR[tone] }} />
      <span className="font-bold">{count}</span> {findingLabel(tone)}
    </div>
  );
}

/* 서명 블록 */
function Signature({ name, date }: { name: string; date: string }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-1 pb-4">
      <span
        className="text-[22px]"
        style={{ fontFamily: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive', color: KC.ink }}
      >
        {name}
      </span>
      <span className="border-t px-6 pt-1 text-[10px]" style={{ borderColor: KC.border, color: KC.muted }}>
        {i18n.t('mro2:sr.signature', { date: fmtDate(date), name })}
      </span>
    </div>
  );
}

/* ── 점검 SR 상세 ───────────────────────────────────────────────────── */

type StructureMode = 'findings' | 'complete';

function InspectionDetail({ wo }: { wo: InspectionWO }) {
  const { t } = useTranslation(['mro2', 'calendar']);
  const { openTicket } = useNewTicket();
  const [mode, setMode] = useState<StructureMode>('findings');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const counts: Record<FindingTone, number> = { safety: 0, production: 0, undetermined: 0, improvement: 0, ok: 0 };
  for (const item of wo.checklistItems) counts[categorize(item)] += 1;
  const quotes = wo.checklistItems.filter(
    (c) => c.actionRequired === 'repair_needed' || c.actionRequired === 'immediate_replace',
  ).length;

  const visible = wo.checklistItems.filter((c) => (mode === 'findings' ? categorize(c) !== 'ok' : true));
  const undetermined = wo.checklistItems.filter((c) => categorize(c) === 'undetermined');
  const reportDate = wo.actualDate ?? wo.scheduledDate;

  const toggleItem = (id: string) =>
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const barTotal = counts.safety + counts.production + counts.undetermined + counts.improvement || 1;

  return (
    <>
      <Section title={t('mro2:sr.customerServiceInfo')} defaultOpen={false}>
        <FieldRow k={t('mro2:sr.customer')} v={t('mro2:common.customerName')} />
        <FieldRow k={t('mro2:sr.location')} v={wo.siteName} />
        <FieldRow k={t('mro2:sr.asset')} v={wo.craneName} />
        <FieldRow k={t('mro2:sr.agreementType')} v={t('mro2:sr.timeMaterial')} />
        <FieldRow k={t('mro2:sr.technician')} v={wo.assignedTo} />
        <FieldRow k={t('mro2:sr.scheduledDate')} v={fmtDate(wo.scheduledDate)} />
        <FieldRow k={t('mro2:sr.actualDate')} v={wo.actualDate ? fmtDate(wo.actualDate) : '-'} />
        {wo.totalHours ? <FieldRow k={t('mro2:sr.totalHours')} v={`${wo.totalHours} h`} /> : null}
      </Section>

      <Section title={t('mro2:sr.summary')}>
        <FieldRow k={t('mro2:sr.srStatus')} v={woStatusLabel(wo.status)} />
        <FieldRow
          k={t('mro2:sr.serviceProducts')}
          v={t('mro2:detail.typeInspection', { type: t(`calendar:type.${wo.woType}`) })}
        />
        <FieldRow k={t('mro2:sr.assetsServiced')} v="1" />

        <div className="mt-3 mb-1 text-[11px] font-bold" style={{ color: KC.ink }}>
          {t('mro2:sr.findingsAndActions')}
        </div>
        <div className="flex items-start justify-between pr-6">
          <div>
            <FindingCount tone="safety" count={counts.safety} />
            <FindingCount tone="production" count={counts.production} />
            <FindingCount tone="undetermined" count={counts.undetermined} />
            <FindingCount tone="improvement" count={counts.improvement} />
          </div>
          <div className="pt-1 text-[11.5px]" style={{ color: KC.ink }}>
            <span className="font-bold">{quotes}</span> {t('mro2:common.quotes')}
          </div>
        </div>

        {/* Findings and Actions by Asset — 가로 스택 바 */}
        <div className="mt-4 mb-1 text-[11px]" style={{ color: KC.muted }}>
          {t('mro2:sr.findingsByAsset')}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[90px] truncate text-right text-[10px]" style={{ color: KC.link }}>
            {wo.craneName}
          </span>
          <div className="flex h-[12px] flex-1 overflow-hidden">
            {(['safety', 'production', 'undetermined', 'improvement'] as const).map((tone) =>
              counts[tone] > 0 ? (
                <span
                  key={tone}
                  style={{ width: `${(counts[tone] / barTotal) * 100}%`, background: FINDING_TONE_COLOR[tone] }}
                />
              ) : null,
            )}
          </div>
          <span className="w-6 text-[10px]" style={{ color: KC.muted }}>
            {barTotal}
          </span>
        </div>

        {counts.undetermined > 0 ? (
          <div className="mt-4 border px-3 py-2 text-[10px] leading-relaxed" style={{ borderColor: KC.hairline, color: KC.muted }}>
            <span className="font-bold" style={{ color: KC.ink }}>
              {t('mro2:sr.note')}
            </span>{' '}
            {t('mro2:sr.noteText')}
            <div className="mt-1 flex items-center gap-2" style={{ color: KC.ink }}>
              <span className="inline-block h-3.5 w-[5px]" style={{ background: KC.undetermined }} />
              {t('mro2:sr.undeterminedLegend')}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title={t('mro2:sr.findingsSection')}>
        {/* 자산 헤더 */}
        <div className="mb-2 border px-3 py-2" style={{ borderColor: KC.hairline, background: KC.bgSubtle }}>
          <div className="flex items-center gap-2">
            <CraneIcon type="goliath" size={18} />
            <div>
              <div className="text-[12px] font-bold" style={{ color: KC.ink }}>
                {wo.craneName}
              </div>
              <div className="text-[10px]" style={{ color: KC.muted }}>
                {t('mro2:sr.serviceProductsLine', {
                  product: t('mro2:detail.typeInspection', { type: t(`calendar:type.${wo.woType}`) }),
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 구조 토글 + Expand All */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex">
            {(
              [
                ['findings', t('mro2:sr.onlyFindings')],
                ['complete', t('mro2:sr.completeStructure')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className="cursor-pointer px-2.5 py-1 text-[10.5px]"
                style={{
                  background: mode === key ? KC.inverseBg : KC.bgRow,
                  color: mode === key ? KC.inverseText : KC.text,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            className="cursor-pointer text-[11px]"
            style={{ color: KC.link }}
          >
            {expandAll ? t('mro2:common.collapseAll') : t('mro2:common.expandAll')}
          </button>
        </div>

        {/* 소견 아코디언 */}
        <div className="flex flex-col gap-[3px]">
          {visible.map((item) => {
            const tone = categorize(item);
            const open = expandAll || openItems.has(item.id);
            const needsQuote =
              item.actionRequired === 'repair_needed' || item.actionRequired === 'immediate_replace';
            return (
              <div key={item.id} className="border" style={{ borderColor: KC.hairline }}>
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left"
                  style={{ borderLeft: `5px solid ${FINDING_TONE_COLOR[tone]}` }}
                >
                  {tone !== 'ok' ? (
                    <span className="text-[11px] font-bold" style={{ color: KC.ink }}>
                      !
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-bold" style={{ color: KC.ink }}>
                      {item.itemName}
                    </span>
                    <span className="block text-[10px]" style={{ color: KC.muted }}>
                      {tone === 'undetermined'
                        ? t('mro2:sr.unableToInspect')
                        : item.judgment === 'fail'
                          ? (item.severity ?? t('mro2:sr.fault'))
                          : t('mro2:finding.ok')}
                    </span>
                  </span>
                  {needsQuote ? (
                    <span className="text-[10px]" style={{ color: KC.muted }}>
                      {t('mro2:common.quote')}
                    </span>
                  ) : null}
                  {open ? (
                    <ChevronUp size={13} style={{ color: KC.ink }} />
                  ) : (
                    <ChevronDown size={13} style={{ color: KC.ink }} />
                  )}
                </button>
                {open ? (
                  <div className="border-t px-4 py-2" style={{ borderColor: KC.hairline, background: KC.bgSubtle }}>
                    <FieldRow
                      k={t('mro2:sr.tasks')}
                      v={`${t('mro2:sr.visualAssessment')}${item.measurementValue != null ? `, ${t('mro2:sr.measurementTask')}` : ''}`}
                    />
                    <FieldRow k={t('mro2:sr.dateReported')} v={fmtDate(reportDate)} />
                    <FieldRow k={t('mro2:sr.technician')} v={wo.assignedTo} />
                    <FieldRow k={t('mro2:sr.componentPath')} v={`${item.category} / ${item.itemName}`} />
                    <FieldRow k={t('mro2:sr.taskType')} v={t('mro2:sr.visualAssessment')} />
                    <FieldRow
                      k={t('mro2:sr.faultCode')}
                      v={tone === 'undetermined' ? t('mro2:sr.notInScope') : (item.severity ?? t('mro2:sr.observed'))}
                    />
                    <FieldRow k={t('mro2:sr.risk')} v={findingLabel(tone)} />
                    <FieldRow k={t('mro2:sr.recommendation')} v={actionLabel(item.actionRequired)} />
                    {item.measurementValue != null ? (
                      <FieldRow k={t('mro2:sr.measurement')} v={`${item.measurementValue} ${item.measurementUnit ?? ''}`} />
                    ) : null}
                    {item.comment ? <FieldRow k={t('mro2:sr.comment')} v={item.comment} /> : null}
                    {needsQuote ? (
                      <div className="mt-2 border-t pt-2" style={{ borderColor: KC.hairline }}>
                        <KcButton
                          variant="teal"
                          onClick={() =>
                            openTicket('repair', wo.craneId, {
                              componentName: item.itemName,
                              failureDescription: item.comment ?? item.itemName,
                              sourceWoNumber: wo.woNumber,
                              priority:
                                item.actionRequired === 'stop_operation'
                                  ? 'emergency'
                                  : item.actionRequired === 'immediate_replace'
                                    ? 'high'
                                    : 'normal',
                            })
                          }
                        >
                          {t('mro2:sr.createRepair')}
                        </KcButton>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>

      {undetermined.length > 0 ? (
        <Section
          title={t('mro2:sr.undeterminedSection', { count: undetermined.length })}
          defaultOpen={false}
          right={<Info size={13} style={{ color: KC.link }} />}
        >
          <div className="flex flex-col gap-[3px]">
            {undetermined.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 border px-3 py-1.5"
                style={{ borderColor: KC.hairline, borderLeft: `5px solid ${KC.undetermined}` }}
              >
                <span className="text-[11px] font-bold" style={{ color: KC.ink }}>
                  !
                </span>
                <span className="flex-1 text-[11.5px]" style={{ color: KC.ink }}>
                  {item.itemName}
                </span>
                <span className="text-[10px]" style={{ color: KC.muted }}>
                  {t('mro2:sr.notification')}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {wo.findings ? (
        <div className="mb-4 text-[11px]" style={{ color: KC.text }}>
          <span className="font-bold" style={{ color: KC.ink }}>
            {t('mro2:sr.findingsLabel')}
          </span>{' '}
          {wo.findings}
        </div>
      ) : null}

      {wo.status === 'completed' ? <Signature name={wo.assignedTo} date={reportDate} /> : null}
    </>
  );
}

/* ── 수리 SR 상세 ───────────────────────────────────────────────────── */

function RepairDetail({ wo }: { wo: RepairWO }) {
  const { t } = useTranslation('mro2');
  const tone: FindingTone = wo.priority === 'emergency' ? 'safety' : 'production';
  const [open, setOpen] = useState(true);
  const partsTotal = wo.partsUsed.reduce((s, p) => s + p.qty * p.unitCost, 0);

  return (
    <>
      <Section title={t('sr.customerServiceInfo')} defaultOpen={false}>
        <FieldRow k={t('sr.customer')} v={t('common.customerName')} />
        <FieldRow k={t('sr.location')} v={wo.siteName} />
        <FieldRow k={t('sr.asset')} v={wo.craneName} />
        <FieldRow
          k={t('sr.source')}
          v={`${wo.sourceType.charAt(0).toUpperCase() + wo.sourceType.slice(1)}${wo.sourceWoNumber ? ` (${wo.sourceWoNumber})` : ''}`}
        />
        <FieldRow k={t('sr.technician')} v={wo.assignedTo} />
        <FieldRow k={t('sr.scheduledRange')} v={`${fmtDate(wo.scheduledStart)} – ${fmtDate(wo.scheduledEnd)}`} />
        <FieldRow k={t('sr.actualRange')} v={wo.actualStart ? `${fmtDate(wo.actualStart)} – ${fmtDate(wo.actualEnd)}` : '-'} />
        {wo.downtimeHours != null ? <FieldRow k={t('sr.downtime')} v={`${wo.downtimeHours} h`} /> : null}
      </Section>

      <Section title={t('sr.summary')}>
        <FieldRow k={t('sr.srStatus')} v={woStatusLabel(wo.status)} />
        <FieldRow
          k={t('sr.serviceProducts')}
          v={wo.sourceType === 'breakdown' ? t('sr.onCallRepair') : t('sr.plannedRepairs')}
        />
        <FieldRow k={t('sr.repairLevel')} v={wo.repairLevel} />
        <div className="mt-3 mb-1 text-[11px] font-bold" style={{ color: KC.ink }}>
          {t('sr.findingsAndActions')}
        </div>
        <FindingCount tone={tone} count={1} />
        {wo.status === 'completed' ? (
          <div className="flex items-center gap-2 py-1 text-[11.5px]" style={{ color: KC.ink }}>
            <span className="inline-block h-4 w-[5px]" style={{ background: KC.ok }} />
            <span className="font-bold">1</span> {t('finding.repaired')}
          </div>
        ) : null}
      </Section>

      <Section title={t('sr.findingsSection')}>
        <div className="border" style={{ borderColor: KC.hairline }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left"
            style={{ borderLeft: `5px solid ${wo.status === 'completed' ? KC.ok : FINDING_TONE_COLOR[tone]}` }}
          >
            <span className="text-[11px] font-bold" style={{ color: KC.ink }}>
              !
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-bold" style={{ color: KC.ink }}>
                {wo.componentName}
              </span>
              <span className="block text-[10px]" style={{ color: KC.muted }}>
                {wo.failureType} {t('sr.fault')}
              </span>
            </span>
            {open ? <ChevronUp size={13} style={{ color: KC.ink }} /> : <ChevronDown size={13} style={{ color: KC.ink }} />}
          </button>
          {open ? (
            <div className="border-t px-4 py-2" style={{ borderColor: KC.hairline, background: KC.bgSubtle }}>
              <FieldRow k={t('sr.faultField')} v={wo.failureDescription} />
              <FieldRow k={t('sr.failureType')} v={wo.failureType} />
              <FieldRow k={t('sr.risk')} v={findingLabel(tone)} />
              {wo.rootCause ? <FieldRow k={t('sr.rootCause')} v={wo.rootCause} /> : null}
              {wo.correctiveAction ? <FieldRow k={t('sr.correctiveAction')} v={wo.correctiveAction} /> : null}
              {wo.preventiveAction ? <FieldRow k={t('sr.preventiveAction')} v={wo.preventiveAction} /> : null}
              {wo.reInspectionResult ? <FieldRow k={t('sr.reInspection')} v={wo.reInspectionResult} /> : null}
            </div>
          ) : null}
        </div>
      </Section>

      {wo.partsUsed.length > 0 ? (
        <Section title={t('sr.partsUsed', { count: wo.partsUsed.length })}>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: KC.border, color: KC.muted }}>
                <th className="py-1 font-normal">{t('sr.part')}</th>
                <th className="py-1 text-right font-normal">{t('sr.qty')}</th>
                <th className="py-1 text-right font-normal">{t('sr.unitCost')}</th>
                <th className="py-1 text-right font-normal">{t('sr.total')}</th>
              </tr>
            </thead>
            <tbody>
              {wo.partsUsed.map((p) => (
                <tr key={p.partId} className="border-b" style={{ borderColor: KC.hairline, color: KC.text }}>
                  <td className="py-1">{p.partName}</td>
                  <td className="py-1 text-right">{p.qty}</td>
                  <td className="py-1 text-right">{usd(p.unitCost)}</td>
                  <td className="py-1 text-right">{usd(p.qty * p.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      <Section title={t('sr.costSummary')} defaultOpen={false}>
        <FieldRow k={t('sr.labor')} v={`${wo.laborHours} h · ${usd(wo.laborCost ?? 0)}`} />
        <FieldRow k={t('sr.partsCost')} v={usd(wo.partsCost || partsTotal)} />
        <FieldRow k={t('sr.total')} v={usd(wo.totalCost ?? (wo.laborCost ?? 0) + (wo.partsCost || partsTotal))} />
      </Section>

      {wo.status === 'completed' && wo.actualEnd ? <Signature name={wo.assignedTo} date={wo.actualEnd} /> : null}
    </>
  );
}

/* ── 라우트 엔트리 ──────────────────────────────────────────────────── */

export function Mro2ServiceRequestDetailPage() {
  const { t } = useTranslation('mro2');
  const { kind = '', id = '' } = useParams<{ kind: string; id: string }>();
  const { inspection } = useInspectionDetail(kind === 'inspection' ? id : '');
  const { repair } = useMaintenanceDetail(kind === 'repair' ? id : '');

  const woNumber = kind === 'inspection' ? inspection?.woNumber : repair?.woNumber;

  return (
    <div className="pt-1">
      <Link to="/mro2/service-requests" className="mb-2 flex items-center gap-1 text-[12px]" style={{ color: KC.ink }}>
        <ChevronLeft size={14} /> {t('common.back')}
      </Link>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold tracking-wide" style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}>
          {t('common.serviceRequest')} <span style={{ fontFamily: KC_FONT_MONO }}>{woNumber ?? ''}</span>
        </h2>
        <KcButton variant="teal" onClick={() => window.print()}>
          <FileText size={12} /> {t('common.generateReport')}
        </KcButton>
      </div>
      {kind === 'inspection' && inspection ? <InspectionDetail wo={inspection} /> : null}
      {kind === 'repair' && repair ? <RepairDetail wo={repair} /> : null}
      {(kind === 'inspection' && !inspection) || (kind === 'repair' && !repair) ? (
        <div className="py-8 text-center text-[12px]" style={{ color: KC.muted }}>
          {t('sr.notFound')}
        </div>
      ) : null}
    </div>
  );
}
