import { blocksAtFactory, type RosterBlock } from '../../../shared/entities/vessel'
import { generatePaintingSteps } from '../../../shared/features/performance/api/performanceApi'
import {
  PAINTING_STEPS,
  type PaintingStepId,
  type PaintingStepState,
  type PaintingSummary,
} from '../../../shared/features/performance/model/types'
import { paintingFactoryIdOf } from './factoryRoutes'

/*
 * 도장 '수집 현황' 집계 — **화면이 소비할 모양으로 접기만** 한다.
 *
 * 도장 실적의 정본은 `shared/features/performance` 다: 스텝 절점(S/P → T/UP → FINAL)의
 * 존재·분모·완료 판정은 `generatePaintingSteps`/`buildPaintingSteps` 한 곳에서만 정해지고,
 * 일일공정률(YPWG413M) 도 그쪽이 만든다. 여기서 그 산식을 다시 쓰지 않는다 — 도장 공장
 * 하나에 귀속된 블록들을 모아 그 결과를 합칠 뿐이다(중복 구현 금지).
 *
 * 블록의 공장 귀속은 **로스터**(`blocksAtFactory` + zone==='painting')를 쓴다. 통합실적의
 * `PaintingSummary.factory` 도 같은 로스터를 근거로 서므로 둘은 같은 답을 말하고, 반출
 * (`shippedOut`)된 블록은 그쪽 factory 가 null 이 되는 것이 정상이다 — 그럴 때도 로스터가
 * 아직 그 공장에 적어 둔 동안은 목록에 남기고 국면(phase)으로 말한다.
 *
 * ⚠️ 시각을 인자로 받는다(`baseDate`). 여기서 `Date.now()` 를 부르면 같은 화면이 렌더마다
 * 다른 수치를 내고 테스트가 날짜에 묶인다.
 */

/** 블록 한 장 — 그 블록의 도장 스텝 실적과, 지금 진행 중인 스텝 */
export interface PaintingBlockCollection {
  projNo: string
  blockNo: string
  /** `{projNo}-{blockNo}` — 목록 key 이자 통합실적 조회 키 */
  key: string
  /** 지도 베이 이름 (로스터가 적어 둔 자리 — 없을 수 있다) */
  mapBay: string | null
  /** 갓 반입돼 스텝이 아직 안 선 블록 */
  justArrived: boolean
  summary: PaintingSummary
  /** 지금 진행 중인 스텝 — 없으면 null (반입 전·전량 완료) */
  activeStep: PaintingStepState | null
  /** 진행 중 스텝의 일일공정률(%) — 진행 중 스텝이 없으면 null */
  dailyProgressPct: number | null
  /** 그 % 의 근거가 된 YPWG413M 등록일 — 하루 1회 일괄이라 보통 '어제' */
  progressAsOf: string | null
}

/** 공장 한 곳의 수집 현황 — 우측 패널 한 칸과 공장 현황 화면이 같은 값을 읽는다 */
export interface PaintingFactoryCollection {
  factory: string
  blocks: PaintingBlockCollection[]
  blockCount: number
  /** 계획 W/O 건수 — 스텝별 대표 W/O 의 **고유** 개수 (실데이터는 1:1 이 아니다) */
  woCount: number
  /** 절점(스텝) 분모 — 이 공장 블록들에 실제로 계획된 스텝 수의 합 */
  stepsTotal: number
  /** 전량 완료된 스텝 수 */
  stepsDone: number
  /** YPWG221M 확정(CNFM_INDC='B') 통과한 스텝 수 */
  stepsConfirmed: number
  /** 진행 중 스텝이 있는 블록 수 */
  inProgressBlocks: number
  /** 지금 이 도장공장에 서 있는(반입 완료·미반출) 블록 수 — '감지' 줄의 분자 */
  inShopBlocks: number
  /**
   * 일일공정률(%) — 진행 중 스텝들의 **단순 평균**. 블록 간 면적 가중은 하지 않는다:
   * 가중은 스텝 안(계획 행 면적)에서 이미 끝났고, 여기서 다시 가중하면 큰 블록 하나가
   * 공장 수치를 삼킨다. 진행 중 스텝이 없으면 null (0% 로 적지 않는다).
   */
  dailyProgressPct: number | null
  /** 위 % 의 근거 중 **가장 최근** 등록일 */
  progressAsOf: string | null
}

