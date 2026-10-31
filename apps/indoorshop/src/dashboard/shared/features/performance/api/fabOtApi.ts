import type { DateWindow } from '../lib/baseDate'
import type { CollectionEvent, EventDetail } from '../model/types'
import { FAB_STAGE_CHECKPOINT, FAB_STAGE_SUB_CHECKPOINT, type FabOverallBasis, type FabRateBasis, type FabStageDetail, type FabStageSummary } from '../model/fabStages'
import { FAB_STAGES, type FabStageId } from '../model/types'
import {
  anchorRowsOf,
  drawingDetailOf,
  overallBasisOf,
  partDetailOf,
  partRowsOf,
  planBasisCard,
  planBasisOverall,
  toCollectionEvent,
  toFabStageSummary,
} from './fabOtAdapter'
import {
  mockBlockCheckpoints,
  mockFabAnchors,
  mockFabDrawing,
  mockFabEvents,
  mockFabParts,
  mockFabWorkOrders,
} from './fabOtMock'

/**
 * 가공 탭이 읽는 가공 OT API v1.0 — 지금은 **모의 서버**(`fabOtMock`)만 부른다.
 *
 * 서버가 붙으면 아래 네 함수의 몸통만 `fetch(apiUrl('/v1/fab/…'))` 로 바꾼다. 경로는 명세 그대로다:
 *   C2 GET /api/v1/fab/progress/blocks/{hullNo}/{blockNo}/checkpoints?asOf=&includeHeld=true
 *   B4 GET /api/v1/fab/events?hullNo=&blockNo=&from=&to=&eventGroup=CHECKPOINT
 *   B2 GET /api/v1/fab/drawings/{dwgNo}
 *   B5 GET /api/v1/fab/parts?hullNo=&dwgNo=
 *   C3 GET /api/v1/fab/progress/anchors?hullNo=&blockNo=&asOf=  (+ 도면마다 C4 /anchors/{anchorId})
 *   B3 GET /api/v1/fab/work-orders?hullNo=&blockNo=
 * 실호출(인증 · 오류 처리)은 명세의 미결 사항(결정 6 인증 · IPD-IF01)이 정해진 뒤에 세운다.
 */

/** C2 — 단계별 실적률 카드 */
export async function fetchFabStageSummary(hullNo: string, blockNo: string, asOf: string): Promise<FabStageSummary> {
  /* 사상(GRIND)은 보류 절점이라 includeHeld 로 받아 S8 카드에 세운다 */
  return toFabStageSummary(mockBlockCheckpoints(hullNo, blockNo, { asOf, includeHeld: true }))
}

/** B4 — 수집 현황. 기간은 화면 기간 그대로(최대 92일) */
export async function fetchFabGridEvents(
  hullNo: string,
  blockNos: readonly string[],
  window: DateWindow
): Promise<CollectionEvent[]> {
  const page = mockFabEvents({ hullNo, blockNo: [...blockNos], from: window.from, to: window.to })
  return page.items.flatMap((e) => {
    const row = toCollectionEvent(e)
    return row ? [row] : []
  })
}

/** B2(도면 행) · B5(부재 행) — 하위 데이터 */
export async function fetchFabEventDetail(event: CollectionEvent): Promise<EventDetail> {
  if (event.mgmtNoType === 'DWG') {
    const dto = mockFabDrawing(event.mgmtNo)
    if (dto) return drawingDetailOf(event.id, dto)
  } else {
    /* B5 에는 부재번호 파라미터가 없어 그 블록의 부재 목록에서 고른다 (부재번호 1~4자 = 호선) */
    const hullNo = event.mgmtNo.slice(0, 4)
    const parts = mockFabParts({ hullNo, blockNo: [event.blockNo] }).items
    const part = parts.find((p) => p.partNo === event.mgmtNo)
    if (part) return partDetailOf(event.id, part)
  }
  return { eventId: event.id, unit: event.mgmtNoType === 'DWG' ? '도면' : '부재', entries: [] }
}

/**
 * 절점 세부 — 카드를 누르면 뜨는 창. 도면 단위 절점은 C3 · C4(도면 판정 + cp_stats · cp_plan · cpHistory),
 * 부재 단위 절점은 B5(부재 시각 열) + C3(도면 계획일 · 미대상)를 읽는다.
 */
