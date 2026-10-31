import { FAB_STAGES, type CollectionEvent, type EventDetail, type FabStageId, type StageStatus } from '../model/types'
import {
  FAB_STAGE_CHECKPOINT,
  FAB_STAGE_SUB_CHECKPOINT,
  type FabOverallBasis,
  type FabRateBasis,
  type FabStageCard,
  type FabStageDetailRow,
  type FabStageSummary,
} from '../model/fabStages'
import type {
  FabAnchorDetail,
  FabBlockCheckpoints,
  FabCpStat,
  FabCutPart,
  FabDrawingDetail,
  FabEvent,
  FabWorkOrder,
} from './fabOtTypes'

/**
 * 가공 OT API v1.0 응답 → 화면 형. 명세 §8 「화면 ↔ API」 표를 코드로 옮긴 것이다.
 * 응답 모양이 바뀌면 여기만 고친다(화면 컴포넌트는 API 형을 모른다).
 */

const STAGE_OF_CODE = new Map<string, FabStageId>(
  FAB_STAGES.flatMap((stage) => {
    const code = FAB_STAGE_CHECKPOINT[stage]
    return code ? [[code, stage] as const] : []
  })
)
/* 절단 착수(마킹 완료)는 S7 의 '진행' 행이다 */
STAGE_OF_CODE.set('MARK_DONE', 'S7')

/** C2 → 단계별 실적률 카드. S5 처럼 Hot DB 에 없는 절점은 빈 카드로 선다 */
export function toFabStageSummary(dto: FabBlockCheckpoints): FabStageSummary {
  const byCode = new Map(dto.checkpoints.map((cp) => [cp.code as string, cp]))
  const stages = FAB_STAGES.map((stage): FabStageCard => {
    const code = FAB_STAGE_CHECKPOINT[stage]
    const cp = code ? byCode.get(code) : undefined
    const subCode = FAB_STAGE_SUB_CHECKPOINT[stage]
    const subCp = subCode ? byCode.get(subCode) : undefined
    const sub = subCp
      ? { code: subCp.code, name: subCp.name, doneCount: subCp.doneCnt, targetCount: subCp.targetCnt }
      : undefined
    if (!cp) {
      return {
        stage,
        code,
        basis: null,
        measure: null,
        unit: '',
        held: false,
        pendingSource: false,
        targetCount: 0,
        doneCount: 0,
        inProgressCount: 0,
        notDueCount: 0,
        excludedCount: 0,
        targetQty: 0,
        doneQty: 0,
        rate: null,
        countRate: null,
        planDate: null,
        delayed: false,
      }
    }
    return {
      stage,
      code,
      basis: cp.basis,
      measure: cp.weight,
      unit: cp.unit,
      held: !cp.inScope,
      pendingSource: cp.pendingSource,
      targetCount: cp.targetCnt,
      doneCount: cp.doneCnt,
      inProgressCount: cp.inProgressCnt,
      notDueCount: cp.notDueCnt,
      excludedCount: cp.excludedCnt,
      targetQty: cp.targetQty,
      doneQty: cp.doneQty,
      rate: cp.doneRate,
      countRate: cp.countRate,
      planDate: cp.planDate,
      delayed: cp.delayed,
      ...(sub && { sub }),
      ...(cp.steelLayers && { steelLayers: cp.steelLayers }),
    }
  })
  return {
    asOfUsed: dto.asOfUsed,
    overall: { autoPct: dto.overall.autoPct, legacyPct: dto.overall.legacyPct, planPct: planPctOf(stages, dto.asOfUsed) },
    stages,
  }
}

/**
 * 계획% — **화면 절점 S1~S10** 기준으로 다시 센다(사용자 확정). 서버 `overall.planPct` 는 Hot DB 절점
 * (마킹 완료 · 곡가공 포함, 보류 사상 제외)로 센 값이라 카드와 분모가 달랐다.
 * 분모는 Hot DB 절점이 있는 화면 절점이다 — S5(가공 입고)는 계획일 자체가 없어 빠진다(넣으면 영원히 90% 가 상한).
 * 분자는 그중 계획일이 기준일까지 온 절점.
 */
