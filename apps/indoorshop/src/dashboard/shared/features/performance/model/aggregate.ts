/**
 * 절점 집계 — 순수 함수만 둔다 (mock 이든 실데이터든 같은 규칙으로 집계).
 *
 * IPD 정의서 §6.4·§8.5 규칙을 그대로 구현한다:
 *  - `미대상`(excluded) 부재는 그 단계의 건수·중량 **분모에서 제외**한다.
 *  - 실적률(건수%) = 완료 건수 ÷ 대상 건수, 실적률(중량%) = 완료 중량 ÷ 대상 중량 ★주지표.
 *  - 종합(중량가중) = 5단계 중량 실적률의 평균. (⚠️ 표기-산식 정합은 정의서 §8.5 미확정
 *    항목 — 정의서가 확정한 산식이 이것뿐이므로 이것만 쓴다. 임의 개선 금지.)
 *  - 대상이 0이면 실적률은 0으로 처리한다 (§8.5 예외 규칙).
 */
import {
  FAB_STAGES,
  PAINTING_STEPS,
  type AssemblySummary,
  type AssyMatch,
  type AssyUnit,
  type BlockNodeProgress,
  type FabPart,
  type FabStageId,
  type FabricationSummary,
  type PaintingProgressRow,
  type PaintingStepPlan,
  type PaintingStepState,
  type ProcessNode,
  type StageAggregate,
} from './types'

const round1 = (n: number) => Math.round(n * 10) / 10

export function aggregateStage(parts: readonly FabPart[], stage: FabStageId): StageAggregate {
  let doneCount = 0
  let inProgressCount = 0
  let notDueCount = 0
  let excludedCount = 0
  let targetWeightKg = 0
  let doneWeightKg = 0

  for (const part of parts) {
    const status = part.statuses[stage]
    if (status === 'excluded') {
      excludedCount += 1
      continue
    }
    targetWeightKg += part.weightKg
    if (status === 'done') {
      doneCount += 1
      doneWeightKg += part.weightKg
    } else if (status === 'inProgress') {
      inProgressCount += 1
    } else {
      notDueCount += 1
    }
  }

  const targetCount = doneCount + inProgressCount + notDueCount
  return {
    stage,
    targetCount,
    doneCount,
    inProgressCount,
    notDueCount,
    excludedCount,
    targetWeightKg: Math.round(targetWeightKg),
    doneWeightKg: Math.round(doneWeightKg),
    countRate: targetCount === 0 ? 0 : round1((doneCount / targetCount) * 100),
    weightRate: targetWeightKg === 0 ? 0 : round1((doneWeightKg / targetWeightKg) * 100),
  }
}

export function aggregateStages(parts: readonly FabPart[]): FabricationSummary {
  const stages = FAB_STAGES.map((stage) => aggregateStage(parts, stage))
  const overall = stages.reduce((sum, s) => sum + s.weightRate, 0) / stages.length
  return { stages, overallWeightRate: round1(overall) }
}

/**
 * 절점 파생 — 통과/진행/미도래는 집계에서, 지연은 계획일 대비로만 정한다.
 *
 * 절점 통과 = 그 단계의 대상 부재 **전량 완료** (weightRate 100 이 아니라 건수 기준 —
 * 남은 1건이 가벼워도 절점은 닫히지 않는다). 계획% 도 절점 계획일의 도래 비율일 뿐,
 * 별도 산식을 합성하지 않는다 (D3).
 */
export function deriveNodeProgress(
  summary: FabricationSummary,
  planDates: Record<FabStageId, string>,
  baseDate: string
): BlockNodeProgress {
  const nodes: ProcessNode[] = summary.stages.map((s) => {
    const passed = s.targetCount > 0 && s.doneCount === s.targetCount
    const planDate = planDates[s.stage]
    return {
      stage: s.stage,
      passed,
      inProgress: !passed && (s.inProgressCount > 0 || s.doneCount > 0),
      planDate,
      delayed: !passed && planDate <= baseDate,
    }
  })
  const arrived = nodes.filter((n) => n.planDate <= baseDate).length
  return {
    nodes,
    actualRate: summary.overallWeightRate,
    planRate: round1((arrived / nodes.length) * 100),
    delayedCount: nodes.filter((n) => n.delayed).length,
  }
}

