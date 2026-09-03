import { describe, expect, it } from 'vitest'
import {
  bayClickIntent,
  mapSpotlight,
  selectBay,
  selectFactory,
  selectLocation,
  selectProcess,
} from '../lib/mapSpotlight'

const processOf = (name: string) =>
  ({ 조립1공장: '조립', 조립2공장: '조립', 도장1공장: '도장' })[name] ?? null

describe('mapSpotlight — 대시보드 지도 선택의 스포트라이트 파생 (FR-5 강조 문법)', () => {
  it('선택이 없으면 아무것도 스포트라이트하지 않는다', () => {
    expect(mapSpotlight(null, processOf)).toEqual({
      focusedFactory: null,
      focusedProcess: null,
    })
  })

  it('공정 카드 클릭은 그 공정만 스포트라이트한다 (공장 선택 없음)', () => {
    expect(mapSpotlight({ kind: 'process', process: '도장' }, processOf)).toEqual({
      focusedFactory: null,
      focusedProcess: '도장',
    })
  })

  it('공장 클릭은 그 공장과 **그 공장의 공정**을 함께 스포트라이트한다 — 동일 공정 공장이 dim 으로 가라앉지 않게', () => {
    expect(mapSpotlight({ kind: 'factory', name: '조립1공장' }, processOf)).toEqual({
      focusedFactory: '조립1공장',
      focusedProcess: '조립',
    })
  })

  it('공정을 모르는 공장(무소속)은 공장만 스포트라이트한다 — 기존 동작 유지', () => {
    expect(mapSpotlight({ kind: 'factory', name: '미지정공장' }, processOf)).toEqual({
      focusedFactory: '미지정공장',
      focusedProcess: null,
    })
  })

  it('작업 위치가 골라져도 스포트라이트는 공장 단위 그대로다 — 지도 강조 문법이 바뀌지 않는다', () => {
    expect(
      mapSpotlight({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' }, processOf)
    ).toEqual({
      focusedFactory: '조립1공장',
      focusedProcess: '조립',
    })
  })
})

/*
 * PRD FR-2 / 수용 기준 6 — 상위 선택이 바뀌면 그 아래 선택은 즉시 사라져야 한다.
 * 이 규칙이 깨지면 다른 공장의 정반이 지금 공장의 것처럼 강조된 채 남는다.
 */
describe('selectProcess — 공정 선택 전이', () => {
  it('공정을 고르면 이전 공장·작업 위치 선택은 남지 않는다', () => {
    const next = selectProcess(
      { kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' },
      '조립'
    )
    expect(next).toEqual({ kind: 'process', process: '조립' })
  })

  it('같은 공정을 다시 누르면 해제된다 (토글)', () => {
    expect(selectProcess({ kind: 'process', process: '조립' }, '조립')).toBeNull()
  })

  it('다른 공정을 누르면 갈아탄다', () => {
    expect(selectProcess({ kind: 'process', process: '조립' }, '도장')).toEqual({
      kind: 'process',
      process: '도장',
    })
  })
})

describe('selectFactory — 공장 선택 전이', () => {
  it('공장을 바꾸면 이전 공장의 작업 위치 선택이 제거된다', () => {
    expect(
      selectFactory({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' }, '조립2공장')
    ).toEqual({ kind: 'factory', name: '조립2공장' })
  })

  it('같은 공장을 다시 눌러도 그 아래 작업 위치 선택은 유지된다 — 목록을 훑는 동작이 초기화되지 않게', () => {
    const selection = { kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' } as const
    expect(selectFactory(selection, '조립1공장')).toBe(selection)
  })

  it('공정만 골라 둔 상태에서 공장을 고르면 공장 선택으로 내려간다', () => {
    expect(selectFactory({ kind: 'process', process: '조립' }, '조립1공장')).toEqual({
      kind: 'factory',
      name: '조립1공장',
    })
  })

  it('null 은 전체 해제다 (지도 빈 곳 클릭)', () => {
    expect(selectFactory({ kind: 'factory', name: '조립1공장' }, null)).toBeNull()
  })
})

describe('selectLocation — 고른 공장 안의 작업 위치 선택 토글', () => {
  it('공장이 골라진 상태에서 작업 위치를 누르면 그것이 선다', () => {
    expect(selectLocation({ kind: 'factory', name: '조립1공장' }, 'asm-pbs-b3')).toEqual({
      kind: 'factory',
      name: '조립1공장',
      location: 'asm-pbs-b3',
      bay: null,
    })
  })

  it('같은 위치를 다시 누르면 해제된다 (토글)', () => {
    expect(
      selectLocation({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' }, 'asm-pbs-b3')
    ).toEqual({ kind: 'factory', name: '조립1공장', location: null, bay: null })
  })

  it('다른 위치를 누르면 갈아탄다', () => {
    expect(
      selectLocation({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' }, 'asm-pbs-b4')
    ).toEqual({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b4', bay: null })
  })

  it('null 은 해제다 (상세 카드의 해제 버튼)', () => {
    expect(
      selectLocation({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3' }, null)
    ).toEqual({ kind: 'factory', name: '조립1공장', location: null, bay: null })
  })

  it('베이가 골라져 있으면 그것을 끈다 — 카드는 한 번에 하나만 말한다', () => {
    expect(
      selectLocation({ kind: 'factory', name: '조립1공장', bay: 'PBS#3' }, 'asm-pbs-b3')
    ).toEqual({ kind: 'factory', name: '조립1공장', location: 'asm-pbs-b3', bay: null })
  })

  it('공장 선택이 없으면(공정 선택·무선택) 작업 위치만 고를 수 없다 — 선택을 그대로 둔다', () => {
    expect(selectLocation(null, 'asm-pbs-b3')).toBeNull()
    expect(selectLocation({ kind: 'process', process: '조립' }, 'asm-pbs-b3')).toEqual({
      kind: 'process',
      process: '조립',
    })
  })
})

describe('selectBay — 지도에서 고른 베이 (한 번 클릭 = 선택, 이동 아님)', () => {
  it('공장이 골라진 상태에서 베이를 누르면 그것이 선다', () => {
    expect(selectBay({ kind: 'factory', name: 'PBS' }, 'PBS#3')).toEqual({
      kind: 'factory',
      name: 'PBS',
      bay: 'PBS#3',
      location: null,
    })
  })

  it('같은 베이를 다시 누르면 해제된다 (토글)', () => {
    expect(selectBay({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, 'PBS#3')).toEqual({
      kind: 'factory',
      name: 'PBS',
      bay: null,
    })
  })

  it('다른 베이를 누르면 갈아탄다', () => {
    expect(selectBay({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, 'PBS#4')).toEqual({
      kind: 'factory',
      name: 'PBS',
      bay: 'PBS#4',
      location: null,
    })
  })

  it('null 은 해제다 (베이 상세의 뒤로 가기)', () => {
    expect(selectBay({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, null)).toEqual({
      kind: 'factory',
      name: 'PBS',
      bay: null,
    })
  })

  it('공장 선택이 없으면 베이만 고를 수 없다 — 선택을 그대로 둔다', () => {
    expect(selectBay(null, 'PBS#3')).toBeNull()
    expect(selectBay({ kind: 'process', process: '조립' }, 'PBS#3')).toEqual({
      kind: 'process',
      process: '조립',
    })
  })
})

describe('selectFactory — 공장이 바뀌면 그 아래 베이 선택도 사라진다 (FR-2)', () => {
  it('다른 공장을 고르면 이전 공장의 베이는 남지 않는다', () => {
    expect(selectFactory({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, 'GBS')).toEqual({
      kind: 'factory',
      name: 'GBS',
    })
  })
})

describe('bayClickIntent — 같은 베이 재클릭 = 그 베이로 이동', () => {
  const PATH = '/indoorshop/zones/assembly/asm-pbs/asm-pbs-b3'

  it('처음 누른 베이는 고르기만 한다 (이동 없음)', () => {
    expect(bayClickIntent({ kind: 'factory', name: 'PBS' }, 'PBS#3', PATH)).toEqual({
      kind: 'select',
      selection: { kind: 'factory', name: 'PBS', bay: 'PBS#3', location: null },
    })
  })

  it('이미 고른 베이를 한 번 더 누르면 그 베이의 상세로 나간다', () => {
    expect(
      bayClickIntent({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, 'PBS#3', PATH)
    ).toEqual({ kind: 'open', path: PATH })
  })

  it('다른 베이를 누르는 것은 갈아타기다 — 재클릭이 아니다', () => {
    expect(
      bayClickIntent({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, 'PBS#4', PATH)
    ).toEqual({
      kind: 'select',
      selection: { kind: 'factory', name: 'PBS', bay: 'PBS#4', location: null },
    })
  })

  it('갈 곳이 없는 베이는 재클릭도 지금까지처럼 선택 해제다', () => {
    expect(
      bayClickIntent({ kind: 'factory', name: 'PBS', bay: 'PBS#3' }, 'PBS#3', null)
    ).toEqual({
      kind: 'select',
      selection: { kind: 'factory', name: 'PBS', bay: null },
    })
  })

  it('공장 선택이 없으면 이동하지 않는다 — 베이 선택 자체가 서지 않는다', () => {
    expect(bayClickIntent({ kind: 'process', process: '조립' }, 'PBS#3', PATH)).toEqual({
      kind: 'select',
      selection: { kind: 'process', process: '조립' },
    })
  })
})
