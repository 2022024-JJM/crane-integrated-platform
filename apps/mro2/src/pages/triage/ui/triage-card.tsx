import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Package, Wrench } from 'lucide-react';
import type { UploadedDocument } from '@crane/domain/compliance';
import { getTechniciansByPerformerType } from '@crane/domain/shared';
import { KC } from '../../../shared/ui/kc';
import { KcButton } from '../../../shared/ui/kc-ui';
import type { TriageRow } from '../lib/triage-rows';

type PerformerType = 'internal' | 'third_party' | 'local';
const todayIso = () => new Date().toISOString().slice(0, 10);

export interface TriageAssignment {
  assignedTo: string;
  performerType: PerformerType;
  scheduledDate: string;
  priority: string;
}

const URGENCY_COLOR = [KC.planned, KC.production, KC.safety] as const;
const KIND_ICON = {
  repair: Wrench,
  inspection: ClipboardCheck,
  parts: Package,
} as const;

/**
 * 접수함 카드 — 보고 내용(왼쪽)과 처리 폼(오른쪽). 수리·점검은 담당자·일정·
 * 우선순위를 정해 [배정], 점검에 이상이 있으면 [수리 요청 생성]이 먼저,
 * 부품은 [승인]/[반려].
 */
export function TriageCard({
  row,
  photos,
  waitedLabel,
  priorityOptions,
  onAssign,
  onParts,
  onCreateRepair,
  onAcknowledge,
}: {
  row: TriageRow;
  photos: UploadedDocument[];
  waitedLabel: string;
  priorityOptions: Array<{ value: string; label: string }>;
  onAssign: (a: TriageAssignment) => void;
  onParts: (status: 'approved' | 'cancelled') => void;
  onCreateRepair: () => void;
  onAcknowledge: () => void;
}) {
  const { t } = useTranslation();
  const [performerType, setPerformerType] = useState<PerformerType>('internal');
  const technicians = getTechniciansByPerformerType(performerType);
  const [assignedTo, setAssignedTo] = useState(technicians[0]?.name ?? '');
  const [date, setDate] = useState(todayIso());
  const [priority, setPriority] = useState(
    priorityOptions[row.urgency === 2 ? 0 : row.urgency === 1 ? 1 : 2]?.value ??
      priorityOptions[0]!.value,
  );
  const Icon = KIND_ICON[row.kind];
  const resolvedAssignee = technicians.some((x) => x.name === assignedTo)
    ? assignedTo
    : (technicians[0]?.name ?? '');

  const field = 'h-8 rounded px-2 text-[13px]';
  const fieldStyle = {
    background: KC.bg,
    border: `1px solid ${KC.borderStrong}`,
    color: KC.ink,
  } as const;

  return (
    <article
      className="grid grid-cols-1 gap-4 rounded p-4 lg:grid-cols-[1fr_320px]"
      style={{
        background: KC.bgSubtle,
        border: `1px solid ${KC.border}`,
        borderLeft: `4px solid ${URGENCY_COLOR[row.urgency]}`,
        borderRadius: KC.radius,
      }}
    >
      <div className="min-w-0">
        <div
          className="flex flex-wrap items-center gap-2 text-[13px]"
          style={{ color: KC.muted }}
        >
          <Icon size={14} style={{ color: KC.ink }} />
          <span className="font-mono font-semibold" style={{ color: KC.ink }}>
            {row.number}
          </span>
          <span>{t(`mro2:field.kind.${row.kind}`)}</span>
          <span>·</span>
          <Link to={`/mro2/assets/${row.craneId}`} style={{ color: KC.link }}>
            {row.craneName}
          </Link>
          <span className="ml-auto">
            {t('mro2:triage.reportedBy', { name: row.reportedBy })} ·{' '}
            {waitedLabel}
          </span>
        </div>
        <p
          className="mt-2 text-[15px] font-semibold break-words"
          style={{ color: KC.ink }}
        >
          {row.title || '—'}
        </p>
        {row.subtitle ? (
          <p className="mt-0.5 text-[13px]" style={{ color: KC.text }}>
            {row.kind === 'inspection'
              ? t(`calendar:type.${row.subtitle}`)
              : row.subtitle}
          </p>
        ) : null}
        {photos.length > 0 ? (
          <div className="mt-3 flex gap-2">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.objectUrl}
                target="_blank"
                rel="noreferrer"
                className="h-16 w-16 overflow-hidden rounded"
                style={{ background: KC.bg }}
              >
                <img
                  src={p.objectUrl}
                  alt={p.fileName}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {row.completed ? (
        <div className="flex flex-wrap items-start gap-2 lg:justify-end">
          {row.needsRepair ? (
            <KcButton variant="dark" onClick={onCreateRepair}>
              {t('mro2:triage.createRepair')}
            </KcButton>
          ) : null}
          <KcButton variant="teal" onClick={onAcknowledge}>
            {t('mro2:triage.acknowledge')}
          </KcButton>
        </div>
      ) : row.kind === 'parts' ? (
        <div className="flex items-start gap-2 lg:justify-end">
          <KcButton variant="teal" onClick={() => onParts('approved')}>
            {t('mro2:triage.approve')}
          </KcButton>
          <KcButton variant="outline" onClick={() => onParts('cancelled')}>
            {t('mro2:triage.reject')}
          </KcButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label={t('mro2:ticket.performer')}
              value={performerType}
              onChange={(e) =>
                setPerformerType(e.target.value as PerformerType)
              }
              className={field}
              style={fieldStyle}
            >
              <option value="internal">{t('mro2:ticket.internal')}</option>
              <option value="third_party">{t('mro2:ticket.thirdParty')}</option>
              <option value="local">{t('mro2:ticket.local')}</option>
            </select>
            <select
              aria-label={t('mro2:ticket.assignee')}
              value={resolvedAssignee}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={field}
              style={fieldStyle}
            >
              {technicians.map((x) => (
                <option key={x.id} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
            <input
              aria-label={t('mro2:ticket.scheduledDate')}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={field}
              style={fieldStyle}
            />
            <select
              aria-label={t('mro2:ticket.priority')}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={field}
              style={fieldStyle}
            >
              {priorityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.needsRepair ? (
              <KcButton variant="dark" onClick={onCreateRepair}>
                {t('mro2:triage.createRepair')}
              </KcButton>
            ) : null}
            <KcButton
              variant="teal"
              disabled={!resolvedAssignee}
              onClick={() =>
                onAssign({
                  assignedTo: resolvedAssignee,
                  performerType,
                  scheduledDate: date,
                  priority,
                })
              }
            >
              {t('mro2:triage.assign')}
            </KcButton>
          </div>
        </div>
      )}
    </article>
  );
}
