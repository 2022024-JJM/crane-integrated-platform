import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ClipboardCheck,
  Download,
  Package,
  Search,
  Wrench,
} from 'lucide-react';
import { useHistoryList } from '@crane/features/history';
import type { HistoryEvent, HistoryEventKind } from '@crane/features/history';
import { buildCsv, downloadCsv, formatCsvTimestamp } from '@crane/core/lib/export-csv';
import { cn } from '@crane/core/lib/utils';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from '@crane/ui/molecules/select';
import { DateTimePicker } from '@crane/ui/molecules/date-time-picker';
import { Pagination } from '@crane/ui/molecules/pagination';
import { PILL_INACTIVE, TONE_DOT, TONE_PILL_ACTIVE } from '../../../shared/ui/tone';
import type { Tone } from '../../../shared/ui/tone';
import {
  INSPECTION_RESULT_VARIANT,
  INSPECTION_STATUS_TONE,
  INSPECTION_STATUS_VARIANT,
  PARTS_REQUEST_STATUS_TONE,
  PARTS_REQUEST_STATUS_VARIANT,
  REPAIR_STATUS_TONE,
  REPAIR_STATUS_VARIANT,
} from '../../../shared/ui/status-variants';

type KindFilter = 'all' | HistoryEventKind;

const KIND_FILTERS: KindFilter[] = ['all', 'inspection', 'repair', 'parts_request'];

// 종류 구분은 아이콘·라벨 — 색(상태바·배지)은 상태 의미 전용 (tone.ts 원칙)
const KIND_ICON: Record<HistoryEventKind, React.ReactNode> = {
  inspection: <ClipboardCheck className="size-3.5" />,
  repair: <Wrench className="size-3.5" />,
  parts_request: <Package className="size-3.5" />,
};

// 컬럼: 상태바 · Ref/크레인 · 종류 · 날짜 · 내용 · 부품 · 상태 · 비용/화살표
const GRID_TEMPLATE =
  '4px minmax(200px,1.5fr) 120px 100px minmax(220px,2fr) 70px 120px 120px';

function eventTone(e: HistoryEvent): Tone {
  switch (e.kind) {
    case 'inspection':
      return INSPECTION_STATUS_TONE[e.status];
    case 'repair':
      return REPAIR_STATUS_TONE[e.status];
    case 'parts_request':
      return PARTS_REQUEST_STATUS_TONE[e.status];
  }
}

function StatusBadge({ event }: { event: HistoryEvent }) {
  const { t: tInspection } = useTranslation('inspection');
  const { t: tMaintenance } = useTranslation('maintenance');
  const { t: tHistory } = useTranslation('history');

  if (event.kind === 'inspection') {
    return (
      <Badge variant={INSPECTION_STATUS_VARIANT[event.status]}>
        {tInspection(`status.${event.status}`)}
      </Badge>
    );
  }
  if (event.kind === 'repair') {
    return (
      <Badge variant={REPAIR_STATUS_VARIANT[event.status]}>
        {tMaintenance(`status.${event.status}`)}
      </Badge>
    );
  }
  return (
    <Badge variant={PARTS_REQUEST_STATUS_VARIANT[event.status]}>
      {tHistory(`requestStatus.${event.status}`)}
    </Badge>
  );
}

