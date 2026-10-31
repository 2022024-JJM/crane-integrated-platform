import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useBaseDate, useBaseDateWriter } from '../../../shared/lib/useBaseDate'
import { BaseDateControl } from '../../../shared/features/performance/ui/BaseDateControl'
import { useBlockQuery } from '../../../shared/features/performance/lib/useBlockQuery'
import { useFillViewport } from '../../../shared/features/performance/lib/useFillViewport'
import { FontScaleContext } from '../../../shared/lib/font-scale/context'
import { CardSkeleton } from '../../../shared/ui/states'
import { fetchBlocks } from '../../../shared/features/performance/api/performanceApi'
import {
  fetchFabEventDetail,
  fetchFabGridEvents,
  fetchFabOverallBasis,
  fetchFabStageDetailBy,
  fetchFabStageDetailCounts,
  fetchFabStageSummaryBy,
} from '../../../shared/features/performance/api/fabOtApi'
import type { CollectionEvent, FabStageId } from '../../../shared/features/performance/model/types'
import type { FabRateBasis, FabStageSummary } from '../../../shared/features/performance/model/fabStages'
import { FilterBar } from '../../../shared/features/performance/ui/FilterBar'
import { BlockTabs } from '../../../shared/features/performance/ui/BlockTabs'
import { StageCards } from '../../../shared/features/performance/ui/StageCards'
import { StageDetailDialog } from '../../../shared/features/performance/ui/StageDetailDialog'
import { OverallBasisDialog } from '../../../shared/features/performance/ui/OverallBasisDialog'

/**
 * 가공 화면의 '통합실적' 탭 — 통합실적의 조회 조건 바(호선 · 블록 · 초기화)를 그대로 쓰되
 * **가공 공정만** 찾는다(사용자 확정, 조립·의장·도장 [실적] 과 같은 틀). 공정 세그먼트는 감추고,
 * 결과도 통합실적의 가공권역 절점 카드(가공 화면 절점 정의 9개)와 가공 수집 이벤트만 낸다.
 *
 * 데이터는 **가공 OT API v1.0**(IPCS-312 명세 초안)의 모양을 따른다 — 절점 카드는 C2, 수집 현황은
 * B4, 하위 데이터는 B2(도면) · B5(부재). 서버가 아직 없어 그 모양의 모의 서버(`fabOtMock`)를 읽는다.
 * 그래서 통합실적(부재 중량 목업)과 같은 블록이라도 수가 다를 수 있다.
 *
 * 기준일은 앱 공통 축(`?date=`·`?span=`)을 따른다.
 *
 * 조회 조건(호선 · 블록)은 **통합실적과 한 벌**이다(사용자 확정) — 어느 쪽에서 조회하든 같은
 * 자리(`rememberSelection`)에 남기고, 들어올 때 같은 규칙(`resolveEntrySelection`: 주소 →
 * 직전 선택)으로 되살린다. 초기화도 양쪽을 함께 지운다.
 */