/**
 * ASSY 생성측 원자료 — 집계·완료 판정은 전부 `summarizeAssemblyBlock` 이 한다.
 *
 * 생성측이 내는 것은 **판별 결과**(`recognizedQty`)와 그 위에 붙은 **매칭 결과**(`match`)
 * 둘뿐이다. 완료 여부는 여기서 정하지 않는다 — 매칭 불일치의 완료 금지와 하위 전량
 * 완료 규칙이 함께 걸리므로, 한 곳(집계)에서만 판정해야 규칙이 갈라지지 않는다.
 */
export interface AssyRaw {
  assyNo: string
  strcCode: string
  serNo: string
  tier: AssyUnit['tier']
  parentAssyNo: string | null
  depth: number
  /** 계획 분모 (REQ_QTY — 참고) */
  reqQty: number
  /** 판별 인식 수량 — 기준 축 */
  recognizedQty: number
  /** 마지막 판별 일자 (인식이 있었을 때만) */
  judgedDate: string | null
  match: AssyMatch
}

/**
 * ASSY 계층 정렬 — 임의 순서의 목록을 **트리 pre-order**(대조 루트 → 그 자식들
 * 들여쓰기 순)로 편다. 루트끼리·형제끼리는 입력 등장 순서를 지킨다. 부모가 목록에
 * 없는 노드는 루트 취급해 뒤에 세운다 — 계층이 깨진 데이터라도 화면에서 사라지지
 * 않게 한다(검증기 findAssyViolations 가 그 사정을 따로 잡는다).
 */
export function assyTreeOrder(assys: readonly AssyUnit[]): AssyUnit[] {
  const byNo = new Map(assys.map((u) => [u.assyNo, u]))
  const children = new Map<string, AssyUnit[]>()
  const roots: AssyUnit[] = []
  for (const u of assys) {
    if (u.parentAssyNo != null && byNo.has(u.parentAssyNo)) {
      const list = children.get(u.parentAssyNo)
      if (list) list.push(u)
      else children.set(u.parentAssyNo, [u])
    } else {
      roots.push(u)
    }
  }
  const out: AssyUnit[] = []
  const walk = (u: AssyUnit) => {
    out.push(u)
    for (const c of children.get(u.assyNo) ?? []) walk(c)
  }
  for (const r of roots) walk(r)
  return out
}

/**
 * 블록-ASSY 집계 — **기준 축은 우리 판별, W/O 는 참고**다 (사용자 확정).
 *
 * 예전에는 `ASSY 완료 = 귀속 W/O 전량 완료`라 레거시 작업지시가 우리 실적의 뼈대를
 * 정했다. 그 방향은 매칭 캐스케이드와 반대다 — 캐스케이드는 우리 판별 실적에 W/O 를
 * 찾아 붙이지, W/O 를 채워 실적을 만들지 않는다. 그래서 여기서 축을 뒤집는다:
 *
 *  - **판별 완료** = 인식 수량이 분모(REQ_QTY)를 채움 (ASM-F02). 매칭과 무관한 우리 실적.
 *  - **완료 확정** = 판별 완료 **AND** 매칭 불일치가 아님 **AND** 하위 ASSY 전량 완료 확정.
 *    - 불일치(인식 O / 레거시 X)는 **완료 처리 금지**다(ASM-F10) — 인식이 다 됐어도
 *      완료로 세지 않고 `blockedByMatch` 로 그 사정을 남긴다.
 *    - 보류는 **위로 번진다**. 소조 하나가 완료 보류면 그 중조·대조도 닫히지 않는다 —
 *      부모는 자식 전량 완료 후에만 완료되기 때문이고, 운영에서도 불일치가 풀리기
 *      전에는 블록이 안 닫힌다.
 *  - **종합 실적률 = 인식 수량 합 ÷ 계획 분모 합**. 분모가 계획값이므로 화면은
 *    "판별 실적 ÷ 계획(참고)"로 읽히게 라벨을 단다.
 *  - W/O 합계·완료율은 그대로 내되 **참고 수치**다(`woRate`).
 *  - 검사장 이동(BTS 반출, 조립종료)은 **블록 레벨 사실**이라 호출측이 정해 넣는다.
 */