function EventRow({ event }: { event: HistoryEvent }) {
  const { t } = useTranslation('history');
  const { t: tInspection } = useTranslation('inspection');

  const description =
    event.kind === 'repair'
      ? [event.componentName, event.description].filter(Boolean).join(' — ')
      : event.description;

  const content = (
    <>
      {/* 상태 accent 바 */}
      <div className={cn('h-11', TONE_DOT[eventTone(event)])} />

      {/* Ref / 크레인 */}
      <div className="min-w-0 py-2.5">
        <p className="truncate text-sm font-semibold tabular-nums">{event.refNumber}</p>
        <p className="truncate text-xs text-muted-foreground">
          {event.craneName} · {event.siteName}
        </p>
      </div>

      {/* 종류 */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {KIND_ICON[event.kind]}
        <span className="truncate">{t(`kind.${event.kind}`)}</span>
      </div>

      {/* 날짜 */}
      <span className="text-xs tabular-nums text-muted-foreground">{event.date}</span>

      {/* 내용 */}
      <p className="line-clamp-2 min-w-0 text-xs text-muted-foreground">
        {description || '—'}
      </p>

      {/* 부품 수 */}
      <span className="text-right text-xs tabular-nums text-muted-foreground">
        {event.parts.length > 0 ? t('partsCount', { count: event.parts.length }) : '—'}
      </span>

      {/* 상태 (+점검 결과) */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        <StatusBadge event={event} />
        {event.kind === 'inspection' && event.result && (
          <Badge variant={INSPECTION_RESULT_VARIANT[event.result]}>
            {tInspection(`result.${event.result}`)}
          </Badge>
        )}
      </div>

      {/* 비용 + 화살표 */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-xs font-medium tabular-nums">
          {event.totalCost != null && event.totalCost > 0
            ? `$${event.totalCost.toLocaleString()}`
            : '—'}
        </span>
        {event.href ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
        ) : (
          <span className="w-4 shrink-0" />
        )}
      </div>
    </>
  );

  const rowClass =
    'group grid items-center gap-3 border-b border-border/40 pr-3 text-sm transition-colors';

  return event.href ? (
    <Link
      to={event.href}
      className={cn(rowClass, 'cursor-pointer hover:bg-muted/40')}
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      {content}
    </Link>
  ) : (
    <div className={rowClass} style={{ gridTemplateColumns: GRID_TEMPLATE }}>
      {content}
    </div>
  );
}

export function HistoryPage() {
  const { t } = useTranslation('history');
  const { events, craneOptions } = useHistoryList();

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [craneId, setCraneId] = useState('');
  const [from, setFrom] = useState(''); // 'YYYY-MM-DD' | ''
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [search, kind, craneId, from, to, pageSize]);

  const rangeInvalid = Boolean(from) && Boolean(to) && to < from;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((e) => {
      if (kind !== 'all' && e.kind !== kind) return false;
      if (craneId && e.craneId !== craneId) return false;
      // 'YYYY-MM-DD'는 사전순 비교 = 날짜 비교
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (query) {
        const componentName = e.kind === 'repair' ? e.componentName : '';
        const haystack =
          `${e.refNumber} ${e.craneName} ${componentName} ${e.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [events, search, kind, craneId, from, to]);

  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  // 종류별 건수 — 필터 pill 카운트 (종류 외 필터는 무시하고 전체 기준)
  const kindCounts = useMemo(() => {
    const counts: Record<HistoryEventKind, number> = {
      inspection: 0,
      repair: 0,
      parts_request: 0,
    };
    for (const e of events) counts[e.kind] += 1;
    return counts;
  }, [events]);

  function handleExport() {
    const headers = [
      t('csv.columns.date'),
      t('csv.columns.kind'),
      t('csv.columns.ref'),
      t('csv.columns.crane'),
      t('csv.columns.site'),
      t('csv.columns.component'),
      t('csv.columns.description'),
      t('csv.columns.status'),
      t('csv.columns.result'),
      t('csv.columns.priority'),
      t('csv.columns.parts'),
      t('csv.columns.totalCost'),
    ];
    const rows = filtered.map((e) => [
      e.date,
      t(`kind.${e.kind}`),
      e.refNumber,
      e.craneName,
      e.siteName,
      e.kind === 'repair' ? e.componentName : '',
      e.description,
      statusLabel(e),
      e.kind === 'inspection' && e.result ? e.result : '',
      e.kind === 'inspection' ? '' : e.priority,
      e.parts.map((p) => `${p.partName} x${p.qty}`).join('; '),
      e.totalCost ?? '',
    ]);
    downloadCsv(`${t('csv.fileName')}-${formatCsvTimestamp()}.csv`, buildCsv(headers, rows));
  }

  // CSV용 상태 라벨 — 화면 배지와 동일한 네임스페이스 재사용
  const { t: tInspection } = useTranslation('inspection');
  const { t: tMaintenance } = useTranslation('maintenance');
  function statusLabel(e: HistoryEvent): string {
    if (e.kind === 'inspection') return tInspection(`status.${e.status}`);
    if (e.kind === 'repair') return tMaintenance(`status.${e.status}`);
    return t(`requestStatus.${e.status}`);
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="mr-1 size-3" />
          {t('export')}
        </Button>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* 종류 pill */}
        <div className="flex gap-1 rounded border border-border p-1">
          {KIND_FILTERS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
                kind === k ? TONE_PILL_ACTIVE.neutral : PILL_INACTIVE,
              )}
            >
              {k !== 'all' && KIND_ICON[k]}
              {k === 'all' ? t('filters.kindAll') : t(`kind.${k}`)}
              <span className="font-mono tabular-nums opacity-60">
                {k === 'all' ? events.length : kindCounts[k]}
              </span>
            </button>
          ))}
        </div>

        {/* 크레인 */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t('filters.crane')}
          </label>
          <Select
            value={craneId || '__all__'}
            onValueChange={(v: string) => setCraneId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger
              label={
                craneId
                  ? (craneOptions.find((o) => o.id === craneId)?.label ?? craneId)
                  : t('filters.craneAll')
              }
            />
            <SelectPopup>
              <SelectItem value="__all__">{t('filters.craneAll')}</SelectItem>
              {craneOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>

        {/* 기간 */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t('filters.from')}
          </label>
          <DateTimePicker
            size="xs"
            dateOnly
            value={from ? `${from}T00:00` : ''}
            onChange={(v) => setFrom(v ? v.slice(0, 10) : '')}
            error={rangeInvalid}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t('filters.to')}
          </label>
          <DateTimePicker
            size="xs"
            dateOnly
            value={to ? `${to}T00:00` : ''}
            onChange={(v) => setTo(v ? v.slice(0, 10) : '')}
            error={rangeInvalid}
          />
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
            className="h-9 w-64 rounded border border-border bg-card/60 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <span className="pb-2 text-xs tabular-nums text-muted-foreground">
          {t('totalCount', { count: filtered.length })}
        </span>
      </div>
      {rangeInvalid && (
        <p className="-mt-4 text-xs text-red-600 dark:text-red-400">
          {t('filters.rangeInvalid')}
        </p>
      )}

      {/* 테이블 */}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card/50">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            {/* 헤더 */}
            <div
              className="grid items-center gap-3 border-b border-border/60 bg-muted/40 py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span />
              <span>{t('columns.ref')}</span>
              <span>{t('columns.kind')}</span>
              <span>{t('columns.date')}</span>
              <span>{t('columns.description')}</span>
              <span className="text-right">{t('columns.parts')}</span>
              <span className="text-right">{t('columns.status')}</span>
              <span className="text-right">{t('columns.cost')}</span>
            </div>

            {/* 바디 */}
            {filtered.length > 0 && (
              <div>
                {paginated.map((e) => (
                  <EventRow key={e.key} event={e} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 빈 상태 — 스크롤 래퍼 밖에서 뷰포트 기준 중앙 정렬 */}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</div>
        )}

        {/* 페이지네이션 */}
        {filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: t('pagination.rowsPerPage'),
              of: t('pagination.of'),
            }}
          />
        )}
      </div>
    </div>
  );
}