export function FabricationPerformanceView() {
  const { t } = useTranslation()
  const { baseDate, window: dateWindow, selection: dateSelection, today } = useBaseDate()
  /* 기준일 컨트롤 — 통합실적과 같은 주소 축을 고친다(사용자 확정: 공정 [실적] 에도 날짜 조건) */
  const setDateSelection = useBaseDateWriter()

  const { zone, vessels, vessel, blockOptions, query, activeBlock, setActiveBlock, onVesselChange, onBlocksApply, onBlockClose, onReset } =
    useBlockQuery('fabrication')
  const [stages, setStages] = useState<FabStageSummary | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [events, setEvents] = useState<CollectionEvent[]>([])
  /**
   * 세부 창에 펼친 절점 — 절점 카드를 누르면 뜬다. 그 절점의 수집 현황도 이 창의 탭에서 본다
   * (사용자 확정: 수집 현황은 절점 아래에 펼쳐 두지 않는다).
   */
  const [detailStage, setDetailStage] = useState<FabStageId | null>(null)
  /** 종합 근거 창 — 종합 카드를 누르면 세 수치의 산식과 근거 줄을 띄운다(사용자 확정) */
  /** 종합 근거 창 — 레거시 정산 카드는 레거시 정산만, 종합 카드는 종합만 펼친다(사용자 확정) */
  const [basisOpen, setBasisOpen] = useState<'auto' | 'legacy' | null>(null)
  const selectStage = (stage: FabStageId | null) => {
    if (stage) setDetailStage(stage)
    else setBasisOpen('auto')
  }
  /* 실적률 기준 — 전체 대비(대상 전체). 시험 옵션(테스트 영역)을 걷어 기본값으로 고정했다 */
  const rateBasis: FabRateBasis = 'all'
  const loadOverallBasis = useCallback(
    () => fetchFabOverallBasis(query!.projNo, activeBlock!, baseDate, rateBasis),
    [query, activeBlock, baseDate, rateBasis]
  )
  const loadStageDetail = useCallback(
    (stage: FabStageId) => fetchFabStageDetailBy(query!.projNo, activeBlock!, stage, baseDate, rateBasis),
    [query, activeBlock, baseDate, rateBasis]
  )

  /* 조건 · 기준일이 바뀌면 가공 이벤트를 다시 받는다 — 고른 블록 전부를 한 번에 받아 두고 탭으로 거른다 */
  useEffect(() => {
    if (!query) return
    let cancelled = false
    void (async () => {
      const blocks = query.blocks.length > 0 ? query.blocks : (await fetchBlocks(query.projNo)).map((b) => b.blockNo)
      const nextEvents = await fetchFabGridEvents(query.projNo, blocks, dateWindow)
      if (!cancelled) setEvents(nextEvents)
    })()
    return () => {
      cancelled = true
    }
  }, [query, dateWindow])

  /* 지금 탭의 블록 것만 — 탭을 누르면 그 블록의 내용만 선다(사용자 확정) */
  const blockEvents = useMemo(
    () => (activeBlock ? events.filter((e) => e.blockNo === activeBlock) : events),
    [events, activeBlock]
  )

  /* 고른 블록의 가공 절점 */
  useEffect(() => {
    if (!query || !activeBlock) {
      setStages(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    fetchFabStageSummaryBy(query.projNo, activeBlock, baseDate, rateBasis).then(
      (summary) => {
        if (cancelled) return
        setStages(summary)
        setLoadingDetail(false)
      },
      () => {
        if (cancelled) return
        setStages(null)
        setLoadingDetail(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [query, activeBlock, baseDate, rateBasis])

  /* 카드에 적을 창의 줄 수 — 세부 데이터는 블록 · 기준일마다 받고, 수집 현황은 받아 둔 행을 절점별로 센다 */
  const [detailCounts, setDetailCounts] = useState<Partial<Record<FabStageId, number>>>({})
  useEffect(() => {
    if (!query || !activeBlock) return
    let cancelled = false
    setDetailCounts({})
    void fetchFabStageDetailCounts(query.projNo, activeBlock, baseDate).then((c) => {
      if (!cancelled) setDetailCounts(c)
    })
    return () => {
      cancelled = true
    }
  }, [query, activeBlock, baseDate])
  const windowCounts = useMemo(() => {
    const out: Partial<Record<FabStageId, { detail: number; events: number }>> = {}
    for (const [stage, detail] of Object.entries(detailCounts) as [FabStageId, number][]) {
      out[stage] = { detail, events: blockEvents.filter((e) => e.stage === stage).length }
    }
    return out
  }, [detailCounts, blockEvents])

  /* 절점 카드 묶음이 남는 세로를 다 쓴다 — 화면이 스크롤되지 않는 선에서 카드를 키운다(사용자 확정).
     넓은 화면(xl, 1280px 이상)만. 카드 내용이 들어갈 자리도 없으면 줄이지 않고 화면이 스크롤된다 */
  const cardsRef = useRef<HTMLDivElement>(null)
  /* 화면에 딱 맞춘다 — 카드가 남는 높이보다 길면 카드 영역 안에서 스크롤한다(화면은 스크롤되지 않는다).
     브라우저를 크게 확대해도(폭이 셸 고정 배치 선 md 이상인 동안) 같다. 남는 높이가 너무 작으면(200px 미만)
     줄이지 않고 화면이 스크롤된다. 글자 크기 설정이 바뀌면 카드 높이가 달라지므로 다시 잰다 */
  /* provider 밖(테스트)에서는 없다 — 그때는 다시 잴 일도 없다 */
  const fontScale = useContext(FontScaleContext)?.fontScale
  useFillViewport(cardsRef, { minWidth: 768, shrinkTo: 200 }, [stages, activeBlock, fontScale])

  const handleReset = () => {
    onReset()
    setStages(null)
    setDetailStage(null)
    setBasisOpen(null)
    setEvents([])
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* 화면 머리 — 통합실적과 같은 틀(사용자 확정): 제목 · 설명 · 기준일. 블록 탭 밖 맨 위에 선다 */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-inshop-lg font-semibold">{t('performance.stages.title')}</h1>
          <p className="mt-0.5 text-inshop-xs text-foreground/55">
            {t('performance.stages.snapshot')} · {t('performance.stages.nodeNote')}
          </p>
          <BaseDateControl selection={dateSelection} onChange={setDateSelection} today={today} className="mt-1.5" />
        </div>
      </div>
      <FilterBar
        vessels={vessels}
        vessel={vessel}
        onVesselChange={onVesselChange}
        blockOptions={blockOptions}
        selectedBlocks={query?.blocks ?? []}
        onBlocksApply={onBlocksApply}
        process="fabrication"
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
            {loadingDetail && !stages ? (
              <CardSkeleton label={t('states.loading')} rows={4} />
            ) : stages ? (
              <div ref={cardsRef}>
                <StageCards
                  summary={stages}
                  activeStage={detailStage}
                  onSelectStage={selectStage}
                  onOpenOverall={setBasisOpen}
                  counts={windowCounts}
                />
              </div>
            ) : null}
          </section>
          </BlockTabs>
          {basisOpen && activeBlock && (
            <OverallBasisDialog
              title={`${query.projNo}-${activeBlock}`}
              load={loadOverallBasis}
              only={basisOpen}
              onClose={() => setBasisOpen(null)}
            />
          )}
          {detailStage && activeBlock && (
            <StageDetailDialog
              title={`${query.projNo}-${activeBlock}`}
              stage={detailStage}
              load={loadStageDetail}
              events={blockEvents}
              loadEventDetail={fetchFabEventDetail}
              onClose={() => setDetailStage(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
