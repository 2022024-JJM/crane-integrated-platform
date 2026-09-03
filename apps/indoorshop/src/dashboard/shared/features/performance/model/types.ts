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
 *   도장 = S/P → T/UP → FINAL (스텝 축 = ELMT_ITEM_CODE, 실데이터 유도)
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
 * ── 도장 (W3-2 · W5-8) — 스텝이 곧 절점이다: S/P → T/UP → FINAL 순차 통과.
 * 근거는 도장 3테이블 구조 — YPWP720M(블록×공종×차수 W/O 계획) → YPWP710M(일일
 * 실적) → YPWG221M(확정, CNFM_INDC='B' 관문). 명세는 SE12 검증으로 확정됐고, 스텝 축은
 * YPWP720M 실데이터 3,996행 유도로 ELMT_ITEM_CODE 임이 밝혀졌다(PNT_SEQ 아님) —
 * 매핑은 api/paintingStepMapping.ts 한 곳에만 둔다.
 * 위치/블록 귀속은 BTS 물류 기반(반입/반출·도장공장 지번 경유) — ZONE 대응표 불신.
 *
 * **스텝 모델은 고정 사다리가 아니라 존재 기반(existence-based)이다** (사용자 확정,
 * 2026-09-03). 실데이터에서 스프레이(S/P)는 블록마다 1~6회로 갈리고 T/UP 구성도 다르다
 * (`U1` 만 / `U1`+`U2`), RE-S/P(`R0`)는 이벤트성이라 계획에 있을 때만 존재한다. 따라서:
 *  - 한 블록의 스텝 목록은 **그 블록에 실제 계획된 스텝만**이다 — 계획 없는 스텝은 세지 않는다
 *  - 스텝의 분모는 **그 스텝으로 분류된 계획 행 집합**이다 (회차·존·내외 분산 포함)
 *  - **스텝 완료 = 그 계획 행 전량 완료**, 진행률 = 완료 행 ÷ 계획 행
 * 집계는 model/aggregate.ts 의 `buildPaintingSteps` 한 곳에서만 한다.
 *
 * 존(PNT_ZONE_CODE)별로 쪼개지 않고 스텝 하나로 통합 관리한다 — 데이터 근거(행이 존·
 * 내외로 흩어져 행 단위 절점이 서지 않음)와 현업 합의(2026-09-03 회의)가 같은 결론이다.
 * 실적 등록은 **하루 1회 일괄**이라 분·시간 단위 갱신을 가정하지 않는다(일자 단위 SD/FD).
 */
export type PaintingStepId = 'SP' | 'TUP' | 'FINAL'

export const PAINTING_STEPS: readonly PaintingStepId[] = ['SP', 'TUP', 'FINAL']

/** 도장 이벤트 그리드의 단계 코드 — 조립 'ASM' 과 같은 문법 */
export type PntGridStage = 'PNT'

/** BTS 물류 기준의 블록 도장 국면 — 반입 전 / 도장공장 재실 / 반출(후속 공정) */
export type PaintingPhase = 'beforeIn' | 'inShop' | 'shippedOut'

/**
 * 스텝 하나의 **계획**. 블록마다 구성이 달라지는 부분이 전부 여기 담긴다 —
 * `plannedRows` 가 0 이면 그 블록에 그 스텝이 **없다**(집계에서 빠진다).
 */
/**
 * 계획 행 하나의 **진행률 재료** — 면적(가중치)과 그 행의 공정률.
 *
 * 공정률은 완료 행 100, 진행 중 행 `YPWG413M` 최신 `DLY_PRGS_RATE`, 미착수 행 0 이다.
 * 가중치로 `WORK_PLC_AREA`(작업면적)를 쓰는 근거는 dataflow §3.5 — `STD_MH` 는 실데이터
 * 결측이 30.4% 라 가중에 쓰면 그 행이 분모에서 사라진다.
 */
