import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { Spinner } from '../../../ui/atoms/Spinner'
import type { EventInstant } from '../model/types'
import type { FabOverallBasis } from '../model/fabStages'
import { FAB_STAGE_LABEL_KEY } from './stageLabels'
import { PerfDialog } from './PerfDialog'

type View = 'auto' | 'legacy' | 'plan'

const instantText = (v: EventInstant | null) => (v ? `${v.date.slice(5)}${v.time ? ` ${v.time}` : ''}` : '—')
const pctText = (v: number | null) => (v === null ? '—' : `${v}%`)

/**
 * 종합 카드의 **근거 창** — 종합을 누르면 뜬다(사용자 확정). 세 수치를 탭으로 나눠
 * 산식 한 줄 + 그 산식에 들어간 줄(도면 · W/O · 절점)을 그대로 보여 준다. 표 맨 아래 합계 줄이
 * 카드의 숫자와 같아야 한다 — 다르면 어딘가 잘못 센 것이다.
 */
export function OverallBasisDialog({
  title,
  load,
  onClose,
  only,
}: {
  title: string
  load: () => Promise<FabOverallBasis>
  onClose: () => void
  /** 한 수치만 펼친다 — 탭 없이 그 근거만(사용자 확정: 레거시 정산 카드는 레거시 정산만, 종합 카드는 종합만) */
  only?: 'auto' | 'legacy'
}) {
  const { t, i18n } = useTranslation()
  const [basis, setBasis] = useState<FabOverallBasis | null>(null)
  const [view, setView] = useState<View>(only ?? 'auto')
  const heading = only === 'legacy' ? t('performance.overallBasis.legacy') : only === 'auto' ? t('performance.overallBasis.auto') : t('performance.overallBasis.title')
  const num = (n: number) => n.toLocaleString(i18n.language, { maximumFractionDigits: 2 })

  useEffect(() => {
    let cancelled = false
    void load().then((b) => {
      if (!cancelled) setBasis(b)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  const tabs: { key: View; label: string }[] = basis
    ? [
        { key: 'auto', label: `${t('performance.overallBasis.auto')} ${pctText(basis.overall.autoPct)}` },
        { key: 'legacy', label: `${t('performance.overallBasis.legacy')} ${pctText(basis.overall.legacyPct)}` },
        { key: 'plan', label: `${t('performance.overallBasis.plan')} ${pctText(basis.overall.planPct)}` },
      ]
    : []

  return (
    <PerfDialog
      label={heading}
      title={
        <>
          {heading}
          <span className="ml-2 text-inshop-sm font-normal tabular-nums text-foreground/55">{title}</span>
        </>
      }
      subtitle={basis && t('performance.overallBasis.asOf', { asOf: basis.asOf })}
      onClose={onClose}
    >
      {!basis ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <>
          {!only && (
            <div role="tablist" aria-label={t('performance.stageDetail.views')} className="flex shrink-0 gap-1 border-b border-border px-5 pt-2">
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-1.5 text-inshop-base font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    view === key ? 'border-accent text-accent' : 'border-transparent text-foreground/55 hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            {view === 'auto' && <AutoView basis={basis} num={num} />}
            {view === 'legacy' && <LegacyView basis={basis} num={num} />}
            {view === 'plan' && <PlanView basis={basis} />}
          </div>
        </>
      )}
    </PerfDialog>
  )
}

/** 산식 설명 띠 — 무엇을 무엇으로 나눴는지 + 이 블록의 실제 값 */
function Formula({ what, calc, note }: { what: string; calc: ReactNode; note?: string }) {
  return (
    <div className="border-b border-border bg-surface-secondary/40 px-5 py-3.5 text-inshop-sm leading-6">
      <div className="text-foreground/75">{what}</div>
      <div className="mt-1 text-inshop-lg font-semibold tabular-nums">{calc}</div>
      {note && <div className="mt-1 text-foreground/50">{note}</div>}
    </div>
  )
}

/* 세부 데이터 표와 같은 크기 · 간격(사용자 확정) */
const TH = 'whitespace-nowrap px-3 py-2.5 font-medium first:pl-5 last:pr-5'
const TD = 'whitespace-nowrap px-3 py-2.5 first:pl-5 last:pr-5'

function AutoView({ basis, num }: { basis: FabOverallBasis; num: (n: number) => string }) {
  const { t } = useTranslation()
  const targets = basis.drawings.filter((d) => d.excludedReason === null)
  const total = targets.reduce((s, d) => s + d.targetMh, 0)
  const done = targets.reduce((s, d) => s + d.doneMh, 0)
  return (
    <>
      <Formula
        what={
          basis.basis === 'plan'
            ? `${t('performance.overallBasis.autoWhat')} · ${t('performance.overallBasis.autoPlan')}`
            : t('performance.overallBasis.autoWhat')
        }
        calc={t('performance.overallBasis.calc', { done: num(done), target: num(total), unit: 'MH', pct: pctText(basis.overall.autoPct) })}
        note={t('performance.overallBasis.autoNote')}
      />
      <table className="w-full text-left text-inshop-base">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-inshop-sm text-foreground/55">
            <th className={TH}>{t('performance.stageDetail.dwgNo')}</th>
            <th className={TH}>{t('performance.stageDetail.site')}</th>
            <th className={TH}>{t('performance.overallBasis.cutDone')}</th>
            <th className={cn(TH, 'text-right')}>{t('performance.overallBasis.targetMh')}</th>
            <th className={cn(TH, 'text-right')}>{t('performance.overallBasis.doneMh')}</th>
            <th className={TH}>{t('performance.stageDetail.note')}</th>
          </tr>
        </thead>
        <tbody>
          {basis.drawings.map((d) => (
            <tr key={d.dwgNo} className={cn('border-b border-border/60', d.excludedReason && 'text-foreground/40')}>
              <td className={cn(TD, 'font-medium tabular-nums')}>{d.dwgNo}</td>
              <td className={TD}>{d.site === 'OUT' ? t('performance.stageDetail.out') : t('performance.stageDetail.in')}</td>
              <td className={cn(TD, 'tabular-nums')}>{instantText(d.cutDone)}</td>
              <td className={cn(TD, 'text-right tabular-nums')}>{num(d.targetMh)}</td>
              <td className={cn(TD, 'text-right tabular-nums')}>{d.excludedReason ? '—' : num(d.doneMh)}</td>
              <td className={TD}>{d.excludedReason ? t('performance.overallBasis.excluded', { reason: d.excludedReason }) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={TD} colSpan={3}>{t('performance.overallBasis.sum')}</td>
            <td className={cn(TD, 'text-right tabular-nums')}>{num(total)}</td>
            <td className={cn(TD, 'text-right tabular-nums')}>{num(done)}</td>
            <td className={TD} />
          </tr>
        </tfoot>
      </table>
    </>
  )
}

function LegacyView({ basis, num }: { basis: FabOverallBasis; num: (n: number) => string }) {
  const { t } = useTranslation()
  const targets = basis.workOrders.filter((w) => !w.excluded)
  const mh = targets.reduce((s, w) => s + w.planMh, 0)
  const weighted = targets.reduce((s, w) => s + (w.planMh * w.accRate) / 100, 0)
  const gap =
    basis.overall.legacyPct !== null && basis.overall.autoPct !== null
      ? Math.round((basis.overall.legacyPct - basis.overall.autoPct) * 10) / 10
      : null
  return (
    <>
      <Formula
        what={
          basis.basis === 'plan'
            ? `${t('performance.overallBasis.legacyWhat')} · ${t('performance.overallBasis.legacyPlan')}`
            : t('performance.overallBasis.legacyWhat')
        }
        calc={t('performance.overallBasis.calc', { done: num(weighted), target: num(mh), unit: 'MH', pct: pctText(basis.overall.legacyPct) })}
        note={gap === null ? undefined : t('performance.overallBasis.legacyGap', { gap: gap > 0 ? `+${gap}` : `${gap}` })}
      />
      <table className="w-full text-left text-inshop-base">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-inshop-sm text-foreground/55">
            <th className={TH}>W/O</th>
            <th className={TH}>{t('performance.stageDetail.dwgNo')}</th>
            <th className={TH}>{t('performance.overallBasis.step')}</th>
            <th className={cn(TH, 'text-right')}>{t('performance.overallBasis.planMh')}</th>
            <th className={cn(TH, 'text-right')}>{t('performance.overallBasis.accRate')}</th>
            <th className={cn(TH, 'text-right')}>{t('performance.overallBasis.weighted')}</th>
          </tr>
        </thead>
        <tbody>
          {basis.workOrders.map((w) => (
            <tr key={w.woNo} className={cn('border-b border-border/60', w.excluded && 'text-foreground/40')}>
              <td className={cn(TD, 'font-medium tabular-nums')}>{w.woNo}</td>
              <td className={cn(TD, 'tabular-nums text-foreground/60')}>{w.dwgNo ?? '—'}</td>
              <td className={TD}>{t(`performance.overallBasis.stepOf.${w.stepCode === 'CM' ? 'CM' : 'CT'}` as const)}</td>
              <td className={cn(TD, 'text-right tabular-nums')}>{num(w.planMh)}</td>
              <td className={cn(TD, 'text-right tabular-nums')}>{w.accRate}%</td>
              <td className={cn(TD, 'text-right tabular-nums')}>
                {w.excluded ? t('performance.overallBasis.excludedShort') : num((w.planMh * w.accRate) / 100)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={TD} colSpan={3}>{t('performance.overallBasis.sum')}</td>
            <td className={cn(TD, 'text-right tabular-nums')}>{num(mh)}</td>
            <td className={TD} />
            <td className={cn(TD, 'text-right tabular-nums')}>{num(weighted)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  )
}

function PlanView({ basis }: { basis: FabOverallBasis }) {
  const { t } = useTranslation()
  const counted = basis.plan.filter((p) => p.code !== null)
  const due = counted.filter((p) => p.due).length
  return (
    <>
      <Formula
        what={t('performance.overallBasis.planWhat')}
        calc={t('performance.overallBasis.planCalc', { due, total: counted.length, pct: pctText(basis.overall.planPct) })}
        note={t('performance.overallBasis.planNote')}
      />
      <table className="w-full text-left text-inshop-base">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-inshop-sm text-foreground/55">
            <th className={TH}>{t('performance.overallBasis.stage')}</th>
            <th className={TH}>{t('performance.overallBasis.code')}</th>
            <th className={TH}>{t('performance.overallBasis.blockPlan')}</th>
            <th className={TH}>{t('performance.overallBasis.dueCol')}</th>
          </tr>
        </thead>
        <tbody>
          {basis.plan.map((p) => (
            <tr key={p.stage} className={cn('border-b border-border/60', p.code === null && 'text-foreground/40')}>
              <td className={cn(TD, 'font-medium')}>{t(FAB_STAGE_LABEL_KEY[p.stage])}</td>
              <td className={cn(TD, 'text-foreground/60')}>{p.code ?? '—'}</td>
              <td className={cn(TD, 'tabular-nums')}>{p.planDate ?? '—'}</td>
              <td className={TD}>
                {p.code === null
                  ? t('performance.overallBasis.notCounted')
                  : p.due
                    ? t('performance.overallBasis.due')
                    : t('performance.overallBasis.notYet')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
