import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useEntityTicks } from '@crane/features/shared';
import { useInspectionList } from '@crane/features/inspection';
import { useMaintenanceList } from '@crane/features/maintenance';
import { getAllPartsRequests } from '@crane/domain/inventory';
import { KC } from '../../../shared/ui/kc';
import { useFieldWorker } from '../lib/field-storage';
import {
  collectMyTickets,
  myTicketTone,
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
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const tone = myTicketTone(r.status);
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
                  className="flex items-center justify-between gap-2 text-[13px]"
                  style={{ color: KC.muted }}
                >
                  <span className="font-mono">{r.number}</span>
                  <span>{t(`mro2:field.tone.${tone}`)}</span>
                </span>
                <span
                  className="block truncate text-[15px] font-semibold"
                  style={{ color: KC.ink }}
                >
                  {r.craneName}
                </span>
                <span
                  className="block truncate text-[14px]"
                  style={{ color: KC.text }}
                >
                  {r.title || t(`mro2:field.kind.${r.kind}`)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function FieldMyTickets() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
