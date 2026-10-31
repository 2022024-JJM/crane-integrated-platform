/**
 * 가공 권역 OT API v1.0 응답 형 (IPCS-312 「가공 권역 OT API 명세 v1.0」 초안, 2026-10-28).
 *
 * 서버가 내보내는 JSON 을 **이름 그대로** 옮긴 것이다 — 화면 형(`../model/fabCheckpoints`)으로
 * 바꾸는 일은 어댑터 한 곳이 한다. 명세가 바뀌면 이 파일과 어댑터만 고친다.
 * 화면이 읽는 엔드포인트만 둔다: B2 · B4 · B5 · C2. 나머지(A1~A4 · B1 · B3 · C1 · C3~C5 · D1 · D2)는
 * 가공 탭이 아직 부르지 않는다.
 *
 * ⚠️ 명세는 초안이다 — 인증(결정 6) · cp_stats 모양(결정 5) · 절점 정본(결정 2)이 미정이다.
 */

/** 목록 봉투 (명세 §3) */
export interface FabPage<T> {
  items: T[]
  page: { number: number; size: number; totalElements: number; totalPages: number }
  /** asOf 를 받는 목록만 */
  asOfUsed?: string
}

/** Hot DB m_code CHECKPOINT (가공 attrs.phase ∈ STOCK · CUT) — 명세 §9 */
export type FabCheckpointCode =
  | 'STEEL_IN'
  | 'PICK1'
  | 'PICK2'
  | 'STEEL_ISSUE'
  | 'PRETREAT'
  | 'MARK_DONE'
  | 'CUT_DONE'
  | 'BEND_DONE'
  | 'GROUP'
  | 'PART_ISSUE'
  /** 사상 — in_scope = false(보류). includeHeld=true 일 때만 온다 */
  | 'GRIND'

/** 분모 축 — 강재 · 도면 · 부재 */
export type FabCheckpointBasis = 'MAT' | 'DWG' | 'PART'
/** 가중 — kg · 시수 · 개수. 세 구간 퍼센트는 섞지 않는다 */
export type FabCheckpointWeight = 'WEIGHT' | 'MH' | 'COUNT'

/** C2 한 항목 — 「가공권역 단계별 실적률」 카드 한 장 */
export interface FabCheckpointStat {
  code: FabCheckpointCode
  seq: number
  name: string
  phase: 'STOCK' | 'CUT'
  basis: FabCheckpointBasis
  weight: FabCheckpointWeight
  /** 표시 단위 — kg · MH · 개 */
  unit: string
  inScope: boolean
  targetCnt: number
  doneCnt: number
  inProgressCnt: number
  notDueCnt: number
  excludedCnt: number
  targetQty: number
  doneQty: number
  /** ★주지표. doneQty ÷ targetQty × 100, 소수 1자리. 분모 0이면 null */
  doneRate: number | null
  /** doneCnt ÷ targetCnt × 100 */
  countRate: number | null
  planDate: string | null
  passed: boolean
  inProgress: boolean
  delayed: boolean
  /** 원천 확정 대기 — 화면 칩 */
  pendingSource: boolean
  /** STEEL_IN 만 */
  steelLayers?: { secured: number; shortage: number; overdue: number; arrived: number | null } | null
}

/** C2 GET /fab/progress/blocks/{hullNo}/{blockNo}/checkpoints */
export interface FabBlockCheckpoints {
  hullNo: string
  blockNo: string
  asOfUsed: string
  overall: {
    /** 판별 실적% — 완료 도면 시수 ÷ 대상 도면 시수 (TRADE_RULE C) */
    autoPct: number | null
    /** 411M 정산 진도율 롤업 */
    legacyPct: number | null
    /** 기준일까지 계획일이 온 절점 ÷ 절점 수 */
    planPct: number
    basis: 'DWG_MH'
    doneCp: 'CUT_DONE'
  }
  checkpoints: FabCheckpointStat[]
}

/** 적재 추적 열 — 모든 적재표 행에 붙는다 */
export interface FabLoadTrace {
  mntTs: string | null
  srcJob: string | null
  polledAt: string | null
  srcDeletedAt?: string | null
}

/** B4 GET /fab/events — 수집 현황 그리드 한 줄 */
export interface FabEvent extends FabLoadTrace {
  /** {unitId}|{eventCode}|{source}|{eventTs} — 하위 데이터 조회 키 */
  eventId: string
  origin: 'L_EVENT' | 'L_CUT_PART'
  unitType: 'DWG' | 'PART'
  unitId: string
  dwgNo: string
  hullNo: string
  blockNo: string
  eventGroup: 'CHECKPOINT' | 'EVENT'
  eventCode: string
  eventName: string
  seq: number
  basis: FabCheckpointBasis
  /** 310M · WO_CT · 140M · SSY · 111M · 301M · PART · ASSY_WO · 100M */
  source: string
  /** ISO 8601 +09:00 — 날짜만 있는 원천은 0시 */
  eventTs: string
  /** 시각이 원천에 있는지. false 면 화면이 HH:mm 을 숨긴다 */
  hasTime: boolean
  conf: 'HIGH' | 'MID' | 'LOW' | null
  srcValue: string | null
  /** 같은 도면 · 절점에 OPEN 알림이 있으면 true */
  flagged: boolean
}

