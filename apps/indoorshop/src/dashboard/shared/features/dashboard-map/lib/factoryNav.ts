import { workSummaryOf, type BayOccupant } from './bayOccupancy'
import { isWorking, occupantProgressKey, type OccupantProgress } from './occupantProgress'

/*
 * 야드 맵 왼쪽 공장 목록(`FactoryNavPanel`)의 데이터 모양과 묶음 규칙.
 */

/** 목록 줄 하나가 될 공장 — 이름이 곧 식별자(지도와 같다) */
export interface FactoryNavItem {
  name: string
  process: string
}

/* 공정 순서 — 가공 → 조립 → 의장 → 도장 (사용자 확정). 목록에 없는 공정은 뒤에 이름순 */
const PROCESS_ORDER = ['가공', '조립', '의장', '도장']

/** 공정의 자리 — 공장 목록과 점검 필요 목록이 같은 순서를 쓴다 */
export function processRank(process: string): number {
  const i = PROCESS_ORDER.indexOf(process)
  return i < 0 ? PROCESS_ORDER.length : i
}

const byName = (a: string, b: string) => a.localeCompare(b, 'ko', { numeric: true })

/** 공장을 공정별로 묶는다 — 공정은 정해진 순서, 공장은 이름순(숫자는 수로) */
export function groupFactoriesByProcess(
  factories: readonly FactoryNavItem[]
): { process: string; factories: FactoryNavItem[] }[] {
  const groups = new Map<string, FactoryNavItem[]>()
  for (const factory of factories) {
    const list = groups.get(factory.process) ?? []
    list.push(factory)
    groups.set(factory.process, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => processRank(a) - processRank(b) || byName(a, b))
    .map(([process, list]) => ({ process, factories: [...list].sort((a, b) => byName(a.name, b.name)) }))
}

/**
 * 공장 하나의 **진행 작업 수** — 공장 카드 '진행 작업' 타일 수의 합과 같은 값이다(같은 규칙:
 * 실적상 작업 전·완료인 자리는 빼고, ASSY 가 있으면 ASSY 하나가 작업 하나, 없으면 블록 하나).
 * 목록 줄과 카드가 같은 공장을 두고 다른 수를 말하지 않게 한 곳에서 센다.
 */
export function workingCountOf(
  occupants: readonly BayOccupant[],
  progress: ReadonlyMap<string, OccupantProgress>
): number {
  const working = occupants.filter((o) => isWorking(progress.get(occupantProgressKey(o))))
  return workSummaryOf(working).reduce((sum, work) => sum + work.count, 0)
}
