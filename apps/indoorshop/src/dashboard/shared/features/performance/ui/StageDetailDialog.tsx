import { useEffect, useMemo, useState } from 'react'
import { fetchEventDetail } from '../api/performanceApi'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { InshopKey } from '../../../lib/i18n/keys'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { Spinner } from '../../../ui/atoms/Spinner'
import type { CollectionEvent, EventDetail, EventInstant, FabStageId, StageStatus } from '../model/types'
import type { FabStageDetail, FabStageDetailRow } from '../model/fabStages'
import { FAB_STAGE_LABEL_KEY } from './stageLabels'
import { PerfDialog } from './PerfDialog'

const STATUS_KEY: Record<StageStatus, InshopKey> = {
  done: 'performance.status.done',
  inProgress: 'performance.status.inProgress',
  notDue: 'performance.status.notDue',
  excluded: 'performance.status.excluded',
}

const STATUS_CLASS: Record<StageStatus, string> = {
  done: STATUS_STYLE.done.chip,
  inProgress: STATUS_STYLE.inProgress.chip,
  notDue: STATUS_STYLE.idle.chip,
  excluded: 'bg-surface-secondary text-foreground/45',
}

const FILTERS: readonly (StageStatus | 'all')[] = ['all', 'done', 'inProgress', 'notDue', 'excluded']

/**
 * 세부 줄의 순서 — **계획일 최신순**(사용자 확정). 계획일이 같으면 실적 일시 최신순, 그다음 번호순.
 * 계획일이 없는 줄은 맨 아래에 둔다.
 */
function actualKeyOf(row: FabStageDetailRow): string {
  return row.actual ? `${row.actual.date} ${row.actual.time ?? '00:00'}` : ''
}
function compareRows(a: FabStageDetailRow, b: FabStageDetailRow): number {
  return (
    (b.planDate ?? '').localeCompare(a.planDate ?? '') ||
    actualKeyOf(b).localeCompare(actualKeyOf(a)) ||
    a.id.localeCompare(b.id)
  )
}

const instantText = (v: EventInstant | null) => (v ? `${v.date.slice(5)}${v.time ? ` ${v.time}` : ''}` : '—')

/**
 * 절점 세부 **임시 창** — 절점 카드를 누르면 그 절점을 도면(S1~S4 · S6 · S7) 또는 부재(S8~S10) 단위로 편다.
 * 카드 숫자(완료 · 진행 중 · 미도래 · 미대상)를 줄로 풀어 어느 도면 · 부재가 어디에 걸렸는지 본다.
 *
 * 원천은 가공 OT API v1.0 — 도면 줄은 C3 · C4(cp_stats · cp_plan · cpHistory), 부재 줄은 B5. 지금은 모의 서버다.
 * 같은 창의 두 번째 탭이 **이 절점의 수집 현황**이다 — 수집 현황을 절점 아래 펼쳐 두지 않고 여기서 본다(사용자 확정).
 * 창 틀(높이 고정 · 뒤 스크롤 잠금 · 닫기)은 `PerfDialog`.
 */
