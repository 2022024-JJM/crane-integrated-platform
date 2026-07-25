import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Clock, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMaintenanceList, useSetRepairStatus } from '@crane/features/maintenance';
import type { RepairWO } from '@crane/domain/maintenance';
import { Badge } from '@crane/ui/atoms/badge';
import { cn } from '@crane/core/lib/utils';
import { PAGE_TITLE, PAGE_SUBTITLE, PAGE_CONTAINER } from '../../../shared/ui/page';
import { SURFACE_PANEL } from '../../../shared/ui/surface';
import { buttonVariants } from '@crane/ui/atoms/button';
import { TONE_DOT, TONE_TEXT, type Tone } from '../../../shared/ui/tone';
import {
  REPAIR_PRIORITY_VARIANT as PRIORITY_VARIANT,
  REPAIR_STATUS_VARIANT as STATUS_VARIANT,
} from '../../../shared/ui/status-variants';
import { MetricCard } from '../../../shared/ui/metric-card';
import { AlertBanner } from '../../../shared/ui/alert-banner';
import { formatRelativeDate } from '../../../shared/lib/relative-date';
import { FOCUS_RING } from '../../../shared/ui/controls';
import { MACRO_STAGES, COLUMN_CONFIG, macroOf, type MacroStage } from './pipeline-config';
import { RepairDetailPanel } from './repair-detail-panel';

