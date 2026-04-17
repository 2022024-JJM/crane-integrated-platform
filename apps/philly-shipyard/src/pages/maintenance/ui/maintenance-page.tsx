import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, ChevronLeft, Package, Inbox, Clock, Wrench, SearchCheck, CheckCircle2, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMaintenanceList, PIPELINE_NEXT, PIPELINE_PREV } from '@crane/features/maintenance';
import type { RepairPriority, RepairStatus, RepairWO } from '@crane/domain/maintenance';
import { Badge } from '@crane/ui/atoms/badge';

const PRIORITY_VARIANT: Record<RepairPriority, 'destructive' | 'warning' | 'secondary'> = {
  emergency: 'destructive',
  high: 'warning',
  normal: 'secondary',
  low: 'secondary',
};

const PIPELINE_STATUSES: RepairStatus[] = [
  'received',
  'waiting_parts',
  'in_progress',
  're_inspection',
  'completed',
];

const COLUMN_CONFIG: Record<RepairStatus, {
  icon: React.ReactNode;
  step: number;
  accent: string;
  headerBg: string;
  colBg: string;
  border: string;
  dot: string;
  cardBorderL: string;
}> = {
  received: {
    icon: <Inbox className="h-3.5 w-3.5" />,
    step: 1,
    accent: 'text-slate-400',
    headerBg: 'bg-slate-500/10',
    colBg: 'bg-slate-500/5',
    border: 'border-slate-500/20',
    dot: 'bg-slate-400',
    cardBorderL: 'border-l-slate-400/60',
  },
  waiting_parts: {
    icon: <Package className="h-3.5 w-3.5" />,
    step: 2,
    accent: 'text-amber-400',
    headerBg: 'bg-amber-500/10',
    colBg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    cardBorderL: 'border-l-amber-400/60',
  },
  in_progress: {
    icon: <Wrench className="h-3.5 w-3.5" />,
    step: 3,
    accent: 'text-blue-400',
    headerBg: 'bg-blue-500/10',
    colBg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
    cardBorderL: 'border-l-blue-400/60',
  },
  're_inspection': {
    icon: <SearchCheck className="h-3.5 w-3.5" />,
    step: 4,
    accent: 'text-violet-400',
    headerBg: 'bg-violet-500/10',
    colBg: 'bg-violet-500/5',
    border: 'border-violet-500/20',
    dot: 'bg-violet-400',
    cardBorderL: 'border-l-violet-400/60',
  },
  completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    step: 5,
    accent: 'text-emerald-400',
    headerBg: 'bg-emerald-500/10',
    colBg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    cardBorderL: 'border-l-emerald-400/60',
  },
  on_hold: {
    icon: <Clock className="h-3.5 w-3.5" />,
    step: 0,
    accent: 'text-zinc-400',
    headerBg: 'bg-zinc-500/10',
    colBg: 'bg-zinc-500/5',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
    cardBorderL: 'border-l-zinc-400/60',
  },
} as Record<RepairStatus, {
  icon: React.ReactNode;
  step: number;
  accent: string;
  headerBg: string;
  colBg: string;
  border: string;
  dot: string;
  cardBorderL: string;
}>;

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

