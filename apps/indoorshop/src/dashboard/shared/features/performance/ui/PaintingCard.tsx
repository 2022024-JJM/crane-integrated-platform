import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { Card } from '../../../ui/atoms/Card'
import { PinIcon } from '../../../ui/icons'
import type { PaintingStepId, PaintingSummary } from '../model/types'

/*
 * 도장 — 스텝 절점 카드 (W3-2). 도장은 조립과 달리 **스텝이 진짜 순차 절점**이다:
 * S/P → T/UP → FINAL. 근거는 도장 3테이블 구조(YPWP720M 계획 → YPWP710M 일일 실적 →
 * YPWG221M 확정 'B' 관문) — 단 명세는 **추정(SE12 검증 전)**이라 카드가 단서를 단다.
 *
 * 블록 위치는 BTS 물류 기반(반입/반출·도장공장 지번 경유 — 게이트 결정: ZONE 대응표
 * 불신)이라 요약 줄이 "지금 어느 도장공장에 있는가"를 말하고, '맵에서 보기'가 그
 * 공장으로 딥링크한다. 스텝↔레거시 키 매핑은 paintingStepMapping.ts 한 곳(잠정)이다.
 */

const STEP_NAME_KEY: Record<PaintingStepId, InshopKey> = {
  SP: 'performance.pnt.step.SP',
  TUP: 'performance.pnt.step.TUP',
  FINAL: 'performance.pnt.step.FINAL',
}

const STATUS_KEY: Record<'done' | 'inProgress' | 'notDue', InshopKey> = {
  done: 'performance.nodes.passed',
  inProgress: 'performance.nodes.inProgress',
  notDue: 'performance.nodes.notDue',
}

const STATUS_CLASS: Record<'done' | 'inProgress' | 'notDue', string> = {
  done: 'bg-status-healthy/10 text-status-healthy',
  inProgress: 'bg-accent/10 text-accent',
  notDue: 'bg-surface-secondary text-foreground/55',
}

const PHASE_KEY: Record<PaintingSummary['phase'], InshopKey> = {
  beforeIn: 'performance.pnt.phase.beforeIn',
  inShop: 'performance.pnt.phase.inShop',
  shippedOut: 'performance.pnt.phase.shippedOut',
}

export function PaintingCard({ summary }: { summary: PaintingSummary }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      {/* ── 블록 수준 요약 — 스텝 진척 · 확정 · BTS 귀속(지금 어느 도장공장인가) ── */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface-secondary/40 p-3.5">
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.pnt.stepsDone')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums">
            {summary.doneSteps}
            <span className="text-inshop-sm text-foreground/45">/{summary.steps.length}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.pnt.confirmed')}</div>
          <div className="text-inshop-2xl font-semibold tabular-nums text-accent">
            {summary.confirmedSteps}
            <span className="text-inshop-sm text-foreground/45">/{summary.doneSteps}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-foreground/55">{t('performance.pnt.location')}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                'rounded px-2 py-0.5 text-inshop-xs font-medium',
                summary.phase === 'inShop'
                  ? 'bg-accent/10 text-accent'
                  : summary.phase === 'shippedOut'
                    ? 'bg-status-healthy/10 text-status-healthy'
                    : 'bg-surface-secondary text-foreground/55'
              )}
            >
              {summary.phase === 'inShop' && summary.factory
                ? summary.factory
                : t(PHASE_KEY[summary.phase])}
            </span>
            {summary.phase === 'inShop' && summary.factory && (
              <Link
                to={`/indoorshop/zones/painting?shop=${encodeURIComponent(summary.factory)}`}
                className="inline-flex items-center gap-1 rounded-inshop-md border border-border px-1.5 py-0.5 text-[11px] text-foreground/70 transition-colors hover:border-accent/50 hover:text-accent"
              >
                <PinIcon size={11} />
                {t('performance.pnt.viewOnMap')}
              </Link>
            )}
          </div>
          <div className="mt-1 text-[10px] tabular-nums text-foreground/45">
            {summary.btsInDate && t('performance.pnt.btsIn', { date: summary.btsInDate })}
            {summary.btsOutDate && ` · ${t('performance.pnt.btsOut', { date: summary.btsOutDate })}`}
          </div>
        </div>
        <div className="ml-auto max-w-72 text-[10px] leading-4 text-foreground/45">
          {t('performance.pnt.provisionalNote')}
          <div>{t('performance.pnt.btsBasisNote')}</div>
        </div>
      </Card>

      {/* ── 스텝 절점 카드 3장 — 순차 통과 (S/P → T/UP → FINAL) ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {summary.steps.map((step) => (
          <Card key={step.step} className={cn('p-3.5', step.status === 'notDue' && 'opacity-75')}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-inshop-sm font-semibold">{t(STEP_NAME_KEY[step.step])}</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  STATUS_CLASS[step.status]
                )}
              >
                {t(STATUS_KEY[step.status])}
              </span>
            </div>

            <div className="mt-2.5 flex flex-col gap-1 text-[11px] tabular-nums text-foreground/60">
              <div className="flex items-center justify-between">
                <span className="text-foreground/50">{t('performance.pnt.wo')}</span>
                <span className="font-mono text-foreground/75">{step.woNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/50">{t('performance.pnt.startDate')}</span>
                <span>{step.startDate ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/50">{t('performance.pnt.endDate')}</span>
                <span>{step.endDate ?? '—'}</span>
              </div>
            </div>

            {/* 확정 관문(YPWG221M 'B') — 완료여도 확정 대기일 수 있는 사실을 그대로 낸다 */}
            <div className="mt-2.5 border-t border-border pt-2">
              {step.status === 'done' ? (
                step.confirmed ? (
                  <span className="rounded bg-status-healthy/10 px-1.5 py-0.5 text-[10px] font-medium text-status-healthy">
                    {t('performance.pnt.confirmedChip')}
                  </span>
                ) : (
                  <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground/60">
                    {t('performance.pnt.confirmPending')}
                  </span>
                )
              ) : (
                <span className="text-[10px] text-foreground/40">
                  {t('performance.pnt.confirmNotDue')}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
