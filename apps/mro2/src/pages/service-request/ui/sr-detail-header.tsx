import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Inbox, Smartphone } from 'lucide-react';
import { KC } from '../../../shared/ui/kc';
import { KcFieldRow } from '../../../shared/ui/kc-ui';
import { SrStatusChip } from '../../../shared/ui/sr-status-chip';
import type { SrRow } from '../../../shared/lib/sr-rows';
import { SrAssignFields } from './sr-assign-fields';

/**
 * 상세 머리 띠 — 목록·패널과 같은 문법(상태 칩·긴급·담당·예정)을 맨 위에.
 * 미완료 건은 여기서 담당·예정일을 바로 바꾼다.
 */
export function SrDetailHeader({
  row,
  title,
  scheduled,
  actual,
  summary,
}: {
  row: SrRow;
  /** 내용 한 줄 — 증상·소견·점검 종류 */
  title: string;
  scheduled: string;
  actual?: string | null;
  /** 소견 요약 등 머리 아래 한 줄 */
  summary?: ReactNode;
}) {
  const { t } = useTranslation('mro2');
  const editable =
    row.kind !== 'parts' && row.tone !== 'completed' && !row.untriaged;
  return (
    <div className="mb-4 border-b pb-3" style={{ borderColor: KC.hairline }}>
      <div className="flex flex-wrap items-center gap-2">
        <SrStatusChip
          tone={row.tone}
          alert={row.tone === 'delayed'}
          days={row.overdueDays}
        />
        {row.urgency === 2 ? (
          <span
            className="rounded px-1.5 text-[11px] font-bold"
            style={{ background: KC.safety, color: KC.onSafety }}
          >
            {t('sr.urgent')}
          </span>
        ) : row.urgency === 1 ? (
          <span
            className="rounded px-1.5 text-[11px] font-bold"
            style={{ background: KC.production, color: KC.onProduction }}
          >
            {t('sr.high')}
          </span>
        ) : null}
        <span className="text-[15px] font-bold" style={{ color: KC.ink }}>
          {title}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <KcFieldRow
            k={t('sr.asset')}
            labelWidth={90}
            v={
              <Link
                to={`/mro2/assets/${row.craneId}`}
                className="hover:underline"
                style={{ color: KC.link }}
              >
                {row.craneName}
              </Link>
            }
          />
          <KcFieldRow k={t('sr.scheduledDate')} labelWidth={90} v={scheduled} />
          {actual ? (
            <KcFieldRow k={t('sr.actualDate')} labelWidth={90} v={actual} />
          ) : null}
          {row.reporter ? (
            <KcFieldRow
              k={t('sr.panel.reporter')}
              labelWidth={90}
              v={
                <span className="inline-flex items-center gap-1">
                  <Smartphone size={12} style={{ color: KC.muted }} />
                  {row.reporter}
                </span>
              }
            />
          ) : null}
        </div>
        <div className="kc-no-print">
          {row.untriaged ? (
            <div
              className="rounded-[4px] px-3 py-2 text-[13px]"
              style={{
                background: KC.bgSubtle,
                border: `1px solid ${KC.production}`,
              }}
            >
              <div className="font-bold" style={{ color: KC.ink }}>
                {t('sr.unassigned')}
              </div>
              <Link
                to="/mro2/triage"
                className="mt-1 inline-flex items-center gap-1 font-semibold hover:underline"
                style={{ color: KC.link }}
              >
                <Inbox size={13} /> {t('sr.panel.toInbox')}
              </Link>
            </div>
          ) : editable ? (
            <SrAssignFields
              target={{
                kind: row.kind as 'repair' | 'inspection',
                id: row.key.slice(2),
              }}
              assignee={row.assignee}
              due={row.due.slice(0, 10)}
            />
          ) : (
            <KcFieldRow
              k={t('sr.col.assignee')}
              labelWidth={90}
              v={row.assignee || '-'}
            />
          )}
        </div>
      </div>
      {summary ? (
        <div className="mt-2 text-[13px]" style={{ color: KC.text }}>
          {summary}
        </div>
      ) : null}
      <div className="kc-print-only mt-1 text-[13px]">
        {t('sr.col.assignee')}: {row.assignee || '-'}
      </div>
    </div>
  );
}