export interface PaintingProgressRow {
  /** YPWP720M.WORK_PLC_AREA — 작업면적(㎡). 가중치 */
  areaSqm: number
  /** 이 행의 공정률 0~100 */
  progressPct: number
}

/**
 * 일일공정률(YPWG413M) 이력의 한 점 — 등록일과 그날의 누적 공정률.
 *
 * 카드가 진행 중 스텝의 **추이**를 그릴 때 쓴다. 등록이 하루 1회 일괄이라 점 사이는
 * 하루 간격이고, 가장 최근 점이 곧 `progressAsOf`·`progressPct` 의 근거다.
 */
export interface PaintingProgressPoint {
  /** ACTL_DATE */
  date: string
  /** DLY_PRGS_RATE (누적, 0~100) */
  rate: number
}

export interface PaintingStepPlan {
  step: PaintingStepId
  /** 이 블록에서 이 스텝을 이루는 요소코드 — S/P 는 S1~S6 중 실제 계획된 것만 */
  elmtItemCodes: readonly string[]
  /** YPWP720M 계획 행 수 — 분모 (회차 × 존 × 내외로 흩어진다) */
  plannedRows: number
  /** FD_ACTL 이 찍힌 행 수 — 분자 */
  doneRows: number
  /** 이 스텝의 대표 W/O (실데이터의 W/O 는 스텝 1:1 이 아니다 — 화면 표기용 대표값) */
  woNo: string
  /** SD_ACTL 최초 착수일 (미착수면 null) */
  startDate: string | null
  /** FD_ACTL 최종 완료일 — **전량 완료일 때만** 값이 선다 */
  endDate: string | null
  /** YPWG221M 확정 관문(CNFM_INDC='B') 통과 */
  confirmed: boolean
  /**
   * 진행률 재료 — 계획 행별 면적·공정률. 비거나 없으면 집계가 **행 완료율로 대체**한다
   * (413M 등록 전인 W/O 도 화면이 서야 한다).
   */
  progressRows?: readonly PaintingProgressRow[]
  /** 이 스텝 % 의 근거가 된 `YPWG413M` 최신 `ACTL_DATE` — 하루 1회 일괄이라 보통 '어제' */
  progressAsOf?: string | null
  /**
   * 일일공정률 이력 — 오래된 날부터. 진행 중 스텝에만 재료가 있고, 413M 등록 전이면 빈다.
   * 카드의 미니 추이선이 이 배열을 그린다(없으면 선을 세우지 않는다).
   */
  progressHistory?: readonly PaintingProgressPoint[]
}

export interface PaintingStepState {
  step: PaintingStepId
  status: 'done' | 'inProgress' | 'notDue'
  /** 이 스텝의 W/O (YPWP720M — 블록×공종×차수) */
  woNo: string
  /** 이 블록에서 이 스텝을 이루는 요소코드 (가변) */
  elmtItemCodes: readonly string[]
  /** 계획 행 수 = 분모 (존재 기반 — 항상 1 이상) */
  plannedRows: number
  /** 완료 행 수 = 분자 */
  doneRows: number
  /**
   * **진행률(%) — 참고 수치다.** 완료 판정(전량 완료)에는 쓰지 않는다.
   * 면적 가중 평균: Σ(행 면적 × 행 공정률) ÷ Σ(행 면적).
   */
  progressPct: number
  /** 그 % 를 만든 `YPWG413M` 최신 등록일 — 없으면 null(413M 등록 전) */
  progressAsOf: string | null
  /**
   * 일일공정률 이력 — 오래된 날부터, 단조 증가. 점이 둘 미만이면 추이가 아니므로
   * 화면은 선을 세우지 않는다(한 점짜리 '추이'는 추이가 아니다).
   */
  progressHistory: readonly PaintingProgressPoint[]
  /** SD_ACTL — 착수일 (미착수면 null) */
  startDate: string | null
  /** FD_ACTL — 완료일 (전량 완료 전에는 null) */
  endDate: string | null
  /** YPWG221M 확정 관문(CNFM_INDC='B') 통과 — done 이어도 확정 대기일 수 있다 */
  confirmed: boolean
}