export function summarizeAssemblyBlock(
  assys: readonly AssyRaw[],
  inspection: { moved: boolean; date: string | null }
): AssemblySummary {
  const rawByNo = new Map(assys.map((a) => [a.assyNo, a]))
  const childrenOf = new Map<string, string[]>()
  for (const a of assys) {
    if (a.parentAssyNo == null) continue
    const list = childrenOf.get(a.parentAssyNo)
    if (list) list.push(a.assyNo)
    else childrenOf.set(a.parentAssyNo, [a.assyNo])
  }

  const judgedOf = (a: AssyRaw): AssyUnit['judged'] =>
    a.reqQty > 0 && a.recognizedQty >= a.reqQty ? 'complete' : a.recognizedQty > 0 ? 'partial' : 'none'

  /* 완료 확정 — 자식부터 판정한다(보류가 위로 번지도록). 메모로 한 번씩만 본다. */
  const doneMemo = new Map<string, boolean>()
  const isDone = (assyNo: string, seen: ReadonlySet<string> = new Set()): boolean => {
    const cached = doneMemo.get(assyNo)
    if (cached !== undefined) return cached
    const raw = rawByNo.get(assyNo)
    /* 순환·고아는 완료로 보지 않는다 — 계층이 깨진 데이터를 완료로 넘기지 않는다
       (그 사정은 findAssyViolations 가 따로 잡는다) */
    if (!raw || seen.has(assyNo)) return false
    const next = new Set(seen).add(assyNo)
    const value =
      judgedOf(raw) === 'complete' &&
      raw.match.state !== 'unmatched' &&
      (childrenOf.get(assyNo) ?? []).every((child) => isDone(child, next))
    doneMemo.set(assyNo, value)
    return value
  }

  /*
   * **ASSY 단위 실적률** (W6-2) — 통합실적을 블록 레벨로만 보면 "이 블록 60%" 까지만
   * 알 수 있고 어느 덩이가 밀렸는지는 못 본다. 그래서 노드마다 두 값을 낸다:
   *
   *   selfRate   = 자기 인식 ÷ 자기 계획          — 그 한 덩이의 진척
   *   rollupRate = (자기+하위 인식) ÷ (자기+하위 계획) — 그 가지 전체의 진척
   *
   * 대조는 둘이 갈린다(자기 정반 작업은 끝났는데 하위 소조가 남았을 수 있다). 소조는
   * 하위가 없어 같다. 산식 축은 W5-7 그대로 **판별 인식**이고 W/O 는 참고다.
   */
  const rollupMemo = new Map<string, { rec: number; req: number; n: number }>()
  const rollupOf = (assyNo: string, seen: ReadonlySet<string> = new Set()): { rec: number; req: number; n: number } => {
    const cached = rollupMemo.get(assyNo)
    if (cached !== undefined) return cached
    const raw = rawByNo.get(assyNo)
    if (!raw || seen.has(assyNo)) return { rec: 0, req: 0, n: 0 }
    const next = new Set(seen).add(assyNo)
    const acc = { rec: raw.recognizedQty, req: raw.reqQty, n: 0 }
    for (const child of childrenOf.get(assyNo) ?? []) {
      const sub = rollupOf(child, next)
      acc.rec += sub.rec
      acc.req += sub.req
      acc.n += sub.n + 1
    }
    rollupMemo.set(assyNo, acc)
    return acc
  }
  const rateOf = (rec: number, req: number) => (req === 0 ? 0 : round1((rec / req) * 100))

  const units: AssyUnit[] = assys.map((a) => {
    const judged = judgedOf(a)
    const done = isDone(a.assyNo)
    const roll = rollupOf(a.assyNo)
    return {
      selfRate: rateOf(a.recognizedQty, a.reqQty),
      rollupRate: rateOf(roll.rec, roll.req),
      rollupRecognizedQty: roll.rec,
      rollupReqQty: roll.req,
      descendantCount: roll.n,
      assyNo: a.assyNo,
      strcCode: a.strcCode,
      serNo: a.serNo,
      tier: a.tier,
      parentAssyNo: a.parentAssyNo,
      depth: a.depth,
      reqQty: a.reqQty,
      recognizedQty: a.recognizedQty,
      judged,
      judgedDate: a.judgedDate,
      match: a.match,
      woTotal: a.match.wos.length,
      woDone: a.match.wos.filter((w) => w.status === 'done').length,
      done,
      blockedByMatch: judged === 'complete' && !done,
    }
  })

  const sum = (pick: (u: AssyUnit) => number) => units.reduce((total, u) => total + pick(u), 0)
  const recognizedQty = sum((u) => u.recognizedQty)
  const reqQtyTotal = sum((u) => u.reqQty)
  const woTotal = sum((u) => u.woTotal)
  const woDone = sum((u) => u.woDone)
  const countState = (state: AssyMatch['state']) =>
    units.filter((u) => u.match.state === state).length

  return {
    assys: units,
    assyTotal: units.length,
    assyJudged: units.filter((u) => u.judged === 'complete').length,
    assyDone: units.filter((u) => u.done).length,
    recognizedQty,
    reqQtyTotal,
    judgedRate: reqQtyTotal === 0 ? 0 : round1((recognizedQty / reqQtyTotal) * 100),
    woTotal,
    woDone,
    woRate: woTotal === 0 ? 0 : round1((woDone / woTotal) * 100),
    match: {
      matched: countState('matched'),
      fallback: countState('fallback'),
      unmatched: countState('unmatched'),
    },
    inspectionMoved: inspection.moved,
    inspectionDate: inspection.moved ? inspection.date : null,
  }
}

