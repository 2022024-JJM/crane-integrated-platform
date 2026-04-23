import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import type { Alarm, AlarmSeverity } from '@crane/domain/alarm';
import {
  formatAlarmHistoryMessage,
  getAlarmSeverityLabel,
  getAlarmSeverityVisual,
} from '@crane/domain/alarm';
import { getFormatLocale } from '@crane/core/config/i18n';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crane/ui/molecules/table';
import { Pagination } from '@crane/ui/molecules/pagination';
import { DateTimePicker } from '@crane/ui/molecules/date-time-picker';

export interface AlarmHistoryCraneOption {
  id: string;
  label: string;
}

interface AlarmHistoryPageProps {
  alarms: Alarm[];
  craneOptions?: AlarmHistoryCraneOption[];
  title?: string;
}

type SeverityFilter = AlarmSeverity | 'all';
type StatusFilter = 'all' | 'active' | 'cleared';

const SEVERITY_VALUES: SeverityFilter[] = [
  'all',
  'critical',
  'high',
  'medium',
  'info',
];
const STATUS_VALUES: StatusFilter[] = ['all', 'active', 'cleared'];

interface FilterValues {
  from: string;
  to: string;
  severity: SeverityFilter;
  craneId: string; // '' means all
  status: StatusFilter;
  search: string;
}

const severityIcon: Record<
  AlarmSeverity,
  { icon: typeof AlertTriangle; className: string }
> = {
  critical: {
    icon: ShieldAlert,
    className: getAlarmSeverityVisual('critical').iconClassName,
  },
  high: {
    icon: AlertCircle,
    className: getAlarmSeverityVisual('high').iconClassName,
  },
  medium: {
    icon: AlertTriangle,
    className: getAlarmSeverityVisual('medium').iconClassName,
  },
  info: {
    icon: Info,
    className: getAlarmSeverityVisual('info').iconClassName,
  },
};