function RepairCard({
  wo,
  onMove,
}: {
  wo: RepairWO;
  onMove: (id: string, direction: 'next' | 'prev') => void;
}) {
  const { t } = useTranslation('maintenance');
  const { label: dateLabel, isOverdue } = formatRelativeDate(wo.scheduledStart.slice(0, 10));
  const cfg = COLUMN_CONFIG[wo.status];
  const canNext = PIPELINE_NEXT[wo.status] !== null;
  const canPrev = PIPELINE_PREV[wo.status] !== null;
  const nextStatus = PIPELINE_NEXT[wo.status];
  const prevStatus = PIPELINE_PREV[wo.status];

  return (
    <div className={`group flex flex-col gap-2.5 rounded border border-border/60 border-l-4 ${cfg.cardBorderL} bg-card/80 hover:bg-card hover:shadow-md transition-all`}>
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
            <span className={`text-xs font-semibold tabular-nums ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
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
            onMove(wo.id, 'prev');
            if (prevStatus) {
              toast.info(t('toast.moveTo', { woNumber: wo.woNumber, status: t(`pipeline.${prevStatus}`) }));
            }
          }}
          disabled={!canPrev}
          className={`cursor-pointer flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors rounded-bl
            ${canPrev
              ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              : 'text-muted-foreground/25 cursor-not-allowed'
            }`}
        >
          <ChevronLeft className="h-3 w-3" />
          {prevStatus ? t(`pipeline.${prevStatus}`) : '—'}
        </button>
        <button
          onClick={() => {
            onMove(wo.id, 'next');
            if (nextStatus) {
              const isCompleting = nextStatus === 'completed';
              if (isCompleting) {
                toast.success(t('toast.completed', { woNumber: wo.woNumber }));
              } else {
                toast.info(t('toast.moveTo', { woNumber: wo.woNumber, status: t(`pipeline.${nextStatus}`) }));
              }
            }
          }}
          disabled={!canNext}
          className={`cursor-pointer flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors rounded-br
            ${canNext
              ? `${cfg.accent} hover:bg-muted/50`
              : 'text-muted-foreground/25 cursor-not-allowed'
            }`}
        >
          {nextStatus ? t(`pipeline.${nextStatus}`) : t('completedLabel')}
          <ChevronRight className="h-3 w-3" />
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
          { label: t('metrics.inProgress'), value: summary.inProgress, color: 'text-amber-500', card: summary.inProgress > 0 ? 'border-amber-500/35 bg-amber-500/5' : '' },
          { label: t('metrics.waitingParts'), value: summary.waitingParts, color: 'text-amber-500', card: '' },
          { label: t('metrics.emergencyActive'), value: summary.emergency, color: 'text-red-500', card: summary.emergency > 0 ? 'border-red-500/30 bg-red-500/5' : '' },
          { label: t('metrics.avgMttr'), value: `${summary.avgMttrHours} h`, color: 'text-foreground', card: '' },
        ].map(({ label, value, color, card }) => (
          <div key={label} className={`rounded border border-border/90 bg-card/80 p-4 shadow-sm min-h-24 flex flex-col justify-between ${card}`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-[1.8rem] leading-none font-semibold tracking-tight tabular-nums mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      {/* 긴급 수리 배너 */}
      {emergencyWOs.length > 0 && (
        <div className="rounded border border-red-500/40 bg-red-500/5 p-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-red-500">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {t('emergency.banner', { count: emergencyWOs.length })}
          </p>
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
        </div>
      )}

      {/* 파이프라인 칸반 보드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {PIPELINE_STATUSES.map((status) => {
          const cfg = COLUMN_CONFIG[status];
          const colWOs = repairs.filter((w) => w.status === status);
          const pct = totalActive > 0 && status !== 'completed'
            ? Math.round((colWOs.length / totalActive) * 100)
            : 0;

          return (
            <div key={status} className={`flex flex-col rounded border ${cfg.border} overflow-hidden`}>
              {/* 컬럼 헤더 */}
              <div className={`${cfg.headerBg} px-3 py-2.5`}>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${cfg.accent}`}>
                      {t(`pipeline.${status}`)}
                    </span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${colWOs.length > 0 ? cfg.accent : 'text-muted-foreground/40'}`}>
                    {colWOs.length}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.dot}`}
                    style={{ width: status !== 'completed' ? `${pct}%` : colWOs.length > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>

              {/* 카드 목록 */}
              <div className={`flex flex-col gap-2 min-h-24 ${cfg.colBg} p-2`}>
                {colWOs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-1.5 opacity-40">
                    <span className={cfg.accent}>{cfg.icon}</span>
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