/**
 * ASSY 정합 규칙 검증 — mock 생성기 계약 테스트용. **판별 기준 축**의 규칙이다.
 *  - 인식 수량은 분모(REQ_QTY)를 넘을 수 없다
 *  - 완료 확정이면 판별도 완료여야 한다 (완료의 필요조건이 판별이다)
 *  - **매칭 불일치는 완료일 수 없다** (ASM-F10 완료 처리 금지)
 *  - 불일치인데 W/O 가 붙어 있으면 상태와 데이터가 어긋난 것이다
 *  - 참고 W/O 완료 수는 붙은 수를 넘을 수 없다
 *  - 검사장 이동은 ASSY 전량 완료 확정 전에 올 수 없다 (조립종료 = 블록 마감)
 *  - 계층: 부모는 목록 안에 있어야 하고 깊이는 부모+1, 급은 STRC 코드와 1:1이어야
 *    하며, **부모 완료 전에 자식 미완료가 남을 수 없다**(하위부터 조립되는 순서 —
 *    YDEH040M 부모추적의 함의)
 */
export function findAssyViolations(summary: AssemblySummary): string[] {
  const violations: string[] = []
  const byNo = new Map(summary.assys.map((u) => [u.assyNo, u]))
  const tierOfStrc: Record<string, AssyUnit['tier']> = { G: 'grand', M: 'mid', S: 'sub' }
  for (const u of summary.assys) {
    if (u.recognizedQty > u.reqQty) violations.push(`${u.assyNo}:count>req`)
    if (u.done && u.judged !== 'complete') violations.push(`${u.assyNo}:done-not-judged`)
    if (u.done && u.match.state === 'unmatched') violations.push(`${u.assyNo}:done-unmatched`)
    if (u.match.state === 'unmatched' && u.match.wos.length > 0)
      violations.push(`${u.assyNo}:unmatched-has-wo`)
    if (u.match.state !== 'fallback' && u.match.flag !== null)
      violations.push(`${u.assyNo}:flag-without-fallback`)
    if (u.woDone > u.woTotal) violations.push(`${u.assyNo}:wo`)
    if (tierOfStrc[u.strcCode] !== u.tier) violations.push(`${u.assyNo}:tier-strc`)
    if (u.parentAssyNo == null) {
      if (u.depth !== 0) violations.push(`${u.assyNo}:root-depth`)
    } else {
      const parent = byNo.get(u.parentAssyNo)
      if (!parent) violations.push(`${u.assyNo}:orphan`)
      else {
        if (u.depth !== parent.depth + 1) violations.push(`${u.assyNo}:depth`)
        if (parent.done && !u.done) violations.push(`${u.assyNo}:child-after-parent`)
      }
    }
  }
  if (summary.inspectionMoved && summary.assyDone !== summary.assyTotal)
    violations.push('inspection-before-done')
  return violations
}

