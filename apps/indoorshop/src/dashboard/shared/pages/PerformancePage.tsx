import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../lib/i18n/useTranslation'
import { Button } from '../ui/atoms/Button'
import { ToggleButton } from '../ui/atoms/ToggleButton'
import {
  fetchBlocks,
  fetchBlockSummary,
  fetchCollectionEvents,
} from '../features/performance/api/performanceApi'
import type { BlockSummary, CollectionEvent } from '../features/performance/model/types'
import {
  DATE_PARAMS,
  dateParamsOf,
  defaultSelection,
  entryDateSelection,
  rememberDateSelection,
  todayString,
  windowOf,
  type BaseDateSelection,
} from '../features/performance/lib/baseDate'
import { useBlockQuery } from '../features/performance/lib/useBlockQuery'
import { BaseDateControl } from '../features/performance/ui/BaseDateControl'
import { FilterBar } from '../features/performance/ui/FilterBar'
import { BlockTabs } from '../features/performance/ui/BlockTabs'
import { BlockHeaderCard } from '../features/performance/ui/BlockHeaderCard'
import {
  fetchOutfittingRows,
  rowOfBlock,
  rowsOfQuery,
  type OutfittingRow,
} from '../features/performance/api/outfittingPerformance'
import { nowDate } from '../lib/now'

const REFRESH_SECONDS = 5

