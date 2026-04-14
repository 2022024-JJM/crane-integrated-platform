import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronRight, Calendar, User, ClipboardCheck } from 'lucide-react';
import { useInspectionList } from '@crane/features/inspection';
import type { InspectionStatus, InspectionType, InspectionWO } from '@crane/domain/inspection';
import { Badge } from '@crane/ui/atoms/badge';

const STATUS_VARIANT: Record<InspectionStatus, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  scheduled: 'secondary',
  in_progress: 'warning',
  completed: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
};

const STATUS_BG: Record<InspectionStatus, string> = {
  scheduled: '',
  in_progress: 'border-l-amber-500/70',
  completed: 'border-l-emerald-500/70',
  overdue: 'border-l-red-500/70',
  cancelled: '',
};

const RESULT_VARIANT: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  conditional: 'warning',
};

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
      className={`cursor-pointer group flex items-center gap-0 rounded-2xl border border-border/80 bg-card/70 hover:bg-card hover:border-primary/50 hover:shadow-md transition-all overflow-hidden border-l-4 ${STATUS_BG[wo.status] || 'border-l-border/40'}`}
    >
      {/* 왼쪽: WO 정보 */}
      <div className="flex-1 min-w-0 px-5 py-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold tracking-tight">{wo.woNumber}</span>
          <Badge variant={wo.woType === 'frequent' ? 'secondary' : 'warning'} className="text-[11px]">
            {t(`type.${wo.woType}`)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-medium">{wo.craneName} · {wo.siteName}</p>
      </div>

      {/* 가운데 구분선 */}
      <div className="w-px h-12 bg-border/50 shrink-0" />

      {/* 예정일 */}
      <div className="px-5 py-4 shrink-0 min-w-28 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
          <Calendar className="h-3 w-3" />
          <span className="text-[10px] font-medium uppercase tracking-wider">{t('table.scheduled')}</span>
        </div>
        <p className={`text-sm font-bold tabular-nums ${dateOverdue ? 'text-red-500' : 'text-foreground'}`}>
          {dateLabel}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{wo.scheduledDate}</p>
      </div>

      {/* 구분선 */}
      <div className="w-px h-12 bg-border/50 shrink-0" />

      {/* 담당자 */}
      <div className="px-5 py-4 shrink-0 min-w-28 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
          <User className="h-3 w-3" />
          <span className="text-[10px] font-medium uppercase tracking-wider">{t('table.assignedTo')}</span>
        </div>
        <p className="text-sm font-medium truncate max-w-24">{wo.assignedTo}</p>
      </div>

      {/* 구분선 */}
      <div className="w-px h-12 bg-border/50 shrink-0" />

      {/* 상태 + 결과/진행률 */}
      <div className="px-5 py-4 shrink-0 flex flex-col items-center gap-2 min-w-26">
        <Badge variant={STATUS_VARIANT[wo.status]} className="w-full justify-center">
          {t(`status.${wo.status}`)}
        </Badge>
        {wo.result ? (
          <Badge variant={RESULT_VARIANT[wo.result]} className="w-full justify-center">
            {t(`result.${wo.result}`)}
          </Badge>
        ) : totalItems > 0 ? (
          <div className="w-full space-y-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <ClipboardCheck className="h-3 w-3" />
              <span className="text-[10px] tabular-nums">{completedItems}/{totalItems}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 화살표 */}
      <div className="pr-4 pl-1 shrink-0">
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

export function InspectionPage() {
  const { inspections, summary } = useInspectionList();
  const { t } = useTranslation('inspection');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filtered = inspections.filter((w) => {
    const matchStatus = filterStatus === 'all' || w.status === filterStatus;
    const matchType = filterType === 'all' || w.woType === filterType;
    return matchStatus && matchType;
  });

  const overdueCount = inspections.filter((w) => w.status === 'overdue').length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
      </div>

      {/* 지연 점검 배너 */}
      {overdueCount > 0 && (
        <div className="rounded-[1.75rem] border border-red-500/40 bg-red-500/5 px-5 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {t('overdueAlert', { count: overdueCount, defaultValue: `지연된 점검 ${overdueCount}건 — 즉시 확인 필요` })}
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
          <div key={label} className={`rounded-2xl border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'frequent', 'periodic'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterType === type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type === 'all' ? t('filter.allTypes') : t(`type.${type}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'scheduled', 'in_progress', 'completed', 'overdue'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? t('filter.allStatus') : t(`status.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          filtered.map((wo) => <InspectionRow key={wo.id} wo={wo} />)
        )}
      </div>
    </div>
  );
}
