import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight, Calendar, User, ClipboardCheck, Plus } from 'lucide-react';
import { useInspectionList } from '@crane/features/inspection';
import type { InspectionStatus, InspectionType, InspectionWO } from '@crane/domain/inspection';
import { Badge } from '@crane/ui/atoms/badge';
import { Pagination } from '@crane/ui/molecules/pagination';

const STATUS_VARIANT: Record<InspectionStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  scheduled: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
};

const STATUS_ACCENT: Record<InspectionStatus, string> = {
  scheduled: 'bg-slate-400',
  in_progress: 'bg-amber-500',
  completed: 'bg-emerald-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-slate-500',
};

const RESULT_VARIANT: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  conditional: 'warning',
};

// 컬럼: 상태바 · WO/크레인 · 유형 · 예정일 · 담당자 · 진행률 · 상태 · 결과/화살표
const GRID_TEMPLATE = '4px minmax(220px,2fr) 110px 110px minmax(100px,1fr) minmax(120px,1fr) 100px 100px';

type FilterStatus = 'all' | InspectionStatus;
type FilterType = 'all' | InspectionType;

function formatRelativeDate(dateStr: string): { label: string; isOverdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { label: 'D-Day', isOverdue: false };
  if (diff > 0) return { label: `D-${diff}`, isOverdue: false };
  return { label: `D+${Math.abs(diff)}`, isOverdue: true };
}

function InspectionRow({ wo }: { wo: InspectionWO }) {
  const { t } = useTranslation('inspection');
  const completedItems = wo.checklistItems.filter((i) => i.judgment !== null).length;
  const totalItems = wo.checklistItems.length;
  const { label: dateLabel, isOverdue: dateOverdue } = formatRelativeDate(wo.scheduledDate);
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <Link
      to={`/inspection/${wo.id}`}
      className="group grid cursor-pointer items-center gap-3 border-b border-border/40 pr-3 text-sm transition-colors hover:bg-muted/40"
      style={{ gridTemplateColumns: GRID_TEMPLATE }}
    >
      {/* 상태 accent 바 */}
      <div className={`h-11 ${STATUS_ACCENT[wo.status]}`} />

      {/* WO / 크레인 */}
      <div className="min-w-0 py-2.5">
        <p className="truncate font-semibold tabular-nums">{wo.woNumber}</p>
        <p className="truncate text-xs text-muted-foreground">{wo.craneName} · {wo.siteName}</p>
      </div>

      {/* 유형 */}
      <div>
        <Badge variant={wo.woType === 'frequent' ? 'secondary' : 'warning'}>
          {t(`type.${wo.woType}`)}
        </Badge>
      </div>

      {/* 예정일 */}
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <div className="min-w-0">
          <p className={`text-xs font-semibold tabular-nums ${dateOverdue ? 'text-red-500' : ''}`}>
            {dateLabel}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{wo.scheduledDate}</p>
        </div>
      </div>

      {/* 담당자 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <User className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        <span className="truncate text-xs">{wo.assignedTo}</span>
      </div>

      {/* 진행률 */}
      <div className="min-w-0">
        {totalItems > 0 ? (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 text-muted-foreground">
              <ClipboardCheck className="h-2.5 w-2.5" />
              <span className="text-[10px] tabular-nums">{completedItems}/{totalItems}</span>
            </div>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">—</span>
        )}
      </div>

      {/* 상태 */}
      <div className="flex justify-end">
        <Badge variant={STATUS_VARIANT[wo.status]}>
          {t(`status.${wo.status}`)}
        </Badge>
      </div>

      {/* 결과 + 화살표 */}
      <div className="flex items-center justify-end gap-1.5">
        {wo.result ? (
          <Badge variant={RESULT_VARIANT[wo.result]}>
            {t(`result.${wo.result}`)}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">—</span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}

export function InspectionPage() {
  const { inspections, summary } = useInspectionList();
  const { t } = useTranslation('inspection');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filtered = useMemo(() => inspections.filter((w) => {
    const matchStatus = filterStatus === 'all' || w.status === filterStatus;
    const matchType = filterType === 'all' || w.woType === filterType;
    return matchStatus && matchType;
  }), [inspections, filterStatus, filterType]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [filterStatus, filterType, pageSize]);
  const pageStart = (page - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const overdueCount = inspections.filter((w) => w.status === 'overdue').length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
        <Link
          to="/ticket/create?type=inspection"
          className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* 지연 점검 배너 */}
      {overdueCount > 0 && (
        <div className="rounded border border-red-500/40 bg-red-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {t('overdueAlert', { count: overdueCount, defaultValue: `${overdueCount} overdue inspection(s) — immediate attention required` })}
          </p>
        </div>
      )}

      {/* 메트릭 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('metrics.totalScheduled'), value: summary.totalScheduled, color: 'text-foreground', card: '' },
          { label: t('metrics.completed'), value: summary.completed, color: 'text-emerald-500', card: '' },
          { label: t('metrics.overdue'), value: summary.overdue, color: 'text-red-500', card: summary.overdue > 0 ? 'border-red-500/30 bg-red-500/5' : '' },
          {
            label: t('metrics.completionRate'),
            value: `${summary.completionRate}%`,
            color: summary.completionRate >= 80 ? 'text-emerald-500' : 'text-amber-500',
            card: summary.completionRate < 80 ? 'border-amber-500/35 bg-amber-500/5' : '',
          },
        ].map(({ label, value, color, card }) => (
          <div key={label} className={`rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded border border-border p-1">
          {(['all', 'frequent', 'periodic'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                filterType === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'all' ? t('filter.allTypes') : t(`type.${type}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded border border-border p-1">
          {(['all', 'scheduled', 'in_progress', 'completed', 'overdue'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`cursor-pointer rounded px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? t('filter.allStatus') : t(`status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card/50">
        {/* 좁은 화면에서는 컬럼을 자르지 않고 가로 스크롤로 접근 */}
        <div className="overflow-x-auto">
          <div className="min-w-[970px]">
            {/* 헤더 */}
            <div
              className="grid items-center gap-3 border-b border-border/60 bg-muted/40 pr-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span />
              <span>{t('table.woNumber')}</span>
              <span>{t('table.type')}</span>
              <span>{t('table.scheduled')}</span>
              <span>{t('table.assignedTo')}</span>
              <span className="text-right">{t('table.progress', { defaultValue: 'Progress' })}</span>
              <span className="text-right">{t('table.status')}</span>
              <span className="text-right">{t('table.result')}</span>
            </div>

            {/* 바디 */}
            {filtered.length > 0 && (
              <div>
                {paginated.map((wo) => <InspectionRow key={wo.id} wo={wo} />)}
              </div>
            )}
          </div>
        </div>

        {/* 빈 상태 — 스크롤 래퍼 밖에서 뷰포트 기준 중앙 정렬 */}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
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
              rowsPerPage: t('pagination.rowsPerPage', { defaultValue: 'Rows per page' }),
              of: t('pagination.of', { defaultValue: 'of' }),
            }}
          />
        )}
      </div>
    </div>
  );
}
