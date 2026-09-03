import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { ProcessMapLink } from '../../../entities/vessel'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
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
 * '맵에서 보기'(D4) — 대시보드 야드 맵에 이 블록의 조립 공장 포커스 딥링크. 그 옆의
 * '공정 화면'은 이 블록이 실제로 서 있는 자리(정반이 정해졌으면 그 정반 상세)까지
 * 데려간다 — 로스터가 블록의 위치를 알기에 붙일 수 있는 링크다.
 */
export function BlockHeaderCard({
  summary,
  active,
  onSelect,
  outfitting = null,
}: {
  summary: BlockSummary
  active: boolean
  onSelect: () => void
  /** 이 블록의 의장 줄 — 의장 재공이 아니면 null (W7-11) */
  outfitting?: { judgedRate: number; justArrived: boolean } | null
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
            {summary.factory} · {t('performance.header.assy')}{' '}
            {t('performance.header.assyCount', { count: summary.assyCount })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to={`/?factory=${encodeURIComponent(summary.factory)}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex shrink-0 items-center gap-1 rounded-inshop-md border border-border px-2 py-1 text-inshop-xs text-foreground/70 transition-colors hover:border-accent/50 hover:text-accent"
          >
            <PinIcon size={13} />
            {t('performance.header.viewOnMap')}
          </Link>
          <ProcessMapLink projNo={summary.projNo} blockNo={summary.blockNo} />
        </div>
      </div>

      {/* 큰 수치 3종 — 계획/실적은 절점 기준, 조립은 **판별 기준**임을 라벨에 붙인다.
          예전 셋째 칸은 'WO 완료'였다 — 레거시 작업지시를 주지표 자리에 두면 조립 카드가
          뒤집은 축과 헤더가 서로 다른 이야기를 한다. */}
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
          <div className="text-[11px] text-foreground/55">
            {t('performance.header.judged')}{' '}
            <span className="text-foreground/40">({t('performance.header.judgedBasis')})</span>
          </div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {summary.recognizedQty}
            <span className="text-inshop-sm text-foreground/45">/{summary.reqQtyTotal}</span>
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
            {t('performance.header.judgedProgress', {
              done: summary.assyJudged,
              total: summary.assyCount,
            })}
          </span>
          {/* W/O 는 참고 — 라벨에 그렇게 적고 색도 눌러 둔다 */}
          <span className="rounded bg-surface-secondary px-1.5 py-0.5 tabular-nums text-foreground/45">
            {t('performance.header.woProgress', { done: summary.woDone, total: summary.woTotal })}
          </span>
          {summary.unmatchedCount > 0 && (
            <span
              title={t('performance.header.unmatchedTitle')}
              className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 font-medium tabular-nums text-status-unhealthy"
            >
              {t('performance.header.unmatched', { count: summary.unmatchedCount })}
            </span>
          )}
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
        {/* 의장 줄 — **절점이 없다.** 스트립 대신 블록 판별 % 하나가 선다(W7-11).
            의장 재공이 아닌 블록은 그 사실만 적는다 — 0% 로 적으면 '안 됐다' 로 읽힌다. */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="w-8 shrink-0 text-[10px] text-foreground/45">
            {t('performance.ofit.headerLabel')}
          </span>
          {outfitting ? (
            <>
              <span className="rounded bg-surface-secondary px-1.5 py-0.5 font-medium tabular-nums text-foreground/70">
                {Math.round(outfitting.judgedRate)}%
              </span>
              <span className="min-w-[4rem] flex-1">
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                  <span
                    className="block h-full rounded-full bg-status-progress"
                    style={{ width: `${Math.min(100, outfitting.judgedRate)}%` }}
                  />
                </span>
              </span>
              {outfitting.justArrived && (
                <span className="rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">
                  {t('performance.ofit.justArrived')}
                </span>
              )}
            </>
          ) : (
            <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-foreground/45">
              {t('performance.ofit.headerNone')}
            </span>
          )}
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
              /* 재실은 진행중(파랑) — 도장 카드·공장 현황과 같은 뜻 같은 색 */
              summary.pntPhase === 'shippedOut'
                ? STATUS_STYLE.done.chip
                : summary.pntPhase === 'inShop'
                  ? STATUS_STYLE.inProgress.chip
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
