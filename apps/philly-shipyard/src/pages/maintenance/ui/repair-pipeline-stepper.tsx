import { useTranslation } from 'react-i18next';
import type { RepairStatus } from '@crane/domain/maintenance';
import { cn } from '@crane/core/lib/utils';
import { TONE_DOT } from '../../../shared/ui/tone';
import { FOCUS_RING } from '../../../shared/ui/controls';
import { ToggleGroup } from '../../../shared/ui/form';
import { MACRO_STAGES, SUB_STATES, COLUMN_CONFIG, macroOf } from './pipeline-config';

/**
 * 3단계 원클릭 스테퍼 — 임의 단계로 바로 점프한다(선형 이동 강제 없음).
 * 진행 중 단계에서는 세부 상태(작업 중/부품 대기/재검사) 토글이 추가로 노출된다.
 * on_hold는 파이프라인 밖 상태라 활성 단계 없이 전 단계가 복귀 후보로 클릭 가능하다.
 */
export function RepairPipelineStepper({
  status,
  onSelect,
}: {
  status: RepairStatus;
  onSelect: (status: RepairStatus) => void;
}) {
  const { t } = useTranslation('maintenance');
  const macro = macroOf(status);
  const currentIndex = macro ? MACRO_STAGES.indexOf(macro) : -1;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1" role="group" aria-label={t('panel.stageLabel')}>
        {MACRO_STAGES.map((stage, i) => {
          const isCurrent = stage === macro;
          const isDone = currentIndex !== -1 && i < currentIndex;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onSelect(stage)}
              disabled={isCurrent}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium leading-tight transition-all',
                FOCUS_RING,
                isCurrent
                  ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                  : isDone
                    ? 'cursor-pointer border-border bg-muted/30 text-foreground hover:border-primary/50'
                    : 'cursor-pointer border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isCurrent || isDone ? TONE_DOT[COLUMN_CONFIG[stage].tone] : 'bg-border',
                )}
              />
              <span className="truncate max-w-full">{t(`pipeline.${stage}`)}</span>
            </button>
          );
        })}
      </div>
      {macro === 'in_progress' && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('panel.subStateLabel')}
          </span>
          <ToggleGroup
            value={status}
            options={SUB_STATES.map((s) => ({
              value: s,
              label: s === 'in_progress' ? t('panel.working') : t(`status.${s}`),
            }))}
            onChange={onSelect}
          />
        </div>
      )}
      {status === 'on_hold' && (
        <p className="text-[11px] text-muted-foreground">{t('panel.onHoldHint')}</p>
      )}
    </div>
  );
}