function formatDateTime(timestamp: string, language: string) {
  const date = new Date(timestamp);
  return date.toLocaleString(getFormatLocale(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDefaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return { from: toDatetimeLocalValue(from), to: toDatetimeLocalValue(now) };
}

function getPresetRange(hours: number): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { from: toDatetimeLocalValue(from), to: toDatetimeLocalValue(now) };
}

function getDefaultFilters(): FilterValues {
  const { from, to } = getDefaultRange();
  return {
    from,
    to,
    severity: 'all',
    craneId: '',
    status: 'all',
    search: '',
  };
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(alarms: Alarm[], headers: string[], language: string) {
  const rows = alarms.map((alarm) =>
    [
      new Date(alarm.timestamp).toISOString(),
      alarm.craneName,
      getAlarmSeverityLabel(alarm.severity, language),
      formatAlarmHistoryMessage(alarm, language),
      alarm.active ? 'active' : 'cleared',
    ]
      .map((cell) => csvEscape(String(cell)))
      .join(','),
  );
  return [headers.map(csvEscape).join(','), ...rows].join('\r\n');
}

function downloadCsv(filename: string, csv: string) {
  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(['﻿', csv], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AlarmHistoryPage({
  alarms,
  craneOptions,
  title,
}: AlarmHistoryPageProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<FilterValues>(() => getDefaultFilters());
  const [applied, setApplied] = useState<FilterValues>(() =>
    getDefaultFilters(),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const rangeInvalid =
    Boolean(draft.from) &&
    Boolean(draft.to) &&
    new Date(draft.from).getTime() > new Date(draft.to).getTime();

  const filtered = useMemo(() => {
    const fromMs = applied.from ? new Date(applied.from).getTime() : null;
    const toMs = applied.to ? new Date(applied.to).getTime() : null;
    const searchLower = applied.search.trim().toLowerCase();

    return alarms.filter((alarm) => {
      const ts = new Date(alarm.timestamp).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      if (applied.severity !== 'all' && alarm.severity !== applied.severity)
        return false;
      if (applied.craneId && alarm.craneId !== applied.craneId) return false;
      if (applied.status === 'active' && !alarm.active) return false;
      if (applied.status === 'cleared' && alarm.active) return false;
      if (searchLower) {
        const message = formatAlarmHistoryMessage(
          alarm,
          i18n.language,
        ).toLowerCase();
        const craneName = alarm.craneName.toLowerCase();
        if (!message.includes(searchLower) && !craneName.includes(searchLower))
          return false;
      }
      return true;
    });
  }, [alarms, applied, i18n.language]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  function getSeverityLabel(value: SeverityFilter) {
    if (value === 'all') return t('common:alarms.filterAll');
    return getAlarmSeverityLabel(value, i18n.language);
  }

  function getStatusLabel(value: StatusFilter) {
    if (value === 'all') return t('common:alarms.page.filters.statusAll');
    if (value === 'active')
      return t('common:alarms.page.filters.statusActiveOnly');
    return t('common:alarms.page.filters.statusClearedOnly');
  }

  function handleApply() {
    if (rangeInvalid) return;
    setApplied(draft);
    setPage(1);
  }

  function handleReset() {
    const defaults = getDefaultFilters();
    setDraft(defaults);
    setApplied(defaults);
    setPage(1);
  }

  function applyPreset(hours: number) {
    const { from, to } = getPresetRange(hours);
    const next = { ...draft, from, to };
    setDraft(next);
    setApplied({ ...applied, from, to });
    setPage(1);
  }

  function handleExport() {
    const headers = [
      t('common:alarms.page.columns.time'),
      t('common:alarms.page.columns.crane'),
      t('common:alarms.page.columns.severity'),
      t('common:alarms.page.columns.message'),
      t('common:alarms.page.columns.status'),
    ];
    const csv = buildCsv(filtered, headers, i18n.language);
    const date = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    const fileBase = t('common:alarms.page.exportFileName');
    downloadCsv(`${fileBase}-${stamp}.csv`, csv);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">
            {title ?? t('common:alarms.page.title')}
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {t('common:alarms.page.totalCount', {
              count: total.toLocaleString(),
            })}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={total === 0}
        >
          <Download className="mr-1 size-3" />
          {t('common:alarms.page.export')}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="bg-muted/30 shrink-0 border-b px-4 py-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-[11px] font-medium">
              {t('common:alarms.page.filters.from')}
            </label>
            <DateTimePicker
              size="xs"
              value={draft.from}
              onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
              error={rangeInvalid}
              className="min-w-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-[11px] font-medium">
              {t('common:alarms.page.filters.to')}
            </label>
            <DateTimePicker
              size="xs"
              value={draft.to}
              onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
              error={rangeInvalid}
              className="min-w-50"
            />
          </div>

          {/* Presets */}
          <div className="flex items-end gap-1">
            <Button size="xs" variant="ghost" onClick={() => applyPreset(1)}>
              {t('common:alarms.page.filters.preset1h')}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => applyPreset(24)}>
              {t('common:alarms.page.filters.preset24h')}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => applyPreset(24 * 7)}
            >
              {t('common:alarms.page.filters.preset7d')}
            </Button>
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-[11px] font-medium">
              {t('common:alarms.page.severityFilter')}
            </label>
            <Select
              value={draft.severity}
              onValueChange={(v: string) =>
                setDraft((d) => ({ ...d, severity: v as SeverityFilter }))
              }
            >
              <SelectTrigger label={getSeverityLabel(draft.severity)} />
              <SelectPopup>
                {SEVERITY_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getSeverityLabel(value)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

          {/* Crane */}
          {craneOptions && craneOptions.length > 0 ? (
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-[11px] font-medium">
                {t('common:alarms.page.filters.crane')}
              </label>
              <Select
                value={draft.craneId || '__all__'}
                onValueChange={(v: string) =>
                  setDraft((d) => ({
                    ...d,
                    craneId: v === '__all__' ? '' : v,
                  }))
                }
              >
                <SelectTrigger
                  label={
                    draft.craneId
                      ? (craneOptions.find((o) => o.id === draft.craneId)
                          ?.label ?? draft.craneId)
                      : t('common:alarms.page.filters.craneAll')
                  }
                />
                <SelectPopup>
                  <SelectItem value="__all__">
                    {t('common:alarms.page.filters.craneAll')}
                  </SelectItem>
                  {craneOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          ) : null}

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-[11px] font-medium">
              {t('common:alarms.page.filters.status')}
            </label>
            <Select
              value={draft.status}
              onValueChange={(v: string) =>
                setDraft((d) => ({ ...d, status: v as StatusFilter }))
              }
            >
              <SelectTrigger label={getStatusLabel(draft.status)} />
              <SelectPopup>
                {STATUS_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getStatusLabel(value)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

          {/* Search */}
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <label className="text-muted-foreground text-[11px] font-medium">
              {t('common:alarms.page.filters.search')}
            </label>
            <Input
              type="text"
              placeholder={t('common:alarms.page.filters.searchPlaceholder')}
              value={draft.search}
              onChange={(e) =>
                setDraft((d) => ({ ...d, search: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
              }}
              className="h-7 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-1 size-3" />
              {t('common:alarms.page.filters.reset')}
            </Button>
            <Button size="sm" onClick={handleApply} disabled={rangeInvalid}>
              <Search className="mr-1 size-3" />
              {t('common:alarms.page.filters.apply')}
            </Button>
          </div>
        </div>
        {rangeInvalid ? (
          <p className="text-destructive mt-2 text-xs">
            {t('common:alarms.page.filters.validationOrder')}
          </p>
        ) : null}
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        {total === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 text-sm">
            <p>{t('common:alarms.page.empty')}</p>
            <p className="text-xs">{t('common:alarms.page.emptyHint')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted sticky top-0">
              <TableRow>
                <TableHead className="w-48">
                  {t('common:alarms.page.columns.time')}
                </TableHead>
                <TableHead className="w-32">
                  {t('common:alarms.page.columns.crane')}
                </TableHead>
                <TableHead className="w-28">
                  {t('common:alarms.page.columns.severity')}
                </TableHead>
                <TableHead>
                  {t('common:alarms.page.columns.message')}
                </TableHead>
                <TableHead className="w-24">
                  {t('common:alarms.page.columns.status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((alarm) => {
                const visual = severityIcon[alarm.severity];
                const Icon = visual.icon;
                const severityVisual = getAlarmSeverityVisual(alarm.severity);

                return (
                  <TableRow key={alarm.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDateTime(alarm.timestamp, i18n.language)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {alarm.craneName}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                          severityVisual.surfaceClassName,
                          severityVisual.emphasisClassName,
                        )}
                      >
                        <Icon className={cn('size-3', visual.className)} />
                        {getAlarmSeverityLabel(alarm.severity, i18n.language)}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground/85">
                      {formatAlarmHistoryMessage(alarm, i18n.language)}
                    </TableCell>
                    <TableCell>
                      {alarm.active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <AlertCircle className="size-3" />
                          {t('common:alarms.page.statusActive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          {t('common:alarms.page.statusCleared')}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        labels={{
          rowsPerPage: t('common:alarms.page.rowsPerPage'),
          of: t('common:alarms.page.of'),
        }}
      />
    </div>
  );
}