/**
 * IPD-S04 순차 규칙 검증 — 선행 단계(미대상 제외)가 완료되지 않았는데 후행 단계가
 * 착수(진행중/완료)한 부재가 있으면 그 부재번호를 돌려준다. mock 생성기의 계약 테스트와
 * 실연동 데이터 검증에 같이 쓴다.
 */
export function findSequenceViolations(parts: readonly FabPart[]): string[] {
  const violations: string[] = []
  for (const part of parts) {
    let priorIncomplete = false
    for (const stage of FAB_STAGES) {
      const status = part.statuses[stage]
      if (status === 'excluded') continue
      if (priorIncomplete && (status === 'done' || status === 'inProgress')) {
        violations.push(part.partNo)
        break
      }
      if (status !== 'done') priorIncomplete = true
    }
  }
  return violations
}


/* ── 도장 스텝 집계 — 존재 기반(existence-based) ────────────────────────────
 *
 * 사용자 확정(2026-09-03). 고정 3단 사다리가 아니다: 스텝이 몇 개인지도, 한 스텝의
 * 분모가 몇 행인지도 **그 블록의 계획(YPWP720M)이 정한다**.
 *
 *  - 계획 행이 0 인 스텝은 **목록에서 빠진다** — RE-S/P(R0)처럼 이벤트성 요소가
 *    없는 블록에서 T/UP 자체가 없을 수 있고, 그때 분모를 3 으로 잡으면 영영 못 채운다.
 *  - 스텝의 분모는 그 스텝으로 분류된 **계획 행 전부**다 (회차 × 존 × 내외 분산 포함).
 *    실데이터에서 한 블록의 S/P 계획 행은 2~99행까지 벌어진다.
 *  - **스텝 완료 = 계획 행 전량 완료.** 부분 완료는 진행중이다 (실데이터 20블록 중
 *    S/P 가 부분 완료인 블록이 9개 — 전량/부분을 가르지 않으면 진행을 완료로 읽는다).
 *
 * 존(PNT_ZONE_CODE)별로 나누지 않고 스텝 하나로 통합한다 — 현업 합의(2026-09-03 회의)
 * 이기도 하다. 실적 등록이 **하루 1회 일괄**이라 부분 완료가 며칠씩 이어지는 것이 정상이며,
 * 그래서 부분/전량을 가르는 것이 더 중요하다.
 *
 * 실데이터든 mock 이든 이 함수 하나만 거친다. 근거는 「선행도장권역 Legacy
 * 데이터플로우」 §3.4.
 *
 * ── 진행률(%) — 참고 수치 (W5-9) ─────────────────────────────────────────
 * 완료/미완료 두 값만으로는 "진행 중인 스텝이 얼마나 됐는지"를 말할 수 없다. 그 정보는
 * `YPWG413M`(일일작업실적내역)의 `DLY_PRGS_RATE` 에만 있으므로, 계획 행마다 공정률을
 * 달아 **면적 가중 평균**으로 접는다:
 *
 *     진행률% = Σ(행 WORK_PLC_AREA × 행 공정률) ÷ Σ(행 WORK_PLC_AREA)
 *
 * 가중치로 `WORK_PLC_AREA` 를 쓴 근거(실데이터 2,014 스텝 행):
 *  · `WORK_PLC_AREA` 채움률 **100%** — 도장은 면적 작업이라 물량의 자연 척도다
 *  · `STD_MH` 는 채움률 69.6% (결측 30.4%). 60개 (블록,스텝) 중 **42건이 일부 결측**이라
 *    시수 가중을 쓰면 결측 행이 분모에서 통째로 빠져 진척이 부풀거나 꺼진다
 *  · `ACTL_DIR_MH` 5.8% · `ESTM_WF` 78.1% — 둘 다 결측이 커서 가중치로 못 쓴다
 *  · 단순 평균과 면적 가중은 실데이터 60건 중 11건에서 갈리고 최대 17.2%p 차라, 어느
 *    쪽을 쓰는지가 실제로 화면을 바꾼다 — 결측 없는 쪽을 택했다
 *
 * **이 % 는 완료 판정에 쓰지 않는다.** 스텝 완료는 여전히 계획 행 전량 완료뿐이다.
 * 재료가 없으면(413M 등록 전) 행 완료율로 대체해 화면이 비지 않게 한다.
 */