export function planPctOf(stages: readonly FabStageCard[], asOf: string): number {
  const planned = stages.filter((s) => s.code !== null)
  if (planned.length === 0) return 0
  const due = planned.filter((s) => s.planDate !== null && s.planDate <= asOf).length
  return Math.round((due / planned.length) * 1000) / 10
}

/** ISO 8601(+09:00) → 화면 일시. 시각이 원천에 없으면(`hasTime=false`) 날짜만 */
function instantOfTs(ts: string, hasTime: boolean) {
  const date = ts.slice(0, 10)
  return hasTime ? { date, time: ts.slice(11, 16) } : { date }
}

/** B4 한 줄 → 수집 현황 한 줄. 화면 절점에 없는 사건(곡가공 · EVENT 묶음)은 null */
export function toCollectionEvent(e: FabEvent): CollectionEvent | null {
  if (e.eventGroup !== 'CHECKPOINT') return null
  const stage = STAGE_OF_CODE.get(e.eventCode)
  if (!stage) return null
  const instant = instantOfTs(e.eventTs, e.hasTime)
  /* 마킹 완료 = 절단 착수 — 완료 칸은 비운다 */
  const started = e.eventCode === 'MARK_DONE'
  return {
    id: e.eventId,
    blockNo: e.blockNo,
    stage,
    mgmtNoType: e.unitType === 'DWG' ? 'DWG' : 'PC',
    mgmtNo: e.unitId,
    occurred: instant,
    completed: started ? null : instant,
    status: started ? 'inProgress' : 'done',
    sources: e.source,
    flagged: e.flagged,
  }
}

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '—' : String(v))
const tsText = (ts: string | null) => (ts ? (ts.slice(11, 19) === '00:00:00' ? ts.slice(0, 10) : `${ts.slice(0, 10)} ${ts.slice(11, 16)}`) : '—')
const statusText = (s: '' | '1' | '2') => (s === '2' ? '완료' : s === '1' ? '진행' : '미착수')

/** B2 → 하위 데이터(도면 단위). KV 라벨은 화면이 만든다(명세 §8) */
export function drawingDetailOf(eventId: string, dto: FabDrawingDetail): EventDetail {
  const { drawing, parts, workOrders, events } = dto
  return {
    eventId,
    unit: '도면',
    entries: [
      { label: '도면번호', value: drawing.dwgNo },
      { label: '사내·사외', value: drawing.site === 'OUT' ? '사외' : '사내' },
      { label: '절단계획일', value: dash(drawing.cutPlanDate) },
      { label: '마킹·절단 실적일', value: `${dash(drawing.actlSd)} / ${dash(drawing.actlFd)}` },
      { label: '마킹 상태', value: statusText(drawing.markStatus) },
      { label: '절단 상태', value: statusText(drawing.cutStatus) },
      { label: '대상 시수(MH)', value: drawing.targetMh.toFixed(2) },
      { label: '절단 베이', value: dash(drawing.cutBay) },
      { label: 'W/O', value: workOrders.map((wo) => wo.woNo).join(', ') || '—' },
      { label: '부재 수 · 중량(kg)', value: `${parts.total} · ${parts.weightKg.toLocaleString()}` },
      { label: '곡가공 완료', value: `${parts.bendDone}/${parts.bendTarget}` },
      { label: '모둠선별 · 불출', value: `${parts.grouped} · ${parts.issued}` },
      { label: '절점 사건', value: `${events.length}건` },
      { label: '분모 제외', value: drawing.excluded ? dash(drawing.excludeReason) : '—' },
    ],
  }
}

/** B5 한 행 → 하위 데이터(부재 단위) */
export function partDetailOf(eventId: string, part: FabCutPart): EventDetail {
  return {
    eventId,
    unit: '부재',
    entries: [
      { label: '부재번호', value: part.partNo },
      { label: '도면번호', value: dash(part.dwgNo) },
      { label: '중량(kg)', value: dash(part.weightKg) },
      { label: '배송지', value: dash(part.destWstg) },
      { label: '곡가공 · 사상 대상', value: `${part.bendFlag ? 'Y' : 'N'} · ${part.grindFlag ? 'Y' : 'N'}` },
      { label: '절단 완료', value: tsText(part.cutDoneTs) },
      { label: '곡가공 완료', value: tsText(part.bendDoneTs) },
      { label: '사상 완료', value: tsText(part.grindDoneTs) },
      { label: '모둠선별', value: tsText(part.groupTs) },
      { label: '불출', value: part.issueTs ? `${tsText(part.issueTs)} (${dash(part.issueSrc)})` : '—' },
    ],
  }
}

