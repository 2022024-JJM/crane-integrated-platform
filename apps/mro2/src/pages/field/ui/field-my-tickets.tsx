import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEntityTicks } from '@crane/features/shared';
import { useAllNotes } from '@crane/features/notes';
import { markSeen, useSeen } from '../../../shared/lib/seen-store';
import { unreadByRef } from '../../../shared/lib/timeline';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { getAllPartsRequests } from '@crane/domain/inventory';
import { KC } from '../../../shared/ui/kc';
import { useFieldWorker } from '../lib/field-storage';
import {
  MY_TICKET_GROUPS,
  collectMyTickets,
  groupMyTickets,
  myTicketTone,
  type MyTicketRow,
  type MyTicketTone,
} from '../lib/my-tickets';
import { FIELD_PATH, fieldTicketPath } from '../lib/field-route';
import { FieldShell } from './field-shell';

const TONE_COLOR: Record<MyTicketTone, string> = {
  done: 'var(--kc-ok)',
  active: 'var(--kc-production)',
  waiting: 'var(--kc-planned)',
};

/** 내 티켓 목록 — 홈 요약(limit)과 전체 화면이 같이 쓴다. */
export function MyTicketsList({ limit }: { limit?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [worker] = useFieldWorker();
  const { repairs } = useMaintenanceList();
  const { inspections } = useInspectionList();
  const partsTick = useEntityTicks(['parts']);
  const notes = useAllNotes();
  const seen = useSeen('field');
  const unread = useMemo(
    () => unreadByRef(notes, 'field', seen),
    [notes, seen],
  );
  const rows = useMemo(
    () =>
      collectMyTickets(
        worker,
        repairs,
        inspections,
        getAllPartsRequests(),
        limit,
      ),
    // partsTick 은 부품 요청 배열이 바뀐 프레임을 잡는 구독값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [worker, repairs, inspections, partsTick, limit],
  );
  if (!worker) {
    return (
      <p className="text-[14px]" style={{ color: KC.muted }}>
        {t('mro2:field.workerFirst')}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-[14px]" style={{ color: KC.muted }}>
        {t('mro2:field.noTickets')}
      </p>
    );
  }
  const groups = groupMyTickets(rows, new Date().toISOString().slice(0, 10));
  const statusLabel = (r: MyTicketRow) =>
    r.kind === 'parts'
      ? t(`mro2:field.tone.${myTicketTone(r.status)}`)
      : t(`mro2:woStatus.${r.status}`, { defaultValue: r.status });
  const titleOf = (r: MyTicketRow) =>
    r.title ||
    (r.kind === 'inspection' && r.woType
      ? t('mro2:detail.typeInspection', {
          type: t(`calendar:type.${r.woType}`),
        })
      : t(`mro2:field.kind.${r.kind}`));
  return (
    <div className="flex flex-col gap-4">
      {MY_TICKET_GROUPS.filter((g) => groups[g].length > 0).map((g) => (
        <section key={g}>
          <h3
            className="mb-1.5 text-[13px] font-bold"
            style={{ color: g === 'overdue' ? KC.safety : KC.muted }}
          >
            {t(`mro2:field.group.${g}`)} {groups[g].length}
          </h3>
          <ul className="flex flex-col gap-2">
            {groups[g].map((r) => {
              const tone = myTicketTone(r.status);
              const unreadN = unread[`${r.kind}:${r.id}`] ?? 0;
              const to = fieldTicketPath(r.kind, r.id);
              return (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => navigate(to)}
                    className="flex w-full items-center gap-3 rounded p-3 text-left"
                    style={{
                      background: KC.bgSubtle,
                      border: `1px solid ${KC.border}`,
                      borderRadius: KC.radius,
                    }}
                  >
                    <span
                      className="h-10 w-1 shrink-0 rounded"
                      style={{ background: TONE_COLOR[tone] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="flex items-center justify-between gap-2 text-[15px] font-semibold"
                        style={{ color: KC.ink }}
                      >
                        <span className="truncate">{r.craneName}</span>
                        {unreadN > 0 ? (
                          <span
                            className="shrink-0 rounded px-1.5 text-[12px] font-bold"
                            style={{ background: KC.teal, color: KC.onTeal }}
                          >
                            {t('mro2:field.badge.notes', { n: unreadN })}
                          </span>
                        ) : null}
                        <span
                          className="shrink-0 text-[13px] font-normal"
                          style={{ color: KC.muted }}
                        >
                          {statusLabel(r)}
                        </span>
                      </span>
                      <span
                        className="block truncate text-[14px]"
                        style={{ color: KC.text }}
                      >
                        {titleOf(r)}
                      </span>
                      <span
                        className="font-mono text-[12px]"
                        style={{ color: KC.faint }}
                      >
                        {r.number}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FieldMyTickets() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // 목록을 연 시각 — "새 배정" 배지의 기준
  useEffect(() => {
    markSeen('field', '*');
  }, []);
  return (
    <FieldShell
      title={t('mro2:field.myTickets')}
      onBack={() => navigate(FIELD_PATH)}
      backLabel={t('mro2:field.back')}
    >
      <MyTicketsList />
    </FieldShell>
  );
}
