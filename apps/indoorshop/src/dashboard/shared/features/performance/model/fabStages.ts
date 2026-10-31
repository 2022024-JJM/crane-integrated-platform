import type { EventInstant, FabStageId, StageStatus } from './types'

/**
 * 가공 탭 「가공권역 단계별 실적률」 카드의 화면 형 — 가공 OT API v1.0 C2 를 따른다.
 *
 * 절점 축은 화면 정본 **S1~S10 그대로**다(사용자 확정). Hot DB 절점 코드와의 맞춤은
 * `FAB_STAGE_CHECKPOINT` 한 곳에서 한다(명세 §9).
 *
 * 실적률은 **절점마다 분모 단위가 다르다**(사용자 확정) — 강재 절점은 kg, 도면 절점은 시수(MH),
 * 부재 절점은 개수다. 세 단위를 한 숫자로 섞지 않으므로 카드는 자기 단위를 함께 적는다.
 * 통합실적(`StageAggregate`, 부재 중량 기준)과는 다른 형이다 — 통합실적은 아직 그 목업을 쓴다.
 */

/** 분모 축 — 강재 · 도면 · 부재 */
export type FabStageBasis = 'MAT' | 'DWG' | 'PART'
/** 실적률의 가중 — kg · 시수 · 개수 */
export type FabStageMeasure = 'WEIGHT' | 'MH' | 'COUNT'

/**
 * 화면 절점 → Hot DB 절점 코드 (명세 §9).
 *  - S5 가공 입고: Hot DB 에 없다(불출과 같은 사건이라 따로 두지 않았다) → null
 *  - S7 절단: 완료(`CUT_DONE`)를 실적으로 센다. 착수(`MARK_DONE`)는 수집 현황의 '진행' 행으로만 선다
 *  - S8 사상: `GRIND` 는 보류 절점(in_scope = false)이라 `includeHeld=true` 로 받는다
 *  - 곡가공(`BEND_DONE`)은 화면 절점이 아니다 — S7 카드의 보조 줄로만 선다(`FAB_STAGE_SUB_CHECKPOINT`)
 */
export const FAB_STAGE_CHECKPOINT: Record<FabStageId, string | null> = {
  S1: 'STEEL_IN',
  S2: 'PICK1',
  S3: 'PICK2',
  S4: 'STEEL_ISSUE',
  S5: null,
  S6: 'PRETREAT',
  S7: 'CUT_DONE',
  S8: 'GRIND',
  S9: 'GROUP',
  S10: 'PART_ISSUE',
}

/**
 * 화면 절점 카드 안에 **보조 줄**로 세우는 Hot DB 절점 (명세 §9 「절단 아래 보조 줄 제안」).
 * 곡가공(`BEND_DONE`)은 화면 정본 절점이 아니지만 절단 뒤 부재 단위로 실제로 일어난다 —
 * 그래서 S7 절단 카드 안에 "곡가공 완료 n/m" 한 줄로 적는다. 실적률 · 수집 현황에는 넣지 않는다.
 */
export const FAB_STAGE_SUB_CHECKPOINT: Partial<Record<FabStageId, string>> = {
  S7: 'BEND_DONE',
}

/** 실적률 기준 — 전체 대비(대상 전체) / 계획일 기준(기준일까지 계획일이 온 대상만) */
export type FabRateBasis = 'all' | 'plan'

export interface FabStageCard {
  stage: FabStageId
  /** Hot DB 절점 코드 — null 이면 그 절점이 Hot DB 에 없다(S5) */
  code: string | null
  basis: FabStageBasis | null
  measure: FabStageMeasure | null
  /** 표시 단위 — kg · MH · 개 */
  unit: string
  /** 보류 절점(in_scope = false) */
  held: boolean
  /** 원천 확정 대기 — 서버가 준다 */
  pendingSource: boolean
  targetCount: number
  doneCount: number
  inProgressCount: number
  notDueCount: number
  /** 분모 제외 (T-BAR · 사외 도면의 적치 절점 …) */
  excludedCount: number
  targetQty: number
  doneQty: number
  /** 실적률 ★주지표 — 이 절점의 단위로 센 값. 분모 0 이면 null */
  rate: number | null
  /** 건수 실적률 */
  countRate: number | null
  planDate: string | null
  delayed: boolean
  /** S1 강재 입고만 — 확보 · 결품 · 반입예정 경과 (C2 steelLayers) */
  steelLayers?: { secured: number; shortage: number; overdue: number; arrived: number | null } | null
  /** 보조 줄 (`FAB_STAGE_SUB_CHECKPOINT`) — 그 절점이 응답에 있을 때만 */
  sub?: { code: string; name: string; doneCount: number; targetCount: number }
}

