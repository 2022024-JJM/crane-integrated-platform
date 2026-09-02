/**
 * 통합실적(IPD) 화면의 데이터 계약.
 *
 * 핵심 원칙 — **%는 수집 절점(節點) 기반으로만 만든다** (사용자 확정 D3).
 * 임의 합성 산식(계획·실적을 지어내는 롤업)은 두지 않는다. 각 공정의 절점:
 *   가공 = S1 반입 → S2 불출 → S3 절단 → S4 사상 → S5 팔레트편성 (1차 구현)
 *   조립 = A1 소조 → A2 중조 → A3 대조 → A4 검사장(G9G9) — 절점 % 는 **절점 귀속
 *          W/O 완료 n/m** 만 쓴다(L3 ✅ 항목). A4 통과의 근거는 BTS 검사장 이동
 *          (= 조립종료 절점, dataflow 근거)이다. '완성도(형상 %)'는 OT 자동수집
 *          소관이라 여기서 만들지 않는다 — 자리 문구만 둔다.
 *   도장 = S/P → T/UP → FINAL (준비중 — 스텝↔PNT_SEQ 매핑 확정 대기)
 *   의장 = **절점 없음** (설치 인식 단건 수집뿐 — 화면에 그대로 명시한다)
 */

/** 가공권역 5단계 절점 */
export type FabStageId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

export const FAB_STAGES: readonly FabStageId[] = ['S1', 'S2', 'S3', 'S4', 'S5']

/**
 * 조립은 절점(소조/중조/대조)이 아니라 **블록-ASSY 레벨**로 관리한다 (사용자 확정).
 * 소조/중조/대조는 ASSY 계층 관계(YDEH040M 부모추적)이지 통과 절점이 아니다 —
 * 기준 추적축은 ASSY_NO(PROJ-BLK-STRC+SER)이고, 실적은 부재→ASSY→블록→호선으로
 * 롤업한다. 이벤트 그리드에서 조립 행의 단계 표기는 코드 'ASM' 하나다.
 */
export type AsmGridStage = 'ASM'

/*
 * ── 도장 (W3-2) — 스텝이 곧 절점이다: S/P → T/UP → FINAL 순차 통과.
 * 근거는 도장 3테이블 구조 — YPWP720M(블록×공종×차수 W/O 계획) → YPWP710M(일일
 * 실적) → YPWG221M(확정, CNFM_INDC='B' 관문). 명세는 추정(SE12 검증 전)이라 화면이
 * 단서를 달고, 스텝↔레거시 키 매핑은 api/paintingStepMapping.ts 한 곳에만 둔다.
 * 위치/블록 귀속은 BTS 물류 기반(반입/반출·도장공장 지번 경유) — ZONE 대응표 불신.
 */
export type PaintingStepId = 'SP' | 'TUP' | 'FINAL'

export const PAINTING_STEPS: readonly PaintingStepId[] = ['SP', 'TUP', 'FINAL']

/** 도장 이벤트 그리드의 단계 코드 — 조립 'ASM' 과 같은 문법 */
export type PntGridStage = 'PNT'

/** BTS 물류 기준의 블록 도장 국면 — 반입 전 / 도장공장 재실 / 반출(후속 공정) */
export type PaintingPhase = 'beforeIn' | 'inShop' | 'shippedOut'

export interface PaintingStepState {
  step: PaintingStepId
  status: 'done' | 'inProgress' | 'notDue'
  /** 이 스텝의 W/O (YPWP720M — 블록×공종×차수) */
  woNo: string
  /** SD_ACTL — 착수일 (미착수면 null) */
  startDate: string | null
  /** FD_ACTL — 완료일 (미완료면 null) */
  endDate: string | null
  /** YPWG221M 확정 관문(CNFM_INDC='B') 통과 — done 이어도 확정 대기일 수 있다 */
  confirmed: boolean
}

export interface PaintingSummary {
  steps: PaintingStepState[]
  doneSteps: number
  confirmedSteps: number
  phase: PaintingPhase
  /** BTS 귀속 — 지금 이 블록이 서 있는 도장공장 (inShop 일 때만) */
  factory: string | null
  /** BTS 반입 일자 (검사장 → 도장공장) */
  btsInDate: string | null
  /** BTS 반출 일자 (도장공장 → 후속 공정) — shippedOut 일 때만 */
  btsOutDate: string | null
}

/**
 * 부재의 단계 상태 — IPD 정의서 §6.4 상태 구분 그대로.
 * excluded(미대상)는 건수·중량 **분모에서 제외**된다.
 */
export type StageStatus = 'done' | 'inProgress' | 'notDue' | 'excluded'

/** 공정 필터 (IPD-S01 조회 조건) */
export type ProcessFilter = 'all' | 'fabrication' | 'assembly' | 'outfitting' | 'painting'