export function StageDetailDialog({
  title,
  stage,
  load,
  events,
  loadEventDetail,
  onClose,
}: {
  /** 머리에 붙일 호선-블록 */
  title: string
  stage: FabStageId
  load: (stage: FabStageId) => Promise<FabStageDetail>
  /** 이 블록의 수집 현황 행 — 창이 이 절점의 것만 거른다 */
  events: CollectionEvent[]
  loadEventDetail?: (event: CollectionEvent) => Promise<EventDetail>
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [detail, setDetail] = useState<FabStageDetail | null>(null)
  const [filter, setFilter] = useState<StageStatus | 'all'>('all')
  /** 창 안의 두 보기 — 세부 데이터(도면 · 부재 줄) / 이 절점의 수집 현황(사용자 확정) */
  const [view, setView] = useState<'detail' | 'sub' | 'events'>('detail')
  const stageEvents = useMemo(() => events.filter((e) => e.stage === stage), [events, stage])
  /**
   * 세부 줄마다 붙는 수집 현황 건수 — 관리번호(도면 · 부재 번호)가 같은 사건을 센다. 한 줄에 0~여러 건이다
   * (S7 은 마킹 완료 + 절단 완료 두 원천). 건수를 누르면 수집 현황 탭이 그 도면 · 부재의 사건만 보인다.
   */
  const eventCountOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of stageEvents) m.set(e.mgmtNo, (m.get(e.mgmtNo) ?? 0) + 1)
    return m
  }, [stageEvents])
  const [eventsOf, setEventsOf] = useState<string | null>(null)
  /**
   * 수집 현황 탭 왼쪽의 거르기 목록 — 수집 데이터가 있는 세부 줄만, 세부 데이터와 같은 순서(계획일 최신순)로.
   * 세부 줄에 없는 관리번호의 사건(있으면)은 뒤에 붙인다.
   */
  const eventTargets = useMemo(() => {
    const ordered = [...(detail?.rows ?? [])].sort(
      compareRows
    )
    const ids = ordered.map((r) => r.id).filter((id) => eventCountOf.has(id))
    for (const id of eventCountOf.keys()) if (!ids.includes(id)) ids.push(id)
    return ids.map((id) => ({ id, count: eventCountOf.get(id)! }))
  }, [detail, eventCountOf])
  const shownEvents = eventsOf ? stageEvents.filter((e) => e.mgmtNo === eventsOf) : stageEvents

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setFilter('all')
    void load(stage).then((d) => {
      if (!cancelled) setDetail(d)
    })
    return () => {
      cancelled = true
    }
  }, [stage, load])

  /*
   * 지금 표가 펴는 줄 — 세부 데이터(이 절점) 또는 보조 절점(S7 아래 곡가공, 부재 줄). 표 · 상태 거르기는 같다.
   */
  const active = useMemo(
    () =>
      view === 'sub' && detail?.sub
        ? { basis: 'PART' as const, unit: '개', rows: detail.sub.rows, steelLayers: null }
        : detail,
    [view, detail]
  )
  const counts = useMemo(() => {
    const c: Record<StageStatus | 'all', number> = { all: 0, done: 0, inProgress: 0, notDue: 0, excluded: 0 }
    for (const row of active?.rows ?? []) {
      c[row.status]++
      c.all++
    }
    return c
  }, [active])
  const rows = useMemo(
    () =>
      (active?.rows ?? [])
        .filter((r) => filter === 'all' || r.status === filter)
        .sort(compareRows),
    [active, filter]
  )
  const isPart = active?.basis === 'PART'
  const isMat = active?.basis === 'MAT'
  /** 표 합계 — 보이는 줄에서 미대상을 뺀다(카드의 분모와 같은 규칙) */
  const totals = useMemo(() => {
    const t = { unitsDone: 0, unitsTarget: 0, qtyDone: 0, qtyTarget: 0 }
    for (const r of rows) {
      if (r.status === 'excluded') continue
      if (r.units) {
        t.unitsDone += r.units.done
        t.unitsTarget += r.units.target
      }
      if (r.qty) {
        t.qtyDone += r.qty.done
        t.qtyTarget += r.qty.target
      }
    }
    return { ...t, qtyDone: Math.round(t.qtyDone * 100) / 100, qtyTarget: Math.round(t.qtyTarget * 100) / 100 }
  }, [rows])
  /* 수집 열 — 보조 절점(곡가공)은 수집 현황에 세우지 않으므로 열을 두지 않는다 */
  const showEventCount = view !== 'sub'
  const num = (n: number) => n.toLocaleString(i18n.language)

  return (
    <PerfDialog
      label={t(FAB_STAGE_LABEL_KEY[stage])}
      title={
        <>
          {t(FAB_STAGE_LABEL_KEY[stage])}
          <span className="ml-2 text-inshop-base font-normal tabular-nums text-foreground/55">{title}</span>
        </>
      }
      subtitle={
        detail &&
        (detail.code
          ? t('performance.stageDetail.meta', {
              code: detail.code,
              axis: t(`performance.stages.axis.${detail.basis ?? 'DWG'}` as const),
              asOf: detail.asOf,
            })
          : t('performance.stages.noCodeNote'))
      }
      onClose={onClose}
    >
      <div role="tablist" aria-label={t('performance.stageDetail.views')} className="flex shrink-0 gap-1 border-b border-border px-5 pt-2">
        {(detail?.sub ? (['detail', 'sub', 'events'] as const) : (['detail', 'events'] as const)).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => {
              setView(key)
              setFilter('all')
              /* 탭을 직접 누르면 전체로 — 한 도면 · 부재로 거르는 것은 세부 줄의 건수만 한다 */
              setEventsOf(null)
            }}
            className={cn(
              '-mb-px border-b-2 px-3 py-1.5 text-inshop-base font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              view === key ? 'border-accent text-accent' : 'border-transparent text-foreground/55 hover:text-foreground'
            )}
          >
            {/* 탭 이름은 이름만 — 건수는 표의 상태 거르기 · 카드가 말한다(사용자 확정) */}
            {key === 'detail'
              ? t('performance.stageDetail.viewDetail')
              : key === 'sub' && detail?.sub
                ? t(`performance.stageDetail.viewSubOf.${detail.sub.code === 'BEND_DONE' ? 'BEND_DONE' : 'other'}` as const)
                : t('performance.stageDetail.viewEvents')}
          </button>
        ))}
      </div>
        {view === 'events' ? (
          /* 위: 수집 데이터가 있는 세부 줄(도면 · 부재) 목록을 가로로 — 누르면 그 줄의 사건만(사용자 확정).
             많으면 줄을 바꾸지 않고 옆으로 구른다. 아래: 수집 현황 */
          <div className="flex min-h-0 flex-1 flex-col">
            <nav
              aria-label={t('performance.stageDetail.eventTargets')}
              className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-2"
            >
              <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-contain text-inshop-base [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[{ id: null as string | null, count: stageEvents.length }, ...eventTargets].map(({ id, count }) => {
                  const on = eventsOf === id
                  return (
                    <li key={id ?? 'all'} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setEventsOf(id)}
                        className={cn(
                          'flex items-center gap-1.5 whitespace-nowrap rounded-inshop-md border px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          on
                            ? 'border-accent/60 bg-accent/10 font-semibold text-accent'
                            : 'border-border text-foreground/75 hover:bg-surface-secondary'
                        )}
                      >
                        <span className="tabular-nums">{id ?? t('performance.stageDetail.all')}</span>
                        <span className={cn('shrink-0 tabular-nums', on ? 'text-accent' : 'text-foreground/45')}>
                          {t('performance.stageDetail.eventCountValue', { count })}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {eventTargets.length === 0 && (
                <p className="shrink-0 text-inshop-sm text-foreground/45">{t('performance.stageDetail.noEventTargets')}</p>
              )}
            </nav>
            <StageEventsTable
              /* 한 도면 · 부재를 고르면 그 첫 사건을 골라 둔 채로 새로 선다 — 하위 데이터가 곧바로 보인다(사용자 확정) */
              key={eventsOf ?? 'all'}
              events={shownEvents}
              initialSelectedId={eventsOf ? shownEvents[0]?.id : undefined}
              loadDetail={loadEventDetail}
            />
          </div>
        ) : !detail || !active ? (
          <div className="grid flex-1 place-items-center">
            <Spinner />
          </div>
        ) : active.rows.length === 0 ? (
          <div className="grid flex-1 place-items-center px-5 text-inshop-base text-foreground/55">{t('performance.stageDetail.empty')}</div>
        ) : (
          <>
            {/* 탭 바로 밑의 카드 요약 줄은 뺐다(사용자 확정) — 카드 숫자는 표 맨 아래 합계 줄이 말한다 */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
              <div role="radiogroup" aria-label={t('performance.stageDetail.filter')} className="flex flex-wrap gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'rounded-inshop-md border px-2.5 py-1 text-inshop-base tabular-nums transition-colors',
                      filter === f
                        ? 'border-accent/60 bg-accent/10 text-accent'
                        : 'border-border text-foreground/60 hover:bg-surface-secondary'
                    )}
                  >
                    {f === 'all' ? t('performance.stageDetail.all') : t(STATUS_KEY[f])} {counts[f]}
                  </button>
                ))}
              </div>
              {/* 강재 절점은 카드가 강판 장 수로 세지만, 줄은 도면이다 — 거르기 숫자가 무엇을 센 것인지 밝힌다 */}
              {isMat && <span className="text-inshop-sm text-foreground/45">{t('performance.stageDetail.filterByDrawing')}</span>}
              {active.steelLayers && (
                <div className="ml-auto text-inshop-base tabular-nums text-foreground/55">
                  {t('performance.stageDetail.steelLayers', {
                    secured: active.steelLayers.secured,
                    shortage: active.steelLayers.shortage,
                    overdue: active.steelLayers.overdue,
                  })}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
              <table className="w-full text-left text-inshop-base [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-inshop-sm text-foreground/55">
                    <th className="px-5 py-2.5 font-medium">{isPart ? t('performance.stageDetail.partNo') : t('performance.stageDetail.dwgNo')}</th>
                    {isPart && <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.dwgNo')}</th>}
                    <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.site')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.status')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.plan')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.actual')}</th>
                    <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.source')}</th>
                    {isMat && <th className="px-3 py-2.5 text-right font-medium">{t('performance.stageDetail.plates')}</th>}
                    <th className="px-3 py-2.5 text-right font-medium">
                      {isPart ? t('performance.stageDetail.weight') : t('performance.stageDetail.qty', { unit: active.unit })}
                    </th>
                    {/* 머리도 칸 안의 숫자와 같은 안쪽 여백만큼 들여 끝을 맞춘다 */}
                    {showEventCount && (
                      <th className="py-2.5 pl-3 pr-[1.125rem] text-right font-medium">{t('performance.stageDetail.eventCount')}</th>
                    )}
                    <th className="px-5 py-2.5 font-medium">{t('performance.stageDetail.note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-5 py-2.5 font-medium tabular-nums">{row.id}</td>
                      {isPart && <td className="px-3 py-2.5 tabular-nums text-foreground/60">{row.dwgNo}</td>}
                      <td className="px-3 py-2.5 text-foreground/60">
                        {row.site === 'OUT' ? t('performance.stageDetail.out') : t('performance.stageDetail.in')}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('rounded px-1.5 py-0.5 text-inshop-sm font-medium', STATUS_CLASS[row.status])}>
                          {t(STATUS_KEY[row.status])}
                        </span>
                        {row.delayed && (
                          <span className="ml-1 rounded bg-status-unhealthy/10 px-1.5 py-0.5 text-inshop-sm font-medium text-status-unhealthy">
                            {t('performance.stages.delayed')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground/70">{row.planDate?.slice(5) ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground/70">{instantText(row.actual)}</td>
                      <td className="px-3 py-2.5 text-foreground/60">{row.source ?? '—'}</td>
                      {isMat && (
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {row.units ? `${row.units.done}/${row.units.target}` : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.qty ? (isPart ? num(row.qty.target) : `${num(row.qty.done)} / ${num(row.qty.target)}`) : '—'}
                      </td>
                      {showEventCount && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {(() => {
                          const n = eventCountOf.get(row.id) ?? 0
                          /* 0건도 같은 꼴 · 같은 안쪽 여백으로 — 숫자 끝이 한 줄로 맞는다(사용자 지적) */
                          if (n === 0)
                            return (
                              <span className="inline-block px-1.5 py-0.5 text-foreground/35">
                                {t('performance.stageDetail.eventCountValue', { count: 0 })}
                              </span>
                            )
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setEventsOf(row.id)
                                setView('events')
                              }}
                              aria-label={t('performance.stageDetail.eventCountOpen', { id: row.id, count: n })}
                              className="inline-block rounded px-1.5 py-0.5 font-medium text-accent underline-offset-2 hover:bg-accent/10 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {t('performance.stageDetail.eventCountValue', { count: n })}
                            </button>
                          )
                        })()}
                      </td>
                      )}
                      <td className="px-5 py-2.5 text-foreground/50">{row.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
                {/* 합계 — 보이는 줄 중 미대상을 뺀 합. '전체' 일 때 카드 숫자와 같다 */}
                <tfoot className="sticky bottom-0 bg-surface">
                  <tr className="border-t border-border font-semibold">
                    <td className="px-5 py-2.5" colSpan={isPart ? 7 : 6}>
                      {t('performance.stageDetail.total')}
                    </td>
                    {isMat && (
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {totals.unitsDone}/{totals.unitsTarget}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {isPart ? num(totals.qtyTarget) : `${num(totals.qtyDone)} / ${num(totals.qtyTarget)}`}
                    </td>
                    {showEventCount && <td />}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <footer className="shrink-0 border-t border-border px-5 py-2 text-inshop-sm text-foreground/45">
              {isPart ? t('performance.stageDetail.sourcePart') : t('performance.stageDetail.sourceDwg')}
            </footer>
          </>
        )}
    </PerfDialog>
  )
}


/**
 * 수집 현황 표 — 세부 데이터 표와 **같은 모양**(사용자 확정): 같은 글씨 크기 · 머리줄 · 줄 간격, 창 폭을 다 쓴다.
 * 행을 누르면 그 사건의 하위 데이터(원천 항목 · 값)가 표 아래에 펼쳐진다. 적색 배지는 '확인 필요'다.
 */
function StageEventsTable({
  events,
  initialSelectedId,
  loadDetail = fetchEventDetail,
}: {
  events: CollectionEvent[]
  initialSelectedId?: string
  loadDetail?: (event: CollectionEvent) => Promise<EventDetail>
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<CollectionEvent | null>(() => events.find((e) => e.id === initialSelectedId) ?? null)
  const [detail, setDetail] = useState<EventDetail | null>(null)
  useEffect(() => {
    let cancelled = false
    setDetail(null)
    if (!selected) return
    void loadDetail(selected).then((d) => {
      if (!cancelled) setDetail(d)
    })
    return () => {
      cancelled = true
    }
  }, [selected, loadDetail])

  if (events.length === 0) {
    return <div className="grid flex-1 place-items-center px-5 text-inshop-base text-foreground/55">{t('performance.grid.empty')}</div>
  }
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full text-left text-inshop-base [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-inshop-sm text-foreground/55">
              <th className="px-5 py-2.5 font-medium">{t('performance.grid.mgmtNo')}</th>
              <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.status')}</th>
              <th className="px-3 py-2.5 font-medium">{t('performance.grid.occurred')}</th>
              <th className="px-3 py-2.5 font-medium">{t('performance.grid.completed')}</th>
              <th className="px-3 py-2.5 font-medium">{t('performance.stageDetail.source')}</th>
              <th className="px-5 py-2.5 font-medium">{t('performance.stageDetail.note')}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const on = selected?.id === event.id
              return (
                <tr
                  key={event.id}
                  aria-selected={on}
                  onClick={() => setSelected(on ? null : event)}
                  className={cn(
                    'cursor-pointer border-b border-border/60 transition-colors hover:bg-surface-secondary/40',
                    on && 'bg-accent/[0.08]'
                  )}
                >
                  <td className="px-5 py-2.5 font-medium tabular-nums">
                    <span className="mr-1.5 rounded bg-surface-secondary px-1 py-px text-[13px] text-foreground/60">{event.mgmtNoType}</span>
                    {event.mgmtNo}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('rounded px-1.5 py-0.5 text-inshop-sm font-medium', STATUS_CLASS[event.status])}>
                      {t(STATUS_KEY[event.status])}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-foreground/70">{instantText(event.occurred)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-foreground/70">{instantText(event.completed)}</td>
                  <td className="px-3 py-2.5 text-foreground/60">{event.sources}</td>
                  <td className="px-5 py-2.5">
                    {event.flagged && (
                      <span className="rounded bg-status-unhealthy/10 px-1.5 py-0.5 text-inshop-sm font-medium text-status-unhealthy">
                        {t('performance.grid.flagged')}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* 고른 사건의 하위 데이터 — 표 아래에 펼친다 */}
      <section
        aria-label={t('performance.detail.title')}
        className="max-h-[40%] shrink-0 overflow-y-auto overscroll-contain border-t border-border bg-surface-secondary/30 px-5 py-3 text-inshop-base"
      >
        {!selected ? (
          <p className="text-foreground/55">{t('performance.detail.hint')}</p>
        ) : !detail ? (
          <Spinner />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">
                {t('performance.detail.title')} — <span className="tabular-nums">{selected.mgmtNo}</span>
              </span>
              <span className="text-inshop-sm text-foreground/60">
                {t('performance.detail.unit')}: {detail.unit}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-x-6 gap-y-1">
              {detail.entries.map((entry) => (
                <div key={entry.label} className="flex justify-between gap-3 border-b border-border/50 py-1">
                  <dt className="text-foreground/60">{entry.label}</dt>
                  <dd className="text-right font-medium tabular-nums">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>
      <footer className="shrink-0 border-t border-border px-5 py-2 text-inshop-sm text-foreground/45">
        {t('performance.stageDetail.sourceEvents')}
      </footer>
    </>
  )
}
