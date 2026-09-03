import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import type { ProcessNode } from '../model/types'

/**
 * 수집 절점 스트립 — 블록 헤더에서 "어느 절점까지 왔는가"를 한 줄로 보여 준다.
 * 가공(S1~S5) 전용 — 조립은 절점이 아니라 블록-ASSY 레벨이라 이 스트립을 쓰지 않는다.
 *
 * 색 단독으로 의미를 나르지 않는다(StatusChip 원칙과 동일) — 통과는 채움+✓,
 * 진행중은 반채움, 지연은 상태색 테두리+라벨을 함께 낸다.
 */
export function NodeStrip({ nodes, label }: { nodes: ProcessNode[]; label?: string }) {
  const { t } = useTranslation()
  const shortOf = (stage: ProcessNode['stage']) => stage

  const stateOf = (node: ProcessNode): { labelKey: InshopKey; className: string; mark: string } => {
    if (node.passed)
      return {
        labelKey: 'performance.nodes.passed',
        className: `border-status-healthy/50 bg-status-healthy/15 ${STATUS_STYLE.done.ink}`,
        mark: '✓',
      }
    if (node.delayed)
      return {
        labelKey: 'performance.nodes.delayed',
        className: `border-status-unhealthy/60 ${STATUS_STYLE.error.chip}`,
        mark: '!',
      }
    if (node.inProgress)
      return {
        labelKey: 'performance.nodes.inProgress',
        /* 진행중은 강조색이 아니라 상태 팔레트의 파랑 (감사 F-7) */
        className: `border-status-progress/50 ${STATUS_STYLE.inProgress.chip}`,
        mark: '…',
      }
    return {
      labelKey: 'performance.nodes.notDue',
      className: 'border-border bg-surface-secondary/60 text-foreground/45',
      mark: '·',
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="w-7 shrink-0 text-[10px] font-medium text-foreground/45">{label}</span>
      )}
      <ol
        className="flex items-center gap-1"
        aria-label={label ? `${label} ${t('performance.nodes.title')}` : t('performance.nodes.title')}
      >
        {nodes.map((node, i) => {
          const state = stateOf(node)
          const short = shortOf(node.stage)
          return (
            <li key={node.stage} className="flex items-center gap-1">
              {i > 0 && <span className="h-px w-2.5 bg-border" aria-hidden />}
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-inshop-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  state.className
                )}
                title={`${short} — ${t(state.labelKey)} · ${t('performance.nodes.plan', { date: node.planDate })}`}
              >
                <span aria-hidden>{state.mark}</span>
                {short}
                <span className="sr-only">{t(state.labelKey)}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