export function PerformancePage() {
/**
 * 공정 레일 — 네 공정이 모두 산다. 준비중·절점 없음을 화면에 명시한다(D3).
 *
 * 순서는 **블록의 생애주기 정본**이다: 가공 → 조립 → 의장 → 도장 (R32). 한 블록이
 * 실제로 지나는 차례이고, 아래 절점 카드·조회 조건 바(`FilterBar`)의 공정 세그먼트가
 * 쓰는 순서와 같다 — 한 화면에서 공정을 세 번 나열하는데 차례가 서로 다르면, 읽는 사람은
 * 그 차이를 뜻으로 읽는다(왜 여기서는 도장이 먼저지?).
 */

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
    /* 주소 > 다른 탭에서 마지막으로 고른 날짜 > 오늘 — 날짜 필터는 모든 탭이 공유한다 */
    entryDateSelection(searchParams, todayString())
  )
  const baseDate = dateSelection.date
  const dateWindow = useMemo(() => windowOf(dateSelection), [dateSelection])
  /* 조회 조건 · 블록 탭 — 공정 [실적] 화면과 한 벌(`useBlockQuery`) */
  const { zone, vessels, vessel, blockOptions, query, activeBlock, setActiveBlock, onVesselChange, onBlocksApply, onBlockClose, onReset } =
    useBlockQuery('performance')
  const [summaries, setSummaries] = useState<BlockSummary[]>([])
  const [events, setEvents] = useState<CollectionEvent[]>([])
  /* 의장 레일 — 절점이 없어 블록 줄이 곧 카드다. 값은 의장 공장 화면과 같은 원천이다 */
  const [outfittingRows, setOutfittingRows] = useState<OutfittingRow[]>([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  /* 고른 블록 전부의 요약을 한 번에 받아 두고, 화면은 지금 탭의 블록만 그린다.
     수집 행은 '내보내기'(CSV)를 위해 고른 블록 전부를 받는다 */
  const runQuery = useCallback(
    async (projNo: string, blocks: string[]) => {
      const targetBlocks = blocks.length > 0 ? blocks : (await fetchBlocks(projNo)).map((b) => b.blockNo)
      const [nextSummaries, nextEvents, nextOutfitting] = await Promise.all([
        Promise.all(targetBlocks.map((b) => fetchBlockSummary(projNo, b, baseDate))),
        /* 창을 함께 넘긴다 — 기준일 이후 행은 seam 에서 잘린다(그날 화면에 없던 일) */
        fetchCollectionEvents(projNo, targetBlocks, 'all', baseDate, dateWindow),
        /* 의장은 레지스트리를 거쳐 읽는다 — shared 가 공정 모듈을 부를 수 없다 */
        fetchOutfittingRows(baseDate),
      ])
      setSummaries(nextSummaries)
      setEvents(nextEvents)
      setOutfittingRows(rowsOfQuery(nextOutfitting, projNo, targetBlocks))
      setRefreshedAt(nowDate().toTimeString().slice(0, 8))
    },
    [baseDate, dateWindow]
  )

  /* 조건 · 기준일 · 조회 창이 바뀌면 **지금 조건 그대로** 다시 조회한다 — 시간축은 조회 조건이지
   * 다른 화면이 아니므로, 날짜를 옮겼다고 조건을 다시 고를 이유가 없다. */
  useEffect(() => {
    if (!query) return
    void runQuery(query.projNo, query.blocks)
  }, [query, runQuery])

  /* 자동갱신 스텁(D5) — 정의서 기본 5초. mock 재조회이므로 값은 안정적이다. */
  useEffect(() => {
    if (!autoRefresh || !query) return
    const timer = setInterval(() => {
      void runQuery(query.projNo, query.blocks)
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
    /* 다른 탭으로 건너가도 같은 날짜로 선다 */
    rememberDateSelection(next, today)
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

  const handleReset = () => {
    onReset()
    /* 시간축도 함께 초기화한다 — '초기화' 를 눌렀는데 지난주를 보고 있으면 거짓말이다 */
    handleDateChange(defaultSelection(today))
    setSummaries([])
    setEvents([])
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


  return (
    <div className="dashboard-typography flex min-h-full flex-col gap-4 p-4">
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
        onVesselChange={onVesselChange}
        blockOptions={blockOptions}
        selectedBlocks={query?.blocks ?? []}
        onBlocksApply={onBlocksApply}
        /* 권역 탭은 두지 않는다(사용자 확정) — 이 화면은 블록 요약 하나라 거를 것이 없다.
           내보내기(CSV)는 늘 전 권역이다 */
        process="all"
        onProcessChange={() => undefined}
        hideProcess
        onReset={handleReset}
      />

      {query === null ? (
        <div className="rounded-inshop-lg border border-dashed border-border px-4 py-16 text-center text-inshop-sm text-foreground/55">
          {vessel ? t('performance.filter.selectBlockFirst') : t('performance.filter.selectVesselFirst')}
        </div>
      ) : (
        <>
          {/* 블록 요약이 이 화면의 본문이다(사용자 확정) — 크게 세우고, 공정별 섹션(가공 절점 ·
              조립 · 의장 · 도장 카드)과 수집 현황·하위 데이터는 두지 않는다. 공정별 상세와 수집 행은
              각 공정 화면의 [실적] 이 맡는다. 수집 행은 '내보내기'(CSV)를 위해서만 받아 둔다 */}
          {/* 고른 블록들의 탭 — 한 화면에 여러 블록을 늘어놓지 않고 지금 탭의 블록 하나만 그린다(사용자 확정) */}
          <BlockTabs
            projNo={query.projNo}
            blocks={query.blocks}
            active={activeBlock}
            onSelect={setActiveBlock}
            onClose={onBlockClose}
            favoriteZone={zone}
            /* 폴더 탭 아래 칸이 남는 높이를 다 채운다 — 카드 아래가 비지 않게(사용자 확정) */
            className="flex-1"
          >
          {summaries
            .filter((summary) => summary.blockNo === activeBlock)
            .map((summary) => (
              <BlockHeaderCard
                key={summary.blockNo}
                size="large"
                /* 폴더 탭의 칸이 곧 카드 테두리다 — 카드는 테두리·바탕을 벗고 칸을 다 채운다 */
                className="flex-1 border-0 bg-transparent p-2"
                summary={summary}
                /* 의장 줄 — 그 블록이 의장 재공일 때만 채워진다 */
                outfitting={rowOfBlock(outfittingRows, summary.projNo, summary.blockNo)}
                selectedBlocks={query.blocks}
              />
            ))}
          </BlockTabs>
        </>
      )}

      {/* 정의서 §1 문구 상시 노출 — 참고 수치 원칙 */}
      <div className="border-t border-border pt-3 text-center text-[11px] text-foreground/45">
        {t('performance.footer')}
      </div>
    </div>
  )
}