/** 그 블록에서 지금 진행 중인 스텝 — 순차 절점이라 많아야 하나 */
export function activeStepOf(summary: PaintingSummary): PaintingStepState | null {
  return summary.steps.find((s) => s.status === 'inProgress') ?? null
}

/** 로스터 블록 한 장 → 수집 현황 한 줄 */
export function collectBlock(block: RosterBlock, baseDate: string): PaintingBlockCollection {
  const summary = generatePaintingSteps(block.projNo, block.blockNo, baseDate)
  const activeStep = activeStepOf(summary)
  return {
    projNo: block.projNo,
    blockNo: block.blockNo,
    key: `${block.projNo}-${block.blockNo}`,
    mapBay: block.mapBay ?? null,
    justArrived: block.justArrived === true,
    summary,
    activeStep,
    dailyProgressPct: activeStep ? activeStep.progressPct : null,
    progressAsOf: activeStep?.progressAsOf ?? null,
  }
}

/** 이 공장에 서 있는 도장 재공 블록 — 로스터 순서 그대로 */
export function paintingBlocksAt(factory: string): RosterBlock[] {
  return blocksAtFactory(factory).filter((b) => b.zone === 'painting')
}

/** 공장 한 곳의 수집 현황 */
export function paintingCollectionOf(
  factory: string,
  baseDate: string
): PaintingFactoryCollection {
  const blocks = paintingBlocksAt(factory).map((b) => collectBlock(b, baseDate))

  const woNos = new Set<string>()
  let stepsTotal = 0
  let stepsDone = 0
  let stepsConfirmed = 0
  let inProgressBlocks = 0
  let inShopBlocks = 0
  let progressSum = 0
  let progressCount = 0
  let progressAsOf: string | null = null

  for (const block of blocks) {
    stepsTotal += block.summary.steps.length
    stepsDone += block.summary.doneSteps
    stepsConfirmed += block.summary.confirmedSteps
    for (const step of block.summary.steps) woNos.add(step.woNo)
    if (block.summary.phase === 'inShop') inShopBlocks += 1
    if (block.activeStep) {
      inProgressBlocks += 1
      progressSum += block.activeStep.progressPct
      progressCount += 1
      const asOf = block.activeStep.progressAsOf
      if (asOf && (progressAsOf == null || asOf > progressAsOf)) progressAsOf = asOf
    }
  }

  return {
    factory,
    blocks,
    blockCount: blocks.length,
    woCount: woNos.size,
    stepsTotal,
    stepsDone,
    stepsConfirmed,
    inProgressBlocks,
    inShopBlocks,
    dailyProgressPct: progressCount > 0 ? Math.round(progressSum / progressCount) : null,
    progressAsOf,
  }
}

/**
 * 오늘(YYYY-MM-DD) — 통합실적 화면과 같은 잣대의 기준일.
 *
 * `toISOString()` 을 쓰지 않는다(UTC 로 밀려 한국 시간 오전에는 어제가 나온다).
 */
