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
  type AssemblySummary,
  type AssyUnit,
  type BlockNodeProgress,
  type FabPart,
  type FabStageId,
  type FabricationSummary,
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

/** ASSY 생성측 원자료 — 집계·done 판정은 전부 summarizeAssemblyBlock 이 한다 */
export interface AssyRaw {
  assyNo: string
  strcCode: string
  serNo: string
  tier: AssyUnit['tier']
  parentAssyNo: string | null
  depth: number
  reqQty: number
  countedQty: number
  wos: AssyUnit['wos']
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
 * 블록-ASSY 집계 (사용자 확정 구조) — 조립은 절점 통과가 아니라 **ASSY 카드 ↔
 * W/O 리스트(1:N)** 로 관리한다. 여기서 만드는 수는 전부 그 구조에서 나온다:
 *  - ASSY 완료 = 귀속 W/O 전량 완료 (임의 임계 없음)
 *  - 종합 W/O n/m = ASSY 귀속 합계, % = n÷m (합성 산식 아님)
 *  - 검사장 이동(BTS 반출, 조립종료)은 **블록 레벨 사실**이라 호출측이 정해 넣는다
 */
export function summarizeAssemblyBlock(
  assys: readonly AssyRaw[],
  inspection: { moved: boolean; date: string | null }
): AssemblySummary {
  const units: AssyUnit[] = assys.map((a) => {
    const woTotal = a.wos.length
    const woDone = a.wos.filter((w) => w.status === 'done').length
    return {
      ...a,
      woTotal,
      woDone,
      done: woTotal > 0 && woDone === woTotal,
    }
  })
  const woTotal = units.reduce((sum, u) => sum + u.woTotal, 0)
  const woDone = units.reduce((sum, u) => sum + u.woDone, 0)
  return {
    assys: units,
    assyTotal: units.length,
    assyDone: units.filter((u) => u.done).length,
    woTotal,
    woDone,
    overallRate: woTotal === 0 ? 0 : round1((woDone / woTotal) * 100),
    inspectionMoved: inspection.moved,
    inspectionDate: inspection.moved ? inspection.date : null,
  }
}

/**
 * ASSY 정합 규칙 검증 — mock 생성기 계약 테스트용.
 *  - 인식 카운트는 분모(REQ_QTY)를 넘을 수 없다
 *  - W/O 전량 완료(ASSY 완료)면 카운트도 분모를 채워야 한다 (mock 파생 규칙)
 *  - 검사장 이동은 ASSY 전량 완료 전에 올 수 없다 (조립종료 = 블록 마감)
 *  - 계층: 부모는 목록 안에 있어야 하고 깊이는 부모+1, 급은 STRC 코드와 1:1이어야
 *    하며, **부모 완료 전에 자식 미완료가 남을 수 없다**(하위부터 조립되는 순서 —
 *    YDEH040M 부모추적의 함의)
 */
export function findAssyViolations(summary: AssemblySummary): string[] {
  const violations: string[] = []
  const byNo = new Map(summary.assys.map((u) => [u.assyNo, u]))
  const tierOfStrc: Record<string, AssyUnit['tier']> = { G: 'grand', M: 'mid', S: 'sub' }
  for (const u of summary.assys) {
    if (u.countedQty > u.reqQty) violations.push(`${u.assyNo}:count>req`)
    if (u.done && u.countedQty !== u.reqQty) violations.push(`${u.assyNo}:done-count`)
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
