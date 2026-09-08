import { Link } from 'react-router-dom'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import type { InshopKey } from '../../../shared/lib/i18n/keys'
import { CollectionSummaryBody } from '../../../shared/features/process-map-entry'
import { cn } from '../../../shared/lib/utils'
import { STATUS_STYLE } from '../../../shared/ui/statusPalette'
import type { PaintingStepId } from '../../../shared/features/performance/model/types'
import {
  paintingCollectionRows,
  paintingFactoryStatusHref,
  type PaintingBlockCollection,
  type PaintingFactoryCollection,
} from '../lib/collection'

/*
 * ② 수집 현황 단 — 공장 카드가 '수집 현황'으로 펴졌을 때의 본문 (W6-6).
 *
 * 겉테는 조립·의장과 같은 부품(`CollectionSummaryBody`)이고, 바깥 두 줄의 질문도 같다 —
 * 첫 줄이 '감지'(지금 몇을 잡고 있나), 마지막 줄이 '최근 수집'(그 값이 언제 것인가).
 *
 * 다른 것은 가운데다. 도장의 수집은 조립처럼 '오늘 몇 건 판별'이 아니라 **스텝 절점**
 * (S/P → T/UP → FINAL)의 통과와, 진행 중 스텝의 **일일공정률**이다. 그 산식은 통합실적
 * (`shared/features/performance`)이 이미 갖고 있고 여기서는 결과만 접어 낸다(중복 구현 금지).
 *
 * ⚠️ 일일공정률(YPWG413M)은 **하루 1회 일괄 등록**이라 언제나 어제 기준이다 — 지금 이
 *    순간으로 읽히지 않도록 근거 날짜를 늘 함께 낸다(통합실적 도장 카드와 같은 규칙).
 */

const STEP_NAME_KEY: Record<PaintingStepId, InshopKey> = {
  SP: 'performance.pnt.step.SP',
  TUP: 'performance.pnt.step.TUP',
  FINAL: 'performance.pnt.step.FINAL',
}

const PHASE_KEY = {
  beforeIn: 'performance.pnt.phase.beforeIn',
  inShop: 'performance.pnt.phase.inShop',
  shippedOut: 'performance.pnt.phase.shippedOut',
} as const

/* 유리(어두운 오버레이) 위라 상태색도 유리 램프를 쓴다 — 라이트 토큰은 여기서 묻힌다 */
const PHASE_INK = {
  beforeIn: 'text-white/45',
  inShop: STATUS_STYLE.inProgress.glassInk,
  shippedOut: STATUS_STYLE.done.glassInk,
} as const

/** 패널 안의 '더 볼 곳' 문 — 요약 본문이 라우터를 모르게 렌더 함수로 넘긴다(조립과 동일) */
function PanelLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-1 flex items-center justify-between rounded-inshop-md px-2 py-1.5 text-2xs font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
    >
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}

/** 블록 한 줄 — 번호 · 자리 · 국면 · 진행 스텝 · 계획 행 · 일일공정률 */
function BlockRow({ block }: { block: PaintingBlockCollection }) {
  const { t } = useTranslation()
  const { summary, activeStep } = block
  return (
    <li className="rounded-inshop-md px-2 py-1.5 hover:bg-white/[0.045]">
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-2xs font-semibold text-white/88">
          {block.key}
        </span>
        {block.mapBay && (
          <span className="shrink-0 font-mono text-2xs text-white/35">{block.mapBay}</span>
        )}
        <span className={cn('shrink-0 text-2xs font-medium', PHASE_INK[summary.phase])}>
          {t(PHASE_KEY[summary.phase])}
        </span>
      </div>
      <dl className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-2xs text-white/50">
        <div className="flex gap-1">
          <dt>{t('painting.mapEntry.collection.steps')}</dt>
          <dd className="font-mono tabular-nums text-white/85">
            {summary.doneSteps}/{summary.steps.length}
          </dd>
        </div>
        {activeStep ? (
          <>
            <div className="flex gap-1">
              <dt>{t('painting.mapEntry.collection.activeStep')}</dt>
              <dd className={cn('font-mono', STATUS_STYLE.inProgress.glassInk)}>
                {t(STEP_NAME_KEY[activeStep.step])}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('performance.pnt.rows')}</dt>
              <dd className="font-mono tabular-nums text-white/85">
                {activeStep.doneRows}/{activeStep.plannedRows}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('painting.mapEntry.collection.dailyRate')}</dt>
              {/* 요약 줄이 정수로 말하므로 여기서도 반올림한다 — 같은 값을 두 자리로
                  다르게 적으면 두 줄이 서로 다른 수치처럼 읽힌다 */}
              <dd className="font-mono tabular-nums text-white/85">
                {Math.round(activeStep.progressPct)}%
              </dd>
            </div>
          </>
        ) : (
          <div className="flex gap-1">
            <dt>{t('painting.mapEntry.collection.noActiveStep')}</dt>
          </div>
        )}
      </dl>
    </li>
  )
}

/**
 * 수집 현황 본문. 데이터는 부모가 이미 접어 넘긴다(`paintingCollectionOf`) — 이 컴포넌트는
 * 집계를 하지 않고, 줄 구성도 lib(`paintingCollectionRows`)이 정한다.
 */
export function PaintingCollectionBody({
  collection,
}: {
  collection: PaintingFactoryCollection
}) {
  const { t } = useTranslation()
  const href = paintingFactoryStatusHref(collection.factory)
  const link = href
    ? {
        to: href,
        label: t('painting.mapEntry.collection.openFactory'),
        render: (to: string, label: string) => <PanelLink to={to} label={label} />,
      }
    : undefined

  /* 귀속 블록이 없는 공장 — 0 을 줄줄이 적는 대신 그렇다고 말하고 문만 남긴다 */
  if (collection.blockCount === 0) {
    return (
      <CollectionSummaryBody
        rows={[]}
        note={t('painting.mapEntry.collection.noBlocks')}
        link={link}
      />
    )
  }

  return (
    <div className="flex flex-col">
      <CollectionSummaryBody
        rows={paintingCollectionRows(collection).map((row) => ({
          label: t(row.labelKey as InshopKey),
          value: row.value,
        }))}
        note={
          collection.progressAsOf
            ? t('performance.pnt.dailyRateAsOf', { date: collection.progressAsOf })
            : t('performance.pnt.dailyRateNone')
        }
      />
      {/* 블록 목록은 요약 아래 — '몇 개'를 먼저 말하고 '어느 것'을 그 다음에 편다 */}
      <ul className="flex flex-col px-1 pb-2">
        {collection.blocks.map((block) => (
          <BlockRow key={block.key} block={block} />
        ))}
      </ul>
      {link && (
        <div className="px-3 pb-2.5">
          <PanelLink to={link.to} label={link.label} />
        </div>
      )}
    </div>
  )
}