export function todayString(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/**
 * 스텝 축 롤업 — 공장 현황 화면의 '스텝 진행' 줄.
 *
 * 스텝은 블록마다 **있을 수도 없을 수도** 있다(존재 기반). 그래서 분모는 스텝 수가 아니라
 * **그 스텝을 계획한 블록 수**다 — 없는 스텝을 미착수로 세면 공장 전체가 늘 뒤처져 보인다.
 */
export interface PaintingStepRollup {
  step: PaintingStepId
  /** 이 스텝을 계획한 블록 수 = 분모 (0 이면 이 공장엔 그 스텝이 없다) */
  blocks: number
  /** 전량 완료한 블록 수 */
  done: number
  /** 진행 중인 블록 수 */
  inProgress: number
  /** 진행 중 블록들의 일일공정률 평균 — 진행 중이 없으면 null */
  progressPct: number | null
}

/** 공장 하나의 스텝별 롤업 — PAINTING_STEPS 순서(S/P → T/UP → FINAL) 그대로 */
export function paintingStepRollup(
  collection: PaintingFactoryCollection
): PaintingStepRollup[] {
  return PAINTING_STEPS.map((step) => {
    let blocks = 0
    let done = 0
    let inProgress = 0
    let pctSum = 0
    let pctCount = 0
    for (const block of collection.blocks) {
      const state = block.summary.steps.find((s) => s.step === step)
      if (!state) continue
      blocks += 1
      if (state.status === 'done') done += 1
      if (state.status === 'inProgress') {
        inProgress += 1
        pctSum += state.progressPct
        pctCount += 1
      }
    }
    return {
      step,
      blocks,
      done,
      inProgress,
      progressPct: pctCount > 0 ? Math.round(pctSum / pctCount) : null,
    }
  })
}

/* ══ 우측 패널의 구성 (W6-6) ═════════════════════════════════════
 *
 * 조립·의장과 같은 이유로 "무슨 줄이 어떤 순서로 서고 값이 무엇인가"를 컴포넌트 밖에
 * 둔다 — 규칙이 UI 안에 있으면 검증할 수 없다. 문구는 담지 않는다(키만).
 */

/** 수집 현황 한 줄 — 라벨은 번역 키, 값은 이미 센 결과 */
export interface CollectionRowSpec {
  labelKey: string
  value: string
}

/**
 * ②수집 현황의 줄.
 *
 * 조립·의장과 **바깥 두 줄이 같다** — 첫 줄이 '감지'(지금 몇을 잡고 있나), 마지막 줄이
 * '최근 수집'(그 값이 언제 것인가). 가운데가 공정마다 다른 것은 세는 대상이 다르기
 * 때문이다: 조립은 오늘 판별 건수, 의장은 완료 블록, 도장은 **W/O·스텝 절점·일일공정률**
 * 이다(도장의 실적 축은 절점이고 그 %는 하루 1회 일괄이라 날짜와 함께여야 뜻이 선다).
 */
export function paintingCollectionRows(
  collection: PaintingFactoryCollection
): CollectionRowSpec[] {
  return [
    {
      labelKey: 'painting.mapEntry.collection.detected',
      value: `${collection.inShopBlocks}/${collection.blockCount}`,
    },
    { labelKey: 'painting.mapEntry.collection.wo', value: String(collection.woCount) },
    {
      labelKey: 'painting.mapEntry.collection.steps',
      value: `${collection.stepsDone}/${collection.stepsTotal}`,
    },
    {
      labelKey: 'painting.mapEntry.collection.dailyRate',
      /* 진행 중 스텝이 없으면 0% 가 아니라 **없음**이다 — 0 으로 적으면 멈춘 것처럼 읽힌다 */
      value: collection.dailyProgressPct == null ? '—' : `${collection.dailyProgressPct}%`,
    },
    {
      labelKey: 'painting.mapEntry.collection.lastScan',
      /* 도장 실적은 하루 1회 일괄(YPWG413M)이라 '최근 수집'이 시각이 아니라 **일자**다 */
      value: collection.progressAsOf ?? '—',
    },
  ]
}

/** 수집 현황에서 공장 현황으로 나가는 경로 — 짝이 없는 공장은 null */
export function paintingFactoryStatusHref(factory: string): string | null {
  const id = paintingFactoryIdOf(factory)
  return id ? `/zones/painting/${id}` : null
}
