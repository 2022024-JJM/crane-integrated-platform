import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@crane/features/auth';
import { useDocuments, useUploadDocument } from '@crane/features/compliance';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { useCreateRepairTicket } from '@crane/features/ticket';
import { useTriageActions, useTriageQueue } from '@crane/features/triage';
import { getInspectionWOById } from '@crane/domain/inspection';
import { getTechnicians, logActivity } from '@crane/domain/shared';
import { KC } from '../../../shared/ui/kc';
import { KcEmpty, KcSectionHeading } from '../../../shared/ui/kc-ui';
import { fmtDate } from '../../../shared/lib/service-status';
import {
  buildTriageRows,
  waitedMinutes,
  type TriageRow,
} from '../lib/triage-rows';
import { buildRepairFromInspection } from '../lib/convert-inspection';
import {
  suggestAssignment,
  type AssignmentSuggestion,
} from '../lib/suggest-assignment';
import { FIELD_PATH } from '../../field/lib/field-route';
import { TriageCard, type TriageAssignment } from './triage-card';

/**
 * 접수함(관리자) — 현장에서 올라온 티켓 중 아직 처리하지 않은 것. 처리하면
 * 현장 작업자의 "내 티켓" 상태가 바로 바뀐다. 수리·점검은 추천값으로 채워진
 * 담당자·일정·우선순위를 [배정] 으로 확정, 점검 이상은 [수리로 전환] 한 번에
 * 수리 요청 생성·배정·접수까지, 부품은 승인/반려, 완료 보고는 [확인].
 */
export function Mro2TriagePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const admin = user?.id ?? 'admin';
  const queue = useTriageQueue();
  const rows = useMemo(() => buildTriageRows(queue), [queue]);
  const { uploads } = useDocuments();
  const upload = useUploadDocument();
  const { repairs } = useMaintenanceList();
  const { inspections } = useInspectionList();
  const createRepair = useCreateRepairTicket();
  const {
    triageRepair,
    triageInspection,
    triageParts,
    acknowledgeInspection,
    acknowledgeRepair,
  } = useTriageActions(admin);
  // 기다린 시간의 기준 시각 — 렌더 중 Date.now() 는 순수하지 않으므로 마운트 때 한 번.
  const [now] = useState(() => Date.now());
  const today = useMemo(() => new Date(now).toISOString().slice(0, 10), [now]);
  const suggestions = useMemo(() => {
    const ctx = { repairs, inspections, technicians: getTechnicians(), today };
    const out = new Map<string, AssignmentSuggestion | null>();
    for (const row of rows) {
      if (row.kind === 'parts' || row.completed) continue;
      out.set(
        `${row.kind}-${row.id}`,
        suggestAssignment(
          {
            kind: row.kind,
            id: row.id,
            craneId: row.craneId,
            reportedBy: row.reportedBy,
            urgency: row.urgency,
          },
          ctx,
        ),
      );
    }
    return out;
  }, [rows, repairs, inspections, today]);

  /**
   * 점검 불량 → 수리 한 번에: 불량 항목으로 수리 요청을 만들고 추천 담당·일정으로
   * 접수까지 끝낸다. 사진은 새 WO 번호로도 보이게 복사하고, 점검은 확인 처리한다.
   */
  const convertToRepair = (row: TriageRow) => {
    const wo = getInspectionWOById(row.id);
    if (!wo) return;
    const suggestion = suggestAssignment(
      {
        kind: 'repair',
        id: row.id,
        craneId: row.craneId,
        reportedBy: row.reportedBy || wo.assignedTo,
        urgency: 1,
      },
      { repairs, inspections, technicians: getTechnicians(), today },
    );
    if (!suggestion) return;
    const draft = buildRepairFromInspection(wo, suggestion, {
      now: new Date().toISOString(),
      triagedBy: admin,
      ko: i18n.language.startsWith('ko'),
    });
    const created = createRepair(draft);
    logActivity({
      kind: 'repair',
      refId: created.id,
      type: 'triaged',
      by: admin,
      detail: suggestion.assignedTo,
    });
    for (const d of uploads) {
      if (d.refWoNumber !== wo.woNumber || !d.objectUrl) continue;
      upload({
        fileName: d.fileName,
        docType: d.docType,
        craneId: d.craneId,
        craneName: d.craneName,
        uploadedBy: d.uploadedBy,
        sizeBytes: d.sizeBytes,
        objectUrl: d.objectUrl,
        refWoNumber: created.woNumber,
      });
    }
    // 점검 쪽은 확인 처리 — 완료 전이면 접수 표식을 찍어 접수함에서 뺀다.
    if (!acknowledgeInspection(row.id))
      triageInspection(row.id, {
        assignedTo: wo.assignedTo,
        performerType: wo.performerType,
        priority: wo.priority,
        scheduledDate: wo.scheduledDate,
      });
    toast.success(
      t('mro2:triage.converted', {
        number: created.woNumber,
        name: suggestion.assignedTo,
        date: fmtDate(suggestion.scheduledDate),
      }),
    );
  };

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
              suggestion={suggestions.get(`${row.kind}-${row.id}`) ?? null}
              onAcknowledge={() => {
                const ok =
                  row.kind === 'repair'
                    ? acknowledgeRepair(row.id)
                    : acknowledgeInspection(row.id);
                if (ok)
                  toast.success(
                    t('mro2:triage.acknowledged', { number: row.number }),
                  );
              }}
              onCreateRepair={() => convertToRepair(row)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