export interface PaintingSummary {
  /** **그 블록에 계획된 스텝만** — 길이가 곧 분모다 (3 으로 고정되지 않는다) */
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
 * 매칭 캐스케이드 결과 (ASM-F04) — **우리 판별 실적에 레거시 W/O 를 붙인 결과**다.
 * 방향이 중요하다: 판별이 먼저 있고 W/O 를 찾아 붙이는 것이지, W/O 목록을 채워 나가는
 * 것이 아니다 (기능정의서 §3.3 매칭 캐스케이드).
 *
 *  - `matched`  — ① 하루치 확정 W/O 풀(YPWG411M)에서 찾음
 *  - `fallback` — ② 4주치 계획 풀(YPWS210V + 송선 5규칙 변환)로 확대해서 찾음.
 *                  선행/지연 표식이 붙는다 (ASM-F09)
 *  - `unmatched`— ③ 어느 풀에도 없음 = **인식 O / 레거시 X**. 노티 대상이며
 *                  **완료 처리 금지**다 (ASM-F10) — 판별이 다 됐어도 완료로 세지 않는다
 */
export type AssyMatchState = 'matched' | 'fallback' | 'unmatched'

/** 폴백 매칭 실적의 선행/지연 표식 (ASM-F09) */
export type AssyMatchFlag = 'early' | 'late'

export interface AssyMatch {
  state: AssyMatchState
  /** 붙은 W/O — `unmatched` 면 빈 배열이다(레거시에 대상이 없다) */
  wos: AssyWo[]
  /** 폴백일 때만 */
  flag: AssyMatchFlag | null
  /** 어느 풀에서 찾았나 — 화면 툴팁의 근거 문구 */
  poolLabel: string
}

/** ASSY 판별(자동수집) 상태 — 인식 수량이 분모를 채웠는가 */
export type AssyJudgeState = 'complete' | 'partial' | 'none'

/**
 * ASSY(조립품) 한 개 — 기준 추적축. 관리 화면 구조는 **ASSY 카드 ↔ W/O 리스트(1:N)**
 * (수집사이클 다이어그램 그대로)이며, 나열은 계층 순서(대조 루트 → 자식)다.
 *
 * **기준 축은 판별(자동수집)이다** (사용자 확정). 진척·완료 판정은 `recognizedQty`
 * (형상·수량 인식 결과)가 정하고, W/O 는 그 위에 붙는 **참고 주석**(`match`)이다.
 * 레거시 W/O 를 기준 축으로 삼으면 매칭 캐스케이드의 방향이 뒤집힌다.
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
  /**
   * 판별 분모 — ASSY_REQ_QTY (YDEH050M). 레거시 기준정보에서 오는 **계획값**이라
   * 비율을 말할 때는 "판별 실적 ÷ 계획(참고)"로 읽어야 한다.
   */
  reqQty: number
  /**
   * **인식(판별) 수량 — 이 ASSY 의 기준 축.** 정반×어셈블리 형상·수량 매칭 결과다
   * (ASM-F02). 실값은 OT 자동수집 소관이고, mock 은 이 값을 원천으로 만든 뒤
   * W/O 를 거기에 맞춰 붙인다 — 예전처럼 W/O 에서 파생하지 않는다.
   */
  recognizedQty: number
  /** 판별 상태 — 인식 수량이 분모를 채웠는가 */
  judged: AssyJudgeState
  /** 마지막 판별 일자 — 인식이 있었을 때만 */
  judgedDate: string | null
  /**
   * **자기 단독 실적률(%)** = `recognizedQty ÷ reqQty` (판별 기준 축, W5-7 그대로).
   * 하위를 섞지 않은 그 ASSY 한 덩이의 진척이다.
   */
  selfRate: number
  /**
   * **자기 + 모든 하위 합산 실적률(%)** — 대조를 "이 덩어리가 얼마나 됐나"로 읽는 값.
   * 소조는 하위가 없어 `selfRate` 와 같다. 대조·중조는 둘이 갈리므로 화면이 나눠 적는다.
   */
  rollupRate: number
  /** 롤업 분자 — 자기 + 하위 인식 수량 합 */
  rollupRecognizedQty: number
  /** 롤업 분모 — 자기 + 하위 계획(REQ_QTY) 합 */
  rollupReqQty: number
  /** 하위 ASSY 수 (자기 제외) — 0 이면 롤업과 단독이 같다는 뜻이라 화면이 하나만 적는다 */
  descendantCount: number
  /** 매칭 캐스케이드 결과 — W/O 는 여기 붙는 **참고 주석**이다 */
  match: AssyMatch
  /** 참고 — 붙은 W/O 수·완료 수 (`match.wos` 파생. 기준이 아니라 곁다리 수치다) */
  woTotal: number
  woDone: number
  /**
   * 완료 확정 — **판별 완료 + 매칭이 막지 않음 + 하위 ASSY 전량 완료**.
   * 불일치(ASM-F10)는 완료 처리를 금지하므로, 인식이 다 됐어도 여기서 걸린다.
   */
  done: boolean
  /** 판별은 끝났는데 매칭 불일치로 완료가 보류된 상태 — 화면이 그 사정을 말해야 한다 */
  blockedByMatch: boolean
}

