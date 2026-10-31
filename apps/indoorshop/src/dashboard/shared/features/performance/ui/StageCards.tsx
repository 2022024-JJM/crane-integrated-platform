import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { STATUS_STYLE } from '../../../ui/statusPalette'
import { Card } from '../../../ui/atoms/Card'
import { fabStagesOfGroup, type FabStageGroup, type FabStageId } from '../model/types'
import type { FabStageCard, FabStageSummary } from '../model/fabStages'
import { FAB_STAGE_LABEL_KEY } from './stageLabels'
import {
  defaultTileRows,
  dropOnTile,
  isDefaultRows,
  isWideTile,
  loadTileRows,
  moveByKey,
  moveToNewRow,
  saveTileRows,
  OVERALL_SECTIONS,
  type StageCardKey,
  type StageTileId,
  type TileRows,
} from './stageTileOrder'

/** 한 줄의 작은 칸 수 → 넓은 화면에서의 폭 (Tailwind 가 읽을 수 있게 통째 문자열로) */
const SMALL_SPAN: Record<number, string> = { 1: 'xl:col-span-12', 2: 'xl:col-span-6', 3: 'xl:col-span-4' }
/** 보이는 구간 수 → 구간 칸 안의 열 수 */
const SECTION_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }

/**
 * 단계 판 바탕 — 적치(강재를 쌓아 두는 일)는 찬 회청색, 가공은 회녹색. 상태색 · 강조색(종합)과 겹치지 않는다.
 * 카드(면 색 + 그림자)가 판 바탕 위에 뚜렷이 떠 보일 만큼 진하게 둔다(사용자 지적: 판과 카드 경계가 안 보인다).
 */
const GROUP_TONE: Record<FabStageGroup, string> = {
  stack: 'border-[rgb(120_150_200/0.4)] bg-[rgb(120_150_200/0.16)]',
  fab: 'border-[rgb(100_175_150/0.4)] bg-[rgb(100_175_150/0.16)]',
}


/**
 * 가공권역 절점 카드 10장 + 종합 카드 (IPD-S04 · 기준일 스냅샷).
 *
 * 값은 가공 OT API v1.0 C2 를 따른다. 실적률은 **절점마다 자기 단위로** 센다(사용자 확정) —
 * 강재 절점은 중량(kg), 도면 절점은 시수(MH), 부재 절점은 개수다. 세 단위를 섞지 않으므로
 * 카드가 그 단위(중량% · 시수% · 건수%)와 분자/분모 양을 함께 적는다.
 * 종합은 판별 실적%(절단 완료 도면 시수 가중)이고 레거시 정산% · 계획% 를 곁들인다.
 *
 * **배치(넓은 화면, xl 이상)** — 12열 격자 두 줄: 위 줄은 적치 단계 판(S1~S4, 오른쪽 아홉 칸), 아래 줄은 가공 단계 판
 * (S5~S10, 열두 칸). 두 판은 바탕색이 달라 단계가 한눈에 갈린다(사용자 확정). 종합은 위 줄 왼쪽 세 칸에
 * 따로 선다 — 강조색 바탕 · 가운데 정렬로, 절점 카드로 읽히지 않게 한다(사용자 확정).
 * 격자는 부모가 준 높이를 다 채운다(`fill`) — 화면이 스크롤되지 않는 선에서 카드를 키운다(사용자 확정).
 * 그보다 좁으면 종합 · 적치 판 · 가공 판이 위아래로 쌓이고(적치 4열 · 가공 3열, 휴대폰은 2열) 화면이 스크롤된다.
 *
 * 카드를 누르면 `onSelectStage` 로 알린다 — 가공 탭은 절점 카드로 그 절점의 세부 창(세부 데이터 ·
 * 수집 현황 탭)을 띄운다(사용자 확정). `activeStage` 는 지금 펼친 절점의 강조다.
 */
