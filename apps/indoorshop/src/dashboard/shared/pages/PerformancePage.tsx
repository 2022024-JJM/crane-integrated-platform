import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../lib/i18n/useTranslation'
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
import { FilterBar } from '../features/performance/ui/FilterBar'
import { BlockHeaderCard } from '../features/performance/ui/BlockHeaderCard'
import { StageCards } from '../features/performance/ui/StageCards'
import { AssemblyCard } from '../features/performance/ui/AssemblyCard'
import { PaintingCard } from '../features/performance/ui/PaintingCard'
import { EventsSection } from '../features/performance/ui/EventsSection'

const REFRESH_SECONDS = 5

/** 공정 레일 — 가공·조립이 산다. 준비중·절점 없음을 화면에 명시한다(D3). */
const PROCESS_RAILS = [
  { id: 'fabrication', labelKey: 'performance.rails.fabrication', noteKey: null },
  { id: 'assembly', labelKey: 'performance.rails.assemblyActive', noteKey: null },
  { id: 'painting', labelKey: 'performance.rails.paintingActive', noteKey: null },
  { id: 'outfitting', labelKey: 'performance.rails.outfitting', noteKey: 'performance.rails.outfittingNote' },
] as const

function todayString(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * 통합실적 — 내업 공정실적 통합조회 (IPD-S01/S02/S04 골격 + D2 카드 강조).
 *
 * '/'(OT 현황판)와 형제인 전역 화면이다 — P-(C) 이층형의 ③(실적 조회) 축.
 * 데이터는 performanceApi 파사드만 경유한다(실연동 시 IPD-IF01 로 교체).
 */
export function PerformancePage() {
  const { t } = useTranslation()
  const baseDate = useMemo(todayString, [])

  const [vessels, setVessels] = useState<Vessel[]>([])
  const [vessel, setVessel] = useState('')
  const [blockOptions, setBlockOptions] = useState<BlockOption[]>([])
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([])
  const [process, setProcess] = useState<ProcessFilter>('all')

  /** 조회 버튼으로 굳힌 조건 — 필터를 만져도 결과는 다시 조회하기 전까지 유지 */
  const [query, setQuery] = useState<{ projNo: string; blocks: string[]; process: ProcessFilter } | null>(null)
  const [summaries, setSummaries] = useState<BlockSummary[]>([])
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const [stages, setStages] = useState<FabricationSummary | null>(null)
  const [assembly, setAssembly] = useState<AssemblySummary | null>(null)
  const [painting, setPainting] = useState<PaintingSummary | null>(null)
  const [activeStage, setActiveStage] = useState<FabStageId | null>(null)
  const [events, setEvents] = useState<CollectionEvent[]>([])
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
      const [nextSummaries, nextEvents] = await Promise.all([
        Promise.all(targetBlocks.map((b) => fetchBlockSummary(projNo, b, baseDate))),
        fetchCollectionEvents(projNo, targetBlocks, processFilter, baseDate),
      ])
      setSummaries(nextSummaries)
      setEvents(nextEvents)
      setActiveBlock((prev) =>
        prev && targetBlocks.includes(prev) ? prev : (targetBlocks[0] ?? null)
      )
      setRefreshedAt(new Date().toTimeString().slice(0, 8))
    },
    [baseDate]
  )

  useEffect(() => {
    if (!query || !activeBlock) {
      setStages(null)
      setAssembly(null)
      setPainting(null)
      return
    }
    let cancelled = false
    Promise.all([
      fetchFabricationStages(query.projNo, activeBlock),
      fetchAssemblySummary(query.projNo, activeBlock, baseDate),
      fetchPaintingSummary(query.projNo, activeBlock, baseDate),
    ]).then(([fab, asm, pnt]) => {
      if (cancelled) return
      setStages(fab)
      setAssembly(asm)
      setPainting(pnt)
    })
    return () => {
      cancelled = true
    }
  }, [query, activeBlock, baseDate])

  /* 자동갱신 스텁(D5) — 정의서 기본 5초. mock 재조회이므로 값은 안정적이다. */
  useEffect(() => {
    if (!autoRefresh || !query) return
    const timer = setInterval(() => {
      void runQuery(query.projNo, query.blocks, query.process)
    }, REFRESH_SECONDS * 1000)
    return () => clearInterval(timer)
  }, [autoRefresh, query, runQuery])

  const handleSearch = () => {
    if (!vessel) return
    const next = { projNo: vessel, blocks: selectedBlocks, process }
    setQuery(next)
    void runQuery(next.projNo, next.blocks, next.process)
  }

  const handleReset = () => {
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
            {t('performance.subtitle')} · {t('performance.baseDate', { date: baseDate })}
            {refreshedAt && <span className="ml-1 text-foreground/40">({refreshedAt})</span>}
          </p>
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
                active={activeBlock === summary.blockNo}
                onSelect={() => setActiveBlock(summary.blockNo)}
              />
            ))}
          </div>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SectionHeading description={t('performance.stages.snapshot')}>
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
            <div className="mb-2">
              <SectionHeading description={t('performance.asm.woBasis')}>
                {t('performance.asm.title')}
                {activeBlock && (
                  <span className="ml-1.5 text-inshop-sm font-normal text-foreground/50 tabular-nums">
                    {query.projNo}-{activeBlock}
                  </span>
                )}
              </SectionHeading>
            </div>
            {assembly && <AssemblyCard summary={assembly} />}
          </section>

          {/* 도장 스텝 절점 — 추정 명세(SE12 검증 전) 단서는 카드가 단다 (W3-2) */}
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
            {painting && <PaintingCard summary={painting} />}
          </section>

          <EventsSection events={filteredEvents} pendingProcess={pendingProcess} scopeKey={scopeKey} />
        </>
      )}

      {/* 정의서 §1 문구 상시 노출 — 참고 수치 원칙 */}
      <div className="border-t border-border pt-3 text-center text-[11px] text-foreground/45">
        {t('performance.footer')}
      </div>
    </div>
  )
}