/** 매칭 캐스케이드 결과 분포 — 카드 범례가 이 수를 그대로 낸다 */
export interface AssyMatchCounts {
  matched: number
  fallback: number
  /** 노티 대상 — 완료 처리 금지 */
  unmatched: number
}

export interface AssemblySummary {
  /** 블록의 ASSY 목록 — 부재→ASSY→블록 롤업의 중간 축 */
  assys: AssyUnit[]
  assyTotal: number
  /** **판별 완료** ASSY 수 — 인식이 분모를 채운 것 (매칭 여부와 무관한 우리 실적) */
  assyJudged: number
  /** **완료 확정** ASSY 수 — 판별 완료 중 매칭이 막지 않은 것 (assyJudged 이하) */
  assyDone: number
  /** 판별 인식 수량 합 — 기준 축의 분자 */
  recognizedQty: number
  /** 계획 분모 합 (REQ_QTY — 참고) */
  reqQtyTotal: number
  /** **종합 실적률 = 판별 실적 ÷ 계획(참고)** — 이 카드의 주지표 */
  judgedRate: number
  /** 참고 — 붙은 W/O 합계와 그 완료율. 기준이 아니다 */
  woTotal: number
  woDone: number
  woRate: number
  /** 매칭 캐스케이드 분포 */
  match: AssyMatchCounts
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
  /** ASSY 완료 확정 수 — 헤더의 조립 요약 줄이 쓴다 */
  assyDone: number
  /** 판별 완료 ASSY 수 — 매칭 전 우리 실적 */
  assyJudged: number
  /** 판별 인식 수량 / 계획 분모 (참고) — 헤더의 조립 주지표 */
  recognizedQty: number
  reqQtyTotal: number
  judgedRate: number
  /** 매칭 불일치 ASSY 수 — 0 이 아니면 헤더가 노티 배지를 세운다 */
  unmatchedCount: number
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
/**
 * 조립 이벤트 종류. `asmJudged` 가 **우리 수집의 원천 이벤트**(정반 LiDAR 형상·수량
 * 판별)이고, `woStart`/`woDone` 은 그 위에 매칭된 레거시 W/O 의 참고 행이다.
 */
export type AsmEventKind = 'asmJudged' | 'woStart' | 'woDone' | 'btsIn' | 'btsOut'

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