export function StageCards({
  summary,
  activeStage,
  onSelectStage,
  onOpenOverall,
  counts,
  movable = false,
  hidden,
}: {
  summary: FabStageSummary
  /** 지금 세부 창에 펼친 절점 — null 이면 없음 */
  activeStage: FabStageId | null
  onSelectStage: (stage: FabStageId | null) => void
  /** 레거시 정산 · 종합 카드를 눌렀다 — 그 수치의 근거만 펼친다. 없으면 `onSelectStage(null)` */
  onOpenOverall?: (view: 'auto' | 'legacy') => void
  /** 카드를 누르면 뜨는 창의 줄 수 — 세부 데이터(도면 · 부재) · 수집 현황. 아직 모르면 비운다 */
  counts?: Partial<Record<FabStageId, { detail: number; events: number }>>
  /** 카드 이동 켬 — 손잡이 · 새 줄 자리 · 되돌리기가 선다. 끄면 저장된 배치 그대로 고정된다(테스트 영역 토글) */
  movable?: boolean
  /** 「구성」에서 끈 카드 — 숨긴 칸이 빠진 줄은 남은 칸이 폭을 나눠 쓴다. 저장된 배치는 그대로 둔다 */
  hidden?: ReadonlySet<StageCardKey>
}) {
  const { t, i18n } = useTranslation()
  /* 카드 배치 — 이 브라우저에 남는다 (`stageTileOrder`) */
  const [rows, setRows] = useState<TileRows>(loadTileRows)
  const [dragging, setDragging] = useState<StageTileId | null>(null)
  /** 끌고 있는 칸이 올라선 곳 — 칸이거나, 줄 사이 자리(`row:{n}` — n 번째 줄 앞)다 */
  const [dragOver, setDragOver] = useState<StageTileId | `row:${number}` | null>(null)
  /* 키보드로 줄을 옮기면 칸이 새 줄에서 다시 그려져 초점이 풀린다 — 옮긴 칸의 손잡이로 되돌린다 */
  const refocus = useRef<StageTileId | null>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    layoutRef.current?.querySelector<HTMLElement>(`[data-tile="${id}"] > button[draggable]`)?.focus()
  }, [rows])
  const stagesOf = (group: FabStageGroup) => {
    const ids = fabStagesOfGroup(group)
    return summary.stages.filter((s) => ids.includes(s.stage))
  }

  /**
   * 단계 판 — 머리(단계 이름 · 절점 범위) + 그 단계의 절점 카드. 판마다 바탕색이 달라 적치/가공이 갈린다.
   * 판 안의 카드 격자가 판의 남는 너비 · 높이를 다 쓴다.
   */
  const groupPanel = (group: FabStageGroup, className: string, cols: string) => {
    const ids = fabStagesOfGroup(group)
    return (
      <section
        key={group}
        aria-label={t(`performance.stages.group.${group}` as const)}
        className={cn('flex min-h-0 flex-col gap-1.5 rounded-inshop-xl border p-2', GROUP_TONE[group], className)}
      >
        {/* 단계 이름은 판 위에 가로로(사용자 확정) — 한 줄로 낮게 둬 세로 자리를 카드에 준다 */}
        <div className="flex items-center gap-1.5 px-1 text-inshop-xs leading-4">
          <span className="font-semibold text-foreground/88">{t(`performance.stages.group.${group}` as const)}</span>
          <span className="text-[11px] tabular-nums text-foreground/70">
            {t('performance.stages.groupRange', { from: ids[0], to: ids[ids.length - 1] })}
          </span>
        </div>
        <div className={cn('grid min-h-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3', cols)}>{stagesOf(group).map(stageCard)}</div>
      </section>
    )
  }

  /** 레거시 정산 · 종합 카드 — 누르면 그 수치의 근거만 */
  const pressOverall = (view: 'auto' | 'legacy') => {
    const open = () => (onOpenOverall ? onOpenOverall(view) : onSelectStage(null))
    return {
      role: 'button' as const,
      tabIndex: 0,
      onClick: open,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      },
    }
  }

  const press = (stage: FabStageId | null) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => onSelectStage(stage),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelectStage(stage)
      }
    },
  })

  const stageCard = (s: FabStageCard) => {
    const rate = s.rate ?? 0
    const complete = s.rate !== null && s.rate >= 100
    /* 건수가 무엇을 센 것인지 — 강판 · 도면은 장, 부재는 개 (사용자 확정: '건수' 대신 세는 대상의 이름) */
    const countUnit = s.basis ? t(`performance.stages.countUnit.${s.basis}` as const) : ''
    const measureLabel = s.measure ? t(`performance.stages.measure.${s.measure}` as const) : t('performance.stages.rateNone')
    const showQty = s.measure !== null && s.measure !== 'COUNT'
    return (
      <Card
        key={s.stage}
        interactive
        aria-pressed={activeStage === s.stage}
        {...press(s.stage)}
        className={cn('flex min-h-[15rem] cursor-pointer flex-col px-4 py-3.5 shadow-[0_1px_3px_rgb(0_0_0/0.35)]', activeStage === s.stage && 'border-accent/60')}
      >
        {/* 이름 뒤에 배지가 이어 붙고, 자리가 모자라면 배지가 다음 줄로 — 이름은 꺾이지 않는다 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="shrink-0 whitespace-nowrap text-inshop-base font-semibold">{t(FAB_STAGE_LABEL_KEY[s.stage])}</span>
          {/* 원천 확정 대기 · 보류 · Hot DB 에 없는 절점 · 지연 — 근거가 아직 없다는 사실을 카드가 스스로 적는다.
              감추면 '다 수집되고 있다' 는 거짓말이 된다. */}
          <span className="flex min-w-0 flex-wrap gap-1">
            {s.code === null && (
              <span className="rounded bg-surface-secondary whitespace-nowrap px-1.5 py-px text-inshop-xs text-foreground/75">
                {t('performance.stages.noCode')}
              </span>
            )}
            {s.pendingSource && (
              <span className="rounded bg-status-degraded/10 whitespace-nowrap px-1.5 py-px text-inshop-xs text-status-degraded">
                {t('performance.stages.s1Pending')}
              </span>
            )}
            {s.held && (
              <span className="rounded bg-surface-secondary whitespace-nowrap px-1.5 py-px text-inshop-xs text-foreground/75">
                {t('performance.stages.held')}
              </span>
            )}
            {s.delayed && (
              <span className="rounded bg-status-unhealthy/10 whitespace-nowrap px-1.5 py-px text-inshop-xs text-status-unhealthy">
                {t('performance.stages.delayed')}
              </span>
            )}
          </span>
        </div>

        {/* 수치 · % · 단위를 한 바닥선에 맞춘다(사용자 확정: 아래 정렬). 단위만 적는다 — kg · MH · 개 */}
        <div
          className={cn(
            'mt-3 flex items-baseline text-[2.25rem] leading-none font-semibold tabular-nums',
            complete ? 'text-status-healthy' : s.rate === null ? 'text-foreground/55' : 'text-foreground'
          )}
        >
          {s.rate ?? '—'}
          {s.rate !== null && <span className="text-inshop-xl text-foreground/70">%</span>}
          {/* 실적% 옆에는 단위를 적지 않는다(사용자 확정) — 단위는 아래 양 줄(kg · MH)과 건수 줄(장 · 개)이 말한다 */}
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-secondary"
          role="img"
          aria-label={`${measureLabel} ${s.rate ?? '—'}`}
        >
          {/* 바는 한 규칙만 쓴다(감사 F-9) — 값에 따른 상태색: 다 차면 완료, 아니면 진행중 */}
          <div
            className={cn('h-full rounded-full', complete ? STATUS_STYLE.done.fill : STATUS_STYLE.inProgress.fill)}
            style={{ width: `${Math.min(100, rate)}%` }}
          />
        </div>

        {/* 분자/분모 양 — 실적률이 무엇을 센 값인지(kg · MH) 숫자로 보여 준다. 개수 절점은 아래 건수와 같아 생략 */}
        {showQty && (
          <div className="mt-4 whitespace-nowrap text-[15px] font-medium tabular-nums text-foreground/90">
            {/* 무엇의 양인지 앞에 적는다(사용자 확정) — 적치(강재) 절점은 강판 중량, 도면 절점(S6 · S7)은 시수 */}
            {s.basis === 'MAT' && <span className="mr-1.5">{t('performance.stages.qtyOfMat')}</span>}
            {s.basis === 'DWG' && <span className="mr-1.5">{t('performance.stages.qtyOfDwg')}</span>}
            {t('performance.stages.qty', {
              done: s.doneQty.toLocaleString(i18n.language),
              target: s.targetQty.toLocaleString(i18n.language),
              unit: s.unit,
            })}
          </div>
        )}
        <div
          className={cn(
            'flex flex-wrap justify-between gap-x-2 tabular-nums',
            showQty ? 'mt-1.5 text-[15px] text-foreground/80' : 'mt-4 text-inshop-base font-medium text-foreground/90'
          )}
        >
          <span>
            {s.basis
              ? t(`performance.stages.countsOf.${s.basis}` as const, { done: s.doneCount, target: s.targetCount })
              : t('performance.stages.counts', { done: s.doneCount, target: s.targetCount })}
          </span>
          {/* 보조 줄 — 화면 절점은 아니지만 이 절점 안에서 일어나는 일(S7 아래 곡가공, 명세 §9). 건수 줄 오른쪽에 붙인다 */}
          {s.sub && (
            <span className="text-foreground/80">
              {t('performance.stages.sub', {
                /* 이름은 화면 낱말로 — 원천 이름('곡가공 완료') 대신 창의 탭과 같은 '곡가공'(사용자 확정) */
                name: t(`performance.stageDetail.viewSubOf.${s.sub.code === 'BEND_DONE' ? 'BEND_DONE' : 'other'}` as const),
                done: s.sub.doneCount,
                target: s.sub.targetCount,
              })}
            </span>
          )}
        </div>
        {/* 진행중 · 미도래 수는 카드에 적지 않는다(사용자 확정) — 세부 창의 상태 거르기가 말한다. 미대상만 있을 때 적는다 */}
        {s.excludedCount > 0 && (
          <div className="mt-1 text-inshop-sm tabular-nums text-foreground/72">
            {t('performance.stages.excludedOf', { count: s.excludedCount, unit: countUnit })}
          </div>
        )}
        {/* 아래 단은 카드 바닥에 붙인다 — 같은 줄 카드의 근거 줄이 한 높이에 선다 */}
        <div className="mt-auto flex flex-wrap justify-between gap-x-2 gap-y-0.5 border-t border-border pt-2.5 text-[13px] leading-5 text-foreground/70">
          {/* 누르면 뜨는 창에 몇 줄이 있는지 — 세부 데이터 · 수집 현황(사용자 확정). 절점 코드 · 단위는 창 머리가 말한다 */}
          {/* 좁으면 줄을 바꿔 두 값을 온전히 둔다 — 말줄임으로 숫자가 잘리지 않게. S5 안내문만 말줄임 */}
          <span className={cn('tabular-nums', s.basis ? 'whitespace-nowrap' : 'min-w-0 truncate')} title={!s.basis ? t('performance.stages.noCodeNote') : undefined}>
            {!s.basis
              ? t('performance.stages.noCodeNote')
              : counts?.[s.stage]
                ? t('performance.stages.windowCounts', counts[s.stage]!)
                : `${s.code} · ${t(`performance.stages.axis.${s.basis}` as const)}`}
          </span>
          {/* 계획일은 아래 줄에서 가장 먼저 찾는 값이라 밝게(사용자 확정) */}
          {s.planDate && (
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {t('performance.stages.planDate', { date: s.planDate.slice(5) })}
            </span>
          )}
        </div>
      </Card>
    )
  }

  /* 다섯 칸 — 끌어서 자리를 바꾸고, 줄 사이에 놓으면 새 줄을 쓴다(사용자 확정). 배치는 줄의 목록(`stageTileOrder`) */
  const shownSections = OVERALL_SECTIONS.filter((section) => !hidden?.has(`sec-${section.key}`))
  const tileShown = (id: StageTileId) => (id === 'sections' ? shownSections.length > 0 : !hidden?.has(id))
  /* 보이는 줄 — 숨긴 칸을 빼고, 빈 줄은 걷는다. 줄 사이 자리는 원래 배치의 줄 번호로 놓는다 */
  const shownRows = rows
    .map((row, index) => ({ index, ids: row.filter(tileShown) }))
    .filter((row) => row.ids.length > 0)
  const tiles: Record<StageTileId, ReactNode> = {
    /* 세 구간: 적치(S1~S4) · 가공(S6 · S7) · 가공(S8~S10) — 단위가 하나씩이라(강판 kg · 도면 MH · 부재 개)
       그 안에서는 섞지 않고 더한다: 완료율 = 완료 양 합 ÷ 대상 양 합. S5 는 세지 않는다.
       세 구간을 감싸던 카드 바탕은 걷었다(사용자 확정) — 구간 칸 셋이 바로 선다 */
    sections: (
      <section aria-label={t('performance.stages.sectionsTitle')}>
          {/* 세 구간은 원형 진행률로 가로 한 줄에 선다(사용자 확정) — 이름 · 기준을 위에, 원 가운데에 % */}
          <dl className={cn('grid h-full min-w-0 gap-2', SECTION_COLS[shownSections.length])}>
            {shownSections.map((section) => {
              const cards = summary.stages.filter((s) => section.stages.includes(s.stage) && s.code !== null)
              const target = cards.reduce((n, s) => n + s.targetQty, 0)
              const done = cards.reduce((n, s) => n + s.doneQty, 0)
              const pct = target > 0 ? Math.round((done / target) * 1000) / 10 : null
              const delayed = cards.filter((s) => s.delayed).length
              const complete = pct !== null && pct >= 100
              return (
                <div
                  key={section.key}
                  className={cn(
                    'flex min-w-0 flex-col items-center justify-between gap-2 rounded-inshop-lg border px-2 py-3 text-center',
                    GROUP_TONE[section.tone]
                  )}
                >
                  <dt className="flex min-w-0 flex-col items-center gap-0.5">
                    <span className="whitespace-nowrap text-inshop-base font-semibold">
                      {t(`performance.stages.overallGroups.name.${section.tone}` as const)}
                      <span className="ml-1.5 text-inshop-sm font-normal tabular-nums text-foreground/72">
                        {section.stages.length > 2
                          ? t('performance.stages.groupRange', { from: section.stages[0], to: section.stages[section.stages.length - 1] })
                          : section.stages.join(' · ')}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-inshop-sm text-foreground/75">
                      {t(`performance.stages.overallGroups.basis.${section.key}` as const)}
                    </span>
                  </dt>
                  <dd role="img" aria-label={t('performance.stages.overallGroups.rate', { pct: pct ?? '—' })}>
                    <ProgressRing pct={pct} complete={complete} />
                  </dd>
                  {delayed > 0 && (
                    <dd className="whitespace-nowrap text-inshop-sm text-status-unhealthy">
                      {t('performance.stages.overallGroups.delayed', { count: delayed })}
                    </dd>
                  )}
                </div>
              )
            })}
          </dl>
      </section>
    ),
    /* 레거시 정산 · 종합 — 누르면 그 수치의 근거만 */
    legacy: (
      <Card
        interactive
        {...pressOverall('legacy')}
        aria-label={t('performance.stages.legacyTitle')}
        className="flex cursor-pointer flex-col items-center justify-center p-5 text-center"
      >
        <div className="text-inshop-lg font-semibold text-foreground/85">{t('performance.stages.legacyTitle')}</div>
        <div className="mt-1.5 flex items-baseline text-6xl font-semibold tabular-nums text-foreground">
          {summary.overall.legacyPct ?? '—'}
          {summary.overall.legacyPct !== null && <span className="text-3xl text-foreground/70">%</span>}
        </div>
        <div className="mt-1.5 text-inshop-sm text-foreground/72">{t('performance.stages.legacyNote')}</div>
      </Card>
    ),
    overall: (
      <Card
        interactive
        aria-pressed={activeStage === null}
        aria-label={t('performance.stages.overallAuto')}
        {...pressOverall('auto')}
        className={cn(
          /* 강조색 바탕 — 절점 카드와 같은 틀로 보이면 따로 선 카드라는 느낌이 안 든다(사용자 확정) */
          'flex cursor-pointer flex-col items-center justify-center border-accent/30 bg-accent/[0.07] p-5 text-center',
          activeStage === null && 'border-accent/60'
        )}
      >
        <div className="text-inshop-lg font-semibold text-foreground/85">{t('performance.stages.overallAuto')}</div>
        <div className="mt-1.5 flex items-baseline text-7xl font-semibold tabular-nums text-accent">
          {summary.overall.autoPct ?? '—'}
          {summary.overall.autoPct !== null && <span className="text-4xl text-foreground/70">%</span>}
        </div>
        <div className="mt-1.5 text-inshop-sm text-foreground/72">{t('performance.stages.overallAutoNote')}</div>
        {/* 계획% 는 종합 카드에서 뺐다(사용자 확정) — 근거 창의 계획 탭에는 남는다 */}
      </Card>
    ),
    stack: groupPanel('stack', '', 'md:grid-cols-4'),
    fab: groupPanel('fab', '', 'xl:grid-cols-6'),
  }
  const tileName: Record<StageTileId, string> = {
    sections: t('performance.stages.sectionsTitle'),
    legacy: t('performance.stages.legacyTitle'),
    overall: t('performance.stages.overallAuto'),
    stack: t('performance.stages.group.stack'),
    fab: t('performance.stages.group.fab'),
  }

  const commitRows = (next: TileRows) => {
    setRows(next)
    saveTileRows(next)
  }
  const endDrag = () => {
    setDragging(null)
    setDragOver(null)
  }
  const KEY_DIR: Record<string, 'left' | 'right' | 'up' | 'down'> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  }

  /** 줄 사이 자리 — 끄는 동안만 서고, 놓으면 끈 칸이 혼자 새 줄을 쓴다(사용자 확정). 틈 위에 겹쳐 서서 배치를 밀지 않는다 */
  const newRowSlot = (at: number, edge: 'top' | 'bottom') => {
    if (!movable || !dragging) return null
    const key = `row:${at}` as const
    const over = dragOver === key
    return (
      <div
        data-new-row={at}
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 z-20 flex h-5 items-center',
          edge === 'top' ? '-top-[15px]' : '-bottom-[15px]'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!over) setDragOver(key)
        }}
        onDragLeave={() => setDragOver((o) => (o === key ? null : o))}
        onDrop={(e) => {
          e.preventDefault()
          if (dragging) commitRows(moveToNewRow(rows, dragging, at))
          endDrag()
        }}
      >
        <div
          className={cn(
            'flex h-1.5 w-full items-center justify-center rounded-full transition-[height,background-color]',
            over ? 'h-5 bg-accent/25 outline outline-2 outline-accent' : 'bg-accent/30'
          )}
        >
          {over && <span className="text-inshop-xs font-medium text-accent">{t('performance.stages.tiles.newRow')}</span>}
        </div>
      </div>
    )
  }

  const tile = (id: StageTileId, rowSize: number) => (
    <div
      key={id}
      data-tile={id}
      className={cn(
        'relative flex min-h-0 min-w-0 flex-col [&>*:first-child]:flex-1',
        isWideTile(id) ? 'xl:col-span-12' : SMALL_SPAN[rowSize],
        dragging === id && 'opacity-50',
        dragOver === id && dragging !== id && 'rounded-inshop-xl outline outline-2 outline-offset-2 outline-accent'
      )}
      onDragOver={(e) => {
        if (!movable || !dragging) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (dragOver !== id) setDragOver(id)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver((o) => (o === id ? null : o))
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (movable && dragging && dragging !== id) commitRows(dropOnTile(rows, dragging, id))
        endDrag()
      }}
    >
      {tiles[id]}
      {/* 손잡이 — 카드를 누르면 근거 · 세부 창이 뜨므로, 끌기는 이 손잡이에서만 시작한다.
          카드 이동이 꺼져 있으면(테스트 영역 토글) 손잡이가 서지 않는다.
          키보드: 손잡이에 초점을 두고 ← → 는 줄 안에서, ↑ ↓ 는 줄 사이로 옮긴다 */}
      {movable && (
        <button
          type="button"
          draggable
          aria-label={t('performance.stages.tiles.handle', { name: tileName[id] })}
          title={t('performance.stages.tiles.handle', { name: tileName[id] })}
          className="absolute right-1.5 top-1.5 z-10 flex size-6 cursor-grab items-center justify-center rounded-inshop-sm text-foreground/45 hover:bg-foreground/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
          onDragStart={(e) => {
            setDragging(id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', id)
            const el = e.currentTarget.parentElement
            if (el) e.dataTransfer.setDragImage(el, 24, 24)
          }}
          onDragEnd={endDrag}
          onKeyDown={(e) => {
            const dir = KEY_DIR[e.key]
            if (!dir) return
            e.preventDefault()
            refocus.current = id
            commitRows(moveByKey(rows, id, dir))
          }}
        >
          <GripIcon />
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-2 xl:h-full">
      {movable && !isDefaultRows(rows) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => commitRows(defaultTileRows())}
            className="rounded-inshop-sm px-2 py-0.5 text-inshop-xs text-foreground/65 hover:bg-foreground/8 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('performance.stages.tiles.reset')}
          </button>
        </div>
      )}
      {/*
        줄마다 12열 — 작은 칸은 그 줄을 나눠 쓰고(셋이면 4열씩), 단계 판은 한 줄을 혼자 쓴다.
        카드는 내용이 숨 쉴 만큼 높게 둔다(사용자 확정: 빽빽하다) — 화면보다 길면 페이지가 스크롤된다.
        화면이 더 크면 단계 판 줄이 남는 높이를 나눠 더 키운다.
      */}
      <div ref={layoutRef} className="flex flex-col gap-2.5 xl:min-h-0 xl:flex-1">
        {shownRows.map(({ index, ids }, r) => (
          <div
            key={ids.join('|')}
            className={cn(
              'relative grid grid-cols-1 gap-2.5 xl:grid-cols-12',
              isWideTile(ids[0]) ? 'xl:flex-[1_0_auto]' : 'flex-none'
            )}
          >
            {newRowSlot(index, 'top')}
            {ids.map((id) => tile(id, ids.length))}
            {r === shownRows.length - 1 && newRowSlot(rows.length, 'bottom')}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 구간 완료율 원 — 바탕 고리 위에 완료분 호를 12시 방향부터 시계 방향으로 그리고 가운데에 % 를 적는다 */
function ProgressRing({ pct, complete }: { pct: number | null; complete: boolean }) {
  const size = 104
  const stroke = 9
  const r = (size - stroke) / 2
  const length = 2 * Math.PI * r
  const ratio = Math.min(100, Math.max(0, pct ?? 0)) / 100
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-secondary" />
        {ratio > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${length * ratio} ${length}`}
            className={complete ? 'stroke-status-healthy' : 'stroke-status-progress'}
          />
        )}
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-inshop-2xl font-semibold tabular-nums',
          pct === null ? 'text-foreground/55' : complete ? 'text-status-healthy' : 'text-foreground'
        )}
      >
        {pct ?? '—'}
        {pct !== null && <span className="text-inshop-base text-foreground/70">%</span>}
      </span>
    </div>
  )
}

/** 끌기 손잡이 — 점 여섯 개 */
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      {[3.5, 7, 10.5].flatMap((y) => [4.5, 9.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}
    </svg>
  )
}
