import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import { PinIcon } from '../../../ui/icons'
import type { BlockSummary } from '../model/types'
import { NodeStrip } from './NodeStrip'

/**
 * 블록 헤더 카드 — D2(카드·큰 수치·상태색 중심)의 앵커.
 *
 * 계획%·실적%는 **절점 기반**임을 라벨로 병기한다(D3) — 실적% = 가공 절점 종합
 * (중량가중), 계획% = 절점 계획일 도래 비율. 합성 산식으로 오독되지 않게 한다.
 *
 * '맵에서 보기'(D4) — 대시보드 야드 맵에 이 블록의 조립 공장 포커스 딥링크.
 */
export function BlockHeaderCard({
  summary,
  active,
  onSelect,
}: {
  summary: BlockSummary
  active: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const { progress } = summary
  /** 지연 배지는 가공 절점 기준 — 조립은 절점이 아니라 ASSY·W/O 요약 줄이 따로 말한다 */
  const delayedTotal = progress.delayedCount

  return (
    <Card
      interactive
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn('min-w-[340px] flex-1 cursor-pointer p-4', active && 'border-accent/60')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-inshop-lg font-semibold tabular-nums">
            {summary.projNo}-{summary.blockNo}
          </div>
          <div className="mt-0.5 text-inshop-xs text-foreground/60">
            {summary.factory} · WO {summary.woTotal} ·{' '}
            {t('performance.header.assy')} {t('performance.header.assyCount', { count: summary.assyCount })}
          </div>
        </div>
        <Link
          to={`/?factory=${encodeURIComponent(summary.factory)}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 rounded-inshop-md border border-border px-2 py-1 text-inshop-xs text-foreground/70 transition-colors hover:border-accent/50 hover:text-accent"
        >
          <PinIcon size={13} />
          {t('performance.header.viewOnMap')}
        </Link>
      </div>

      {/* 큰 수치 3종 — 계획/실적은 절점 기준 표기를 라벨에 붙인다 */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-inshop-md bg-surface-secondary/50 px-3 py-2">
          <div className="text-[11px] text-foreground/55">
            {t('performance.header.planRate')}{' '}
            <span className="text-foreground/40">({t('performance.header.nodeBasis')})</span>
          </div>
          <div className="text-inshop-2xl font-semibold tabular-nums">{progress.planRate}%</div>
        </div>
        <div className="rounded-inshop-md bg-surface-secondary/50 px-3 py-2">
          <div className="text-[11px] text-foreground/55">
            {t('performance.header.actualRate')}{' '}
            <span className="text-foreground/40">({t('performance.header.weightBasis')})</span>
          </div>
          <div className="text-inshop-2xl font-semibold tabular-nums text-accent">
            {progress.actualRate}%
          </div>
        </div>
        <div className="rounded-inshop-md bg-surface-secondary/50 px-3 py-2">
          <div className="text-[11px] text-foreground/55">{t('performance.header.wo')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {summary.woDone}
            <span className="text-inshop-sm text-foreground/45">/{summary.woTotal}</span>
          </div>
        </div>
      </div>

      {/* 가공 절점 스트립 + 조립 ASSY·W/O 요약 줄 — 조립은 절점이 아니라 블록-ASSY 레벨 */}
      <div className="mt-3 flex flex-col gap-1">
        <NodeStrip label={t('performance.nodes.stripFab')} nodes={progress.nodes} />
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="w-8 shrink-0 text-[10px] text-foreground/45">
            {t('performance.nodes.stripAsm')}
          </span>
          <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/70">
            {t('performance.header.assyProgress', {
              done: summary.assyDone,
              total: summary.assyCount,
            })}
          </span>
          <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/70">
            {t('performance.header.woProgress', { done: summary.woDone, total: summary.woTotal })}
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-medium',
              summary.inspectionMoved
                ? 'bg-status-healthy/10 text-status-healthy'
                : 'bg-surface-secondary text-foreground/50'
            )}
          >
            {summary.inspectionMoved
              ? t('performance.header.inspectionMoved')
              : t('performance.header.inspectionPending')}
          </span>
        </div>
        {/* 도장 요약 줄 — 스텝(진짜 순차 절점) 진척 + BTS 국면 (가공·조립과 같은 문법) */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="w-8 shrink-0 text-[10px] text-foreground/45">
            {t('performance.nodes.stripPnt')}
          </span>
          <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/70">
            {t('performance.header.pntProgress', { done: summary.pntDone, total: 3 })}
          </span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-medium',
              summary.pntPhase === 'shippedOut'
                ? 'bg-status-healthy/10 text-status-healthy'
                : summary.pntPhase === 'inShop'
                  ? 'bg-accent/10 text-accent'
                  : 'bg-surface-secondary text-foreground/50'
            )}
          >
            {t(
              summary.pntPhase === 'shippedOut'
                ? 'performance.pnt.phase.shippedOut'
                : summary.pntPhase === 'inShop'
                  ? 'performance.pnt.phase.inShop'
                  : 'performance.pnt.phase.beforeIn'
            )}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        {delayedTotal > 0 ? (
          <span className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 font-medium text-status-unhealthy">
            {t('performance.header.delayedNodes', { count: delayedTotal })}
          </span>
        ) : (
          <span className="rounded bg-status-healthy/10 px-1.5 py-0.5 font-medium text-status-healthy">
            {t('performance.header.noDelay')}
          </span>
        )}
        <span className="text-foreground/50">
          {t('performance.header.lastReceived')} {summary.lastReceivedAt}
        </span>
      </div>
    </Card>
  )
}