/** 호선 — `7004호 (LNGC)` 표기용 */
export interface Vessel {
  projNo: string
  shipType: string
}

/** 블록 멀티선택 항목 — 공장 라벨은 야드 지도 공장명과 같은 체계(ASSY_SHOP) */
export interface BlockOption {
  blockNo: string
  factory: string
}

/**
 * 부재 1건 — 실적 집계의 모집단 단위 (실연동 시 MART_부재실적 행).
 * mock 도 이 구조로 생성해 IPD-S04 상태 규칙을 실제로 지킨다.
 */
export interface FabPart {
  partNo: string
  weightKg: number
  statuses: Record<FabStageId, StageStatus>
}

/** 단계 1개의 집계 (IPD-S04 카드 한 장) */
export interface StageAggregate {
  stage: FabStageId
  /** 대상 = 미대상 제외 분모 */
  targetCount: number
  doneCount: number
  inProgressCount: number
  notDueCount: number
  /** 미대상 — 분모 제외 건수 (화면에 '분모 제외'로 표기) */
  excludedCount: number
  targetWeightKg: number
  doneWeightKg: number
  /** 실적률(건수%) */
  countRate: number
  /** 실적률(중량%) ★주지표 */
  weightRate: number
}

export interface FabricationSummary {
  stages: StageAggregate[]
  /** 가공권역 종합 = 5단계 중량 실적률의 평균 (정의서 §8.5 산식 그대로) */
  overallWeightRate: number
}

/** 절점 1개의 통과·계획 상태 — 가공(S*) 전용 (조립은 절점이 아니라 ASSY 레벨) */
export interface ProcessNode {
  stage: FabStageId
  /** 절점 통과 = 대상 부재 전량 완료 (임의 임계 없음) */
  passed: boolean
  /** 통과 전이지만 착수한 부재가 있음 */
  inProgress: boolean
  /** 절점별 계획일 (YYYY-MM-DD) — 계획측 표시는 이 날짜 대비로만 한다 */
  planDate: string
  /** 계획일이 기준일 이전인데 미통과 → 지연 */
  delayed: boolean
}

/** 블록 헤더의 절점 진척 — 가공(S1~S5) 절점에서만 파생. 조립은 ASSY·W/O 요약으로 따로 선다 */
export interface BlockNodeProgress {
  nodes: ProcessNode[]
  /** 실적% = 가공권역 종합 중량가중 (절점 실적의 종합) */
  actualRate: number
  /** 계획% = 기준일까지 계획일이 도래한 절점의 비율 — 절점 기준임을 화면에 병기 */
  planRate: number
  delayedCount: number
}

/** 조립 W/O 의 실작업 종류 — ASSY 아래 1:N 으로 붙는다 (취부/용접/사상) */
export type AssyWoKind = 'fit' | 'weld' | 'grind'

export type AssyWoStatus = 'done' | 'inProgress' | 'notStarted'

/** ASSY 에 귀속된 작업지시(W/O) 한 건 — 관리 화면의 W/O 리스트 한 줄 */
export interface AssyWo {
  /** 작업지시 번호 (WO-#####) */
  woNo: string
  kind: AssyWoKind
  status: AssyWoStatus
  /** 완료일 (done 일 때만) */
  actualDate: string | null
}

/**
 * ASSY 급 — 대조/중조/소조는 통과 절점이 아니라 **계층 관계**다(YDEH040M 부모추적,
 * PRDT_PART_NO→CMPT_PART_NO 재귀). 급은 ASSY_STRC_CODE 로 표현한다: G=대조, M=중조, S=소조.
 */
export type AssyTier = 'grand' | 'mid' | 'sub'

/**
 * ASSY(조립품) 한 개 — 기준 추적축. 관리 화면 구조는 **ASSY 카드 ↔ W/O 리스트(1:N)**
 * (수집사이클 다이어그램 그대로)이며, 나열은 계층 순서(대조 루트 → 자식)다.
 */
export interface AssyUnit {
  /** ASSY_NO 조합식 — `PROJ-BLK-STRC+SER` (예: 7004-310-S03) */
  assyNo: string
  /** ASSY_STRC_CODE — 급 표현 (G/M/S) */
  strcCode: string
  /** ASSY_SER_NO (2자리) */
  serNo: string
  /** 급 — strcCode 와 1:1 (G=grand/M=mid/S=sub) */
  tier: AssyTier
  /** 부모 ASSY_NO — 대조 루트는 null (YDEH040M 부모추적의 mock 대응) */
  parentAssyNo: string | null
  /** 계층 깊이 — 대조 0 / 중조 1 / 소조 2 (렌더 들여쓰기용) */
  depth: number
  /** 카운팅 분모 — ASSY_REQ_QTY (YDEH050M) */
  reqQty: number
  /**
   * 인식(카운팅) 수 — 실값은 OT 자동수집 소관. mock 은 W/O 상태에서 파생하며
   * 화면이 '카운팅은 OT 가동 후' 단서를 단다.
   */
  countedQty: number
  /** 귀속 W/O — 1:N */
  wos: AssyWo[]
  woTotal: number
  woDone: number
  /** 귀속 W/O 전량 완료 */
  done: boolean
}