export interface FabStageSummary {
  /** 판별이 실제로 있던 날 (그날 판별이 없으면 그 이전 가장 늦은 날) */
  asOfUsed: string
  overall: {
    /** 판별 실적% — 절단 완료 도면 시수 ÷ 대상 도면 시수 */
    autoPct: number | null
    /** 레거시(411M) 정산 진도율 */
    legacyPct: number | null
    /** 계획% — 기준일까지 계획일이 온 화면 절점 ÷ 화면 절점 수 (S1~S10 중 Hot DB 절점이 있는 9개) */
    planPct: number
  }
  stages: FabStageCard[]
}

/**
 * 절점 세부 — 절점 카드를 누르면 뜨는 창의 한 줄.
 * 강재 · 도면 절점(S1~S4 · S6 · S7)은 **도면** 한 줄(C3 · C4), 부재 절점(S8~S10)은 **부재** 한 줄(B5)이다.
 * 강재 절점도 Hot DB 에 강판 단위 행이 없어 도면 단위까지만 내려간다(명세 §8) — 강판은 장 수로만 적는다.
 */
export interface FabStageDetailRow {
  /** 도면번호 또는 부재번호 */
  id: string
  unitType: 'DWG' | 'PART'
  dwgNo: string
  site: 'IN' | 'OUT'
  status: StageStatus
  planDate: string | null
  /** 이 절점에 도달한 일시 (원천에 시각이 없으면 날짜만) */
  actual: EventInstant | null
  source: string | null
  /** 강판 장 수 (강재 절점만) */
  units: { done: number; target: number } | null
  /** 실적률을 센 양 — 강재 kg · 도면 MH. 부재는 그 부재 중량(kg) */
  qty: { done: number; target: number } | null
  delayed: boolean
  /** 미대상 사유 · 사외 적치 해당 없음 등 */
  note: string | null
}

export interface FabStageDetail {
  stage: FabStageId
  /** 이 절점의 카드 값 — 창 위 요약 줄이 카드와 같은 숫자를 다시 적는다 */
  card: FabStageCard | null
  code: string | null
  basis: FabStageBasis | null
  unit: string
  asOf: string
  rows: FabStageDetailRow[]
  /** S1 강재 입고만 — 확보 · 결품 · 반입예정 경과 장 수 (도착은 원천 대기라 null) */
  steelLayers: { secured: number; shortage: number; overdue: number; arrived: number | null } | null
  /**
   * 보조 절점의 세부 줄 (`FAB_STAGE_SUB_CHECKPOINT` — S7 아래 곡가공). 카드의 보조 줄 숫자를 부재 단위로 편다.
   * 대상(곡가공 대상 부재)만 줄이 선다.
   */
  sub?: { code: string; name: string; rows: FabStageDetailRow[] }
}

/**
 * 종합 카드의 **근거** — 종합을 누르면 뜨는 창. 세 수치가 각각 무엇을 어떻게 셌는지 줄로 보여 준다.
 *  - 판별 실적 = 절단 완료(CUT_DONE) 도면 시수 ÷ 대상 도면 시수 (도면 줄, C3)
 *  - 레거시 정산 = 가공 W/O 정산 진도율의 시수 가중 평균 (W/O 줄, B3)
 *  - 계획 = 기준일까지 계획일이 온 화면 절점 ÷ 화면 절점 (절점 줄, C2)
 */
export interface FabOverallBasis {
  /** 근거 줄을 어느 기준으로 골랐나 — 'plan' 이면 계획 도래분만 */
  basis: FabRateBasis
  asOf: string
  overall: FabStageSummary['overall']
  drawings: {
    dwgNo: string
    site: 'IN' | 'OUT'
    /** 미대상이면 사유 — 분모에서 빠진다 */
    excludedReason: string | null
    targetMh: number
    cutDone: EventInstant | null
    doneMh: number
  }[]
  workOrders: {
    woNo: string
    dwgNo: string | null
    stepCode: string
    planMh: number
    accRate: number
    excluded: boolean
  }[]
  plan: { stage: FabStageId; code: string | null; planDate: string | null; due: boolean }[]
}