/* ── 절점 세부 (C3 · C4 도면 판정 / B5 부재) ───────────────────────── */

const EXCLUDE_REASON_TEXT: Record<string, string> = { TBAR: 'T-BAR', SSYW: 'SSYW', DWG_D: '도면 D' }

function rowStatusOf(stat: FabCpStat | undefined): StageStatus {
  if (!stat || stat.target === 0) return 'excluded'
  if (stat.done >= stat.target) return 'done'
  if ((stat.inProgress ?? 0) > 0 || stat.done > 0) return 'inProgress'
  return 'notDue'
}

/** C3 · C4 → 도면 단위 절점의 세부 줄 (강재 · 도면 절점) */
export function anchorRowsOf(code: string, basis: 'MAT' | 'DWG', anchors: FabAnchorDetail[], asOf: string): FabStageDetailRow[] {
  return anchors.map((a) => {
    const stat = a.cpStats[code]
    const status = rowStatusOf(stat)
    const hit = a.cpHistory.find((h) => h.cp === code)
    const planDate = a.cpPlan[code] ?? null
    const note = a.excluded
      ? `미대상 · ${EXCLUDE_REASON_TEXT[a.excludeReason ?? ''] ?? a.excludeReason ?? ''}`
      : status === 'excluded' && a.site === 'OUT'
        ? '사외 도면 — 적치 절점 해당 없음'
        : null
    const units = basis === 'MAT' && stat ? { done: stat.done, target: stat.target || (stat.excluded ?? 0) } : null
    return {
      id: a.anchorId,
      unitType: 'DWG',
      dwgNo: a.anchorId,
      site: a.site,
      status,
      planDate,
      actual: hit ? instantOfTs(hit.ts, hit.ts.slice(11, 19) !== '00:00:00') : null,
      source: hit?.source ?? null,
      units,
      qty: stat && stat.target > 0 ? { done: stat.doneQty, target: stat.targetQty } : null,
      delayed: status !== 'done' && status !== 'excluded' && planDate !== null && planDate <= asOf,
      note,
    }
  })
}

/** 부재 절점의 도달 시각 열 · 앞 절점 열 (B5) */
const PART_TS: Record<string, { ts: keyof FabCutPart; prev: keyof FabCutPart; flag?: keyof FabCutPart }> = {
  BEND_DONE: { ts: 'bendDoneTs', prev: 'cutDoneTs', flag: 'bendFlag' },
  GRIND: { ts: 'grindDoneTs', prev: 'cutDoneTs', flag: 'grindFlag' },
  GROUP: { ts: 'groupTs', prev: 'cutDoneTs' },
  PART_ISSUE: { ts: 'issueTs', prev: 'groupTs' },
}

/**
 * B5 → 부재 단위 절점의 세부 줄. 상태는 화면이 시각 열로 가른다 — 이 절점 시각이 기준일까지 왔으면 완료,
 * 앞 절점(불출은 모둠선별, 나머지는 절단 완료)만 왔으면 진행 중, 아니면 미도래. 미대상 도면의 부재는 미대상.
 * 대상 아닌 부재(곡가공 · 사상 대상 아님)는 줄을 세우지 않는다.
 */