export async function fetchFabStageDetail(
  hullNo: string,
  blockNo: string,
  stage: FabStageId,
  asOf: string
): Promise<FabStageDetail> {
  const code = FAB_STAGE_CHECKPOINT[stage]
  const summary = await fetchFabStageSummary(hullNo, blockNo, asOf)
  const card = summary.stages.find((s) => s.stage === stage)!
  const base = {
    stage,
    card,
    code,
    basis: card.basis,
    unit: card.unit,
    asOf: summary.asOfUsed,
    steelLayers: card.steelLayers ?? null,
  }
  if (!code || !card.basis) return { ...base, rows: [] }
  const anchors = mockFabAnchors(hullNo, blockNo, asOf)
  const parts = () => mockFabParts({ hullNo, blockNo: [blockNo] }).items
  /* 보조 절점(S7 아래 곡가공)도 부재 줄로 편다 — 카드의 '곡가공 완료 n/m' 을 세부에서 확인한다(사용자 확정) */
  const subCode = FAB_STAGE_SUB_CHECKPOINT[stage]
  const sub =
    subCode && card.sub ? { code: subCode, name: card.sub.name, rows: partRowsOf(subCode, parts(), anchors, asOf) } : undefined
  if (card.basis === 'PART') return { ...base, rows: partRowsOf(code, parts(), anchors, asOf), ...(sub && { sub }) }
  return { ...base, rows: anchorRowsOf(code, card.basis, anchors, asOf), ...(sub && { sub }) }
}

/** 종합 근거 — C2(종합 · 절점 계획일) + C3(도면 판정) + B3(W/O 정산 진도율) */
export async function fetchFabOverallBasis(
  hullNo: string,
  blockNo: string,
  asOf: string,
  basis: FabRateBasis = 'all'
): Promise<FabOverallBasis> {
  const summary = await fetchFabStageSummaryBy(hullNo, blockNo, asOf, basis)
  const anchors = mockFabAnchors(hullNo, blockNo, asOf)
  const workOrders = mockFabWorkOrders({ hullNo, blockNo, asOf }).items
  return overallBasisOf(summary, anchors, workOrders, basis)
}

/**
 * 절점 카드에 적을 세부 데이터 줄 수 — 실서버에서는 C3 · B5 목록 응답의 `page.totalElements` 다.
 * 지금은 모의 서버의 세부 줄을 그대로 센다.
 */
export async function fetchFabStageDetailCounts(
  hullNo: string,
  blockNo: string,
  asOf: string
): Promise<Partial<Record<FabStageId, number>>> {
  const entries = await Promise.all(
    FAB_STAGES.filter((stage) => FAB_STAGE_CHECKPOINT[stage] !== null).map(
      async (stage) => [stage, (await fetchFabStageDetail(hullNo, blockNo, stage, asOf)).rows.length] as const
    )
  )
  return Object.fromEntries(entries)
}

/**
 * 단계별 실적률 — 기준(`basis`)을 고른다. 'plan' 이면 절점마다 세부 줄(도면 · 부재)로 계획 도래분만 다시 센다
 * (`planBasisCard`). 종합(판별 실적)과 레거시 정산도 계획 도래분으로 다시 센다(`planBasisOverall`, 사용자 확정).
 */
export async function fetchFabStageSummaryBy(
  hullNo: string,
  blockNo: string,
  asOf: string,
  basis: FabRateBasis
): Promise<FabStageSummary> {
  const summary = await fetchFabStageSummary(hullNo, blockNo, asOf)
  if (basis === 'all') return summary
  const stages = await Promise.all(
    summary.stages.map(async (card) => {
      if (card.code === null) return card
      const detail = await fetchFabStageDetail(hullNo, blockNo, card.stage, asOf)
      return planBasisCard(card, detail.rows, detail.asOf, detail.sub?.rows)
    })
  )
  /* 종합(판별 실적) · 레거시 정산도 계획 도래분으로 — 계획%는 그대로 */
  const overall = planBasisOverall(
    summary.overall,
    mockFabAnchors(hullNo, blockNo, asOf),
    mockFabWorkOrders({ hullNo, blockNo, asOf }).items,
    summary.asOfUsed
  )
  return { ...summary, overall, stages }
}

/** 절점 세부 — 창 위 카드 요약도 지금 기준으로 */
export async function fetchFabStageDetailBy(
  hullNo: string,
  blockNo: string,
  stage: FabStageId,
  asOf: string,
  basis: FabRateBasis
): Promise<FabStageDetail> {
  const detail = await fetchFabStageDetail(hullNo, blockNo, stage, asOf)
  if (basis === 'all' || !detail.card) return detail
  return { ...detail, card: planBasisCard(detail.card, detail.rows, detail.asOf, detail.sub?.rows) }
}