/** B1 Drawing — 가공 앵커(절단 도면) */
export interface FabDrawing extends FabLoadTrace {
  dwgNo: string
  hullNo: string
  blockNo: string
  dwgSeries: string
  site: 'IN' | 'OUT'
  cutPlanDate: string | null
  cutCmpPlanDate: string | null
  actlSd: string | null
  actlFd: string | null
  targetMh: number
  targetBasis: string
  cutBay: string | null
  cnfCutBay: string | null
  /** '' 미착수 · 1 진행 · 2 완료 */
  cutStatus: '' | '1' | '2'
  markStatus: '' | '1' | '2'
  dwgStus: string | null
  pgmId: string | null
  woCount: number
  excluded: boolean
  excludeReason: 'DWG_D' | 'SSYW' | 'TBAR' | null
}

/** B3 WorkOrder (B2 에 딸려 온다) */
export interface FabWorkOrder extends FabLoadTrace {
  woNo: string
  dwgNo: string | null
  actNo: string
  /** CM 마킹 · CT 절단 · BD 곡 · PR · DB · GR(자동분배) */
  stepCode: string
  hullNo: string
  blockNo: string
  mp: string
  locationId: string
  site: 'IN' | 'OUT'
  planMh: number
  accRate: number
  planSd: string | null
  planFd: string | null
  actlSd: string | null
  actlFd: string | null
  autoDist: boolean
  excluded: boolean
  excludeReason: string | null
}

/** B2 GET /fab/drawings/{dwgNo} — 「하위 데이터」(도면 단위) */
export interface FabDrawingDetail {
  drawing: FabDrawing
  workOrders: FabWorkOrder[]
  events: FabEvent[]
  parts: {
    total: number
    weightKg: number
    bendTarget: number
    bendDone: number
    grouped: number
    issued: number
    inbound: number
    grindDone: number
  }
}

/** B5 GET /fab/parts — 부재 1개 (l_cut_part) */
export interface FabCutPart extends FabLoadTrace {
  partNo: string
  hullNo: string
  blockNo: string
  dwgNo: string | null
  destWstg: string | null
  cutSite: 'IN' | 'OUT' | null
  weightKg: number | null
  cutReqQty: number | null
  bendFlag: boolean | null
  grindFlag: boolean | null
  cutDoneTs: string | null
  bendDoneTs: string | null
  groupTs: string | null
  /** 355M 복원 전이라 비어 있다 */
  sortTs: string | null
  issueTs: string | null
  inboundTs: string | null
  grindDoneTs: string | null
  /** ASSY_WO(대체: 송선 조립 W/O 착수일) · 100M */
  issueSrc: string | null
}

/** 도면 1장의 한 절점 집계 — p_progress.cp_stats[code] (명세 C2 예시 모양, 결정 5 미확정) */
export interface FabCpStat {
  target: number
  done: number
  inProgress?: number
  notDue?: number
  excluded?: number
  targetQty: number
  doneQty: number
  /** STEEL_IN 만 */
  layers?: { secured: number; shortage: number; overdue: number; arrived: number | null }
}

/** C3 GET /fab/progress/anchors — 도면 판정 한 행 (p_progress, anchor_type DWG) */
export interface FabAnchor {
  anchorId: string
  anchorType: 'DWG'
  hullNo: string
  blockNo: string
  asOf: string
  state: 'notDue' | 'inProgress' | 'done' | 'confirmed' | 'held'
  autoPct: number | null
  legacyPct: number | null
  gapPct: number | null
  gapAlert: boolean
  plannedQty: number | null
  doneQty: number | null
  weightMh: number | null
  lastCp: string | null
  lateCpCnt: number | null
  site: 'IN' | 'OUT'
  excluded: boolean
  excludeReason: string | null
  locationId: string | null
  firstDetectTs: string | null
  lastDetectTs: string | null
  matchState: string | null
  matchWoNo: string | null
  confirmedBy: number | null
  judgedAt: string
}

/** C4 GET /fab/progress/anchors/{anchorId} — 도면 판정 + 근거 */
export interface FabAnchorDetail extends FabAnchor {
  cpStats: Record<string, FabCpStat>
  /** 절점별 계획일 */
  cpPlan: Record<string, string>
  /** 절점 도달 시각 · 원천 */
  cpHistory: { cp: string; ts: string; source: string }[]
  evidence: Record<string, unknown>
  events: FabEvent[]
  actions: unknown[]
  history: { asOf: string; state: string; autoPct: number | null }[]
}
