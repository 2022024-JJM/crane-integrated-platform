import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Inbox, MessageSquare, Siren } from 'lucide-react';
import { playAlertSound } from '@crane/core/lib/alert-notifications';
import { useAllNotes } from '@crane/features/notes';
import { useTriageQueue } from '@crane/features/triage';
import { KC } from '../kc';
import { useSeen } from '../../lib/seen-store';
import { sumCounts, unreadByRef } from '../../lib/timeline';

/**
 * 관리 화면 상단 알림 — 현장 접수(긴급 따로)와 읽지 않은 현장 메모. 긴급 접수가
 * 늘어나는 순간 소리를 낸다. 3D 관제의 종 모양 알람과는 별개다.
 */
export function Mro2Alerts() {
  const { t } = useTranslation('mro2');
  const queue = useTriageQueue();
  const emergencies = useMemo(
    () => queue.repairs.filter((r) => r.priority === 'emergency').length,
    [queue.repairs],
  );
  const notes = useAllNotes();
  const seen = useSeen('office');
  const unread = useMemo(
    () => sumCounts(unreadByRef(notes, 'office', seen)),
    [notes, seen],
  );
  const prev = useRef(emergencies);
  useEffect(() => {
    if (emergencies > prev.current) playAlertSound('critical');
    prev.current = emergencies;
  }, [emergencies]);

  if (queue.total === 0 && unread === 0) return null;
  return (
    <div className="mr-auto flex items-center gap-2 text-[13px] font-semibold">
      {queue.total > 0 ? (
        <Link
          to="/mro2/triage"
          className="flex h-7 items-center gap-1.5 rounded px-2.5"
          style={{
            background: emergencies > 0 ? KC.safety : KC.inverseBg,
            color: emergencies > 0 ? KC.onSafety : KC.inverseText,
            borderRadius: KC.radius,
          }}
        >
          {emergencies > 0 ? <Siren size={14} /> : <Inbox size={14} />}
          {emergencies > 0
            ? t('alerts.inboxEmergency', { n: queue.total, e: emergencies })
            : t('alerts.inbox', { n: queue.total })}
        </Link>
      ) : null}
      {unread > 0 ? (
        <Link
          to="/mro2/service-requests?tab=all&notes=1"
          className="flex h-7 items-center gap-1.5 rounded px-2.5"
          style={{
            border: `1px solid ${KC.teal}`,
            color: KC.teal,
            borderRadius: KC.radius,
          }}
        >
          <MessageSquare size={14} /> {t('alerts.notes', { n: unread })}
        </Link>
      ) : null}
    </div>
  );
}
