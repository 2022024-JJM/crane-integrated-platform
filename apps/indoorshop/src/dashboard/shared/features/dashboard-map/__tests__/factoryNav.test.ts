import { describe, expect, it } from 'vitest'
import { groupFactoriesByProcess, workingCountOf } from '../lib/factoryNav'
import type { BayOccupant } from '../lib/bayOccupancy'
import { occupantProgressKey, type OccupantProgress } from '../lib/occupantProgress'

describe('groupFactoriesByProcess', () => {
  it('공정은 가공 → 조립 → 의장 → 도장 순, 모르는 공정은 뒤에 선다', () => {
    const groups = groupFactoriesByProcess([
      { name: 'A', process: '기타' },
      { name: 'B', process: '가공' },
      { name: 'C', process: '도장' },
      { name: 'D', process: '조립' },
      { name: 'E', process: '의장' },
    ])
    expect(groups.map((g) => g.process)).toEqual(['가공', '조립', '의장', '도장', '기타'])
  })

  it('공정 안의 공장은 이름순이며 숫자는 수로 비교한다', () => {
    const [group] = groupFactoriesByProcess([
      { name: '조립10공장', process: '조립' },
      { name: '조립2공장', process: '조립' },
    ])
    expect(group.factories.map((f) => f.name)).toEqual(['조립2공장', '조립10공장'])
  })

  it('공장이 없으면 빈 목록', () => {
    expect(groupFactoriesByProcess([])).toEqual([])
  })
})

describe('workingCountOf — 공장 목록 줄의 진행 작업 수 (공장 카드 진행 작업 합과 같은 규칙)', () => {
  const occupant = (over: Partial<BayOccupant> = {}): BayOccupant => ({
    key: '2540-281',
    projNo: '2540',
    blockNo: '281',
    zone: 'assembly',
    assys: [],
    justArrived: false,
    path: '/',
    ...over,
  })

  const progressOf = (entries: [BayOccupant, OccupantProgress][]) =>
    new Map(entries.map(([o, p]) => [occupantProgressKey(o), p]))

  it('ASSY 는 하나가 작업 하나, ASSY 가 없는 자리는 블록 하나가 작업 하나', () => {
    const a = occupant({ key: 'A', assys: [{ assyNo: 'a1', tier: 'sub' }, { assyNo: 'a2', tier: 'mid' }] })
    const b = occupant({ key: 'B' })
    const progress = progressOf([
      [a, { state: 'inProgress', pct: 40 }],
      [b, { state: 'inProgress', pct: 10 }],
    ])
    expect(workingCountOf([a, b], progress)).toBe(3)
  })

  it('실적상 작업 전·완료인 자리와 갓 반입은 세지 않는다', () => {
    const a = occupant({ key: 'A' })
    const b = occupant({ key: 'B' })
    const c = occupant({ key: 'C', justArrived: true })
    const progress = progressOf([
      [a, { state: 'done', pct: 100 }],
      [b, { state: 'notStarted', pct: 0 }],
    ])
    expect(workingCountOf([a, b, c], progress)).toBe(0)
  })
})