/** 면적 가중 평균 — 면적 합이 0 이면 단순 평균으로 물러선다 */
function weightedProgress(rows: readonly PaintingProgressRow[]): number {
  if (rows.length === 0) return 0
  const area = rows.reduce((a, r) => a + Math.max(0, r.areaSqm), 0)
  const pct =
    area > 0
      ? rows.reduce((a, r) => a + Math.max(0, r.areaSqm) * r.progressPct, 0) / area
      : rows.reduce((a, r) => a + r.progressPct, 0) / rows.length
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10))
}

/** 계획 행 대비 완료 행으로 스텝 상태를 가른다 — 전량 완료라야 done */
export function paintingStepStatus(plan: PaintingStepPlan): PaintingStepState['status'] {
  if (plan.plannedRows <= 0) return 'notDue'
  if (plan.doneRows >= plan.plannedRows) return 'done'
  if (plan.doneRows > 0 || plan.startDate !== null) return 'inProgress'
  return 'notDue'
}

/**
 * 블록 하나의 스텝 계획을 화면 상태로 접는다.
 * **계획 행이 없는 스텝은 결과에 담지 않는다** — `steps.length` 가 곧 그 블록의 분모다.
 * 순서는 언제나 `PAINTING_STEPS`(S/P → T/UP → FINAL)를 따른다.
 */
export function buildPaintingSteps(plans: readonly PaintingStepPlan[]): PaintingStepState[] {
  const byStep = new Map(plans.map((p) => [p.step, p]))
  return PAINTING_STEPS.flatMap((step) => {
    const plan = byStep.get(step)
    if (plan == null || plan.plannedRows <= 0) return []
    const status = paintingStepStatus(plan)
    const doneRows = Math.min(plan.doneRows, plan.plannedRows)
    /* 413M 재료가 있으면 면적 가중 %, 없으면 행 완료율로 대체한다.
       완료 스텝은 정의상 100% — 재료가 어긋나도 카드가 '완료인데 92%' 를 말하지 않게 한다. */
    const progressPct =
      status === 'done'
        ? 100
        : plan.progressRows && plan.progressRows.length > 0
          ? weightedProgress(plan.progressRows)
          : Math.round((doneRows / plan.plannedRows) * 1000) / 10
    return [
      {
        step,
        status,
        woNo: plan.woNo,
        elmtItemCodes: plan.elmtItemCodes,
        plannedRows: plan.plannedRows,
        doneRows,
        progressPct,
        progressAsOf: plan.progressAsOf ?? null,
        startDate: plan.startDate,
        /* 전량 완료가 아니면 완료일을 세우지 않는다 — 부분 완료를 완료로 읽지 않기 위해 */
        endDate: status === 'done' ? plan.endDate : null,
        /* 확정(YPWG221M 'B')은 완료 뒤에만 온다 */
        confirmed: status === 'done' && plan.confirmed,
      },
    ]
  })
}

/** 완료 스텝 수 — 분모는 `steps.length`(존재 기반)다 */
export function countPaintingDone(steps: readonly PaintingStepState[]): number {
  return steps.filter((s) => s.status === 'done').length
}

/** 확정 스텝 수 — 분모는 완료 스텝 수다 (미완료 스텝은 확정될 수 없다) */
export function countPaintingConfirmed(steps: readonly PaintingStepState[]): number {
  return steps.filter((s) => s.confirmed).length
}
