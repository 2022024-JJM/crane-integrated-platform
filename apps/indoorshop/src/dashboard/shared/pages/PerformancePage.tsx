import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/useTranslation'
import {
  clearSelection,
  rememberSelection,
  resolveEntrySelection,
} from '../entities/vessel'
import { cn } from '../lib/utils'
import { Button } from '../ui/atoms/Button'
import { ToggleButton } from '../ui/atoms/ToggleButton'
import { SectionHeading } from '../ui/atoms/Card'
import {
  fetchAssemblySummary,
  fetchBlocks,
  fetchBlockSummary,
  fetchCollectionEvents,
  fetchFabricationStages,
  fetchPaintingSummary,
  fetchVessels,
} from '../features/performance/api/performanceApi'
import type {
  AssemblySummary,
  BlockOption,
  BlockSummary,
  CollectionEvent,
  FabStageId,
  FabricationSummary,
  PaintingSummary,
  ProcessFilter,
  Vessel,
} from '../features/performance/model/types'
import {
  DATE_PARAMS,
  dateParamsOf,
  defaultSelection,
  parseDateParams,
  todayString,
  windowOf,
  type BaseDateSelection,
} from '../features/performance/lib/baseDate'
import { judgedTrendOf } from '../features/performance/lib/judgedTrend'
import { BaseDateControl } from '../features/performance/ui/BaseDateControl'
import { JudgedTrendTile } from '../features/performance/ui/JudgedTrendTile'
import { FilterBar } from '../features/performance/ui/FilterBar'
import { BlockHeaderCard } from '../features/performance/ui/BlockHeaderCard'
import { StageCards } from '../features/performance/ui/StageCards'
import { AssemblyCard } from '../features/performance/ui/AssemblyCard'
import { PaintingCard } from '../features/performance/ui/PaintingCard'
import { OutfittingCard } from '../features/performance/ui/OutfittingCard'
import {
  fetchOutfittingRows,
  overallOf,
  rowOfBlock,
  rowsOfQuery,
  type OutfittingRow,
} from '../features/performance/api/outfittingPerformance'
import { EventsSection } from '../features/performance/ui/EventsSection'
import { CardSkeleton, EmptyState, ErrorState } from '../ui/states'
import { nowDate } from '../lib/now'

const REFRESH_SECONDS = 5

/** 공정 레일 — 가공·조립이 산다. 준비중·절점 없음을 화면에 명시한다(D3). */
const PROCESS_RAILS = [
  { id: 'fabrication', labelKey: 'performance.rails.fabrication', noteKey: null },
  { id: 'assembly', labelKey: 'performance.rails.assemblyActive', noteKey: null },
  { id: 'painting', labelKey: 'performance.rails.paintingActive', noteKey: null },
  /* 의장도 이제 카드가 선다 — '절점 없음' 은 각주가 아니라 카드가 스스로 말한다(W7-11) */
  { id: 'outfitting', labelKey: 'performance.rails.outfitting', noteKey: null },
] as const

/**
 * 통합실적 — 내업 공정실적 통합조회 (IPD-S01/S02/S04 골격 + D2 카드 강조).
 *
 * '/'(OT 현황판)와 형제인 전역 화면이다 — P-(C) 이층형의 ③(실적 조회) 축.
 * 데이터는 performanceApi 파사드만 경유한다(실연동 시 IPD-IF01 로 교체).
 *
 * **진입 선택 승계** — `?vessel=7004&block=222,310` 딥링크가 있으면 그 조건으로,
 * 없으면 직전에 조회한 조건으로 열고 곧바로 조회까지 끝낸다. 대시보드에서 블록을 보다가
 * 넘어와 놓고 호선·블록을 처음부터 다시 고르는 일을 없앤다(`entities/vessel` 계약).
 * 사용자가 화면에서 '초기화'를 누르면 그 기억도 함께 지운다 — 다음에 들어올 때
 * 지웠던 조건이 되살아나면 초기화가 거짓말이 된다.
 *
 * **ASSY 포커스** — `?assy=7004-222-M02`(여럿이면 콤마)로 들어오면 그 ASSY 가 든 블록을
 * 조회하고 조립 트리에서 그 줄을 강조·스크롤한다(W6-2). 지도 ASSY 마커가 이 링크로
 * 나가므로, 지도에서 본 덩이를 실적 화면에서 그대로 이어 본다.
 */