export function partRowsOf(code: string, parts: FabCutPart[], anchors: FabAnchorDetail[], asOf: string): FabStageDetailRow[] {
  const col = PART_TS[code]
  if (!col) return []
  const anchorOf = new Map(anchors.map((a) => [a.anchorId, a]))
  const reached = (ts: unknown) => typeof ts === 'string' && ts.slice(0, 10) <= asOf
  return parts.flatMap((p): FabStageDetailRow[] => {
    if (col.flag && p[col.flag] !== true) return []
    const anchor = p.dwgNo ? anchorOf.get(p.dwgNo) : undefined
    const ts = p[col.ts] as string | null
    const status: StageStatus = anchor?.excluded
      ? 'excluded'
      : reached(ts)
        ? 'done'
        : reached(p[col.prev])
          ? 'inProgress'
          : 'notDue'
    const planDate = anchor?.cpPlan[code] ?? null
    return [
      {
        id: p.partNo,
        unitType: 'PART',
        dwgNo: p.dwgNo ?? '—',
        site: p.cutSite ?? 'IN',
        status,
        planDate,
        actual: status === 'done' && ts ? instantOfTs(ts, ts.slice(11, 19) !== '00:00:00') : null,
        source: status === 'done' ? (code === 'PART_ISSUE' ? p.issueSrc : 'PART') : null,
        units: null,
        qty: p.weightKg === null ? null : { done: status === 'done' ? p.weightKg : 0, target: p.weightKg },
        delayed: status !== 'done' && status !== 'excluded' && planDate !== null && planDate <= asOf,
        note: anchor?.excluded ? `미대상 · ${EXCLUDE_REASON_TEXT[anchor.excludeReason ?? ''] ?? anchor.excludeReason ?? ''}` : null,
      },
    ]
  })
}

/* ── 종합 근거 (C3 도면 · B3 W/O · C2 절점) ───────────────────────── */

export function overallBasisOf(
  summary: FabStageSummary,
  allAnchors: FabAnchorDetail[],
  allWorkOrders: FabWorkOrder[],
  basis: FabRateBasis = 'all'
): FabOverallBasis {
  const asOf = summary.asOfUsed
  /* 계획일 기준이면 근거 줄도 계획 도래분만 — 표의 합계가 카드 숫자와 같아야 한다 */
  const anchors = basis === 'plan' ? dueAnchors(allAnchors, asOf) : allAnchors
  const workOrders = basis === 'plan' ? dueWorkOrders(allWorkOrders, asOf) : allWorkOrders
  return {
    basis,
    asOf,
    overall: summary.overall,
    drawings: anchors.map((a) => {
      const hit = a.cpHistory.find((h) => h.cp === 'CUT_DONE')
      const targetMh = a.plannedQty ?? 0
      return {
        dwgNo: a.anchorId,
        site: a.site,
        excludedReason: a.excluded ? (EXCLUDE_REASON_TEXT[a.excludeReason ?? ''] ?? a.excludeReason ?? '—') : null,
        targetMh,
        cutDone: hit ? instantOfTs(hit.ts, hit.ts.slice(11, 19) !== '00:00:00') : null,
        doneMh: a.excluded || !hit ? 0 : targetMh,
      }
    }),
    workOrders: workOrders.map((w) => ({
      woNo: w.woNo,
      dwgNo: w.dwgNo,
      stepCode: w.stepCode,
      planMh: w.planMh,
      accRate: w.accRate,
      excluded: w.excluded,
    })),
    plan: summary.stages.map((s) => ({
      stage: s.stage,
      code: s.code,
      planDate: s.planDate,
      due: s.code !== null && s.planDate !== null && s.planDate <= asOf,
    })),
  }
}

/* ── 진행률 기준 — 계획일 기준(계획 도래분) ───────────────────────── */

/**
 * 절점 카드 한 장을 **계획일 기준**으로 다시 센다(사용자 확정: 전체 대비 / 계획일 기준 옵션).
 * 분모 = 기준일까지 계획일이 온 대상(미대상 제외), 분자 = 그중 완료한 것. 계획일 전에 미리 끝낸 것은
 * 분자에 넣지 않는다(100% 를 넘지 않게). 계획일이 온 대상이 없으면 실적률은 null(—).
 * 단위 규칙은 그대로다 — 강재 kg · 도면 MH · 부재 개. 줄(도면 · 부재)은 세부 데이터와 같은 것을 쓴다.
 */
