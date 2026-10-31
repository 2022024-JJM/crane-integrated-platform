import { useEffect, useState } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { useBaseDate, useBaseDateWriter } from '../../../shared/lib/useBaseDate'
import { BaseDateControl } from '../../../shared/features/performance/ui/BaseDateControl'
import { useBlockQuery } from '../../../shared/features/performance/lib/useBlockQuery'
import { CardSkeleton } from '../../../shared/ui/states'
import {
  fetchOutfittingRows,
  overallOf,
  rowsOfQuery,
  type OutfittingRow,
} from '../../../shared/features/performance/api/outfittingPerformance'
import { FilterBar } from '../../../shared/features/performance/ui/FilterBar'
import { BlockTabs } from '../../../shared/features/performance/ui/BlockTabs'
import { OutfittingCard } from '../../../shared/features/performance/ui/OutfittingCard'
import { EventsSection } from '../../../shared/features/performance/ui/EventsSection'

/**
 * 선행의장 화면의 [실적] 갈래 — 통합실적의 조회 조건 바(호선 · 블록 · 조회 · 초기화)를 그대로
 * 쓰되 **의장 공정만** 본다(사용자 확정, 조립 [실적] 과 같은 틀). 공정 세그먼트는 감추고,
 * 결과는 통합실적의 의장 레일(블록 판별 %)과 수집 이벤트 자리만 낸다.
 *
 * 의장 수집 이벤트는 아직 범위 밖이다 — 통합실적에서 의장 필터를 골랐을 때와 같이 준비중
 * 안내를 낸다(`fetchCollectionEvents` 가 의장에는 빈 목록을 돌려준다).
 *
 * 조회 조건(호선 · 블록)은 **통합실적·조립 실적과 한 벌**이다 — 같은 자리(`rememberSelection`)에
 * 남기고, 들어올 때 같은 규칙(`resolveEntrySelection`: 주소 → 직전 선택)으로 되살린다.
 */
export function OutfittingPerformanceView() {
  const { t } = useTranslation()
  const { baseDate, window: dateWindow, selection: dateSelection, today } = useBaseDate()
  /* 기준일 컨트롤 — 통합실적과 같은 주소 축을 고친다(사용자 확정: 공정 [실적] 에도 날짜 조건) */
  const setDateSelection = useBaseDateWriter()

  const { zone, vessels, vessel, blockOptions, query, activeBlock, setActiveBlock, onVesselChange, onBlocksApply, onBlockClose, onReset } =
    useBlockQuery('outfitting')
  const [rows, setRows] = useState<OutfittingRow[] | null>(null)

  /* 조건 · 기준일이 바뀌면 의장 레일을 다시 받는다 */
  useEffect(() => {
    if (!query) return
    let cancelled = false
    setRows(null)
    void (async () => {
      /* 지금 탭의 블록 것만 — 탭을 누르면 그 블록의 내용만 선다(사용자 확정) */
      const blocks = activeBlock ? [activeBlock] : query.blocks
      const all = await fetchOutfittingRows(baseDate)
      if (cancelled) return
      setRows(rowsOfQuery(all, query.projNo, blocks))
    })()
    return () => {
      cancelled = true
    }
  }, [query, activeBlock, baseDate])

  const handleReset = () => {
    onReset()
    setRows(null)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* 화면 머리 — 통합실적과 같은 틀(사용자 확정): 제목 · 설명 · 기준일. 블록 탭 밖 맨 위에 선다 */}
      <div>
        <h1 className="text-inshop-lg font-semibold">{t('performance.ofit.title')}</h1>
        <p className="mt-0.5 text-inshop-xs text-foreground/55">{t('performance.ofit.basisNote')}</p>
        <BaseDateControl selection={dateSelection} onChange={setDateSelection} today={today} className="mt-1.5" />
      </div>
      <FilterBar
        vessels={vessels}
        vessel={vessel}
        onVesselChange={onVesselChange}
        blockOptions={blockOptions}
        selectedBlocks={query?.blocks ?? []}
        onBlocksApply={onBlocksApply}
        process="outfitting"
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

          {/* 의장 절점 — **없다.** 절점을 지어내지 않고 블록 판별 %만 세운다 (통합실적과 같은 카드) */}
          <section>
            {rows === null ? (
              <CardSkeleton label={t('states.loading')} rows={4} />
            ) : (
              <OutfittingCard rows={rows} overall={overallOf(rows)} />
            )}
          </section>

          <EventsSection
            events={[]}
            pendingProcess
            scopeKey="performance.grid.scopeAll"
            window={dateWindow}
          />
          </BlockTabs>
        </>
      )}
    </div>
  )
}
