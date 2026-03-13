import { AlertTriangle, ShieldAlert } from 'lucide-react';

import {
  INDOOR_WORK_ALARM_ROWS,
  INDOOR_WORK_OPERATION_INFO_CARDS,
  INDOOR_WORK_OPERATION_INFO_NOTES,
  INDOOR_WORK_OPERATION_STATUS_CARDS,
  INDOOR_WORK_OPERATION_STATUS_SUMMARY,
  INDOOR_WORK_STAT_CARDS,
  INDOOR_WORK_TEXT,
} from '@/entities/indoor-work/model/indoor-work-content';
import type { IndoorMenuKey } from '@/entities/indoor-work/model/types';
import {
  getStatValueClass,
  sectionTitleClass,
} from '@/entities/indoor-work/lib/indoor-work-panel-styles';
import { cn } from '@/shared/lib/utils';

interface IndoorWorkRightPanelProps {
  activeMenu: IndoorMenuKey;
}

function NoteList({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item}
          className="border border-l-[2px] border-[var(--outdoor-page-card-border)] border-l-[var(--outdoor-page-accent-soft-border)] bg-[var(--outdoor-page-card-bg)] px-3 py-2.5 text-[12px] leading-[1.5] text-[var(--outdoor-page-note-text)]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function StatsGrid({
  cards,
}: {
  cards: readonly {
    label: string;
    tone: 'danger' | 'neutral' | 'ok';
    value: string;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--outdoor-page-card-border)] bg-[var(--outdoor-page-card-grid-gap)]">
      {cards.map((card) => (
        <div
          key={card.label}
          className="min-h-[82px] bg-[var(--outdoor-page-card-bg)] p-2.5"
        >
          <div className="text-[11px] text-[var(--outdoor-page-card-label)]">
            {card.label}
          </div>
          <div className={getStatValueClass(card.tone)}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

export function IndoorWorkRightPanel({
  activeMenu,
}: IndoorWorkRightPanelProps) {
  if (activeMenu === 'operation-info') {
    return (
      <>
        <section className="min-h-0 border-b border-[var(--outdoor-page-panel-border)] p-3">
          <div className={sectionTitleClass}>운행 정보</div>
          <div className="grid grid-cols-1 gap-2">
            {INDOOR_WORK_OPERATION_INFO_CARDS.map(([label, value]) => (
              <div
                key={label}
                className="border border-[var(--outdoor-page-card-border)] bg-[var(--outdoor-page-card-bg)] p-3"
              >
                <div className="mb-1.5 text-[11px] text-[var(--outdoor-page-card-label)]">
                  {label}
                </div>
                <div className="text-[13px] leading-[1.5] font-semibold text-[var(--outdoor-page-card-value)]">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
          <div className={sectionTitleClass}>운행 메모</div>
          <NoteList items={INDOOR_WORK_OPERATION_INFO_NOTES} />
        </section>
      </>
    );
  }

  if (activeMenu === 'operation-status') {
    const statusCards = INDOOR_WORK_OPERATION_STATUS_CARDS.map(
      ([label, value, tone]) => ({
        label,
        tone,
        value,
      }),
    );

    return (
      <>
        <section className="min-h-0 border-b border-[var(--outdoor-page-panel-border)] p-3">
          <div className={sectionTitleClass}>운행 현황</div>
          <StatsGrid cards={statusCards} />
        </section>
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
          <div className={sectionTitleClass}>상태 요약</div>
          <NoteList items={INDOOR_WORK_OPERATION_STATUS_SUMMARY} />
        </section>
      </>
    );
  }

  return (
    <>
      <section className="min-h-0 border-b border-[var(--outdoor-page-panel-border)] p-3">
        <div className={sectionTitleClass}>{INDOOR_WORK_TEXT.statsTitle}</div>
        <div className="grid grid-cols-3 gap-px overflow-hidden border border-[var(--outdoor-page-card-border)] bg-[var(--outdoor-page-card-grid-gap)]">
          {INDOOR_WORK_STAT_CARDS.map((card) => (
            <div
              key={card.label}
              className="min-h-[82px] bg-[var(--outdoor-page-card-bg)] p-2.5"
            >
              <div className="text-[11px] text-[var(--outdoor-page-card-label)]">
                {card.label}
              </div>
              <div className={getStatValueClass(card.tone)}>{card.value}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
        <div className={sectionTitleClass}>{INDOOR_WORK_TEXT.alarmTitle}</div>
        <div className="max-h-full min-h-0 overflow-auto border border-[var(--outdoor-page-card-border)]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['NO', 'Severity', 'OccurrenceTime', 'Crane', 'Count'].map(
                  (header) => (
                    <th
                      key={header}
                      className="border-r border-b border-[var(--outdoor-page-table-border)] bg-[var(--outdoor-page-table-head-bg)] px-1.5 py-2 text-left text-[10px] font-semibold text-[var(--outdoor-page-table-head-text)]"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {INDOOR_WORK_ALARM_ROWS.map(
                ([no, severity, occurrenceTime, target, count]) => (
                  <tr key={no}>
                    <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] text-[var(--outdoor-page-table-text)]">
                      {no}
                    </td>
                    <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] text-[var(--outdoor-page-table-text)]">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                          severity === 'Warning'
                            ? 'bg-[var(--outdoor-page-pill-warning-bg)] text-[var(--outdoor-page-pill-warning-text)]'
                            : 'bg-[var(--outdoor-page-pill-danger-bg)] text-[var(--outdoor-page-pill-danger-text)]',
                        )}
                      >
                        {severity === 'Warning' ? (
                          <AlertTriangle size={10} />
                        ) : (
                          <ShieldAlert size={10} />
                        )}
                        {severity}
                      </span>
                    </td>
                    <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] text-[var(--outdoor-page-table-text)]">
                      {occurrenceTime}
                    </td>
                    <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] text-[var(--outdoor-page-table-text)]">
                      {target}
                    </td>
                    <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] font-bold text-[var(--outdoor-page-table-emphasis)]">
                      {count}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