export function planBasisCard(
  card: FabStageCard,
  rows: readonly FabStageDetailRow[],
  asOf: string,
  subRows?: readonly FabStageDetailRow[]
): FabStageCard {
  if (card.code === null || card.basis === null) return card
  const due = rows.filter((r) => r.status !== 'excluded' && r.planDate !== null && r.planDate <= asOf)
  const isMat = card.basis === 'MAT'
  const isPart = card.basis === 'PART'
  /* 건수 — 강재는 강판 장, 도면 · 부재는 줄 하나가 한 건 */
  const units = (r: FabStageDetailRow) => (isMat && r.units ? r.units.target : 1)
  const sumUnits = (status: StageStatus) => due.filter((r) => r.status === status).reduce((n, r) => n + units(r), 0)
  const targetCount = due.reduce((n, r) => n + units(r), 0)
  const doneCount = sumUnits('done')
  /* 양 — 부재(개)는 건수가 곧 양이다. 강재 kg · 도면 MH 는 줄의 완료/대상 양을 더한다 */
  const targetQty = isPart ? targetCount : round2(due.reduce((n, r) => n + (r.qty?.target ?? 0), 0))
  const doneQty = isPart
    ? doneCount
    : round2(due.filter((r) => r.status === 'done').reduce((n, r) => n + (r.qty?.target ?? 0), 0))
  const sub =
    card.sub && subRows
      ? (() => {
          const subDue = subRows.filter((r) => r.status !== 'excluded' && r.planDate !== null && r.planDate <= asOf)
          return { ...card.sub, targetCount: subDue.length, doneCount: subDue.filter((r) => r.status === 'done').length }
        })()
      : card.sub
  return {
    ...card,
    targetCount,
    doneCount,
    inProgressCount: sumUnits('inProgress'),
    notDueCount: sumUnits('notDue'),
    excludedCount: 0,
    targetQty,
    doneQty,
    rate: targetQty === 0 ? null : Math.round((doneQty / targetQty) * 1000) / 10,
    countRate: targetCount === 0 ? null : Math.round((doneCount / targetCount) * 1000) / 10,
    ...(sub && { sub }),
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/* ── 종합 · 레거시 정산의 계획일 기준 ─────────────────────────────── */

/** 절단 완료 계획일이 기준일까지 온 도면(미대상 제외) — 판별 실적의 계획 도래분 */
export function dueAnchors(anchors: readonly FabAnchorDetail[], asOf: string): FabAnchorDetail[] {
  return anchors.filter((a) => !a.excluded && a.cpPlan.CUT_DONE !== undefined && a.cpPlan.CUT_DONE <= asOf)
}

/** 계획 완료일(planFd)이 기준일까지 온 W/O(미대상 제외) — 레거시 정산의 계획 도래분 */
export function dueWorkOrders(workOrders: readonly FabWorkOrder[], asOf: string): FabWorkOrder[] {
  return workOrders.filter((w) => !w.excluded && w.planFd !== null && w.planFd <= asOf)
}

/**
 * 종합 · 레거시 정산을 **계획일 기준**으로(사용자 확정: 계획일 기준 옵션이면 종합도 그 기준).
 *  - 판별 실적 = 계획 도래 도면 중 절단 완료한 도면 시수 ÷ 계획 도래 도면 시수
 *  - 레거시 정산 = 계획 도래 W/O 의 Σ(계획 시수 × 정산 진도율) ÷ Σ 계획 시수
 * 계획 도래분이 없으면 null(—).
 */
export function planBasisOverall(
  overall: FabStageSummary['overall'],
  anchors: readonly FabAnchorDetail[],
  workOrders: readonly FabWorkOrder[],
  asOf: string
): FabStageSummary['overall'] {
  const dwg = dueAnchors(anchors, asOf)
  const dwgMh = dwg.reduce((n, a) => n + (a.plannedQty ?? 0), 0)
  const doneMh = dwg
    .filter((a) => a.cpHistory.some((h) => h.cp === 'CUT_DONE'))
    .reduce((n, a) => n + (a.plannedQty ?? 0), 0)
  const wos = dueWorkOrders(workOrders, asOf)
  const woMh = wos.reduce((n, w) => n + w.planMh, 0)
  const settled = wos.reduce((n, w) => n + w.planMh * w.accRate, 0)
  return {
    ...overall,
    autoPct: dwgMh === 0 ? null : Math.round((doneMh / dwgMh) * 1000) / 10,
    legacyPct: woMh === 0 ? null : Math.round((settled / woMh) * 10) / 10,
  }
}
