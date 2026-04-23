import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { DatePicker } from '@crane/ui';
import { getCmmsMockData } from '@crane/domain/crane';

const PAGE_SIZE = 10;

function todayStr() { return new Date().toISOString().split('T')[0]; }
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export function CmmsFaultHistory() {
  const { craneId = '' } = useParams<{ craneId: string }>();
  const { t } = useTranslation('cmms');
  const data = getCmmsMockData(craneId).faultHistory;

  const [eventPage, setEventPage] = useState(0);
  const [faultPage, setFaultPage] = useState(0);
  const [eventStart, setEventStart] = useState(weekAgoStr());
  const [eventEnd, setEventEnd] = useState(todayStr());
  const [faultStart, setFaultStart] = useState(weekAgoStr());
  const [faultEnd, setFaultEnd] = useState(todayStr());

  const eventPages = Math.ceil(data.events.length / PAGE_SIZE);
  const faultPages = Math.ceil(data.faults.length / PAGE_SIZE);
  const pagedEvents = data.events.slice(eventPage * PAGE_SIZE, (eventPage + 1) * PAGE_SIZE);
  const pagedFaults = data.faults.slice(faultPage * PAGE_SIZE, (faultPage + 1) * PAGE_SIZE);

  return (
    <div className="h-full flex gap-3 p-4 bg-background text-foreground overflow-hidden">
      <HistoryPanel
        title={t('faultHistory.eventHistory')}
        rows={pagedEvents}
        page={eventPage}
        totalPages={eventPages}
        total={data.events.length}
        onPage={setEventPage}
        startDate={eventStart}
        endDate={eventEnd}
        onStartChange={setEventStart}
        onEndChange={setEventEnd}
        onSearch={() => setEventPage(0)}
        onToday={() => { setEventStart(todayStr()); setEventEnd(todayStr()); setEventPage(0); }}
        accentColor="text-amber-500 dark:text-amber-400"
        headerBarColor="bg-amber-500"
      />
      <HistoryPanel
        title={t('faultHistory.faultHistory')}
        rows={pagedFaults}
        page={faultPage}
        totalPages={faultPages}
        total={data.faults.length}
        onPage={setFaultPage}
        startDate={faultStart}
        endDate={faultEnd}
        onStartChange={setFaultStart}
        onEndChange={setFaultEnd}
        onSearch={() => setFaultPage(0)}
        onToday={() => { setFaultStart(todayStr()); setFaultEnd(todayStr()); setFaultPage(0); }}
        accentColor="text-red-500 dark:text-red-400"
        headerBarColor="bg-red-500"
      />
    </div>
  );
}

interface HistoryRow { time: string; value: string; comment: string; }
interface HistoryPanelProps {
  title: string;
  rows: HistoryRow[];
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onSearch: () => void;
  onToday: () => void;
  accentColor: string;
  headerBarColor: string;
}

function HistoryPanel({
  title, rows, page, totalPages, total, onPage,
  startDate, endDate, onStartChange, onEndChange, onSearch, onToday,
  accentColor, headerBarColor,
}: HistoryPanelProps) {
  const { t } = useTranslation('cmms');
  return (
    <div className="flex-1 flex flex-col rounded border border-border bg-card overflow-hidden">
      {/* 제목 헤더 */}
      <div className="flex items-stretch border-b border-border shrink-0">
        <div className={`w-1 ${headerBarColor} shrink-0`} />
        <div className="flex-1 px-3 py-2 bg-muted/60">
          <h3 className={`text-sm font-bold uppercase tracking-wider ${accentColor}`}>{title}</h3>
        </div>
      </div>

      {/* 검색 바 */}
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap shrink-0">
        <button
          onClick={onToday}
          className="px-3 py-1 text-xs font-semibold rounded bg-muted hover:bg-muted/80 text-foreground border border-border"
        >
          {t('faultHistory.today')}
        </button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t('faultHistory.start')}</span>
          <DatePicker size="xs" value={startDate} onChange={onStartChange} />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{t('faultHistory.end')}</span>
          <DatePicker size="xs" value={endDate} onChange={onEndChange} />
        </div>
        <button
          onClick={onSearch}
          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Search className="w-3 h-3" />
          {t('faultHistory.search')}
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {t('faultHistory.totalCount', { count: total })}
        </span>
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
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border hover:bg-muted/50">
                <td className="px-3 py-1.5 font-mono text-muted-foreground text-[11px]">{row.time}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`font-bold text-[10px] ${row.value === 'ON' ? accentColor : 'text-muted-foreground'}`}>
                    {row.value}
                  </span>
                </td>
                <td className="px-3 py-1.5">{row.comment}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-muted-foreground">
                  {t('faultHistory.noResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지 네비게이션 */}
      <div className="px-3 py-1.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <button
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        >
          {t('faultHistory.prev')}
        </button>
        <span>{page + 1} / {Math.max(1, totalPages)}</span>
        <button
          onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        >
          {t('faultHistory.next')}
        </button>
      </div>
    </div>
  );
}
