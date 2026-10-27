import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@crane/features/auth';
import { useDocuments } from '@crane/features/compliance';
import { useTriageActions, useTriageQueue } from '@crane/features/triage';
import { KC } from '../../../shared/ui/kc';
import { KcEmpty, KcSectionHeading } from '../../../shared/ui/kc-ui';
import { useNewTicket } from '../../../shared/lib/use-new-ticket';
import {
  buildTriageRows,
  waitedMinutes,
  type TriageRow,
} from '../lib/triage-rows';
import { FIELD_PATH } from '../../field/lib/field-route';
import { TriageCard, type TriageAssignment } from './triage-card';

/**
 * 접수함(관리자) — 현장에서 올라온 티켓 중 아직 처리하지 않은 것. 처리하면
 * 현장 작업자의 "내 티켓" 상태가 바로 바뀐다. 수리·점검은 담당자·일정·
 * 우선순위 확정, 점검 이상은 수리 요청으로 연결, 부품은 승인/반려.
 */
export function Mro2TriagePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queue = useTriageQueue();
  const rows = useMemo(() => buildTriageRows(queue), [queue]);
  const { uploads } = useDocuments();
  const { triageRepair, triageInspection, triageParts, acknowledgeInspection } =
    useTriageActions(user?.id ?? 'admin');
  const { openTicket } = useNewTicket();
  // 기다린 시간의 기준 시각 — 렌더 중 Date.now() 는 순수하지 않으므로 마운트 때 한 번.
  const [now] = useState(() => Date.now());

  const repairPriorities = [
    { value: 'emergency', label: t('mro2:ticket.prioEmergency') },
    { value: 'high', label: t('mro2:ticket.prioHigh') },
    { value: 'normal', label: t('mro2:ticket.prioNormal') },
    { value: 'low', label: t('mro2:ticket.prioLow') },
  ];
  const inspectionPriorities = [
    { value: 'urgent', label: t('mro2:field.prio.urgent') },
    { value: 'high', label: t('mro2:ticket.prioHigh') },
    { value: 'normal', label: t('mro2:ticket.prioNormal') },
    { value: 'low', label: t('mro2:ticket.prioLow') },
  ];

  const assign = (row: TriageRow, a: TriageAssignment) => {
    const ok =
      row.kind === 'repair'
        ? triageRepair(row.id, {
            assignedTo: a.assignedTo,
            performerType: a.performerType,
            priority: a.priority as 'emergency' | 'high' | 'normal' | 'low',
            scheduledStart: a.scheduledDate,
            scheduledEnd: a.scheduledDate,
          })
        : triageInspection(row.id, {
            assignedTo: a.assignedTo,
            performerType: a.performerType,
            priority: a.priority as 'urgent' | 'high' | 'normal' | 'low',
            scheduledDate: a.scheduledDate,
          });
    if (ok)
      toast.success(
        t('mro2:triage.assigned', { number: row.number, name: a.assignedTo }),
      );
  };

  const waitedLabel = (reportedAt: string) => {
    const m = waitedMinutes(reportedAt, now);
    if (m < 60) return t('mro2:triage.waitedMinutes', { n: m });
    if (m < 60 * 24)
      return t('mro2:triage.waitedHours', { n: Math.floor(m / 60) });
    return t('mro2:triage.waitedDays', { n: Math.floor(m / 1440) });
  };

  return (
    <div className="pt-2">
      <KcSectionHeading
        right={
          <span className="flex items-center gap-3 text-[13px]">
            <span style={{ color: KC.muted }}>
              {t('mro2:triage.count', { n: rows.length })}
            </span>
            {/* 데스크톱 메뉴엔 현장 화면이 없다 — 데모·확인용 진입점은 여기 하나 */}
            <Link
              to={FIELD_PATH}
              className="inline-flex items-center gap-1"
              style={{ color: KC.link }}
            >
              <Smartphone size={12} /> {t('mro2:triage.openField')}
            </Link>
          </span>
        }
      >
        {t('mro2:triage.title')}
      </KcSectionHeading>
      {rows.length === 0 ? (
        <KcEmpty>{t('mro2:triage.empty')}</KcEmpty>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <TriageCard
              key={`${row.kind}-${row.id}`}
              row={row}
              photos={uploads.filter(
                (d) => d.refWoNumber === row.number && d.objectUrl,
              )}
              waitedLabel={waitedLabel(row.reportedAt)}
              priorityOptions={
                row.kind === 'inspection'
                  ? inspectionPriorities
                  : repairPriorities
              }
              onAssign={(a) => assign(row, a)}
              onParts={(status) => {
                const res = triageParts(row.id, status);
                if (!res.ok) return;
                const f = res.fulfillment;
                toast.success(
                  t(
                    status === 'approved'
                      ? 'mro2:triage.approved'
                      : 'mro2:triage.rejected',
                    { number: row.number },
                  ),
                  f
                    ? {
                        description: [
                          f.issued.length > 0
                            ? t('mro2:triage.fulfillIssued', {
                                n: f.issued.length,
                              })
                            : null,
                          f.poNumber
                            ? t('mro2:triage.fulfillOrdered', {
                                n: f.ordered.length,
                                po: f.poNumber,
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      }
                    : undefined,
                );
              }}
              onAcknowledge={() => {
                if (acknowledgeInspection(row.id)) {
                  toast.success(
                    t('mro2:triage.acknowledged', { number: row.number }),
                  );
                }
              }}
              onCreateRepair={() =>
                openTicket('repair', row.craneId, {
                  sourceWoNumber: row.number,
                  failureDescription: row.title,
                  priority: 'high',
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
