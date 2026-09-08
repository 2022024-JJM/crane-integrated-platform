import { Link } from 'react-router-dom'
import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { Card } from '../../../ui/atoms/Card'
import { PinIcon } from '../../../ui/icons'
import { Sparkline } from '../../../ui/atoms/Sparkline'
import { BatchPendingState } from '../../../ui/states' 
import type { PaintingStepId, PaintingSummary } from '../model/types'

/*
 * 도장 — 스텝 절점 카드 (W3-2 · W5-8). 도장은 조립과 달리 **스텝이 진짜 순차 절점**이다:
 * S/P → T/UP → FINAL. 근거는 도장 3테이블 구조(YPWP720M 계획 → YPWP710M 일일 실적 →
 * YPWG221M 확정 'B' 관문)이며, 이 명세는 **SE12 검증으로 확정**됐다. 스텝 축은
 * YPWP720M 실데이터 3,996행에서 유도했고(ELMT_ITEM_CODE), 카드가 그 근거를 단서로 단다.
 *
 * 블록 위치는 BTS 물류 기반(반입/반출·도장공장 지번 경유 — 게이트 결정: ZONE 대응표
 * 불신)이라 요약 줄이 "지금 어느 도장공장에 있는가"를 말하고, '맵에서 보기'가 그
 * 공장으로 딥링크한다. 스텝↔레거시 키 매핑은 paintingStepMapping.ts 한 곳이다.
 *
 * **스텝 수도 스텝의 분모도 블록마다 다르다**(존재 기반, 사용자 확정 2026-09-03):
 * 스프레이는 1~6회로 갈리고 RE-S/P 는 이벤트성이라 없는 블록이 있다. 그래서 카드는
 * 고정 3칸이 아니라 `summary.steps` 길이만큼 서고, 각 칸이 '완료 행 / 계획 행'과 그
 * 블록의 실제 요소코드 구성을 그대로 낸다 — 부분 완료를 완료로 읽지 않기 위해서다.
 *
 * **진행 중 스텝은 여기에 일일공정률 기반 %를 하나 더 낸다**(W5-9). 행 완료/미완료만으로는
 * "얼마나 됐는지"를 말할 수 없어서인데, 그 값은 YPWG413M(하루 1회 일괄 등록)에서 오므로
 * 언제나 **어제 등록분 기준**이다 — 지금 이 순간으로 오해하지 않도록 날짜를 함께 낸다.
 * 완료·미착수 스텝은 종전 표시 그대로 둔다 (% 는 참고 수치이지 완료 판정이 아니다).
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
  done: STATUS_STYLE.done.chip,
  inProgress: STATUS_STYLE.inProgress.chip,
  notDue: STATUS_STYLE.idle.chip,
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
          {/*
           * 색을 주지 않는다(감사 F-10) — 바로 왼쪽 `스텝 완료 0/3` 의 0 은 검정인데
           * 여기 0 만 강조색이면 같은 값이 30px 사이에서 두 뜻으로 읽힌다. 확정 여부는
           * 아래 스텝 카드의 확정 칩이 상태색으로 말한다.
           */}
          <div className="text-inshop-2xl font-semibold tabular-nums">
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
                /* 도장공장 재실 = 진행중(파랑), 반출 완료 = 완료(초록), 반입 전 = 대기(중립) */
                summary.phase === 'inShop'
                  ? STATUS_STYLE.inProgress.chip
                  : summary.phase === 'shippedOut'
                    ? STATUS_STYLE.done.chip
                    : STATUS_STYLE.idle.chip
              )}
            >
              {summary.phase === 'inShop' && summary.factory
                ? summary.factory
                : t(PHASE_KEY[summary.phase])}
            </span>
            {summary.phase === 'inShop' && summary.factory && (
              <Link
                to={drilldownHref('/indoorshop/zones/painting', '', { ...YARD_DRILLDOWN, factory: summary.factory })}
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
          <div>{t('performance.pnt.existenceNote')}</div>
          <div>{t('performance.pnt.btsBasisNote')}</div>
        </div>
      </Card>

      {/* ── 스텝 절점 카드 — 그 블록에 계획된 스텝만, 순차 통과 ── */}
      <div
        className={cn(
          'grid grid-cols-1 gap-3',
          summary.steps.length === 1 ? 'md:grid-cols-1' : summary.steps.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
        )}
      >
        {summary.steps.map((step) => (
          <Card key={step.step} className={cn('p-3.5', step.status === 'notDue' && 'opacity-75')}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-inshop-sm font-semibold">
                {t(STEP_NAME_KEY[step.step])}
                {step.elmtItemCodes.length > 1 && (
                  <span className="ml-1 text-[10px] font-normal text-foreground/45">
                    ×{step.elmtItemCodes.length}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                  STATUS_CLASS[step.status]
                )}
              >
                {t(STATUS_KEY[step.status])}
              </span>
            </div>

            {/* 존재 기반 분모 — 계획 행 전량이 차야 완료다 */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-inshop-sm font-semibold tabular-nums">
                {step.doneRows}
                <span className="text-[11px] font-normal text-foreground/45">
                  /{step.plannedRows}
                </span>
              </span>
              <span className="text-[10px] text-foreground/45">{t('performance.pnt.rows')}</span>
              <span className="ml-auto font-mono text-[10px] text-foreground/40">
                {step.elmtItemCodes.join('·')}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-secondary">
              <div
                className={cn(
                  'h-full rounded-full',
                  step.status === 'done' ? STATUS_STYLE.done.fill : STATUS_STYLE.inProgress.fill
                )}
                style={{ width: `${(step.doneRows / Math.max(1, step.plannedRows)) * 100}%` }}
              />
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

            {/* 진행 중 스텝만 — 일일공정률(YPWG413M) 기반 참고 % 와 그 등록일.
                옆에 **며칠치 추이**를 함께 낸다(W7-2): 하루 1회 일괄 등록이라 최신 한 점만
                보면 "60%" 가 어제 60 에서 온 것인지 사흘째 60 인지(=멈췄는지) 알 수 없다.
                이력이 없거나 한 점뿐인 스텝은 그림을 세우지 않는다 — Sparkline 이 접는다. */}
            {step.status === 'inProgress' && (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="rounded bg-surface-secondary/60 px-2 py-1.5">
                  <div className="flex items-baseline gap-1.5">
                    {/* 진행 중 스텝의 수치 — 상태색(진행중 파랑). 강조색은 상태를 뜻하지 않는다 */}
                    <span
                      className={cn(
                        'text-inshop-sm font-semibold tabular-nums',
                        STATUS_STYLE.inProgress.ink
                      )}
                    >
                      {step.progressPct}%
                    </span>
                    <span className="text-[10px] text-foreground/50">
                      {t('performance.pnt.dailyRate')}
                    </span>
                    <Sparkline
                      points={(step.progressHistory ?? []).map((point) => ({
                        label: point.date,
                        value: point.rate,
                      }))}
                      /* 척도가 정해진 그림 — 최대값에 맞춰 늘이면 58→62 가 바닥에서
                         천장까지로 보인다 */
                      max={100}
                      unit="%"
                      ariaLabel={t('performance.pnt.dailyRateTrend')}
                      className={cn('ml-auto', STATUS_STYLE.inProgress.ink)}
                    />
                  </div>
                  {step.progressAsOf && (
                    <div className="mt-0.5 text-[10px] leading-3 text-foreground/45">
                      {t('performance.pnt.dailyRateAsOf', { date: step.progressAsOf })}
                    </div>
                  )}
                </div>
                {/*
                 * 오늘 치 일괄 등록이 아직 안 온 스텝 — 값이 **없는 게 아니라 물러선**
                 * 상태다(완료 행 기준). 한 줄 각주로 흘리면 사용자가 위의 % 를 일일공정률로
                 * 읽으므로, 공용 빈 상태로 세워 "왜 이 값인가"를 먼저 말하게 한다.
                 */}
                {!step.progressAsOf && (
                  <BatchPendingState
                    asOf={null}
                    description={t('performance.pnt.dailyRateNone')}
                  />
                )}
              </div>
            )}

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