function RepairCard({
  wo,
  onStage,
  onSelect,
  selected,
}: {
  wo: RepairWO;
  onStage: (wo: RepairWO, stage: MacroStage) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const { t } = useTranslation('maintenance');
  const { label: dateLabel, overdue: isOverdue } = formatRelativeDate(wo.scheduledStart);
  const macro = macroOf(wo.status);
  const macroIndex = macro ? MACRO_STAGES.indexOf(macro) : -1;
  const prevStage = macroIndex > 0 ? MACRO_STAGES[macroIndex - 1] : null;
  const nextStage =
    macroIndex !== -1 && macroIndex < MACRO_STAGES.length - 1 ? MACRO_STAGES[macroIndex + 1] : null;
  // 부품 대기·재검사는 '진행 중' 컬럼 안의 세부 상태 — 칩으로만 구분한다.
  const isSubState = wo.status === 'waiting_parts' || wo.status === 're_inspection';

  return (
    <div
      className={cn(
        'group flex flex-col gap-2.5 rounded border border-border/60 bg-card/80 hover:bg-card hover:shadow-md transition-all',
        selected && 'ring-2 ring-primary/60',
      )}
    >
      {/* 클릭 영역 (처리 패널 열기) */}
      <button
        type="button"
        onClick={() => onSelect(wo.id)}
        className={cn('cursor-pointer flex flex-col gap-2.5 px-3.5 pt-3.5 text-left w-full', FOCUS_RING)}
      >
        {/* WO번호 + 세부 상태 칩 + 우선순위 */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold tracking-tight text-muted-foreground truncate">{wo.woNumber}</span>
          <div className="flex shrink-0 items-center gap-1">
            {isSubState && (
              <Badge variant={STATUS_VARIANT[wo.status]} className="text-[10px] px-1.5 py-0">
                {t(`status.${wo.status}`)}
              </Badge>
            )}
            <Badge variant={PRIORITY_VARIANT[wo.priority]} className="text-[10px] px-1.5 py-0">
              {t(`priority.${wo.priority}`).toUpperCase()}
            </Badge>
          </div>
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
      </button>

      {/* 단계 이동 버튼 바 (매크로 3단계 기준) */}
      <div className="flex items-stretch border-t border-border/40 divide-x divide-border/40">
        <button
          onClick={() => prevStage && onStage(wo, prevStage)}
          disabled={!prevStage}
          className={cn(`cursor-pointer flex-1 min-w-0 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors rounded-bl
            ${prevStage
              ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              : 'text-muted-foreground/25 pointer-events-none'
            }`, FOCUS_RING)}
        >
          <ChevronLeft className="h-3 w-3 shrink-0" />
          <span className="truncate">{prevStage ? t(`pipeline.${prevStage}`) : '—'}</span>
        </button>
        <button
          onClick={() => nextStage && onStage(wo, nextStage)}
          disabled={!nextStage}
          className={cn(`cursor-pointer flex-1 min-w-0 flex items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors rounded-br
            ${nextStage
              ? 'text-foreground hover:bg-muted/50'
              : 'text-muted-foreground/25 pointer-events-none'
            }`, FOCUS_RING)}
        >
          <span className="truncate">{nextStage ? t(`pipeline.${nextStage}`) : t('completedLabel')}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export function MaintenancePage() {
  const { repairs, summary } = useMaintenanceList();
  const setStatus = useSetRepairStatus();
  const { t } = useTranslation('maintenance');

  const emergencyWOs = repairs.filter((w) => w.priority === 'emergency');
  const totalActive = repairs.filter((w) => w.status !== 'completed').length;
  // on_hold는 파이프라인 밖 상태 — 해당 WO가 있을 때만 컬럼을 추가해 목록에서 사라지지 않게 한다.
  const hasOnHold = repairs.some((w) => w.status === 'on_hold');
  const boardColumns: (MacroStage | 'on_hold')[] = hasOnHold ? [...MACRO_STAGES, 'on_hold'] : MACRO_STAGES;

  // 카드 푸터의 매크로 단계 이동 — completed 진입은 재검사 결과 가드에 걸릴 수 있다.
  const handleStage = (wo: RepairWO, stage: MacroStage) => {
    const outcome = setStatus(wo.id, stage);
    if (outcome.success) {
      if (stage === 'completed') {
        toast.success(t('toast.completed', { woNumber: wo.woNumber }));
      } else {
        toast.info(t('toast.moveTo', { woNumber: wo.woNumber, status: t(`pipeline.${stage}`) }));
      }
      return;
    }
    if (outcome.reason === 're_inspection_required') {
      toast.error(t('toast.reInspectionRequired'));
    }
  };

  // 열린 패널의 WO는 ?wo=<repairId> URL 파라미터가 단일 소스 — 캘린더·대시보드 딥링크와
  // 카드 클릭이 같은 경로를 쓰고, 로컬 state 동기화가 없어 라우터 transition 렌더와 경쟁하지 않는다.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRepairId = searchParams.get('wo');

  const selectRepair = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('wo', id);
    else next.delete('wo');
    setSearchParams(next, { replace: true });
  };

  return (
    <div
      className={cn(
        PAGE_CONTAINER,
        'transition-[padding] duration-300 ease-out',
        // 2xl 이상에서만 패널 폭(440px)만큼 본문을 민다 — 칸반 5~6컬럼이라 그 미만은 패널이 오버레이
        selectedRepairId && '2xl:pr-[calc(440px+1.5rem)]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={PAGE_TITLE}>{t('title')}</h1>
          <p className={cn(PAGE_SUBTITLE, 'mt-0.5')}>{t('description')}</p>
        </div>
        <Link
          to="/ticket/create?type=repair"
          className={buttonVariants({ size: 'lg' })}
        >
          <Plus className="h-4 w-4" />
          {t('createButton', { ns: 'ticket', defaultValue: 'New Ticket' })}
        </Link>
      </div>

      {/* KPI 카드 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('metrics.inProgress'), value: summary.inProgress, tone: summary.inProgress > 0 ? 'warning' : 'neutral' },
          { label: t('metrics.waitingParts'), value: summary.waitingParts, tone: summary.waitingParts > 0 ? 'warning' : 'neutral' },
          { label: t('metrics.emergencyActive'), value: summary.emergency, tone: summary.emergency > 0 ? 'critical' : 'neutral' },
          { label: t('metrics.avgMttr'), value: `${summary.avgMttrHours} h`, tone: 'neutral' },
        ].map(({ label, value, tone }) => (
          <MetricCard key={label} label={label} value={value} tone={tone as Tone} />
        ))}
      </section>

      {/* 긴급 수리 배너 */}
      {emergencyWOs.length > 0 && (
        <AlertBanner tone="critical" title={t('emergency.banner', { count: emergencyWOs.length })}>
          {emergencyWOs.map((wo) => (
            <button
              key={wo.id}
              type="button"
              onClick={() => selectRepair(wo.id)}
              className={cn('cursor-pointer flex items-center justify-between gap-4 text-sm hover:underline w-full text-left', FOCUS_RING)}
            >
              <span className="font-medium">{wo.craneName}</span>
              <span className="text-muted-foreground truncate flex-1">{wo.componentName} — {wo.failureDescription.slice(0, 60)}…</span>
              <Badge variant="destructive" className="shrink-0">
                {t(`status.${wo.status}`)}
              </Badge>
            </button>
          ))}
        </AlertBanner>
      )}

      {/* 파이프라인 칸반 보드 — 3단계 매크로 (+보류) */}
      <div className={cn('grid grid-cols-2 gap-3', hasOnHold ? 'md:grid-cols-4' : 'md:grid-cols-3')}>
        {boardColumns.map((status) => {
          const cfg = COLUMN_CONFIG[status];
          const colWOs = repairs.filter((w) =>
            status === 'on_hold' ? w.status === 'on_hold' : macroOf(w.status) === status,
          );
          const pct = totalActive > 0 && status !== 'completed'
            ? Math.round((colWOs.length / totalActive) * 100)
            : 0;

          return (
            <div key={status} className={cn(SURFACE_PANEL, 'flex flex-col overflow-hidden')}>
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
                    <p className="text-xs text-muted-foreground">{t('empty')}</p>
                  </div>
                ) : (
                  colWOs.map((wo) => (
                    <RepairCard
                      key={wo.id}
                      wo={wo}
                      onStage={handleStage}
                      onSelect={selectRepair}
                      selected={wo.id === selectedRepairId}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 원클릭 처리 패널 — 상태 점프·부품 기록·결과 입력 */}
      {selectedRepairId && (
        <RepairDetailPanel
          repairId={selectedRepairId}
          onClose={() => selectRepair(null)}
        />
      )}
    </div>
  );
}
