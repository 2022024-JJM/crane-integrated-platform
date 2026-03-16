import { AlertTriangle, ShieldAlert } from 'lucide-react';

import {
  ALARM_OVERVIEW_TEXT,
  ALARM_ROWS,
} from '@/entities/monitoring/alarm/model/alarm-overview-content';
import type { AlarmSeverity } from '@/entities/monitoring/alarm/model/types';
import { cn } from '@/shared/lib/utils';

const SECTION_TITLE_CLASS =
  'mb-2.5 text-[18px] font-bold text-[var(--outdoor-page-text-strong)]';

function getSeverityPillClass(severity: AlarmSeverity) {
  return cn(
    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
    severity === 'Warning'
      ? 'bg-[var(--outdoor-page-pill-warning-bg)] text-[var(--outdoor-page-pill-warning-text)]'
      : 'bg-[var(--outdoor-page-pill-danger-bg)] text-[var(--outdoor-page-pill-danger-text)]',
  );
}

export function AlarmTableSection() {
  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3">
      <div className={SECTION_TITLE_CLASS}>
        {ALARM_OVERVIEW_TEXT.alarmTitle}
      </div>
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
            {ALARM_ROWS.map(([no, severity, occurrenceTime, target, count]) => (
              <tr key={no}>
                <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] text-[var(--outdoor-page-table-text)]">
                  {no}
                </td>
                <td className="border-r border-b border-[var(--outdoor-page-table-border)] px-1.5 py-[9px] text-[11px] text-[var(--outdoor-page-table-text)]">
                  <span className={getSeverityPillClass(severity)}>
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
