/**
 * 가공 판별 대시보드 읽기 모델 — ot-pipeline-fabrication 의
 * `FabricationDashboardView` (domain/dashboard) 와 1:1 로 맞춘다.
 *
 * 필드 이름이 레거시 컬럼(sty01c.acpt_date 등)을 그대로 따르는 것은 의도다 —
 * 화면에서 "어느 컬럼이 판별 근거인가"를 그대로 읽히게 하기 위해서다.
 */

/** ISO-8601 문자열 (백엔드 Instant) */
export type IsoInstant = string
/** yyyy-MM-dd (백엔드 LocalDate) */
export type IsoDate = string

export type TrackingObjectType = 'ROLL' | 'PART' | 'UNKNOWN'

export type Checkpoint = 'RECEIVING' | 'FIRST_PICK' | 'SECOND_PICK' | 'ISSUE' | 'CUTTING' | 'UNKNOWN'

export interface StateInfo {
  stateId: string
  name: string
  terminal: boolean
}

export interface Watermark {
  sourceTable: string
  lastPolledAt: IsoInstant | null
  updatedAt: IsoInstant | null
}

export interface MirrorTableStat {
  table: string
  rowCount: number
  lastUpdatedAt: IsoInstant | null
}

export interface DashboardSummary {
  checkpointCounts: Record<string, number>
  stateCounts: Record<string, number>
  rollCount: number
  partCount: number
  emergencyIssueCount: number
  lastJudgedAt: IsoInstant | null
  states: StateInfo[]
  watermarks: Watermark[]
  mirrorTables: MirrorTableStat[]
}

export interface JudgmentRow {
  id: number
  eventId: string
  checkpoint: Checkpoint | string
  trackingObjectType: TrackingObjectType
  trackingObjectId: string
  eventType: string
  fromStateId: string | null
  stateId: string
  terminal: boolean
  occurredAt: IsoInstant
  judgedAt: IsoInstant
  sourceTable: string | null
  sourceRef: string | null
  attributes: Record<string, string>
}

export interface RollMirror {
  rollNo: string
  matCode: string | null
  dwgNo: string | null
  stus: string
  bay: string | null
  cutMchNo: string | null
  issPlnDate: IsoInstant | null
  acptDate: IsoInstant | null
  frstPickActlDate1: IsoInstant | null
  scndPickActlDate: IsoInstant | null
  issActlDate: IsoInstant | null
  issueConfirmed: boolean
  emergency: boolean
  ingestedAt: IsoInstant | null
  updatedAt: IsoInstant | null
}

export interface RollProgress {
  mirror: RollMirror
  /** 판별 서비스가 기록한 현재 상태 — 아직 판별 전이면 null */
  judgedStateId: string | null
  judgedAt: IsoInstant | null
  /** 미러 일시 컬럼만으로 도달했어야 할 상태 — 등록만 된 ROLL 이면 null */
  mirrorStageId: string | null
  /** 기반 데이터와 판별 결과가 어긋남 (폴링 대기 또는 절점 순서 위반 폐기) */
  gap: boolean
}

export interface PickOrder {
  workClsf: string
  prcsClsf: string | null
  dwgNo: string | null
  projNo: string | null
  blkNo: string | null
  cutMchNo: string | null
  issPlnDate: IsoInstant | null
  pickSerNo: string | null
  updatedAt: IsoInstant | null
}

export interface IssueOrder {
  issClsf: string | null
  prcsClsf: string | null
  cutMchNo: string | null
  issPlnDate: IsoInstant | null
  updatedAt: IsoInstant | null
}

export interface WorkHistory {
  id: number
  workOrdNo: string | null
  eqpClsf: string | null
  ptnClsf: string
  fromAddr: string | null
  toAddr: string | null
  startDate: IsoInstant | null
  endDate: IsoInstant | null
  /** 이적(H%, 2번째 자리 5) — 판별에서 제외된 노이즈 행 */
  excluded: boolean
}

export interface RollTrace {
  roll: RollProgress
  pickOrders: PickOrder[]
  issueOrder: IssueOrder | null
  history: WorkHistory[]
  judgments: JudgmentRow[]
}

export interface CutMirror {
  mandt: string
  cutBayNo: string
  cutMchCode: string
  dwgNo: string
  cutMfgFd: IsoDate | null
  prcsStusCode: string | null
  updatedAt: IsoInstant | null
}

export interface CutProgress {
  cut: CutMirror
  bomPartCount: number
  judgedPartCount: number
}

export interface PartJudgment {
  partNo: string
  cutReqQty: number
  judgment: JudgmentRow | null
}

export interface CutTrace {
  cut: CutProgress
  parts: PartJudgment[]
}

/** 대시보드 한 화면이 한 번에 받는 묶음 — 갱신 주기마다 같이 다시 읽는다 */
export interface DashboardSnapshot {
  summary: DashboardSummary
  judgments: JudgmentRow[]
  rolls: RollProgress[]
  cuts: CutProgress[]
  fetchedAt: Date
}
