import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send } from 'lucide-react';
import type { NoteRefKind, NoteSide } from '@crane/domain/shared';
import { useActivities } from '@crane/features/activity';
import { useAddNote, useNotes } from '@crane/features/notes';
import { KC } from './kc';
import { buildTimeline } from '../lib/timeline';
import { markSeen } from '../lib/seen-store';

function fmtWhen(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 요청 하나의 타임라인 — 사무실 ↔ 현장 메모와 상태 변경 기록을 한 줄로.
 * 열면 그 요청의 상대편 메모를 "본 것"으로 표시한다(배지 기준).
 * `big` 은 현장(휴대폰) 글자·터치 크기.
 */
export function SrTimeline({
  kind,
  refId,
  side,
  by,
  big = false,
}: {
  kind: NoteRefKind;
  refId: string;
  side: NoteSide;
  /** 메모 작성자 이름 — 비어 있으면 입력을 숨긴다 */
  by: string;
  big?: boolean;
}) {
  const { t, i18n } = useTranslation('mro2');
  const notes = useNotes(kind, refId);
  const activities = useActivities(kind, refId);
  const addNote = useAddNote();
  const [text, setText] = useState('');
  const rows = useMemo(
    () => buildTimeline(activities, notes),
    [activities, notes],
  );
  const latest = rows.length > 0 ? rows[rows.length - 1]!.at : '';
  useEffect(() => {
    if (latest) markSeen(side, `${kind}:${refId}`, latest);
  }, [side, kind, refId, latest]);

  const send = () => {
    if (!by || !text.trim()) return;
    addNote({ kind, refId, side, by, text });
    setText('');
  };
  const fs = big ? 'text-[15px]' : 'text-[13px]';
  const fsMeta = big ? 'text-[13px]' : 'text-[11px]';

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <div className={fs} style={{ color: KC.muted }}>
          {t('timeline.empty')}
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((r) =>
            r.type === 'activity' ? (
              <li
                key={r.id}
                className={`flex gap-2 ${fsMeta}`}
                style={{ color: KC.muted }}
              >
                <span className="shrink-0 tabular-nums">
                  {fmtWhen(r.at, i18n.language)}
                </span>
                <span className="min-w-0">
                  {t(`timeline.act.${r.activity.type}`, {
                    by:
                      r.activity.by === 'office'
                        ? t('timeline.office')
                        : r.activity.by,
                    detail: r.activity.detail ?? '',
                    defaultValue: r.activity.type,
                  })}
                </span>
              </li>
            ) : (
              <li
                key={r.id}
                className={`flex flex-col rounded px-2.5 py-1.5 ${fs}`}
                style={{
                  background: r.note.side === side ? KC.tealFill : KC.bgSubtle,
                  border: `1px solid ${KC.hairline}`,
                  borderRadius: KC.radius,
                  color: KC.ink,
                  alignSelf: r.note.side === side ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                }}
              >
                <span className={fsMeta} style={{ color: KC.muted }}>
                  {r.note.side === 'field'
                    ? `${t('timeline.field')} · ${r.note.by}`
                    : r.note.by === 'office' ||
                        r.note.by === t('timeline.office')
                      ? t('timeline.office')
                      : `${t('timeline.office')} · ${r.note.by}`}{' '}
                  · {fmtWhen(r.at, i18n.language)}
                </span>
                <span className="break-words whitespace-pre-wrap">
                  {r.note.text}
                </span>
              </li>
            ),
          )}
        </ol>
      )}
      {by ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <MessageSquare size={big ? 18 : 14} style={{ color: KC.muted }} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t(
              side === 'field'
                ? 'timeline.placeholderField'
                : 'timeline.placeholderOffice',
            )}
            className={`${big ? 'h-12 text-[16px]' : 'h-8 text-[13px]'} min-w-0 flex-1 rounded border px-2`}
            style={{
              borderColor: KC.border,
              background: KC.bg,
              color: KC.ink,
              borderRadius: KC.radius,
            }}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={t('timeline.send')}
            className={`${big ? 'h-12 w-12' : 'h-8 w-8'} flex shrink-0 cursor-pointer items-center justify-center rounded disabled:cursor-default disabled:opacity-40`}
            style={{
              background: KC.teal,
              color: KC.onTeal,
              borderRadius: KC.radius,
            }}
          >
            <Send size={big ? 18 : 14} />
          </button>
        </form>
      ) : null}
    </div>
  );
}
