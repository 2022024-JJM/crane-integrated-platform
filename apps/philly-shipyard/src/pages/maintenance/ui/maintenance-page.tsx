import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Package, Inbox, Clock, Wrench, SearchCheck, CheckCircle2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMaintenanceList, PIPELINE_NEXT, PIPELINE_PREV } from '@crane/features/maintenance';
import type { RepairStatus, RepairWO } from '@crane/domain/maintenance';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';
import { REPAIR_PRIORITY_VARIANT as PRIORITY_VARIANT } from '../../../shared/ui/status-variants';
import { MetricCard } from '../../../shared/ui/metric-card';
import { AlertBanner } from '../../../shared/ui/alert-banner';
import { formatRelativeDate } from '../../../shared/lib/relative-date';

const PIPELINE_STATUSES: RepairStatus[] = [
  'received',
  'waiting_parts',
  'in_progress',
  're_inspection',
  'completed',
];

// 컬럼 크롬은 전부 뉴트럴 — 스테이지 식별은 도트 톤 하나로만.
const COLUMN_CONFIG: Record<RepairStatus, { icon: React.ReactNode; tone: Tone }> = {
  received: { icon: <Inbox className="h-3.5 w-3.5" />, tone: 'neutral' },
  waiting_parts: { icon: <Package className="h-3.5 w-3.5" />, tone: 'warning' },
  in_progress: { icon: <Wrench className="h-3.5 w-3.5" />, tone: 'info' },
  re_inspection: { icon: <SearchCheck className="h-3.5 w-3.5" />, tone: 'info' },
  completed: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: 'positive' },
  on_hold: { icon: <Clock className="h-3.5 w-3.5" />, tone: 'neutral' },
};