export function PerformancePage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  /* 오늘은 마운트 때 한 번 굳힌다 — 매 렌더 `new Date()` 를 부르면 기준일 비교가
     렌더마다 새 값이 되어 조회 이펙트가 계속 다시 돈다 */
  const today = useMemo(() => todayString(), [])
  /**
   * 시간축(W7-2) — 기준일과 조회 창. `?date=`·`?span=` 딥링크로도 들어온다.
   * 이 값 하나가 카드·그리드·추이의 **집계 기준**으로 함께 흐른다.
   */
  const [dateSelection, setDateSelection] = useState<BaseDateSelection>(() =>
    parseDateParams(searchParams, todayString())
  )
  const baseDate = dateSelection.date
  const dateWindow = useMemo(() => windowOf(dateSelection), [dateSelection])
  /* 진입 시점에 한 번만 읽는다 — 이후 필터 조작이 URL 에 되밀려 조회를 되돌리지 않도록 */
  const entry = useRef<ReturnType<typeof resolveEntrySelection>>(undefined)
  if (entry.current === undefined) entry.current = resolveEntrySelection(searchParams)

  const [vessels, setVessels] = useState<Vessel[]>([])
  const [vessel, setVessel] = useState(entry.current?.projNo ?? '')
  const [blockOptions, setBlockOptions] = useState<BlockOption[]>([])
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>(entry.current?.blocks ?? [])
  const [process, setProcess] = useState<ProcessFilter>('all')

  /** 조회 버튼으로 굳힌 조건 — 필터를 만져도 결과는 다시 조회하기 전까지 유지 */
  const [query, setQuery] = useState<{ projNo: string; blocks: string[]; process: ProcessFilter } | null>(
    entry.current ? { projNo: entry.current.projNo, blocks: entry.current.blocks, process: 'all' } : null
  )
  const [summaries, setSummaries] = useState<BlockSummary[]>([])
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [stages, setStages] = useState<FabricationSummary | null>(null)
  const [assembly, setAssembly] = useState<AssemblySummary | null>(null)
  const [painting, setPainting] = useState<PaintingSummary | null>(null)
  const [activeStage, setActiveStage] = useState<FabStageId | null>(null)
  /** 진입 링크가 지목한 ASSY — 조립 카드가 강조·스크롤한다. 블록을 바꾸면 풀린다 */
  const [focusAssys, setFocusAssys] = useState<string[]>(entry.current?.assys ?? [])
  /*
   * 절점 상세(가공·조립·도장)의 로딩/실패 채널.
   *
   * 지금까지는 `painting && <PaintingCard/>` 처럼 **값이 있으면 그리고 없으면 아무것도
   * 안 그리는** 자리였다. 그러면 불러오는 중인지, 계획이 없는 블록인지, 못 불러온
   * 것인지가 모두 '빈 화면' 하나로 뭉개진다 — 셋을 갈라 말한다(shared/ui/states 계약:
   * 실패 > 로딩 > 빈 상태).
   */
  const [detail, setDetail] = useState<{ loading: boolean; error: Error | null }>({
    loading: false,
    error: null,
  })
  /** 마지막으로 상세를 받아 낸 시각 — 실패 화면이 "그럼 이 값은 언제 것인가"를 답한다 */
  const [detailLoadedAt, setDetailLoadedAt] = useState<string | null>(null)
  /** 재시도 — 같은 조건으로 상세만 다시 건다(화면 새로고침이 아니라) */
  const [detailRetry, setDetailRetry] = useState(0)
  const [events, setEvents] = useState<CollectionEvent[]>([])
  /* 의장 레일 — 절점이 없어 블록 줄이 곧 카드다. 값은 의장 공장 화면과 같은 원천이다 */
  const [outfittingRows, setOutfittingRows] = useState<OutfittingRow[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  useEffect(() => {
    fetchVessels().then(setVessels)
  }, [])

  useEffect(() => {
    if (!vessel) {
      setBlockOptions([])
      setSelectedBlocks([])
      return
    }
    fetchBlocks(vessel).then((blocks) => {
      setBlockOptions(blocks)
      setSelectedBlocks((prev) => prev.filter((b) => blocks.some((o) => o.blockNo === b)))
    })
  }, [vessel])

  const runQuery = useCallback(
    async (projNo: string, blocks: string[], processFilter: ProcessFilter) => {
      const targetBlocks = blocks.length > 0 ? blocks : (await fetchBlocks(projNo)).map((b) => b.blockNo)
      const [nextSummaries, nextEvents, nextOutfitting] = await Promise.all([
        Promise.all(targetBlocks.map((b) => fetchBlockSummary(projNo, b, baseDate))),
        /* 창을 함께 넘긴다 — 기준일 이후 행은 seam 에서 잘린다(그날 화면에 없던 일) */
        fetchCollectionEvents(projNo, targetBlocks, processFilter, baseDate, dateWindow),
        /* 의장은 레지스트리를 거쳐 읽는다 — shared 가 공정 모듈을 부를 수 없다 */
        fetchOutfittingRows(baseDate),
      ])
      setSummaries(nextSummaries)
      setEvents(nextEvents)
      setOutfittingRows(rowsOfQuery(nextOutfitting, projNo, targetBlocks))
      setActiveBlock((prev) =>
        prev && targetBlocks.includes(prev) ? prev : (targetBlocks[0] ?? null)
      )
      setRefreshedAt(nowDate().toTimeString().slice(0, 8))
    },
    [baseDate, dateWindow]
  )

  /* 승계받은 조건으로 곧바로 조회까지 — 조회 버튼을 다시 누르게 하지 않는다.
   * 딥링크로 들어온 조건도 남긴다 — 여기서 공정 화면에 다녀와 사이드바로 돌아왔을 때
   * 조회 버튼을 눌렀을 때와 다르게 동작하면 승계가 반쪽이 된다.
   *
   * ⚠️ **딱 한 번만 돈다.** `runQuery` 는 기준일이 바뀌면 새 함수가 되는데, 이 이펙트가
   * 그때마다 다시 돌면 **진입 당시 조건**으로 조회를 한 번 더 쏜다 — 아래 기준일 이펙트가
   * 곧바로 현재 조건으로 덮어쓰기는 하지만, 두 조회의 도착 순서에 결과가 걸리는 모양을
   * 남길 이유가 없다. 승계는 진입 때 한 번이고, 이후 재조회는 아래가 **현재 조건 그대로**
   * 맡는다. */
  const entryRan = useRef(false)
  useEffect(() => {
    const initial = entry.current
    if (!initial || entryRan.current) return
    entryRan.current = true
    rememberSelection(initial)
    void runQuery(initial.projNo, initial.blocks, 'all')
  }, [runQuery])

  /* 기준일·조회 창이 바뀌면 **지금 조건 그대로** 다시 조회한다 — 시간축은 조회 조건이지
   * 다른 화면이 아니므로, 날짜를 옮겼다고 사용자가 조회 버튼을 다시 누를 이유가 없다. */
  const dateRef = useRef(baseDate)
  const spanRef = useRef(dateSelection.spanDays)
  useEffect(() => {
    if (dateRef.current === baseDate && spanRef.current === dateSelection.spanDays) return
    dateRef.current = baseDate
    spanRef.current = dateSelection.spanDays
    if (!query) return
    void runQuery(query.projNo, query.blocks, query.process)
  }, [baseDate, dateSelection.spanDays, query, runQuery])

  useEffect(() => {
    if (!query || !activeBlock) {
      setStages(null)
      setAssembly(null)
      setPainting(null)
      setDetail({ loading: false, error: null })
      return
    }
    let cancelled = false
    setDetail({ loading: true, error: null })
    Promise.all([
      fetchFabricationStages(query.projNo, activeBlock, baseDate),
      fetchAssemblySummary(query.projNo, activeBlock, baseDate),
      fetchPaintingSummary(query.projNo, activeBlock, baseDate),
    ]).then(
      ([fab, asm, pnt]) => {
        if (cancelled) return
        setStages(fab)
        setAssembly(asm)
        setPainting(pnt)
        setDetail({ loading: false, error: null })
        setDetailLoadedAt(nowDate().toISOString())
      },
      (error: unknown) => {
        if (cancelled) return
        /* 실패하면 낡은 값을 계속 보여주지 않는다 — 오류는 오류로 낸다 */
        setPainting(null)
        setDetail({
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    )
    return () => {
      cancelled = true
    }
  }, [query, activeBlock, baseDate, detailRetry])

  /* 자동갱신 스텁(D5) — 정의서 기본 5초. mock 재조회이므로 값은 안정적이다. */
  useEffect(() => {
    if (!autoRefresh || !query) return
    const timer = setInterval(() => {
      void runQuery(query.projNo, query.blocks, query.process)
    }, REFRESH_SECONDS * 1000)
    return () => clearInterval(timer)
  }, [autoRefresh, query, runQuery])

  /**
   * 기준일 변경 — 상태와 URL 을 함께 옮긴다.
   *
   * URL 에 되비추는 이유는 딥링크 문법의 일관성이다: `?vessel=`·`?block=` 으로 지금 보는
   * 조건을 남에게 보낼 수 있는데 기준일만 못 실으면, 받은 사람은 다른 날의 화면을 본다.
   * 기본값(오늘 하루)이면 파라미터를 **지운다** — 오늘 날짜가 박힌 링크는 내일 거짓이 된다.
   */
  const handleDateChange = (next: BaseDateSelection) => {
    setDateSelection(next)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.delete(DATE_PARAMS.date)
        params.delete(DATE_PARAMS.span)
        for (const [key, value] of Object.entries(dateParamsOf(next, today))) {
          params.set(key, value)
        }
        return params
      },
      { replace: true }
    )
  }

  const handleSearch = () => {
    if (!vessel) return
    const next = { projNo: vessel, blocks: selectedBlocks, process }
    setQuery(next)
    /* 사용자가 조건을 새로 굳혔다 — 링크가 지목했던 ASSY 포커스는 여기서 놓는다 */
    setFocusAssys([])
    /* 다음에 이 화면으로 돌아올 때(사이드바 진입 등) 되살릴 조건 — 공정 필터는 싣지 않는다.
     * 승계 계약은 '무엇을 보고 있었나'(호선·블록)이지 조회 옵션까지가 아니다. */
    rememberSelection({ projNo: next.projNo, blocks: next.blocks })
    void runQuery(next.projNo, next.blocks, next.process)
  }

  const handleReset = () => {
    clearSelection()
    /* 시간축도 함께 초기화한다 — '초기화' 를 눌렀는데 지난주를 보고 있으면 거짓말이다 */
    handleDateChange(defaultSelection(today))
    setVessel('')
    setSelectedBlocks([])
    setProcess('all')
    setQuery(null)
    setSummaries([])
    setEvents([])
    setStages(null)
    setAssembly(null)
    setActiveBlock(null)
    setActiveStage(null)
    setFocusAssys([])
  }

  /* 내보내기 스텁(D5) — 현재 그리드 행을 CSV 로. ⚠️ 대상 범위·형식은 정의서 미확정 */
  const handleExport = () => {
    const header = ['block', 'stage', 'mgmtNoType', 'mgmtNo', 'occurred', 'completed', 'status', 'sources']
    const lines = events.map((e) =>
      [
        e.blockNo,
        e.stage,
        e.mgmtNoType,
        e.mgmtNo,
        e.occurred ? `${e.occurred.date}${e.occurred.time ? ` ${e.occurred.time}` : ''}` : '',
        e.completed ? `${e.completed.date}${e.completed.time ? ` ${e.completed.time}` : ''}` : '',
        e.status,
        e.sources,
      ].join(',')
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `performance_${baseDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const filteredEvents = activeStage ? events.filter((e) => e.stage === activeStage) : events
  /* 추이는 **단계 필터를 타지 않는다** — 그 필터는 그리드에서 한 단계만 보려는 것이지
     "조립 수집이 언제 들어왔나"라는 질문을 바꾸는 것이 아니다 */
  const judgedTrend = useMemo(() => judgedTrendOf(events, dateWindow), [events, dateWindow])
  const pendingProcess =
    query !== null &&
    query.process !== 'all' &&
    query.process !== 'fabrication' &&
    query.process !== 'assembly' &&
    query.process !== 'painting'
  const scopeKey =
    query?.process === 'fabrication'
      ? ('performance.grid.scope' as const)
      : query?.process === 'assembly'
        ? ('performance.grid.scopeAssembly' as const)
        : query?.process === 'painting'
          ? ('performance.grid.scopePainting' as const)
          : ('performance.grid.scopeAll' as const)

  return (
    <div className="dashboard-typography flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-inshop-lg font-semibold">{t('performance.title')}</h1>
          <p className="mt-0.5 text-inshop-xs text-foreground/55">
            {t('performance.subtitle')}
            {refreshedAt && <span className="ml-1 text-foreground/40">({refreshedAt})</span>}
          </p>
          {/* 기준일은 부제에 적어 두는 값이 아니라 **조작하는 조건**이다 — 컨트롤이 지금
              고른 날을 스스로 말하므로 위에서 같은 말을 되풀이하지 않는다 */}
          <BaseDateControl
            selection={dateSelection}
            onChange={handleDateChange}
            today={today}
            className="mt-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-status-degraded/10 px-2 py-1 text-[11px] text-status-degraded">
            {t('performance.mockNote')}
          </span>
          <ToggleButton pressed={autoRefresh} onPressedChange={setAutoRefresh}>
            {t('performance.autoRefresh', { seconds: REFRESH_SECONDS })}
          </ToggleButton>
          <Button size="sm" onClick={handleExport} disabled={events.length === 0}>
            {t('performance.exportCsv')}
          </Button>
        </div>
      </div>

      <FilterBar
        vessels={vessels}
        vessel={vessel}
        onVesselChange={setVessel}
        blockOptions={blockOptions}
        selectedBlocks={selectedBlocks}
        onToggleBlock={(blockNo) =>
          setSelectedBlocks((prev) =>
            prev.includes(blockNo) ? prev.filter((b) => b !== blockNo) : [...prev, blockNo]
          )
        }
        process={process}
        onProcessChange={setProcess}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {query === null ? (
        <div className="rounded-inshop-lg border border-dashed border-border px-4 py-16 text-center text-inshop-sm text-foreground/55">
          {t('performance.filter.selectVesselFirst')}
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {summaries.map((summary) => (
              <BlockHeaderCard
                key={summary.blockNo}
                summary={summary}
                /* 의장 줄 — 그 블록이 의장 재공일 때만 채워진다 */
                outfitting={rowOfBlock(outfittingRows, summary.projNo, summary.blockNo)}
                active={activeBlock === summary.blockNo}
                onSelect={() => {
                  setActiveBlock(summary.blockNo)
                  /* 다른 블록으로 넘어가면 지목 강조는 그 블록의 것이 아니다 */
                  if (summary.blockNo !== activeBlock) setFocusAssys([])
                }}
              />
            ))}
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              {/* 절점이 다섯인 이유를 제목 옆에서 한 번만 말한다 — 실제 가공 흐름은 아홉
                  단계이고, 그중 원천에 완료 근거가 있는 다섯만 절점으로 선다(W7-6D).
                  안내를 새로 세우지 않고 기존 설명 줄에 실어 총량을 늘리지 않는다. */}
              <SectionHeading
                description={`${t('performance.stages.snapshot')} · ${t('performance.stages.nodeNote')}`}
              >
                {t('performance.stages.title')}
                {activeBlock && (
                  <span className="ml-1.5 text-inshop-sm font-normal text-foreground/50 tabular-nums">
                    {query.projNo}-{activeBlock}
                  </span>
                )}
              </SectionHeading>
              {/* 후속 공정 레일 — 준비중/절점 없음을 자리로 명시 */}
              <div className="flex items-center gap-1.5">
                {PROCESS_RAILS.map((rail) => (
                  <span
                    key={rail.id}
                    title={rail.noteKey ? t(rail.noteKey) : undefined}
                    className={cn(
                      'rounded-inshop-md border px-2 py-1 text-[11px]',
                      rail.noteKey === null
                        ? 'border-accent/50 bg-accent/10 font-medium text-accent'
                        : 'border-border text-foreground/40'
                    )}
                  >
                    {t(rail.labelKey)}
                  </span>
                ))}
              </div>
            </div>
            {stages && (
              <StageCards
                summary={stages}
                activeStage={activeStage}
                onStageClick={(stage) =>
                  setActiveStage((prev) => (prev === stage ? null : stage))
                }
              />
            )}
          </section>

          {/* 조립 절점 — W/O 완료 기준 (완성도는 OT 가동 후 자리 문구만) */}
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SectionHeading description={t('performance.asm.woBasis')}>
                {t('performance.asm.title')}
                {activeBlock && (
                  <span className="ml-1.5 text-inshop-sm font-normal text-foreground/50 tabular-nums">
                    {query.projNo}-{activeBlock}
                  </span>
                )}
              </SectionHeading>
              {/* 일자별 인식 추이 — 누적 수치가 지우는 '언제'를 되살린다 */}
              <JudgedTrendTile trend={judgedTrend} />
            </div>
            {assembly && <AssemblyCard summary={assembly} focusAssys={focusAssys} />}
          </section>

          {/* 도장 스텝 절점 — 스텝 축 유도 근거 단서는 카드가 단다 (W3-2 · W5-8) */}
          <section>
            <div className="mb-2">
              <SectionHeading description={t('performance.pnt.basis')}>
                {t('performance.pnt.title')}
                {activeBlock && (
                  <span className="ml-1.5 text-inshop-sm font-normal text-foreground/50 tabular-nums">
                    {query.projNo}-{activeBlock}
                  </span>
                )}
              </SectionHeading>
            </div>
            {/* 실패 > 로딩 > 빈 상태 — 셋 중 무엇인지 화면이 먼저 말한다 */}
            {detail.error ? (
              <ErrorState
                error={detail.error}
                title={t('performance.pnt.loadFailed')}
                onRetry={() => setDetailRetry((count) => count + 1)}
                lastSuccessAt={detailLoadedAt}
              />
            ) : detail.loading ? (
              <CardSkeleton label={t('states.loading')} rows={4} />
            ) : painting ? (
              <PaintingCard summary={painting} />
            ) : (
              <EmptyState
                reason="none"
                title={t('performance.pnt.noPlan')}
                description={t('performance.pnt.noPlanNote')}
              />
            )}
          </section>

          {/* 의장 절점 — **없다.** 절점을 지어내지 않고 블록 판별 %만 세운다 (W7-11) */}
          <section>
            <div className="mb-2">
              <SectionHeading description={t('performance.ofit.basisNote')}>
                {t('performance.ofit.title')}
                {activeBlock && (
                  <span className="ml-1.5 text-inshop-sm font-normal text-foreground/50 tabular-nums">
                    {query.projNo}-{activeBlock}
                  </span>
                )}
              </SectionHeading>
            </div>
            <OutfittingCard
              rows={outfittingRows}
              overall={overallOf(outfittingRows)}
              activeBlock={activeBlock}
            />
          </section>

          <EventsSection
            events={filteredEvents}
            pendingProcess={pendingProcess}
            scopeKey={scopeKey}
            window={dateWindow}
          />
        </>
      )}

      {/* 정의서 §1 문구 상시 노출 — 참고 수치 원칙 */}
      <div className="border-t border-border pt-3 text-center text-[11px] text-foreground/45">
        {t('performance.footer')}
      </div>
    </div>
  )
}
