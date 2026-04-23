import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCmmsMockData } from '@crane/domain/crane';

const PAGE_SIZE = 8;

export function CmmsFaultInfo() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).faultInfo;

  const [eventPage, setEventPage] = useState(0);
  const [faultPage, setFaultPage] = useState(0);

  const eventPages = Math.ceil(data.activeEvents.length / PAGE_SIZE);
  const faultPages = Math.ceil(data.activeFaults.length / PAGE_SIZE);
  const pagedEvents = data.activeEvents.slice(eventPage * PAGE_SIZE, (eventPage + 1) * PAGE_SIZE);
  const pagedFaults = data.activeFaults.slice(faultPage * PAGE_SIZE, (faultPage + 1) * PAGE_SIZE);

  return (
    <div className="h-full flex gap-3 p-4 bg-background text-foreground overflow-auto">
      <AlarmPanel
        title={t('faultInfo.eventAlarm')}
        rows={pagedEvents}
        page={eventPage}
        totalPages={eventPages}
        onPrev={() => setEventPage((p) => Math.max(0, p - 1))}
        onNext={() => setEventPage((p) => Math.min(eventPages - 1, p + 1))}
        accentColor="text-amber-500 dark:text-amber-400"
        headerBarColor="bg-amber-500"
        headerBg="bg-amber-500/10"
        headerBorder="border-amber-500/30"
      />
      <AlarmPanel
        title={t('faultInfo.faultAlarm')}
        rows={pagedFaults}
        page={faultPage}
        totalPages={faultPages}
        onPrev={() => setFaultPage((p) => Math.max(0, p - 1))}
        onNext={() => setFaultPage((p) => Math.min(faultPages - 1, p + 1))}
        accentColor="text-red-500 dark:text-red-400"
        headerBarColor="bg-red-500"
        headerBg="bg-red-500/10"
        headerBorder="border-red-500/30"
      />
    </div>
  );
}

interface AlarmRow { time: string; value: string; comment: string; }
interface AlarmPanelProps {
  title: string;
  rows: AlarmRow[];
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  accentColor: string;
  headerBarColor: string;
  headerBg: string;
  headerBorder: string;
}

function AlarmPanel({ title, rows, page, totalPages, onPrev, onNext, accentColor, headerBarColor, headerBg, headerBorder }: AlarmPanelProps) {
  const { t } = useTranslation('cmms');
  return (
    <div className="flex-1 flex flex-col rounded border border-border bg-card overflow-hidden">
      {/* 헤더 */}
      <div className={`flex items-stretch border-b ${headerBorder} shrink-0`}>
        <div className={`w-1 ${headerBarColor} shrink-0`} />
        <div className={`flex-1 flex items-center justify-between px-3 py-2 ${headerBg}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${accentColor}`}>{title}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              onClick={onPrev}
              disabled={page === 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>{page + 1} / {Math.max(1, totalPages)}</span>
            <button
              onClick={onNext}
              disabled={page >= totalPages - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs text-foreground">
          <thead className="sticky top-0 bg-muted z-10">
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">{t('table.time')}</th>
              <th className="text-center px-2 py-2 font-medium text-muted-foreground w-16">{t('table.value')}</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('table.comment')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-8 text-muted-foreground">
                  {t('faultInfo.noAlarms')}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/50">
                  <td className="px-3 py-1.5 font-mono text-muted-foreground text-[11px]">{row.time}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`font-bold text-[10px] ${row.value === 'ON' ? accentColor : 'text-muted-foreground'}`}>
                      {row.value}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-foreground">{row.comment}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 요약 */}
      <div className="px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground flex justify-between">
        <span>{t('faultInfo.showing', { count: rows.length > 0 ? PAGE_SIZE * page + rows.length : 0 })}</span>
        <span className={`font-semibold ${accentColor}`}>ACTIVE</span>
      </div>
    </div>
  );
}