export interface AssemblySummary {
  /** 블록의 ASSY 목록 — 부재→ASSY→블록 롤업의 중간 축 */
  assys: AssyUnit[]
  assyTotal: number
  /** ASSY 완료 = 귀속 W/O 전량 완료 */
  assyDone: number
  /** 종합 W/O 완료 — ASSY 귀속 합계 */
  woTotal: number
  woDone: number
  /** 종합 % = woDone ÷ woTotal (W/O 완료 기준 — 합성 산식 아님) */
  overallRate: number
  /** 검사장(G9G9) 이동(BTS 반출) = 조립종료 — 블록 레벨 사실 */
  inspectionMoved: boolean
  inspectionDate: string | null
}

/** 블록 헤더 카드 */
export interface BlockSummary {
  projNo: string
  blockNo: string
  factory: string
  woTotal: number
  woDone: number
  /** 블록의 ASSY 수 — AssemblySummary.assyTotal 과 같은 수 (한 원천) */
  assyCount: number
  /** ASSY 완료 수 — 헤더의 조립 요약 줄이 쓴다 */
  assyDone: number
  /** 검사장 이동(BTS, 조립종료) 여부 — 블록 레벨 사실 */
  inspectionMoved: boolean
  /** 도장 스텝 완료 수(0~3) — 헤더의 도장 요약 줄이 쓴다 */
  pntDone: number
  /** 도장 국면(BTS 물류 기준) — 헤더 칩 */
  pntPhase: PaintingPhase
  /** HH:mm — 최근 수신 시각 */
  lastReceivedAt: string
  progress: BlockNodeProgress
}

/** 관리번호 형식 — 가공 4형식(MAT/DWG/PC/PLT, L3 확정) + 조립(ASSY/WO) */
export type MgmtNoType = 'MAT' | 'DWG' | 'PC' | 'PLT' | 'ASSY' | 'WO'

/** 조립 이벤트 종류 — W/O 착수·완료(작업지시 원천) / BTS 반입·반출(운반 실적) */
export type AsmEventKind = 'woStart' | 'woDone' | 'btsIn' | 'btsOut'

/**
 * 수집 시각 — S1·S4·S5 는 원천에 **일자만 존재**하므로 time 이 없다.
 * (L3 판정 — 시각 표기는 계약 위반이라 타입으로 막는다)
 */
export interface EventInstant {
  date: string
  /** HH:mm — S2·S3 만 존재 */
  time?: string
}

/** 도장 이벤트 종류 — 스텝 W/O 착수·완료 (BTS 반입·반출은 조립과 같은 kind 를 쓴다) */
export type PntEventKind = 'stepStart' | 'stepDone'

/** 수집 현황 그리드 행 (IPD-S01) */
export interface CollectionEvent {
  id: string
  blockNo: string
  /** 가공은 절점(S1~S5), 조립은 'ASM', 도장은 'PNT' — 하위 단계 표기는 쓰지 않는다 */
  stage: FabStageId | AsmGridStage | PntGridStage
  /** 조립·도장 행에만 — 이벤트 종류 라벨 (단계 셀에 병기) */
  kind?: AsmEventKind | PntEventKind
  mgmtNoType: MgmtNoType
  mgmtNo: string
  occurred: EventInstant | null
  completed: EventInstant | null
  status: StageStatus
  /** 원천 라벨 — 가공은 화면 번호(①~⑤), 조립·도장은 W/O·BTS */
  sources: string
  /** 적색 강조 — 확인 필요 */
  flagged: boolean
  /**
   * 맵 딥링크의 공장 키 (조립·도장 행만 — 가공 이벤트는 공장 소속이 없다).
   * `mapShopProcess` 의 맵 진입 화면으로 `?shop=<공장>` 이동한다. ⚠️ 맵 진입은 아직
   * `bay` 파라미터를 받지 않아 공장 포커스까지만 간다 (타 모듈 수정 금지 범위).
   */
  mapShop?: string
  /** 딥링크 목적지 공정 — 생략 시 assembly (기존 조립 행 호환) */
  mapShopProcess?: 'assembly' | 'painting'
}

/** 드릴다운 KV (IPD-S02) */
export interface EventDetail {
  eventId: string
  /** 관리 단위(축) — 강재(Roll)/도면/부재/팔레트 */
  unit: string
  entries: { label: string; value: string }[]
}
