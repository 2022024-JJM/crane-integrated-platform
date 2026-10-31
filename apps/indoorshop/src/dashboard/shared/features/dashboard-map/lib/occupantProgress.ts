import type { BayOccupant } from './bayOccupancy'

/*
 * 베이에 선 작업이 **정말 돌고 있는가** — 카드의 '작업 중' 과 공장 카드의 '진행 작업' 수의 근거.
 *
 * 로스터는 "어디에 무엇이 놓였나"만 말한다. 놓였다고 작업 중인 것은 아니다 — 소조 정반에
 * 자리만 잡혀 있고 판별이 하나도 안 선 ASSY 를 '작업 중' 이라 적으면, 그 베이의 3D·정반
 * 현황(라이다 미검출)과 정면으로 어긋난다. 그래서 상태는 **실적 원천**에서 읽는다 —
 * 실적 배지·통합실적과 같은 값(연계 매트릭스 원칙):
 *
 *  - 조립 — 이 자리의 ASSY 판별(`fetchAssemblySummary`). 인식 0·판별 없음 = 작업 전,
 *            전부 판별 완료 = 완료, 그 사이 = 작업 중(인식 ÷ 계획).
 *  - 도장 — 스텝 절점(`fetchPaintingSummary`). 통과·진행 스텝이 없으면 작업 전.
 *  - 의장 — 의장 재공의 상태·판별 진척(`fetchOutfittingWipBlocks`, 레지스트리).
 *
 * 갓 반입은 실적과 무관하게 '작업 전' 이다(로스터가 말하는 사실). 원천이 답하지 않으면
 * `unknown` — 모르는 것을 작업 중으로 칠하지 않는다.
 */

export type OccupantProgressState = 'notStarted' | 'inProgress' | 'done' | 'unknown'

export interface OccupantProgress {
  state: OccupantProgressState
  /** 진척(%) — 원천이 낼 때만 */
  pct: number | null
}

/** 같은 블록이라도 자리마다 ASSY 가 다르다 — 자리 단위 키 */
export function occupantProgressKey(occupant: BayOccupant): string {
  return `${occupant.key}|${occupant.zone}|${occupant.assys.map((a) => a.assyNo).join(',')}`
}

function pctOf(done: number, total: number): number | null {
  return total > 0 ? Math.round((done / total) * 100) : null
}

/** 진행 중으로 셀 것인가 — 공장 카드 '진행 작업' 의 필터 */
export function isWorking(progress: OccupantProgress | undefined): boolean {
  /* 아직 모르면(로딩 중) 로스터대로 세어 둔다 — 숫자가 0 에서 튀어 오르지 않게 */
  return progress == null || progress.state === 'inProgress' || progress.state === 'unknown'
}

/**
 * 작업 목록의 **묶음** — 작업 중 · 작업 전 · 작업 완료(이 순서로 보인다 — 사용자 확정). 베이
 * 카드의 작업 목록과 지도의 베이 hover 카드가 같은 규칙으로 가른다.
 * 갓 반입·실적상 작업 전은 작업 전, 완료는 완료, 나머지(작업 중·확인 중·알 수 없음)는 작업 중 —
 * 진행 작업 수도 확인 전의 자리를 세어 둔다(`isWorking`).
 */
export type OccupantGroup = 'inProgress' | 'notStarted' | 'done'
export const OCCUPANT_GROUP_ORDER: readonly OccupantGroup[] = ['inProgress', 'notStarted', 'done']

export function occupantGroupOf(occupant: BayOccupant, progress: OccupantProgress | undefined): OccupantGroup {
  if (occupant.justArrived) return 'notStarted'
  return progress?.state === 'notStarted' ? 'notStarted' : progress?.state === 'done' ? 'done' : 'inProgress'
}

/** 자리들의 진행 상태를 한 번에 읽는다. 무거운 실적 모듈은 동적 import 로만 끌어온다 */
export async function loadOccupantProgress(
  occupants: readonly BayOccupant[],
  baseDate: string
): Promise<Map<string, OccupantProgress>> {
  const result = new Map<string, OccupantProgress>()
  if (occupants.length === 0) return result
  const [api, registry] = await Promise.all([
    import('../../performance/api/performanceApi'),
    import('../../../model/processRegistry'),
  ])
  const needsOutfitting = occupants.some((o) => o.zone === 'outfitting')
  const outfitting = needsOutfitting
    ? await registry.fetchOutfittingWipBlocks(baseDate).catch(() => [])
    : []

  await Promise.all(
    occupants.map(async (occupant) => {
      const key = occupantProgressKey(occupant)
      if (occupant.justArrived) {
        result.set(key, { state: 'notStarted', pct: 0 })
        return
      }
      try {
        if (occupant.zone === 'assembly') {
          const summary = await api.fetchAssemblySummary(occupant.projNo, occupant.blockNo, baseDate)
          const wanted = new Set(occupant.assys.map((a) => a.assyNo))
          /* 흩어진 블록은 **이 자리의 ASSY 만**, 블록 단위 자리는 블록 전체로 */
          const rows = wanted.size > 0 ? summary.assys.filter((a) => wanted.has(a.assyNo)) : summary.assys
          const recognized = rows.reduce((sum, a) => sum + a.recognizedQty, 0)
          const required = rows.reduce((sum, a) => sum + a.reqQty, 0)
          const allDone = rows.length > 0 && rows.every((a) => a.judged === 'complete')
          const anyJudged = rows.some((a) => a.judged !== 'none')
          result.set(key, {
            state: allDone ? 'done' : recognized === 0 && !anyJudged ? 'notStarted' : 'inProgress',
            pct: pctOf(recognized, required),
          })
          return
        }
        if (occupant.zone === 'fabrication') {
          /* 가공 — 가공 종합(절점 중량 실적률 평균)이 진행도다. 착수 전 = 0, 다 끝남 = 100 */
          const summary = await api.fetchFabricationStages(occupant.projNo, occupant.blockNo, baseDate)
          const pct = Math.round(summary.overallWeightRate)
          result.set(key, { state: pct >= 100 ? 'done' : pct > 0 ? 'inProgress' : 'notStarted', pct })
          return
        }
        if (occupant.zone === 'painting') {
          const summary = await api.fetchPaintingSummary(occupant.projNo, occupant.blockNo, baseDate)
          const total = summary.steps.length
          const started = summary.steps.some((s) => s.status !== 'notDue' || s.progressPct > 0)
          result.set(key, {
            state:
              total > 0 && summary.doneSteps === total ? 'done' : started ? 'inProgress' : 'notStarted',
            pct: pctOf(summary.doneSteps, total),
          })
          return
        }
        if (occupant.zone === 'outfitting') {
          const row = outfitting.find(
            (b) => b.projNo === occupant.projNo && b.blockNo === occupant.blockNo
          )
          if (!row) {
            result.set(key, { state: 'unknown', pct: null })
            return
          }
          result.set(key, {
            state:
              row.status === 'completed'
                ? 'done'
                : row.status === 'waiting' && row.judgedRate === 0
                  ? 'notStarted'
                  : 'inProgress',
            pct: Math.round(row.judgedRate),
          })
          return
        }
        result.set(key, { state: 'unknown', pct: null })
      } catch {
        result.set(key, { state: 'unknown', pct: null })
      }
    })
  )
  return result
}
