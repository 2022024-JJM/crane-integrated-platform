import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useBaseDate, useBaseDateWriter } from '../../../shared/lib/useBaseDate'
import { BaseDateControl } from '../../../shared/features/performance/ui/BaseDateControl'
import { useBlockQuery } from '../../../shared/features/performance/lib/useBlockQuery'
import { CardSkeleton, EmptyState } from '../../../shared/ui/states'
import {
  fetchAssemblySummary,
  fetchBlocks,
  fetchCollectionEvents,
} from '../../../shared/features/performance/api/performanceApi'
import type { AssemblySummary, CollectionEvent } from '../../../shared/features/performance/model/types'
import { judgedTrendOf } from '../../../shared/features/performance/lib/judgedTrend'
import { FilterBar } from '../../../shared/features/performance/ui/FilterBar'
import { BlockTabs } from '../../../shared/features/performance/ui/BlockTabs'
import { AssemblyCard } from '../../../shared/features/performance/ui/AssemblyCard'
import { JudgedTrendTile } from '../../../shared/features/performance/ui/JudgedTrendTile'
import { EventsSection } from '../../../shared/features/performance/ui/EventsSection'

/**
 * 조립 화면의 [실적] 갈래 — 통합실적의 조회 조건 바(호선 · 블록 · 조회 · 초기화)를 그대로 쓰되
 * **조립 공정만** 찾는다(사용자 확정). 공정 세그먼트는 감추고, 결과도 조립 절점(W/O 완료)과
 * 조립 수집 이벤트만 낸다 — 가공·의장·도장 카드는 통합실적 화면의 몫이다.
 *
 * 기준일은 앱 공통 축(`?date=`·`?span=`)을 따른다.
 *
 * 조회 조건(호선 · 블록)은 **통합실적과 한 벌**이다(사용자 확정) — 어느 쪽에서 조회하든 같은
 * 자리(`rememberSelection`)에 남기고, 들어올 때 같은 규칙(`resolveEntrySelection`: 주소 →
 * 직전 선택)으로 되살린다. 초기화도 양쪽을 함께 지운다.
 */
export function AssemblyPerformanceView() {
  const { t } = useTranslation()
  const { baseDate, window: dateWindow, selection: dateSelection, today } = useBaseDate()
  /* 기준일 컨트롤 — 통합실적과 같은 주소 축을 고친다(사용자 확정: 공정 [실적] 에도 날짜 조건) */
  const setDateSelection = useBaseDateWriter()

  const { zone, vessels, vessel, blockOptions, query, activeBlock, setActiveBlock, onVesselChange, onBlocksApply, onBlockClose, onReset } =
    useBlockQuery('assembly')
  const [assembly, setAssembly] = useState<AssemblySummary | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [events, setEvents] = useState<CollectionEvent[]>([])

  /* 조건 · 기준일이 바뀌면 조립 이벤트를 다시 받는다 — 고른 블록 전부를 한 번에 받아 두고 탭으로 거른다 */
  useEffect(() => {
    if (!query) return
    let cancelled = false
    void (async () => {
      const blocks = query.blocks.length > 0 ? query.blocks : (await fetchBlocks(query.projNo)).map((b) => b.blockNo)
      const nextEvents = await fetchCollectionEvents(query.projNo, blocks, 'assembly', baseDate, dateWindow)
      if (!cancelled) setEvents(nextEvents)
    })()
    return () => {
      cancelled = true
    }
  }, [query, baseDate, dateWindow])

  /* 지금 탭의 블록 것만 — 탭을 누르면 그 블록의 내용만 선다(사용자 확정) */
  const blockEvents = useMemo(
    () => (activeBlock ? events.filter((e) => e.blockNo === activeBlock) : events),
    [events, activeBlock]
  )

  /* 고른 블록의 조립 절점 */
  useEffect(() => {
    if (!query || !activeBlock) {
      setAssembly(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    fetchAssemblySummary(query.projNo, activeBlock, baseDate).then(
      (summary) => {
        if (cancelled) return
        setAssembly(summary)
        setLoadingDetail(false)
      },
      () => {
        if (cancelled) return
        setAssembly(null)
        setLoadingDetail(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [query, activeBlock, baseDate])

  const judgedTrend = useMemo(() => judgedTrendOf(blockEvents, dateWindow), [blockEvents, dateWindow])

  const handleReset = () => {
    onReset()
    setAssembly(null)
    setEvents([])
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* 화면 머리 — 통합실적과 같은 틀(사용자 확정): 제목 · 설명 · 기준일. 블록 탭 밖 맨 위에 선다 */}
      <div>
        <h1 className="text-inshop-lg font-semibold">{t('performance.asm.title')}</h1>
        <p className="mt-0.5 text-inshop-xs text-foreground/55">{t('performance.asm.woBasis')}</p>
        <BaseDateControl selection={dateSelection} onChange={setDateSelection} today={today} className="mt-1.5" />
      </div>
      <FilterBar
        vessels={vessels}
        vessel={vessel}
        onVesselChange={onVesselChange}
        blockOptions={blockOptions}
        selectedBlocks={query?.blocks ?? []}
        onBlocksApply={onBlocksApply}
        process="assembly"
        onProcessChange={() => undefined}
        onReset={handleReset}
        hideProcess
      />

      {query === null ? (
        <div className="rounded-inshop-lg border border-dashed border-border px-4 py-16 text-center text-inshop-sm text-foreground/55">
          {vessel ? t('performance.filter.selectBlockFirst') : t('performance.filter.selectVesselFirst')}
        </div>
      ) : (
        <>
          {/* 고른 블록들의 탭 — 화면은 지금 탭의 블록 하나만 그린다 */}
          <BlockTabs
            projNo={query.projNo}
            blocks={query.blocks}
            active={activeBlock}
            onSelect={setActiveBlock}
            onClose={onBlockClose}
            favoriteZone={zone}
          >

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
              <JudgedTrendTile trend={judgedTrend} />
            </div>
            {loadingDetail && !assembly ? (
              <CardSkeleton label={t('states.loading')} rows={4} />
            ) : assembly ? (
              <AssemblyCard summary={assembly} />
            ) : (
              <EmptyState />
            )}
          </section>

          <EventsSection
            events={blockEvents}
            pendingProcess={false}
            scopeKey="performance.grid.scopeAssembly"
            window={dateWindow}
          />
          </BlockTabs>
        </>
      )}
    </div>
  )
}