function RepairCard({
  wo,
  onMove,
}: {
  wo: RepairWO;
  onMove: (id: string, direction: 'next' | 'prev') => RepairStatus | null;
}) {
  const { t } = useTranslation('maintenance');
  const { label: dateLabel, overdue: isOverdue } = formatRelativeDate(wo.scheduledStart);
  const canNext = PIPELINE_NEXT[wo.status] !== null;
  const canPrev = PIPELINE_PREV[wo.status] !== null;
  const nextStatus = PIPELINE_NEXT[wo.status];
  const prevStatus = PIPELINE_PREV[wo.status];

  return (
    <div className="group flex flex-col gap-2.5 rounded border border-border/60 bg-card/80 hover:bg-card hover:shadow-md transition-all">
      {/* 클릭 영역 (상세 페이지 이동) */}
      <Link to={`/maintenance/${wo.id}`} className="cursor-pointer flex flex-col gap-2.5 px-3.5 pt-3.5">
        {/* WO번호 + 우선순위 */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold tracking-tight text-muted-foreground truncate">{wo.woNumber}</span>
          <Badge variant={PRIORITY_VARIANT[wo.priority]} className="shrink-0 text-[10px] px-1.5 py-0">
            {t(`priority.${wo.priority}`).toUpperCase()}
          </Badge>
        </div>

        {/* 크레인 + 컴포넌트 */}
        <div className="space-y-0.5">
          <p className="text-sm font-semibold truncate leading-tight">{wo.craneName}</p>
          <p className="text-xs text-muted-foreground truncate">{wo.componentName}</p>
        </div>

        {/* 고장 설명 */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{wo.failureDescription}</p>

        {/* 구분선 */}
        <div className="h-px bg-border/50" />

        {/* 담당자 + 날짜 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-28">{wo.assignedTo}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className={cn('text-xs font-semibold tabular-nums', isOverdue ? TONE_TEXT.critical : 'text-muted-foreground')}>
              {dateLabel}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
          </div>
        </div>
      </Link>

      {/* 단계 이동 버튼 바 */}
      <div className="flex items-stretch border-t border-border/40 divide-x divide-border/40">
        <button
          onClick={() => {
            const moved = onMove(wo.id, 'prev');
            if (moved) {
              toast.info(t('toast.moveTo', { woNumber: wo.woNumber, status: t(`pipeline.${moved}`) }));
            }
          }}
          disabled={!canPrev}
          className={`cursor-pointer flex-1 min-w-0 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors rounded-bl
            ${canPrev
              ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              : 'text-muted-foreground/25 cursor-not-allowed'
            }`}
        >
          <ChevronLeft className="h-3 w-3 shrink-0" />
          <span className="truncate">{prevStatus ? t(`pipeline.${prevStatus}`) : '—'}</span>
        </button>
        <button
          onClick={() => {
            const moved = onMove(wo.id, 'next');
            if (moved) {
              if (moved === 'completed') {
                toast.success(t('toast.completed', { woNumber: wo.woNumber }));
              } else {
                toast.info(t('toast.moveTo', { woNumber: wo.woNumber, status: t(`pipeline.${moved}`) }));
              }
            }
          }}
          disabled={!canNext}
          className={`cursor-pointer flex-1 min-w-0 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors rounded-br
            ${canNext
              ? 'text-foreground hover:bg-muted/50'
              : 'text-muted-foreground/25 cursor-not-allowed'
            }`}
        >
          <span className="truncate">{nextStatus ? t(`pipeline.${nextStatus}`) : t('completedLabel')}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function MaintenancePage() {
  const { repairs, summary, moveStatus } = useMaintenanceList();
  const { t } = useTranslation('maintenance');

  const emergencyWOs = repairs.filter((w) => w.priority === 'emergency');
  const totalActive = repairs.filter((w) => w.status !== 'completed').length;
  // on_hold는 파이프라인 밖 상태 — 해당 WO가 있을 때만 컬럼을 추가해 목록에서 사라지지 않게 한다.
  const hasOnHold = repairs.some((w) => w.status === 'on_hold');
  const boardStatuses: RepairStatus[] = hasOnHold ? [...PIPELINE_STATUSES, 'on_hold'] : PIPELINE_STATUSES;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
        <Link
          to="/ticket/create?type=repair"
          className="shrink-0 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* KPI 카드 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('metrics.inProgress'), value: summary.inProgress, dot: summary.inProgress > 0 ? TONE_DOT.warning : '' },
          { label: t('metrics.waitingParts'), value: summary.waitingParts, dot: summary.waitingParts > 0 ? TONE_DOT.warning : '' },
          { label: t('metrics.emergencyActive'), value: summary.emergency, dot: summary.emergency > 0 ? TONE_DOT.critical : '' },
          { label: t('metrics.avgMttr'), value: `${summary.avgMttrHours} h`, dot: '' },
        ].map(({ label, value, dot }) => (
          <MetricCard key={label} label={label} value={value} dot={dot} />
        ))}
      </section>

      {/* 긴급 수리 배너 */}
      {emergencyWOs.length > 0 && (
        <AlertBanner tone="critical" title={t('emergency.banner', { count: emergencyWOs.length })}>
          {emergencyWOs.map((wo) => (
            <Link
              key={wo.id}
              to={`/maintenance/${wo.id}`}
              className="cursor-pointer flex items-center justify-between gap-4 text-sm hover:underline"
            >
              <span className="font-medium">{wo.craneName}</span>
              <span className="text-muted-foreground truncate flex-1">{wo.componentName} — {wo.failureDescription.slice(0, 60)}…</span>
              <Badge variant="destructive" className="shrink-0">
                {t(`status.${wo.status}`)}
              </Badge>
            </Link>
          ))}
        </AlertBanner>
      )}

      {/* 파이프라인 칸반 보드 */}
      <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3', hasOnHold ? 'lg:grid-cols-6' : 'lg:grid-cols-5')}>
        {boardStatuses.map((status) => {
          const cfg = COLUMN_CONFIG[status];
          const colWOs = repairs.filter((w) => w.status === status);
          const pct = totalActive > 0 && status !== 'completed'
            ? Math.round((colWOs.length / totalActive) * 100)
            : 0;

          return (
            <div key={status} className="flex flex-col rounded border border-border/70 overflow-hidden">
              {/* 컬럼 헤더 */}
              <div className="bg-muted/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', TONE_DOT[cfg.tone])} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(`pipeline.${status}`)}
                    </span>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums', colWOs.length > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>
                    {colWOs.length}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border/40 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', TONE_DOT[cfg.tone])}
                    style={{ width: status !== 'completed' ? `${pct}%` : colWOs.length > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>

              {/* 카드 목록 */}
              <div className="flex flex-col gap-2 min-h-24 bg-muted/15 p-2">
                {colWOs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-1.5 opacity-40">
                    <span className="text-muted-foreground">{cfg.icon}</span>
                    <p className="text-[10px] text-muted-foreground">{t('empty')}</p>
                  </div>
                ) : (
                  colWOs.map((wo) => (
                    <RepairCard key={wo.id} wo={wo} onMove={moveStatus} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
